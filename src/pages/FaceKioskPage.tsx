import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { attachStreamToVideo } from "@/lib/cameraIos";
import Hls from "hls.js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  loadFaceModels, getAllDescriptors, matchDescriptor, drawFaceFrame,
  detectorOptionsHQ, applyCameraAutoTune, preprocessFrame, estimateFaceSharpness,
  type KnownFace, type MatchResult,
} from "@/lib/faceApi";
import { loadArcFace, computeArcFaceEmbedding, matchArcFace, ARCFACE_GRADE, type KnownArcFace } from "@/lib/arcface";
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
import { resolveDisplayImageUrl, useResolvedImageUrl } from "@/lib/storageUrl";

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

const RecentAvatar = ({ src, alt }: { src?: string | null; alt: string }) => {
  const resolved = useResolvedImageUrl(src);
  if (!resolved) return <div className="w-full h-full flex items-center justify-center text-[8px] text-neutral">-</div>;
  return <img src={resolved} alt={alt} className="w-full h-full object-cover" />;
};

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
  const [todayCounts, setTodayCounts] = useState<{ entry: number; exit: number }>({ entry: 0, exit: 0 });
  const { selection: scanModeSelection, setSelection: setScanModeSelection, effective: scanMode, effectiveRef: scanModeRef, cutoff: modeCutoff, checkWindow, entryWindow, exitWindow } = useAutoScanMode();
  const [camMode, setCamMode] = useState<CamMode>("standard");
  const [screensaver, setScreensaver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(new Date());
  const [savedPos, setSavedPos] = useState({ x: 50, y: 50 });
  const [faceCount, setFaceCount] = useState(0);
  const [networkUrl, setNetworkUrl] = useState<string>(() => localStorage.getItem(NETWORK_CAM_URL_KEY) || "");
  const hlsRef = useRef<Hls | null>(null);

  const { value: thresholdSetting } = useSchoolSetting("face_scan_threshold");
  const { value: voiceSetting } = useSchoolSetting("face_scan_voice");
  const threshold = parseFloat(thresholdSetting || "0.48");
  const voiceEnabled = voiceSetting !== "false";
  const geofence = useSchoolGeofence();
  const [geoStatus, setGeoStatus] = useState<{ ok: boolean; distance: number | null }>({ ok: !geofence.configured, distance: null });
  const { schoolName, schoolLogo } = useSystemSettings();

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

  const { data: known = [] } = useQuery({
    queryKey: ["face-known-kiosk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_face_descriptors")
        .select("student_id, descriptor, embedding_v2, model_version, students!inner(id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name))");
      if (error) throw error;
      type Row = KnownFace & { descriptorsV2: number[][]; name: string; classroom: string; avatar?: string | null; studentCode: string };
      const map = new Map<string, Row>();
      for (const row of data as any[]) {
        const id = row.student_id;
        const s = row.students;
        const name = `${s.prefix || ""}${s.first_name} ${s.last_name}`.trim();
        const cls = s.classrooms ? `${s.classrooms.grade_level || ""}/${s.classrooms.name || ""}` : "-";
        const existing = map.get(id);
        if (existing) {
          existing.descriptors.push(row.descriptor as number[]);
          if (row.embedding_v2) existing.descriptorsV2.push(row.embedding_v2 as number[]);
        } else {
          map.set(id, {
            studentId: id,
            descriptors: [row.descriptor as number[]],
            descriptorsV2: row.embedding_v2 ? [row.embedding_v2 as number[]] : [],
            name, classroom: cls, avatar: s.photo_url ? await resolveDisplayImageUrl(s.photo_url) || s.photo_url : null, studentCode: s.student_code || "",
          });
        }
      }
      return Array.from(map.values());
    },
    staleTime: 60_000,
  });

  // ArcFace (DeepFace-grade) — non-blocking; fallback to face-api if it fails
  const [arcReady, setArcReady] = useState(false);
  useEffect(() => {
    loadArcFace().then(() => setArcReady(true)).catch(() => setArcReady(false));
  }, []);
  const knownV2List: KnownArcFace[] = useMemo(
    () => (known as any[]).filter((k) => k.descriptorsV2?.length > 0)
                          .map((k) => ({ studentId: k.studentId, embeddings: k.descriptorsV2 })),
    [known],
  );

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
    loadFaceModels(setModelStatus).then(() => setModelReady(true))
      .catch((e) => setModelStatus("โหลดล้มเหลว: " + e.message));
  }, []);

  const startCamera = useCallback(async (mode: CamMode = camMode) => {
    const ok = await verifyLocation();
    if (!ok) return;
    try {
      // Cleanup previous stream/HLS
      const prev = videoRef.current?.srcObject as MediaStream | null;
      prev?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (videoRef.current) videoRef.current.removeAttribute("src");

      // === Network camera (RTSP via HLS gateway, MJPEG, MP4) ===
      if (mode === "network") {
        const url = networkUrl.trim();
        if (!url) {
          toast.error("กรุณาตั้งค่า URL ของกล้องเครือข่าย (HLS / MP4)");
          return;
        }
        if (!videoRef.current) return;
        videoRef.current.crossOrigin = "anonymous";
        videoRef.current.muted = true;
        if (url.endsWith(".m3u8") || url.includes(".m3u8?")) {
          if (Hls.isSupported()) {
            const hls = new Hls({ lowLatencyMode: true, liveSyncDuration: 1.5 });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(videoRef.current);
            await new Promise<void>((resolve, reject) => {
              hls.on(Hls.Events.MANIFEST_PARSED, () => resolve());
              hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) reject(new Error(data.details)); });
            });
          } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
            videoRef.current.src = url; // native HLS (Safari)
          } else {
            throw new Error("เบราว์เซอร์ไม่รองรับ HLS");
          }
        } else {
          // Direct MP4 / WebM / MJPEG fallback
          videoRef.current.src = url;
        }
        await videoRef.current.play();
        setStreaming(true);
        toast.success("เชื่อมต่อกล้องเครือข่ายสำเร็จ");
        return;
      }

      // === Local webcam ===
      const constraints: MediaStreamConstraints = mode === "wide" ? {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 }, height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
        }, audio: false,
      } : {
        video: {
          facingMode: "user",
          width: { ideal: 1280 }, height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        }, audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await applyCameraAutoTune(stream);
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, stream);
        setStreaming(true);
      }
    } catch (e: any) {
      toast.error("เปิดกล้องไม่สำเร็จ: " + e.message);
    }
  }, [camMode, verifyLocation, networkUrl]);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
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
  ) => {
    const now = Date.now();
    const mode = scanModeRef.current;
    const modeLabel = mode === "exit" ? "ออก" : "เข้า";
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
      toast.error(error.message); return;
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
    setRecent((r) => [{
      studentId, studentCode, name, classroom, avatar, capturedFace, confidence,
      time: new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      scanType: mode,
    }, ...r].slice(0, 10));
  }, [voiceEnabled]);

  useEffect(() => {
    if (!streaming || !modelReady || screensaver) return;
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
      // 🔋 หยุดทำงานเมื่อหน้าจอ tablet ถูกซ่อน/สลับแอป — กันแบตหมดและเครื่องร้อน
      if (document.hidden) {
        detectionLoopRef.current = window.setTimeout(loop, 1500);
        return;
      }
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

              // ===== Hybrid matching: ArcFace (~99.4%) first, face-api fallback =====
              let m: MatchResult;
              let usedArcFace = false;
              if (arcReady && knownV2List.length > 0) {
                let v2: Float32Array | null = null;
                try { v2 = await computeArcFaceEmbedding(video, det.landmarks); } catch { v2 = null; }
                if (v2) {
                  const am = matchArcFace(v2, knownV2List, ARCFACE_GRADE.MATCH_THRESHOLD);
                  if (am.studentId && am.margin >= ARCFACE_GRADE.MIN_MARGIN) {
                    usedArcFace = true;
                    m = {
                      studentId: am.studentId,
                      distance: 1 - am.similarity,
                      confidence: Math.max(MIN_CONFIDENCE, am.similarity),
                      secondDistance: 1 - am.secondSimilarity,
                      margin: am.margin,
                    };
                  } else {
                    m = matchDescriptor(det.descriptor, known, threshold);
                  }
                } else {
                  m = matchDescriptor(det.descriptor, known, threshold);
                }
              } else {
                m = matchDescriptor(det.descriptor, known, threshold);
              }
              const effMargin = usedArcFace ? ARCFACE_GRADE.MIN_MARGIN : MIN_MARGIN;
              const ambiguous = m.studentId != null && m.margin < effMargin;
              const lowConfidence = !usedArcFace && m.studentId != null && m.confidence < MIN_CONFIDENCE;
              const matchedId = !tooSmall && !tooBlurry && !ambiguous && !lowConfidence ? m.studentId : null;
              const found = matchedId ? known.find((k: any) => k.studentId === matchedId) as any : null;

              const justScanned = found ? (tNow - (justScannedRef.current.get(found.studentId) || 0) < 3000) : false;
              const inCooldown = found ? (tNow - (cooldownRef.current.get(found.studentId) || 0) < 30_000) : false;
              const color = !found
                ? (tooSmall ? "#94a3b8" : tooBlurry ? "#64748b" : (ambiguous || lowConfidence) ? "#eab308" : "#f97316")
                : justScanned ? "#16a34a" : inCooldown ? "#10b981" : "#22c55e";

              const label = found
                ? `${found.name}${justScanned ? " ✓ บันทึกแล้ว" : ""}`
                : tooSmall ? "ขยับเข้าใกล้กล้อง"
                : tooBlurry ? "ภาพเบลอ ให้นิ่งสักครู่"
                : ambiguous ? "กำลังยืนยันตัวตน..."
                : lowConfidence ? `มั่นใจ ${Math.round(m.confidence * 100)}% • ต้อง ≥ ${Math.round(MIN_CONFIDENCE * 100)}%`
                : "ไม่พบในระบบ";
              const sublabel = found
                ? `เลขที่ ${found.studentCode || "-"} • ชั้น ${found.classroom} • ${Math.round(m.confidence * 100)}% (Δ${m.margin.toFixed(2)}, ช ${Math.round(sharpness)})`
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
                  await recordScan(found.studentId, found.studentCode, found.name, found.classroom, found.avatar, m.confidence, captured);
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
      // 🔋 Adaptive cadence — ไม่เจอใบหน้านาน → ลูปช้าลง (ลด CPU/ความร้อน)
      const idleMs = Date.now() - lastDetectedAtRef.current;
      const wait = idleMs > 5_000 ? 900 : 200;
      if (!cancelled) detectionLoopRef.current = window.setTimeout(loop, wait);
    };
    loop();
    return () => {
      cancelled = true;
      if (detectionLoopRef.current) clearTimeout(detectionLoopRef.current);
    };
  }, [streaming, modelReady, screensaver, known, knownV2List, arcReady, threshold, recordScan, camMode]);

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

    const loop = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
        if (!cancelled) setTimeout(loop, 600);
        return;
      }
      try {
        let codes = [];
        if (detector) {
          codes = await detector.detect(videoRef.current);
        } else if (jsQR && scanCtx && videoRef.current.videoWidth) {
          const video = videoRef.current;
          const maxW = 800;
          const scale = Math.min(1, maxW / video.videoWidth);
          const w = Math.floor(video.videoWidth * scale);
          const h = Math.floor(video.videoHeight * scale);
          scanCanvas.width = w; scanCanvas.height = h;
          scanCtx.drawImage(video, 0, 0, w, h);
          const img = scanCtx.getImageData(0, 0, w, h);
          const res = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
          if (res?.data) codes = [{ rawValue: res.data }];
        }
        const tNow = Date.now();
        for (const c of codes || []) {
          const raw = String(c.rawValue || "").trim();
          if (!raw || raw.length < 3) continue;
          // กรองค่าที่มีตัวควบคุม (ลด false positive)
          if (/[\x00-\x1f]/.test(raw)) continue;
          // แยกรหัสนักเรียน — รองรับทั้งรหัสตรง ๆ และ URL ที่มี ?code= / /student/<code>
          let code = raw;
          try {
            if (/^https?:\/\//i.test(raw)) {
              const u = new URL(raw);
              const q = u.searchParams.get("code") || u.searchParams.get("sid") || u.searchParams.get("student");
              if (q) code = q;
              else {
                const parts = u.pathname.split("/").filter(Boolean);
                if (parts.length) code = parts[parts.length - 1];
              }
            } else {
              const m = raw.match(/(?:code|student|sid)[=/:]([A-Za-z0-9_-]+)/i);
              if (m) code = m[1];
            }
          } catch {}
          code = code.trim();
          if (!code || code.length < 3) continue;

          // กันสแกน QR ซ้ำติด ๆ
          const lastQr = qrCooldownRef.current.get(code) || 0;
          if (tNow - lastQr < 3000) continue;
          qrCooldownRef.current.set(code, tNow);

          let student = codeMap.get(code);
          if (!student) {
            // fallback: query DB
            const { data } = await supabase
              .from("students")
              .select("id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name)")
              .eq("student_code", code)
              .maybeSingle();
            if (!data) {
              if (tNow - unknownBeepRef.current > 4000) {
                unknownBeepRef.current = tNow;
                playUnknownSound();
                toast.error(`QR ไม่พบรหัส ${code} ในระบบ`, { duration: 1800 });
              }
              continue;
            }
            const cls = (data as any).classrooms ? `${(data as any).classrooms.grade_level || ""}/${(data as any).classrooms.name || ""}` : "-";
            student = {
              studentId: (data as any).id,
              studentCode: (data as any).student_code || code,
              name: `${(data as any).prefix || ""}${(data as any).first_name} ${(data as any).last_name}`.trim(),
              classroom: cls,
              avatar: (data as any).photo_url ? await resolveDisplayImageUrl((data as any).photo_url) || (data as any).photo_url : null,
            };
          }

          await recordScan(student.studentId, student.studentCode, student.name, student.classroom, student.avatar || null, 1, undefined);
        }
      } catch (e) {
        // ignore frame errors
      }
      if (!cancelled) setTimeout(loop, 250);
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

  useEffect(() => {
    if (!streaming) return;
    const check = window.setInterval(() => {
      const idleMs = Date.now() - lastDetectedAtRef.current;
      const nearWin = isNearScanWindow();
      // ปลุกหน้าจอเมื่อใกล้เวลาสแกน 5 นาที (หรืออยู่ในช่วง)
      if (nearWin && screensaver) {
        lastDetectedAtRef.current = Date.now();
        setScreensaver(false);
        return;
      }
      // พักหน้าจอเมื่อไม่เจอใบหน้าใด ๆ ติดต่อกัน 2 นาที (แต่ห้ามพักช่วงใกล้เวลาสแกน)
      if (idleMs > 120_000 && !screensaver && !nearWin) setScreensaver(true);
    }, 5_000);
    idleTimerRef.current = check;
    return () => clearInterval(check);
  }, [streaming, screensaver, isNearScanWindow]);

  useEffect(() => {
    if (!screensaver) return;
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
      if (!cancelled) setTimeout(wakeLoop, 1500);
    };
    wakeLoop();
    return () => { cancelled = true; };
  }, [screensaver, streaming, modelReady]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  const handleTap = () => {
    lastDetectedAtRef.current = Date.now();
    if (screensaver) setScreensaver(false);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-danger via-danger to-danger text-neutral overflow-hidden select-none" onClick={handleTap}>
      {screensaver && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center transition-opacity">
          <div
            className="text-center text-white transition-all duration-1000"
            style={{ position: "absolute", left: `${savedPos.x}%`, top: `${savedPos.y}%`, transform: "translate(-50%,-50%)" }}
          >
            <ScanFace className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-6xl font-bold opacity-60 tabular-nums">
              {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-sm opacity-30 mt-2">แตะหรือยืนหน้ากล้องเพื่อปลุกเครื่อง</p>
          </div>
        </div>
      )}

      {/* Mode toggle — เด่นชัดด้านบน เพื่อให้ครูประจำประตูสลับโหมดเข้า/ออก ได้เร็ว */}
      <div className="absolute top-2 left-2 z-40 flex items-center gap-1 bg-white/85 backdrop-blur-sm rounded-full p-1 border-2 border-white/70 shadow-md" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setScanModeSelection("auto")}
          title={`สลับเข้า/ออก อัตโนมัติที่เวลา ${modeCutoff} น. (ตอนนี้: ${scanMode === "exit" ? "ออก" : "เข้า"})`}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition ${scanModeSelection === "auto" ? (scanMode === "exit" ? "bg-brand-exit text-brand-exit-foreground shadow" : "bg-brand-entry text-brand-entry-foreground shadow") : "text-muted-foreground hover:bg-muted"}`}
        >
          <Clock className="w-4 h-4" /> เข้า-ออก อัตโนมัติ
          {scanModeSelection === "auto" && (
            <span className="ml-1 text-[10px] font-bold opacity-90">· {scanMode === "exit" ? "ออก" : "เข้า"} ({modeCutoff})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setScanModeSelection("entry")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition ${scanModeSelection === "entry" ? "bg-brand-entry text-brand-entry-foreground shadow" : "text-muted-foreground hover:bg-brand-entry/10"}`}
        >
          <LogIn className="w-4 h-4" /> เข้าอย่างเดียว
        </button>
      </div>

      {/* Top control bar (compact) */}
      <div className="absolute top-2 right-2 z-40 flex items-center gap-1.5">
        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-white/60 text-neutral">
          <LogIn className="w-3 h-3 mr-1 text-brand-entry" /> เข้า {todayCounts.entry}
        </Badge>
        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-white/60 text-neutral">
          <LogOut className="w-3 h-3 mr-1 text-brand-exit" /> ออก {todayCounts.exit}
        </Badge>
        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-white/60 text-neutral">
          <QrCode className="w-3 h-3 mr-1 text-info" /> QR สำรอง
        </Badge>
        <Badge variant="secondary" className={`backdrop-blur-sm border-white/60 ${arcReady ? "bg-success-soft text-success-soft-foreground" : "bg-card/80 text-muted-foreground"}`}>
          <ScanFace className="w-3 h-3 mr-1" />
          {arcReady ? `ArcFace • ${knownV2List.length}` : "กำลังโหลด ArcFace..."}
        </Badge>
        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm border-white/60 text-neutral">
          {online ? <Wifi className="w-3 h-3 mr-1 text-brand-entry" /> : <WifiOff className="w-3 h-3 mr-1 text-warning" />}
          {online ? "ออนไลน์" : "ออฟไลน์"}
        </Badge>
        {geofence.configured && (
          <Badge className={geoStatus.ok ? "bg-brand-entry" : "bg-danger"}>
            <MapPin className="w-3 h-3 mr-1" />
            {geoStatus.distance == null ? `รัศมี ${geofence.radius} ม.` : geoStatus.ok ? `${Math.round(geoStatus.distance)} ม.` : `นอก ${Math.round(geoStatus.distance)} ม.`}
          </Badge>
        )}
        <Button variant="ghost" size="icon" onClick={() => setShowSettings((s) => !s)} className="text-neutral hover:bg-white/50 h-8 w-8">
          <SettingsIcon className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={enterFullscreen} className="text-neutral hover:bg-white/50 h-8 w-8">
          <Maximize className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => { stopCamera(); window.location.href = "/dashboard/student/face-scan"; }} className="text-neutral hover:bg-white/50 h-8 w-8">
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
          </div>

          <div className="text-xs text-muted-foreground border-t pt-2">
            threshold: <b>{threshold}</b> • ใบหน้าในระบบ {known.length}
          </div>
        </div>
      )}

      {/* Main grid: camera (left) + scan list (right) */}
      <div className="absolute inset-0 grid grid-cols-[1fr_360px] gap-3 p-3 pt-12 pb-28">
        {/* Camera panel with school header */}
        <div className="relative rounded-2xl overflow-hidden bg-white shadow-xl border-2 border-danger/30 flex flex-col">
          {/* School header banner */}
          <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-success via-success to-success border-b-2 border-success/30">
            {schoolLogo ? (
              <img src={schoolLogo} alt="logo" className="w-14 h-14 object-contain drop-shadow" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-success-soft flex items-center justify-center">
                <ScanFace className="w-7 h-7 text-brand-entry" />
              </div>
            )}
            <div className="leading-tight">
              <h1 className="text-2xl md:text-3xl font-bold text-brand-entry tracking-tight">
                {schoolName || "โรงเรียน"}
              </h1>
              <p className="text-xs md:text-sm text-brand-entry/80 font-medium">
                ระบบบันทึกเวลามาเรียนด้วย AI Camera
              </p>
            </div>
          </div>

          {/* Camera feed */}
          <div className="relative flex-1 bg-black">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {/* AI camera overlay tag */}
            <div className="absolute top-3 right-3 z-10 bg-black/50 text-warning-foreground/90 text-xs font-mono px-2 py-1 rounded">
              {schoolName ? `${schoolName} · AI Camera No.1` : "AI Camera No.1"}
            </div>
            <div className="absolute top-3 left-3 z-10 bg-black/50 text-warning-foreground/90 text-xs font-mono px-2 py-1 rounded tabular-nums">
              {now.toLocaleDateString("en-GB").replace(/\//g, "-")} {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>

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
        <div className="rounded-2xl bg-white/80 backdrop-blur border-2 border-danger/30 shadow-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-brand-exit-soft border-b border-brand-exit/30">
            <h2 className="text-sm font-bold text-brand-exit">รายการสแกนล่าสุด</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {recent.length === 0 ? (
              <p className="text-center text-sm text-neutral py-12">ยังไม่มีการสแกน</p>
            ) : (
              recent.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-lg p-1.5 border shadow-sm ${r.scanType === "exit" ? "bg-brand-exit-soft border-brand-exit/30" : "bg-card border-brand-exit/30"}`}>
                  {r.scanType === "exit"
                    ? <LogOut className="w-4 h-4 text-brand-exit shrink-0" />
                    : <LogIn className="w-4 h-4 text-brand-entry shrink-0" />}
                  <div className="flex items-center shrink-0">
                    <div className="w-8 h-8 rounded overflow-hidden bg-muted border border-border">
                      <RecentAvatar src={r.capturedFace} alt="ตรวจพบ" />
                    </div>
                    <div className="w-8 h-8 rounded overflow-hidden bg-muted border border-border -ml-1">
                      <RecentAvatar src={r.avatar} alt="ลงทะเบียน" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold tabular-nums leading-tight truncate ${r.scanType === "exit" ? "text-brand-exit" : "text-brand-entry"}`}>
                      <span className={`mr-1 inline-block px-1.5 rounded text-[10px] font-bold ${r.scanType === "exit" ? "bg-brand-exit text-brand-exit-foreground" : "bg-brand-entry text-brand-entry-foreground"}`}>{r.scanType === "exit" ? "ออก" : "เข้า"}</span>
                      {r.studentCode || "-"} <span className="text-muted-foreground font-normal">· {r.name}</span>
                    </p>
                    <p className="text-[10px] text-neutral leading-tight truncate">{r.classroom} · {r.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar: clock + ONLINE */}
      <div className="absolute bottom-0 inset-x-0 z-30 p-3 flex items-center justify-center gap-3 bg-gradient-to-t from-danger/95 to-transparent">
        <div className="flex items-center gap-2 bg-white border-2 border-success/30 rounded-xl px-4 py-2 shadow-md">
          <span className="font-mono text-3xl font-bold tabular-nums text-brand-entry">
            {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white border-2 border-success/30 rounded-xl px-4 py-2 shadow-md">
          <span className={`w-3 h-3 rounded-full ${online ? "bg-success animate-pulse" : "bg-neutral"}`} />
          <span className="font-bold text-brand-entry">{online ? "ONLINE" : "OFFLINE"}</span>
        </div>
        {faceCount > 0 && (
          <Badge className="bg-success text-success-foreground px-3 py-2 text-sm">
            {faceCount} ใบหน้าในเฟรม
          </Badge>
        )}
      </div>
    </div>
  );
};

export default FaceKioskPage;
