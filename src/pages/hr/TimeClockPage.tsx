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
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, Clock, UserCheck, MapPin, Settings, CheckCircle, Loader2, History, Camera, X, BarChart3, AlertTriangle, RefreshCw, Briefcase, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import MapPicker from "@/components/MapPicker";
import { StatCard } from "@/components/shared";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { OffsiteRequestsTab } from "@/components/hr/OffsiteRequestsTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal: { label: "ปกติ", color: "bg-success-soft text-success" },
  late: { label: "มาสาย", color: "bg-warning-soft text-warning" },
  absent: { label: "ขาด", color: "bg-danger-soft text-danger" },
  leave: { label: "ลา", color: "bg-info-soft text-info" },
  official: { label: "ไปราชการ", color: "bg-info-soft text-info" },
};

const TimeClockPage = () => {
  const qc = useQueryClient();
  const { role, userId } = useUserRole();
  const isAdmin = role === "admin" || role === "director";

  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockError, setClockError] = useState<{ title: string; message: string; kind: "gps" | "range" | "photo" | "other" } | null>(null);

  // Off-site clock-in dialog
  const [offsiteOpen, setOffsiteOpen] = useState(false);
  const [offsiteReason, setOffsiteReason] = useState("");
  const [offsiteLocation, setOffsiteLocation] = useState("");

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
        "gps_enforcement_enabled", "clock_min_work_minutes",
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

      // ===== Time-window enforcement =====
      const nowChk = new Date();
      const curStr = `${String(nowChk.getHours()).padStart(2, "0")}:${String(nowChk.getMinutes()).padStart(2, "0")}`;
      const inStart = gpsSettings?.clock_in_start || clockInStart || "07:00";
      const inEnd = gpsSettings?.clock_in_end || clockInEnd || "08:30";
      const outStart = gpsSettings?.clock_out_start || clockOutStart || "15:30";
      const outEnd = gpsSettings?.clock_out_end || clockOutEnd || "17:00";
      const hasOpenRecord = !!(myTodayRecord && !myTodayRecord.clock_out);
      const isClockOut = hasOpenRecord;
      if (isClockOut) {
        if (curStr < outStart || curStr > outEnd) {
          setClockError({
            kind: "other",
            title: "อยู่นอกช่วงเวลาลงเวลาออก",
            message: `เวลาปัจจุบัน ${curStr} น. — อนุญาตให้ลงเวลาออกได้ระหว่าง ${outStart} - ${outEnd} น. เท่านั้น`,
          });
          setSaving(false);
          return;
        }
      } else {
        // clock-in: อนุญาตตั้งแต่ inStart ถึง outStart (เลย inEnd จะถูกบันทึกเป็น "สาย")
        if (curStr < inStart) {
          setClockError({
            kind: "other",
            title: "ยังไม่ถึงเวลาลงเวลาเข้า",
            message: `เวลาปัจจุบัน ${curStr} น. — สามารถลงเวลาเข้าได้ตั้งแต่ ${inStart} น. เป็นต้นไป`,
          });
          setSaving(false);
          return;
        }
        if (curStr > outStart) {
          setClockError({
            kind: "other",
            title: "เลยเวลาลงเวลาเข้าแล้ว",
            message: `เวลาปัจจุบัน ${curStr} น. — เลยช่วงลงเวลาเข้า (${inStart} - ${outStart} น.) แล้ว กรุณาติดต่อผู้ดูแลระบบ`,
          });
          setSaving(false);
          return;
        }
      }


      // GPS check (ข้ามถ้าผู้ดูแลปิดสวิตช์ gps_enforcement_enabled)
      const enforceGps = (gpsSettings?.gps_enforcement_enabled ?? "true") !== "false";
      const schoolLat = parseFloat(gpsSettings?.clock_latitude || "0");
      const schoolLng = parseFloat(gpsSettings?.clock_longitude || "0");
      const radius = parseFloat(gpsSettings?.clock_radius || "200");

      let userLat = 0, userLng = 0;
      if (enforceGps && schoolLat && schoolLng) {
        try {
          const pos = await getCurrentPosition();
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          const dist = calcDistance(userLat, userLng, schoolLat, schoolLng);
          if (dist > radius) {
            setClockError({
              kind: "range",
              title: "อยู่นอกพิกัดที่กำหนด",
              message: `คุณอยู่ห่างจากจุดลงเวลา ${Math.round(dist)} เมตร (อนุญาตไม่เกิน ${radius} เมตร) กรุณาเดินเข้ามาในพื้นที่แล้วกด "ลองใหม่"`,
            });
            setSaving(false);
            return;
          }
        } catch {
          setClockError({
            kind: "gps",
            title: "ไม่สามารถดึงตำแหน่ง GPS",
            message: "กรุณาเปิดการเข้าถึงตำแหน่ง (Location) ในเบราว์เซอร์/อุปกรณ์ แล้วกด \"ลองใหม่\"\n\nหรือให้ผู้ดูแลปิดสวิตช์บังคับใช้ GPS ในหน้า \"ตำแหน่งและรัศมีโรงเรียน\" หากพื้นที่นี้สัญญาณ GPS ไม่นิ่ง",
          });
          setSaving(false);
          return;
        }
      } else if (!enforceGps && schoolLat && schoolLng) {
        // ปิดบังคับ GPS — พยายามอ่านพิกัดเพื่อเก็บ log แต่ไม่บล็อกถ้าอ่านไม่ได้
        try {
          const pos = await getCurrentPosition();
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
        } catch { /* เงียบ */ }
      } else {
        setClockError({
          kind: "gps",
          title: "ยังไม่ได้ตั้งค่าพิกัดโรงเรียน",
          message: "ระบบยังไม่ได้กำหนดพิกัดที่อนุญาตให้ลงเวลา กรุณาติดต่อผู้ดูแลระบบ",
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
          .single();

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

  // นาทีขั้นต่ำที่ต้องผ่านระหว่างเวลาเข้า → เวลาออก (กันลงเข้า-ออกในวินาทีเดียวกัน)
  const MIN_WORK_MINUTES = Number(gpsSettings?.clock_min_work_minutes || 60);

  const saveClockRecord = async (target: any, userLat: number, userLng: number) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const threshold = gpsSettings?.clock_late_threshold || "08:30";
    const clockStatus = currentTimeStr > threshold ? "late" : "normal";

    // กฎเวลา (ดึงจากตั้งค่าระบบ)
    const inStart = gpsSettings?.clock_in_start || "07:00";
    const inEnd = gpsSettings?.clock_in_end || "08:30";
    const outStart = gpsSettings?.clock_out_start || "15:30";
    const outEnd = gpsSettings?.clock_out_end || "17:00";

    // ใช้วันที่ตามเขตเวลา Asia/Bangkok ให้ตรงกับ myTodayRecord (กันบั๊กกรณีลงเวลาเข้าช่วงเช้ามืดแล้ว UTC ยังเป็นวันก่อน ทำให้หาเรคคอร์ดวันนี้ไม่เจอตอนลงเวลาออก)
    const today = todayBangkok();

    // Check if already clocked in today
    const { data: existing } = await supabase.from("time_clock")
      .select("id, clock_in, clock_out")
      .eq("personnel_id", target.id)
      .eq("clock_date", today)
      .maybeSingle();

    if (existing) {
      if (existing.clock_out) {
        swal.toast.info("คุณลงเวลาเข้า-ออกครบแล้ววันนี้");
        return;
      }
      // ── เงื่อนไขลงเวลาออก ──
      // 1) ต้องอยู่ในช่วงเวลาเลิกงานที่กำหนด
      if (currentTimeStr < outStart || currentTimeStr > outEnd) {
        throw new Error(`อยู่นอกช่วงเวลาลงเวลาออก (อนุญาต ${outStart} - ${outEnd} น.) — เวลาปัจจุบัน ${currentTimeStr} น.`);
      }
      // 2) ต้องผ่านเวลาเข้างานมาแล้วอย่างน้อย MIN_WORK_MINUTES นาที
      const inAt = new Date(existing.clock_in as any);
      const diffMin = Math.floor((now.getTime() - inAt.getTime()) / 60000);
      if (diffMin < MIN_WORK_MINUTES) {
        const remain = MIN_WORK_MINUTES - diffMin;
        throw new Error(`ยังไม่สามารถลงเวลาออกได้ — ต้องผ่านเวลาเข้างานอย่างน้อย ${MIN_WORK_MINUTES} นาที (เหลืออีก ${remain} นาที)`);
      }
      // Upload clock-out photo
      const outPhotoUrl = await uploadPhoto(capturedPhoto!, target.employee_code || target.id, "out");
      // Clock out
      const { error } = await supabase.from("time_clock")
        .update({
          clock_out: now.toISOString(),
          notes: `ออกงาน ${currentTimeStr} น.`,
          clock_out_photo_url: outPhotoUrl,
        } as any)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      swal.toast.success(`ลงเวลาออกสำเร็จ! เวลา ${currentTimeStr} น.`);
    } else {
      // ── เงื่อนไขลงเวลาเข้า ──
      // ต้องอยู่ในช่วง inStart..outStart (เลย inEnd ถือว่าสาย แต่ยังให้ลงได้)
      if (currentTimeStr < inStart) {
        throw new Error(`ยังไม่ถึงเวลาลงเวลาเข้า — เริ่ม ${inStart} น. (ปัจจุบัน ${currentTimeStr} น.)`);
      }
      if (currentTimeStr > outStart) {
        throw new Error(`เลยช่วงลงเวลาเข้าแล้ว (${inStart} - ${outStart} น.) — กรุณาติดต่อผู้ดูแลระบบ`);
      }
      // Upload clock-in photo
      const inPhotoUrl = await uploadPhoto(capturedPhoto!, target.employee_code || target.id, "in");
      // Clock in
      const { error } = await supabase.from("time_clock").insert({
        personnel_id: target.id,
        clock_date: today,
        clock_in: now.toISOString(),
        status: clockStatus,
        clock_lat: userLat,
        clock_lng: userLng,
        gps_verified: true,
        notes: `เข้างาน ${currentTimeStr} น.`,
        clock_in_photo_url: inPhotoUrl,
      } as any);
      if (error) throw new Error(error.message);
      swal.toast.success(`ลงเวลาเข้าสำเร็จ! เวลา ${currentTimeStr} น. สถานะ: ${STATUS_MAP[clockStatus]?.label}`);
    }

    // Reset photo + camera
    setCapturedPhoto(null);
    stopCamera();
    qc.invalidateQueries({ queryKey: ["time_clock"] });
  };


  // Off-site clock-in: bypasses GPS, requires reason + location, photo still recommended
  const handleOffsiteClockIn = async () => {
    if (!myPersonnel?.id) { toast.error("ไม่พบข้อมูลบุคลากร"); return; }
    if (!offsiteReason.trim()) { toast.error("กรุณาระบุเหตุผล/หมายเหตุ"); return; }
    if (!offsiteLocation.trim()) { toast.error("กรุณาระบุสถานที่"); return; }
    if (!capturedPhoto) { toast.error("กรุณาถ่ายภาพยืนยันก่อนลงเวลา"); return; }
    setSaving(true);
    try {
      const now = new Date();
      const today = todayBangkok();
      const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const photoUrl: string | null = await uploadPhoto(
        capturedPhoto, myPersonnel.employee_code || myPersonnel.id, "in"
      );

      const { data: existing } = await supabase.from("time_clock")
        .select("id, clock_in, clock_out")
        .eq("personnel_id", myPersonnel.id)
        .eq("clock_date", today)
        .maybeSingle();

      if (existing && !existing.clock_out) {
        // กันลงเข้า-ออกในเวลาเดียวกัน — ต้องผ่านอย่างน้อย MIN_WORK_MINUTES นาที
        const inAt = new Date(existing.clock_in as any);
        const diffMin = Math.floor((now.getTime() - inAt.getTime()) / 60000);
        if (diffMin < MIN_WORK_MINUTES) {
          toast.error(`ยังไม่สามารถลงเวลาออกได้ — ต้องผ่านเวลาเข้าอย่างน้อย ${MIN_WORK_MINUTES} นาที (เหลืออีก ${MIN_WORK_MINUTES - diffMin} นาที)`);
          return;
        }
        const { error } = await supabase.from("time_clock").update({
          clock_out: now.toISOString(),
          clock_out_photo_url: photoUrl,
          notes: `ออกงานนอกสถานที่ ${currentTimeStr} น. - ${offsiteReason}`,
        } as any).eq("id", existing.id);
        if (error) throw error;
        swal.toast.success("ลงเวลาออก (นอกสถานที่) สำเร็จ");
      } else if (!existing) {
        const { error } = await supabase.from("time_clock").insert({
          personnel_id: myPersonnel.id,
          clock_date: today,
          clock_in: now.toISOString(),
          status: "official",
          is_offsite: true,
          offsite_reason: offsiteReason,
          offsite_location: offsiteLocation,
          gps_verified: false,
          notes: `ลงเวลา ณ ${offsiteLocation} - ${offsiteReason}`,
          clock_in_photo_url: photoUrl,
        } as any);
        if (error) throw error;
        swal.toast.success("ลงเวลานอกสถานที่สำเร็จ");
      } else {
        swal.toast.info("ลงเวลาเข้า-ออกครบแล้ววันนี้");
      }

      setOffsiteOpen(false);
      setOffsiteReason("");
      setOffsiteLocation("");
      setCapturedPhoto(null);
      stopCamera();
      qc.invalidateQueries({ queryKey: ["time_clock"] });
    } catch (e: any) {
      toast.error(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("time_clock").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="clock"><MapPin className="w-4 h-4 mr-2" />ลงเวลา (GPS)</TabsTrigger>
          <TabsTrigger value="offsite"><FileText className="w-4 h-4 mr-2" />คำขอนอกสถานที่ / ไปราชการ</TabsTrigger>
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
                <div className="mx-auto max-w-md p-3 rounded-xl bg-success-soft dark:bg-success/20 border border-success/30 dark:border-success/30">
                  <div className="flex items-center gap-2 text-success dark:text-success">
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
                      <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-success/30">
                        <img src={capturedPhoto} alt="ภาพลงเวลา" className="w-full h-full object-cover" />
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
                  <div className="w-full max-w-md rounded-2xl border-2 border-success/30 bg-success-soft dark:bg-success/30 dark:border-success/30 p-6 text-center space-y-2">
                    <CheckCircle className="w-12 h-12 text-success mx-auto" />
                    <p className="font-semibold text-success dark:text-success">ลงเวลาเข้า-ออกครบแล้ววันนี้</p>
                    <p className="text-sm text-muted-foreground">
                      เข้า {formatTime(myTodayRecord.clock_in)} น. · ออก {formatTime(myTodayRecord.clock_out)} น.
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleClockIn}
                    size="lg"
                    disabled={saving || !capturedPhoto}
                    className="bg-success hover:bg-success text-white h-16 px-10 text-base"
                  >
                    {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                    {saving
                      ? "กำลังบันทึก..."
                      : myTodayRecord && !myTodayRecord.clock_out
                        ? "ลงเวลาออก (GPS)"
                        : "ลงเวลาเข้า (GPS)"}
                  </Button>
                )}

                {/* Off-site clock-in button (skips GPS) */}
                {!isAdmin && myPersonnel && !myTodayRecord?.clock_out && (
                  <Button
                    onClick={() => setOffsiteOpen(true)}
                    size="lg"
                    variant="outline"
                    className="border-info/30 text-info hover:bg-info-soft dark:hover:bg-info/30 h-14 px-8"
                  >
                    <Briefcase className="w-5 h-5 mr-2" />
                    ลงเวลานอกสถานที่ / ไปราชการ
                  </Button>
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

        {/* Off-site requests Tab */}
        <TabsContent value="offsite">
          <OffsiteRequestsTab isAdmin={isAdmin} myPersonnel={myPersonnel} />
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
                              <img src={r.clock_in_photo_url} alt="เข้า" className="w-10 h-10 rounded object-cover border" />
                            </a>
                          )}
                          {r.clock_out_photo_url && (
                            <a href={r.clock_out_photo_url} target="_blank" rel="noopener noreferrer">
                              <img src={r.clock_out_photo_url} alt="ออก" className="w-10 h-10 rounded object-cover border" />
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
                    <div className="p-3 rounded-lg border bg-success/50 dark:bg-success/10 space-y-3">
                      <p className="text-sm font-semibold text-success dark:text-success">⏰ ช่วงเวลาเข้างาน</p>
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

                    <div className="p-3 rounded-lg border bg-warning/50 dark:bg-warning/10 space-y-3">
                      <p className="text-sm font-semibold text-warning dark:text-warning">⏱️ เกณฑ์มาสาย</p>
                      <div>
                        <Label className="text-xs">หลังเวลานี้ถือว่ามาสาย</Label>
                        <Time24Input value={lateThreshold} onChange={(v) => setLateThreshold(v)} />
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-info/50 dark:bg-info/10 space-y-3">
                      <p className="text-sm font-semibold text-info dark:text-info">🏠 ช่วงเวลาออกงาน</p>
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

      {/* Off-site clock-in dialog */}
      <Dialog open={offsiteOpen} onOpenChange={(o) => { setOffsiteOpen(o); if (!o) { setCapturedPhoto(null); stopCamera(); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-info" />ลงเวลานอกสถานที่</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              ใช้สำหรับลงเวลากรณีไปราชการหรือปฏิบัติงานนอกพื้นที่โรงเรียน (ระบบจะข้ามการตรวจสอบ GPS แต่ต้องถ่ายภาพยืนยันทุกครั้ง ทั้งเข้าและออก)
            </p>
            <div>
              <Label>เหตุผล / หมายเหตุ *</Label>
              <Select value={offsiteReason} onValueChange={setOffsiteReason}>
                <SelectTrigger><SelectValue placeholder="เลือกเหตุผล" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ไปราชการ">ไปราชการ</SelectItem>
                  <SelectItem value="ประชุมนอกสถานที่">ประชุมนอกสถานที่</SelectItem>
                  <SelectItem value="อบรม/สัมมนา">อบรม/สัมมนา</SelectItem>
                  <SelectItem value="พานักเรียนไปกิจกรรม">พานักเรียนไปกิจกรรม</SelectItem>
                  <SelectItem value="เยี่ยมบ้านนักเรียน">เยี่ยมบ้านนักเรียน</SelectItem>
                  <SelectItem value="ปฏิบัติงานนอกพื้นที่">ปฏิบัติงานนอกพื้นที่</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                className="mt-2"
                placeholder="หรือพิมพ์เหตุผลเพิ่มเติม..."
                value={offsiteReason}
                onChange={(e) => setOffsiteReason(e.target.value)}
              />
            </div>
            <div>
              <Label>สถานที่ *</Label>
              <Input
                placeholder="เช่น สพป.เขต 1 / โรงแรม XYZ"
                value={offsiteLocation}
                onChange={(e) => setOffsiteLocation(e.target.value)}
              />
            </div>

            {/* Camera / Photo — required */}
            <div className="space-y-2">
              <Label>ภาพยืนยัน * {myTodayRecord && !myTodayRecord.clock_out ? "(สำหรับลงเวลาออก)" : "(สำหรับลงเวลาเข้า)"}</Label>
              {!cameraOpen && !capturedPhoto && (
                <Button type="button" onClick={startCamera} variant="outline" className="w-full h-12">
                  <Camera className="w-4 h-4 mr-2" />เปิดกล้องเพื่อถ่ายภาพ
                </Button>
              )}
              {cameraOpen && !capturedPhoto && (
                <div className="space-y-2">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-black border-2 border-primary/30">
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" /> กำลังเปิดกล้อง...
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => capturePhoto()} disabled={!cameraReady} className="flex-1">
                      <Camera className="w-4 h-4 mr-2" />ถ่ายภาพ
                    </Button>
                    <Button type="button" onClick={stopCamera} variant="outline" size="icon">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {capturedPhoto && (
                <div className="space-y-2">
                  <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-success/30">
                    <img src={capturedPhoto} alt="ภาพยืนยัน" className="w-full h-full object-cover" />
                  </div>
                  <Button type="button" onClick={() => { setCapturedPhoto(null); startCamera(); }} variant="outline" className="w-full">
                    <Camera className="w-4 h-4 mr-2" />ถ่ายใหม่
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOffsiteOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleOffsiteClockIn} disabled={saving || !capturedPhoto} className="bg-info hover:bg-info">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {myTodayRecord && !myTodayRecord.clock_out ? "ลงเวลาออก" : "ลงเวลาเข้า"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeClockPage;
