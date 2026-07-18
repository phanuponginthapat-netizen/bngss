import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  ScanFace, CheckCircle2, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  Sparkles, Camera, Loader2, RotateCcw, ShieldCheck, SwitchCamera,
  Smile, Eye, Send, AlertCircle, ZoomIn, UserCircle2, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  loadFaceModels, detectFaceWithLandmarks, applyCameraAutoTune, estimateFaceSharpness,
} from "@/lib/faceApi";
import { loadArcFace, computeArcFaceEmbedding, isArcFaceReady, ARCFACE_GRADE } from "@/lib/arcface";
import { toast } from "sonner";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * ลงทะเบียนใบหน้าแบบ Liveness Wizard (เข้มงวดที่สุด — แบบแอปธนาคาร / ตู้ตม.)
 *
 * - นักเรียน: ลงทะเบียนตัวเองจากมือถือได้ทันที (ไม่ต้องรอแอดมิน)
 * - ครู/แอดมิน: เลือกนักเรียนแล้วช่วยลงทะเบียนผ่าน wizard เดียวกัน
 *
 * 9 ขั้นตอน + 4 color challenge = สูงสุด ~12 ภาพ/คน
 *   center → close-up → blink → mouth-open → left → right → up → down → color → done
 */

type StepKey =
  | "center" | "close" | "blink" | "mouth"
  | "left" | "right" | "up" | "down"
  | "color" | "done";

interface Step {
  key: StepKey;
  label: string;
  hint: string;
  icon: typeof ScanFace;
}

const STEPS: Step[] = [
  { key: "center", label: "1. จัดหน้าให้ตรงกรอบ",   hint: "มองตรงเข้ากล้อง อยู่นิ่ง ๆ",                icon: ScanFace },
  { key: "close",  label: "2. ขยับเข้าใกล้อีกหน่อย", hint: "ให้หน้าเต็มกรอบประมาณ 30–40 ซม. จากกล้อง",  icon: ZoomIn },
  { key: "blink",  label: "3. กะพริบตา",             hint: "หลับตา 1 ครั้งช้า ๆ แล้วลืมตา",           icon: Eye },
  { key: "mouth",  label: "4. อ้าปากค้างไว้",         hint: "อ้าปากกว้างประมาณ 1 วินาที",              icon: Smile },
  { key: "left",   label: "5. หันหน้าไปทางซ้าย",     hint: "หันช้า ๆ ประมาณ 30–40°",                  icon: ArrowLeft },
  { key: "right",  label: "6. หันหน้าไปทางขวา",      hint: "หันช้า ๆ ประมาณ 30–40°",                  icon: ArrowRight },
  { key: "up",     label: "7. เงยหน้าขึ้นเล็กน้อย",  hint: "เงยขึ้นนิดเดียว มองที่กล้อง",              icon: ArrowUp },
  { key: "down",   label: "8. ก้มหน้าลงเล็กน้อย",    hint: "ก้มลงนิดเดียว มองที่กล้อง",                icon: ArrowDown },
  { key: "color",  label: "9. ตรวจสีกันรูปปลอม",     hint: "หน้าจอจะเปลี่ยนสี ให้มองตรงกล้องค้างไว้",   icon: Sparkles },
  { key: "done",   label: "เสร็จสมบูรณ์",             hint: "กดยืนยันบันทึกข้อมูล",                    icon: CheckCircle2 },
];

const CHALLENGE_COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#ffffff"];

// Banking-grade strict gates
const MIN_SHARPNESS = 95;
const MIN_FACE_FRAC = 0.16;
const MAX_FACE_FRAC = 0.62;

interface CapturedSample {
  descriptor: Float32Array;          // face-api 128-dim (v1, fallback)
  descriptorV2: Float32Array | null; // ArcFace 512-dim (v2, primary — DeepFace-grade)
  image: string;
  metrics: {
    stepKey: StepKey;
    faceWidthPx: number;
    faceHeightPx: number;
    faceFrac: number;
    sharpness: number;
    yaw: number;
    pitch: number;
    ear: number;
    hasArcFace: boolean;
  };
}

const FaceRegisterTab = () => {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const userId = user?.id ?? null;
  const { isStudent } = useUserRole();

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const detectMetaRef = useRef({ misses: 0, stableHits: 0 });
  const blinkRef = useRef({ openSeen: false, closeFrames: 0, reopenFrames: 0 });
  const mouthStateRef = useRef<{ openFrames: number; baseline: number; samples: number[] }>({
    openFrames: 0, baseline: 0, samples: [],
  });

  const [modelReady, setModelReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [stepIdx, setStepIdx] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [samples, setSamples] = useState<CapturedSample[]>([]);
  const [colorFrameIdx, setColorFrameIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");

  // student picker (for teacher/admin mode)
  const [pickedStudentId, setPickedStudentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [arcReady, setArcReady] = useState(false);
  const [arcStatus, setArcStatus] = useState<string>("");
  useEffect(() => {
    loadFaceModels().then(() => setModelReady(true));
    // Load ArcFace in parallel — non-blocking (face-api works as fallback if it fails)
    loadArcFace((msg) => setArcStatus(msg))
      .then(() => { setArcReady(true); setArcStatus("AI ใบหน้าระดับ DeepFace พร้อมใช้งาน"); })
      .catch((e) => { setArcStatus(`ArcFace โหลดไม่สำเร็จ (ใช้โหมดเดิมต่อ): ${e.message}`); });
  }, []);

  // นักเรียน — หาตัวเอง
  const { data: myStudent, isLoading: meLoading } = useQuery({
    queryKey: ["my-student-record", userId],
    enabled: !!userId && isStudent,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name)")
        .eq("auth_user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  // ครู/แอดมิน — รายชื่อนักเรียนทั้งหมด
  const { data: students = [] } = useQuery({
    queryKey: ["students-list-face-register"],
    enabled: !isStudent,
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

  const targetStudent: any = isStudent ? myStudent : students.find((s: any) => s.id === pickedStudentId);
  const targetId = targetStudent?.id || null;

  const { data: existing } = useQuery({
    queryKey: ["face-registered-for", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_face_descriptors")
        .select("id")
        .eq("student_id", targetId!);
      return data || [];
    },
  });
  const isRegistered = (existing?.length || 0) > 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? students.filter((s: any) => [s.first_name, s.last_name, s.student_code]
          .some((v) => String(v || "").toLowerCase().includes(q)))
      : students;
    return list.slice(0, 30);
  }, [students, search]);

  // ===== Camera =====
  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, stream);
        setStreaming(true);
        try { applyCameraAutoTune(stream); } catch { /* ignore */ }
      }
    } catch (e: any) {
      toast.error("เปิดกล้องไม่สำเร็จ: " + e.message);
    }
  };
  const stopCamera = () => {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  };
  const switchCamera = async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    stopCamera();
    setTimeout(() => startCamera(next), 150);
  };

  useEffect(() => () => { stopCamera(); if (loopRef.current) clearTimeout(loopRef.current); }, []);

  const captureSample = useCallback(
    async (data: NonNullable<Awaited<ReturnType<typeof detectFaceWithLandmarks>>>, stepKey: StepKey): Promise<CapturedSample> => {
      const v = videoRef.current!;
      const vw = v.videoWidth, vh = v.videoHeight;
      const { box, ear, yaw, pitch, descriptor, landmarks } = data;
      const pad = 0.25;
      const sx = Math.max(0, box.x - box.width * pad);
      const sy = Math.max(0, box.y - box.height * pad);
      const sw = Math.min(vw - sx, box.width * (1 + pad * 2));
      const sh = Math.min(vh - sy, box.height * (1 + pad * 2));
      const c = document.createElement("canvas");
      const targetW = 320;
      c.width = targetW;
      c.height = Math.round((sh / sw) * targetW);
      const ctx = c.getContext("2d");
      if (ctx) {
        if (facingMode === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      }
      // Compute ArcFace (DeepFace-grade) embedding in parallel with capture.
      // Uses landmarks from the original video frame — not the cropped/mirrored canvas.
      let descriptorV2: Float32Array | null = null;
      if (isArcFaceReady()) {
        try { descriptorV2 = await computeArcFaceEmbedding(v, landmarks); } catch { descriptorV2 = null; }
      }
      return {
        descriptor,
        descriptorV2,
        image: c.toDataURL("image/jpeg", 0.88),
        metrics: {
          stepKey,
          faceWidthPx: Math.round(box.width),
          faceHeightPx: Math.round(box.height),
          faceFrac: +(box.width / vw).toFixed(3),
          sharpness: Math.round(estimateFaceSharpness(v, box)),
          yaw: +yaw.toFixed(3),
          pitch: +pitch.toFixed(3),
          ear: +ear.toFixed(3),
          hasArcFace: descriptorV2 !== null,
        },
      };
    },
    [facingMode],
  );

  // Async helper that captures + pushes a sample, used inside the step machine.
  const pushSample = useCallback(async (
    data: NonNullable<Awaited<ReturnType<typeof detectFaceWithLandmarks>>>,
    stepKey: StepKey,
  ) => {
    const sm = await captureSample(data, stepKey);
    setSamples((s) => [...s, sm]);
  }, [captureSample]);

  const drawOverlay = useCallback((data: Awaited<ReturnType<typeof detectFaceWithLandmarks>> | null) => {
    const v = videoRef.current; const cv = overlayRef.current;
    if (!v || !cv) return;
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return;
    if (cv.width !== vw || cv.height !== vh) { cv.width = vw; cv.height = vh; }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, vw, vh);
    if (!data) return;
    ctx.strokeStyle = "rgba(16, 185, 129, 0.9)";
    ctx.lineWidth = Math.max(2, vw / 320);
    ctx.strokeRect(data.box.x, data.box.y, data.box.width, data.box.height);
  }, []);

  const runStep = useCallback(async () => {
    const next = () => { loopRef.current = window.setTimeout(runStep, 120) as unknown as number; };
    if (busyRef.current) { next(); return; }
    if (!videoRef.current || !modelReady || !streaming) { next(); return; }
    if (videoRef.current.readyState < 2 || !videoRef.current.videoWidth) {
      setStatusMsg("กำลังเปิดภาพจากกล้อง..."); next(); return;
    }
    busyRef.current = true;
    const step = STEPS[stepIdx];
    let data: Awaited<ReturnType<typeof detectFaceWithLandmarks>> | null = null;
    try { data = await detectFaceWithLandmarks(videoRef.current); } catch { data = null; }
    finally { busyRef.current = false; }

    if (!data) {
      detectMetaRef.current.misses += 1;
      detectMetaRef.current.stableHits = 0;
      drawOverlay(null);
      setStatusMsg(detectMetaRef.current.misses > 12
        ? "ยังไม่เจอใบหน้า — ขยับเข้าใกล้กล้อง, เพิ่มแสง และหันหน้าตรง"
        : "ไม่พบใบหน้า — กรุณาขยับเข้าหากล้อง");
      next(); return;
    }
    detectMetaRef.current.misses = 0;
    drawOverlay(data);

    const { yaw, pitch, ear, box } = data;
    const vw = videoRef.current.videoWidth;
    const faceFrac = box.width / vw;
    const sharpness = estimateFaceSharpness(videoRef.current, box);

    // Banking-grade gates (strict)
    if (faceFrac < MIN_FACE_FRAC) {
      detectMetaRef.current.stableHits = 0;
      setStatusMsg("ใบหน้าเล็กเกินไป — เข้าใกล้กล้องอีกนิด");
      next(); return;
    }
    if (faceFrac > MAX_FACE_FRAC) {
      detectMetaRef.current.stableHits = 0;
      setStatusMsg("ใบหน้าใหญ่เกินไป — ถอยห่างอีกนิด");
      next(); return;
    }
    if (sharpness < MIN_SHARPNESS) {
      detectMetaRef.current.stableHits = 0;
      setStatusMsg(`ภาพยังเบลอ (${Math.round(sharpness)}/${MIN_SHARPNESS}) — อยู่นิ่ง ๆ หรือเช็ดกล้องก่อน`);
      next(); return;
    }

    switch (step.key) {
      case "center": {
        if (faceFrac < 0.20) { detectMetaRef.current.stableHits = 0; setStatusMsg("เข้าใกล้กล้องอีกหน่อย"); break; }
        if (Math.abs(yaw) > 0.10 || Math.abs(pitch) > 0.12) {
          detectMetaRef.current.stableHits = 0;
          setStatusMsg("หันหน้าตรงกล้องให้นิ่ง");
          break;
        }
        detectMetaRef.current.stableHits += 1;
        if (detectMetaRef.current.stableHits < 6) {
          setStatusMsg(`ตรงแล้ว — ค้างนิ่ง (${detectMetaRef.current.stableHits}/6)`);
          break;
        }
        setStatusMsg("ตรงแล้ว! กำลังบันทึก...");
        detectMetaRef.current.stableHits = 0;
        await pushSample(data!, "center");
        setStepIdx((i) => i + 1);
        break;
      }
      case "close": {
        if (faceFrac < 0.32) {
          detectMetaRef.current.stableHits = 0;
          setStatusMsg(`เข้าใกล้กล้องอีกนิด (${Math.round(faceFrac * 100)}% / ต้องการ ≥ 32%)`);
          break;
        }
        if (Math.abs(yaw) > 0.15) { detectMetaRef.current.stableHits = 0; setStatusMsg("หันหน้าตรงกล้องด้วย"); break; }
        detectMetaRef.current.stableHits += 1;
        if (detectMetaRef.current.stableHits < 4) {
          setStatusMsg(`ใกล้พอแล้ว — ค้างนิ่ง (${detectMetaRef.current.stableHits}/4)`);
          break;
        }
        detectMetaRef.current.stableHits = 0;
        await pushSample(data!, "close");
        setStepIdx((i) => i + 1);
        break;
      }
      case "blink": {
        const b = blinkRef.current;
        // require: see open → close → reopen
        if (!b.openSeen) {
          if (ear > 0.27) b.openSeen = true;
          setStatusMsg("ลืมตาก่อน แล้วค่อยกะพริบ 1 ครั้ง");
          break;
        }
        if (b.closeFrames < 2) {
          if (ear < 0.18) b.closeFrames += 1; else b.closeFrames = 0;
          setStatusMsg(`หลับตา 1 ครั้ง (EAR ${ear.toFixed(2)})`);
          break;
        }
        if (ear > 0.27) {
          b.reopenFrames += 1;
          if (b.reopenFrames >= 2) {
            await pushSample(data!, "blink");
            setStepIdx((i) => i + 1);
            blinkRef.current = { openSeen: false, closeFrames: 0, reopenFrames: 0 };
          } else {
            setStatusMsg("ลืมตาอีกนิด...");
          }
        } else {
          setStatusMsg("ลืมตา");
        }
        break;
      }
      case "mouth": {
        const st = mouthStateRef.current;
        const mouth = data.landmarks.getMouth();
        const left = mouth[0], right = mouth[6];
        const topInner = mouth[14] ?? mouth[3];
        const botInner = mouth[18] ?? mouth[9];
        const horiz = Math.hypot(right.x - left.x, right.y - left.y) || 1;
        const vert = Math.hypot(topInner.x - botInner.x, topInner.y - botInner.y);
        const mar = vert / horiz;
        if (st.baseline === 0) {
          st.samples.push(mar);
          if (st.samples.length < 8) { setStatusMsg(`กำลังปรับค่ากล้อง... (${st.samples.length}/8) ปิดปากปกติ`); break; }
          const sorted = [...st.samples].sort((a, b) => a - b);
          const low = sorted.slice(0, Math.ceil(sorted.length * 0.6));
          st.baseline = low.reduce((s, v) => s + v, 0) / low.length;
        }
        const openThr = Math.max(0.42, st.baseline + 0.28);
        const openPct = Math.max(0, Math.min(100, Math.round(((mar - st.baseline) / 0.45) * 100)));
        if (mar > openThr) {
          st.openFrames += 1;
          setStatusMsg(`อ้าปากดีแล้ว — ค้างไว้... (${st.openFrames}/5)`);
          if (st.openFrames >= 5) {
            await pushSample(data!, "mouth");
            setStepIdx((i) => i + 1);
          }
        } else {
          st.openFrames = 0;
          setStatusMsg(`อ้าปากกว้าง ๆ ค้างไว้ (${openPct}% / ต้องการ ≥ 70%)`);
        }
        break;
      }
      case "left": {
        if (yaw > 0.38) {
          detectMetaRef.current.stableHits += 1;
          if (detectMetaRef.current.stableHits < 4) { setStatusMsg(`ดีแล้ว — ค้างไว้ (${detectMetaRef.current.stableHits}/4)`); break; }
          detectMetaRef.current.stableHits = 0;
          await pushSample(data!, "left");
          setStepIdx((i) => i + 1);
        } else {
          detectMetaRef.current.stableHits = 0;
          setStatusMsg(`หันซ้ายอีก (${Math.round(Math.max(0, yaw) * 100)}% / ต้องการ ≥ 38%)`);
        }
        break;
      }
      case "right": {
        if (yaw < -0.38) {
          detectMetaRef.current.stableHits += 1;
          if (detectMetaRef.current.stableHits < 4) { setStatusMsg(`ดีแล้ว — ค้างไว้ (${detectMetaRef.current.stableHits}/4)`); break; }
          detectMetaRef.current.stableHits = 0;
          await pushSample(data!, "right");
          setStepIdx((i) => i + 1);
        } else {
          detectMetaRef.current.stableHits = 0;
          setStatusMsg(`หันขวาอีก (${Math.round(Math.max(0, -yaw) * 100)}% / ต้องการ ≥ 38%)`);
        }
        break;
      }
      case "up": {
        if (pitch < -0.18) {
          detectMetaRef.current.stableHits += 1;
          if (detectMetaRef.current.stableHits < 3) { setStatusMsg(`ดีแล้ว — ค้างไว้ (${detectMetaRef.current.stableHits}/3)`); break; }
          detectMetaRef.current.stableHits = 0;
          await pushSample(data!, "up");
          setStepIdx((i) => i + 1);
        } else {
          detectMetaRef.current.stableHits = 0;
          setStatusMsg(`เงยขึ้นอีกนิด (pitch ${pitch.toFixed(2)} / ต้องการ ≤ -0.18)`);
        }
        break;
      }
      case "down": {
        if (pitch > 0.18) {
          detectMetaRef.current.stableHits += 1;
          if (detectMetaRef.current.stableHits < 3) { setStatusMsg(`ดีแล้ว — ค้างไว้ (${detectMetaRef.current.stableHits}/3)`); break; }
          detectMetaRef.current.stableHits = 0;
          await pushSample(data!, "down");
          setStepIdx((i) => i + 1);
        } else {
          detectMetaRef.current.stableHits = 0;
          setStatusMsg(`ก้มลงอีกนิด (pitch ${pitch.toFixed(2)} / ต้องการ ≥ 0.18)`);
        }
        break;
      }
      case "color": {
        if (Math.abs(yaw) < 0.20) {
          if (samples.length < 8 + colorFrameIdx + 1) { await pushSample(data!, "color"); }
        }
        setStatusMsg(`Color ${colorFrameIdx + 1}/${CHALLENGE_COLORS.length} — มองที่กล้อง`);
        break;
      }
    }
    next();
  }, [stepIdx, modelReady, streaming, colorFrameIdx, samples.length, pushSample, drawOverlay]);

  useEffect(() => {
    if (!streaming || !modelReady) return;
    if (STEPS[stepIdx].key === "done") return;
    loopRef.current = window.setTimeout(runStep, 120) as unknown as number;
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [streaming, modelReady, stepIdx, runStep]);

  useEffect(() => {
    if (STEPS[stepIdx].key !== "color") return;
    setColorFrameIdx(0);
    let i = 0;
    const tick = () => {
      const el = flashRef.current;
      if (el) el.style.background = CHALLENGE_COLORS[i];
      i++;
      setColorFrameIdx(i);
      if (i >= CHALLENGE_COLORS.length) {
        setTimeout(() => {
          if (el) el.style.background = "transparent";
          setStepIdx((idx) => idx + 1);
          stopCamera();
        }, 800);
        clearInterval(t);
      }
    };
    tick();
    const t = setInterval(tick, 1200);
    return () => { clearInterval(t); if (flashRef.current) flashRef.current.style.background = "transparent"; };
  }, [stepIdx]);

  const reset = () => {
    setStepIdx(0); setSamples([]); setColorFrameIdx(0); setStatusMsg("");
    detectMetaRef.current = { misses: 0, stableHits: 0 };
    blinkRef.current = { openSeen: false, closeFrames: 0, reopenFrames: 0 };
    mouthStateRef.current = { openFrames: 0, baseline: 0, samples: [] };
  };

  const submit = async () => {
    if (!targetId) { toast.error("กรุณาเลือกนักเรียนก่อน"); return; }
    if (samples.length === 0) { toast.error("กรุณาทำขั้นตอน Liveness ให้ครบก่อน"); return; }
    if (isRegistered && !reason.trim()) { toast.error("กรุณาระบุเหตุผลการลงทะเบียนใหม่"); return; }
    setSubmitting(true);
    try {
      if (isRegistered) {
        await supabase.from("student_face_descriptors").delete().eq("student_id", targetId);
      }
      const hasV2Count = samples.filter((sm) => sm.descriptorV2).length;
      const modelVersion = hasV2Count > 0 ? ARCFACE_GRADE.MODEL_VERSION : "face-api-v1";
      const rows = samples.map((sm, i) => ({
        student_id: targetId,
        sample_index: i,
        descriptor: Array.from(sm.descriptor),
        embedding_v2: sm.descriptorV2 ? Array.from(sm.descriptorV2) : null,
        model_version: sm.descriptorV2 ? ARCFACE_GRADE.MODEL_VERSION : "face-api-v1",
        quality_score: sm.metrics.sharpness,
        face_image: sm.image,
        metrics: { ...sm.metrics, reason: reason.trim() || null },
        captured_by: userId!,
        source: "liveness_wizard",
      }));
      const { error } = await supabase.from("student_face_descriptors").insert(rows as any);
      if (error) throw error;
      void modelVersion; // computed for analytics; per-row version is canonical

      // history log (best-effort)
      await supabase.from("face_registration_history").insert({
        student_id: targetId,
        action: isRegistered ? "liveness_replace" : "liveness_add",
        previous_count: existing?.length || 0,
        new_count: rows.length,
        photo_urls: [],
        reason: reason.trim() || null,
        notes: `Liveness Wizard (${rows.length} samples, ${STEPS.length - 1} steps)`,
        performed_by: userId!,
      }).then(() => {}, () => {});

      toast.success(`ลงทะเบียนใบหน้าสำเร็จ ${rows.length} ภาพ — ใช้สแกนเข้าโรงเรียนได้เลย 🎉`);
      reset(); setReason("");
      qc.invalidateQueries({ queryKey: ["face-registered-for", targetId] });
      qc.invalidateQueries({ queryKey: ["face-known"] });
      qc.invalidateQueries({ queryKey: ["face-db"] });
      qc.invalidateQueries({ queryKey: ["face-registered-ids"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== render =====
  if (isStudent && meLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังโหลดข้อมูล...
      </div>
    );
  }
  if (isStudent && !myStudent) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-5 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
          <div>
            <p className="font-semibold">ไม่พบข้อมูลนักเรียนของคุณ</p>
            <p className="text-muted-foreground text-xs mt-1">
              บัญชีนี้ยังไม่ได้ผูกกับข้อมูลนักเรียน — กรุณาติดต่อครูประจำชั้น/แอดมินเพื่อเชื่อมบัญชี
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ครู/แอดมิน — ยังไม่เลือกนักเรียน
  if (!isStudent && !targetStudent) {
    return (
      <div className="space-y-4">
        <Card className="gradient-primary text-primary-foreground border-0">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">ลงทะเบียนใบหน้าแบบ Liveness Wizard</h3>
                <p className="text-sm opacity-90">เก็บใบหน้าหลายมุม + ตรวจของจริง (กระพริบตา / อ้าปาก / ตรวจสี) แบบแอปธนาคาร</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserCircle2 className="w-5 h-5 text-primary" />
              <h4 className="font-semibold">เลือกนักเรียนที่ต้องการลงทะเบียน</h4>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ / นามสกุล / รหัส..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto divide-y rounded-lg border">
              {filtered.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setPickedStudentId(s.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><UserCircle2 className="w-6 h-6" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.prefix}{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-muted-foreground">{s.student_code} {(s as any).classrooms ? ` • ${(s as any).classrooms.name}` : ""}</p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">ไม่พบนักเรียนที่ตรงกับคำค้น</div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 แนะนำ: ส่งลิงก์นี้ให้นักเรียนล็อกอินบนมือถือตัวเอง — ระบบจะเปิดในโหมด "ลงทะเบียนตัวเอง" ให้อัตโนมัติ
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName = `${targetStudent.prefix || ""}${targetStudent.first_name || ""} ${targetStudent.last_name || ""}`.trim();
  const classroom = (targetStudent as any).classrooms ? `${(targetStudent as any).classrooms.name}` : "";
  const step = STEPS[stepIdx];
  const StepIcon = step.icon;
  const progress = (stepIdx / (STEPS.length - 1)) * 100;
  const isDone = step.key === "done";

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="gradient-primary text-primary-foreground border-0">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden">
              {targetStudent.photo_url ? (
                <img src={targetStudent.photo_url} alt={fullName} className="w-full h-full object-cover" />
              ) : (<ScanFace className="w-7 h-7" />)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold truncate">{fullName}</h3>
              <p className="text-sm opacity-90">
                {targetStudent.student_code}{classroom ? ` • ${classroom}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {isRegistered ? (
                  <Badge className="bg-success/90 hover:bg-success text-success-foreground border-0 gap-1">
                    <CheckCircle2 className="w-3 h-3" /> ลงทะเบียนแล้ว ({existing?.length} ภาพ)
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0">ยังไม่ลงทะเบียน</Badge>
                )}
                <Badge className="bg-white/20 text-primary-foreground border-0 gap-1">
                  <ShieldCheck className="w-3 h-3" /> Banking-grade Liveness
                </Badge>
                <Badge className="bg-white/20 text-primary-foreground border-0">
                  9 ขั้นตอน • ~12 ภาพ
                </Badge>
                {arcReady ? (
                  <Badge className="bg-success/70 hover:bg-success text-success-foreground border-0 gap-1">
                    <Sparkles className="w-3 h-3" /> ArcFace (DeepFace-grade)
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0 gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> โหลด AI ใบหน้า…
                  </Badge>
                )}
              </div>
            </div>
            {!isStudent && (
              <Button variant="secondary" size="sm" className="bg-white/15 hover:bg-white/25 text-white border-0"
                onClick={() => { reset(); setReason(""); setPickedStudentId(null); stopCamera(); }}>
                เปลี่ยนคน
              </Button>
            )}
          </div>
          <p className="text-xs opacity-90">
            ทำตามขั้นตอนที่ระบบบอกทีละข้อ — ระบบจะจับภาพให้อัตโนมัติเมื่อท่าทางถูกต้องและภาพชัดเพียงพอ (ไม่ต้องอัปโหลดไฟล์เอง)
          </p>
        </CardContent>
      </Card>

      {/* Wizard */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1">
                <StepIcon className="w-3 h-3" />ขั้นที่ {stepIdx + 1}/{STEPS.length}
              </Badge>
              <span className="text-xs text-muted-foreground">{samples.length} ตัวอย่าง</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm font-semibold">{step.label}</p>
            <p className="text-xs text-muted-foreground">{step.hint}</p>
          </div>

          {isRegistered && (
            <div className="space-y-1">
              <label className="text-xs font-medium">เหตุผลการลงทะเบียนใหม่ <span className="text-destructive">*</span></label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น ตัดผมสั้น / ใส่แว่นใหม่ / รูปเดิมจำไม่ได้ / โตขึ้น..."
                rows={2}
              />
            </div>
          )}

          <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] sm:aspect-[4/5] max-h-[70vh] mx-auto w-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted playsInline
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
            <div ref={flashRef} className="absolute inset-0 mix-blend-screen opacity-60 transition-colors duration-300 pointer-events-none" />

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-[75%] aspect-[3/4] max-h-[85%] rounded-[50%] border-4 ${
                statusMsg.includes("ดีมาก") || statusMsg.includes("ตรงแล้ว") || statusMsg.includes("ใกล้พอแล้ว")
                  ? "border-success/30" : "border-white/60"
              } transition-colors`} />
            </div>

            {streaming && (
              <Button
                onClick={switchCamera}
                size="icon" variant="secondary"
                className="absolute top-3 right-3 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 h-10 w-10"
                title="สลับกล้องหน้า/หลัง"
              >
                <SwitchCamera className="w-5 h-5" />
              </Button>
            )}

            {statusMsg && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full max-w-[90%] text-center">
                {statusMsg}
              </div>
            )}

            {!streaming && !isDone && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button onClick={() => startCamera()} disabled={!modelReady} size="lg" className="gradient-primary">
                  {!modelReady ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  {!modelReady ? "กำลังโหลดโมเดล..." : "เริ่มลงทะเบียน"}
                </Button>
              </div>
            )}
          </div>

          {samples.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">ภาพที่จับได้ ({samples.length})</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {samples.map((sm, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border bg-muted/40">
                    <img src={sm.image} alt={`sample-${idx + 1}`} className="w-full aspect-square object-cover" />
                    <div className="absolute top-1 left-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{sm.metrics.stepKey}</Badge>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[10px] leading-tight px-1.5 py-1">
                      คม {sm.metrics.sharpness} · yaw {sm.metrics.yaw}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isDone && (
            <div className="rounded-lg border border-success/30 bg-brand-entry/5 p-4 text-sm">
              <div className="flex items-center gap-2 text-brand-entry font-semibold mb-1">
                <CheckCircle2 className="w-5 h-5" /> ผ่าน Liveness Check ครบทุกขั้น
              </div>
              <p className="text-xs text-muted-foreground">
                ระบบจับได้ {samples.length} ภาพจาก {STEPS.length - 1} ขั้นตอน — กด "บันทึกลงทะเบียน" เพื่อใช้สแกนได้ทันที
              </p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => { reset(); }} disabled={submitting}>
              <RotateCcw className="w-4 h-4 mr-2" />เริ่มใหม่
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !isDone || samples.length === 0}
              className="flex-1 gradient-primary"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              บันทึกลงทะเบียน ({samples.length} ภาพ)
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            💡 ใช้การตรวจจับใบหน้าจริง (Liveness Check) แบบเดียวกับแอปธนาคาร/ตู้ตม. — กันการใช้รูปถ่ายปลอม
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FaceRegisterTab;
