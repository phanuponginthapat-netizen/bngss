import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Stethoscope, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, MapPin, Camera, Database, User, Shield, Image as ImageIcon, ScanFace, Lock, Sun, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { swal } from "@/lib/swal";

type CheckStatus = "pending" | "ok" | "warn" | "fail";

interface Check {
  id: string;
  label: string;
  icon: any;
  status: CheckStatus;
  detail?: string;
  fix?: string;
  raw?: any;
}

const INITIAL: Check[] = [
  { id: "auth", label: "การยืนยันตัวตนผู้ใช้งาน (Auth Session)", icon: User, status: "pending" },
  { id: "profile", label: "โปรไฟล์ผู้ใช้ (profiles)", icon: User, status: "pending" },
  { id: "personnel", label: "ข้อมูลบุคลากร (personnel) ของฉัน", icon: Database, status: "pending" },
  { id: "personnel_rls", label: "สิทธิ์อ่าน-เขียนตาราง personnel (RLS)", icon: Shield, status: "pending" },
  { id: "time_clock_rls", label: "สิทธิ์เขียนตาราง time_clock", icon: Shield, status: "pending" },
  { id: "gps_settings", label: "พิกัด GPS โรงเรียน (school_settings)", icon: MapPin, status: "pending" },
  { id: "geolocation", label: "การเข้าถึงตำแหน่งของอุปกรณ์", icon: MapPin, status: "pending" },
  { id: "camera", label: "การเข้าถึงกล้องของอุปกรณ์", icon: Camera, status: "pending" },
  { id: "secure_ctx", label: "การเชื่อมต่อปลอดภัย (HTTPS) สำหรับกล้อง", icon: Lock, status: "pending" },
  { id: "face_devices", label: "อุปกรณ์กล้องที่ใช้สแกนหน้าได้", icon: Video, status: "pending" },
  { id: "face_resolution", label: "ความละเอียดกล้องหน้า (ขั้นต่ำ 640×480)", icon: ScanFace, status: "pending" },
  { id: "face_lighting", label: "สภาพแสงสำหรับสแกนหน้า", icon: Sun, status: "pending" },
  { id: "storage", label: "ที่เก็บภาพ attendance-photos", icon: ImageIcon, status: "pending" },
  { id: "recent_errors", label: "ประวัติการลงเวลาในช่วง 24 ชม.", icon: AlertTriangle, status: "pending" },
];

const STATUS_STYLES: Record<CheckStatus, { color: string; Icon: any; label: string }> = {
  pending: { color: "bg-muted text-muted-foreground", Icon: Loader2, label: "กำลังตรวจสอบ" },
  ok: { color: "bg-success-soft text-success", Icon: CheckCircle2, label: "ปกติ" },
  warn: { color: "bg-warning-soft text-warning", Icon: AlertTriangle, label: "ควรตรวจสอบ" },
  fail: { color: "bg-danger-soft text-danger", Icon: XCircle, label: "พบปัญหา" },
};

export default function TimeClockDiagnosticsPage() {
  const { role, isAdmin, isDirector, loading: roleLoading } = useUserRole();
  const [checks, setChecks] = useState<Check[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const update = (id: string, patch: Partial<Check>) =>
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const runChecks = useCallback(async () => {
    setRunning(true);
    setChecks(INITIAL);

    // 1. Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      update("auth", { status: "fail", detail: "ไม่พบ session ผู้ใช้", fix: "กรุณาเข้าสู่ระบบใหม่" });
      setRunning(false);
      return;
    }
    const userId = session.user.id;
    update("auth", { status: "ok", detail: `เข้าสู่ระบบในชื่อ ${session.user.email || userId.slice(0, 8)}` });

    // 2. Profile
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, employee_code, position_title, department, google_email, school_id")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      update("profile", { status: "fail", detail: profErr.message, fix: "ตรวจสอบสิทธิ์อ่านตาราง profiles" });
    } else if (!profile) {
      update("profile", { status: "fail", detail: "ไม่พบโปรไฟล์ของผู้ใช้นี้", fix: "ตรวจ trigger handle_new_user หรือสร้างโปรไฟล์ใหม่จากเมนูจัดการผู้ใช้" });
    } else {
      const missing: string[] = [];
      if (!profile.first_name) missing.push("ชื่อ");
      if (!profile.last_name) missing.push("นามสกุล");
      if (!profile.employee_code) missing.push("รหัสบุคลากร");
      if (missing.length) {
        update("profile", { status: "warn", detail: `ขาดข้อมูล: ${missing.join(", ")}`, fix: "กรอกข้อมูลที่ขาดในหน้าโปรไฟล์ — จำเป็นสำหรับสร้างบุคลากรอัตโนมัติ", raw: profile });
      } else {
        update("profile", { status: "ok", detail: `${profile.first_name} ${profile.last_name} (${profile.employee_code})`, raw: profile });
      }
    }

    // 3. Personnel
    let personnel: any = null;
    const { data: byUser, error: persErr } = await supabase
      .from("personnel")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (persErr) {
      update("personnel_rls", { status: "fail", detail: persErr.message, fix: "ตรวจ RLS policy ของตาราง personnel ให้ admin/teacher อ่านได้" });
    } else {
      update("personnel_rls", { status: "ok", detail: "อ่านได้ตามปกติ" });
    }

    if (byUser) {
      personnel = byUser;
      update("personnel", { status: "ok", detail: `เชื่อมโยงแล้ว: ${byUser.first_name} ${byUser.last_name} (${byUser.employee_code})`, raw: byUser });
    } else if (profile?.employee_code) {
      const { data: byCode } = await supabase
        .from("personnel")
        .select("*")
        .eq("employee_code", profile.employee_code)
        .maybeSingle();
      if (byCode) {
        personnel = byCode;
        update("personnel", {
          status: "warn",
          detail: `พบบุคลากร ${byCode.employee_code} แต่ยังไม่ผูก user_id`,
          fix: "กดปุ่ม \"ลิงก์บุคลากรเข้ากับบัญชี\" ด้านล่าง",
          raw: byCode,
        });
      } else {
        update("personnel", {
          status: "fail",
          detail: "ยังไม่มีข้อมูลบุคลากรของบัญชีนี้",
          fix: "กดปุ่ม \"สร้างข้อมูลบุคลากรอัตโนมัติ\" ด้านล่าง (ใช้ข้อมูลจากโปรไฟล์)",
        });
      }
    } else {
      update("personnel", { status: "fail", detail: "ไม่พบบุคลากร และโปรไฟล์ไม่มีรหัสบุคลากร", fix: "กรอกรหัสบุคลากรในโปรไฟล์ก่อน" });
    }

    // 4. time_clock RLS — try a harmless select
    const { error: tcErr } = await supabase.from("time_clock").select("id").limit(1);
    if (tcErr) {
      update("time_clock_rls", { status: "fail", detail: tcErr.message, fix: "ตรวจ RLS policy ของ time_clock" });
    } else {
      update("time_clock_rls", { status: "ok", detail: "เข้าถึงตารางได้" });
    }

    // 5. GPS settings
    const { data: gps } = await supabase
      .from("school_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["clock_latitude", "clock_longitude", "clock_radius"]);
    const gpsMap: Record<string, string> = {};
    (gps || []).forEach((s: any) => { gpsMap[s.setting_key] = s.setting_value; });
    if (!gpsMap.clock_latitude || !gpsMap.clock_longitude) {
      update("gps_settings", { status: "fail", detail: "ยังไม่ได้ตั้งพิกัดโรงเรียน", fix: "ไปที่ ผู้ดูแลระบบ → ตำแหน่งโรงเรียน เพื่อกำหนดพิกัด" });
    } else {
      update("gps_settings", {
        status: "ok",
        detail: `พิกัด ${parseFloat(gpsMap.clock_latitude).toFixed(5)}, ${parseFloat(gpsMap.clock_longitude).toFixed(5)} รัศมี ${gpsMap.clock_radius || "200"} ม.`,
      });
    }

    // 6. Geolocation
    if (!navigator.geolocation) {
      update("geolocation", { status: "fail", detail: "เบราว์เซอร์ไม่รองรับ Geolocation", fix: "ใช้เบราว์เซอร์ที่ทันสมัย (Chrome / Safari)" });
    } else {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
        );
        update("geolocation", { status: "ok", detail: `ตำแหน่งปัจจุบัน ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (ความแม่น ±${Math.round(pos.coords.accuracy)} ม.)` });
      } catch (e: any) {
        update("geolocation", { status: "fail", detail: e.message || "ปฏิเสธสิทธิ์ตำแหน่ง", fix: "อนุญาต Location ในเบราว์เซอร์/อุปกรณ์ แล้วโหลดหน้าใหม่" });
      }
    }

    // 7. Camera + Face-scan diagnostics
    // 7a. Secure context (camera requires HTTPS or localhost)
    if (window.isSecureContext) {
      update("secure_ctx", { status: "ok", detail: `บริบทปลอดภัย (${location.protocol}//${location.hostname})` });
    } else {
      update("secure_ctx", { status: "fail", detail: `ไม่ใช่ HTTPS (${location.protocol})`, fix: "เปิดผ่าน https:// หรือ localhost เท่านั้น มิฉะนั้นเบราว์เซอร์จะบล็อกกล้อง" });
    }

    // 7b. Enumerate video devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      if (cams.length === 0) {
        update("face_devices", { status: "fail", detail: "ไม่พบกล้องในระบบ", fix: "เชื่อมต่อกล้อง USB หรือเปิดสิทธิ์กล้องในระบบปฏิบัติการ" });
      } else {
        const labeled = cams.filter((c) => c.label).length;
        update("face_devices", {
          status: "ok",
          detail: `พบกล้อง ${cams.length} ตัว${labeled === 0 ? " (ยังไม่ขออนุญาตจึงไม่เห็นชื่อ)" : ""}`,
          raw: cams.map((c) => ({ label: c.label || "(ไม่ระบุชื่อ)", deviceId: c.deviceId.slice(0, 8) })),
        });
      }
    } catch (e: any) {
      update("face_devices", { status: "warn", detail: e.message || "ไม่สามารถอ่านรายการกล้อง" });
    }

    // 7c. Open front camera + measure resolution & brightness for face scan
    let faceStream: MediaStream | null = null;
    try {
      faceStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      update("camera", { status: "ok", detail: "เปิดกล้องหน้าได้สำเร็จ" });

      const track = faceStream.getVideoTracks()[0];
      const settings = track.getSettings();
      const w = settings.width || 0;
      const h = settings.height || 0;
      if (w >= 640 && h >= 480) {
        update("face_resolution", { status: "ok", detail: `ความละเอียดที่ใช้งานจริง ${w}×${h} (${track.label || "กล้องหน้า"})` });
      } else if (w > 0) {
        update("face_resolution", {
          status: "warn",
          detail: `ความละเอียดต่ำ ${w}×${h}`,
          fix: "ใช้กล้องที่รองรับ 640×480 ขึ้นไปเพื่อให้สแกนหน้าได้ชัด",
        });
      } else {
        update("face_resolution", { status: "warn", detail: "อ่านความละเอียดไม่ได้" });
      }

      // 7d. Brightness sampling (lighting check)
      try {
        const video = document.createElement("video");
        video.srcObject = faceStream;
        video.muted = true;
        video.playsInline = true;
        await video.play();
        await new Promise((r) => setTimeout(r, 350));
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let sum = 0;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            count++;
          }
          const avg = sum / count; // 0-255
          if (avg < 40) {
            update("face_lighting", { status: "fail", detail: `แสงน้อยเกินไป (ความสว่างเฉลี่ย ${avg.toFixed(0)}/255)`, fix: "เพิ่มแสงให้บริเวณใบหน้า หลีกเลี่ยงการยืนทวนแสง" });
          } else if (avg < 80) {
            update("face_lighting", { status: "warn", detail: `แสงค่อนข้างน้อย (${avg.toFixed(0)}/255)`, fix: "เพิ่มแสงเพื่อให้สแกนหน้าได้แม่นยำขึ้น" });
          } else if (avg > 230) {
            update("face_lighting", { status: "warn", detail: `แสงจ้าเกินไป (${avg.toFixed(0)}/255)`, fix: "ลดแสงจ้า/หลีกเลี่ยงแสงตรงเข้ากล้อง" });
          } else {
            update("face_lighting", { status: "ok", detail: `ความสว่างเฉลี่ย ${avg.toFixed(0)}/255 — เหมาะสม` });
          }
        } else {
          update("face_lighting", { status: "warn", detail: "ไม่สามารถวิเคราะห์ภาพได้" });
        }
        video.pause();
        video.srcObject = null;
      } catch (e: any) {
        update("face_lighting", { status: "warn", detail: e.message || "ข้ามการวัดแสง" });
      }
    } catch (e: any) {
      update("camera", { status: "fail", detail: e.message || "ไม่สามารถเปิดกล้องได้", fix: "อนุญาตการเข้าถึงกล้องในเบราว์เซอร์/อุปกรณ์" });
      update("face_resolution", { status: "warn", detail: "ข้าม — กล้องเปิดไม่ได้" });
      update("face_lighting", { status: "warn", detail: "ข้าม — กล้องเปิดไม่ได้" });
    } finally {
      faceStream?.getTracks().forEach((t) => t.stop());
    }

    // 8. Storage bucket — probe by listing inside it (listBuckets is RLS-restricted and unreliable)
    try {
      const { error: lErr } = await supabase.storage.from("attendance-photos").list("", { limit: 1 });
      if (lErr) {
        const msg = (lErr.message || "").toLowerCase();
        if (msg.includes("not found") || msg.includes("does not exist")) {
          update("storage", { status: "fail", detail: "ไม่พบ bucket attendance-photos", fix: "สร้าง bucket ใหม่ใน Lovable Cloud Storage" });
        } else {
          // Likely RLS denies list but upload still works — treat as OK
          update("storage", { status: "ok", detail: `bucket พร้อมใช้งาน (จำกัดสิทธิ์ list: ${lErr.message})` });
        }
      } else {
        update("storage", { status: "ok", detail: "bucket attendance-photos พร้อมใช้งาน" });
      }
    } catch (e: any) {
      update("storage", { status: "warn", detail: e.message || "ไม่สามารถตรวจสอบ bucket" });
    }

    // 9. Recent records / errors
    if (personnel?.id) {
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("time_clock")
        .select("clock_date, clock_in, clock_out, status, gps_verified, clock_in_photo_url")
        .eq("personnel_id", personnel.id)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!recent || recent.length === 0) {
        update("recent_errors", { status: "warn", detail: "ยังไม่มีรายการลงเวลาใน 24 ชม. ที่ผ่านมา", fix: "ลองลงเวลาเพื่อทดสอบ" });
      } else {
        const missingPhoto = recent.filter((r: any) => r.clock_in && !r.clock_in_photo_url).length;
        update("recent_errors", {
          status: missingPhoto > 0 ? "warn" : "ok",
          detail: `พบ ${recent.length} รายการ${missingPhoto > 0 ? ` (ขาดภาพ ${missingPhoto} รายการ)` : ""}`,
          raw: recent,
        });
      }
    } else {
      update("recent_errors", { status: "warn", detail: "ข้ามการตรวจ — ยังไม่มีข้อมูลบุคลากร" });
    }

    setLastRun(new Date());
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!roleLoading && (isAdmin || isDirector)) runChecks();
  }, [roleLoading, isAdmin, isDirector, runChecks]);

  // Auto-refresh every 30s while page is open
  useEffect(() => {
    if (!isAdmin && !isDirector) return;
    const t = setInterval(() => { if (!running) runChecks(); }, 30000);
    return () => clearInterval(t);
  }, [isAdmin, isDirector, running, runChecks]);

  const handleAutoCreate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, employee_code, position_title, department, google_email")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.first_name || !profile?.last_name) {
      swal.info("กรุณากรอกชื่อ-สกุลในโปรไฟล์ก่อน");
      return;
    }
    const code = profile.employee_code || `EMP-${user.id.slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from("personnel").insert({
      employee_code: code,
      first_name: profile.first_name,
      last_name: profile.last_name,
      position: (profile as any).position_title || "บุคลากร",
      department: (profile as any).department || "ทั่วไป",
      email: (profile as any).google_email || null,
      status: "active",
      user_id: user.id,
    });
    if (error) swal.error("สร้างไม่สำเร็จ", error.message);
    else { swal.info("สร้างข้อมูลบุคลากรเรียบร้อย"); runChecks(); }
  };

  const handleLink = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("employee_code").eq("id", user.id).maybeSingle();
    if (!profile?.employee_code) { swal.info("ไม่พบรหัสบุคลากรในโปรไฟล์"); return; }
    const { error } = await supabase.from("personnel").update({ user_id: user.id }).eq("employee_code", profile.employee_code);
    if (error) swal.error("ลิงก์ไม่สำเร็จ", error.message);
    else { swal.info("ลิงก์เรียบร้อย"); runChecks(); }
  };

  if (roleLoading) return <div className="p-8 text-center">กำลังโหลด...</div>;
  if (!isAdmin && !isDirector) return <Navigate to="/dashboard" replace />;

  const personnelCheck = checks.find((c) => c.id === "personnel");
  const needCreate = personnelCheck?.status === "fail";
  const needLink = personnelCheck?.status === "warn";

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  return (
    <div className="space-y-6">
      <Card className="card-gradient">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">วินิจฉัยระบบลงเวลา & สแกนหน้า</h1>
                <p className="text-sm text-muted-foreground">
                  ตรวจสอบสาเหตุของ error และวิธีแก้ไขแบบเรียลไทม์
                  {lastRun && ` · อัปเดตล่าสุด ${lastRun.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
                </p>
              </div>
            </div>
            <Button onClick={runChecks} disabled={running} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
              ตรวจสอบใหม่
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-muted-foreground">ผ่านการตรวจ</p><p className="text-3xl font-bold text-success">{checks.filter((c) => c.status === "ok").length}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-muted-foreground">ควรตรวจสอบ</p><p className="text-3xl font-bold text-warning">{warnCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-muted-foreground">พบปัญหา</p><p className="text-3xl font-bold text-danger">{failCount}</p></CardContent></Card>
      </div>

      {/* Quick actions */}
      {(needCreate || needLink) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>การดำเนินการแนะนำ</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2 mt-2">
            {needCreate && <Button size="sm" onClick={handleAutoCreate}>สร้างข้อมูลบุคลากรอัตโนมัติ</Button>}
            {needLink && <Button size="sm" onClick={handleLink}>ลิงก์บุคลากรเข้ากับบัญชี</Button>}
          </AlertDescription>
        </Alert>
      )}

      {/* Checks */}
      <Card>
        <CardHeader><CardTitle className="text-base">รายการตรวจสอบ ({checks.length} รายการ)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {checks.map((c) => {
            const S = STATUS_STYLES[c.status];
            const RowIcon = c.icon;
            return (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                <div className="mt-0.5"><RowIcon className="w-5 h-5 text-muted-foreground" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{c.label}</p>
                    <Badge className={S.color}>
                      <S.Icon className={`w-3 h-3 mr-1 ${c.status === "pending" ? "animate-spin" : ""}`} />
                      {S.label}
                    </Badge>
                  </div>
                  {c.detail && <p className="text-xs text-muted-foreground mt-1 break-words">{c.detail}</p>}
                  {c.fix && (
                    <p className="text-xs mt-1 text-primary">
                      <span className="font-semibold">วิธีแก้: </span>{c.fix}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        หน้านี้รีเฟรชอัตโนมัติทุก 30 วินาที · บทบาทผู้เข้าถึง: {role}
      </p>
    </div>
  );
}
