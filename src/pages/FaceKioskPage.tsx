import { useCallback, useEffect, useRef, useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { openCamera, stopStream } from "@/lib/cameraStream";

import { attachNetworkCamera, validateStreamUrl, describeStreamKind, classifyStreamUrl, testStreamUrl, type NetworkCameraHandle } from "@/lib/networkCamera";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  loadFaceModels, getAllDescriptors, matchDescriptor, drawFaceFrame,
  detectorOptionsHQ, applyCameraAutoTune, preprocessFrame, estimateFaceSharpness,
  type KnownFace,
} from "@/lib/faceApi";
import { learnFromScan } from "@/lib/faceLearning";
import { playSuccessSound, playDuplicateSound, playUnknownSound, speakText } from "@/lib/faceScanAudio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Camera, X, Maximize, ScanFace, Users, Wifi, WifiOff, Settings as SettingsIcon, MapPin, Cctv, QrCode, LogIn, LogOut, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSchoolSetting } from "@/hooks/useSchoolSetting";
import { useSchoolGeofence, calcDistanceMeters, getCurrentCoords } from "@/hooks/useSchoolGeofence";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { CheckCircle2 } from "lucide-react";
import { uploadFaceScanSnapshot } from "@/lib/faceScanUpload";
import { useAutoScanMode } from "@/hooks/useAutoScanMode";
import KioskScreensaver from "@/components/facescan/KioskScreensaver";
import KioskHelloAi from "@/components/facescan/KioskHelloAi";
import { useCmsValues } from "@/hooks/useCmsSettings";
import { wakeKioskScreen } from "@/lib/kioskWake";
import { getRegisteredFaceImage } from "@/lib/registeredFace";
import { saveErrorMessage } from "@/lib/saveError";

// ===== Helper: hex → rgba with alpha (สำหรับใช้ theme สีจาก CMS) =====
const hexA = (hex: string, a: number): string => {
  const m = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(hex || "");
  if (!m) return `rgba(0,0,0,${a})`;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

interface RecentScan {
  studentId: string;
  studentCode: string;
  name: string;
  classroom: string;
  avatar?: string | null;
  capturedFace?: string;
  time: string;
  confidence: number;
  scanType?: "entry" | "exit";
}

// ScanMode type is provided by useAutoScanMode

type CamMode = "standard" | "wide" | "network";

const NETWORK_CAM_URL_KEY = "face_kiosk_network_url";

const FaceKioskPage = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const duplicateNoticeRef = useRef<Map<string, number>>(new Map());
  const justScannedRef = useRef<Map<string, number>>(new Map());
  // ยืนยันตัวตน: ต้องเจอ student คนเดิมติดกันอย่างน้อย N เฟรม ภายในเวลาที่กำหนด ก่อนบันทึก
  const confirmRef = useRef<Map<string, { count: number; lastTs: number }>>(new Map());
  const unknownBeepRef = useRef<number>(0);
  const lastDetectedAtRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<number | null>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const seenTodayRef = useRef<{ entry: Set<string>; exit: Set<string> }>({ entry: new Set(), exit: new Set() });

  const [streaming, setStreaming] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelStatus, setModelStatus] = useState("กำลังโหลดโมเดล...");
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [lastMatch, setLastMatch] = useState<{
    name: string; studentCode: string; classroom: string; confidence: number;
    scanType: "entry" | "exit"; capturedFace?: string; registeredFace?: string | null; time: string;
  } | null>(null);
  const matchTimerRef = useRef<number | null>(null);
  const [todayCounts, setTodayCounts] = useState<{ entry: number; exit: number }>({ entry: 0, exit: 0 });
  // โหมด QR เท่านั้น — ไม่โหลด/รันโมเดลใบหน้า ประหยัด CPU สำหรับเครื่องสเปกต่ำ (Pavilion x2 / Atom / Celeron)
  const [qrOnly, setQrOnly] = useState<boolean>(() => localStorage.getItem("face_kiosk_qr_only") === "1");
  useEffect(() => { localStorage.setItem("face_kiosk_qr_only", qrOnly ? "1" : "0"); }, [qrOnly]);
  const { selection: scanModeSelection, setSelection: setScanModeSelection, effective: scanMode, effectiveRef: scanModeRef, cutoff: modeCutoff, checkWindow, entryWindow, exitWindow } = useAutoScanMode();
  const [camMode, setCamMode] = useState<CamMode>("standard");
  const [screensaver, setScreensaver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(new Date());
  const [savedPos, setSavedPos] = useState({ x: 50, y: 50 });
  const [faceCount, setFaceCount] = useState(0);
  const [networkUrl, setNetworkUrl] = useState<string>(() => localStorage.getItem(NETWORK_CAM_URL_KEY) || "");
  const [netStatus, setNetStatus] = useState<string>("");
  const [netTesting, setNetTesting] = useState(false);
  const netCamRef = useRef<NetworkCameraHandle | null>(null);


  const { value: thresholdSetting } = useSchoolSetting("face_scan_threshold");
  const { value: voiceSetting } = useSchoolSetting("face_scan_voice");
  const { value: idleSecSetting } = useSchoolSetting("kiosk_idle_timeout_sec");
  const { value: helloAiSetting } = useSchoolSetting("kiosk_hello_ai_enabled");
  const { value: powerSaveSetting } = useSchoolSetting("kiosk_power_save");
  const { value: wakeWordSetting } = useSchoolSetting("kiosk_wake_word_enabled");
  const threshold = parseFloat(thresholdSetting || "0.48");
  const voiceEnabled = voiceSetting !== "false";
  const idleMs = Math.max(15, parseInt(idleSecSetting || "60", 10) || 60) * 1000;
  const helloAiEnabled = helloAiSetting !== "false";
  const powerSave = powerSaveSetting !== "false";
  const wakeWordEnabled = wakeWordSetting !== "false";
  const [helloAiOpen, setHelloAiOpen] = useState(false);
  const [helloAiAutoListen, setHelloAiAutoListen] = useState(false);
  const geofence = useSchoolGeofence();
  const [geoStatus, setGeoStatus] = useState<{ ok: boolean; distance: number | null }>({ ok: !geofence.configured, distance: null });
  const { schoolName, schoolLogo } = useSystemSettings();

  // ===== ธีมสีจาก CMS (theme_primary_color = สีหลัก/แถบเข้า, theme_accent_color = สีรอง/พื้นหลัง/แถบออก) =====
  const cmsColors = useCmsValues(["theme_primary_color", "theme_accent_color"]);
  const themePrimary = /^#?[0-9a-f]{3,6}$/i.test(cmsColors.theme_primary_color || "") ? cmsColors.theme_primary_color : "#059669"; // emerald-600
  const themeAccent = /^#?[0-9a-f]{3,6}$/i.test(cmsColors.theme_accent_color || "") ? cmsColors.theme_accent_color : "#ec4899"; // pink-500
  const pageBgStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${hexA(themeAccent, 0.08)} 0%, ${hexA(themeAccent, 0.12)} 50%, ${hexA(themeAccent, 0.2)} 100%)`,
  };
  const headerBannerStyle: React.CSSProperties = {
    background: `linear-gradient(90deg, ${hexA(themePrimary, 0.1)} 0%, ${hexA(themePrimary, 0.14)} 50%, ${hexA(themePrimary, 0.22)} 100%)`,
    borderBottom: `2px solid ${hexA(themePrimary, 0.35)}`,
  };
  const cameraPanelStyle: React.CSSProperties = { border: `2px solid ${hexA(themeAccent, 0.35)}` };
  const sidePanelStyle: React.CSSProperties = { border: `2px solid ${hexA(themeAccent, 0.35)}` };
  const sideHeaderStyle: React.CSSProperties = {
    backgroundColor: hexA(themeAccent, 0.18),
    borderBottom: `1px solid ${hexA(themeAccent, 0.3)}`,
    color: themeAccent,
  };
  const bottomBarStyle: React.CSSProperties = {
    background: `linear-gradient(to top, ${hexA(themeAccent, 0.4)} 0%, transparent 100%)`,
  };
  const clockCardStyle: React.CSSProperties = { border: `2px solid ${hexA(themePrimary, 0.5)}` };


  const verifyLocation = useCallback(async (): Promise<boolean> => {
    if (!geofence.configured) {
      setGeoStatus({ ok: true, distance: null });
      return true;
    }
    try {
      const { lat, lng, accuracy } = await getCurrentCoords();
      const dist = calcDistanceMeters(lat, lng, geofence.lat, geofence.lng);
      // หัก margin ความคลาดเคลื่อนของ GPS (สำคัญเมื่อใช้ WiFi positioning)
      const effective = Math.max(0, dist - (accuracy || 0));
      const ok = effective <= geofence.radius;
      setGeoStatus({ ok, distance: dist });
      if (!ok) {
        toast.error("อยู่นอกพื้นที่โรงเรียน", {
          description: `ห่าง ${Math.round(dist)} ม. (±${Math.round(accuracy)} ม.) เกินรัศมี ${geofence.radius} ม.`,
        });
      }
      return ok;
    } catch {
      setGeoStatus({ ok: false, distance: null });
      toast.error("ไม่สามารถอ่านตำแหน่ง GPS", { description: "กรุณาเปิดอนุญาตตำแหน่ง" });
      return false;
    }
  }, [geofence.configured, geofence.lat, geofence.lng, geofence.radius]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!screensaver) return;
    const t = setInterval(() => {
      setSavedPos({ x: Math.random() * 60 + 20, y: Math.random() * 60 + 20 });
    }, 30_000);
    return () => clearInterval(t);
  }, [screensaver]);

  const [staffFaceEnabled, setStaffFaceEnabled] = useState<boolean>(() => localStorage.getItem("face_kiosk_staff_faces") !== "0");
  useEffect(() => { localStorage.setItem("face_kiosk_staff_faces", staffFaceEnabled ? "1" : "0"); }, [staffFaceEnabled]);

  const { data: known = [] } = useQuery({
    queryKey: ["face-known-kiosk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_face_descriptors")
        .select("student_id, descriptor, face_image, quality_score, students!inner(id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name))");
      if (error) throw error;
      const map = new Map<string, KnownFace & { name: string; classroom: string; avatar?: string | null; studentCode: string; registeredFace?: string | null }>();
      for (const row of data as any[]) {
        const id = row.student_id;
        const s = row.students;
        const name = `${s.prefix || ""}${s.first_name} ${s.last_name}`.trim();
        const cls = s.classrooms ? `${s.classrooms.grade_level || ""}/${s.classrooms.name || ""}` : "-";
        const existing = map.get(id);
        if (existing) {
          existing.descriptors.push(row.descriptor as number[]);
          if (!existing.registeredFace && row.face_image) existing.registeredFace = row.face_image;
        } else {
          map.set(id, {
            studentId: id, descriptors: [row.descriptor as number[]], name, classroom: cls,
            avatar: s.photo_url, studentCode: s.student_code || "",
            registeredFace: row.face_image || null,
          });
        }
      }
      return Array.from(map.values());
    },
    staleTime: 60_000,
  });

  // ===== ใบหน้าบุคลากร (โหมดทดสอบ) — จำได้แต่ไม่บันทึกเวลามาเรียน =====
  const { data: staffKnown = [] } = useQuery({
    queryKey: ["face-known-kiosk-staff"],
    enabled: staffFaceEnabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("personnel_face_descriptors")
        .select("personnel_id, descriptor, face_image, personnel!inner(id, prefix, first_name, last_name, employee_code, position)");
      if (error) throw error;
      const map = new Map<string, any>();
      for (const row of (data as any[]) || []) {
        const id = row.personnel_id;
        const p = row.personnel;
        const existing = map.get(id);
        if (existing) {
          existing.descriptors.push(row.descriptor as number[]);
          if (!existing.registeredFace && row.face_image) existing.registeredFace = row.face_image;
        } else map.set(id, {
          studentId: id,
          descriptors: [row.descriptor as number[]],
          name: `${p.prefix || ""}${p.first_name} ${p.last_name}`.trim(),
          classroom: p.position || "บุคลากร",
          avatar: row.face_image || null,
          registeredFace: row.face_image || null,
          studentCode: p.employee_code || "",
          isStaff: true,
        });
      }
      return Array.from(map.values());
    },
    staleTime: 60_000,
  });

  const matchKnown = staffFaceEnabled ? ([...(known as any[]), ...(staffKnown as any[])] as any[]) : (known as any[]);


  useEffect(() => {
    (async () => {
      const today = todayBangkok();
      const { data } = await supabase.from("face_scan_logs")
        .select("student_id, scan_type").eq("scan_date", today);
      const entrySet = new Set<string>();
      const exitSet = new Set<string>();
      for (const r of (data || []) as any[]) {
        if (!r.student_id) continue;
        if (r.scan_type === "exit") exitSet.add(r.student_id);
        else entrySet.add(r.student_id);
      }
      seenTodayRef.current = { entry: entrySet, exit: exitSet };
      setTodayCounts({ entry: entrySet.size, exit: exitSet.size });
    })();
  }, []);

  useEffect(() => {
    if (qrOnly) {
      setModelStatus("โหมด QR เท่านั้น — ประหยัด CPU");
      setModelReady(false);
      return;
    }
    loadFaceModels(setModelStatus).then(() => setModelReady(true))
      .catch((e) => setModelStatus("โหลดล้มเหลว: " + e.message));
  }, [qrOnly]);

  // เปิดกล้องอัตโนมัติเมื่อพร้อม — ผู้ใช้ไม่ต้องกดปุ่ม "เปิดกล้อง" เอง
  // (QR-only: เปิดได้เลย, Face mode: รอ modelReady ก่อน)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (streaming) { autoStartedRef.current = true; return; }
    if (!qrOnly && !modelReady) return;
    autoStartedRef.current = true;
    startCamera().catch(() => { autoStartedRef.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOnly, modelReady, streaming]);


  const startCamera = useCallback(async (mode: CamMode = camMode) => {
    const ok = await verifyLocation();
    if (!ok) return;
    try {
      // Cleanup previous stream/HLS
      const prev = videoRef.current?.srcObject as MediaStream | null;
      prev?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      if (netCamRef.current) { netCamRef.current.destroy(); netCamRef.current = null; }
      if (videoRef.current) videoRef.current.removeAttribute("src");

      // === Network camera (RTSP via HLS gateway, MJPEG, MP4) ===
      if (mode === "network") {
        const url = networkUrl.trim();
        const problem = validateStreamUrl(url);
        if (problem) { toast.error(problem, { duration: 8000 }); return; }
        if (!videoRef.current) return;
        netCamRef.current = await attachNetworkCamera(videoRef.current, url, {
          onStatus: (m) => { setNetStatus(m); toast.message(m); },
          onFatal: (m) => { setNetStatus(m); setStreaming(false); toast.error(`กล้องเครือข่ายหลุด: ${m}`, { duration: 10000 }); },
        });
        setNetStatus(`เชื่อมต่อแล้ว (${describeStreamKind(netCamRef.current.kind)})`);
        setStreaming(true);
        toast.success("เชื่อมต่อกล้องเครือข่ายสำเร็จ");
        return;
      }


      // === Local webcam (รองรับกล้อง USB / กล้องหน้า-หลังหลายรุ่น) ===
      const wide = mode === "wide";
      const res = await openCamera({
        facing: wide ? "environment" : "user",
        width: wide ? 1920 : 1280,
        height: wide ? 1080 : 720,
      });
      await applyCameraAutoTune(res.stream);
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, res.stream);
        setStreaming(true);
      } else {
        stopStream(res.stream);
      }
    } catch (e: any) {
      toast.error(e?.message || "เปิดกล้องไม่สำเร็จ");
    }

  }, [camMode, verifyLocation, networkUrl]);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
    if (netCamRef.current) { netCamRef.current.destroy(); netCamRef.current = null; }
    setNetStatus("");
    setStreaming(false);
  }, []);

  const switchCamMode = async (mode: CamMode) => {
    setCamMode(mode);
    if (streaming) await startCamera(mode);
  };

  // ตรวจ GPS ซ้ำทุก 2 นาที ปิดกล้องถ้าออกนอกรัศมี
  useEffect(() => {
    if (!streaming || !geofence.configured) return;
    const t = setInterval(async () => {
      const ok = await verifyLocation();
      if (!ok) stopCamera();
    }, 120_000);
    return () => clearInterval(t);
  }, [streaming, geofence.configured, verifyLocation, stopCamera]);

  const recordScan = useCallback(async (
    studentId: string, studentCode: string, name: string, classroom: string, avatar: string | null, confidence: number, capturedFace?: string,
    enrolledFace?: string | null,
  ) => {
    const now = Date.now();
    const mode = scanModeRef.current;
    const modeLabel = mode === "exit" ? "ออก" : "เข้า";
    // Kiosk ในตู้ล็อก: ปลุกจอ (DPMS) ผ่าน local daemon เมื่อเจอคนสแกน
    wakeKioskScreen();
    const win = checkWindow(mode);
    if (win.allowed === false) {
      const wkey = `${studentId}:window`;
      const lastNotice = duplicateNoticeRef.current.get(wkey) || 0;
      if (now - lastNotice > 5_000) {
        duplicateNoticeRef.current.set(wkey, now);
        playDuplicateSound();
        toast.warning("ปฏิเสธการสแกน", { description: win.reason, duration: 2200 });
      }
      return;
    }
    const seenSet = mode === "exit" ? seenTodayRef.current.exit : seenTodayRef.current.entry;
    const cdKey = `${studentId}:${mode}`;
    if (seenSet.has(studentId)) {
      const lastNotice = duplicateNoticeRef.current.get(cdKey) || 0;
      if (now - lastNotice > 5_000) {
        duplicateNoticeRef.current.set(cdKey, now);
        playDuplicateSound();
        toast.info("สแกนซ้ำ", { description: `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, duration: 1800 });
      }
      justScannedRef.current.set(cdKey, now);
      cooldownRef.current.set(cdKey, now);
      return;
    }

    // ===== ป้องกันบันทึก "ออก" ใกล้เวลา "เข้า" เกินไป =====
    if (mode === "exit") {
      if (!seenTodayRef.current.entry.has(studentId)) {
        const wkey = `${studentId}:no-entry`;
        const lastNotice = duplicateNoticeRef.current.get(wkey) || 0;
        if (now - lastNotice > 5_000) {
          duplicateNoticeRef.current.set(wkey, now);
          playDuplicateSound();
          toast.warning("ปฏิเสธการสแกน", { description: `${name} ยังไม่ได้บันทึกเข้าโรงเรียนวันนี้`, duration: 2200 });
        }
        return;
      }
      // ดูเวลา entry ล่าสุดจาก DB เพื่อกัน race / state stale
      const { data: lastEntry } = await supabase.from("face_scan_logs")
        .select("scan_time").eq("student_id", studentId).eq("scan_date", todayBangkok())
        .eq("scan_type", "entry").order("scan_time", { ascending: false }).limit(1).maybeSingle();
      if (lastEntry?.scan_time) {
        const gapMin = (now - new Date(lastEntry.scan_time).getTime()) / 60000;
        if (gapMin < 30) {
          const wkey = `${studentId}:gap`;
          const lastNotice = duplicateNoticeRef.current.get(wkey) || 0;
          if (now - lastNotice > 5_000) {
            duplicateNoticeRef.current.set(wkey, now);
            playDuplicateSound();
            toast.warning("ปฏิเสธการสแกน", {
              description: `${name} เพิ่งสแกนเข้าเมื่อ ${Math.round(gapMin)} นาทีที่แล้ว — ต้องห่างอย่างน้อย 30 นาทีจึงสแกนออกได้`,
              duration: 2500,
            });
          }
          return;
        }
      }
    }


    const last = cooldownRef.current.get(cdKey) || 0;
    if (now - last < 30_000) {
      if (now - last > 2_000) playDuplicateSound();
      return;
    }
    cooldownRef.current.set(cdKey, now);

    const { data: { user } } = await supabase.auth.getUser();
    const uploadedFaceUrl = await uploadFaceScanSnapshot(capturedFace, studentId);
    const { data, error } = await supabase.from("face_scan_logs").insert({
      student_id: studentId, scan_type: mode, confidence,
      scanned_by: user?.id, device_label: `tablet-kiosk-${mode}`,
      captured_face_url: uploadedFaceUrl,
    }).select("id").maybeSingle();
    if (error) {
      if (error.code === "23505") {
        seenSet.add(studentId);
        playDuplicateSound();
        toast.info("สแกนซ้ำ", { description: `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, duration: 1800 });
        return;
      }
      toast.error(saveErrorMessage(error)); return;
    }
    if (!data) {
      seenSet.add(studentId);
      playDuplicateSound();
      toast.info("สแกนซ้ำ", { description: `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, duration: 1800 });
      return;
    }
    justScannedRef.current.set(cdKey, now);
    playSuccessSound();
    if (voiceEnabled) speakText(`สแกน${modeLabel}สำเร็จ ${name}`);
    if (!seenSet.has(studentId)) {
      seenSet.add(studentId);
      setTodayCounts((c) => ({ ...c, [mode]: c[mode] + 1 }));
    }
    // ใบหน้าที่ลงทะเบียนไว้ (ภาพตอนลงทะเบียน) — แสดงคู่กับใบหน้าที่สแกนได้
    const registeredFace = enrolledFace || (await getRegisteredFaceImage(studentId, avatar));
    setLastMatch({
      name, studentCode, classroom, confidence, scanType: mode,
      capturedFace, registeredFace,
      time: new Date().toLocaleTimeString("th-TH", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    });
    if (matchTimerRef.current) window.clearTimeout(matchTimerRef.current);
    matchTimerRef.current = window.setTimeout(() => setLastMatch(null), 6000);
    setRecent((r) => [{
      studentId, studentCode, name, classroom, avatar: registeredFace, capturedFace, confidence,
      time: new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      scanType: mode,
    }, ...r].slice(0, 10));
  }, [voiceEnabled]);

  useEffect(() => {
    if (!streaming || !modelReady || screensaver || qrOnly) return;
    let cancelled = false;
    // input ใหญ่ขึ้น = เก็บรายละเอียดใบหน้าได้มาก จับใบหน้าระยะไกล/เล็กได้ดี
    const opts = detectorOptionsHQ(camMode === "wide" ? 608 : 608, 0.35);
    // ขนาดใบหน้าขั้นต่ำ (พิกเซลในเฟรม) ป้องกัน descriptor เพี้ยนจากใบหน้าที่เล็กเกิน
    const MIN_FACE_PX = 70;
    // ระยะห่างระหว่าง best vs second-best ขั้นต่ำ — ยืนยันว่าระบุตัวตนได้ชัดเจน ไม่ไปทับคนอื่น
    const MIN_MARGIN = 0.04;
    // ความมั่นใจขั้นต่ำ (1 - distance) — ยืนยันเมื่อมั่นใจ ≥ 66%
    const MIN_CONFIDENCE = 0.66;
    // จำนวนเฟรมต่อเนื่องที่ต้องจับได้คนเดิม ก่อนบันทึก (กันบันทึกผิดจาก descriptor หลุด 1 เฟรม)
    const CONFIRM_FRAMES = 2;
    const CONFIRM_WINDOW_MS = 1500;

    const MIN_SHARPNESS = 70; // ใต้ค่านี้ = เบลอเกินไป ไม่บันทึก

    const snapCanvas = document.createElement("canvas");
    const captureFaceCrop = (video: HTMLVideoElement, box: { x: number; y: number; width: number; height: number }): string | undefined => {
      try {
        const pad = 0.25;
        const px = Math.max(0, box.x - box.width * pad);
        const py = Math.max(0, box.y - box.height * pad);
        const pw = Math.min(video.videoWidth - px, box.width * (1 + pad * 2));
        const ph = Math.min(video.videoHeight - py, box.height * (1 + pad * 2));
        const target = 160;
        snapCanvas.width = target; snapCanvas.height = target;
        const sctx = snapCanvas.getContext("2d");
        if (!sctx) return undefined;
        sctx.drawImage(video, px, py, pw, ph, 0, 0, target, target);
        return snapCanvas.toDataURL("image/jpeg", 0.8);
      } catch { return undefined; }
    };

    const loop = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        // ตรวจจับจากเฟรมที่ผ่าน preprocess (contrast/brightness) — ช่วยกล้องคุณภาพต่ำ
        const video = videoRef.current;
        const pre = preprocessFrame(video, { maxWidth: 960 }) || video;
        const detections = await getAllDescriptors(pre as any, opts);
        // อัตราส่วนสำหรับสเกล box กลับสู่พิกัดของวิดีโอจริง
        const srcW = pre instanceof HTMLCanvasElement ? pre.width : video.videoWidth;
        const scaleBack = video.videoWidth / Math.max(1, srcW);
        setFaceCount(detections.length);

        const canvas = overlayRef.current;
        if (canvas && video) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const tNow = Date.now();
            for (const [id, v] of confirmRef.current) {
              if (tNow - v.lastTs > CONFIRM_WINDOW_MS) confirmRef.current.delete(id);
            }
            await Promise.all(detections.map(async (det) => {
              // สเกล box จากพิกัด preprocess-canvas กลับสู่พิกัดวิดีโอจริง
              const rb = det.detection.box;
              const box = { x: rb.x * scaleBack, y: rb.y * scaleBack, width: rb.width * scaleBack, height: rb.height * scaleBack };
              const faceSize = Math.min(box.width, box.height);
              const tooSmall = faceSize < MIN_FACE_PX;
              // ประเมินความคมชัดของใบหน้าจริงในวิดีโอ — กล้องเบลอจะถูกปฏิเสธ
              const sharpness = estimateFaceSharpness(video, box);
              const tooBlurry = sharpness < MIN_SHARPNESS;

              const m = matchDescriptor(det.descriptor, matchKnown, threshold);
              const ambiguous = m.studentId != null && m.margin < MIN_MARGIN;
              const lowConfidence = m.studentId != null && m.confidence < MIN_CONFIDENCE;
              const matchedId = !tooSmall && !tooBlurry && !ambiguous && !lowConfidence ? m.studentId : null;
              const found = matchedId ? matchKnown.find((k: any) => k.studentId === matchedId) as any : null;
              const isStaffHit = !!found?.isStaff;

              const justScanned = found ? (tNow - (justScannedRef.current.get(found.studentId) || 0) < 3000) : false;
              const inCooldown = found ? (tNow - (cooldownRef.current.get(found.studentId) || 0) < 30_000) : false;
              const color = !found
                ? (tooSmall ? "#94a3b8" : tooBlurry ? "#64748b" : (ambiguous || lowConfidence) ? "#eab308" : "#f97316")
                : isStaffHit ? "#2563eb"
                : justScanned ? "#16a34a" : inCooldown ? "#10b981" : "#22c55e";

              const label = found
                ? `${isStaffHit ? "👤 " : ""}${found.name}${isStaffHit ? " (บุคลากร)" : justScanned ? " ✓ บันทึกแล้ว" : ""}`
                : tooSmall ? "ขยับเข้าใกล้กล้อง"
                : tooBlurry ? "ภาพเบลอ ให้นิ่งสักครู่"
                : ambiguous ? "กำลังยืนยันตัวตน..."
                : lowConfidence ? `มั่นใจ ${Math.round(m.confidence * 100)}% • ต้อง ≥ ${Math.round(MIN_CONFIDENCE * 100)}%`
                : "ไม่พบในระบบ";
              const sublabel = found
                ? isStaffHit
                  ? `บุคลากร ${found.studentCode || "-"} • ${found.classroom} • ${Math.round(m.confidence * 100)}% (ทดสอบ — ไม่บันทึก)`
                  : `เลขที่ ${found.studentCode || "-"} • ชั้น ${found.classroom} • ${Math.round(m.confidence * 100)}% (Δ${m.margin.toFixed(2)}, ช ${Math.round(sharpness)})`
                : tooSmall ? `ใบหน้าเล็ก ${Math.round(faceSize)}px`
                : tooBlurry ? `ความคมชัด ${Math.round(sharpness)} • ต้อง ≥ ${MIN_SHARPNESS}`
                : ambiguous ? `ห่าง ${m.margin.toFixed(2)} • ต้อง ≥ ${MIN_MARGIN}`
                : lowConfidence ? "ขยับเข้าใกล้/หันตรงกล้อง"
                : "กรุณาลงทะเบียน";

              drawFaceFrame(ctx, { box, label, sublabel, matched: !!found, confidence: m.confidence, color });


              if (found) {
                // นับเฟรมยืนยันก่อนบันทึก
                const c = confirmRef.current.get(found.studentId);
                if (c && tNow - c.lastTs <= CONFIRM_WINDOW_MS) {
                  c.count += 1; c.lastTs = tNow;
                } else {
                  confirmRef.current.set(found.studentId, { count: 1, lastTs: tNow });
                }
                const confirmed = (confirmRef.current.get(found.studentId)?.count ?? 0) >= CONFIRM_FRAMES;
                if (confirmed) {
                  const captured = captureFaceCrop(video, box);
                  if (isStaffHit) {
                    // โหมดทดสอบบุคลากร — แสดงผล/ทักทาย แต่ไม่บันทึกเวลามาเรียน
                    const last = justScannedRef.current.get(found.studentId) || 0;
                    if (tNow - last > 15_000) {
                      justScannedRef.current.set(found.studentId, tNow);
                      playSuccessSound();
                      if (voiceEnabled) speakText(`สวัสดี ${found.name}`);
                      setLastMatch({
                        name: found.name,
                        studentCode: found.studentCode || "-",
                        classroom: `${found.classroom} • บุคลากร (ทดสอบ)`,
                        confidence: m.confidence,
                        scanType: scanModeRef.current === "exit" ? "exit" : "entry",
                        capturedFace: captured,
                        registeredFace: (found as any).registeredFace || null,
                        time: new Date().toLocaleTimeString("th-TH"),
                      });
                      setRecent((prev) => [{
                        studentId: found.studentId,
                        studentCode: found.studentCode || "-",
                        name: `${found.name} (บุคลากร)`,
                        classroom: found.classroom,
                        avatar: (found as any).registeredFace || null,
                        capturedFace: captured,
                        time: new Date().toLocaleTimeString("th-TH"),
                        confidence: m.confidence,
                      }, ...prev].slice(0, 20));
                    }
                  } else {
                    await recordScan(found.studentId, found.studentCode, found.name, found.classroom, found.avatar, m.confidence, captured, (found as any).registeredFace);
                    // เรียนรู้ใบหน้าอัตโนมัติจากการสแกนจริงหน้าคีออส
                    learnFromScan({
                      studentId: found.studentId,
                      descriptor: det.descriptor,
                      match: m,
                      sharpness,
                      faceSize,
                      source: "kiosk",
                    }).catch(() => {});
                  }
                  confirmRef.current.delete(found.studentId);
                }
              } else {
                if (!tooSmall && !ambiguous && tNow - unknownBeepRef.current > 5000) {
                  unknownBeepRef.current = tNow;
                  playUnknownSound();
                }
              }
            }));
          }
        }
        if (detections.length > 0) lastDetectedAtRef.current = Date.now();
      } catch (e) {
        console.error("kiosk detect err", e);
      }
      if (!cancelled) detectionLoopRef.current = window.setTimeout(loop, 200);
    };
    loop();
    return () => {
      cancelled = true;
      if (detectionLoopRef.current) clearTimeout(detectionLoopRef.current);
    };
  }, [streaming, modelReady, screensaver, matchKnown, threshold, recordScan, camMode, qrOnly, voiceEnabled, scanModeRef]);

  // ===== QR Code fallback scan (รองรับกรณีสแกนหน้าไม่ติด) =====
  // อ่าน QR จากเฟรมวิดีโอเดียวกัน ใช้ native BarcodeDetector ถ้ามี
  // กันสแกนซ้ำผ่าน seenTodayRef + cooldownRef เดิม (รวมถึงเคสจับทั้งหน้า+QR พร้อมกัน)
  const qrCooldownRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!streaming || screensaver) return;
    // @ts-ignore — BarcodeDetector ยังไม่อยู่ใน TS lib มาตรฐาน
    const BD: any = (window as any).BarcodeDetector;
    const scanCanvas = document.createElement("canvas");
    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
    let jsQR: any = null;
    if (!BD) {
      import("jsqr").then(m => jsQR = m.default).catch(() => {});
    }
    let cancelled = false;
    let detector: any = null;
    if (BD) {
      try {
        detector = new BD({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
      } catch (e) {
        try { detector = new BD({ formats: ["qr_code"] }); } catch {}
      }
    }

    // map student_code -> student info สำหรับ lookup ไว
    const codeMap = new Map<string, any>();
    (known as any[]).forEach((k) => { if (k.studentCode) codeMap.set(String(k.studentCode).trim(), k); });

    const processCode = async (raw: string, tNow: number) => {
      if (!raw || raw.length < 3) return;
      if (/[\x00-\x1f]/.test(raw)) return;

      // ใช้ resolver กลาง — รองรับ student_code, UUID, URL /p/<auth_user_id>, /sdq-assess/<id>, ?code=xxx
      const { extractScannedCode, resolveScannedStudent } = await import("@/lib/resolveScannedStudent");
      const extracted = (extractScannedCode(raw) || raw).trim();
      if (!extracted || extracted.length < 3) return;

      // cooldown key ใช้ค่าที่ extract แล้ว เพื่อไม่ให้สแกน QR เดิมซ้ำถี่ๆ
      const lastQr = qrCooldownRef.current.get(extracted) || 0;
      if (tNow - lastQr < 3000) return;
      qrCooldownRef.current.set(extracted, tNow);

      // 1) ลอง match student_code ใน map ที่ preload ไว้ (เร็วสุด)
      let student = codeMap.get(extracted);

      // 2) ถ้าไม่เจอ ใช้ resolver ที่รองรับ URL/UUID
      if (!student) {
        const resolved = await resolveScannedStudent(raw);
        if (resolved) {
          const { data } = await supabase
            .from("students")
            .select("id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name)")
            .eq("id", resolved.id)
            .maybeSingle();
          if (data) {
            const cls = (data as any).classrooms ? `${(data as any).classrooms.grade_level || ""}/${(data as any).classrooms.name || ""}` : "-";
            student = {
              studentId: (data as any).id,
              studentCode: (data as any).student_code || extracted,
              name: `${(data as any).prefix || ""}${(data as any).first_name} ${(data as any).last_name}`.trim(),
              classroom: cls,
              avatar: (data as any).photo_url,
            };
          }
        }
      }

      if (!student) {
        if (tNow - unknownBeepRef.current > 4000) {
          unknownBeepRef.current = tNow;
          playUnknownSound();
          toast.error(`QR ไม่พบข้อมูลในระบบ (${extracted.slice(0, 20)})`, { duration: 1800 });
        }
        return;
      }

      await recordScan(student.studentId, student.studentCode, student.name, student.classroom, student.avatar || null, 1, undefined);
    };


    // ตรวจ CPU: navigator.hardwareConcurrency ≤ 4 = low-end (Atom/Celeron/RPi) → ลด passes
    const isLowEnd = (navigator.hardwareConcurrency || 4) <= 4;

    const scanJsQrMulti = (video: HTMLVideoElement): string[] => {
      if (!jsQR || !scanCtx || !video.videoWidth) return [];
      const W = video.videoWidth, H = video.videoHeight;
      // Low-end: 2 passes (เต็ม + กลาง) / High-end: 5 passes (เต็ม + 4 มุม)
      const passes = isLowEnd
        ? [
            { sx: 0, sy: 0, sw: W, sh: H, maxW: 640 },
            { sx: W * 0.2, sy: H * 0.2, sw: W * 0.6, sh: H * 0.6, maxW: 640 },
          ]
        : [
            { sx: 0, sy: 0, sw: W, sh: H, maxW: 800 },
            { sx: 0, sy: 0, sw: W * 0.55, sh: H * 0.55, maxW: 640 },
            { sx: W * 0.45, sy: 0, sw: W * 0.55, sh: H * 0.55, maxW: 640 },
            { sx: 0, sy: H * 0.45, sw: W * 0.55, sh: H * 0.55, maxW: 640 },
            { sx: W * 0.45, sy: H * 0.45, sw: W * 0.55, sh: H * 0.55, maxW: 640 },
          ];
      const found = new Set<string>();
      for (const p of passes) {
        const scale = Math.min(1, p.maxW / p.sw);
        const w = Math.max(1, Math.floor(p.sw * scale));
        const h = Math.max(1, Math.floor(p.sh * scale));
        scanCanvas.width = w; scanCanvas.height = h;
        scanCtx.imageSmoothingEnabled = false;
        scanCtx.drawImage(video, p.sx, p.sy, p.sw, p.sh, 0, 0, w, h);
        const img = scanCtx.getImageData(0, 0, w, h);
        const res = jsQR(img.data, w, h, { inversionAttempts: isLowEnd ? "dontInvert" : "attemptBoth" });
        if (res?.data) found.add(res.data);
      }
      return [...found];
    };

    const loop = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
        if (!cancelled) setTimeout(loop, 600);
        return;
      }
      try {
        let rawCodes: string[] = [];
        if (detector) {
          const codes = await detector.detect(videoRef.current);
          rawCodes = (codes || []).map((c: any) => String(c.rawValue || "").trim());
        } else {
          rawCodes = scanJsQrMulti(videoRef.current);
        }
        const tNow = Date.now();
        await Promise.all(rawCodes.map((r) => processCode(r, tNow)));
      } catch (e) {
        // ignore frame errors
      }
      // BarcodeDetector: 120ms / Desktop jsQR: 250ms / Low-end (Atom): 350ms
      const interval = detector ? 120 : (isLowEnd ? 350 : 250);
      if (!cancelled) setTimeout(loop, interval);
    };
    loop();


    return () => { cancelled = true; };
  }, [streaming, screensaver, known, recordScan]);



  // เช็คว่าตอนนี้ใกล้ "ช่วงเวลาสแกน" หรือไม่ (ก่อนเริ่ม ≤ 5 นาที หรืออยู่ในช่วง)
  const isNearScanWindow = useCallback(() => {
    const wins = [entryWindow, exitWindow].filter(Boolean) as Array<{ start: number; end: number }>;
    if (wins.length === 0) return false;
    // เวลาประเทศไทยปัจจุบัน → นาทีของวัน
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const mm = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const now = hh * 60 + mm;
    return wins.some((w) => now >= w.start - 5 && now < w.end);
  }, [entryWindow, exitWindow]);

  // เช็คว่าอยู่นอกช่วงเวลาสแกนทั้งหมดหรือไม่ (ถ้าตั้งช่วงเวลาไว้)
  const isOutsideAllScanWindows = useCallback(() => {
    const wins = [entryWindow, exitWindow].filter(Boolean) as Array<{ start: number; end: number }>;
    if (wins.length === 0) return false; // ไม่ได้ตั้ง = สแกนได้ตลอด → ไม่บังคับพัก
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const mm = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const now = hh * 60 + mm;
    // นอก "ทุก" หน้าต่าง (รวม buffer 5 นาทีก่อนเริ่ม)
    return wins.every((w) => now < w.start - 5 || now >= w.end);
  }, [entryWindow, exitWindow]);

  useEffect(() => {
    if (!streaming && !screensaver) return;
    const check = window.setInterval(() => {
      const idleFor = Date.now() - lastDetectedAtRef.current;
      const nearWin = isNearScanWindow();
      const outside = isOutsideAllScanWindows();
      // ปลุกหน้าจอเมื่อใกล้เวลาสแกน 5 นาที (หรืออยู่ในช่วง)
      if (nearWin && screensaver) {
        lastDetectedAtRef.current = Date.now();
        setScreensaver(false);
        // ถ้า power save ปิดกล้องไว้ → เปิดกลับเมื่อถึงเวลาสแกน
        if (powerSave && !streaming) startCamera().catch(() => {});
        return;
      }
      // นอกเวลาสแกนทั้งหมด → บังคับพักหน้าจอทันที
      if (outside && !screensaver && streaming) {
        setScreensaver(true);
        return;
      }
      // ไม่มีใบหน้า/แตะ นานเกินกำหนด = พักหน้าจอ (ห้ามพักช่วงใกล้เวลาสแกน)
      if (streaming && idleFor > idleMs && !screensaver && !nearWin) setScreensaver(true);
    }, 5_000);
    idleTimerRef.current = check;
    return () => clearInterval(check);
  }, [streaming, screensaver, isNearScanWindow, isOutsideAllScanWindows, idleMs, powerSave, startCamera]);

  // Power save: ปิดกล้อง+AI ระหว่างพักหน้าจอ (โน๊ตบุ๊คเก่า) — ปลุกเมื่อออกจาก screensaver
  useEffect(() => {
    if (!powerSave) return;
    if (screensaver && streaming) {
      stopCamera();
    }
  }, [screensaver, powerSave, streaming, stopCamera]);

  // Wake-loop: ตรวจใบหน้าเบา ๆ ตอนพักหน้าจอ (เฉพาะเมื่อไม่ได้ power save เพราะกล้องปิด)
  useEffect(() => {
    if (!screensaver) return;
    if (powerSave) return; // กล้องปิดอยู่ ใช้การแตะปลุกแทน
    if (!streaming || !modelReady) return;
    let cancelled = false;
    const opts = detectorOptionsHQ(320, 0.5);
    const wakeLoop = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const res = await getAllDescriptors(videoRef.current, opts);
        if (res.length > 0) {
          lastDetectedAtRef.current = Date.now();
          setScreensaver(false);
          return;
        }
      } catch { /* noop */ }
      if (!cancelled) setTimeout(wakeLoop, 2000);
    };
    wakeLoop();
    return () => { cancelled = true; };
  }, [screensaver, streaming, modelReady, powerSave]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  const wakeFromScreensaver = useCallback(() => {
    lastDetectedAtRef.current = Date.now();
    setScreensaver(false);
    // แตะปลุก → เปิดกล้องทันทีถ้ายังไม่ streaming (ไม่ว่าจะ powerSave หรือไม่)
    if (!streaming) {
      startCamera().catch(() => {});
    }
  }, [streaming, startCamera]);

  const handleTap = () => {
    lastDetectedAtRef.current = Date.now();
    if (screensaver) wakeFromScreensaver();
    else if (!streaming && (qrOnly || modelReady)) {
      // แตะที่หน้าตอนไม่ได้ screensaver แต่กล้องปิด → เปิดกล้องด้วย
      startCamera().catch(() => {});
    }
  };


  const outsideAll = isOutsideAllScanWindows();
  const screensaverReason = outsideAll ? "นอกช่วงเวลาสแกน" : "พักหน้าจออัตโนมัติ";

  return (
    <div className="fixed inset-0 text-slate-800 overflow-hidden select-none" style={pageBgStyle} onClick={handleTap}>
      {screensaver && (
        <KioskScreensaver
          onWake={wakeFromScreensaver}
          onHelloAi={helloAiEnabled ? (source) => {
            setHelloAiAutoListen(source === "voice");
            setHelloAiOpen(true);
          } : undefined}
          helloAiEnabled={helloAiEnabled}
          reasonLabel={screensaverReason}
          wakeWordEnabled={wakeWordEnabled}
          helloAiOpen={helloAiOpen}
        />
      )}

      <KioskHelloAi
        open={helloAiOpen}
        autoListen={helloAiAutoListen}
        onClose={() => { setHelloAiOpen(false); setHelloAiAutoListen(false); }}
      />

      {/* Mode toggle — เด่นชัดด้านบน เพื่อให้ครูประจำประตูสลับโหมดเข้า/ออก ได้เร็ว */}
      <div className="absolute top-2 left-2 z-40 flex items-center gap-1 bg-white/85 backdrop-blur-sm rounded-full p-1 border-2 border-white/70 shadow-md" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setScanModeSelection("auto")}
          title={`สลับเข้า/ออก อัตโนมัติที่เวลา ${modeCutoff} น. (ตอนนี้: ${scanMode === "exit" ? "ออก" : "เข้า"})`}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition ${scanModeSelection === "auto" ? (scanMode === "exit" ? "bg-rose-600 text-white shadow" : "bg-emerald-600 text-white shadow") : "text-slate-600 hover:bg-slate-100"}`}
        >
          <Clock className="w-4 h-4" /> เข้า-ออก อัตโนมัติ
          {scanModeSelection === "auto" && (
            <span className="ml-1 text-[10px] font-bold opacity-90">· {scanMode === "exit" ? "ออก" : "เข้า"} ({modeCutoff})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setScanModeSelection("entry")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition ${scanModeSelection === "entry" ? "bg-emerald-600 text-white shadow" : "text-slate-600 hover:bg-emerald-100"}`}
        >
          <LogIn className="w-4 h-4" /> เข้าอย่างเดียว
        </button>
        {/* Toggle: Face + QR vs QR-only (สำหรับเครื่องสเปกต่ำ) */}
        <div className="w-px h-6 bg-slate-300 mx-1" />
        <button
          type="button"
          onClick={() => setQrOnly(false)}
          title="ใช้กล้องแสกนใบหน้า + QR (ต้องการ CPU แรง)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition ${!qrOnly ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-indigo-50"}`}
        >
          <ScanFace className="w-4 h-4" /> หน้า+QR
        </button>
        <button
          type="button"
          onClick={() => setQrOnly(true)}
          title="แสกน QR อย่างเดียว ประหยัด CPU (Pavilion x2 / Atom / Celeron)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition ${qrOnly ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-indigo-50"}`}
        >
          <QrCode className="w-4 h-4" /> QR เท่านั้น
        </button>
      </div>

      {/* Top control bar (compact) */}
      <div className="absolute top-2 right-2 z-40 flex items-center gap-1.5">
        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-white/60 text-slate-700">
          <LogIn className="w-3 h-3 mr-1 text-emerald-600" /> เข้า {todayCounts.entry}
        </Badge>
        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-white/60 text-slate-700">
          <LogOut className="w-3 h-3 mr-1 text-rose-600" /> ออก {todayCounts.exit}
        </Badge>
        <Badge variant="secondary" className={`backdrop-blur-sm border-white/60 ${qrOnly ? "bg-indigo-600 text-white" : "bg-white/80 text-slate-700"}`}>
          <QrCode className="w-3 h-3 mr-1" /> {qrOnly ? "QR เท่านั้น" : "QR สำรอง"}
        </Badge>
        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-white/60 text-slate-700">
          {online ? <Wifi className="w-3 h-3 mr-1 text-emerald-600" /> : <WifiOff className="w-3 h-3 mr-1 text-amber-500" />}
          {online ? "ออนไลน์" : "ออฟไลน์"}
        </Badge>
        {geofence.configured && (
          <Badge className={geoStatus.ok ? "bg-emerald-500" : "bg-red-500"}>
            <MapPin className="w-3 h-3 mr-1" />
            {geoStatus.distance == null ? `รัศมี ${geofence.radius} ม.` : geoStatus.ok ? `${Math.round(geoStatus.distance)} ม.` : `นอก ${Math.round(geoStatus.distance)} ม.`}
          </Badge>
        )}
        <Button variant="ghost" size="icon" onClick={() => setShowSettings((s) => !s)} className="text-slate-700 hover:bg-white/50 h-8 w-8">
          <SettingsIcon className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={enterFullscreen} className="text-slate-700 hover:bg-white/50 h-8 w-8">
          <Maximize className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => { stopCamera(); window.location.href = "/dashboard/student/face-scan"; }} className="text-slate-700 hover:bg-white/50 h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {showSettings && (
        <div className="absolute top-12 right-2 z-40 bg-card text-foreground rounded-xl p-4 w-80 shadow-2xl space-y-3">
          <h3 className="font-semibold text-sm">ตั้งค่ากล้อง</h3>
          <div className="flex gap-1">
            <Button size="sm" variant={camMode === "standard" ? "default" : "outline"} onClick={() => switchCamMode("standard")} className="flex-1">มาตรฐาน</Button>
            <Button size="sm" variant={camMode === "wide" ? "default" : "outline"} onClick={() => switchCamMode("wide")} className="flex-1">มุมกว้าง</Button>
            <Button size="sm" variant={camMode === "network" ? "default" : "outline"} onClick={() => switchCamMode("network")} className="flex-1 gap-1">
              <Cctv className="w-3 h-3" />CCTV
            </Button>
          </div>

          <div className="space-y-2 border-t pt-2">
            <label className="text-xs font-semibold flex items-center gap-1">
              <Cctv className="w-3 h-3" />URL กล้องเครือข่าย (HLS / MP4)
            </label>
            <Input
              type="url"
              value={networkUrl}
              onChange={(e) => setNetworkUrl(e.target.value)}
              onBlur={() => localStorage.setItem(NETWORK_CAM_URL_KEY, networkUrl)}
              placeholder="https://gateway/live/cam1.m3u8"
              className="text-xs h-8"
            />
            <p className="text-[10px] text-muted-foreground leading-snug">
              RTSP ไม่สามารถเล่นในเบราว์เซอร์ได้โดยตรง — ต้องใช้ gateway เช่น
              <b> MediaMTX</b> หรือ <b>go2rtc</b> แปลง RTSP → HLS ก่อน
              (ดูคู่มือใน <code>docs/RTSP-CCTV-SETUP.md</code>)
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] flex-1"
                disabled={netTesting || !networkUrl.trim()}
                onClick={async () => {
                  setNetTesting(true);
                  localStorage.setItem(NETWORK_CAM_URL_KEY, networkUrl);
                  const r = await testStreamUrl(networkUrl);
                  setNetStatus(r.message);
                  r.ok ? toast.success(r.message) : toast.error(r.message, { duration: 9000 });
                  setNetTesting(false);
                }}
              >
                {netTesting ? "กำลังทดสอบ…" : "ทดสอบการเชื่อมต่อ"}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {networkUrl.trim() ? describeStreamKind(classifyStreamUrl(networkUrl)) : ""}
              </span>
            </div>
            {netStatus && <p className="text-[10px] text-muted-foreground break-words">สถานะ: {netStatus}</p>}
          </div>


          <div className="space-y-2 border-t pt-2">
            <label className="text-xs font-semibold flex items-center gap-2">
              <input
                type="checkbox"
                checked={staffFaceEnabled}
                onChange={(e) => setStaffFaceEnabled(e.target.checked)}
              />
              รวมใบหน้าบุคลากร (โหมดทดสอบ)
            </label>
            <p className="text-[10px] text-muted-foreground leading-snug">
              เมื่อเปิด ระบบจะจดจำใบหน้าบุคลากรที่ลงทะเบียนไว้และแสดงผลบนกล้อง
              แต่ <b>ไม่บันทึกเวลามาเรียน/ปฏิบัติงาน</b> — ใช้ทดสอบความแม่นยำของเครื่องคีออส
            </p>
          </div>

          <div className="text-xs text-muted-foreground border-t pt-2">
            threshold: <b>{threshold}</b> • ใบหน้านักเรียน {known.length}
            {staffFaceEnabled && <> • บุคลากร {staffKnown.length}</>}
          </div>

        </div>
      )}

      {/* Main grid: camera (left) + scan list (right) */}
      <div className="absolute inset-0 grid grid-cols-[1fr_360px] gap-3 p-3 pt-12 pb-28">
        {/* Camera panel with school header */}
        <div className="relative rounded-2xl overflow-hidden bg-white shadow-xl flex flex-col" style={cameraPanelStyle}>
          {/* School header banner */}
          <div className="flex items-center gap-3 px-5 py-3" style={headerBannerStyle}>
            {schoolLogo ? (
              <img src={schoolLogo} alt="logo" className="w-14 h-14 object-contain drop-shadow" />
            ) : (
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: hexA(themePrimary, 0.25) }}>
                <ScanFace className="w-7 h-7" style={{ color: themePrimary }} />
              </div>
            )}
            <div className="leading-tight">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: themePrimary }}>
                {schoolName || "โรงเรียน"}
              </h1>
              <p className="text-xs md:text-sm font-medium" style={{ color: hexA(themePrimary, 0.85) }}>
                ระบบบันทึกเวลามาเรียนด้วย AI Camera
              </p>
            </div>
          </div>


          {/* Camera feed */}
          <div className="relative flex-1 bg-black">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {/* AI camera overlay tag */}
            <div className="absolute top-3 right-3 z-10 bg-black/50 text-pink-200 text-xs font-mono px-2 py-1 rounded">
              {schoolName ? `${schoolName} · AI Camera No.1` : "AI Camera No.1"}
            </div>
            <div className="absolute top-3 left-3 z-10 bg-black/50 text-pink-200 text-xs font-mono px-2 py-1 rounded tabular-nums">
              {now.toLocaleDateString("en-GB").replace(/\//g, "-")} {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>

            {/* ผลการจับคู่ล่าสุด: ใบหน้าที่ลงทะเบียน vs ใบหน้าตอนสแกน */}
            {lastMatch && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-scale-in">
                <div className={`flex items-center gap-4 rounded-2xl px-5 py-3 shadow-2xl backdrop-blur bg-white/95 border-2 ${lastMatch.scanType === "exit" ? "border-rose-400" : "border-emerald-400"}`}>
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-300">
                      {lastMatch.registeredFace
                        ? <img src={lastMatch.registeredFace} alt="ใบหน้าที่ลงทะเบียน" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">ไม่มีภาพ</div>}
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 mt-1">ที่ลงทะเบียน</p>
                  </div>
                  <CheckCircle2 className={`w-8 h-8 ${lastMatch.scanType === "exit" ? "text-rose-500" : "text-emerald-500"}`} />
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-300">
                      {lastMatch.capturedFace
                        ? <img src={lastMatch.capturedFace} alt="ใบหน้าตอนสแกน" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">-</div>}
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 mt-1">ตอนสแกน</p>
                  </div>
                  <div className="pl-3 border-l border-slate-200 min-w-[190px]">
                    <p className={`text-xs font-bold ${lastMatch.scanType === "exit" ? "text-rose-600" : "text-emerald-600"}`}>
                      บันทึก{lastMatch.scanType === "exit" ? "ออก" : "เข้า"}โรงเรียนแล้ว
                    </p>
                    <p className="text-lg font-bold text-slate-800 leading-tight truncate">{lastMatch.name}</p>
                    <p className="text-xs text-slate-500">{lastMatch.studentCode} · ชั้น {lastMatch.classroom}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {lastMatch.time} · ความมั่นใจ {(lastMatch.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!streaming && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 text-white">
                <ScanFace className="w-32 h-32 opacity-40" />
                <p className="text-lg opacity-70">{modelReady ? "กดปุ่มด้านล่างเพื่อเริ่มสแกน" : modelStatus}</p>
                <Button size="lg" onClick={() => startCamera()} disabled={!modelReady} className="gradient-primary text-base px-8 py-6 rounded-2xl">
                  <Camera className="w-5 h-5 mr-2" />เปิดกล้องโหมดคีออส
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Recent scans list */}
        <div className="rounded-2xl bg-white/80 backdrop-blur shadow-xl overflow-hidden flex flex-col" style={sidePanelStyle}>
          <div className="px-3 py-2" style={sideHeaderStyle}>
            <h2 className="text-sm font-bold" style={{ color: themeAccent }}>รายการสแกนล่าสุด</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {recent.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-12">ยังไม่มีการสแกน</p>
            ) : (
              recent.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-lg p-1.5 border shadow-sm ${r.scanType === "exit" ? "bg-rose-50 border-rose-200" : "bg-white border-pink-200"}`}>
                  {r.scanType === "exit"
                    ? <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                    : <LogIn className="w-4 h-4 text-emerald-600 shrink-0" />}
                  <div className="flex items-center shrink-0">
                    <div className="w-8 h-8 rounded overflow-hidden bg-slate-100 border border-slate-200">
                      {r.capturedFace ? (
                        <img src={r.capturedFace} alt="ตรวจพบ" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">-</div>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded overflow-hidden bg-slate-100 border border-slate-200 -ml-1">
                      {r.avatar ? (
                        <img src={r.avatar} alt="ลงทะเบียน" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400">-</div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold tabular-nums leading-tight truncate ${r.scanType === "exit" ? "text-rose-700" : "text-emerald-700"}`}>
                      <span className={`mr-1 inline-block px-1.5 rounded text-[10px] font-bold ${r.scanType === "exit" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}>{r.scanType === "exit" ? "ออก" : "เข้า"}</span>
                      {r.studentCode || "-"} <span className="text-slate-600 font-normal">· {r.name}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight truncate">{r.classroom} · {r.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar: clock + ONLINE */}
      <div className="absolute bottom-0 inset-x-0 z-30 p-3 flex items-center justify-center gap-3" style={bottomBarStyle}>
        <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-md" style={clockCardStyle}>
          <span className="font-mono text-3xl font-bold tabular-nums" style={{ color: themePrimary }}>
            {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-md" style={clockCardStyle}>
          <span className={`w-3 h-3 rounded-full ${online ? "animate-pulse" : ""}`} style={{ backgroundColor: online ? themePrimary : "#94a3b8" }} />
          <span className="font-bold" style={{ color: themePrimary }}>{online ? "ONLINE" : "OFFLINE"}</span>
        </div>
        {faceCount > 0 && (
          <Badge className="text-white px-3 py-2 text-sm" style={{ backgroundColor: themePrimary }}>
            {faceCount} ใบหน้าในเฟรม
          </Badge>
        )}
      </div>

    </div>
  );
};

export default FaceKioskPage;
