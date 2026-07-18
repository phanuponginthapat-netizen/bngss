import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanFace, Camera, CameraOff, CheckCircle2, AlertCircle, Users, Monitor, SwitchCamera, Maximize, Minimize, Keyboard, UserCircle2, LogIn, LogOut, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { loadFaceModels, getAllDescriptors, matchDescriptor, drawFaceFrame, detectorOptionsHQ, applyCameraAutoTune, triggerAutoFocus, preprocessFrame, estimateFaceSharpness, BANK_GRADE, isStrongMatch, isConfirmGrade, landmarkSanityScore, detectFaceWithLandmarks, assessFaceQuality, type KnownFace, type MatchResult } from "@/lib/faceApi";
import { loadArcFace, isArcFaceReady, computeArcFaceEmbedding, matchArcFace, ARCFACE_GRADE, type KnownArcFace } from "@/lib/arcface";
import { useUserRole } from "@/hooks/useUserRole";
import { ShieldCheck } from "lucide-react";
import { playSuccessSound, playDuplicateSound, playUnknownSound, speakText, unlockAudio } from "@/lib/faceScanAudio";
import { toast } from "sonner";
import { useSchoolSetting } from "@/hooks/useSchoolSetting";
import { useAutoScanMode } from "@/hooks/useAutoScanMode";
import { useSchoolGeofence, calcDistanceMeters, getCurrentCoords } from "@/hooks/useSchoolGeofence";
import { MapPin } from "lucide-react";
import { uploadFaceScanSnapshot } from "@/lib/faceScanUpload";
import { useHomeroomClassrooms } from "@/hooks/useHomeroomClassrooms";
import { resolveDisplayImageUrl, useResolvedImageUrl } from "@/lib/storageUrl";

interface RecentScan {
  studentId: string;
  studentCode: string;
  name: string;
  classroom: string;
  time: string;
  confidence: number;
  capturedFace?: string;
  registeredFace?: string;
  entryMethod?: "face" | "qr" | "manual";
  scannerName?: string;
  scanType?: "entry" | "exit";
}

const RecentRegisteredFace = ({ src }: { src?: string }) => {
  const resolved = useResolvedImageUrl(src);
  if (!resolved) {
    return <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">ไม่มีรูป</div>;
  }
  return <img src={resolved} alt="ลงทะเบียน" className="w-full h-full object-cover" />;
};

// ScanMode now lives in useAutoScanMode

// 🔋 หน้านี้ (ในแอป) = สแกน QR อย่างเดียว เพื่อประหยัดแบตและ CPU มือถือ
// การสแกนใบหน้าให้ใช้ "โหมดคีออส" ที่ตั้งไว้ประจำจุด (แทปเลต/PC เสียบไฟ) เท่านั้น
const QR_ONLY_MODE = true;

const FaceScanTab = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const duplicateNoticeRef = useRef<Map<string, number>>(new Map());
  const justScannedRef = useRef<Map<string, number>>(new Map()); // `${studentId}:${mode}` -> timestamp
  const seenTodayRef = useRef<{ entry: Set<string>; exit: Set<string> }>({ entry: new Set(), exit: new Set() });
  const [streaming, setStreaming] = useState(false);
  const [modelStatus, setModelStatus] = useState<string>("กำลังโหลดโมเดล...");
  const [modelReady, setModelReady] = useState(false);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [todayCounts, setTodayCounts] = useState<{ entry: number; exit: number }>({ entry: 0, exit: 0 });
  const { selection: scanModeSelection, setSelection: setScanModeSelection, effective: scanMode, effectiveRef: scanModeRef, cutoff: modeCutoff, checkWindow } = useAutoScanMode();
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [scannerName, setScannerName] = useState<string>("");
  const { value: thresholdSetting } = useSchoolSetting("face_scan_threshold");
  const { value: voiceSetting } = useSchoolSetting("face_scan_voice");
  const threshold = parseFloat(thresholdSetting || String(BANK_GRADE.MATCH_THRESHOLD));
  const MIN_MARGIN = BANK_GRADE.MIN_MARGIN;
  const MIN_CONFIDENCE = BANK_GRADE.MIN_CONFIDENCE;
  const MIN_LANDMARK_SANITY = 0.55;
  const voiceEnabled = voiceSetting !== "false";
  const { isAdmin, isDirector, isTeacher, userId, loading: roleLoading } = useUserRole();
  const { homeroomClassroomIds, isFiltered } = useHomeroomClassrooms();
  const canConfirm = isAdmin || isDirector;
  const canUseScanner = !!userId && (isAdmin || isDirector || isTeacher);
  const [confirming, setConfirming] = useState(false);
  // Multi-frame voting: studentId -> {hits, firstAt}
  const voteRef = useRef<Map<string, { hits: number; firstAt: number }>>(new Map());
  const VOTE_REQUIRED = 2;
  const VOTE_WINDOW_MS = 2200;
  const geofence = useSchoolGeofence();
  const [geoStatus, setGeoStatus] = useState<{ ok: boolean; distance: number | null; error?: string }>({ ok: !geofence.configured, distance: null });
  const [facing, setFacing] = useState<"user" | "environment">(() => {
    if (typeof navigator === "undefined") return "user";
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) || (navigator.maxTouchPoints || 0) > 1;
    return isMobile ? "environment" : "user";
  });
  const qrDetectorRef = useRef<any>(null);
  const qrCooldownRef = useRef<Map<string, number>>(new Map());
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveStatus, setLiveStatus] = useState<{ kind: "idle" | "success" | "duplicate" | "unknown" | "detecting"; text: string; sub?: string } | null>(null);
  const liveStatusTimerRef = useRef<number | null>(null);
  const isIOS = typeof navigator !== "undefined"
    && (/iPad|iPhone|iPod/.test(navigator.userAgent || "") || (/Macintosh/.test(navigator.userAgent || "") && (navigator.maxTouchPoints || 0) > 1));
  const setLive = useCallback((s: { kind: "idle" | "success" | "duplicate" | "unknown" | "detecting"; text: string; sub?: string }, ttl = 2500) => {
    setLiveStatus(s);
    if (liveStatusTimerRef.current) window.clearTimeout(liveStatusTimerRef.current);
    liveStatusTimerRef.current = window.setTimeout(() => setLiveStatus(null), ttl) as unknown as number;
  }, []);

  useEffect(() => {
    const onFs = () => {
      const doc: any = document;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    // iOS native video fullscreen events
    const vid: any = videoRef.current;
    const onBegin = () => setIsFullscreen(true);
    const onEnd = () => setIsFullscreen(false);
    vid?.addEventListener?.("webkitbeginfullscreen", onBegin);
    vid?.addEventListener?.("webkitendfullscreen", onEnd);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      vid?.removeEventListener?.("webkitbeginfullscreen", onBegin);
      vid?.removeEventListener?.("webkitendfullscreen", onEnd);
    };
  }, [streaming]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const box: any = videoBoxRef.current;
      const vid: any = videoRef.current;
      const doc: any = document;
      const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || vid?.webkitDisplayingFullscreen;
      if (!isFs) {
        // iOS Safari ไม่รองรับ requestFullscreen บน div — ใช้ webkitEnterFullscreen บน <video> แทน
        if (box?.requestFullscreen) {
          await box.requestFullscreen();
        } else if (box?.webkitRequestFullscreen) {
          box.webkitRequestFullscreen();
        } else if (vid?.webkitEnterFullscreen) {
          vid.webkitEnterFullscreen();
          setIsFullscreen(true);
        } else {
          throw new Error("อุปกรณ์นี้ไม่รองรับโหมดเต็มจอ");
        }
      } else {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (vid?.webkitExitFullscreen) vid.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e: any) {
      toast.error("เปิดเต็มจอไม่ได้: " + (e?.message || ""));
    }
  }, []);

  const verifyLocation = useCallback(async (): Promise<boolean> => {
    if (!geofence.configured) {
      setGeoStatus({ ok: true, distance: null });
      return true;
    }
    try {
      const { lat, lng, accuracy } = await getCurrentCoords();
      const dist = calcDistanceMeters(lat, lng, geofence.lat, geofence.lng);
      // หัก margin ความคลาดเคลื่อนของ GPS (สำคัญเมื่อใช้ WiFi positioning ที่ accuracy อาจ ±100m+)
      const effective = Math.max(0, dist - (accuracy || 0));
      const ok = effective <= geofence.radius;
      setGeoStatus({ ok, distance: dist });
      if (!ok) {
        toast.error("อยู่นอกพื้นที่โรงเรียน", {
          description: `ห่างจุดที่กำหนด ${Math.round(dist)} ม. (±${Math.round(accuracy)} ม.) เกินรัศมี ${geofence.radius} ม.`,
        });
      }
      return ok;
    } catch (e: any) {
      setGeoStatus({ ok: false, distance: null, error: e.message });
      toast.error("ไม่สามารถอ่านตำแหน่ง GPS", { description: "กรุณาเปิดอนุญาตตำแหน่งในเบราว์เซอร์" });
      return false;
    }
  }, [geofence.configured, geofence.lat, geofence.lng, geofence.radius]);

  // Load known faces from DB (both face-api v1 + ArcFace v2 embeddings)
  const { data: known = [], refetch: refetchKnown } = useQuery({
    queryKey: ["face-known", userId],
    enabled: !roleLoading && canUseScanner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_face_descriptors")
        .select("student_id, descriptor, embedding_v2, model_version, students!inner(id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name))");
      if (error) throw error;
      type RowKnown = KnownFace & { descriptorsV2: number[][]; name: string; classroom: string; studentCode: string; avatarUrl: string | null };
      const map = new Map<string, RowKnown>();
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
            name, classroom: cls,
            studentCode: s.student_code || "",
            avatarUrl: s.photo_url || null,
          });
        }
      }
      return Array.from(map.values());
    },
    staleTime: 60_000,
  });

  // ArcFace (DeepFace-grade) loader — non-blocking, fallback to face-api if it fails
  // 🔋 QR-only mode: ข้ามการโหลดโมเดล ArcFace เพื่อประหยัดแรม/แบต
  const [arcReady, setArcReady] = useState(false);
  useEffect(() => {
    if (QR_ONLY_MODE) return;
    loadArcFace().then(() => setArcReady(true)).catch(() => setArcReady(false));
  }, []);
  // Precompute the ArcFace knowledge base — only students with v2 embeddings
  const knownV2List: KnownArcFace[] = useMemo(
    () => known.filter((k: any) => k.descriptorsV2?.length > 0)
                .map((k: any) => ({ studentId: k.studentId, embeddings: k.descriptorsV2 })),
    [known],
  );

  // Total student denominator: homeroom students for teachers, all active for admin/director
  const [totalStudents, setTotalStudents] = useState<number>(0);
  useEffect(() => {
    if (roleLoading || !canUseScanner) return;
    (async () => {
      let q = supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active");
      if (isFiltered) {
        if (!homeroomClassroomIds || homeroomClassroomIds.length === 0) {
          setTotalStudents(0);
          return;
        }
        q = q.in("classroom_id", homeroomClassroomIds);
      }
      const { count } = await q;
      setTotalStudents(count || 0);
    })();
  }, [roleLoading, canUseScanner, isFiltered, homeroomClassroomIds]);

  // Today's distinct student count + recent history (with realtime updates)
  useEffect(() => {
    if (roleLoading || !canUseScanner) return;
    let cancelled = false;
    const load = async () => {
      const today = todayBangkok();
      const { data } = await supabase
        .from("face_scan_logs")
        .select("student_id, scan_time, scan_type, confidence, captured_face_url, entry_method, students!inner(student_code, classroom_id, prefix, first_name, last_name, photo_url, classrooms!students_classroom_id_fkey(grade_level, name))")
        .eq("scan_date", today)
        .order("scan_time", { ascending: false })
        .limit(80);
      let rows = (data || []) as any[];
      if (isFiltered && homeroomClassroomIds) {
        const allowed = new Set(homeroomClassroomIds);
        rows = rows.filter((r) => r.students?.classroom_id && allowed.has(r.students.classroom_id));
      }
      const entrySet = new Set<string>();
      const exitSet = new Set<string>();
      for (const r of rows) {
        if (!r.student_id) continue;
        if (r.scan_type === "exit") exitSet.add(r.student_id);
        else entrySet.add(r.student_id);
      }
      if (cancelled) return;
      seenTodayRef.current = { entry: entrySet, exit: exitSet };
      setTodayCounts({ entry: entrySet.size, exit: exitSet.size });
      const history: RecentScan[] = await Promise.all(rows.slice(0, 8).map(async (r) => {
        const s = r.students || {};
        const cls = s.classrooms ? `${s.classrooms.grade_level || ""}/${s.classrooms.name || ""}` : "-";
        return {
          studentId: r.student_id,
          studentCode: s.student_code || "",
          name: `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim(),
          classroom: cls,
          confidence: Number(r.confidence) || 0,
          time: new Date(r.scan_time).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          registeredFace: s.photo_url ? await resolveDisplayImageUrl(s.photo_url) || s.photo_url : undefined,
          capturedFace: r.captured_face_url || undefined,
          entryMethod: r.entry_method || undefined,
          scanType: r.scan_type === "exit" ? "exit" : "entry",
        };
      }));
      if (!cancelled) setRecent(history);
    };
    load();
    // Realtime: refresh whenever anyone inserts a scan today
    const channel = supabase
      .channel("face-scan-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "face_scan_logs" },
        () => { load(); }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roleLoading, canUseScanner, isFiltered, homeroomClassroomIds]);


  // Load model — ข้ามในโหมด QR-only (ประหยัด ~10MB + CPU)
  useEffect(() => {
    if (QR_ONLY_MODE) { setModelStatus("โหมด QR — พร้อมสแกน"); setModelReady(true); return; }
    loadFaceModels(setModelStatus)
      .then(() => setModelReady(true))
      .catch((e) => setModelStatus("โหลดโมเดลล้มเหลว: " + e.message));
  }, []);

  // โหลดชื่อครูที่กำลังเข้าระบบ (ใช้แสดงว่าใครเป็นผู้บันทึก)
  useEffect(() => {
    if (roleLoading || !userId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("personnel")
        .select("prefix, first_name, last_name").eq("user_id", user.id).maybeSingle();
      if (p) {
        setScannerName(`${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim());
        return;
      }
      const { data: pr } = await supabase.from("profiles")
        .select("first_name, last_name").eq("id", user.id).maybeSingle();
      if (pr) setScannerName(`${pr.first_name || ""} ${pr.last_name || ""}`.trim() || user.email || "");
      else setScannerName(user.email || "");
    })();
  }, [roleLoading, userId]);

  // บันทึกด้วยรหัสนักเรียน (สำรองตอนสแกนหน้า/QR ไม่ติด)
  const submitManualCode = useCallback(async () => {
    const code = manualCode.trim();
    if (!code) return;
    if (!(await verifyLocation())) return;
    setManualLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name)")
        .eq("student_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error(`ไม่พบนักเรียนรหัส ${code}`);
        return;
      }
      const cls = (data as any).classrooms ? `${(data as any).classrooms.grade_level || ""}/${(data as any).classrooms.name || ""}` : "-";
      const name = `${data.prefix || ""}${data.first_name} ${data.last_name}`.trim();
      const registeredFace = data.photo_url ? await resolveDisplayImageUrl(data.photo_url) || data.photo_url : undefined;
      await recordScan(data.id, data.student_code || code, name, cls, 1, undefined, registeredFace, "manual");
      setManualCode("");
    } catch (e: any) {
      toast.error("บันทึกล้มเหลว: " + (e?.message || ""));
    } finally {
      setManualLoading(false);
    }
  }, [manualCode, verifyLocation]);

  const startCamera = useCallback(async (overrideFacing?: "user" | "environment") => {
    const useFacing = overrideFacing || facing;
    // ⚠️ iOS Safari: ต้องเรียก getUserMedia ภายใน user gesture เดิม
    // ห้ามรอ geolocation/await อื่นก่อน มิฉะนั้น iOS จะ block ไม่ขึ้น prompt

    // iOS Safari มักไม่รองรับ width/height/frameRate ที่กำหนดสูงเกินไป — fallback ไปข้อจำกัดน้อยที่สุด
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
    const tryGetStream = async (): Promise<MediaStream> => {
      const primary: MediaStreamConstraints = {
        video: isIOS
          ? { facingMode: { ideal: useFacing } }
          : {
              facingMode: { ideal: useFacing },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            },
        audio: false,
      };
      try {
        return await navigator.mediaDevices.getUserMedia(primary);
      } catch (e: any) {
        if (e?.name === "OverconstrainedError" || e?.name === "NotReadableError") {
          // Fallback: ขั้นต่ำสุด — แค่ขอกล้อง
          return await navigator.mediaDevices.getUserMedia({ video: { facingMode: useFacing }, audio: false });
        }
        throw e;
      }
    };
    try {
      const stream = await tryGetStream();
      // ปรับกล้องอัตโนมัติให้คมชัดที่สุดเท่าที่อุปกรณ์รองรับ
      try { await applyCameraAutoTune(stream); } catch {}
      if (videoRef.current) {
        // หยุด stream เดิมก่อน (กรณีสลับกล้อง)
        const oldStream = videoRef.current.srcObject as MediaStream | null;
        oldStream?.getTracks().forEach((t) => t.stop());
        // iOS Safari: ต้องตั้ง attribute ก่อน srcObject แล้วรอ loadedmetadata ก่อน play()
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        videoRef.current.muted = true;
        (videoRef.current as any).autoplay = true;
        // กล้องหน้าให้มิเรอร์ภาพเหมือนกระจก
        videoRef.current.style.transform = useFacing === "user" ? "scaleX(-1)" : "none";
        videoRef.current.srcObject = stream;
        if (videoRef.current.readyState < 1) {
          await new Promise<void>((resolve) => {
            const v = videoRef.current!;
            const done = () => { v.removeEventListener("loadedmetadata", done); resolve(); };
            v.addEventListener("loadedmetadata", done);
            setTimeout(done, 1500);
          });
        }
        try { await videoRef.current.play(); } catch {}
        setStreaming(true);
      }
      // ตรวจ geofence หลังเปิดกล้องสำเร็จ — ถ้านอกพื้นที่ปิดทันที
      verifyLocation().then((ok) => {
        if (!ok) {
          stream.getTracks().forEach((t) => t.stop());
          if (videoRef.current) videoRef.current.srcObject = null;
          setStreaming(false);
        }
      });
    } catch (e: any) {
      const name = e?.name || "";
      let msg = e?.message || "เปิดกล้องไม่สำเร็จ";
      if (name === "NotAllowedError") msg = "ไม่ได้รับอนุญาตให้ใช้กล้อง — กรุณาเปิดสิทธิ์ในเบราว์เซอร์/Settings";
      else if (name === "NotFoundError") msg = "ไม่พบกล้องในอุปกรณ์นี้";
      else if (name === "NotReadableError") msg = "กล้องถูกใช้งานโดยแอปอื่นอยู่";
      else if (name === "SecurityError") msg = "ต้องเปิดผ่าน HTTPS เท่านั้น";
      toast.error("เปิดกล้องไม่สำเร็จ: " + msg);
    }
  }, [verifyLocation, facing]);

  const switchCamera = useCallback(async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (streaming) await startCamera(next);
  }, [facing, streaming, startCamera]);

  // ตรวจตำแหน่งซ้ำทุก 2 นาทีระหว่างใช้งาน — ออกนอกรัศมีจะปิดกล้อง
  useEffect(() => {
    if (!streaming || !geofence.configured) return;
    const t = setInterval(async () => {
      const ok = await verifyLocation();
      if (!ok) stopCamera();
    }, 120_000);
    return () => clearInterval(t);
  }, [streaming, geofence.configured, verifyLocation]);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }, []);

  // 🎯 Periodic autofocus re-trigger — บางรุ่น (Android เก่า, iPad, กล้อง USB) หยุดโฟกัสค้างหลังเปิดกล้อง
  // เรียก triggerAutoFocus ทุก 3 วิ ระหว่างสแกน QR เพื่อให้ยังคมชัด
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => {
      const s = videoRef.current?.srcObject as MediaStream | null;
      triggerAutoFocus(s);
    }, 3000);
    return () => clearInterval(t);
  }, [streaming]);

  // 🎯 Tap-to-focus — ผู้ใช้แตะจอเพื่อบังคับให้กล้องโฟกัสใหม่ทันที (รองรับทุกแพลตฟอร์ม)
  const handleVideoTap = useCallback(() => {
    const s = videoRef.current?.srcObject as MediaStream | null;
    triggerAutoFocus(s);
  }, []);


  /**
   * Confirm Mode — ถ่ายรูปสด match กับ DB แล้วเพิ่ม descriptor เข้านักเรียนคนนั้น
   * เพื่อให้กล้อง/แสง ณ จุดสแกนจริง ถูก enroll เข้าระบบ → สแกนรอบถัดไปแม่นขึ้น
   */
  const runConfirmMode = useCallback(async () => {
    if (!videoRef.current || !modelReady) { toast.error("กล้องยังไม่พร้อม"); return; }
    if (!canConfirm) { toast.error("เฉพาะแอดมิน/ผู้อำนวยการ"); return; }
    setConfirming(true);
    try {
      const det = await detectFaceWithLandmarks(videoRef.current);
      if (!det) { toast.error("ตรวจไม่พบใบหน้า"); return; }
      const q = assessFaceQuality(videoRef.current, det, "register");
      if (!q.ok) { toast.error("คุณภาพภาพไม่ผ่าน", { description: q.reasons[0] }); return; }
      const m = matchDescriptor(det.descriptor, known as any, BANK_GRADE.MATCH_THRESHOLD);
      if (!m.studentId || !isConfirmGrade(m)) {
        toast.error("ไม่สามารถยืนยันตัวตนได้ชัดเจน", { description: `Δ ${m.margin.toFixed(2)} • มั่นใจ ${Math.round(m.confidence * 100)}% — ต้อง Δ≥${BANK_GRADE.STRONG_MARGIN} และมั่นใจ ≥${Math.round(BANK_GRADE.STRONG_CONFIDENCE * 100)}%` });
        return;
      }
      const target = (known as any[]).find((k) => k.studentId === m.studentId);
      // Cap: ถ้าครบ MAX แล้วลบตัวที่เก่าที่สุดก่อนเพิ่มใหม่
      const { data: existing } = await supabase
        .from("student_face_descriptors")
        .select("id, created_at")
        .eq("student_id", m.studentId)
        .order("created_at", { ascending: true });
      const cap = BANK_GRADE.MAX_DESCRIPTORS_PER_STUDENT;
      if ((existing?.length || 0) >= cap) {
        const toRemove = (existing || []).slice(0, (existing!.length - cap) + 1);
        await supabase.from("student_face_descriptors").delete().in("id", toRemove.map((r) => r.id));
      }
      const { data: { user } } = await supabase.auth.getUser();
      const nextIdx = existing?.length || 0;
      const { error } = await supabase.from("student_face_descriptors").insert({
        student_id: m.studentId,
        sample_index: nextIdx,
        descriptor: Array.from(det.descriptor),
        captured_by: user?.id,
        source: "confirm_mode",
      } as any);
      if (error) throw error;
      toast.success(`เพิ่ม descriptor ใหม่ให้ ${target?.name || "นักเรียน"}`, {
        description: `มั่นใจ ${Math.round(m.confidence * 100)}% • Δ ${m.margin.toFixed(2)} • คุณภาพ ${q.score}/100`,
      });
      await refetchKnown();
    } catch (e: any) {
      toast.error("Confirm Mode ผิดพลาด: " + (e?.message || ""));
    } finally {
      setConfirming(false);
    }
  }, [modelReady, canConfirm, known, refetchKnown]);

  const recordScan = useCallback(async (
    studentId: string,
    studentCode: string,
    name: string,
    classroom: string,
    confidence: number,
    capturedFace?: string,
    registeredFace?: string | null,
    entryMethod: "face" | "qr" | "manual" = "face",
  ) => {
    const now = Date.now();
    const mode = scanModeRef.current;
    const modeLabel = mode === "exit" ? "ออก" : "เข้า";
    // ตรวจช่วงเวลาที่อนุญาตให้สแกน (กันสแกนนอกเวลาเรียน)
    const win = checkWindow(mode);
    if (win.allowed === false) {
      const cdKey = `${studentId}:window`;
      const lastNotice = duplicateNoticeRef.current.get(cdKey) || 0;
      if (now - lastNotice > 5_000) {
        duplicateNoticeRef.current.set(cdKey, now);
        playDuplicateSound();
        toast.warning("ปฏิเสธการสแกน", { description: win.reason, duration: 2200 });
        setLive({ kind: "duplicate", text: win.reason, sub: `${name} • ${classroom}` });
      }
      return;
    }
    const seenSet = mode === "exit" ? seenTodayRef.current.exit : seenTodayRef.current.entry;
    const cdKey = `${studentId}:${mode}`;
    const spokenName = name.replace(/^(ด\.ช\.|ด\.ญ\.|นาย|นางสาว|นาง|น\.ส\.|เด็กชาย|เด็กหญิง)\s*/u, "").trim();
    if (seenSet.has(studentId)) {
      const lastNotice = duplicateNoticeRef.current.get(cdKey) || 0;
      if (now - lastNotice > 5_000) {
        duplicateNoticeRef.current.set(cdKey, now);
        playDuplicateSound();
        if (voiceEnabled) speakText(`สแกน${modeLabel}ซ้ำ ${spokenName} บันทึกแล้ว`);
        toast.info("สแกนซ้ำ", { description: `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, duration: 1800 });
        setLive({ kind: "duplicate", text: `สแกน${modeLabel}ซ้ำ • ${name}`, sub: `เลขที่ ${studentCode} • บันทึกวันนี้แล้ว` });
      }
      justScannedRef.current.set(cdKey, now);
      cooldownRef.current.set(cdKey, now);
      return;
    }

    const last = cooldownRef.current.get(cdKey) || 0;
    if (now - last < 30_000) {
      if (now - last > 2_000) {
        playDuplicateSound();
        if (voiceEnabled) speakText(`สแกน${modeLabel}ซ้ำ ${spokenName}`);
        setLive({ kind: "duplicate", text: `สแกน${modeLabel}ซ้ำ • ${name}`, sub: "เพิ่งบันทึกเมื่อสักครู่" });
      }
      return;
    }
    cooldownRef.current.set(cdKey, now);

    const { data: { user } } = await supabase.auth.getUser();
    const uploadedFaceUrl = entryMethod === "face" ? await uploadFaceScanSnapshot(capturedFace, studentId) : null;
    const deviceLabel =
      entryMethod === "manual" ? `manual-${mode}`
      : entryMethod === "qr" ? `qr-${mode}`
      : `tablet-gate-${mode}`;
    const { data, error } = await supabase.from("face_scan_logs").insert({
      student_id: studentId,
      scan_type: mode,
      confidence,
      scanned_by: user?.id,
      device_label: deviceLabel,
      entry_method: entryMethod,
      captured_face_url: uploadedFaceUrl,
    } as any).select("id").maybeSingle();
    if (error) {
      if (error.code === "23505") {
        seenSet.add(studentId);
        playDuplicateSound();
        if (voiceEnabled) speakText(`สแกน${modeLabel}ซ้ำ ${spokenName} บันทึกแล้ว`);
        toast.info("สแกนซ้ำ", { description: `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, duration: 1800 });
        return;
      }
      toast.error("บันทึกล้มเหลว: " + error.message);
      return;
    }
    if (!data) {
      seenSet.add(studentId);
      playDuplicateSound();
      if (voiceEnabled) speakText(`สแกน${modeLabel}ซ้ำ ${spokenName} บันทึกแล้ว`);
      toast.info("สแกนซ้ำ", { description: `${name} ถูกบันทึก${modeLabel}โรงเรียนวันนี้แล้ว`, duration: 1800 });
      return;
    }
    justScannedRef.current.set(cdKey, now);
    playSuccessSound();
    if (voiceEnabled) speakText(`สแกน${modeLabel}สำเร็จ ${spokenName}`);
    if (!seenSet.has(studentId)) {
      seenSet.add(studentId);
      setTodayCounts((c) => ({ ...c, [mode]: c[mode] + 1 }));
    }
    setRecent((r) => [{
      studentId, studentCode, name, classroom, confidence,
      time: new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      capturedFace,
      registeredFace: registeredFace || undefined,
      entryMethod,
      scannerName: scannerName || undefined,
      scanType: mode,
    }, ...r].slice(0, 8));
    const methodLabel = entryMethod === "manual" ? "บันทึกด้วยรหัส" : entryMethod === "qr" ? "QR" : "ใบหน้า";
    toast.success(`✓ ${modeLabel}โรงเรียน • ${name}`, { description: `เลขที่ ${studentCode} • ชั้น ${classroom} • ${methodLabel}`, duration: 2500 });
    setLive({ kind: "success", text: `✓ ${name}`, sub: `เลขที่ ${studentCode} • ชั้น ${classroom} • ${methodLabel}` }, 3000);
  }, [voiceEnabled, setLive]);

  // Detection loop with HQ multi-face — fast cadence + far-distance + auto snapshot
  // 🔋 Power-saving: idle throttling + visibility pause + auto-stop after long idle
  const lastFaceAtRef = useRef<number>(Date.now());
  const [autoPaused, setAutoPaused] = useState(false);
  useEffect(() => {
    if (QR_ONLY_MODE) return; // 🔋 ไม่รันตรวจใบหน้าในหน้านี้ — ใช้โหมดคีออสเท่านั้น
    if (!streaming || !modelReady) return;
    let cancelled = false;
    lastFaceAtRef.current = Date.now();
    setAutoPaused(false);
    // iOS Safari รับภาระจับใบหน้า + QR พร้อมกันได้จำกัด จึงลดงานฝั่ง face ลงเพื่อให้ QR ติดเสถียรกว่า
    const opts = detectorOptionsHQ(isIOS ? 416 : 608, isIOS ? 0.42 : 0.35);
    const unknownCooldownRef = { current: 0 };
    const snapCanvas = document.createElement("canvas");

    // 🔋 ค่าประหยัดพลังงาน
    const IDLE_AFTER_MS = 5_000;          // ไม่เจอใบหน้า 5 วิ → เข้าโหมดประหยัด
    const IDLE_WAIT_MS = 800;             // โหมดประหยัด: ลูปทุก 800ms (จาก ~160ms)
    const AUTO_STOP_AFTER_MS = 60_000; // ไม่มีคนผ่าน 1 นาที → ปิดกล้องเอง

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

    const MIN_SHARPNESS = 60;
    const loop = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) { if (!cancelled) setTimeout(loop, 500); return; }

      // 🔋 หยุดทำงานเมื่อสลับไปแท็บอื่น/ล็อกจอ
      if (document.hidden) {
        if (!cancelled) setTimeout(loop, 1000);
        return;
      }

      // 🔋 ปิดกล้องอัตโนมัติเมื่อไม่มีคนผ่านนาน — กันเครื่องร้อน/แบตหมด
      if (Date.now() - lastFaceAtRef.current > AUTO_STOP_AFTER_MS) {
        setAutoPaused(true);
        stopCamera();
        return;
      }

      const tStart = performance.now();
      try {
        const video = videoRef.current;
        // ตรวจจับจากเฟรมที่ผ่าน preprocess (contrast/brightness) — กล้องคุณภาพต่ำก็ match ได้ดี
        const pre = preprocessFrame(video, { maxWidth: 960 }) || video;
        const detections = await getAllDescriptors(pre as any, opts);
        const srcW = pre instanceof HTMLCanvasElement ? pre.width : video.videoWidth;
        const scaleBack = video.videoWidth / Math.max(1, srcW);
        if (detections.length > 0) lastFaceAtRef.current = Date.now();
        const canvas = overlayRef.current;
        if (canvas && video) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const tNow = Date.now();
            const mirrored = facing === "user";
            await Promise.all(detections.map(async (det) => {
              const rb = det.detection.box;
              const rawBox = { x: rb.x * scaleBack, y: rb.y * scaleBack, width: rb.width * scaleBack, height: rb.height * scaleBack };
              // กล้องหน้าถูกมิเรอร์ด้วย CSS → ต้องพลิกพิกัด x ของกรอบให้ตรงกับใบหน้าที่ผู้ใช้เห็น
              const box = mirrored
                ? { ...rawBox, x: canvas.width - rawBox.x - rawBox.width }
                : rawBox;
              const sharpness = estimateFaceSharpness(video, box);
              const tooBlurry = sharpness < MIN_SHARPNESS;
              // Anti-false-positive: landmark sanity (กันจับต้นไม้/วัตถุ)
              const sanity = landmarkSanityScore(det.landmarks);
              const notHuman = sanity < MIN_LANDMARK_SANITY;
              const faceTooSmall = Math.min(box.width, box.height) < BANK_GRADE.MIN_FACE_SIZE_SCAN;

              // ===== Hybrid matching: ArcFace (DeepFace-grade, ~99.4%) first, face-api fallback =====
              let m: MatchResult;
              let usedArcFace = false;
              if (arcReady && knownV2List.length > 0) {
                let v2: Float32Array | null = null;
                try { v2 = await computeArcFaceEmbedding(video, det.landmarks); } catch { v2 = null; }
                if (v2) {
                  const am = matchArcFace(v2, knownV2List, ARCFACE_GRADE.MATCH_THRESHOLD);
                  if (am.studentId && am.margin >= ARCFACE_GRADE.MIN_MARGIN) {
                    // Strong ArcFace match — trust it, build a face-api-compatible result
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
              const ambiguous = m.studentId != null && m.margin < (usedArcFace ? ARCFACE_GRADE.MIN_MARGIN : MIN_MARGIN);
              const lowConfidence = m.studentId != null && m.confidence < MIN_CONFIDENCE;
              const passQuality = !tooBlurry && !notHuman && !faceTooSmall;
              const passMatch = usedArcFace
                ? (m.studentId != null && !ambiguous)            // ArcFace already vetted
                : (!ambiguous && !lowConfidence && isStrongMatch(m));
              const matchedId = (passQuality && passMatch) ? m.studentId : null;
              const found = matchedId ? known.find((k) => k.studentId === matchedId) as any : null;

              // Multi-frame voting — ต้อง match ติดกัน ≥ VOTE_REQUIRED ครั้งภายใน VOTE_WINDOW_MS
              let voteOk = false;
              if (found) {
                const cur = voteRef.current.get(found.studentId);
                if (!cur || tNow - cur.firstAt > VOTE_WINDOW_MS) {
                  voteRef.current.set(found.studentId, { hits: 1, firstAt: tNow });
                } else {
                  cur.hits++;
                  voteOk = cur.hits >= VOTE_REQUIRED;
                }
              }

              const justScanned = found ? (tNow - (justScannedRef.current.get(found.studentId) || 0) < 3000) : false;
              const inCooldown = found ? (tNow - (cooldownRef.current.get(found.studentId) || 0) < 30_000) : false;
              const color = !found
                ? (notHuman ? "#94a3b8" : tooBlurry ? "#64748b" : (ambiguous || lowConfidence) ? "#eab308" : "#f97316")
                : justScanned ? "#16a34a" : inCooldown ? "#10b981" : voteOk ? "#22c55e" : "#3b82f6";
              const voteHits = found ? (voteRef.current.get(found.studentId)?.hits || 0) : 0;
              drawFaceFrame(ctx, {
                box,
                label: found
                  ? `${found.name}${justScanned ? " ✓ บันทึกแล้ว" : !voteOk && !inCooldown ? ` กำลังยืนยัน ${voteHits}/${VOTE_REQUIRED}` : ""}`
                  : notHuman ? "ไม่ใช่ใบหน้ามนุษย์"
                  : tooBlurry ? "ภาพเบลอ ให้นิ่งสักครู่"
                  : faceTooSmall ? "ใบหน้าเล็กเกินไป ขยับเข้าใกล้"
                  : ambiguous ? "ใบหน้าคล้ายหลายคน"
                  : lowConfidence ? `มั่นใจ ${Math.round(m.confidence * 100)}% • ต้อง ≥ ${Math.round(MIN_CONFIDENCE * 100)}%`
                  : "ไม่พบในระบบ",
                sublabel: found
                  ? `เลขที่ ${found.studentCode || "-"} • ${Math.round(m.confidence * 100)}% (Δ${m.margin.toFixed(2)}, ช ${Math.round(sharpness)})`
                  : notHuman ? `landmark ${sanity.toFixed(2)}`
                  : tooBlurry ? `ความคมชัด ${Math.round(sharpness)}`
                  : faceTooSmall ? `${Math.round(Math.min(box.width, box.height))}px ต้อง ≥ ${BANK_GRADE.MIN_FACE_SIZE_SCAN}px`
                  : ambiguous ? `ห่าง ${m.margin.toFixed(2)} • ต้อง ≥ ${MIN_MARGIN}`
                  : lowConfidence ? "ขยับเข้าใกล้กล้องอีกนิด"
                  : "กรุณาลงทะเบียน",
                matched: !!found,
                confidence: m.confidence,
                color,
              });
              if (found && voteOk) {
                const willRecord = !inCooldown;
                const snap = willRecord ? captureFaceCrop(video, box) : undefined;
                await recordScan(found.studentId, found.studentCode, found.name, found.classroom, m.confidence, snap, found.avatarUrl, "face");
              } else if (!found && !tooBlurry && !notHuman) {
                if (tNow - unknownCooldownRef.current > 5000) {
                  unknownCooldownRef.current = tNow;
                  playUnknownSound();
                  setLive({ kind: "unknown", text: "ไม่พบในระบบ", sub: "กรุณาลงทะเบียนใบหน้า" }, 2500);
                }
              } else if (tooBlurry || notHuman) {
                setLive({ kind: "detecting", text: "กำลังจับภาพ...", sub: notHuman ? "ไม่ใช่ใบหน้ามนุษย์" : "กรุณานิ่งสักครู่" }, 1200);
              }
            }));
          }
        }
      } catch (e) {
        console.error("detect err", e);
      }
      // 🔋 Adaptive cadence — ไม่เจอใบหน้านาน → ลูปช้าลง 5 เท่า ลด CPU/แบต
      const idle = Date.now() - lastFaceAtRef.current > IDLE_AFTER_MS;
      const elapsed = performance.now() - tStart;
      const wait = idle
        ? IDLE_WAIT_MS
        : isIOS
          ? (elapsed > 180 ? 160 : 240)
          : Math.max(100, elapsed > 250 ? 100 : 160);
      if (!cancelled) setTimeout(loop, wait);
    };

    // 🔋 Resume เร็วขึ้นหลังกลับมาที่แท็บ
    const onVis = () => { if (!document.hidden) lastFaceAtRef.current = Date.now(); };
    document.addEventListener("visibilitychange", onVis);

    loop();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [streaming, modelReady, known, knownV2List, arcReady, threshold, recordScan, setLive, isIOS, facing]);


  // QR scanning loop — ใช้ BarcodeDetector ถ้ามี (Chrome/Android) มิฉะนั้น fallback ไป jsQR (Safari/iOS)
  useEffect(() => {
    if (!streaming) return;
    let cancelled = false;
    const BD = (window as any).BarcodeDetector;
    const hasBD = !!BD;
    if (hasBD) {
      try { qrDetectorRef.current = new BD({ formats: ["qr_code", "code_128", "code_39", "ean_13"] }); }
      catch { qrDetectorRef.current = null; }
    }
    const scanCanvas = document.createElement("canvas");
    const scanCtx = scanCanvas.getContext("2d", { willReadFrequently: true });
    let jsQR: any = null;

    const extractStudentCode = (rawInput: string) => {
      const raw = (rawInput || "").trim();
      if (!raw) return "";
      let code = raw;
      try {
        if (/^https?:\/\//i.test(raw)) {
          const url = new URL(raw);
          code = url.searchParams.get("code") || url.searchParams.get("sid") || url.searchParams.get("student") || raw;
          if (code === raw) {
            const parts = url.pathname.split("/").filter(Boolean);
            if (parts.length) code = parts[parts.length - 1];
          }
        } else {
          const m = raw.match(/(?:code|student|sid)[=/:]([A-Za-z0-9_-]+)/i);
          if (m?.[1]) code = m[1];
        }
      } catch {}
      return code.trim();
    };

    const handleCode = async (raw: string) => {
      const code = extractStudentCode(raw);
      if (!code || code.length < 3) return;
      const now = Date.now();
      const last = qrCooldownRef.current.get(code) || 0;
      if (now - last < 3000) return;
      qrCooldownRef.current.set(code, now);
      const k = known.find((x: any) => x.studentCode === code) as any;
      if (k) {
        await recordScan(k.studentId, k.studentCode, k.name, k.classroom, 1, undefined, k.avatarUrl, "qr");
        return;
      }
      const { data } = await supabase
        .from("students")
        .select("id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name)")
        .eq("student_code", code)
        .maybeSingle();
      if (data) {
        const cls = (data as any).classrooms ? `${(data as any).classrooms.grade_level || ""}/${(data as any).classrooms.name || ""}` : "-";
        const name = `${data.prefix || ""}${data.first_name} ${data.last_name}`.trim();
        const registeredFace = data.photo_url ? await resolveDisplayImageUrl(data.photo_url) || data.photo_url : undefined;
        await recordScan(data.id, data.student_code || code, name, cls, 1, undefined, registeredFace, "qr");
      } else {
        toast.error(`ไม่พบนักเรียนรหัส ${code}`);
      }
    };

    const scanWithJsQr = async (video: HTMLVideoElement) => {
      if (!jsQR || !scanCtx || !video.videoWidth || !video.videoHeight) return null;

      const passes = [
        { sx: 0, sy: 0, sw: video.videoWidth, sh: video.videoHeight, maxW: isIOS ? 960 : 800 },
        {
          sx: video.videoWidth * 0.18,
          sy: video.videoHeight * 0.18,
          sw: video.videoWidth * 0.64,
          sh: video.videoHeight * 0.64,
          maxW: isIOS ? 1100 : 900,
        },
      ];

      for (const pass of passes) {
        const scale = Math.min(1, pass.maxW / pass.sw);
        const w = Math.max(1, Math.floor(pass.sw * scale));
        const h = Math.max(1, Math.floor(pass.sh * scale));
        scanCanvas.width = w;
        scanCanvas.height = h;
        scanCtx.imageSmoothingEnabled = false;
        scanCtx.drawImage(video, pass.sx, pass.sy, pass.sw, pass.sh, 0, 0, w, h);
        const img = scanCtx.getImageData(0, 0, w, h);
        const res = jsQR(img.data, w, h, { inversionAttempts: isIOS ? "attemptBoth" : "dontInvert" });
        if (res?.data) return res.data;
      }

      return null;
    };

    const loop = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) { if (!cancelled) setTimeout(loop, 500); return; }
      const video = videoRef.current;
      try {
        if (qrDetectorRef.current) {
          const codes = await qrDetectorRef.current.detect(video);
          for (const c of codes || []) await handleCode(c.rawValue || "");
        } else {
          const result = await scanWithJsQr(video);
          if (result) await handleCode(result);
        }
      } catch {}
      if (!cancelled) setTimeout(loop, isIOS ? 220 : 300);
    };

    if (hasBD) {
      loop();
    } else {
      // โหลด jsQR แบบ dynamic เฉพาะเมื่อจำเป็น
      import("jsqr").then((mod) => {
        if (cancelled) return;
        jsQR = mod.default;
        loop();
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [streaming, known, recordScan, isIOS]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="grid xl:grid-cols-[1fr_300px] gap-4">
      <Card className="overflow-hidden">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={modelReady ? "default" : "secondary"}>
                {QR_ONLY_MODE ? "โหมด QR (ประหยัดแบต)" : (modelReady ? "พร้อมสแกน" : modelStatus)}
              </Badge>
              {!QR_ONLY_MODE && <Badge variant="outline">{known.length} ใบหน้าในระบบ</Badge>}
              {!QR_ONLY_MODE && (arcReady ? (
                <Badge className="bg-brand-entry/15 text-brand-entry border-success/30 gap-1">
                  <ShieldCheck className="w-3 h-3" /> ArcFace (DeepFace-grade) • {knownV2List.length} คน
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-xs">กำลังโหลด ArcFace...</Badge>
              ))}
              {geofence.configured && (
                <Badge
                  variant={geoStatus.ok ? "default" : "destructive"}
                  className="gap-1"
                  title={`ศูนย์กลาง: ${geofence.lat.toFixed(5)}, ${geofence.lng.toFixed(5)} • รัศมี ${geofence.radius} ม.`}
                >
                  <MapPin className="w-3 h-3" />
                  {geoStatus.distance == null
                    ? `ในรัศมี ${geofence.radius} ม.`
                    : geoStatus.ok
                      ? `ในพื้นที่ (${Math.round(geoStatus.distance)} ม.)`
                      : `นอกพื้นที่ (${Math.round(geoStatus.distance)} ม.)`}
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => window.open("/face-kiosk", "_blank")}
                variant="outline"
                className="gap-2"
              >
                <Monitor className="w-4 h-4" />โหมดคีออส (แทปเลต)
              </Button>
              {!streaming ? (
                <Button onClick={() => { unlockAudio(); setAutoPaused(false); startCamera(); }} disabled={!modelReady} className={autoPaused ? "bg-warning text-warning-foreground hover:bg-warning/90" : "gradient-primary"}>
                  <Camera className="w-4 h-4 mr-2" />
                  {autoPaused ? "แตะเพื่อกลับมาสแกน (พักอัตโนมัติเพื่อประหยัดแบต)" : "เปิดกล้อง"}
                </Button>
              ) : (
                <>
                  <Button onClick={switchCamera} variant="outline" title="สลับกล้องหน้า/หลัง"><SwitchCamera className="w-4 h-4 mr-2" />สลับกล้อง ({facing === "user" ? "หน้า" : "หลัง"})</Button>
                  <Button onClick={toggleFullscreen} variant="outline" title="กล้องเต็มจอ">
                    {isFullscreen ? <Minimize className="w-4 h-4 mr-2" /> : <Maximize className="w-4 h-4 mr-2" />}
                    {isFullscreen ? "ออกเต็มจอ" : "เต็มจอ"}
                  </Button>
                  {!QR_ONLY_MODE && canConfirm && (
                    <Button
                      onClick={runConfirmMode}
                      disabled={confirming}
                      variant="outline"
                      className="border-brand-entry/40 text-brand-entry hover:bg-brand-entry/10"
                      title="ถ่ายรูปสด → ระบบจับคู่ → เพิ่ม descriptor เข้าฐานเพื่อเพิ่มความแม่นยำกล้องนี้"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />{confirming ? "กำลังยืนยัน..." : "Confirm Mode"}
                    </Button>
                  )}
                  <Button onClick={stopCamera} variant="destructive"><CameraOff className="w-4 h-4 mr-2" />ปิดกล้อง</Button>
                </>
              )}
            </div>
          </div>

          {/* โหมดสแกน: "เข้า-ออก อัตโนมัติ" หรือ "เข้าอย่างเดียว" */}
          <div className={`grid grid-cols-2 gap-2 p-1.5 rounded-xl border-2 ${scanMode === "exit" ? "border-brand-exit/40 bg-brand-exit/5" : "border-brand-entry/40 bg-brand-entry/5"}`}>
            <button
              type="button"
              onClick={() => setScanModeSelection("auto")}
              title={`สลับเข้า/ออก อัตโนมัติเวลา ${modeCutoff} น. (ตอนนี้: ${scanMode === "exit" ? "ออก" : "เข้า"})`}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg font-semibold transition ${scanModeSelection === "auto" ? (scanMode === "exit" ? "bg-brand-exit text-brand-exit-foreground shadow-md" : "bg-brand-entry text-brand-entry-foreground shadow-md") : "bg-transparent text-muted-foreground hover:bg-muted/50"}`}
            >
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> เข้า-ออก อัตโนมัติ</span>
              <span className="text-[10px] opacity-90">
                {scanModeSelection === "auto" ? `ตอนนี้: ${scanMode === "exit" ? "ออก" : "เข้า"} · สลับ ${modeCutoff} น.` : `สลับเวลา ${modeCutoff} น.`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setScanModeSelection("entry")}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg font-semibold transition ${scanModeSelection === "entry" ? "bg-brand-entry text-brand-entry-foreground shadow-md" : "bg-transparent text-muted-foreground hover:bg-brand-entry/10"}`}
            >
              <span className="flex items-center gap-1.5"><LogIn className="w-4 h-4" /> เข้าอย่างเดียว</span>
              <span className="text-[10px] opacity-90">บันทึก "เข้าโรงเรียน" ตลอดวัน</span>
            </button>
          </div>

          {QR_ONLY_MODE && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary flex items-center gap-2">
              <ScanFace className="w-4 h-4" />
              <span>โหมด <b>สแกน QR อย่างเดียว</b> เพื่อประหยัดแบตและ CPU ของมือถือ · การสแกนใบหน้าให้ใช้ <b>โหมดคีออส</b> (แทปเลตประจำจุด) · แตะที่ภาพเพื่อสั่งโฟกัสใหม่</span>
            </div>
          )}

          <div ref={videoBoxRef} className={`relative bg-black rounded-xl overflow-hidden ${isFullscreen ? "w-screen h-screen rounded-none" : "aspect-[4/3] md:aspect-video md:max-h-[78vh] md:min-h-[520px] mx-auto w-full"}`}>
            <video ref={videoRef} onClick={handleVideoTap} className="w-full h-full object-contain cursor-crosshair" muted playsInline />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
            {isFullscreen && (
              <Button onClick={toggleFullscreen} size="sm" variant="secondary" className="absolute top-3 right-3 z-10 gap-1">
                <Minimize className="w-4 h-4" />ออกเต็มจอ
              </Button>
            )}
            {/* Live status overlay — เห็นทั้งโหมดปกติและเต็มจอ */}
            {streaming && (
              <div className={`absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none ${isFullscreen ? "top-6" : "top-3"}`}>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-sm shadow-lg">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-entry opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-entry" />
                  </span>
                  <span className="font-medium">กำลังสแกน{scanMode === "exit" ? "ออก" : "เข้า"}</span>
                  <span className="opacity-70">•</span>
                  <span className="opacity-90">วันนี้ เข้า {todayCounts.entry} • ออก {todayCounts.exit} / {totalStudents} คน</span>
                </div>
              </div>
            )}
            {streaming && liveStatus && (
              <div className={`absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none ${isFullscreen ? "bottom-10" : "bottom-3"}`}>
                <div
                  className={`flex flex-col items-center text-center px-6 py-3 rounded-2xl backdrop-blur-md text-white shadow-2xl border ${
                    liveStatus.kind === "success"
                      ? "bg-brand-entry/85 border-success/40"
                      : liveStatus.kind === "duplicate"
                      ? "bg-warning/85 border-warning/40"
                      : liveStatus.kind === "unknown"
                      ? "bg-brand-exit/85 border-danger/40"
                      : "bg-neutral/85 border-white/20"
                  } ${isFullscreen ? "text-2xl" : "text-base"}`}
                >
                  <span className="font-bold leading-tight">{liveStatus.text}</span>
                  {liveStatus.sub && (
                    <span className={`opacity-90 mt-0.5 ${isFullscreen ? "text-base" : "text-xs"}`}>{liveStatus.sub}</span>
                  )}
                </div>
              </div>
            )}
            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-3">
                <ScanFace className="w-20 h-20" />
                <p className="text-sm">{modelReady ? "กดเปิดกล้องเพื่อเริ่มสแกน" : modelStatus}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted">
            <Users className="w-5 h-5 text-primary" />
            <span className="font-semibold">วันนี้ • เข้าโรงเรียน {todayCounts.entry} / ออกโรงเรียน {todayCounts.exit} / รวม {totalStudents} คน {isFiltered ? "(ชั้นประจำ)" : "(ทั้งโรงเรียน)"}</span>
            {scannerName && (
              <span className="text-xs text-muted-foreground border-l ml-2 pl-2 flex items-center gap-1">
                <UserCircle2 className="w-3.5 h-3.5" /> ครูผู้บันทึก: <span className="font-medium text-foreground">{scannerName}</span>
              </span>
            )}
          </div>

          {/* บันทึกด้วยรหัสนักเรียน — สำรองตอนสแกนหน้า/QR ไม่ติด */}
          <div className="p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Keyboard className="w-4 h-4 text-primary" />
              บันทึกด้วยรหัสนักเรียน (กรณีสแกนหน้า/QR ไม่ติด)
            </div>
            <form
              className="flex gap-2 flex-wrap"
              onSubmit={(e) => { e.preventDefault(); submitManualCode(); }}
            >
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))}
                placeholder="กรอกรหัสนักเรียน เช่น 12345"
                className="flex-1 min-w-[180px] font-mono text-base"
                maxLength={20}
                disabled={manualLoading}
                autoComplete="off"
                inputMode="numeric"
              />
              <Button type="submit" disabled={manualLoading || !manualCode.trim()} className={scanMode === "exit" ? "bg-brand-exit text-brand-exit-foreground hover:bg-brand-exit/90" : "gradient-primary"}>
                {manualLoading ? "กำลังบันทึก..." : scanMode === "exit" ? "บันทึกออกจากโรงเรียน" : "บันทึกเข้าโรงเรียน"}
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground">
              ระบบจะบันทึกชื่อครูผู้บันทึก ({scannerName || "—"}) ติดไปกับรายการเสมอ
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-entry" />ล่าสุด</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 opacity-50" />
              ยังไม่มีการสแกน
            </p>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-auto">
              {recent.map((r, i) => (
                <div key={i} className={`p-2 rounded-lg border space-y-2 ${r.scanType === "exit" ? "bg-brand-exit/10 border-brand-exit/30" : "bg-brand-entry/10 border-brand-entry/30"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate flex items-center gap-1.5">
                        {r.scanType === "exit" ? <LogOut className="w-3.5 h-3.5 text-brand-exit shrink-0" /> : <LogIn className="w-3.5 h-3.5 text-brand-entry shrink-0" />}
                        <span className="truncate">{r.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        เลขที่ <span className="font-mono font-semibold">{r.studentCode || "-"}</span> • ชั้น {r.classroom} • {r.time}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap mt-0.5">
                        <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${r.scanType === "exit" ? "bg-brand-exit text-brand-exit-foreground" : "bg-brand-entry text-brand-entry-foreground"}`}>
                          {r.scanType === "exit" ? "ออก" : "เข้า"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                          {r.entryMethod === "manual" ? "กรอกรหัส" : r.entryMethod === "qr" ? "QR" : "ใบหน้า"}
                        </Badge>
                        {r.scannerName && <span>โดย <span className="font-medium text-foreground">{r.scannerName}</span></span>}
                      </p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${r.scanType === "exit" ? "text-brand-exit border-danger/40" : "text-brand-entry border-success/40"}`}>{Math.round(r.confidence * 100)}%</Badge>
                  </div>
                  {(r.capturedFace || r.registeredFace) && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="text-center">
                        <div className="aspect-square rounded-md overflow-hidden bg-muted border">
                          <RecentRegisteredFace src={r.registeredFace} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">ลงทะเบียน</p>
                      </div>
                      <div className="text-center">
                        <div className="aspect-square rounded-md overflow-hidden bg-muted border">
                          {r.capturedFace ? (
                            <img src={r.capturedFace} alt="ที่ตรวจพบ" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">-</div>
                          )}
                        </div>
                        <p className="text-[10px] text-brand-entry mt-1 font-medium">ที่ตรวจพบ</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FaceScanTab;
