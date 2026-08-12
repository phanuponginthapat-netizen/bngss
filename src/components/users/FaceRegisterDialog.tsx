import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, RefreshCw, Save, ScanFace, CheckCircle2, Image as ImageIcon, Trash2, UserSquare2, ShieldCheck, SwitchCamera, Upload, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadFaceModels, getDescriptorFromImage, loadImageFromUrl, applyCameraAutoTune } from "@/lib/faceApi";
import LivenessFaceRegisterDialog from "./LivenessFaceRegisterDialog";
import { swal } from "@/lib/swal";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { openCamera, stopStream } from "@/lib/cameraStream";
import CameraSourcePicker from "@/components/mobile/CameraSourcePicker";
import CameraFocusLockToggle from "@/components/mobile/CameraFocusLockToggle";



interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentCode: string;
  displayName: string;
}

const FaceRegisterDialog = ({ open, onOpenChange, studentCode, displayName }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [existingSamples, setExistingSamples] = useState<Array<{ id: string; sample_index: number; source: string | null; created_at: string }>>([]);
  const [modelReady, setModelReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [shots, setShots] = useState<Array<{ canvas: HTMLCanvasElement; desc: Float32Array }>>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [livenessOpen, setLivenessOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [camDeviceId, setCamDeviceId] = useState<string | undefined>(undefined);
  const [camTick, setCamTick] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Array<{
    id: string; name: string; preview: string; desc: Float32Array | null;
    status: "processing" | "ok" | "no-face" | "error"; error?: string;
  }>>([]);
  const [uploadBusy, setUploadBusy] = useState(false);


  useEffect(() => { loadFaceModels().then(() => setModelReady(true)); }, []);

  const refreshSamples = async (sid: string) => {
    const { data } = await supabase
      .from("student_face_descriptors")
      .select("id, sample_index, source, created_at")
      .eq("student_id", sid)
      .order("sample_index", { ascending: true });
    setExistingSamples(data || []);
    setExistingCount(data?.length || 0);
  };

  useEffect(() => {
    if (!open) return;
    setShots([]);
    (async () => {
      const { data: s } = await supabase
        .from("students")
        .select("id, photo_url")
        .eq("student_code", studentCode)
        .maybeSingle();
      if (!s) { toast.error("ไม่พบนักเรียนที่ตรงกับรหัส"); return; }
      setStudentId(s.id);
      setPhotoUrl(s.photo_url || null);
      await refreshSamples(s.id);
    })();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentCode]);

  const startCamera = async (mode: "user" | "environment" = facingMode, deviceId?: string) => {
    try {
      const res = await openCamera({ facing: mode, deviceId: deviceId ?? camDeviceId, width: 1280, height: 720 });
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, res.stream);
        setStreaming(true);
        setCamDeviceId(res.deviceId);
        setCamTick((t) => t + 1);
        try { applyCameraAutoTune(res.stream); } catch { /* ไม่รองรับ constraint เพิ่มเติม */ }
      } else {
        stopStream(res.stream);
      }
    } catch (e: any) { toast.error(e?.message || "เปิดกล้องไม่สำเร็จ"); }
  };

  const stopCamera = () => {
    stopStream(videoRef.current?.srcObject as MediaStream | null, videoRef.current);
    setStreaming(false);
  };

  const switchCamera = async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    stopCamera();
    setTimeout(() => startCamera(next, undefined), 150);
  };

  const pickCamera = (deviceId: string) => {
    setCamDeviceId(deviceId);
    stopCamera();
    setTimeout(() => startCamera(facingMode, deviceId), 150);
  };


  const captureShot = async () => {
    if (!videoRef.current || !modelReady) return;
    setBusy(true);
    try {
      const desc = await getDescriptorFromImage(videoRef.current);
      if (!desc) { toast.error("ไม่พบใบหน้า ลองอีกครั้ง"); return; }
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      setShots((s) => [...s, { canvas, desc }]);
    } finally { setBusy(false); }
  };

  const syncFromPhoto = async () => {
    if (!studentId || !photoUrl) return;
    setSyncing(true);
    try {
      const img = await loadImageFromUrl(photoUrl);
      const desc = await getDescriptorFromImage(img);
      if (!desc) { toast.error("ไม่พบใบหน้าในรูปโปรไฟล์"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("student_face_descriptors")
        .delete().eq("student_id", studentId).eq("source", "profile_avatar");
      const { error } = await supabase.from("student_face_descriptors").insert({
        student_id: studentId, sample_index: 0,
        descriptor: Array.from(desc), captured_by: user?.id, source: "profile_avatar",
      });
      if (error) throw error;
      toast.success("ซิงค์ใบหน้าจากรูปโปรไฟล์สำเร็จ");
      await refreshSamples(studentId);
    } catch (e: any) { toast.error(e.message); } finally { setSyncing(false); }
  };

  const saveAll = async () => {
    if (!studentId || shots.length === 0) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ex } = await supabase.from("student_face_descriptors")
        .select("sample_index").eq("student_id", studentId).order("sample_index", { ascending: false }).limit(1);
      let nextIdx = ex && ex[0] ? ex[0].sample_index + 1 : 0;
      const rows = shots.map((s) => ({
        student_id: studentId, sample_index: nextIdx++,
        descriptor: Array.from(s.desc), captured_by: user?.id, source: "camera",
      }));
      const { error } = await supabase.from("student_face_descriptors").insert(rows);
      if (error) throw error;
      toast.success(`บันทึก ${shots.length} ภาพสำเร็จ`);
      setShots([]);
      await refreshSamples(studentId);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const clearAllDescriptors = async () => {
    if (!studentId) return;
    if (!(await swal.confirm({ title: "ลบข้อมูลใบหน้าทั้งหมดของนักเรียนคนนี้?", danger: true }))) return;
    const { error } = await supabase.from("student_face_descriptors").delete().eq("student_id", studentId);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบเรียบร้อย");
    setExistingSamples([]);
    setExistingCount(0);
  };

  const deleteOneSample = async (id: string) => {
    if (!studentId) return;
    if (!(await swal.confirm({ title: "ลบตัวอย่างใบหน้านี้?", danger: true }))) return;
    const { error } = await supabase.from("student_face_descriptors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบตัวอย่างแล้ว");
    await refreshSamples(studentId);
  };

  const sourceLabel = (s: string | null) => {
    if (s === "profile_avatar") return "รูปโปรไฟล์";
    if (s === "camera") return "กล้อง";
    if (s === "upload") return "อัปโหลด";
    if (s === "liveness_wizard") return "ไกด์ Liveness";
    return s || "อื่นๆ";
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !modelReady) return;
    setUploadBusy(true);
    try {
      const arr = Array.from(files).slice(0, 20);
      const initial = arr.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        preview: URL.createObjectURL(f),
        desc: null as Float32Array | null,
        status: "processing" as const,
      }));
      setUploads((u) => [...u, ...initial]);

      for (let i = 0; i < arr.length; i++) {
        const item = initial[i];
        try {
          const img = await loadImageFromUrl(item.preview);
          const desc = await getDescriptorFromImage(img);
          setUploads((u) =>
            u.map((x) =>
              x.id === item.id
                ? desc
                  ? { ...x, desc, status: "ok" as const }
                  : { ...x, status: "no-face" as const, error: "ไม่พบใบหน้าในภาพ" }
                : x,
            ),
          );
        } catch (e: any) {
          setUploads((u) =>
            u.map((x) =>
              x.id === item.id ? { ...x, status: "error" as const, error: e.message } : x,
            ),
          );
        }
      }
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeUpload = (id: string) => {
    setUploads((u) => {
      const item = u.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return u.filter((x) => x.id !== id);
    });
  };

  const clearUploads = () => {
    uploads.forEach((u) => URL.revokeObjectURL(u.preview));
    setUploads([]);
  };

  const saveUploads = async () => {
    if (!studentId) return;
    const ready = uploads.filter((u) => u.status === "ok" && u.desc);
    if (ready.length === 0) {
      toast.error("ไม่มีภาพที่วิเคราะห์ใบหน้าสำเร็จ");
      return;
    }
    setUploadBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ex } = await supabase.from("student_face_descriptors")
        .select("sample_index").eq("student_id", studentId)
        .order("sample_index", { ascending: false }).limit(1);
      let nextIdx = ex && ex[0] ? ex[0].sample_index + 1 : 0;
      const rows = ready.map((s) => ({
        student_id: studentId,
        sample_index: nextIdx++,
        descriptor: Array.from(s.desc!),
        captured_by: user?.id,
        source: "upload",
      }));
      const { error } = await supabase.from("student_face_descriptors").insert(rows);
      if (error) throw error;
      toast.success(`บันทึก ${rows.length} ภาพจากไฟล์อัปโหลดสำเร็จ`);
      clearUploads();
      await refreshSamples(studentId);
    } catch (e: any) {
      toast.error("บันทึกล้มเหลว: " + e.message);
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) stopCamera(); }}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-primary" />
            ลงทะเบียนใบหน้า — {displayName}
          </DialogTitle>
        </DialogHeader>

        {!studentId ? (
          <p className="text-sm text-muted-foreground py-4">กำลังโหลดข้อมูลนักเรียน...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-14 h-14 rounded-lg object-cover border" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 text-sm">
                <p className="font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">รหัส: {studentCode}</p>
              </div>
              <Badge variant={existingCount > 0 ? "default" : "secondary"} className="gap-1">
                {existingCount > 0 && <CheckCircle2 className="w-3 h-3" />}
                {existingCount} ตัวอย่าง
              </Badge>
            </div>

            {existingSamples.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <UserSquare2 className="w-4 h-4 text-primary" />
                    ตัวอย่างที่บันทึกไว้ ({existingSamples.length})
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y">
                  {existingSamples.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 py-2 text-sm">
                      <Badge variant="outline" className="font-mono text-xs">#{s.sample_index}</Badge>
                      <Badge
                        variant="secondary"
                        className={s.source === "profile_avatar" ? "bg-primary/10 text-primary" : ""}
                      >
                        {sourceLabel(s.source)}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex-1">
                        {new Date(s.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteOneSample(s.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => setLivenessOpen(true)}
              disabled={!modelReady}
              className="w-full gradient-primary text-base h-12"
              size="lg"
            >
              <ShieldCheck className="w-5 h-5 mr-2" />
              ลงทะเบียนแบบไกด์ + Liveness (แนะนำ)
            </Button>

            {photoUrl && (
              <Button onClick={syncFromPhoto} disabled={syncing || !modelReady} variant="outline" className="w-full">
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "กำลังซิงค์..." : "ซิงค์ใบหน้าจากรูปโปรไฟล์"}
              </Button>
            )}

            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Camera className="w-4 h-4" />ถ่ายภาพจากกล้อง (เพิ่มความแม่นยำ)
              </p>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] sm:aspect-[4/5] max-h-[60vh] mx-auto w-full">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                />
                {/* face guide ring */}
                {streaming && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[75%] aspect-[3/4] max-h-[85%] rounded-[50%] border-4 border-white/60" />
                  </div>
                )}
                {/* switch camera */}
                {streaming && (
                  <Button
                    onClick={switchCamera}
                    size="icon"
                    variant="secondary"
                    className="absolute top-3 right-3 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 h-10 w-10"
                    title="สลับกล้องหน้า/หลัง"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </Button>
                )}
                {!streaming && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/60">
                    <Camera className="w-12 h-12" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
            <CameraSourcePicker value={camDeviceId} onChange={pickCamera} refreshKey={camTick} className="flex-1 min-w-[10rem]" />
            <CameraFocusLockToggle getStream={() => videoRef.current?.srcObject as MediaStream | null} active={streaming} />
          </div>
              <div className="flex gap-2 flex-wrap">

                {!streaming ? (
                  <Button onClick={() => startCamera()} disabled={!modelReady} size="sm">
                    <Camera className="w-4 h-4 mr-2" />เปิดกล้อง
                  </Button>
                ) : (
                  <>
                    <Button onClick={captureShot} disabled={busy} size="sm" className="gradient-primary">
                      <Camera className="w-4 h-4 mr-2" />ถ่าย ({shots.length})
                    </Button>
                    <Button onClick={switchCamera} variant="outline" size="sm">
                      <SwitchCamera className="w-4 h-4 mr-2" />สลับกล้อง
                    </Button>
                    <Button onClick={stopCamera} variant="outline" size="sm">ปิดกล้อง</Button>
                  </>
                )}
                {shots.length > 0 && (
                  <Button onClick={() => setShots([])} variant="ghost" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />ล้าง
                  </Button>
                )}
              </div>
              {shots.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {shots.map((s, i) => (
                    <img key={i} src={s.canvas.toDataURL()} alt={`ภาพถ่ายลงทะเบียนใบหน้า ${i + 1}`} className="rounded border w-full aspect-square object-cover" />
                  ))}
                </div>
              )}
              <Button onClick={saveAll} disabled={busy || shots.length === 0} className="w-full">
                <Save className="w-4 h-4 mr-2" />บันทึก ({shots.length} ภาพ)
              </Button>
            </div>

            {/* Upload from device */}
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  อัปโหลดรูปภาพเพิ่มเติม (เพิ่มความแม่นยำ)
                </p>
                <Badge variant="outline" className="text-xs">
                  สูงสุด 20 ไฟล์ / ครั้ง
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                เลือกรูปใบหน้าของนักเรียนหลายๆ มุม (หน้าตรง, ซ้าย, ขวา, มีแสงต่างกัน) เพื่อให้ระบบจดจำได้แม่นยำขึ้น
                ไฟล์ที่รองรับ: JPG, PNG, WebP
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!modelReady || uploadBusy}
                  size="sm"
                  variant="outline"
                >
                  {uploadBusy ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  เลือกรูปจากเครื่อง
                </Button>
                {uploads.length > 0 && (
                  <Button onClick={clearUploads} variant="ghost" size="sm" disabled={uploadBusy}>
                    <RefreshCw className="w-4 h-4 mr-2" />ล้างทั้งหมด
                  </Button>
                )}
              </div>
              {uploads.length > 0 && (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {uploads.map((u) => (
                      <div key={u.id} className="relative group">
                        <img
                          src={u.preview}
                          alt={u.name}
                          className={`rounded border w-full aspect-square object-cover ${
                            u.status === "ok"
                              ? "border-emerald-500 ring-2 ring-emerald-500/40"
                              : u.status === "no-face" || u.status === "error"
                              ? "border-destructive ring-2 ring-destructive/40"
                              : "border-muted-foreground/40"
                          }`}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 flex items-center justify-center gap-1">
                          {u.status === "processing" && (
                            <><Loader2 className="w-3 h-3 animate-spin" />วิเคราะห์...</>
                          )}
                          {u.status === "ok" && (
                            <><CheckCircle2 className="w-3 h-3 text-emerald-400" />เจอใบหน้า</>
                          )}
                          {u.status === "no-face" && (
                            <><XCircle className="w-3 h-3 text-destructive" />ไม่พบใบหน้า</>
                          )}
                          {u.status === "error" && (
                            <><XCircle className="w-3 h-3 text-destructive" />ผิดพลาด</>
                          )}
                        </div>
                        <Button
                          onClick={() => removeUpload(u.id)}
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    เจอใบหน้า: {uploads.filter((u) => u.status === "ok").length} / {uploads.length} ภาพ
                  </div>
                  <Button
                    onClick={saveUploads}
                    disabled={
                      uploadBusy ||
                      uploads.filter((u) => u.status === "ok").length === 0
                    }
                    className="w-full gradient-primary"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    บันทึก {uploads.filter((u) => u.status === "ok").length} ภาพที่เจอใบหน้า
                  </Button>
                </>
              )}
            </div>



            {existingCount > 0 && (
              <Button onClick={clearAllDescriptors} variant="ghost" size="sm" className="text-destructive w-full">
                ลบข้อมูลใบหน้าทั้งหมด
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
        </DialogFooter>
      </DialogContent>

      <LivenessFaceRegisterDialog
        open={livenessOpen}
        onOpenChange={setLivenessOpen}
        studentCode={studentCode}
        displayName={displayName}
        onComplete={() => { if (studentId) refreshSamples(studentId); setLivenessOpen(false); }}
      />
    </Dialog>
  );
};

export default FaceRegisterDialog;
