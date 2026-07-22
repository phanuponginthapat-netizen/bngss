import { useState, useEffect, useRef } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Time24Input } from "@/components/ui/time24-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { swal } from "@/lib/swal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, Clock, UserCheck, MapPin, Settings, CheckCircle, Loader2, History, Camera, X, BarChart3, AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import MapPicker from "@/components/MapPicker";
import { StatCard } from "@/components/shared";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal: { label: "ปกติ", color: "bg-emerald-100 text-emerald-800" },
  late: { label: "มาสาย", color: "bg-amber-100 text-amber-800" },
  absent: { label: "ขาด", color: "bg-red-100 text-red-800" },
  leave: { label: "ลา", color: "bg-blue-100 text-blue-800" },
  official: { label: "ไปราชการ", color: "bg-purple-100 text-purple-800" },
};

const TimeClockPage = () => {
  const qc = useQueryClient();
  const { role, userId } = useUserRole();
  const isAdmin = role === "admin" || role === "director";

  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockError, setClockError] = useState<{ title: string; message: string; kind: "gps" | "range" | "photo" | "other" } | null>(null);

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // GPS state (admin)
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");
  const [gpsRadius, setGpsRadius] = useState("200");
  const [savingGps, setSavingGps] = useState(false);

  // Time settings (admin)
  const [clockInStart, setClockInStart] = useState("07:00");
  const [clockInEnd, setClockInEnd] = useState("08:30");
  const [clockOutStart, setClockOutStart] = useState("15:30");
  const [clockOutEnd, setClockOutEnd] = useState("17:00");
  const [lateThreshold, setLateThreshold] = useState("08:30");
  // === Off-site (นอกพื้นที่) ===
  const [offsiteMode, setOffsiteMode] = useState(false);
  const [offsiteReason, setOffsiteReason] = useState("");
  const [offsiteLocation, setOffsiteLocation] = useState("");


  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get current user's personnel record (for teacher role)
  const { data: myPersonnel } = useQuery({
    queryKey: ["my-personnel-timeclock", userId],
    enabled: !!userId && !isAdmin,
    queryFn: async () => {
      // 1) Try direct match by user_id
      const { data: byUser } = await supabase.from("personnel").select("*").eq("user_id", userId!).maybeSingle();
      if (byUser) return byUser;

      // 2) Fallback: match via profile (employee_code / student_code / email / name)
      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_code, student_code, google_email, first_name, last_name")
        .eq("id", userId!)
        .maybeSingle();
      if (!profile) return null;

      const codes = [profile.employee_code, profile.student_code].filter(Boolean) as string[];
      for (const code of codes) {
        const { data } = await supabase.from("personnel").select("*").eq("employee_code", code).maybeSingle();
        if (data) {
          // Auto-link for next time
          await supabase.from("personnel").update({ user_id: userId! }).eq("id", data.id);
          return data;
        }
      }
      if (profile.google_email) {
        const { data } = await supabase.from("personnel").select("*").eq("email", profile.google_email).maybeSingle();
        if (data) {
          await supabase.from("personnel").update({ user_id: userId! }).eq("id", data.id);
          return data;
        }
      }
      if (profile.first_name && profile.last_name) {
        const { data } = await supabase
          .from("personnel")
          .select("*")
          .eq("first_name", profile.first_name)
          .eq("last_name", profile.last_name)
          .maybeSingle();
        if (data) {
          await supabase.from("personnel").update({ user_id: userId! }).eq("id", data.id);
          return data;
        }
      }

      // 3) Auto-create personnel record from profile so the user is not blocked
      if (profile.first_name && profile.last_name) {
        const code = profile.employee_code || `EMP-${userId!.slice(0, 8).toUpperCase()}`;
        const { data: created, error: insErr } = await supabase
          .from("personnel")
          .insert({
            employee_code: code,
            first_name: profile.first_name,
            last_name: profile.last_name,
            position: (profile as any).position_title || "บุคลากร",
            department: (profile as any).department || "ทั่วไป",
            email: (profile as any).google_email || null,
            status: "active",
            user_id: userId!,
          })
          .select("*")
          .maybeSingle();
        if (!insErr && created) return created;
      }
      return null;
    },
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("*").eq("status", "active").order("first_name");
      return data || [];
    },
  });

  // Records: admin sees all, teacher sees only their own
  const { data: records = [] } = useQuery({
    queryKey: ["time_clock", isAdmin ? "all" : myPersonnel?.id],
    enabled: isAdmin || !!myPersonnel?.id,
    queryFn: async () => {
      let query = supabase.from("time_clock")
        .select("*, personnel(prefix, first_name, last_name, employee_code)")
        .order("clock_date", { ascending: false });

      if (!isAdmin && myPersonnel?.id) {
        query = query.eq("personnel_id", myPersonnel.id);
      }

      const { data } = await query.limit(100);
      return data || [];
    },
  });

  const { data: gpsSettings } = useQuery({
    queryKey: ["gps_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("school_settings").select("*").in("setting_key", [
        "clock_latitude", "clock_longitude", "clock_radius",
        "clock_in_start", "clock_in_end", "clock_out_start", "clock_out_end", "clock_late_threshold",
        "gps_enforcement_enabled",
      ]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      return map;
    },
  });

  useEffect(() => {
    if (gpsSettings) {
      setGpsLat(gpsSettings.clock_latitude || "");
      setGpsLng(gpsSettings.clock_longitude || "");
      setGpsRadius(gpsSettings.clock_radius || "200");
      setClockInStart(gpsSettings.clock_in_start || "07:00");
      setClockInEnd(gpsSettings.clock_in_end || "08:30");
      setClockOutStart(gpsSettings.clock_out_start || "15:30");
      setClockOutEnd(gpsSettings.clock_out_end || "17:00");
      setLateThreshold(gpsSettings.clock_late_threshold || "08:30");
    }
  }, [gpsSettings]);

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
    });
  };

  const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ===== Camera handling =====
  const startCamera = async () => {
    setCapturedPhoto(null);
    setCameraOpen(true);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      // Wait one tick so videoRef is attached
      setTimeout(async () => {
        if (videoRef.current) {
          await attachStreamToVideo(videoRef.current, stream);
          setCameraReady(true);
        }
      }, 50);
    } catch (e: any) {
      swal.error("ไม่สามารถเปิดกล้องได้: " + (e.message || ""));
      setCameraOpen(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraReady(false);
  };

  const capturePhoto = (): string | null => {
    if (!videoRef.current) return null;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    const size = Math.min(v.videoWidth, v.videoHeight) || 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    // Add timestamp overlay
    const stamp = new Date().toLocaleString("th-TH");
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, size - 36, size, 36);
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.fillText(stamp, 10, size - 12);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    setCapturedPhoto(dataUrl);
    return dataUrl;
  };

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const uploadPhoto = async (dataUrl: string, personnelCode: string, kind: "in" | "out"): Promise<string> => {
    const blob = await dataUrlToBlob(dataUrl);
    const today = todayBangkok();
    const path = `${today}/${personnelCode}_${kind}_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("attendance-photos").upload(path, blob, {
      contentType: "image/jpeg",
    });
    if (error) {
      console.warn("Attendance photo upload failed; using database fallback", error);
      swal.toast.warning("บันทึกรูปลงเวลาแบบสำรอง — ที่เก็บไฟล์มีปัญหาชั่วคราว ระบบเก็บรูปย่อในฐานข้อมูลแทน");
      // shrink data URL so the row insert payload stays small
      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const maxW = 480;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.6);
      } catch {
        return dataUrl;
      }
    }
    // Bucket is private — return a long-lived signed URL (1 year)
    const { data, error: signErr } = await supabase.storage
      .from("attendance-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr || !data?.signedUrl) {
      console.warn("Attendance signed URL failed; using database fallback", signErr);
      swal.toast.warning("บันทึกรูปลงเวลาแบบสำรอง — สร้างลิงก์รูปไม่ได้ แต่ระบบจะบันทึกเวลาให้ต่อได้");
      return dataUrl;
    }
    return data.signedUrl;
  };

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []);

  const handleClockIn = async () => {
    setSaving(true);
    setClockError(null);
    try {
      // Require photo first
      if (!capturedPhoto) {
        setClockError({ kind: "photo", title: "ยังไม่มีภาพถ่าย", message: "กรุณาถ่ายภาพใบหน้าก่อนกดลงเวลา" });
        setSaving(false);
        return;
      }

      // ===== Off-site mode: ข้ามการตรวจ time-window & GPS =====
      if (offsiteMode) {
        if (!offsiteReason.trim() || !offsiteLocation.trim()) {
          setClockError({ kind: "other", title: "กรอกข้อมูลไม่ครบ", message: "กรุณากรอกเหตุผลและสถานที่ปฏิบัติงานนอกพื้นที่" });
          setSaving(false);
          return;
        }
      } else {
      // ===== Time-window (basic) — รายละเอียดเข้า/ออก อยู่ใน saveClockRecord (อิง DB จริง) =====
      const nowChk = new Date();
      const curStr = `${String(nowChk.getHours()).padStart(2, "0")}:${String(nowChk.getMinutes()).padStart(2, "0")}`;
      const inStartChk = ((gpsSettings?.clock_in_start || clockInStart || "07:00") as string).slice(0, 5);
      const outEndChk = ((gpsSettings?.clock_out_end || clockOutEnd || "17:00") as string).slice(0, 5);
      if (curStr < inStartChk || curStr > outEndChk) {
        setClockError({
          kind: "other",
          title: "อยู่นอกช่วงเวลาลงเวลา",
          message: `เวลาปัจจุบัน ${curStr} น. — อนุญาตให้ลงเวลาได้ระหว่าง ${inStartChk} - ${outEndChk} น. เท่านั้น`,
        });
        setSaving(false);
        return;
      }
      }



      // GPS check (ข้ามถ้าผู้ดูแลปิดสวิตช์ gps_enforcement_enabled หรืออยู่ในโหมด off-site)
      const enforceGps = !offsiteMode && ((gpsSettings?.gps_enforcement_enabled ?? "true") !== "false");
      const schoolLat = parseFloat(gpsSettings?.clock_latitude || "0");

      const schoolLng = parseFloat(gpsSettings?.clock_longitude || "0");
      const radius = parseFloat(gpsSettings?.clock_radius || "200");

      let userLat = 0, userLng = 0;
      if (offsiteMode) {
        // ปฏิบัติงานนอกพื้นที่ — พยายามอ่านพิกัดเพื่อ log แต่ไม่บล็อก
        try { const pos = await getCurrentPosition(); userLat = pos.coords.latitude; userLng = pos.coords.longitude; } catch { /* เงียบ */ }
      } else if (enforceGps && schoolLat && schoolLng) {
        try {
          const pos = await getCurrentPosition();
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          const dist = calcDistance(userLat, userLng, schoolLat, schoolLng);
          if (dist > radius) {
            setClockError({
              kind: "range",
              title: "อยู่นอกพิกัดที่กำหนด",
              message: `คุณอยู่ห่างจากจุดลงเวลา ${Math.round(dist)} เมตร (อนุญาตไม่เกิน ${radius} เมตร) — ถ้ากำลังปฏิบัติงานนอกโรงเรียน กรุณาเปิดโหมด "ปฏิบัติงานนอกพื้นที่" แทน`,
            });
            setSaving(false);
            return;
          }
        } catch {
          setClockError({
            kind: "gps",
            title: "ไม่สามารถดึงตำแหน่ง GPS",
            message: "กรุณาเปิดการเข้าถึงตำแหน่ง (Location) ในเบราว์เซอร์/อุปกรณ์ แล้วกด \"ลองใหม่\"",
          });
          setSaving(false);
          return;
        }
      } else if (!enforceGps && schoolLat && schoolLng) {
        try {
          const pos = await getCurrentPosition();
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
        } catch { /* เงียบ */ }
      } else {
        setClockError({
          kind: "gps",
          title: "ยังไม่ได้ตั้งค่าพิกัดโรงเรียน",
          message: "ระบบยังไม่ได้กำหนดพิกัดที่อนุญาตให้ลงเวลา กรุณาติดต่อผู้ดูแลระบบ (หรือเปิดโหมดปฏิบัติงานนอกพื้นที่)",
        });
        setSaving(false);
        return;
      }


      // Find personnel
      const target = myPersonnel || (isAdmin ? null : null);
      if (!target) {
        // For admin scanning, try to get from profile
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
        const { data: profile } = await supabase
          .from("profiles")
          .select("employee_code, student_code, first_name, last_name, position_title, department, google_email")
          .eq("id", user.id)
          .maybeSingle();

        // ใช้ employee_code ก่อน — ถ้าไม่มีให้ fallback ไปที่ student_code
        // (กรณีบัญชีถูกสร้างผ่าน login code เดียวแล้วเก็บไว้ใน student_code)
        const code = profile?.employee_code || profile?.student_code;
        if (!code) {
          setClockError({
            kind: "other",
            title: "ไม่พบข้อมูลบุคลากร",
            message: "บัญชีของคุณยังไม่ได้ผูกกับรหัสบุคลากร/รหัสประจำตัว กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดรหัสในโปรไฟล์",
          });
          setSaving(false);
          return;
        }
        let matched: any = personnel.find((p: any) => p.employee_code === code || p.user_id === user.id);
        if (!matched && profile?.first_name && profile?.last_name) {
          // Auto-create personnel record on first time-clock
          const { data: created, error: createErr } = await supabase.from("personnel").insert({
            employee_code: code,
            first_name: profile.first_name,
            last_name: profile.last_name,
            position: (profile as any).position_title || "บุคลากร",
            department: (profile as any).department || "ทั่วไป",
            email: (profile as any).google_email || null,
            status: "active",
            user_id: user.id,
          }).select("*").maybeSingle();
          if (createErr) {
            setClockError({
              kind: "other",
              title: "สร้างข้อมูลบุคลากรไม่สำเร็จ",
              message: createErr.message || "ไม่สามารถสร้างข้อมูลบุคลากรอัตโนมัติได้ กรุณาติดต่อผู้ดูแลระบบ",
            });
            setSaving(false);
            return;
          }
          if (created) matched = created;
        }
        if (!matched) {
          setClockError({
            kind: "other",
            title: "ไม่พบข้อมูลบุคลากร",
            message: "ไม่พบรายชื่อบุคลากรของคุณในระบบ และไม่สามารถสร้างให้อัตโนมัติได้ — กรุณาให้ผู้ดูแลเพิ่มข้อมูลบุคลากรพร้อมรหัส " + code,
          });
          setSaving(false);
          return;
        }
        await saveClockRecord(matched, userLat, userLng);
      } else {
        await saveClockRecord(target, userLat, userLng);
      }
    } catch (e: any) {
      // Photo upload failures bubble here from saveClockRecord
      const msg = e?.message || "เกิดข้อผิดพลาด";
      const isPhoto = /upload|photo|storage|attendance-photos/i.test(msg);
      setClockError({
        kind: isPhoto ? "photo" : "other",
        title: isPhoto ? "อัปโหลดรูปไม่สำเร็จ" : "เกิดข้อผิดพลาด",
        message: isPhoto
          ? `ไม่สามารถอัปโหลดภาพถ่ายได้ (${msg}) กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตแล้วกด "ลองใหม่"`
          : msg,
      });
    }
    setSaving(false);
  };

  const saveClockRecord = async (target: any, userLat: number, userLng: number) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const threshold = gpsSettings?.clock_late_threshold || "08:30";
    const clockStatus = currentTimeStr > threshold ? "late" : "normal";

    // ใช้วันที่ตามเขตเวลา Asia/Bangkok (กัน clock_date เพี้ยน 1 วันก่อน 07:00)
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

    // Check if already clocked in today
    const { data: existing } = await supabase.from("time_clock")
      .select("id, clock_in, clock_out")
      .eq("personnel_id", target.id)
      .eq("clock_date", today)
      .maybeSingle();

    // normalize เป็น HH:MM (settings อาจเก็บเป็น HH:MM:SS)
    const hhmm = (s?: string | null) => (s || "").slice(0, 5);
    const inStart = hhmm(gpsSettings?.clock_in_start || clockInStart) || "07:00";
    const inEnd = hhmm(gpsSettings?.clock_in_end || clockInEnd) || "08:30";
    const outStart = hhmm(gpsSettings?.clock_out_start || clockOutStart) || "15:30";
    const outEnd = hhmm(gpsSettings?.clock_out_end || clockOutEnd) || "17:00";

    if (existing) {
      if (existing.clock_out) {
        swal.toast.info("คุณลงเวลาเข้า-ออกครบแล้ววันนี้");
        return;
      }
      // ===== Clock-OUT: ต้องอยู่ในช่วงออกงานเท่านั้น (ข้ามถ้าเป็นโหมดนอกพื้นที่) =====
      if (!offsiteMode && (currentTimeStr < outStart || currentTimeStr > outEnd)) {
        setClockError({
          kind: "other",
          title: "อยู่นอกช่วงเวลาลงเวลาออก",
          message: `เวลาปัจจุบัน ${currentTimeStr} น. — อนุญาตให้ลงเวลาออกได้ระหว่าง ${outStart} - ${outEnd} น. เท่านั้น`,
        });
        return;
      }
      // ป้องกันบันทึกเข้า/ออกในเวลาใกล้กันเกินไป (ห่างกันอย่างน้อย 1 นาที)
      const inAt = new Date(existing.clock_in).getTime();
      const gapMin = (now.getTime() - inAt) / 60000;
      if (gapMin < 1) {
        setClockError({
          kind: "other",
          title: "ลงเวลาออกเร็วเกินไป",
          message: `เพิ่งลงเวลาเข้าไปเมื่อ ${Math.max(0, Math.round(gapMin * 60))} วินาทีที่แล้ว กรุณารออย่างน้อย 1 นาที`,
        });
        return;
      }
      const outPhotoUrl = await uploadPhoto(capturedPhoto!, target.employee_code || target.id, "out");
      const updatePayload: any = {
        clock_out: now.toISOString(),
        notes: offsiteMode
          ? `ออกงาน ${currentTimeStr} น. (นอกพื้นที่: ${offsiteLocation})`
          : `ออกงาน ${currentTimeStr} น.`,
        clock_out_photo_url: outPhotoUrl,
      };
      if (offsiteMode) {
        updatePayload.is_offsite = true;
        updatePayload.offsite_reason = offsiteReason;
        updatePayload.offsite_location = offsiteLocation;
      }
      const { error } = await supabase.from("time_clock")
        .update(updatePayload)
        .eq("id", existing.id)
        .is("clock_out", null);
      if (error) throw new Error(error.message);
      swal.toast.success(`ลงเวลาออกสำเร็จ! เวลา ${currentTimeStr} น.${offsiteMode ? " (นอกพื้นที่)" : ""}`);
    } else {
      // ===== Clock-IN: ต้องอยู่ในช่วงเข้างาน (ข้ามถ้าเป็นโหมดนอกพื้นที่) =====
      if (!offsiteMode && (currentTimeStr < inStart || currentTimeStr >= outStart)) {
        setClockError({
          kind: "other",
          title: "อยู่นอกช่วงเวลาลงเวลาเข้า",
          message: `เวลาปัจจุบัน ${currentTimeStr} น. — อนุญาตให้ลงเวลาเข้าได้ระหว่าง ${inStart} - ${inEnd} น. (เลย ${inEnd} จะถูกบันทึกเป็นสาย)`,
        });
        return;
      }
      const inPhotoUrl = await uploadPhoto(capturedPhoto!, target.employee_code || target.id, "in");
      const insertPayload: any = {
        personnel_id: target.id,
        clock_date: today,
        clock_in: now.toISOString(),
        status: offsiteMode ? "offsite" : clockStatus,
        clock_lat: userLat,
        clock_lng: userLng,
        gps_verified: !offsiteMode,
        notes: offsiteMode
          ? `เข้างานนอกพื้นที่ ${currentTimeStr} น. — ${offsiteReason}`
          : `เข้างาน ${currentTimeStr} น.`,
        clock_in_photo_url: inPhotoUrl,
        is_offsite: offsiteMode,
        offsite_reason: offsiteMode ? offsiteReason : null,
        offsite_location: offsiteMode ? offsiteLocation : null,
      };
      const { error } = await supabase.from("time_clock").insert(insertPayload);
      if (error) throw new Error(error.message);
      swal.toast.success(
        offsiteMode
          ? `ลงเวลาเข้า (นอกพื้นที่) สำเร็จ! เวลา ${currentTimeStr} น.`
          : `ลงเวลาเข้าสำเร็จ! เวลา ${currentTimeStr} น. สถานะ: ${STATUS_MAP[clockStatus]?.label}`
      );
    }



    // Reset photo + camera
    setCapturedPhoto(null);
    stopCamera();
    qc.invalidateQueries({ queryKey: ["time_clock"] });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("time_clock").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["time_clock"] });
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "-";
    try { return new Date(ts).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return "-"; }
  };

  const handleSaveSettings = async () => {
    setSavingGps(true);
    try {
      const settings = [
        ["clock_latitude", gpsLat], ["clock_longitude", gpsLng], ["clock_radius", gpsRadius],
        ["clock_in_start", clockInStart], ["clock_in_end", clockInEnd],
        ["clock_out_start", clockOutStart], ["clock_out_end", clockOutEnd],
        ["clock_late_threshold", lateThreshold],
      ];
      for (const [key, val] of settings) {
        await supabase.from("school_settings").upsert({ setting_key: key, setting_value: val } as any, { onConflict: "setting_key" });
      }
      swal.toast.success("บันทึกการตั้งค่าสำเร็จ!");
      qc.invalidateQueries({ queryKey: ["gps_settings"] });
    } catch (e: any) {
      swal.error(e.message);
    }
    setSavingGps(false);
  };

  const handleGetCurrentGps = async () => {
    try {
      const pos = await getCurrentPosition();
      setGpsLat(pos.coords.latitude.toFixed(6));
      setGpsLng(pos.coords.longitude.toFixed(6));
      swal.toast.success("ดึงพิกัดปัจจุบันสำเร็จ!");
    } catch {
      swal.error("ไม่สามารถดึง GPS ได้");
    }
  };

  const todayRecords = records.filter((r: any) => r.clock_date === todayBangkok());
  const todayStr = todayBangkok();
  const myTodayRecord = !isAdmin && myPersonnel ? records.find((r: any) => r.clock_date === todayStr && r.personnel_id === myPersonnel.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            {isAdmin ? "ระบบลงเวลาปฏิบัติงาน" : "ลงเวลาปฏิบัติงาน"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "ลงเวลาด้วย GPS และจัดการเวลาปฏิบัติงาน" : "ลงเวลาเข้า-ออกงานด้วย GPS"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/hr/time-clock/diagnostics">
                <AlertTriangle className="w-4 h-4 mr-2" />วินิจฉัยปัญหา
              </Link>
            </Button>
            <Button asChild variant="default" size="sm">
              <Link to="/dashboard/hr/attendance-dashboard">
                <BarChart3 className="w-4 h-4 mr-2" />แดชบอร์ดการมาทำงาน
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={isAdmin ? "มาปฏิบัติงานวันนี้" : "สถานะวันนี้"}
          value={todayRecords.filter((r: any) => r.status === "normal").length}
          icon={UserCheck}
          tone="success"
        />
        <StatCard
          label={`มาสาย${isAdmin ? "วันนี้" : ""}`}
          value={todayRecords.filter((r: any) => r.status === "late").length}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label={isAdmin ? "ลงเวลาทั้งหมดวันนี้" : "ลงเวลาทั้งหมด"}
          value={isAdmin ? todayRecords.length : records.length}
          icon={History}
          tone="primary"
        />
      </div>

      <Tabs defaultValue="clock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clock"><MapPin className="w-4 h-4 mr-2" />ลงเวลา (GPS)</TabsTrigger>
          <TabsTrigger value="records"><Clock className="w-4 h-4 mr-2" />{isAdmin ? "ประวัติทั้งหมด" : "ประวัติของฉัน"}</TabsTrigger>
          {isAdmin && <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" />ตั้งค่า GPS & เวลา</TabsTrigger>}
        </TabsList>

        {/* GPS Clock Tab */}
        <TabsContent value="clock">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                ลงเวลาด้วย GPS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Live Clock Display */}
              <div className="text-center">
                <p className="text-4xl font-bold text-primary tabular-nums">
                  {currentTime.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentTime.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>

              {/* Today's status */}
              {myTodayRecord && (
                <div className="mx-auto max-w-md p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="w-5 h-5" />
                    <div>
                      <p className="font-medium text-sm">
                        เข้างาน: {formatTime(myTodayRecord.clock_in)}
                        {myTodayRecord.clock_out ? ` | ออกงาน: ${formatTime(myTodayRecord.clock_out)}` : " (ยังไม่ลงเวลาออก)"}
                      </p>
                      <Badge className={STATUS_MAP[myTodayRecord.status]?.color || ""}>{STATUS_MAP[myTodayRecord.status]?.label || myTodayRecord.status}</Badge>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center gap-4">
                {/* Camera / Captured Photo */}
                {!myTodayRecord?.clock_out && (
                <div className="w-full max-w-sm">
                  {!cameraOpen && !capturedPhoto && (
                    <Button onClick={startCamera} variant="outline" size="lg" className="w-full h-14">
                      <Camera className="w-5 h-5 mr-2" />เปิดกล้องเพื่อถ่ายภาพ
                    </Button>
                  )}
                  {cameraOpen && !capturedPhoto && (
                    <div className="space-y-3">
                      <div className="relative aspect-square rounded-2xl overflow-hidden bg-black border-2 border-primary/30">
                        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                        {!cameraReady && (
                          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                            <Loader2 className="w-6 h-6 mr-2 animate-spin" /> กำลังเปิดกล้อง...
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => capturePhoto()} disabled={!cameraReady} className="flex-1">
                          <Camera className="w-4 h-4 mr-2" />ถ่ายภาพ
                        </Button>
                        <Button onClick={stopCamera} variant="outline" size="icon">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {capturedPhoto && (
                    <div className="space-y-3">
                      <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-emerald-500">
                        <img loading="lazy" decoding="async" src={capturedPhoto} alt="ภาพลงเวลา" className="w-full h-full object-cover" />
                      </div>
                      <Button onClick={() => { setCapturedPhoto(null); startCamera(); }} variant="outline" className="w-full">
                        <Camera className="w-4 h-4 mr-2" />ถ่ายใหม่
                      </Button>
                    </div>
                  )}
                </div>
                )}

                {/* Error Alert with Retry */}
                {clockError && (
                  <Alert variant="destructive" className="w-full max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{clockError.title}</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p className="text-sm">{clockError.message}</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setClockError(null);
                            // For photo issues, force re-capture
                            if (clockError.kind === "photo") {
                              setCapturedPhoto(null);
                              startCamera();
                            } else {
                              handleClockIn();
                            }
                          }}
                          disabled={saving}
                        >
                          <RefreshCw className="w-4 h-4 mr-1.5" />
                          {clockError.kind === "photo" ? "ถ่ายใหม่" : "ลองใหม่"}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setClockError(null)}>
                          ปิด
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Big GPS clock-in button */}
                {myTodayRecord?.clock_out ? (
                  <div className="w-full max-w-md rounded-2xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-6 text-center space-y-2">
                    <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">ลงเวลาเข้า-ออกครบแล้ววันนี้</p>
                    <p className="text-sm text-muted-foreground">
                      เข้า {formatTime(myTodayRecord.clock_in)} น. · ออก {formatTime(myTodayRecord.clock_out)} น.
                    </p>
                  </div>
                ) : (
                  <div className="w-full max-w-md space-y-3">
                    {/* Off-site toggle */}
                    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={offsiteMode}
                          onChange={(e) => setOffsiteMode(e.target.checked)}
                          className="mt-1 w-4 h-4 accent-amber-600"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            🧳 ปฏิบัติงานนอกพื้นที่ (ไปอบรม/ธุระโรงเรียน)
                          </div>
                          <div className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                            ข้ามการตรวจ GPS และช่วงเวลาลงเวลา — บันทึกเป็น "นอกพื้นที่"
                          </div>
                        </div>
                      </label>
                      {offsiteMode && (
                        <div className="mt-3 space-y-2 pl-6">
                          <input
                            type="text"
                            value={offsiteReason}
                            onChange={(e) => setOffsiteReason(e.target.value)}
                            placeholder="เหตุผล เช่น อบรมหลักสูตร PA, ประชุมเขตพื้นที่"
                            maxLength={200}
                            className="w-full rounded-lg border border-amber-300 dark:border-amber-800/60 bg-background px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            value={offsiteLocation}
                            onChange={(e) => setOffsiteLocation(e.target.value)}
                            placeholder="สถานที่ เช่น ห้องประชุม สพป., โรงแรม XYZ"
                            maxLength={200}
                            className="w-full rounded-lg border border-amber-300 dark:border-amber-800/60 bg-background px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleClockIn}
                      size="lg"
                      disabled={saving || !capturedPhoto}
                      className={`w-full h-16 text-base ${
                        offsiteMode
                          ? "bg-amber-600 hover:bg-amber-700 text-white"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                      {saving
                        ? "กำลังบันทึก..."
                        : myTodayRecord && !myTodayRecord.clock_out
                          ? offsiteMode ? "ลงเวลาออก (นอกพื้นที่)" : "ลงเวลาออก (GPS)"
                          : offsiteMode ? "ลงเวลาเข้า (นอกพื้นที่)" : "ลงเวลาเข้า (GPS)"}
                    </Button>
                  </div>
                )}


                {/* Teacher info */}
                {!isAdmin && myPersonnel && (
                  <Card className="w-full max-w-md">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <UserCheck className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{(myPersonnel as any).prefix}{(myPersonnel as any).first_name} {(myPersonnel as any).last_name}</p>
                          <p className="text-xs text-muted-foreground">รหัส: {(myPersonnel as any).employee_code}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="text-sm text-muted-foreground text-center space-y-1">
                  <p className="flex items-center gap-1 justify-center"><Camera className="w-4 h-4" /> ต้องถ่ายภาพก่อนทุกครั้ง เพื่อยืนยันตัวตน</p>
                  <p className="flex items-center gap-1 justify-center"><MapPin className="w-4 h-4" /> ระบบจะตรวจสอบ GPS อัตโนมัติ ต้องอยู่ในรัศมีที่กำหนด</p>
                  <p className="flex items-center gap-1 justify-center"><Clock className="w-4 h-4" /> เวลาเข้างาน: ก่อน {gpsSettings?.clock_late_threshold || "08:30"} น. | หลังจากนั้นถือว่ามาสาย</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>วันที่</TableHead>
                {isAdmin && <TableHead>รหัส</TableHead>}
                {isAdmin && <TableHead>ชื่อ-สกุล</TableHead>}
                <TableHead>เข้างาน</TableHead>
                <TableHead>ออกงาน</TableHead>
                <TableHead>ภาพ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                {isAdmin && <TableHead></TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {records.map((r: any) => {
                  const st = STATUS_MAP[r.status] || { label: r.status, color: "" };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.clock_date}</TableCell>
                      {isAdmin && <TableCell className="font-mono text-xs">{r.personnel?.employee_code || "-"}</TableCell>}
                      {isAdmin && (
                        <TableCell>
                          {r.personnel ? `${r.personnel.prefix || ""}${r.personnel.first_name} ${r.personnel.last_name}` : "-"}
                        </TableCell>
                      )}
                      <TableCell>{formatTime(r.clock_in)}</TableCell>
                      <TableCell>{formatTime(r.clock_out)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.clock_in_photo_url && (
                            <a href={r.clock_in_photo_url} target="_blank" rel="noopener noreferrer">
                              <img loading="lazy" decoding="async" src={r.clock_in_photo_url} alt="เข้า" className="w-10 h-10 rounded object-cover border" />
                            </a>
                          )}
                          {r.clock_out_photo_url && (
                            <a href={r.clock_out_photo_url} target="_blank" rel="noopener noreferrer">
                              <img loading="lazy" decoding="async" src={r.clock_out_photo_url} alt="ออก" className="w-10 h-10 rounded object-cover border" />
                            </a>
                          )}
                          {!r.clock_in_photo_url && !r.clock_out_photo_url && <span className="text-xs text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                      <TableCell className="max-w-[150px] truncate">{r.notes || "-"}</TableCell>
                      {isAdmin && <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>}
                    </TableRow>
                  );
                })}
                {records.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 6} className="text-center py-8 text-muted-foreground">
                      {!isAdmin && !myPersonnel ? "ไม่พบข้อมูลบุคลากรของคุณ กรุณาติดต่อ Admin" : "ไม่มีข้อมูล"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Settings Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* GPS Settings */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />ตั้งค่าพิกัด GPS โรงเรียน (ปักหมุดบนแผนที่)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">ค้นหาสถานที่ หรือแตะบนแผนที่เพื่อปักหมุดจุดลงเวลา และกำหนดรัศมีที่อนุญาต</p>

                  <MapPicker
                    lat={gpsLat ? parseFloat(gpsLat) : null}
                    lng={gpsLng ? parseFloat(gpsLng) : null}
                    radius={parseFloat(gpsRadius || "200")}
                    onChange={(la, ln) => {
                      setGpsLat(String(la));
                      setGpsLng(String(ln));
                    }}
                    height={380}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">ละติจูด</Label>
                      <Input type="number" step="any" value={gpsLat} onChange={e => setGpsLat(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">ลองจิจูด</Label>
                      <Input type="number" step="any" value={gpsLng} onChange={e => setGpsLng(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">รัศมี (เมตร)</Label>
                      <Input type="number" placeholder="200" value={gpsRadius} onChange={e => setGpsRadius(e.target.value)} />
                    </div>
                  </div>

                  {gpsLat && gpsLng && (
                    <div className="p-3 bg-muted rounded-xl text-sm">
                      <p>📍 {gpsLat}, {gpsLng} (รัศมี {gpsRadius} ม.)</p>
                      <a href={`https://www.google.com/maps?q=${gpsLat},${gpsLng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">ดูบน Google Maps →</a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Time Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />ตั้งค่าเวลาเข้า-ออกงาน</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">กำหนดช่วงเวลาที่อนุญาตให้ลงเวลาเข้า-ออก</p>
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-900/10 space-y-3">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">⏰ ช่วงเวลาเข้างาน</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">เริ่มต้น</Label>
                          <Time24Input value={clockInStart} onChange={(v) => setClockInStart(v)} />
                        </div>
                        <div>
                          <Label className="text-xs">สิ้นสุด</Label>
                          <Time24Input value={clockInEnd} onChange={(v) => setClockInEnd(v)} />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">⏱️ เกณฑ์มาสาย</p>
                      <div>
                        <Label className="text-xs">หลังเวลานี้ถือว่ามาสาย</Label>
                        <Time24Input value={lateThreshold} onChange={(v) => setLateThreshold(v)} />
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">🏠 ช่วงเวลาออกงาน</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">เริ่มต้น</Label>
                          <Time24Input value={clockOutStart} onChange={(v) => setClockOutStart(v)} />
                        </div>
                        <div>
                          <Label className="text-xs">สิ้นสุด</Label>
                          <Time24Input value={clockOutEnd} onChange={(v) => setClockOutEnd(v)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleSaveSettings} disabled={savingGps} size="lg">
                {savingGps ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
                บันทึกการตั้งค่าทั้งหมด
              </Button>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default TimeClockPage;
