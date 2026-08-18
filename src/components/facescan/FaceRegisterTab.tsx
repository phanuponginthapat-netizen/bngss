import { useEffect, useRef, useState } from "react";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { openCamera, stopStream } from "@/lib/cameraStream";
import CameraSourcePicker from "@/components/mobile/CameraSourcePicker";
import CameraFocusLockToggle from "@/components/mobile/CameraFocusLockToggle";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Sparkles, CheckCircle2, XCircle, Image as ImageIcon, Camera, Save, Upload, ShieldCheck, History, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadFaceModels, getDescriptorFromImage, loadImageFromUrl, detectorOptionsHQ, detectFaceWithLandmarks, assessFaceQuality, BANK_GRADE, type QualityReport } from "@/lib/faceApi";
import * as faceapi from "@vladmandic/face-api";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";
import { canvasToFaceThumb } from "@/lib/faceThumb";
import { computeFaceTexture } from "@/lib/faceTexture";
import { clearRegisteredFaceCache } from "@/lib/registeredFace";
import { saveErrorMessage } from "@/lib/saveError";
import FaceGuideOverlay from "@/components/facescan/FaceGuideOverlay";


const FaceRegisterTab = () => {
  const qc = useQueryClient();
  const { isAdmin, isDirector } = useUserRole();
  const canApproveDirectly = isAdmin || isDirector;
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
  const [reason, setReason] = useState("");
  const [shots, setShots] = useState<Array<{ canvas: HTMLCanvasElement; desc: Float32Array; texture?: number[] | null; source: "camera" | "upload"; quality: QualityReport }>>([]);
  const [lastQuality, setLastQuality] = useState<QualityReport | null>(null);
  const [busy, setBusy] = useState(false);

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
  const pending = withAvatar.filter((s: any) => !registeredIds.has(s.id));

  const detectRobust = async (img: HTMLImageElement): Promise<Float32Array | null> => {
    // 1) Standard
    let desc = await getDescriptorFromImage(img);
    if (desc) return desc;
    // 2) HQ: larger input + lower threshold
    for (const size of [512, 608] as const) {
      for (const thr of [0.35, 0.25, 0.15]) {
        const res = await faceapi
          .detectSingleFace(img as any, detectorOptionsHQ(size, thr))
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (res?.descriptor) return res.descriptor;
      }
    }
    return null;
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
    for (const s of targets as any[]) {
      const fullName = `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim();
      try {
        const img = await loadImageFromUrl(s.photo_url).catch((e) => {
          throw new Error("โหลดรูปไม่ได้ (CORS/404)");
        });
        const desc = await detectRobust(img);
        if (!desc) {
          fail++;
          fails.push({ id: s.id, name: fullName, reason: "ตรวจไม่พบใบหน้าในรูป (เบลอ/มุมเอียง/หลายคน)" });
        } else {
          if (force) {
            await supabase.from("student_face_descriptors").delete().eq("student_id", s.id).eq("source", "profile_avatar");
          }
          const { error } = await supabase.from("student_face_descriptors").insert({
            student_id: s.id, sample_index: 0,
            descriptor: Array.from(desc), captured_by: user?.id, source: "profile_avatar",
          });
          if (error) { fail++; fails.push({ id: s.id, name: fullName, reason: "DB: " + error.message }); }
          else ok++;
        }
      } catch (e: any) {
        fail++;
        fails.push({ id: s.id, name: fullName, reason: e?.message || "unknown error" });
      }
      done++;
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
  const filtered = students.filter((s: any) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [s.first_name, s.last_name, s.student_code].some((v) => String(v || "").toLowerCase().includes(q));
  }).slice(0, 100);

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
    if (!videoRef.current || !modelReady) return;
    setBusy(true);
    try {
      const det = await detectFaceWithLandmarks(videoRef.current);
      if (!det) { setLastQuality(null); toast.error("ไม่พบใบหน้าในภาพ"); return; }
      const q = assessFaceQuality(videoRef.current, det, "register");
      setLastQuality(q);
      if (!q.ok && !canApproveDirectly) {
        toast.error("คุณภาพภาพไม่ผ่านมาตรฐาน", { description: q.reasons[0] });
        return;
      }
      if (!q.ok) {
        toast.warning(`คุณภาพ ${q.score}/100 (บันทึกได้แต่แนะนำให้ถ่ายใหม่)`, { description: q.reasons[0] });
      }
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      setShots((s) => [...s, { canvas, desc: det.descriptor, texture: computeFaceTexture(videoRef.current!, det.landmarks), source: "camera", quality: q }]);
    } finally { setBusy(false); }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !modelReady) return;
    setBusy(true);
    let ok = 0, fail = 0, lowQ = 0;
    const lowQReasons: string[] = [];
    try {
      for (const file of Array.from(files)) {
        try {
          const url = URL.createObjectURL(file);
          const img = await loadImageFromUrl(url);
          const det = await detectFaceWithLandmarks(img);
          URL.revokeObjectURL(url);
          if (!det) { fail++; continue; }
          const q = assessFaceQuality(img, det, "register");
          if (!q.ok && !canApproveDirectly) {
            lowQ++;
            if (lowQReasons.length < 2) lowQReasons.push(`${file.name}: ${q.reasons[0]}`);
            continue;
          }
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")?.drawImage(img, 0, 0);
          setShots((s) => [...s, { canvas, desc: det.descriptor, texture: computeFaceTexture(img, det.landmarks), source: "upload", quality: q }]);
          ok++;
        } catch { fail++; }
      }
      const parts = [];
      if (ok) parts.push(`เพิ่ม ${ok} รูป`);
      if (fail) parts.push(`ไม่พบใบหน้า ${fail} รูป`);
      if (lowQ) parts.push(`คุณภาพต่ำ ${lowQ} รูป`);
      if (ok > 0) toast.success(parts.join(" • "), lowQ ? { description: lowQReasons.join("\n") } : undefined);
      else if (lowQ > 0) toast.error("รูปคุณภาพไม่ผ่าน", { description: lowQReasons.join("\n") });
      else if (fail > 0) toast.error(`ไม่พบใบหน้าในไฟล์ที่อัปโหลด (${fail} รูป)`);
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
      throw new Error(
        `ใบหน้าซ้ำกับ ${hit.match_name ?? ""} (${hit.match_code ?? "-"}) ระยะห่าง ${Number(hit.min_distance).toFixed(3)} — ไม่อนุญาตให้ลงทะเบียนซ้ำ`,
      );
    }
  };

  const submitRequest = async () => {
    if (!studentId || shots.length === 0) { toast.error("เลือกนักเรียนและเพิ่มอย่างน้อย 1 ภาพ"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
      const isRereg = registeredIds.has(studentId);
      if (isRereg && !reason.trim()) {
        toast.error("กรุณาระบุเหตุผลการลงทะเบียนใหม่ (เช่น ตัดผม / ใส่แว่น / โตขึ้น)");
        setBusy(false);
        return;
      }

      await assertNotDuplicate(studentId);

      const photo_urls = await uploadShotsToStorage(studentId);
      const descriptors = shots.map((s) => Array.from(s.desc));

      const { error } = await supabase.from("face_registration_requests").insert({
        student_id: studentId,
        requested_by: user.id,
        request_type: isRereg ? "reregister" : "initial",
        reason: reason.trim() || null,
        photo_urls,
        descriptors,
        status: "pending",
      });
      if (error) throw error;
      toast.success("ส่งคำขออนุมัติให้แอดมินแล้ว");
      setShots([]); setReason("");
      qc.invalidateQueries({ queryKey: ["face-pending-requests"] });
    } catch (e: any) { toast.error(saveErrorMessage(e)); } finally { setBusy(false); }
  };

  const saveDirectly = async () => {
    if (!studentId || shots.length === 0) return;
    if (!canApproveDirectly) { toast.error("เฉพาะแอดมิน/ผู้อำนวยการเท่านั้น"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isRereg = registeredIds.has(studentId);

      await assertNotDuplicate(studentId);

      const { data: prev } = await supabase.from("student_face_descriptors")
        .select("id").eq("student_id", studentId);
      const previous_count = prev?.length ?? 0;

      if (isRereg) {
        await supabase.from("student_face_descriptors").delete().eq("student_id", studentId);
      }
      const startIdx = isRereg ? 0 : previous_count;
      const rows = shots.map((s, i) => ({
        student_id: studentId, sample_index: startIdx + i,
        descriptor: Array.from(s.desc), captured_by: user?.id, source: s.source,
        quality_score: s.quality?.score ?? null,
        metrics: (s.quality as any) ?? null,
        face_image: canvasToFaceThumb(s.canvas) || null,
        texture: s.texture ?? null,
      }));
      const { error } = await supabase.from("student_face_descriptors").insert(rows);
      if (error) throw error;

      const photo_urls = await uploadShotsToStorage(studentId).catch(() => [] as string[]);
      await supabase.from("face_registration_history").insert({
        student_id: studentId,
        action: isRereg ? "direct_replace" : "direct_add",
        previous_count,
        new_count: rows.length + (isRereg ? 0 : previous_count),
        photo_urls,
        reason: reason.trim() || null,
        notes: isRereg ? "บันทึกใหม่ทั้งหมด (แทนที่ของเดิม)" : "เพิ่มภาพใบหน้าตรง",
        performed_by: user?.id,
      });

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
                  <span className="text-xs text-muted-foreground text-right">{f.reason}</span>
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
              {pending.slice(0, 20).map((s: any) => (
                <div key={s.id} className="flex-shrink-0 w-20 text-center">
                  <img src={s.photo_url} alt="" className="w-20 h-20 rounded-lg object-cover border" />
                  <p className="text-xs mt-1 truncate">{s.first_name}</p>
                </div>
              ))}
              {pending.length > 20 && <div className="flex items-center px-3 text-xs text-muted-foreground">+{pending.length - 20}</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students without avatar warning */}
      {students.length - withAvatar.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold mb-1">⚠️ มีนักเรียน {students.length - withAvatar.length} คนยังไม่มีรูปโปรไฟล์</p>
            <p className="text-muted-foreground text-xs">โปรดอัปโหลดรูปในเมนู "ข้อมูลนักเรียน" หรือใช้กล้องถ่ายเพิ่มด้านล่าง</p>
          </CardContent>
        </Card>
      )}

      {/* Manual capture (optional) */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Camera className="w-4 h-4" />ลงทะเบียนใบหน้า (ถ่าย / อัปโหลด)</h3>
          <p className="text-xs text-muted-foreground">
            เพิ่มภาพได้ทั้งจากกล้องและการอัปโหลด — รองรับ JPG/PNG หลายไฟล์พร้อมกัน
            {!canApproveDirectly && " • คำขอจะถูกส่งให้แอดมินอนุมัติก่อนเริ่มใช้งาน"}
          </p>
          <Input placeholder="ค้นหาชื่อ/รหัส..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="-- เลือกนักเรียน --" /></SelectTrigger>
            <SelectContent>
              {filtered.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.prefix}{s.first_name} {s.last_name} ({s.student_code})
                  {registeredIds.has(s.id) && <Badge variant="secondary" className="ml-2 text-xs">มีแล้ว</Badge>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {studentId && registeredIds.has(studentId) && (
            <div className="space-y-1">
              <label className="text-xs font-medium">เหตุผลการลงทะเบียนใหม่ <span className="text-destructive">*</span></label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น ตัดผมสั้น / ใส่แว่นใหม่ / รูปเดิมไม่ชัด / โตขึ้นมาก..."
                rows={2}
              />
            </div>
          )}

          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
            <FaceGuideOverlay videoRef={videoRef} active={streaming && modelReady} topLabel="วางใบหน้าให้อยู่ในวงรี" />
            {!streaming && <div className="absolute inset-0 flex items-center justify-center text-white/60"><Camera className="w-12 h-12" /></div>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <CameraSourcePicker value={camDeviceId} onChange={pickCamera} refreshKey={camTick} className="flex-1 min-w-[10rem]" />
            <CameraFocusLockToggle getStream={() => videoRef.current?.srcObject as MediaStream | null} active={streaming} />
          </div>

          <div className="flex gap-2 flex-wrap">
            {!streaming ? (
              <Button onClick={() => startCamera()} disabled={!modelReady} size="sm" variant="outline"><Camera className="w-4 h-4 mr-2" />เปิดกล้อง</Button>

            ) : (
              <>
                <Button onClick={captureShot} disabled={busy} size="sm" className="gradient-primary">
                  <Camera className="w-4 h-4 mr-2" />ถ่าย
                </Button>
                <Button onClick={stopCamera} variant="outline" size="sm">ปิดกล้อง</Button>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={!modelReady || busy} size="sm" variant="outline">
              <Upload className="w-4 h-4 mr-2" />อัปโหลดรูปภาพ
            </Button>
            {shots.length > 0 && (
              <Button onClick={() => setShots([])} variant="ghost" size="sm"><RefreshCw className="w-4 h-4 mr-2" />ล้าง ({shots.length})</Button>
            )}
          </div>

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

          <p className="text-[11px] text-muted-foreground">
            💡 เพื่อความแม่นยำระดับธนาคาร แนะนำเก็บอย่างน้อย <b>3 มุม</b> (หน้าตรง / เอียงซ้ายเล็กน้อย / เอียงขวาเล็กน้อย) ภายใต้แสงเดียวกับจุดสแกนจริง
          </p>

          {shots.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {shots.map((s, i) => (
                <div key={i} className="relative">
                  <img src={s.canvas.toDataURL()} alt={`ภาพถ่ายลงทะเบียนใบหน้า ${i + 1}`} className="rounded border w-full aspect-square object-cover" />
                  <Badge variant="secondary" className="absolute top-1 right-1 text-[10px] px-1 py-0">
                    {s.source === "camera" ? "📷" : "📁"}
                  </Badge>
                  <Badge variant={s.quality.ok ? "default" : "secondary"} className="absolute bottom-1 left-1 text-[10px] px-1 py-0">
                    {s.quality.score}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={submitRequest}
              disabled={busy || shots.length === 0 || !studentId}
              variant={canApproveDirectly ? "outline" : "default"}
              className={canApproveDirectly ? "" : "flex-1 gradient-primary"}
            >
              <Send className="w-4 h-4 mr-2" />ส่งคำขออนุมัติ ({shots.length})
            </Button>
            {canApproveDirectly && (
              <Button onClick={saveDirectly} disabled={busy || shots.length === 0 || !studentId} className="flex-1 gradient-primary">
                <ShieldCheck className="w-4 h-4 mr-2" />บันทึกทันที (แอดมิน)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default FaceRegisterTab;
