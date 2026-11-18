import { useEffect, useRef, useState } from "react";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { openCamera, stopStream } from "@/lib/cameraStream";
import CameraSourcePicker from "@/components/mobile/CameraSourcePicker";
import CameraFocusLockToggle from "@/components/mobile/CameraFocusLockToggle";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Sparkles, CheckCircle2, XCircle, Image as ImageIcon, Camera, Save, Upload, ShieldCheck, History, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadFaceModels, loadImageFromUrl, detectFaceWithLandmarks, assessFaceQuality, BANK_GRADE, type QualityReport } from "@/lib/faceApi";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";
import { canvasToFaceThumb } from "@/lib/faceThumb";
import { computeFaceTexture } from "@/lib/faceTexture";
import { clearRegisteredFaceCache } from "@/lib/registeredFace";
import { loadFaceSyncImage } from '@/lib/faceSyncImage';
import { saveErrorMessage } from "@/lib/saveError";
import FaceSamplePreview, { type FacePoint } from './FaceSamplePreview';
import { fivePointsFromLandmarks68 } from '@/lib/arcface';
import { faceSampleError, MAX_ENROLLMENT_PHOTOS, MAX_ENROLLMENT_FILE_BYTES } from '@/lib/faceEnrollment';
import { detectEnrollmentFace } from '@/lib/detectEnrollmentFace';
import { IdCardPhoto } from '@/components/IdCardPhoto';
import FaceGuideOverlay from "@/components/facescan/FaceGuideOverlay";
import { canSaveFaceRegistration } from '@/lib/faceRegistrationPolicy';
import { filterFaceRegistrationStudents } from '@/lib/faceRegistrationFilter';
import { swal } from '@/lib/swal';
import { removePendingFacePortrait } from '@/lib/removePendingFacePortrait';
import { detectRobustFaceDescriptor, saveSyncedFaceDescriptor } from '@/lib/faceSync';


const FaceRegisterTab = () => {
  const qc = useQueryClient();
  const { role, readOnly } = useUserRole();
  const canSaveDirectly = canSaveFaceRegistration(role, readOnly);
  const [modelReady, setModelReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [failedList, setFailedList] = useState<Array<{ id: string; name: string; reason: string }>>([]);
  const autoRan = useRef(false);

  // Manual capture / upload
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [camDeviceId, setCamDeviceId] = useState<string | undefined>(undefined);
  const [camTick, setCamTick] = useState(0);

  const [studentId, setStudentId] = useState("");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState('all');
  const [reason, setReason] = useState("");
  const [shots, setShots] = useState<Array<{ points: FacePoint[]; canvas: HTMLCanvasElement; desc: Float32Array; texture?: number[] | null; source: "camera" | "upload"; quality: QualityReport }>>([]);
  const [lastQuality, setLastQuality] = useState<QualityReport | null>(null);
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => { loadFaceModels().then(() => setModelReady(true)); }, []);


  const { data: students = [] } = useQuery({
    queryKey: ["students-list-face-register"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name)")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["face-registered-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_face_descriptors").select("student_id");
      if (error) throw error;
      return data || [];
    },
  });

  const registeredIds = new Set(existing.map((r: any) => r.student_id));
  const withAvatar = students.filter((s: any) => s.photo_url);
  const withoutAvatar = students.filter(s => !s.photo_url);
  const pending = withAvatar.filter((s: any) => !registeredIds.has(s.id));
  const removePortrait = async (id: string) => {
    const student = students.find(s => s.id === id);
    if (!canSaveDirectly || syncing || removing || !student?.photo_url) return;
    if (!await swal.confirm({ title: `ลบรูปบัตรของ ${student.first_name} ${student.last_name}?`, text: 'นำรูปนี้ออกจากรายการซิงค์และล้างใบหน้าที่อ้างอิงรูปเดิม ไม่ลบประวัติมาโรงเรียน รูปโปรไฟล์บัญชีและไฟล์ต้นฉบับที่ใช้งานร่วมกันยังคงอยู่', danger: true })) return;
    setRemoving(id);
    try {
      await removePendingFacePortrait(id, student.photo_url);
      setFailedList(list => list.filter(f => f.id !== id));
      clearRegisteredFaceCache(id);
      await Promise.all(['students-list-face-register','face-registered-ids','face-known','face-db','face-pending-requests','students'].map(key => qc.invalidateQueries({ queryKey:[key] })));
      toast.success('นำรูปออกจากรายการซิงค์แล้ว');
    } catch (error) { toast.error(saveErrorMessage(error)); }
    finally { setRemoving(null); }
  };

  const runAutoSync = async (force = false) => {
    if (!modelReady) { toast.error("AI Model ยังไม่พร้อม"); return; }
    setSyncing(true);
    setFailedList([]);
    const targets = force ? withAvatar : pending;
    setProgress({ done: 0, total: targets.length, ok: 0, fail: 0 });
    if (targets.length === 0) {
      toast.info("ข้อมูลใบหน้าซิงค์ครบทุกคนแล้ว");
      setSyncing(false);
      setLastSyncedAt(new Date().toISOString());
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    let ok = 0, fail = 0, done = 0;
    const fails: Array<{ id: string; name: string; reason: string }> = [];
    // Batch 3 parallel (เร็ว 3เท่า ไม่หนัก Atom)
    const BATCH = 3;
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH) as any[];
      const results = await Promise.all(batch.map(async (s: any) => {
        const fullName = `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim();
        try {
          const img = await loadFaceSyncImage(s.photo_url, loadImageFromUrl);
          const desc = await detectRobustFaceDescriptor(img);
          if (!desc) return { ok: false, name: fullName, id: s.id, reason: "ตรวจไม่พบใบหน้าในรูป (เบลอ/มุมเอียง/หลายคน)" };
          await saveSyncedFaceDescriptor(s.id, desc, user?.id);
          return { ok: true, name: fullName, id: s.id };
        } catch (e: any) {
          return { ok: false, name: fullName, id: s.id, reason: e?.message || "unknown error" };
        }
      }));
      for (const r of results) {
        if (r.ok) ok++; else { fail++; fails.push({ id: r.id, name: r.name, reason: r.reason }); }
        done++;
      }
      setProgress({ done, total: targets.length, ok, fail });
    }
    setFailedList(fails);
    setLastSyncedAt(new Date().toISOString());
    setSyncing(false);
    toast.success(`ซิงค์เสร็จ: สำเร็จ ${ok} • ล้มเหลว ${fail}`);
    qc.invalidateQueries({ queryKey: ["face-registered-ids"] });
    qc.invalidateQueries({ queryKey: ["face-known"] });
    qc.invalidateQueries({ queryKey: ["face-db"] });
  };

  // Auto-run on first mount when there are pending
  useEffect(() => {
    if (autoRan.current) return;
    if (!modelReady) return;
    if (students.length === 0) return;
    if (pending.length === 0) return;
    autoRan.current = true;
    runAutoSync(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelReady, students.length, pending.length]);

  // ====== Manual capture ======
  const grades = [...new Set(students.map(s => s.classrooms?.grade_level).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  const filtered = filterFaceRegistrationStudents(students, search, grade);

  const startCamera = async (deviceId?: string) => {
    try {
      const res = await openCamera({ facing: "user", deviceId: deviceId ?? camDeviceId, width: 1280, height: 720 });
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, res.stream);
        setStreaming(true);
        setCamDeviceId(res.deviceId);
        setCamTick((t) => t + 1);
      } else {
        stopStream(res.stream);
      }
    } catch (e: any) { toast.error(e?.message || "เปิดกล้องไม่สำเร็จ"); }
  };
  const stopCamera = () => {
    stopStream(videoRef.current?.srcObject as MediaStream | null, videoRef.current);
    setStreaming(false);
  };
  const pickCamera = (deviceId: string) => {
    setCamDeviceId(deviceId);
    stopCamera();
    setTimeout(() => startCamera(deviceId), 150);
  };

  const captureShot = async () => {
    if (!videoRef.current || !modelReady || !studentId || shots.length >= MAX_ENROLLMENT_PHOTOS) return;
    setBusy(true);
    try {
      const det = await detectEnrollmentFace(videoRef.current);
      if (!det) { setLastQuality(null); toast.error("ไม่พบใบหน้าในภาพ"); return; }
      const q = assessFaceQuality(videoRef.current, det, "register");
      setLastQuality(q);
      if (!q.ok) {
        toast.error("คุณภาพภาพไม่ผ่านมาตรฐาน", { description: q.reasons[0] });
        return;
      }
      const sampleError = faceSampleError(det.descriptor, shots.map(s=>s.desc));
      if (sampleError || !det.descriptor) { toast.error(sampleError || 'อ่านใบหน้าไม่สำเร็จ'); return; }
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      const descriptor = det.descriptor;
      const texture = computeFaceTexture(videoRef.current, det.landmarks);
      setShots((s) => [...s, { points: fivePointsFromLandmarks68(det.landmarks), canvas, desc: descriptor, texture, source: "camera", quality: q }]);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'ถ่ายใบหน้าไม่สำเร็จ'); } finally { setBusy(false); }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !modelReady || !studentId) return;
    if (shots.length + files.length > MAX_ENROLLMENT_PHOTOS) { toast.error('เก็บได้สูงสุด 5 รูปต่อครั้ง'); return; }
    setBusy(true);
    let ok = 0, fail = 0, lowQ = 0;
    setUploadFailures([]);
    const lowQReasons: string[] = [];
    const added: typeof shots = [];
    try {
      for (const file of Array.from(files)) {
        try {
          if (!['image/jpeg','image/png'].includes(file.type) || file.size > MAX_ENROLLMENT_FILE_BYTES) throw new Error('รองรับ JPG/PNG ไม่เกิน 6 MB');
          const url = URL.createObjectURL(file);
          let img: HTMLImageElement;
          try { img = await loadImageFromUrl(url); } finally { URL.revokeObjectURL(url); }
          const det = await detectEnrollmentFace(img);
          if (!det) { fail++; lowQReasons.push(`${file.name}: ไม่พบใบหน้า กรุณาใช้รูปหน้าตรงหรือหันเล็กน้อย`); continue; }
          const q = assessFaceQuality(img, det, "register");
          setLastQuality(q);
          if (!q.ok) {
            lowQ++;
            lowQReasons.push(`${file.name}: ${q.reasons.join(' • ')}`);
            continue;
          }
          setLastQuality(q);
          const sampleError = faceSampleError(det.descriptor, [...shots,...added].map(s=>s.desc));
          if (sampleError || !det.descriptor) throw new Error(sampleError || 'อ่าน ArcFace ไม่สำเร็จ');
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")?.drawImage(img, 0, 0);
          added.push({ points: fivePointsFromLandmarks68(det.landmarks), canvas, desc: det.descriptor, texture: computeFaceTexture(img, det.landmarks), source: "upload", quality: q });
          ok++;
        } catch (error) { fail++; lowQReasons.push(file.name+': '+(error instanceof Error ? error.message : 'อ่านไฟล์ไม่สำเร็จ')); }
      }
      setUploadFailures(lowQReasons);
      setShots(current=>[...current,...added]);
      const parts = [];
      if (ok) parts.push(`เพิ่ม ${ok} รูป`);
      if (fail) parts.push(`ใช้รูปไม่ได้ ${fail} รูป`);
      if (lowQ) parts.push(`คุณภาพต่ำ ${lowQ} รูป`);
      if (ok > 0) toast.success(parts.join(" • "), lowQReasons.length ? { description: lowQReasons.join("\n") } : undefined);
      else if (lowQ > 0) toast.error("รูปคุณภาพไม่ผ่าน", { description: lowQReasons.join("\n") });
      else if (fail > 0) toast.error(`ใช้รูปไม่ได้ (${fail} รูป)`, { description: lowQReasons.join("\n") });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);/.exec(meta)?.[1] || "image/jpeg";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const uploadShotsToStorage = async (sid: string): Promise<string[]> => {
    const urls: string[] = [];
    const ts = Date.now();
    for (let i = 0; i < shots.length; i++) {
      const dataUrl = shots[i].canvas.toDataURL("image/jpeg", 0.85);
      const blob = dataUrlToBlob(dataUrl);
      const path = `requests/${sid}/${ts}_${i}_${shots[i].source}.jpg`;
      const { error } = await supabase.storage.from("face-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      urls.push(path);
    }
    return urls;
  };

  /** กันจำผิดคน: ตรวจว่าใบหน้าไม่ซ้ำกับนักเรียนคนอื่นที่ลงทะเบียนไว้แล้ว */
  const assertNotDuplicate = async (sid: string) => {
    const descriptors = shots.map((s) => Array.from(s.desc));
    const { data, error } = await supabase.rpc("check_face_duplicate", {
      _student_id: sid,
      _descriptors: descriptors as any,
      _threshold: 0.42,
    });
    if (error) throw error;
    const hit = Array.isArray(data) ? (data as any[])[0] : null;
    if (hit) {
      const ok = await swal.confirm({
        title: `ใบหน้าคล้าย ${hit.match_name ?? ""} (${hit.match_code ?? "-"})`,
        text: `ระยะห่าง ${Number(hit.min_distance).toFixed(3)} — ถ้าเป็นคนละคนจริง (เช่น ฝาแฝด/พี่น้อง) กดยืนยันเพื่อบันทึกต่อ ระบบตู้จะสแกนผ่านเฉพาะเมื่อแยกได้ชัด ถ้าไม่ชัดจะให้ใช้ QR บัตร`,
        danger: true,
      });
      if (!ok) throw new Error("ยกเลิก: ใบหน้าซ้ำกับคนอื่น");
    }
  };

  const saveDirectly = async () => {
    if (!studentId || shots.length === 0) return;
    if (!canSaveDirectly) { toast.error("บัญชีนี้ไม่มีสิทธิ์ลงทะเบียนใบหน้า"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
      const isRereg = registeredIds.has(studentId);

      await assertNotDuplicate(studentId);

      const { data: prev, error: previousError } = await supabase.from("student_face_descriptors")
        .select("id").eq("student_id", studentId);
      if (previousError) throw previousError;
      const previous_count = prev?.length ?? 0;

      const photo_urls = await uploadShotsToStorage(studentId);
      const startIdx = isRereg ? 0 : previous_count;
      const rows = shots.map((s, i) => ({
        student_id: studentId, sample_index: startIdx + i,
        descriptor: Array.from(s.desc), captured_by: user?.id, source: s.source,
        quality_score: s.quality?.score ?? null,
        metrics: (s.quality as any) ?? null,
        face_image: photo_urls[i],
        created_at: new Date().toISOString(),
        texture: s.texture ?? null,
      }));
      const { error } = await supabase.from("student_face_descriptors").upsert(rows, { onConflict: "student_id,sample_index" });
      if (error) throw error;

      if (isRereg) {
        const { error: cleanupError } = await supabase.from("student_face_descriptors").delete().eq("student_id", studentId).gte("sample_index", rows.length);
        if (cleanupError) throw cleanupError;
      }
      const { error: historyError } = await supabase.from("face_registration_history").insert({
        student_id: studentId,
        action: isRereg ? "direct_replace" : "direct_add",
        previous_count,
        new_count: rows.length + (isRereg ? 0 : previous_count),
        photo_urls,
        reason: reason.trim() || null,
        notes: isRereg ? "บันทึกใหม่ทั้งหมด (แทนที่ของเดิม)" : "เพิ่มภาพใบหน้าตรง",
        performed_by: user?.id,
      });
      if (historyError) throw new Error("บันทึกใบหน้าแล้ว แต่บันทึกประวัติไม่สำเร็จ: " + historyError.message);

      clearRegisteredFaceCache(studentId);
      toast.success(`บันทึก ${shots.length} ภาพสำเร็จ`);
      setShots([]); setReason("");
      qc.invalidateQueries({ queryKey: ["face-known"] });
      qc.invalidateQueries({ queryKey: ["face-known-kiosk"] });
      qc.invalidateQueries({ queryKey: ["face-db"] });
      qc.invalidateQueries({ queryKey: ["face-registered-ids"] });
      qc.invalidateQueries({ queryKey: ["face-history"] });
    } catch (e: any) { toast.error(saveErrorMessage(e)); } finally { setBusy(false); }
  };



  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Manual capture (optional) */}
      <section className="space-y-3 border-b pb-6">
          <h3 className="font-semibold flex items-center gap-2"><Camera className="w-4 h-4" />ลงทะเบียนใบหน้านักเรียน</h3>

          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <Select value={grade} onValueChange={setGrade} disabled={busy}>
              <SelectTrigger aria-label="ระดับชั้น"><SelectValue placeholder="ทุกระดับชั้น" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                {grades.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input aria-label="ค้นหานักเรียน" disabled={busy} placeholder="ค้นหาชื่อ/รหัสนักเรียน" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={studentId} onValueChange={(id)=>{setStudentId(id);setShots([]);setLastQuality(null);setUploadFailures([]);setReason("");}}>
            <SelectTrigger aria-label="เลือกนักเรียน" disabled={busy}><SelectValue placeholder={`เลือกนักเรียน (${filtered.length} คน)`} /></SelectTrigger>
            <SelectContent>
              {filtered.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.prefix}{s.first_name} {s.last_name} ({s.student_code})
                  <span className="ml-2 text-muted-foreground">{s.classrooms?.grade_level}</span>
                  {registeredIds.has(s.id) && <Badge variant="secondary" className="ml-2 text-xs">มีแล้ว</Badge>}
                </SelectItem>
              ))}
              {filtered.length === 0 && <div className="p-3 text-sm text-muted-foreground">ไม่พบนักเรียน</div>}
            </SelectContent>
          </Select>

          {studentId && registeredIds.has(studentId) && (
            <div className="space-y-1">
              <label className="text-xs font-medium">เหตุผลการลงทะเบียนใหม่ (ถ้ามี)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น ตัดผมสั้น / ใส่แว่นใหม่ / รูปเดิมไม่ชัด / โตขึ้นมาก..."
                rows={2}
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-center">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <Button onClick={() => fileRef.current?.click()} disabled={!modelReady || busy || !studentId || shots.length >= MAX_ENROLLMENT_PHOTOS}>
              <Upload className="w-4 h-4 mr-2" />อัปโหลดรูปนักเรียน (หลายรูป)
            </Button>
            {!streaming && <Button onClick={() => startCamera()} disabled={!modelReady || busy || !studentId} variant="outline"><Camera className="w-4 h-4 mr-2" />เปิดกล้อง</Button>}
            {canSaveDirectly && <Button onClick={saveDirectly} disabled={busy || shots.length === 0 || !studentId} variant="outline"><ShieldCheck className="w-4 h-4 mr-2" />{busy ? "กำลังบันทึก..." : `บันทึกทันที (${shots.length})`}</Button>}
            {!modelReady && <span role="status" className="text-xs text-muted-foreground">กำลังเตรียมตรวจใบหน้า...</span>}
          </div>

          <div className={`relative bg-muted rounded-lg overflow-hidden aspect-video max-w-xl ${streaming ? '' : 'hidden'}`}>
            <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
            <FaceGuideOverlay videoRef={videoRef} active={streaming && modelReady} showLandmarks topLabel="วางใบหน้าให้อยู่ในวงรี" />
            {!streaming && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Camera className="w-12 h-12" /></div>}
          </div>

          <div className={`items-center gap-2 flex-wrap ${streaming ? 'flex' : 'hidden'}`}>
            <CameraSourcePicker value={camDeviceId} onChange={pickCamera} refreshKey={camTick} className="flex-1 min-w-[10rem]" />
            <CameraFocusLockToggle getStream={() => videoRef.current?.srcObject as MediaStream | null} active={streaming} />
          </div>

          <div className="flex gap-2 flex-wrap">
            {streaming && (
              <>
                <Button onClick={captureShot} disabled={busy || !studentId || shots.length >= MAX_ENROLLMENT_PHOTOS} size="sm">
                  <Camera className="w-4 h-4 mr-2" />ถ่าย
                </Button>
                <Button onClick={stopCamera} variant="outline" size="sm">ปิดกล้อง</Button>
              </>
            )}
            {shots.length > 0 && (
              <Button disabled={busy} onClick={() => setShots([])} variant="ghost" size="sm"><RefreshCw className="w-4 h-4 mr-2" />ล้าง ({shots.length})</Button>
            )}
          </div>

          {uploadFailures.length > 0 && <div role="status" className="border border-destructive rounded-lg p-3 text-sm space-y-2">
            <p className="font-medium">รูปที่ยังใช้ลงทะเบียนไม่ได้ ({uploadFailures.length})</p>
            <ul className="space-y-2 text-muted-foreground break-words">{uploadFailures.map((failure,index)=><li key={index}>{failure}</li>)}</ul>
          </div>}

          {lastQuality && (
            <div className={`rounded-lg border p-3 text-xs ${lastQuality.ok ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`}>
              <div className="flex items-center justify-between font-semibold">
                <span>คุณภาพภาพล่าสุด</span>
                <span>{lastQuality.score}/100 {lastQuality.ok ? "✓ ผ่าน" : "⚠ ต้องแก้"}</span>
              </div>
              {lastQuality.reasons.length > 0 && (
                <ul className="mt-1 list-disc pl-4 space-y-0.5 text-muted-foreground">
                  {lastQuality.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
              <div className="mt-1 text-[10px] text-muted-foreground">
                ชัด {Math.round(lastQuality.metrics.sharpness)} • แสง {Math.round(lastQuality.metrics.brightness)} • หน้า {Math.round(lastQuality.metrics.faceSize)}px • yaw {lastQuality.metrics.yaw.toFixed(2)} • pitch {lastQuality.metrics.pitch.toFixed(2)}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm"><span className="font-medium">รูปใบหน้า {shots.length}/5</span><Badge variant="outline">ArcFace · 512 มิติ</Badge></div>
          {shots.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {shots.map((s,i)=><FaceSamplePreview key={i} image={s.canvas.toDataURL('image/jpeg',.85)} width={s.canvas.width} height={s.canvas.height} points={s.points} score={s.quality.score} index={i} onRemove={()=>{if(!busy)setShots(current=>current.filter((_,j)=>j!==i));}}/>) }
          </div>}

      </section>

      {/* Auto-sync hero card */}
      <Card className="gradient-primary text-primary-foreground border-0">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">ซิงค์ใบหน้าอัตโนมัติจากรูปโปรไฟล์ผู้ใช้</h3>
              <p className="text-sm opacity-90">ระบบดึงรูปโปรไฟล์นักเรียนจากฐานข้อมูลผู้ใช้มาประมวลผลใบหน้าให้อัตโนมัติ ไม่ต้องลงทะเบียนใหม่</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{students.length}</p>
              <p className="text-xs opacity-90">นักเรียนทั้งหมด</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{withAvatar.length}</p>
              <p className="text-xs opacity-90">มีรูปโปรไฟล์</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{registeredIds.size}</p>
              <p className="text-xs opacity-90">พร้อมสแกน</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">
                {students.length ? Math.round((registeredIds.size / students.length) * 100) : 0}%
              </p>
              <p className="text-xs opacity-90">ความพร้อมระบบ</p>
            </div>
          </div>
          {students.length > 0 && students.length - withAvatar.length > 0 && (
            <p className="text-xs opacity-90">
              ℹ️ มีนักเรียน {students.length - withAvatar.length} คน ที่ยังไม่มีรูปโปรไฟล์ — ต้องอัปโหลดรูปก่อนถึงจะซิงค์ได้
            </p>
          )}

          {syncing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>กำลังประมวลผล... {progress.done}/{progress.total}</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} className="bg-white/20" />
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />สำเร็จ {progress.ok}</span>
                <span className="flex items-center gap-1"><XCircle className="w-3 h-3" />ล้มเหลว {progress.fail}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => runAutoSync(false)} disabled={syncing || !modelReady} variant="secondary">
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "กำลังซิงค์..." : pending.length > 0 ? `ซิงค์ ${pending.length} คนใหม่` : "ซิงค์ครบแล้ว"}
            </Button>
            <Button onClick={() => runAutoSync(true)} disabled={syncing || !modelReady} variant="outline" className="bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20">
              <Sparkles className="w-4 h-4 mr-2" />ซิงค์ใหม่ทั้งหมด
            </Button>
          </div>

          {!modelReady && <p className="text-xs opacity-80">⏳ กำลังโหลด AI Model...</p>}
          {lastSyncedAt && <p className="text-xs opacity-80">ซิงค์ล่าสุด: {new Date(lastSyncedAt).toLocaleString("th-TH")}</p>}
        </CardContent>
      </Card>

      {/* Failed list — diagnose why sync ไม่สำเร็จ */}
      {failedList.length > 0 && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 space-y-2">
            <h4 className="font-semibold flex items-center gap-2 text-destructive">
              <XCircle className="w-4 h-4" />ซิงค์ไม่สำเร็จ ({failedList.length})
            </h4>
            <p className="text-xs text-muted-foreground">
              สาเหตุที่พบบ่อย: รูปโปรไฟล์เบลอ/มืดเกินไป, ใบหน้าเล็กเกินไป, มุมเอียงมาก, มีหลายคนในรูป, หรือเป็นรูปการ์ตูน/โลโก้ — แนะนำให้อัปโหลดรูปหน้าตรงชัดๆ ใหม่ แล้วกดซิงค์อีกครั้ง หรือลงทะเบียนใบหน้าด้วยกล้องในแท็บนี้
            </p>
            <div className="max-h-64 overflow-y-auto divide-y rounded-lg border">
              {failedList.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3 p-2 text-sm">
                  <span className="font-medium truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground text-right flex-1">{f.reason}</span>
                  {canSaveDirectly && <Button size="icon" variant="ghost" title={`ลบรูปที่ซิงค์ไม่สำเร็จของ ${f.name}`} aria-label={`ลบรูปที่ซิงค์ไม่สำเร็จของ ${f.name}`} disabled={syncing || !!removing} onClick={() => removePortrait(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending list preview */}
      {pending.length > 0 && !syncing && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2"><ImageIcon className="w-4 h-4" />รอซิงค์ ({pending.length})</h4>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {pending.map((s: any) => (
                <div key={s.id} className="flex-shrink-0 w-20 text-center">
                  <div className="w-20 h-20 overflow-hidden rounded-lg border"><IdCardPhoto url={s.photo_url} name={s.first_name} /></div>
                  <p className="text-xs mt-1 truncate">{s.first_name}</p>
                  {canSaveDirectly && <Button variant="ghost" size="icon" className="h-7 w-7" title={`ลบรูปที่รอซิงค์ของ ${s.first_name}`} aria-label={`ลบรูปที่รอซิงค์ของ ${s.first_name}`} disabled={!!removing} onClick={() => removePortrait(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students without avatar warning */}
      {withoutAvatar.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold mb-1">⚠️ มีนักเรียน {withoutAvatar.length} คนยังไม่มีรูปโปรไฟล์</p>
            <p className="text-muted-foreground text-xs">โปรดอัปโหลดรูปในเมนู "ข้อมูลนักเรียน" หรือใช้กล้องถ่ายเพิ่มในส่วนลงทะเบียนด้านบน</p>
            <ul aria-label="รายชื่อนักเรียนที่ยังไม่มีรูปโปรไฟล์" className="mt-3 max-h-72 overflow-y-auto divide-y divide-border">
              {withoutAvatar.map(s => (
                <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <span className="min-w-0 break-words font-medium">{s.prefix || ''}{s.first_name} {s.last_name}</span>
                  <span className="text-xs text-muted-foreground">รหัส {s.student_code || 'ไม่ระบุ'} · {s.classrooms?.name || s.classrooms?.grade_level || 'ยังไม่จัดห้องเรียน'}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}


    </div>
  );
};

export default FaceRegisterTab;
