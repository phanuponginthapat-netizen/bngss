import { useCallback, useEffect, useRef, useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { openCamera, stopStream } from "@/lib/cameraStream";

import { attachNetworkCamera, validateStreamUrl, describeStreamKind, classifyStreamUrl, testStreamUrl, type NetworkCameraHandle } from "@/lib/networkCamera";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  loadFaceModels, getAllDescriptors, matchDescriptor, drawFaceFrame,
  detectorOptionsHQ, applyCameraDefaults, autoExposureBalance, reportFrameLuminance, preprocessFrame, estimateFaceSharpness, estimateBrightness,
  BANK_GRADE,
  type KnownFace, type MatchResult,
} from "@/lib/faceApi";
import { learnFromScan } from "@/lib/faceLearning";
import { verifyScanTexture } from "@/lib/faceTexture";
import { newLivenessTrack, recordLivenessSample, makeLivenessSample, type LivenessTrack } from "@/lib/faceLiveness";
import { playSuccessSound, playDuplicateSound, playUnknownSound, speakText, prewarmSpeech, isSpeaking, waitForSpeechEnd, playFeverAlert, playWeaponAlert, playGateOpenSound, playGateDeniedSound, unlockAudio, diagnoseAudio } from "@/lib/faceScanAudio";
import { useSmartGate } from "@/hooks/useSmartGate";
import SmartGatePanel from "@/components/facescan/SmartGatePanel";
import FaceGuideOverlay from "@/components/facescan/FaceGuideOverlay";
import { faceGuideStatus } from "@/lib/faceGuide";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Camera, X, Maximize, ScanFace, Users, Wifi, WifiOff, Settings as SettingsIcon, MapPin, Cctv, QrCode, LogIn, LogOut, Clock, AlertTriangle, XCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { useSchoolSetting } from "@/hooks/useSchoolSetting";
import { useSchoolGeofence, calcDistanceMeters, getCurrentCoords } from "@/hooks/useSchoolGeofence";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { CheckCircle2 } from "lucide-react";
import { uploadFaceScanSnapshot } from "@/lib/faceScanUpload";
import { useAutoScanMode } from "@/hooks/useAutoScanMode";
import KioskScreensaver from "@/components/facescan/KioskScreensaver";
import { useCmsValues } from "@/hooks/useCmsSettings";
import { wakeKioskScreen } from "@/lib/kioskWake";
import { getRegisteredFaceImage } from "@/lib/registeredFace";
import { checkTodayScan, markScanned, methodLabel, clearScanDedupCache } from "@/lib/scanDedup";
import { useKioskHeartbeat } from "@/hooks/useKioskHeartbeat";
import { useKioskLockdown } from "@/hooks/useKioskLockdown";
import KioskFaceRegisterDialog from "@/components/kiosk/KioskFaceRegisterDialog";
import { downloadFacesToCache, pickAndSaveFaceFolder, loadFaceCache, getSavedDirName, hasFileSystemAccess } from "@/lib/kioskFaceCache";
import { useIsPortrait } from "@/hooks/useScreenOrientation";
import { KIOSK_TURBO_PROFILE } from "@/lib/kioskPerf";

import { saveErrorMessage } from "@/lib/saveError";
import { notifyRole } from "@/lib/notify";
import {
  subscribeWizmindEvents, loadEventImage, releaseEventImage, markEventProcessed,
  isEventFresh, WIZMIND_ENABLED_KEY, WIZMIND_CAMERA_KEY, type CameraFaceEvent,
} from "@/lib/wizmindEvents";

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
  /** ล็อกใบหน้าที่จับได้ชั่วคราว — ขยับเล็กน้อย/เบลอชั่วขณะ จะไม่หลุดล็อก */
  const kioskLockRef = useRef<{ studentId: string; until: number } | null>(null);
  const lastLowLightBoostRef = useRef(0);
  /** กรอบวาดแบบเกลี่ยให้นิ่ง (EMA) */
  const kioskSmoothRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  // ใบหน้าสด (anti-spoof): สะสมหลักฐาน blink/ขยับศีรษะแยกตาม studentId
  const livenessRef = useRef<Map<string, LivenessTrack>>(new Map());
  // texture ไม่ผ่าน (สงสัยรูปถ่าย/คนหน้าคล้าย): studentId -> timestamp ครั้งสุดท้ายที่ถูกปฏิเสธ
  const textureFailRef = useRef<Map<string, number>>(new Map());
  // รอยืนยันบนจอ (เกณฑ์ระดับกลาง — ต้องให้คนกดยืนยันก่อนบันทึก)
  const [pendingManual, setPendingManual] = useState<{
    studentId: string; studentCode: string; name: string; classroom: string;
    avatar?: string | null; isStaff: boolean; confidence: number;
    capturedFace?: string; registeredFace?: string | null; match: MatchResult;
    descriptor: Float32Array; sharpness: number; faceSize: number;
  } | null>(null);
  const pendingManualRef = useRef<typeof pendingManual>(null);
  const manualTimerRef = useRef<number | null>(null);
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
  // ข้อความเตือน/แจ้งเตือนกลางจอ — ให้ใหญ่เห็นชัด เหมือนการสแกนสำเร็จ
  const [notice, setNotice] = useState<{
    type: "info" | "warning" | "error";
    title: string;
    description: string;
  } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const showNotice = useCallback((
    type: "info" | "warning" | "error",
    title: string,
    description: string,
    duration = 3000,
  ) => {
    if (type === "info") toast.info(title, { description, duration });
    else if (type === "warning") toast.warning(title, { description, duration });
    else toast.error(title, { description, duration });
    setNotice({ type, title, description });
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), duration);
  }, []);
  const clearNotice = useCallback(() => {
    setNotice(null);
    if (noticeTimerRef.current) { window.clearTimeout(noticeTimerRef.current); noticeTimerRef.current = null; }
  }, []);
  const [todayCounts, setTodayCounts] = useState<{ entry: number; exit: number }>({ entry: 0, exit: 0 });
  // โหมด QR เท่านั้น — ไม่โหลด/รันโมเดลใบหน้า ประหยัด CPU สำหรับเครื่องสเปกต่ำ (Pavilion x2 / Atom / Celeron)
  const [qrOnly, setQrOnly] = useState<boolean>(() => localStorage.getItem("face_kiosk_qr_only") === "1");
  useEffect(() => { localStorage.setItem("face_kiosk_qr_only", qrOnly ? "1" : "0"); }, [qrOnly]);
  const { selection: scanModeSelection, setSelection: setScanModeSelection, effective: scanMode, effectiveRef: scanModeRef, cutoff: modeCutoff, checkWindow, entryWindow, exitWindow } = useAutoScanMode();
  const [camMode, setCamMode] = useState<CamMode>("standard");
  const perf = KIOSK_TURBO_PROFILE;
  // ช่วงเว้นระยะเพิ่มเติมระหว่างรอบสแกน (มิลลิวินาที) — ปรับได้จากหน้าตั้งค่า
  const [scanGapMs, setScanGapMs] = useState<number>(() => {
    const v = Number(localStorage.getItem("face_kiosk_scan_gap") || "");
    return Number.isFinite(v) && v >= 0 ? v : 0;
  });
  useEffect(() => { localStorage.setItem("face_kiosk_scan_gap", String(scanGapMs)); }, [scanGapMs]);
  // เตรียมเสียงประโยคที่ใช้บ่อยล่วงหน้า — กันเสียงกระตุก/ดีเลย์ตอนสแกนจริง
  useEffect(() => {
    prewarmSpeech(["ไม่พบข้อมูลใบหน้าในระบบ กรุณาลงทะเบียน", "สแกนเข้าสำเร็จ", "สแกนออกสำเร็จ"]);
  }, []);
  // โหลด cache ใบหน้า + โฟลเดอร์ที่จำไว้
  useEffect(() => {
    loadFaceCache().then(c => c && setFaceCacheMeta(c.meta)).catch(() => {});
    getSavedDirName().then(setFaceCacheDir).catch(() => {});
  }, []);
  const [screensaver, setScreensaver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(new Date());
  // รองรับการวางจอทั้งแนวตั้งและแนวนอน — สลับ layout อัตโนมัติ
  const portrait = useIsPortrait();
  const [savedPos, setSavedPos] = useState({ x: 50, y: 50 });
  const [faceCount, setFaceCount] = useState(0);
  const [networkUrl, setNetworkUrl] = useState<string>(() => localStorage.getItem(NETWORK_CAM_URL_KEY) || "");
  const [netStatus, setNetStatus] = useState<string>("");
  const [audioDiag, setAudioDiag] = useState<string[]>([]);
  const [audioTesting, setAudioTesting] = useState(false);
  const [netTesting, setNetTesting] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [faceCacheMeta, setFaceCacheMeta] = useState<any>(null);
  const [downloadingFaces, setDownloadingFaces] = useState(false);
  const [faceCacheDir, setFaceCacheDir] = useState<string | null>(null);
  const qc = useQueryClient();
  const netCamRef = useRef<NetworkCameraHandle | null>(null);


  const { value: thresholdSetting } = useSchoolSetting("face_scan_threshold");
  const { value: voiceSetting } = useSchoolSetting("face_scan_voice");
  const { value: idleSecSetting } = useSchoolSetting("kiosk_idle_timeout_sec");
  const { value: powerSaveSetting } = useSchoolSetting("kiosk_power_save");
  const { value: wakeWordSetting } = useSchoolSetting("kiosk_wake_word_enabled");
  const { value: livenessSetting } = useSchoolSetting("face_liveness_enabled");
  const { value: textureSetting } = useSchoolSetting("face_texture_gate");
  const threshold = parseFloat(thresholdSetting || "0.48");
  const voiceEnabled = voiceSetting !== "false";
  const livenessEnabled = livenessSetting !== "false";
  // door kiosk: texture gate เปิดเฉพาะเมื่อตั้ง "true" ชัดเจน — default ปิดเพื่อกัน "เขียวแล้วหลุด" บน Atom/Pavilion x2
  const textureGate = textureSetting === "true";
  const idleMs = Math.max(15, parseInt(idleSecSetting || "60", 10) || 60) * 1000;
  const powerSave = powerSaveSetting !== "false";
  const wakeWordEnabled = wakeWordSetting !== "false";

  const geofence = useSchoolGeofence();
  const [geoStatus, setGeoStatus] = useState<{ ok: boolean; distance: number | null }>({ ok: !geofence.configured, distance: null });
  const { schoolName, schoolLogo } = useSystemSettings();
  const [isTodayHoliday, setIsTodayHoliday] = useState(false);
  useEffect(() => {
    import("@/lib/holiday").then(({ fetchHolidays, isHolidaySync }) => {
      fetchHolidays().then(list => setIsTodayHoliday(isHolidaySync(todayBangkok(), list))).catch(()=>{});
    });
  }, []);

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
    return () => { if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- Lockdown เบราว์เซอร์: กันหลุดหน้า kiosk + กัน session หมดอายุ ----
  useKioskLockdown(true);

  // ---- ส่งสถานะเครื่อง (heartbeat) ให้หน้า Kiosk Door Health เห็นว่าเครื่องออนไลน์ ----
  const kioskStartedAtRef = useRef<number>(Date.now());
  useKioskHeartbeat({
    enabled: true,
    kioskMode: "door",
    status: screensaver ? "locked" : "online",
    // ปัดเป็นนาที เพื่อไม่ให้ effect รีสตาร์ททุกวินาที
    uptimeSec: Math.floor((now.getTime() - kioskStartedAtRef.current) / 60000) * 60,
  });

  // ---- โหลดสแกนล่าสุดจาก server ให้ทุกตู้เห็นเหมือนกัน (ทุก platform) ----
  useEffect(() => {
    const loadRecentFromServer = async () => {
      try {
        const today = todayBangkok();
        const { data } = await supabase
          .from("face_scan_logs")
          .select("student_id, scan_time, scan_type, confidence, captured_face_url, students!inner(prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name))")
          .eq("scan_date", today)
          .order("scan_time", { ascending: false })
          .limit(10);
        if (data && data.length) {
          const mapped = (data as any[]).map(r => ({
            studentId: r.student_id,
            studentCode: r.students.student_code || "-",
            name: `${r.students.prefix || ""}${r.students.first_name} ${r.students.last_name}`.trim(),
            classroom: r.students.classrooms ? `${r.students.classrooms.grade_level}/${r.students.classrooms.name}` : "-",
            avatar: r.students.photo_url,
            capturedFace: r.captured_face_url,
            time: new Date(r.scan_time).toLocaleTimeString("th-TH", { hour12: false }),
            confidence: r.confidence,
            scanType: r.scan_type,
          }));
          setRecent(mapped as any);
        }
      } catch {}
    };
    loadRecentFromServer();
    const ch = supabase.channel("kiosk-recent-global").on("postgres_changes", { event: "INSERT", schema: "public", table: "face_scan_logs" }, () => {
      setTimeout(loadRecentFromServer, 800);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ---- ปลดล็อกเสียง — Chromium kiosk บล็อก AudioContext จนกว่าจะมี gesture ครั้งแรก ----
  useEffect(() => {
    const once = () => { try { unlockAudio(); } catch {} };
    window.addEventListener("click", once, { once: true } as any);
    window.addEventListener("touchstart", once, { once: true } as any);
    window.addEventListener("keydown", once, { once: true } as any);
    return () => {
      window.removeEventListener("click", once as any);
      window.removeEventListener("touchstart", once as any);
      window.removeEventListener("keydown", once as any);
    };
  }, []);

  // ---- Screen Wake Lock — กันจอดับ (สำคัญ: ตู้นี้ไม่ได้ใช้ wakeLock มาก่อน จึง sleep แม้ xset -dpms) ----
  useEffect(() => {
    let lock: any = null;
    const acquire = async () => {
      try {
        // @ts-ignore
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          // @ts-ignore
          lock = await navigator.wakeLock.request("screen");
        }
      } catch { /* ignore */ }
    };
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try { lock?.release?.(); } catch { /* ignore */ }
    };
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
  // ลงเวลาปฏิบัติงานบุคลากรอัตโนมัติเมื่อสแกนใบหน้าผ่านคีออส
  const [staffClockEnabled, setStaffClockEnabled] = useState<boolean>(() => localStorage.getItem("face_kiosk_staff_clock") === "1");
  useEffect(() => { localStorage.setItem("face_kiosk_staff_clock", staffClockEnabled ? "1" : "0"); }, [staffClockEnabled]);
  const staffClockRef = useRef(staffClockEnabled);
  useEffect(() => { staffClockRef.current = staffClockEnabled; }, [staffClockEnabled]);

  // ===== Smart Gate: ประตูอัตโนมัติ + วัดไข้ + ตรวจโลหะ (micro:bit) =====
  const gate = useSmartGate();
  const gateRef = useRef(gate);
  useEffect(() => { gateRef.current = gate; }, [gate]);
  /** เรียกหลังสแกนผ่าน — ตรวจไข้/โลหะแล้วเปิดประตู พร้อมเสียงแจ้งเตือน + บันทึกเหตุการณ์ลงระบบ */
  const runGate = useCallback(async (
    name: string,
    subject?: { id?: string; kind?: "student" | "personnel" },
  ) => {
    try {
      const res = await gateRef.current.requestPassage();
      if (res.skipped) return;
      const r = gateRef.current.reading;
      const logEvent = async (eventType: "pass" | "fever" | "weapon", allowed: boolean, opened: boolean) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await (supabase as any).from("smart_gate_events").insert({
            device_label: `tablet-kiosk-${scanModeRef.current === "exit" ? "exit" : "entry"}`,
            subject_kind: subject?.kind || "student",
            subject_id: subject?.id ?? null,
            subject_name: name,
            event_type: eventType,
            temperature_c: r.tempC,
            metal_level: r.metalLevel,
            detail: res.detail,
            allowed,
            gate_opened: opened,
            created_by: user?.id ?? null,
          });
        } catch { /* ไม่ให้การบันทึก log ขัดจังหวะการทำงานประตู */ }
      };
      // แจ้งเตือนผู้เกี่ยวข้อง (ผอ./ผู้ดูแล/ครู) เมื่อพบไข้สูงหรือวัตถุต้องสงสัย
      const alertStaff = (kind: "fever" | "weapon", detail: string) => {
        const title = kind === "fever" ? "พบผู้มีอุณหภูมิสูงที่จุดคัดกรอง" : "พบวัตถุต้องสงสัยที่จุดคัดกรอง";
        const body = `${name} • ${detail}`;
        const payload = {
          title,
          body,
          type: "smart_gate",
          severity: (kind === "weapon" ? "critical" : "warning") as "critical" | "warning",
          url: "/dashboard/admin/smart-gate",
          channels: ["in_app", "push", "line", "gchat"] as ("in_app" | "push" | "line" | "gchat")[],
          gchat_categories: ["student_affairs", "all"],
          dedup_key: `smart_gate:${kind}:${subject?.id || name}:${new Date().toISOString().slice(0, 13)}`,
        };
        void notifyRole("admin", payload);
        void notifyRole("director", payload);
        void notifyRole("teacher", { ...payload, channels: ["in_app"] });
      };
      if (!res.allow) {
        // พบโลหะ/วัตถุต้องสงสัย → ปิดประตู + แจ้งชื่อ
        playWeaponAlert();
        if (voiceEnabled) speakText(`${name} มีสิ่งของต้องสงสัย ขอให้คุณครูตรวจสอบ`);
        showNotice("error", "พบวัตถุต้องสงสัย — ประตูปิด", `${name} • ${res.detail}`, 8000);
        void logEvent("weapon", false, false);
        alertStaff("weapon", res.detail);
        return;
      }
      if (res.reason === "fever") {
        // ไข้สูง → เตือนแต่ยังเปิดประตูให้ผ่าน
        playFeverAlert();
        const t = res.tempC != null ? res.tempC.toFixed(1) : "";
        if (voiceEnabled) speakText(`${name} มีไข้สูง อุณหภูมิ ${t} องศา กรุณาพบเจ้าหน้าที่`);
        showNotice("warning", "อุณหภูมิสูง", `${name} • ${res.detail}`, 6000);
        void logEvent("fever", true, res.opened);
        alertStaff("fever", res.detail);
        if (res.opened) playGateOpenSound();
        return;
      }

      if (res.opened) {
        playGateOpenSound();
        toast.success("เปิดประตู", { description: `${name} • ${res.detail}`, duration: 1800 });
        void logEvent("pass", true, true);
      }
    } catch {
      playGateDeniedSound();
    }
  }, [voiceEnabled, scanModeRef, showNotice]);


  // ===== WizMind / CCTV bridge (realtime) =====
  const [wizmindOn, setWizmindOn] = useState<boolean>(() => localStorage.getItem(WIZMIND_ENABLED_KEY) === "1");
  const [wizmindCam, setWizmindCam] = useState<string>(() => localStorage.getItem(WIZMIND_CAMERA_KEY) || "");
  const [wizmindStatus, setWizmindStatus] = useState<string>("");
  const [wizmindCount, setWizmindCount] = useState(0);
  useEffect(() => { localStorage.setItem(WIZMIND_ENABLED_KEY, wizmindOn ? "1" : "0"); }, [wizmindOn]);
  useEffect(() => { localStorage.setItem(WIZMIND_CAMERA_KEY, wizmindCam); }, [wizmindCam]);


  const { data: known = [] } = useQuery({
    queryKey: ["face-known-kiosk"],
    queryFn: async () => {
      // ลอง cache local ก่อน — ไวและออฟไลน์ได้ (มีทั้ง นร. และบุคลากร)
      try {
        const cached = await loadFaceCache();
        if (cached?.faces?.length) {
          return cached.faces.map(f => ({
            studentId: f.studentId, descriptors: f.descriptors, name: f.name, classroom: f.classroom,
            avatar: null, studentCode: f.studentCode, registeredFace: null, isStaff: (f as any).isStaff || false,
          })) as any;
        }
      } catch {}
      // ลอง edge ก่อน (bypass RLS สำหรับตู้ anon)
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke("kiosk-face-download");
        if (!edgeErr && (edgeData as any)?.faces && Array.isArray((edgeData as any).faces) && (edgeData as any).faces.length > 0) {
          const faces = (edgeData as any).faces as any[];
          const arr = faces.map(f => ({
            studentId: f.studentId, descriptors: f.descriptors, name: f.name, classroom: f.classroom,
            avatar: null, studentCode: f.studentCode, registeredFace: null,
          }));
          // เก็บลง cache ไว้ครั้งต่อไป
          try { await saveFaceCache(faces as any); setFaceCacheMeta({ count: faces.length, savedAt: new Date().toISOString() }); } catch {}
          return arr as any;
        }
      } catch {}
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
      const arr = Array.from(map.values());
      // เก็บลง cache ไว้ใช้ครั้งต่อไปแบบ offline
      try {
        const toCache = arr.map(a => ({ studentId: a.studentId, studentCode: a.studentCode, name: a.name, classroom: a.classroom, descriptors: a.descriptors }));
        await saveFaceCache(toCache as any);
        setFaceCacheMeta({ count: toCache.length, savedAt: new Date().toISOString() });
      } catch {}
      return arr;
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
    let dayKey = todayBangkok();
    const load = async () => {
      const today = todayBangkok();
      dayKey = today;
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
    };
    void load();

    // ข้ามวัน → ล้างสถานะกันสแกนซ้ำแล้วโหลดใหม่
    const dayTimer = window.setInterval(() => {
      if (todayBangkok() !== dayKey) {
        clearScanDedupCache();
        cooldownRef.current.clear();
        justScannedRef.current.clear();
        void load();
      }
    }, 60_000);

    // ซิงก์ข้ามเครื่อง: เครื่องอื่นสแกน (ใบหน้า/QR) → กันสแกนซ้ำที่เครื่องนี้ทันที
    const ch = supabase
      .channel("kiosk-scan-dedup")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "face_scan_logs" }, (payload: any) => {
        const r = payload.new || {};
        if (!r.student_id || r.scan_date !== todayBangkok()) return;
        const set = r.scan_type === "exit" ? seenTodayRef.current.exit : seenTodayRef.current.entry;
        if (set.has(r.student_id)) return;
        set.add(r.student_id);
        markScanned(r.student_id, r.scan_type === "exit" ? "exit" : "entry", r.entry_method);
        setTodayCounts({ entry: seenTodayRef.current.entry.size, exit: seenTodayRef.current.exit.size });
      })
      .subscribe();

    return () => {
      window.clearInterval(dayTimer);
      supabase.removeChannel(ch);
    };
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
    try { unlockAudio(); } catch {}
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
        width: Math.min(wide ? 1280 : 1280, perf.videoWidth),
        height: Math.min(wide ? 720 : 720, perf.videoHeight),
        frameRate: perf.frameRate,
      });
      // ใช้ค่ากล้องเริ่มต้นของอุปกรณ์ + autofocus/auto-exposure (เหมือนหน้าลงทะเบียนใบหน้า)
      await applyCameraDefaults(res.stream);
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
    method: "face" | "qr" = "face",
  ) => {
    const now = Date.now();
    const mode = scanModeRef.current;
    const modeLabel = mode === "exit" ? "ออก" : "เข้า";
    // cooldown/justScanned ตั้งทั้ง 2 key: `${studentId}:${mode}` (กัน race ภายใน recordScan)
    // และ `studentId` เปล่า (loop ตรวจจับอ่าน key นี้เพื่อแสดงสถานะ/ไม่โผล่ป๊อปอัปซ้ำ)
    const setScanCool = (id: string, ts: number) => {
      justScannedRef.current.set(id, ts);
      cooldownRef.current.set(id, ts);
    };
    const coolNow = () => {
      setScanCool(cdKey, now);
      setScanCool(studentId, now);
    };
    // Kiosk ในตู้ล็อก: ปลุกจอ (DPMS) ผ่าน local daemon เมื่อเจอคนสแกน
    wakeKioskScreen();
    const win = checkWindow(mode);
    if (win.allowed === false) {
      const wkey = `${studentId}:window`;
      const lastNotice = duplicateNoticeRef.current.get(wkey) || 0;
      if (now - lastNotice > 5_000) {
        duplicateNoticeRef.current.set(wkey, now);
        playDuplicateSound();
        showNotice("warning", "ปฏิเสธการสแกน", win.reason, 3000);
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
        showNotice("info", "สแกนซ้ำ", `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, 2500);
      }
      coolNow();
      return;
    }

    // ===== เช็คร่วมกับ "สแกน QR" — ดูจากฐานข้อมูลว่าวันนี้เคยสแกน (ทุกวิธี) แล้วหรือยัง =====
    const todayState = await checkTodayScan(studentId);
    if ((mode === "exit" && todayState.exit) || (mode === "entry" && todayState.entry)) {
      seenSet.add(studentId);
      const lastNotice = duplicateNoticeRef.current.get(cdKey) || 0;
      if (now - lastNotice > 5_000) {
        duplicateNoticeRef.current.set(cdKey, now);
        playDuplicateSound();
        showNotice("info", "สแกนซ้ำ", `${name} บันทึก${modeLabel}วันนี้แล้ว (${methodLabel(mode === "exit" ? todayState.exitMethod : todayState.entryMethod)})`, 2500);
      }
      cooldownRef.current.set(cdKey, now);
      cooldownRef.current.set(studentId, now);
      return;
    }
    if (todayState.entry) seenTodayRef.current.entry.add(studentId);
    if (todayState.exit) seenTodayRef.current.exit.add(studentId);

    // ===== ป้องกันบันทึก "ออก" ใกล้เวลา "เข้า" เกินไป =====
    if (mode === "exit") {
      if (!seenTodayRef.current.entry.has(studentId)) {

        const wkey = `${studentId}:no-entry`;
        const lastNotice = duplicateNoticeRef.current.get(wkey) || 0;
        if (now - lastNotice > 5_000) {
          duplicateNoticeRef.current.set(wkey, now);
          playDuplicateSound();
          showNotice("warning", "ปฏิเสธการสแกน", `${name} ยังไม่ได้บันทึกเข้าโรงเรียนวันนี้`, 3000);
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
            showNotice("warning", "ปฏิเสธการสแกน", `${name} เพิ่งสแกนเข้าเมื่อ ${Math.round(gapMin)} นาทีที่แล้ว — ต้องห่างอย่างน้อย 30 นาทีจึงสแกนออกได้`, 3500);
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
    cooldownRef.current.set(studentId, now);

    // แสดงผลทันทีหลังกรอบเขียว — ไม่รออัปโหลด/DB (แก้หน่วง "เขียวแล้วนานกว่าจะแสดงผล")
    const immediateTime = new Date().toLocaleTimeString("th-TH", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLastMatch({ name, studentCode, classroom, confidence, scanType: mode, capturedFace, registeredFace: enrolledFace || null, time: immediateTime });
    setRecent(r => [{ studentId, studentCode, name, classroom, avatar: enrolledFace || null, capturedFace, time: immediateTime, confidence, scanType: mode } as any, ...r].slice(0, 10));
    playSuccessSound();
    if (voiceEnabled) speakText(`สแกน${modeLabel}สำเร็จ ${name}`);
    void runGate(name, { id: studentId, kind: "student" });
    justScannedRef.current.set(cdKey, now);
    justScannedRef.current.set(studentId, now);
    markScanned(studentId, mode, method);
    if (!seenSet.has(studentId)) { seenSet.add(studentId); setTodayCounts(c => ({ ...c, [mode]: c[mode] + 1 })); }

    const { data: { user } } = await supabase.auth.getUser();
    const uploadedFaceUrl = await uploadFaceScanSnapshot(capturedFace, studentId);
    // อุณหภูมิจาก micro:bit (null เมื่อไม่ได้เชื่อมต่อ → ใช้กฎเดิมของระบบ)
    const scanTemp = gateRef.current.getLiveTemp();
    const { data, error } = await supabase.from("face_scan_logs").insert({
      student_id: studentId, scan_date: todayBangkok(), scan_type: mode, confidence,
      scanned_by: user?.id, device_label: `tablet-kiosk-${mode}`, entry_method: method,
      captured_face_url: uploadedFaceUrl,
      ...(scanTemp != null ? { temperature_c: scanTemp } : {}),
    } as any).select("id").maybeSingle();
    if (error) {
      if (error.code === "23505") {
        seenSet.add(studentId);
        playDuplicateSound();
        showNotice("info", "สแกนซ้ำ", `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, 2500);
        return;
      }
      showNotice("error", "บันทึกไม่สำเร็จ", saveErrorMessage(error), 5000); return;
    }
    if (!data) {
      seenSet.add(studentId);
      playDuplicateSound();
        showNotice("info", "สแกนซ้ำ", `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, 2500);
      return;
    }
    // immediate feedback already shown — just auto-hide timer
    if (matchTimerRef.current) window.clearTimeout(matchTimerRef.current);
    matchTimerRef.current = window.setTimeout(() => setLastMatch(null), 6000);
  }, [voiceEnabled, runGate, showNotice]);

  // ===== ลงเวลาปฏิบัติงานบุคลากรจากการสแกนใบหน้าที่คีออส =====
  const clockStaff = useCallback(async (
    personnelId: string,
    mode: "entry" | "exit",
    capturedFace: string | undefined,
    confidence: number,
    name: string,
  ): Promise<string> => {
    try {
      const photoUrl = capturedFace ? await uploadFaceScanSnapshot(capturedFace, personnelId) : null;
      // อุณหภูมิจาก micro:bit (null เมื่อไม่ได้เชื่อมต่อ)
      const temp = gateRef.current.getLiveTemp();
      const { data, error } = await (supabase as any).rpc("kiosk_clock_personnel", {
        _personnel_id: personnelId,
        _mode: mode,
        _photo_url: photoUrl,
        _confidence: confidence,
        _temperature_c: temp,
      });
      if (error) throw error;
      const res = (data || {}) as { ok?: boolean; action?: string; reason?: string; status?: string };
      if (res.ok) {
        const label = res.action === "clock_out" ? "ลงเวลาออกงาน" : res.status === "late" ? "ลงเวลาเข้างาน (สาย)" : "ลงเวลาเข้างาน";
        if (voiceEnabled) speakText(`${label} ${name}`);
        toast.success(label, { description: name, duration: 2000 });
        return `บุคลากร • ${label}`;
      }
      if (res.reason === "duplicate") {
        playDuplicateSound();
        showNotice("info", "ลงเวลาแล้ว", `${name} ลงเวลา${mode === "exit" ? "ออก" : "เข้า"}งานวันนี้แล้ว`, 2500);
        return "บุคลากร • ลงเวลาแล้ววันนี้";
      }
      if (res.reason === "no_clock_in") {
        playDuplicateSound();
        showNotice("warning", "ยังไม่ได้ลงเวลาเข้างาน", name, 3000);
        return "บุคลากร • ยังไม่ได้ลงเวลาเข้า";
      }
      if (res.reason === "too_soon") {
        playDuplicateSound();
        showNotice("warning", "เพิ่งลงเวลาเข้างาน", `${name} — ต้องห่างอย่างน้อย 5 นาที`, 3000);
        return "บุคลากร • เพิ่งลงเวลาเข้า";
      }
      return "บุคลากร";
    } catch (e: any) {
      showNotice("error", "ลงเวลาไม่สำเร็จ", saveErrorMessage(e), 5000);
      return "บุคลากร • ลงเวลาไม่สำเร็จ";
    }
  }, [voiceEnabled, showNotice]);

  // ===== ระดับ match กลาง (ลงทะเบียนมือถือ → สแกนคีออส): รอผู้ใช้ยืนยันบนจอก่อนบันทึก =====
  const confirmPendingManual = useCallback(async () => {
    const p = pendingManualRef.current;
    if (!p) return;
    pendingManualRef.current = null;
    setPendingManual(null);
    if (manualTimerRef.current) { window.clearTimeout(manualTimerRef.current); manualTimerRef.current = null; }
    if (p.isStaff) {
      const tNow = Date.now();
      const last = justScannedRef.current.get(p.studentId) || 0;
      if (tNow - last > 15_000) {
        justScannedRef.current.set(p.studentId, tNow);
        cooldownRef.current.set(p.studentId, tNow);
        playSuccessSound();
        const mode = scanModeRef.current === "exit" ? "exit" : "entry";
        void runGate(p.name, { id: p.studentId, kind: "personnel" });
        let clockNote = "บุคลากร (ทดสอบ)";
        if (staffClockRef.current) {
          clockNote = await clockStaff(p.studentId, mode, p.capturedFace, p.confidence, p.name);
        } else if (voiceEnabled) {
          speakText(`สวัสดี ${p.name}`);
        }
        setLastMatch({
          name: p.name,
          studentCode: p.studentCode || "-",
          classroom: `${p.classroom} • ${clockNote}`,
          confidence: p.confidence,
          scanType: mode,
          capturedFace: p.capturedFace,
          registeredFace: p.registeredFace || null,
          time: new Date().toLocaleTimeString("th-TH", { hour12: false }),
        });
        setRecent((prev) => [{
          studentId: p.studentId,
          studentCode: p.studentCode || "-",
          name: `${p.name} (บุคลากร)`,
          classroom: clockNote,
          avatar: p.registeredFace || null,
          capturedFace: p.capturedFace,
          time: new Date().toLocaleTimeString("th-TH", { hour12: false }),
          confidence: p.confidence,
        }, ...prev].slice(0, 20));
      }
    } else {
      await recordScan(p.studentId, p.studentCode, p.name, p.classroom, p.avatar, p.confidence, p.capturedFace, p.registeredFace);
      // เรียนรู้ใบหน้าอัตโนมัติจากการสแกนจริงหน้าคีออส
      learnFromScan({
        studentId: p.studentId,
        descriptor: p.descriptor,
        match: p.match,
        sharpness: p.sharpness,
        faceSize: p.faceSize,
        source: "kiosk",
      }).catch(() => {});
    }
    confirmRef.current.delete(p.studentId);
    livenessRef.current.delete(p.studentId);
  }, [voiceEnabled, runGate, recordScan, clockStaff]);

  const cancelPendingManual = useCallback(() => {
    const p = pendingManualRef.current;
    if (!p) return;
    // กันโผล่ซ้ำเร็วเกินไป (คนเดิม) — ตั้ง cooldown 30 วิ
    cooldownRef.current.set(p.studentId, Date.now());
    pendingManualRef.current = null;
    setPendingManual(null);
    if (manualTimerRef.current) { window.clearTimeout(manualTimerRef.current); manualTimerRef.current = null; }
  }, []);



  useEffect(() => {
    if (!streaming || !modelReady || screensaver || qrOnly) return;
    let cancelled = false;
    // input ใหญ่ขึ้น = เก็บรายละเอียดใบหน้าได้มาก แต่กินซีพียูมาก — ปรับตามโปรไฟล์ประสิทธิภาพ
    const opts = detectorOptionsHQ(perf.inputSize, 0.35);
    // ขนาดใบหน้าขั้นต่ำ (พิกเซลในเฟรม) ป้องกัน descriptor เพี้ยนจากใบหน้าที่เล็กเกิน
    const MIN_FACE_PX = 56;
    // โหมดปกติ: ผ่อนเกณฑ์ให้จับได้เหมือนเดิม (เคยเข้ม Zkteco จนไม่พบ)
    const ZKTECO = false;
    const MIN_MARGIN = ZKTECO ? 0.06 : 0.04;
    const CONFIRM_FRAMES = ZKTECO ? 1 : 2;
    const CONFIRM_WINDOW_MS = 3000;

    // ── เกณฑ์แบบขั้นบันได ──────────────────────────────────────────────
    // tier 1: ระยะ ≤ 0.42 (cos_sim ≥ 0.58) → ยืนยันอัตโนมัติ (บันทึกได้เลย)
    // tier 2: 0.42 < ระยะ ≤ 0.55 (cos_sim 0.45–0.58) → ต้องให้คนกดยืนยันบนจอก่อน
    //         เหตุผล: คนที่ลงทะเบียนจากกล้องหน้ามือถือแล้วมาสแกนที่กล้องคีออส
    //         ระยะห่างอาจกว้างเพราะมุม/แสง/กล้องต่างกัน — ระดับนี้ยังน่าเชื่อถือพอ
    //         แต่กันคนหน้าคล้ายด้วยการให้เจ้าหน้าที่/ผู้ใช้ยืนยันด้วยตนเอง
    // ZKTeco mode: เข้ม+เร็ว แบบเครื่องสแกนประตูจริง — ยืนในวงรีแล้วเทียบครั้งเดียวผ่านเลย

    const AUTO_DIST = Math.min(0.52, threshold + 0.04);
    const STRONG_DIST = ZKTECO ? 0.36 : 0.40;
    const MANUAL_DIST = ZKTECO ? 0.40 : 0.55; // Zkteco ปิด tier2 manual ทั้งหมด

    const MANUAL_MIN_MARGIN = ZKTECO ? 0.06 : 0.03;
    const MANUAL_TIMEOUT_MS = 15_000;
    const ZKTECO_MIN_MARGIN = 0.06;

    // ความมั่นใจขั้นต่ำสำหรับ tier 1 (ยืนยันอัตโนมัติ) = 1 - AUTO_DIST = 0.58
    // (เดิม 0.66 → distance ≤ 0.34 ซึ่งเกิด "dead band" ช่วง 0.34–0.42
    //  match ระดับนี้ถูกตัดทั้ง tier1 และ tier2 ทั้งที่ยังควรยืนยันบนจอได้)
    const MIN_CONFIDENCE = 1 - AUTO_DIST;

    const MIN_SHARPNESS = 70; // ใต้ค่านี้ = เบลอเกินไป ไม่บันทึก (โหมดประหยัดข้ามการตรวจ)

    const snapCanvas = document.createElement("canvas");
    const roiCanvas = document.createElement("canvas");
    const roiCtx = roiCanvas.getContext("2d", { willReadFrequently: true });
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
      // รอให้ระบบพูดจบก่อน แล้วค่อยตรวจจับต่อ — กันสแกนถี่เกินและลดโหลด CPU
      if (isSpeaking()) {
        await waitForSpeechEnd();
        if (cancelled) return;
      }
      try {
        // ตรวจจับเฉพาะในวงรีไกด์ — ลด CPU 40–60% และบังคับให้ยืนกลางกรอบ
        const video = videoRef.current;
        const vw = video.videoWidth, vh = video.videoHeight;
        const useLiveness = livenessEnabled;
        const useTexture = textureGate;
        // วงรีเป้าหมายเดียวกับ FaceGuideOverlay (targetRatio 0.30, cy 0.46)
        const targetW = vw * 0.30;
        const targetH = targetW * 1.35;
        const cx = vw / 2, cy = vh * 0.46;
        const pad = 1.45; // เผื่อขยับเล็กน้อย
        const roiW = Math.min(vw, targetW * pad);
        const roiH = Math.min(vh, targetH * pad);
        const roiX = Math.max(0, Math.min(vw - roiW, cx - roiW / 2));
        const roiY = Math.max(0, Math.min(vh - roiH, cy - roiH / 2));
        // crop วิดีโอเป็น ROI canvas เล็ก — detector วิ่งบนพื้นที่ ~30% ของเฟรม
        let pre: HTMLCanvasElement | HTMLVideoElement = video;
        let roiOffsetX = 0, roiOffsetY = 0;
        if (roiCtx && vw && vh) {
          roiCanvas.width = Math.round(roiW);
          roiCanvas.height = Math.round(roiH);
          roiCtx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiCanvas.width, roiCanvas.height);
          pre = roiCanvas;
          roiOffsetX = roiX;
          roiOffsetY = roiY;
        }
        const rawDetections = await getAllDescriptors(pre as any, opts, {
          minFaceSize: MIN_FACE_PX * 0.6,
          cacheTtlMs: 300,
        });
        // แปลงพิกัดจาก ROI กลับเป็นพิกัดวิดีโอจริง
        const detections = roiOffsetX || roiOffsetY
          ? rawDetections.map((d: any) => {
              const b = d.detection.box;
              const nb = { ...b, x: b.x + roiOffsetX, y: b.y + roiOffsetY } as any;
              if (d.landmarks && typeof d.landmarks.shift === "function") {
                try { d.landmarks.shift(roiOffsetX, roiOffsetY); } catch {}
              }
              return { ...d, detection: { ...d.detection, box: nb } };
            })
          : rawDetections;

        // อัตราส่วนสำหรับสเกล box กลับสู่พิกัดของวิดีโอจริง (ROI แล้ว scale=1)
        const srcW = 1;
        const scaleBack = 1;
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
              // ประเมินความคมชัดของใบหน้าจริงในวิดีโอ — กล้องเบลอจะถูกปฏิเสธ (ข้ามในโหมดประหยัด)
              const sharpness = perf.checkSharpness ? estimateFaceSharpness(video, box) : MIN_SHARPNESS;
              const tooBlurry = sharpness < MIN_SHARPNESS;
              // แสงน้อย — วัดความสว่างบริเวณใบหน้า เพื่อให้คำแนะนำตอนสแกน
              // การวัดแสงใช้ canvas เพียง 32×32 จึงเบามากและต้องทำแม้โหมด Turbo
              // เดิมผูกกับ checkSharpness=false ทำให้ Kiosk ใช้ค่า 120 ตายตัวและไม่เคยหรี่กล้องที่ขาวโพลน
              const brightness = estimateBrightness(video, box);
              const tooDark = brightness > 0 && brightness < BANK_GRADE.BRIGHTNESS_MIN - 10;
              const tooBright = brightness > BANK_GRADE.BRIGHTNESS_MAX + 10;
              // กล้องโน้ตบุ๊ก/USB บางรุ่น ภาพมืดมากหรือขาวโพลน — ปรับ exposure ของฮาร์ดแวร์เองแบบสองทาง
              reportFrameLuminance(brightness);
              if ((tooDark || tooBright) && tNow - lastLowLightBoostRef.current > 1200) {
                lastLowLightBoostRef.current = tNow;
                // ปรับสองทางตามแสงจริง: ลด brightness/exposure/gain เมื่อขาว และเพิ่มเมื่อมืด
                void autoExposureBalance(video.srcObject as MediaStream | null, brightness);
              }


              // ต้องอยู่ในวงรีไกด์เท่านั้น — นอกกรอบไม่จับ (ลด CPU + กันคนเดินผ่านด้านข้าง)
              const guide = faceGuideStatus(box, { cx, cy, w: targetW, h: targetH });
              const inGuide = guide.ok;
              const m = matchDescriptor(det.descriptor, matchKnown, threshold);
              const ambiguous = m.studentId != null && m.margin < MIN_MARGIN;
              const lowConfidence = m.studentId != null && m.confidence < MIN_CONFIDENCE;
              // tier 1: แน่นพอ → ยืนยันอัตโนมัติ (เหมือนเดิม)
              const tier1 = m.studentId != null && m.distance <= AUTO_DIST && !ambiguous && !lowConfidence;
              // Zkteco ปิด tier2 ทั้งหมด — ไม่ต้องกดยืนยันบนจอ ผ่านคือผ่าน ไม่ผ่านคือไม่พบ
              const tier2 = !ZKTECO && m.studentId != null && m.distance > AUTO_DIST && m.distance <= MANUAL_DIST
                && m.margin >= MANUAL_MIN_MARGIN && m.confidence >= 1 - MANUAL_DIST;
              let matchedId = !tooSmall && !tooBlurry && (tier1 || tier2) ? m.studentId : null;
              // Zkteco ไม่ใช้ sticky lock — ยืนยันทันทีเฟรมเดียว ไม่ล็อกค้าง
              const kLock = ZKTECO ? null : kioskLockRef.current;
              if (!ZKTECO && !matchedId && kLock && tNow < kLock.until && m.studentId === kLock.studentId
                  && !tooSmall && m.confidence >= MIN_CONFIDENCE * 0.88) {
                matchedId = kLock.studentId;
              }
              const found = matchedId ? matchKnown.find((k: any) => k.studentId === matchedId) as any : null;
              if (found) kioskLockRef.current = { studentId: found.studentId, until: tNow + 1800 };
              const isStaffHit = !!found?.isStaff;
              const needsManual = matchedId != null && !tier1 && !!tier2;

              const justScanned = found ? (tNow - (justScannedRef.current.get(found.studentId) || 0) < 3000) : false;
              const inCooldown = found ? (tNow - (cooldownRef.current.get(found.studentId) || 0) < 30_000) : false;
              const textureFailed = found ? (tNow - (textureFailRef.current.get(found.studentId) || 0) < 3000) : false;
              const color = !found
                ? (!inGuide ? guide.color : tooSmall ? "#94a3b8" : tooBlurry ? "#64748b" : tooDark ? "#7c3aed" : tooBright ? "#f59e0b" : (ambiguous || lowConfidence) ? "#eab308" : "#f97316")
                : needsManual ? "#f59e0b"
                : isStaffHit ? "#2563eb"
                : textureFailed ? "#dc2626"
                : justScanned ? "#16a34a" : inCooldown ? "#10b981" : "#22c55e";

              const label = found
                ? `${isStaffHit ? "👤 " : ""}${found.name}${isStaffHit ? " (บุคลากร)" : needsManual ? " — แตะยืนยันบนจอ" : textureFailed ? " พื้นผิวไม่ตรง" : justScanned ? " ✓ บันทึกแล้ว" : ""}`
                : !inGuide ? guide.text
                : tooSmall ? "ขยับเข้าใกล้กล้อง"
                : tooBlurry ? "ภาพเบลอ ให้นิ่งสักครู่"
                : tooDark ? "แสงมืดเกินไป หาที่สว่างขึ้น"
                : tooBright ? "แสงจ้า/ย้อนแสง หลีกหน้าต่าง"
                : ambiguous ? "กำลังยืนยันตัวตน..."
                : lowConfidence ? `มั่นใจ ${Math.round(m.confidence * 100)}% • ต้อง ≥ ${Math.round(MIN_CONFIDENCE * 100)}%`
                : "ไม่พบในระบบ";
              const sublabel = found
                ? isStaffHit
                  ? `บุคลากร ${found.studentCode || "-"} • ${found.classroom} • ${Math.round(m.confidence * 100)}% (ทดสอบ — ไม่บันทึก)`
                  : needsManual
                    ? `ระดับกลาง ${Math.round(m.confidence * 100)}% (Δ${m.margin.toFixed(2)}) — รอแตะยืนยัน`
                    : `เลขที่ ${found.studentCode || "-"} • ชั้น ${found.classroom} • ${Math.round(m.confidence * 100)}% (Δ${m.margin.toFixed(2)}, ช ${Math.round(sharpness)})`
                : tooSmall ? `ใบหน้าเล็ก ${Math.round(faceSize)}px`
                : tooBlurry ? `ความคมชัด ${Math.round(sharpness)} • ต้อง ≥ ${MIN_SHARPNESS}`
                : tooDark ? `ความสว่าง ${Math.round(brightness)}`
                : tooBright ? `ความสว่าง ${Math.round(brightness)}`
                : ambiguous ? `ห่าง ${m.margin.toFixed(2)} • ต้อง ≥ ${MIN_MARGIN}`
                : lowConfidence ? "ขยับเข้าใกล้/หันตรงกล้อง"
                : "กรุณาลงทะเบียน";

              // กรอบนิ่ง (EMA) — ขยับหน้าเล็กน้อยกรอบจะไม่กระตุก/กระพริบ
              let drawBox = box;
              const sKey = found ? found.studentId : `anon-${Math.round(box.x / 40)}-${Math.round(box.y / 40)}`;
              const prevBox = kioskSmoothRef.current.get(sKey);
              if (prevBox) {
                const a = 0.45;
                drawBox = {
                  x: prevBox.x + (box.x - prevBox.x) * a,
                  y: prevBox.y + (box.y - prevBox.y) * a,
                  width: prevBox.width + (box.width - prevBox.width) * a,
                  height: prevBox.height + (box.height - prevBox.height) * a,
                };
              }
              kioskSmoothRef.current.set(sKey, drawBox);
              if (kioskSmoothRef.current.size > 24) kioskSmoothRef.current.clear();

              drawFaceFrame(ctx, { box: drawBox, label, sublabel, matched: !!found, confidence: m.confidence, color });


              if (found) {
                if (needsManual) {
                  // tier 2: ต้องผ่าน liveness + texture ก่อนตั้งป๊อปอัปยืนยันบนจอ
                  // (กันรูปถ่าย/จอภาพ/คนหน้าคล้ายที่ mid-confidence ผ่านแค่การแตะปุ่ม)
                  if (pendingManualRef.current) return; // กำลังรอคนกดยืนยันอยู่แล้ว
                  let live = true;
                  if (useLiveness) {
                    let track = livenessRef.current.get(found.studentId);
                    if (!track) { track = newLivenessTrack(); livenessRef.current.set(found.studentId, track); }
                    live = recordLivenessSample(track, makeLivenessSample(tNow, det.landmarks, box)).live;
                  }
                  if (!live) return; // ยังไม่มีหลักฐานใบหน้าสด (รูปถ่าย/จอภาพนิ่ง) — รอ
                  if (useTexture && !isStaffHit) {
                    const regSrc = await getRegisteredFaceImage(found.studentId, found.avatar || null);
                    const tv = await verifyScanTexture({
                      studentId: found.studentId,
                      video,
                      landmarks: det.landmarks,
                      scaleX: scaleBack,
                      scaleY: scaleBack,
                      registeredImageSrc: regSrc,
                    });
                    if (!tv.pass) {
                      textureFailRef.current.set(found.studentId, tNow);
                      livenessRef.current.delete(found.studentId);
                      if (voiceEnabled) speakText("พื้นผิวใบหน้าไม่ตรง ขอตรวจสอบ");
                      return;
                    }
                  }
                  // ผ่าน liveness + texture → ตั้งป๊อปอัปครั้งเดียว (กันโผล่ซ้ำ 30 วิ)
                  if (tNow - (cooldownRef.current.get(found.studentId) || 0) >= 30_000) {
                    const captured = captureFaceCrop(video, box);
                    const regSrc = await getRegisteredFaceImage(found.studentId, found.avatar || null);
                    pendingManualRef.current = {
                      studentId: found.studentId,
                      studentCode: found.studentCode || "-",
                      name: found.name,
                      classroom: found.classroom,
                      avatar: found.avatar || null,
                      isStaff: isStaffHit,
                      confidence: m.confidence,
                      capturedFace: captured,
                      registeredFace: regSrc || (found as any).registeredFace || null,
                      match: m,
                      descriptor: det.descriptor,
                      sharpness,
                      faceSize,
                    };
                    setPendingManual(pendingManualRef.current);
                    if (manualTimerRef.current) window.clearTimeout(manualTimerRef.current);
                    manualTimerRef.current = window.setTimeout(() => {
                      if (pendingManualRef.current) {
                        pendingManualRef.current = null;
                        setPendingManual(null);
                      }
                    }, MANUAL_TIMEOUT_MS);
                    if (voiceEnabled) speakText("กรุณาแตะยืนยันบนจอ");
                  }
                  // รอการยืนยัน — ไม่บันทึกอัตโนมัติ
                  return;
                }
                // Fast-pass + ในวงรีไกด์ → ยืนยันทันทีเฟรมเดียว ไม่ต้องวนลูป (ตามคำขอ: ไม่วนลูปยืนยัน)
                const strongHit = m.distance <= STRONG_DIST && m.margin >= MIN_MARGIN * 1.5 && faceSize >= MIN_FACE_PX * 1.1;
                // ในวงรีไกด์ → ยืนยันทันทีเฟรมเดียว ไม่ต้องวนลูป
                const needFrames = inGuide ? 1 : strongHit ? 1 : CONFIRM_FRAMES;
                // นับเฟรมเฉพาะเมื่อไม่อยู่ในโหมด immediate
                if (!inGuide) {
                  const c = confirmRef.current.get(found.studentId);
                  if (c && tNow - c.lastTs <= CONFIRM_WINDOW_MS) { c.count += 1; c.lastTs = tNow; }
                  else confirmRef.current.set(found.studentId, { count: 1, lastTs: tNow });
                } else {
                  confirmRef.current.set(found.studentId, { count: needFrames, lastTs: tNow });
                }
                const confirmed = inGuide ? true : (confirmRef.current.get(found.studentId)?.count ?? 0) >= needFrames;
                // ใบหน้าสด: ในวงรีให้ผ่านทันที (ลดหน่วง) — นอกวงรีค่อยตรวจ blink
                let live = true;
                if (useLiveness && !inGuide) {
                  let track = livenessRef.current.get(found.studentId);
                  if (!track) { track = newLivenessTrack(); livenessRef.current.set(found.studentId, track); }
                  live = recordLivenessSample(track, makeLivenessSample(tNow, det.landmarks, box)).live;
                  if (!live && strongHit) {
                    const firstSeen = (track.samples[0]?.t ?? tNow);
                    if (tNow - firstSeen > 400) live = true;
                  }
                }
                if (confirmed && live) {
                  // Texture verification — เทียบพื้นผิวใบหน้าสดกับภาพลงทะเบียน กันคนหน้าคล้าย/รูปถ่าย
                  if (useTexture && !isStaffHit && !strongHit) {

                    const regSrc = await getRegisteredFaceImage(found.studentId, found.avatar || null);
                    const tv = await verifyScanTexture({
                      studentId: found.studentId,
                      video,
                      landmarks: det.landmarks,
                      scaleX: scaleBack,
                      scaleY: scaleBack,
                      registeredImageSrc: regSrc,
                    });
                    if (!tv.pass) {
                      textureFailRef.current.set(found.studentId, tNow);
                      confirmRef.current.delete(found.studentId);
                      livenessRef.current.delete(found.studentId);
                      if (voiceEnabled) speakText("พื้นผิวใบหน้าไม่ตรง ขอตรวจสอบ");
                      setLastMatch(null);
                      return;
                    }
                  }
                  const captured = captureFaceCrop(video, box);
                  if (isStaffHit) {
                    const last = justScannedRef.current.get(found.studentId) || 0;
                    if (tNow - last > 15_000) {
                      justScannedRef.current.set(found.studentId, tNow);
                      playSuccessSound();
                      const mode = scanModeRef.current === "exit" ? "exit" : "entry";
                      void runGate(found.name, { id: found.studentId, kind: "personnel" });
                      let clockNote = "บุคลากร (ทดสอบ)";
                      if (staffClockRef.current) {
                        clockNote = await clockStaff(found.studentId, mode, captured, m.confidence, found.name);
                      } else if (voiceEnabled) {
                        speakText(`สวัสดี ${found.name}`);
                      }
                      setLastMatch({
                        name: found.name,
                        studentCode: found.studentCode || "-",
                        classroom: `${found.classroom} • ${clockNote}`,
                        confidence: m.confidence,
                        scanType: mode,
                        capturedFace: captured,
                        registeredFace: (found as any).registeredFace || null,
                        time: new Date().toLocaleTimeString("th-TH", { hour12: false }),
                      });
                      setRecent((prev) => [{
                        studentId: found.studentId,
                        studentCode: found.studentCode || "-",
                        name: `${found.name} (บุคลากร)`,
                        classroom: clockNote,
                        avatar: (found as any).registeredFace || null,
                        capturedFace: captured,
                        time: new Date().toLocaleTimeString("th-TH", { hour12: false }),
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
                  livenessRef.current.delete(found.studentId);
                }
              } else {
                if (!tooSmall && !ambiguous && tNow - unknownBeepRef.current > 5000) {
                  unknownBeepRef.current = tNow;
                  playUnknownSound();
                  showNotice("error", "ไม่พบข้อมูลใบหน้า", "กรุณาลงทะเบียนใบหน้าก่อนใช้งาน", 3500);
                  if (voiceEnabled && !tooBlurry && !lowConfidence) {
                    speakText("ไม่พบข้อมูลใบหน้าในระบบ กรุณาลงทะเบียน");
                  }
                }
              }
            }));
          }
        }
        if (detections.length > 0) lastDetectedAtRef.current = Date.now();
      } catch (e) {
        console.error("kiosk detect err", e);
      }
      if (!cancelled) {
        // ปล่อยให้เบราว์เซอร์วาดเฟรมก่อนเริ่มรอบใหม่ → ภาพไม่กระตุก
        detectionLoopRef.current = window.setTimeout(
          () => requestAnimationFrame(() => { if (!cancelled) void loop(); }),
          perf.loopDelayMs + scanGapMs,
        );
      }
    };
    loop();
    return () => {
      cancelled = true;
      if (detectionLoopRef.current) clearTimeout(detectionLoopRef.current);
    };
  }, [streaming, modelReady, screensaver, matchKnown, threshold, recordScan, camMode, qrOnly, voiceEnabled, scanModeRef, runGate, perf, scanGapMs, livenessEnabled, textureGate, showNotice]);

  // ===== WizMind bridge: รับ event ใบหน้าจากกล้อง CCTV แบบ realtime แล้วจดจำทันที =====
  useEffect(() => {
    if (!wizmindOn || !modelReady || qrOnly) return;
    let cancelled = false;
    let busy = false;
    const queue: CameraFaceEvent[] = [];
    const opts = detectorOptionsHQ(416, 0.3);
    const cropCanvas = document.createElement("canvas");

    const toDataUrl = (img: HTMLImageElement, box?: { x: number; y: number; width: number; height: number }) => {
      try {
        const target = 160;
        cropCanvas.width = target; cropCanvas.height = target;
        const ctx = cropCanvas.getContext("2d");
        if (!ctx) return undefined;
        if (box) {
          const pad = 0.2;
          const px = Math.max(0, box.x - box.width * pad);
          const py = Math.max(0, box.y - box.height * pad);
          const pw = Math.min(img.naturalWidth - px, box.width * (1 + pad * 2));
          const ph = Math.min(img.naturalHeight - py, box.height * (1 + pad * 2));
          ctx.drawImage(img, px, py, pw, ph, 0, 0, target, target);
        } else {
          ctx.drawImage(img, 0, 0, target, target);
        }
        return cropCanvas.toDataURL("image/jpeg", 0.8);
      } catch { return undefined; }
    };

    const process = async (ev: CameraFaceEvent) => {
      let img: HTMLImageElement | null = null;
      try {
        img = await loadEventImage(ev.snapshot_path as string);
        if (!img || cancelled) return;
        const dets = await getAllDescriptors(img as any, opts);
        if (!dets.length) { await markEventProcessed(ev.id, { matchedName: null }); return; }
        // เลือกใบหน้าที่ใหญ่สุดในภาพ (กล้อง crop มาแล้วมักมีหน้าเดียว)
        const det = dets.reduce((a, b) => (a.detection.box.width >= b.detection.box.width ? a : b));
        const m = matchDescriptor(det.descriptor, matchKnown, threshold);
        const found = m.studentId ? (matchKnown.find((k: any) => k.studentId === m.studentId) as any) : null;
        if (!found || m.confidence < 0.66) {
          await markEventProcessed(ev.id, { matchedName: null, distance: m.distance ?? null });
          return;
        }
        const captured = toDataUrl(img, det.detection.box as any);
        if (!found.isStaff) {
          await recordScan(found.studentId, found.studentCode, found.name, found.classroom, found.avatar, m.confidence, captured, found.registeredFace);
        }
        setWizmindCount((c) => c + 1);
        await markEventProcessed(ev.id, {
          matchedUserId: found.isStaff ? null : found.studentId,
          matchedName: found.name,
          personType: found.isStaff ? "staff" : "student",
          distance: m.distance ?? null,
        });
      } catch (e) {
        console.error("wizmind event err", e);
      } finally {
        releaseEventImage(img);
      }
    };

    const pump = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        while (queue.length && !cancelled) {
          const ev = queue.shift()!;
          if (!isEventFresh(ev)) continue; // ทิ้ง event ค้างคิว เพื่อคง realtime
          await process(ev);
        }
      } finally { busy = false; }
    };

    const unsub = subscribeWizmindEvents(
      wizmindCam.trim(),
      (ev) => {
        // เก็บคิวสั้น ๆ (สูงสุด 5) — ถ้ามาถี่เกินให้ทิ้งของเก่า
        queue.push(ev);
        while (queue.length > 5) queue.shift();
        void pump();
      },
      (status) => setWizmindStatus(status),
    );

    return () => { cancelled = true; unsub(); };
  }, [wizmindOn, wizmindCam, modelReady, qrOnly, matchKnown, threshold, recordScan]);



  // ===== QR Code fallback scan (รองรับกรณีสแกนหน้าไม่ติด) =====
  // อ่าน QR จากเฟรมวิดีโอเดียวกัน ใช้ native BarcodeDetector ถ้ามี
  // กันสแกนซ้ำผ่าน seenTodayRef + cooldownRef เดิม (รวมถึงเคสจับทั้งหน้า+QR พร้อมกัน)
  const qrCooldownRef = useRef<Map<string, number>>(new Map());
  const lastQrAtRef = useRef<number>(0);
  const [qrEngine, setQrEngine] = useState<string>("");
  useEffect(() => {
    if (!streaming || screensaver) return;
    // @ts-ignore — BarcodeDetector ยังไม่อยู่ใน TS lib มาตรฐาน
    const BD: any = (window as any).BarcodeDetector;
    const scanCanvas = document.createElement("canvas");
    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
    // โหลด jsQR เสมอ — Chromium บน Linux มักมี BarcodeDetector แต่ใช้งานจริงไม่ได้ (คืนค่าว่างตลอด)
    let jsQR: any = null;
    import("jsqr").then((m) => { jsQR = m.default; }).catch(() => {});
    let cancelled = false;
    let detector: any = null;
    let detectorMisses = 0;      // นับเฟรมที่ native detector ไม่เจออะไรเลย
    let detectorHits = 0;
    if (BD) {
      (async () => {
        try {
          // ถ้าไม่รองรับ qr_code (เช่น Linux ที่ไม่มี barcode service) → ไม่ใช้ native
          const supported: string[] = (await BD.getSupportedFormats?.()) || [];
          if (supported.length && !supported.includes("qr_code")) return;
          try {
            detector = new BD({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
          } catch {
            detector = new BD({ formats: ["qr_code"] });
          }
        } catch {
          detector = null;
        }
      })();
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

      // 3) ไม่ใช่นักเรียน → ลองเป็นบัตรบุคลากร (ลงเวลาปฏิบัติงาน)
      if (!student) {
        try {
          const { data: pData } = await (supabase as any).rpc("resolve_scanned_personnel", { _input: raw });
          const p = Array.isArray(pData) ? pData[0] : pData;
          if (p?.id) {
            const pName = `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim() || p.employee_code;
            const mode = scanModeRef.current === "exit" ? "exit" : "entry";
            const last = justScannedRef.current.get(p.id) || 0;
            if (tNow - last < 15_000) return;
            justScannedRef.current.set(p.id, tNow);
            playSuccessSound();
            void runGate(pName, { id: p.id, kind: "personnel" });
            const clockNote = staffClockRef.current
              ? await clockStaff(p.id, mode, undefined, 1, pName)
              : "บุคลากร (ปิดลงเวลา)";
            setLastMatch({
              name: pName,
              studentCode: p.employee_code || "-",
              classroom: `${p.position_name || "บุคลากร"} • ${clockNote}`,
              confidence: 1,
              scanType: mode,
              capturedFace: undefined,
              registeredFace: null,
              time: new Date().toLocaleTimeString("th-TH", { hour12: false }),
            });
            if (matchTimerRef.current) window.clearTimeout(matchTimerRef.current);
            matchTimerRef.current = window.setTimeout(() => setLastMatch(null), 6000);
            return;
          }
        } catch {}
      }

      if (!student) {
        if (tNow - unknownBeepRef.current > 4000) {
          unknownBeepRef.current = tNow;
          playUnknownSound();
          showNotice("error", "QR ไม่พบข้อมูลในระบบ", extracted.slice(0, 20), 3000);
        }
        return;
      }

      await recordScan(student.studentId, student.studentCode, student.name, student.classroom, student.avatar || null, 1, undefined, null, "qr");

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
            { sx: W * 0.3, sy: H * 0.25, sw: W * 0.4, sh: H * 0.5, maxW: 520 },
          ]
        : [
            { sx: 0, sy: 0, sw: W, sh: H, maxW: 800 },
            { sx: 0, sy: 0, sw: W * 0.55, sh: H * 0.55, maxW: 640 },
            { sx: W * 0.45, sy: 0, sw: W * 0.55, sh: H * 0.55, maxW: 640 },
            { sx: 0, sy: H * 0.45, sw: W * 0.55, sh: H * 0.55, maxW: 640 },
            { sx: W * 0.45, sy: H * 0.45, sw: W * 0.55, sh: H * 0.55, maxW: 640 },
            { sx: W * 0.3, sy: H * 0.25, sw: W * 0.4, sh: H * 0.5, maxW: 560 },
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
        const res = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
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
          try {
            const codes = await detector.detect(videoRef.current);
            rawCodes = (codes || []).map((c: any) => String(c.rawValue || "").trim()).filter(Boolean);
          } catch {
            // native detector พัง (Linux/ไม่มี service) → เลิกใช้ ไปใช้ jsQR
            detector = null;
          }
          if (rawCodes.length) detectorHits++;
          else detectorMisses++;
          // ไม่เคยอ่านได้เลยใน ~8 วินาทีแรก → ปิด native แล้วใช้ jsQR แทน
          if (detector && detectorHits === 0 && detectorMisses > 60 && jsQR) {
            detector = null;
            setQrEngine("jsQR");
          }
          // เสริมด้วย jsQR ระหว่างที่ native ยังไม่เคยอ่านได้ (กันเคสอ่านไม่ออกเงียบ ๆ)
          if (!rawCodes.length && detectorHits === 0 && jsQR) {
            rawCodes = scanJsQrMulti(videoRef.current);
          }
        } else {
          rawCodes = scanJsQrMulti(videoRef.current);
        }
        if (rawCodes.length) lastQrAtRef.current = Date.now();
        const tNow = Date.now();
        await Promise.all(rawCodes.map((r) => processCode(r, tNow)));
      } catch (e) {
        // ignore frame errors
      }
      // BarcodeDetector: 120ms / Desktop jsQR: 250ms / Low-end (Atom): 350ms
      const interval = detector ? 120 : (isLowEnd ? 350 : 250);
      if (!cancelled) setTimeout(loop, interval);
    };
    setQrEngine(BD ? "native" : "jsQR");
    loop();


    return () => { cancelled = true; };
  }, [streaming, screensaver, known, recordScan, clockStaff, runGate, showNotice]);



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

  // Power save: door ตู้หน้าประตูต้องพร้อมสแกนตลอด — ไม่ปิดกล้องตอนพักหน้าจอ (กันค้าง/รอเปิดกล้องนาน)
  useEffect(() => {
    if (!powerSave) return;
    // Door: keep camera on for instant wake (fix hang after long idle)
    // if (screensaver && streaming) stopCamera();
  }, [screensaver, powerSave, streaming, stopCamera]);

  // Wake-loop: ตรวจใบหน้าเบา ๆ ตอนพักหน้าจอ — door ให้ทำงานแม้ powerSave เพราะกล้องไม่ปิดแล้ว
  useEffect(() => {
    if (!screensaver) return;
    // if (powerSave) return; // door: keep detecting to wake instantly
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
          reasonLabel={screensaverReason}
          wakeWordEnabled={wakeWordEnabled}
        />
      )}

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
          <QrCode className="w-3 h-3 mr-1" /> {qrOnly ? "QR เท่านั้น" : "QR สำรอง"}{qrEngine ? ` • ${qrEngine}` : ""}
        </Badge>
        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-white/60 text-slate-700">
          {online ? <Wifi className="w-3 h-3 mr-1 text-emerald-600" /> : <WifiOff className="w-3 h-3 mr-1 text-amber-500" />}
          {online ? "ออนไลน์" : "ออฟไลน์"}
        </Badge>
        <Badge variant="secondary" className={`backdrop-blur-sm border-white/60 ${matchKnown.length === 0 ? "bg-red-100 text-red-700 animate-pulse" : "bg-white/80 text-slate-700"}`}>
          ใบหน้า {matchKnown.length} คน {matchKnown.length === 0 ? "⚠️ โหลดไม่เข้า" : ""}
        </Badge>
        {isTodayHoliday && (
          <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse">วันหยุด - ไม่นับขาด</Badge>
        )}
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
        <div className="absolute top-12 right-2 z-40 bg-card text-foreground rounded-xl p-4 w-80 shadow-2xl space-y-3 max-h-[calc(100vh-4.5rem)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]" onClick={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
          <h3 className="font-semibold text-sm">ตั้งค่ากล้อง</h3>
          <div className="flex gap-1">
            <Button size="sm" variant={camMode === "standard" ? "default" : "outline"} onClick={() => switchCamMode("standard")} className="flex-1">มาตรฐาน</Button>
            <Button size="sm" variant={camMode === "wide" ? "default" : "outline"} onClick={() => switchCamMode("wide")} className="flex-1">มุมกว้าง</Button>
            <Button size="sm" variant={camMode === "network" ? "default" : "outline"} onClick={() => switchCamMode("network")} className="flex-1 gap-1">
              <Cctv className="w-3 h-3" />CCTV
            </Button>
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <label className="text-xs font-semibold">ประสิทธิภาพการสแกน</label>
            <p className="text-[11px] font-medium">⚡ {KIOSK_TURBO_PROFILE.label}</p>
            <p className="text-[10px] text-muted-foreground leading-snug">
              กล้อง {KIOSK_TURBO_PROFILE.videoWidth}×{KIOSK_TURBO_PROFILE.videoHeight}@{KIOSK_TURBO_PROFILE.frameRate}fps •
              ตรวจทุก {KIOSK_TURBO_PROFILE.loopDelayMs}ms • ปรับจูนอัตโนมัติสำหรับเครื่องสเปกต่ำ ไม่ต้องเลือกโหมดอีกต่อไป
            </p>
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <label className="text-xs font-semibold">ช่วงเว้นระยะระหว่างสแกน</label>
            <div className="flex gap-1 flex-wrap">
              {[0, 300, 600, 1000, 1500].map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={scanGapMs === g ? "default" : "outline"}
                  onClick={() => setScanGapMs(g)}
                  className="flex-1 text-[11px] px-1 min-w-[52px]"
                >
                  {g === 0 ? "ปกติ" : `+${g / 1000}s`}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              ระบบจะรอให้พูดจบก่อนเสมอ แล้วเว้นอีก {(scanGapMs / 1000).toFixed(1)} วินาทีก่อนจับใบหน้ารอบถัดไป — ช่วยลดการสแกนถี่เกินและลดโหลดเครื่อง
            </p>
          </div>

          <div className="space-y-1.5 border-t pt-2">
            <label className="text-xs font-semibold">ทดสอบเสียงพูด</label>
            <Button
              size="sm"
              variant="outline"
              disabled={audioTesting}
              className="w-full text-[11px]"
              onClick={async () => {
                setAudioTesting(true);
                setAudioDiag(["⏳ กำลังตรวจระบบเสียง..."]);
                try {
                  const r = await diagnoseAudio();
                  setAudioDiag(r.lines);
                } catch (e: any) {
                  setAudioDiag([`❌ ตรวจไม่สำเร็จ: ${e?.message || e}`]);
                } finally {
                  setAudioTesting(false);
                }
              }}
            >
              {audioTesting ? "กำลังทดสอบ..." : "เล่นเสียงทดสอบ + ตรวจระบบเสียง"}
            </Button>
            {audioDiag.length > 0 && (
              <div className="rounded-md bg-muted/60 p-2 space-y-0.5">
                {audioDiag.map((l, i) => (
                  <p key={i} className="text-[10px] leading-snug break-words">{l}</p>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground leading-snug">
              ถ้าได้ยินเสียง "ตึ๊ง" แต่ไม่ได้ยินเสียงพูด แปลว่าลำโพงใช้ได้แต่ TTS มีปัญหา — ถ้าไม่ได้ยินเลย ให้รัน <code>/opt/kiosk/fix-audio.sh</code> บนตู้
            </p>

          </div>

          <div className="space-y-1.5 border-t pt-2">
            <label className="text-xs font-semibold flex items-center gap-1"><ScanFace className="w-3 h-3" /> ดาวน์โหลดใบหน้าลงเครื่อง (ออฟไลน์)</label>
            <div className="rounded-md bg-muted/40 p-2 text-[10px] leading-snug">
              {faceCacheMeta ? (
                <p>แคช: {faceCacheMeta.count || faceCacheMeta.totalDescriptors || "?"} คน • {faceCacheMeta.savedAt ? new Date(faceCacheMeta.savedAt).toLocaleString("th-TH") : "-"}</p>
              ) : <p className="text-muted-foreground">ยังไม่เคยดาวน์โหลด — กดปุ่มด้านล่างเพื่อเก็บไว้ในเครื่อง</p>}
              {faceCacheDir && <p className="truncate">โฟลเดอร์: {faceCacheDir}/bngss-faces.json</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-[11px]" disabled={downloadingFaces} onClick={async () => {
                setDownloadingFaces(true);
                try {
                  const { faces, dirName } = await downloadFacesToCache();
                  setFaceCacheMeta({ count: faces.length, savedAt: new Date().toISOString() });
                  if (dirName) setFaceCacheDir(dirName);
                  qc.invalidateQueries({ queryKey: ["face-known-kiosk"] });
                  toast.success(`ดาวน์โหลด ${faces.length} คนลงเครื่องแล้ว`);
                } catch (e: any) { toast.error(e?.message || "ดาวน์โหลดไม่สำเร็จ"); }
                finally { setDownloadingFaces(false); }
              }}>{downloadingFaces ? "..." : "ดาวน์โหลดลงเครื่อง"}</Button>
              <Button size="sm" variant="outline" className="flex-1 text-[11px]" disabled={downloadingFaces} onClick={async () => {
                try {
                  if (!(await hasFileSystemAccess())) { toast.error("เบราว์เซอร์นี้ไม่รองรับการเลือกโฟลเดอร์"); return; }
                  setDownloadingFaces(true);
                  // ดาวน์โหลดก่อนแล้วให้เลือกโฟลเดอร์
                  const { faces } = await downloadFacesToCache();
                  const dir = await pickAndSaveFaceFolder(faces as any);
                  if (dir) { setFaceCacheDir(dir); toast.success(`บันทึกไฟล์ลงโฟลเดอร์ ${dir} แล้ว`); }
                  setFaceCacheMeta({ count: faces.length, savedAt: new Date().toISOString() });
                  qc.invalidateQueries({ queryKey: ["face-known-kiosk"] });
                } catch (e: any) { toast.error(e?.message || "เลือกโฟลเดอร์ไม่สำเร็จ"); }
                finally { setDownloadingFaces(false); }
              }}>เลือกโฟลเดอร์</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">ครั้งต่อไปจะใช้ข้อมูลในเครื่องก่อน ไม่ต้องรอดาวน์โหลดใหม่ — เจอหน้าแล้วค่อยยิงผลไป server ช่วยสแกนไวขึ้น</p>
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
            </p>
            {staffFaceEnabled && (
              <>
                <label className="text-xs font-semibold flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={staffClockEnabled}
                    onChange={(e) => setStaffClockEnabled(e.target.checked)}
                  />
                  ลงเวลาปฏิบัติงานอัตโนมัติ
                </label>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  เมื่อเปิด บุคลากรที่สแกนใบหน้าจะถูกบันทึก <b>เวลาเข้า/ออกงาน</b> ตามโหมดสแกนของเครื่อง
                  (เข้าหลัง 08:30 น. = สาย, วันละ 1 รายการ) — ถ้าปิดไว้จะเป็นโหมดทดสอบเท่านั้น
                </p>
              </>
            )}
          </div>


          <div className="space-y-2 border-t pt-2">
            <label className="text-xs font-semibold flex items-center gap-2">
              <input type="checkbox" checked={wizmindOn} onChange={(e) => setWizmindOn(e.target.checked)} />
              โหมด WizMind Bridge (realtime จาก CCTV)
            </label>
            <Input
              value={wizmindCam}
              onChange={(e) => setWizmindCam(e.target.value)}
              placeholder="camera_id (เว้นว่าง = ทุกกล้อง)"
              className="text-xs h-8"
            />
            <p className="text-[10px] text-muted-foreground leading-snug">
              กล้อง Dahua WizMind ตรวจจับใบหน้าเองแล้วส่งภาพ best-shot เข้าระบบผ่าน bridge
              เครื่องนี้จะ <b>จดจำและบันทึกทันที</b> โดยไม่ต้องรัน detection ทั้งเฟรม (ลด CPU • หน่วง ~0.5–1.5 วิ)
            </p>
            {wizmindOn && (
              <p className="text-[10px] text-muted-foreground">
                สถานะ: <b>{wizmindStatus || "กำลังเชื่อมต่อ…"}</b> • ประมวลผลแล้ว {wizmindCount} เหตุการณ์
              </p>
            )}
          </div>


          <SmartGatePanel gate={gate} />

          <div className="text-xs text-muted-foreground border-t pt-2">
            threshold: <b>{threshold}</b> • ใบหน้านักเรียน {known.length}
            {staffFaceEnabled && <> • บุคลากร {staffKnown.length}</>}
          </div>

        </div>
      )}

      {/* Main grid: camera (left) + scan list (right) */}
      <div
        className={`absolute inset-0 grid gap-3 p-3 pt-12 pb-28 ${
          portrait ? "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,38%)]" : "grid-cols-[1fr_360px] grid-rows-1"
        }`}
      >
        {/* Camera panel with school header */}
        <div className="relative min-h-0 rounded-2xl overflow-hidden bg-white shadow-xl flex flex-col" style={cameraPanelStyle}>
          {/* School header banner */}
          <div className="flex items-center justify-between gap-3 px-5 py-3" style={headerBannerStyle}>
            <div className="flex items-center gap-3">
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
            <Button size="sm" variant="outline" className="shrink-0 bg-white/80 backdrop-blur text-xs" onClick={() => setRegisterOpen(true)}>
              <ScanFace className="w-4 h-4 mr-1" /> ลงทะเบียนใบหน้า
            </Button>
          </div>


          {/* Camera feed */}
          <div className="relative flex-1 bg-black">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            <FaceGuideOverlay
              videoRef={videoRef}
              active={streaming && modelReady && !screensaver && !qrOnly}
              targetRatio={0.30}
              topLabel="ยืนกลางกรอบ • ห่าง 70–120 ซม."
              fit="cover"
              mirror={camMode !== "network" && camMode !== "wide"}
            />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {/* AI camera overlay tag */}
            <div className="absolute top-3 right-3 z-10 bg-black/50 text-pink-200 text-xs font-mono px-2 py-1 rounded">
              {schoolName ? `${schoolName} · AI Camera No.1` : "AI Camera No.1"}
            </div>
            <div className="absolute top-3 left-3 z-10 bg-black/50 text-pink-200 text-xs font-mono px-2 py-1 rounded tabular-nums">
              {now.toLocaleDateString("en-GB").replace(/\//g, "-")} {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>

            {pendingManual && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
                <div className="animate-scale-in rounded-3xl bg-white p-6 shadow-2xl border-4 border-amber-400 max-w-md w-full mx-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-xl font-bold text-amber-600">กรุณายืนยันตัวตน</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    ระดับความแน่ใจกลาง (มือถือ vs กล้องคีออส) — ตรวจสอบว่าเป็นคุณ แล้วแตะ <b>ยืนยัน</b>
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-300 mx-auto">
                        {pendingManual.registeredFace
                          ? <img src={pendingManual.registeredFace} alt="ที่ลงทะเบียน" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">ไม่มีภาพ</div>}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-600 mt-1">ที่ลงทะเบียน</p>
                    </div>
                    <div className="text-center">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-300 mx-auto">
                        {pendingManual.capturedFace
                          ? <img src={pendingManual.capturedFace} alt="ตอนสแกน" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">-</div>}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-600 mt-1">ตอนสแกน</p>
                    </div>
                  </div>
                  <div className="text-center mt-3">
                    <p className="text-lg font-bold text-slate-800 truncate">{pendingManual.name}</p>
                    <p className="text-xs text-slate-500">{pendingManual.studentCode} · ชั้น {pendingManual.classroom}</p>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">ความมั่นใจ {Math.round(pendingManual.confidence * 100)}%</p>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <Button variant="outline" className="flex-1 h-12 text-base" onClick={cancelPendingManual}>
                      ไม่ใช่
                    </Button>
                    <Button className="flex-1 h-12 text-base" style={{ backgroundColor: themePrimary }} onClick={() => void confirmPendingManual()}>
                      ยืนยัน ใช่ฉันเอง
                    </Button>
                  </div>
                  <p className="text-center text-[11px] text-slate-400 mt-3">
                    หมดเวลาอัตโนมัติใน 15 วินาที — ระบบจะยกเลิกหากไม่แตะ
                  </p>
                </div>
              </div>
            )}

            {/* ผลการจับคู่ล่าสุด: ใบหน้าที่ลงทะเบียน vs ใบหน้าตอนสแกน */}
            {lastMatch && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-scale-in w-[92%] max-w-[640px]">
                <div className={`flex flex-wrap items-center justify-center gap-4 rounded-2xl px-5 py-3 shadow-2xl backdrop-blur bg-white/95 border-2 ${lastMatch.scanType === "exit" ? "border-rose-400" : "border-emerald-400"}`}>
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
                  <div className="pl-3 sm:border-l border-slate-200 min-w-[190px]">
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

            {/* ข้อความเตือน/แจ้งเตือนกลางจอ — ให้ใหญ่เห็นชัด เหมือนสแกนสำเร็จ */}
            {notice && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-scale-in">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={clearNotice} />
                <div className={`relative max-w-xl w-full rounded-3xl border-4 p-6 shadow-2xl text-center ${
                  notice.type === "error"
                    ? "bg-rose-50 border-rose-500 text-rose-900"
                    : notice.type === "warning"
                      ? "bg-amber-50 border-amber-500 text-amber-900"
                      : "bg-sky-50 border-sky-500 text-sky-900"
                }`}>
                  {notice.type === "error" && <XCircle className="w-20 h-20 mx-auto mb-4 text-rose-600" />}
                  {notice.type === "warning" && <AlertTriangle className="w-20 h-20 mx-auto mb-4 text-amber-600" />}
                  {notice.type === "info" && <Info className="w-20 h-20 mx-auto mb-4 text-sky-600" />}
                  <h3 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3">{notice.title}</h3>
                  <p className="text-xl sm:text-2xl font-medium opacity-90">{notice.description}</p>
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
        <div className="min-h-0 rounded-2xl bg-white/80 backdrop-blur shadow-xl overflow-hidden flex flex-col" style={sidePanelStyle}>
          <div className="px-3 py-2" style={sideHeaderStyle}>
            <h2 className="text-sm font-bold" style={{ color: themeAccent }}>รายการสแกนล่าสุด</h2>
          </div>

          <div className={`flex-1 overflow-y-auto p-2 ${portrait ? "grid grid-cols-2 gap-2 content-start" : "space-y-2"}`}>
            {recent.length === 0 ? (
              <p className={`text-center text-sm text-slate-400 py-12 ${portrait ? "col-span-2" : ""}`}>ยังไม่มีการสแกน</p>
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

      <KioskFaceRegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} onRegistered={() => { qc.invalidateQueries({ queryKey: ["face-known-kiosk"] }); qc.invalidateQueries({ queryKey: ["face-known"] }); }} />

      {/* Bottom bar: clock + ONLINE + ลงทะเบียน */}
      <div className="absolute bottom-0 inset-x-0 z-30 p-3 flex items-center justify-center gap-3" style={bottomBarStyle}>
        <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-md" style={clockCardStyle}>
          <span className="font-mono text-3xl font-bold tabular-nums" style={{ color: themePrimary }}>
            {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
        <Button size="lg" className="bg-white hover:bg-white/90 text-slate-800 shadow-md rounded-xl px-5 py-6 font-bold border-2" style={{ borderColor: themePrimary, color: themePrimary }} onClick={() => setRegisterOpen(true)}>
          <ScanFace className="w-5 h-5 mr-2" /> ลงทะเบียนใบหน้า
        </Button>
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
