import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, ScanLine, User, CheckCircle2 } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { loadFaceModels, detectFaceWithLandmarks, assessFaceQuality } from "@/lib/faceApi";
import { canvasToFaceThumb } from "@/lib/faceThumb";
import FaceGuideOverlay from "@/components/facescan/FaceGuideOverlay";
import { openCamera, stopStream, attachStreamToVideo } from "@/lib/cameraStream";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRegistered?: () => void;
}

export default function KioskFaceRegisterDialog({ open, onOpenChange, onRegistered }: Props) {
  const [step, setStep] = useState<"lookup" | "capture">("lookup");
  const [code, setCode] = useState("");
  const [student, setStudent] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);

  useEffect(() => { loadFaceModels().then(() => setModelReady(true)).catch(() => {}); }, []);

  useEffect(() => {
    if (!open) {
      setStep("lookup");
      setCode("");
      setStudent(null);
      setCaptureCount(0);
      stopCamera();
    }
  }, [open]);

  const stopCamera = () => {
    stopStream(videoRef.current?.srcObject as MediaStream | null, videoRef.current);
    setStreaming(false);
  };

  const startCamera = async () => {
    try {
      const res = await openCamera({ facing: "user", width: 640, height: 480 });
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, res.stream);
        setStreaming(true);
      } else stopStream(res.stream);
    } catch (e: any) { toast.error(e?.message || "เปิดกล้องไม่สำเร็จ"); }
  };

  useEffect(() => {
    if (step === "capture" && open && modelReady) startCamera();
    else if (step !== "capture") stopCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open, modelReady]);

  const lookup = async (rawCode: string) => {
    const c = rawCode.trim();
    if (!c) { toast.error("กรุณากรอกรหัส"); return; }
    setLoading(true);
    try {
      // รองรับ QR แบบ /p/<code> ด้วย
      const token = c.includes("/p/") ? decodeURIComponent(c.split("/p/").pop()!.split(/[?#]/)[0]) : c;
      // ลองหาแบบตรงๆ ก่อน (anon อาจอ่านได้)
      let { data: s } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name,grade_level)").eq("student_code", token).maybeSingle();
      // ถ้าไม่เจอ ลองหาแบบ case-insensitive หรือจาก qr-login logic (uuid)
      if (!s && token.length >= 8) {
        const { data: s2 } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name,grade_level)").ilike("student_code", token).maybeSingle();
        s = s2 as any;
      }
      if (!s) { toast.error("ไม่พบรหัสนักเรียนนี้"); return; }
      setStudent(s);
      setStep("capture");
      toast.success(`พบ ${s.prefix || ""}${s.first_name} ${s.last_name}`);
    } catch (e: any) { toast.error(e?.message || "ค้นหาไม่สำเร็จ"); }
    finally { setLoading(false); }
  };

  const handleScan = (qr: string) => {
    setScanOpen(false);
    const token = qr.includes("/p/") ? decodeURIComponent(qr.split("/p/").pop()!.split(/[?#]/)[0]) : qr;
    setCode(token);
    lookup(token);
  };

  const handleCaptureAndSave = async () => {
    if (!videoRef.current || !student) return;
    if (!modelReady) { toast.error("AI ยังไม่พร้อม"); return; }
    setSaving(true);
    try {
      const det = await detectFaceWithLandmarks(videoRef.current);
      if (!det) { toast.error("ไม่พบใบหน้าในกรอบ กรุณายืนกลางวงรี"); return; }
      const q = assessFaceQuality(videoRef.current, det, "register");
      if (!q.ok) { toast.error(q.reasons[0] || "คุณภาพภาพไม่ผ่าน"); return; }
      // สร้าง descriptor
      const desc = (det as any).descriptor || (await import("@/lib/faceApi").then(m => m.getDescriptorFromImage(videoRef.current!)));
      if (!desc) { toast.error("ประมวลผลใบหน้าไม่สำเร็จ"); return; }

      // ทำ thumb
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      const thumb = canvasToFaceThumb(canvas);

      // ส่งไป edge function kiosk-face-register (bypass RLS)
      const payload: any = {
        student_id: student.id,
        descriptors: [Array.from(desc as Float32Array)],
        face_image: thumb,
      };
      const { data, error } = await supabase.functions.invoke("kiosk-face-register", { body: payload });
      if (error) throw new Error(error.message || "kiosk-face-register failed");
      if ((data as any)?.error) {
        const err = (data as any).error;
        if (err === "duplicate") throw new Error(`ใบหน้าซ้ำกับ ${(data as any).match_name || ""} ${(data as any).match_code || ""}`);
        throw new Error(err);
      }
      toast.success("ลงทะเบียนใบหน้าสำเร็จ ✓ สแกนประตูได้ทันที");
      setCaptureCount(c => c + 1);
      // ล้าง cache ให้ kiosk จับได้ทันที
      try { const { clearRegisteredFaceCache } = await import("@/lib/registeredFace"); clearRegisteredFaceCache(student.id); } catch {}
      // ปิด dialog หลัง 1 วิ
      setTimeout(() => { onOpenChange(false); onRegistered?.(); }, 1000);
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally { setSaving(false); }
  };

  const fullName = student ? `${student.prefix || ""}${student.first_name || ""} ${student.last_name || ""}`.trim() : "";
  const classroom = student?.classrooms ? `${student.classrooms.grade_level || ""}/${student.classrooms.name || ""}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5" /> ลงทะเบียนใบหน้า (ตู้ประตู)</DialogTitle>
          <DialogDescription>สแกนบัตรหรือกรอกรหัสนักเรียน ไม่ต้องล็อกอิน — ลงเสร็จสแกนประตูได้ทันที</DialogDescription>
        </DialogHeader>

        {step === "lookup" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>รหัสนักเรียน</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น 12345" className="pl-10" onKeyDown={e => e.key === "Enter" && lookup(code)} />
                </div>
              </div>
              <Button variant="outline" size="icon" className="mt-6" onClick={() => setScanOpen(true)} title="สแกน QR บัตร"><ScanLine className="w-4 h-4" /></Button>
            </div>
            <Button onClick={() => lookup(code)} disabled={loading} className="w-full">{loading ? "..." : "ค้นหา"}</Button>
            <p className="text-xs text-muted-foreground text-center">แตะไอคอนสแกนเพื่ออ่าน QR จากบัตรนักเรียน</p>
            <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} title="สแกน QR บัตรนักเรียน" />
          </div>
        )}

        {step === "capture" && student && (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-semibold">{fullName}</p>
                <p className="text-xs text-muted-foreground">{student.student_code} • ชั้น {classroom || "-"}</p>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setStep("lookup"); setStudent(null); stopCamera(); }}>เปลี่ยนคน</Button>
            </div>

            <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <FaceGuideOverlay videoRef={videoRef} active={streaming && modelReady} topLabel="วางใบหน้าในวงรี" fit="cover" mirror />
              {!streaming && <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">กำลังเปิดกล้อง...</div>}
            </div>
            <p className="text-xs text-muted-foreground text-center">ยืนห่าง 70–120 ซม. ให้หน้าอยู่กลางวงรีแล้วกดถ่าย</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("lookup"); setStudent(null); }}>ย้อนกลับ</Button>
              <Button className="flex-1" onClick={handleCaptureAndSave} disabled={saving || !streaming || !modelReady}>
                {saving ? "กำลังบันทึก..." : captureCount > 0 ? `บันทึกแล้ว ${captureCount} ครั้ง` : "ถ่ายและบันทึก"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
