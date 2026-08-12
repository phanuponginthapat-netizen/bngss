import { useEffect, useRef, useState, useCallback } from "react";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ScanFace, CheckCircle2, Eye, ArrowLeft, ArrowRight, Sparkles,
  Camera, Loader2, RotateCcw, ShieldCheck, SwitchCamera, Smile,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  loadFaceModels, detectFaceWithLandmarks, applyCameraAutoTune, estimateFaceSharpness, euclidean,
} from "@/lib/faceApi";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentCode: string;
  displayName: string;
  onComplete?: () => void;
  /** "direct" = บันทึกลงฐานข้อมูลทันที (เจ้าหน้าที่) · "request" = ส่งคำขอรออนุมัติ (นักเรียนลงทะเบียนเอง) */
  submitMode?: "direct" | "request";
  /** เหตุผล (ใช้เมื่อเป็นการลงทะเบียนใหม่ในโหมดคำขอ) */
  reason?: string;
}

/** ระยะห่างสูงสุดที่ยอมรับได้ระหว่างตัวอย่างของ "คนเดียวกัน" */
const SELF_CONSISTENCY_MAX = 0.55;
/** ถ้าใบหน้าใกล้กับคนอื่นในระบบมากกว่านี้ = ถือว่าซ้ำคน */
const DUPLICATE_THRESHOLD = 0.42;

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};


type StepKey = "center" | "mouth" | "left" | "right" | "color" | "done";

interface Step {
  key: StepKey;
  label: string;
  hint: string;
  icon: typeof Eye;
  color?: string;
}

const STEPS: Step[] = [
  { key: "center",  label: "จัดหน้าให้ตรงกรอบ",        hint: "มองตรงมาที่กล้อง",                icon: ScanFace },
  { key: "mouth",   label: "อ้าปากค้างไว้",              hint: "อ้าปากกว้างประมาณ 1 วินาที",        icon: Smile },
  { key: "left",    label: "หันหน้าไปทางซ้าย",          hint: "หันช้าๆ ประมาณ 30 องศา",            icon: ArrowLeft },
  { key: "right",   label: "หันหน้าไปทางขวา",           hint: "หันช้าๆ ประมาณ 30 องศา",            icon: ArrowRight },
  { key: "color",   label: "Color Challenge (กันรูปปลอม)", hint: "หน้าจอจะเปลี่ยนสี ให้มองที่กล้อง", icon: Sparkles },
  { key: "done",    label: "เสร็จสมบูรณ์",              hint: "บันทึกข้อมูลเรียบร้อย",            icon: CheckCircle2 },
];

const CHALLENGE_COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#ffffff"]; // red/green/blue/white

interface CapturedSample {
  descriptor: Float32Array;
  image: string; // dataURL ของใบหน้าที่ถูกครอบไว้
  metrics: {
    stepKey: StepKey;
    faceWidthPx: number;
    faceHeightPx: number;
    faceFrac: number;        // สัดส่วนใบหน้าต่อเฟรม
    sharpness: number;       // คะแนนความคมชัด (Laplacian variance)
    yaw: number;             // มุมหันซ้าย-ขวา
    pitch: number;           // มุมก้ม-เงย
    ear: number;             // Eye Aspect Ratio
    noseTipX: number;        // ตำแหน่งจมูกใน 0..1 (เทียบกับกล่องใบหน้า)
    noseTipY: number;
    noseWidthFrac: number;   // ความกว้างจมูกเทียบกับใบหน้า
    noseHeightFrac: number;  // ความสูงสันจมูก
  };
}

interface DuplicateFaceMatch {
  match_name: string | null;
  match_code: string | null;
  min_distance: number;
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
const errorName = (error: unknown) => error instanceof DOMException || error instanceof Error ? error.name : "";

const LivenessFaceRegisterDialog = ({ open, onOpenChange, studentCode, displayName, onComplete, submitMode = "direct", reason }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const detectMetaRef = useRef({ misses: 0, stableHits: 0 });

  const mouthStateRef = useRef<{
    opened: boolean;        // ปาก "อ้า" อยู่หรือยัง
    openFrames: number;     // กี่เฟรมต่อเนื่องที่ปากอ้า (สำหรับยืนยัน)
    baseline: number;       // MAR ตอนปากปิด (calibrate ต่อคน)
    samples: number[];      // สำหรับคำนวณ baseline
    maxMar: number;         // MAR สูงสุดที่เห็น (debug)
  }>({ opened: false, openFrames: 0, baseline: 0, samples: [], maxMar: 0 });

  const [studentId, setStudentId] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [samples, setSamples] = useState<CapturedSample[]>([]);
  const [colorFrameIdx, setColorFrameIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [modelError, setModelError] = useState<string | null>(null);


  useEffect(() => {
    loadFaceModels()
      .then(() => { setModelReady(true); setModelError(null); })
      .catch(() => setModelError("โหลดระบบตรวจจับใบหน้าไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่"));
  }, []);

  // helper: ครอบใบหน้าจาก video → dataURL (พร้อม padding) + คำนวณ metrics
  const captureSample = useCallback(
    (data: NonNullable<Awaited<ReturnType<typeof detectFaceWithLandmarks>>>, stepKey: StepKey): CapturedSample => {
      const v = videoRef.current!;
      const vw = v.videoWidth, vh = v.videoHeight;
      const { box, landmarks, ear, yaw, pitch, descriptor } = data;

      // padding 25% รอบใบหน้า เพื่อให้เห็นทรงผม/คาง
      const pad = 0.25;
      const sx = Math.max(0, box.x - box.width * pad);
      const sy = Math.max(0, box.y - box.height * pad);
      const sw = Math.min(vw - sx, box.width * (1 + pad * 2));
      const sh = Math.min(vh - sy, box.height * (1 + pad * 2));

      const c = document.createElement("canvas");
      const targetW = 200;
      c.width = targetW;
      c.height = Math.round((sh / sw) * targetW);
      const ctx = c.getContext("2d");
      if (ctx) {
        // mirror ให้เหมือนที่ผู้ใช้เห็นบนหน้าจอ (selfie)
        if (facingMode === "user") {
          ctx.translate(c.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      }
      const image = c.toDataURL("image/jpeg", 0.82);

      // คำนวณตำแหน่ง/ขนาดจมูก (landmarks 27-35)
      const nose = landmarks.getNose();
      let nxMin = Infinity, nxMax = -Infinity, nyMin = Infinity, nyMax = -Infinity;
      for (const p of nose) {
        if (p.x < nxMin) nxMin = p.x;
        if (p.x > nxMax) nxMax = p.x;
        if (p.y < nyMin) nyMin = p.y;
        if (p.y > nyMax) nyMax = p.y;
      }
      const tip = nose[6] ?? nose[nose.length - 1]; // ปลายจมูก

      return {
        descriptor,
        image,
        metrics: {
          stepKey,
          faceWidthPx: Math.round(box.width),
          faceHeightPx: Math.round(box.height),
          faceFrac: +(box.width / vw).toFixed(3),
          sharpness: Math.round(estimateFaceSharpness(v, box)),
          yaw: +yaw.toFixed(3),
          pitch: +pitch.toFixed(3),
          ear: +ear.toFixed(3),
          noseTipX: +((tip.x - box.x) / box.width).toFixed(3),
          noseTipY: +((tip.y - box.y) / box.height).toFixed(3),
          noseWidthFrac: +((nxMax - nxMin) / box.width).toFixed(3),
          noseHeightFrac: +((nyMax - nyMin) / box.height).toFixed(3),
        },
      };
    },
    [facingMode],
  );

  // วาด overlay การจับใบหน้า: กรอบมุม + จุด landmark 68 จุด + เส้นโครงหน้า
  // สีบอกสถานะ: เขียว = พร้อมบันทึก, เหลือง = ต้องปรับท่า, แดง = ยังใช้ไม่ได้
  const drawOverlay = useCallback(
    (
      data: Awaited<ReturnType<typeof detectFaceWithLandmarks>> | null,
      state: "good" | "warn" | "bad" = "warn",
    ) => {
      const v = videoRef.current;
      const cv = overlayRef.current;
      if (!v || !cv) return;
      const vw = v.videoWidth, vh = v.videoHeight;
      if (!vw || !vh) return;
      if (cv.width !== vw || cv.height !== vh) {
        cv.width = vw;
        cv.height = vh;
      }
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, vw, vh);
      if (!data) return;

      const color =
        state === "good" ? "rgba(16, 185, 129, 0.95)"
        : state === "bad" ? "rgba(244, 63, 94, 0.95)"
        : "rgba(250, 204, 21, 0.95)";
      const unit = Math.max(1, vw / 480);
      const { x, y, width: w, height: h } = data.box;

      // กรอบมุม 4 มุม (แบบกล้องโฟกัส)
      const c = Math.min(w, h) * 0.22;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * unit;
      ctx.lineCap = "round";
      const corners: Array<[number, number, number, number, number, number]> = [
        [x, y + c, x, y, x + c, y],
        [x + w - c, y, x + w, y, x + w, y + c],
        [x + w, y + h - c, x + w, y + h, x + w - c, y + h],
        [x + c, y + h, x, y + h, x, y + h - c],
      ];
      for (const [ax, ay, bx, by, cx2, cy2] of corners) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx2, cy2);
        ctx.stroke();
      }

      // กรอบบางๆ รอบใบหน้า
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.2 * unit;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();

      // เส้นโครงหน้าจาก landmarks
      const lm = data.landmarks;
      const strokePath = (pts: { x: number; y: number }[], close: boolean) => {
        if (!pts.length) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (close) ctx.closePath();
        ctx.stroke();
      };
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.4 * unit;
      ctx.strokeStyle = color;
      strokePath(lm.getJawOutline(), false);
      strokePath(lm.getLeftEye(), true);
      strokePath(lm.getRightEye(), true);
      strokePath(lm.getLeftEyeBrow(), false);
      strokePath(lm.getRightEyeBrow(), false);
      strokePath(lm.getNose(), false);
      strokePath(lm.getMouth(), true);
      ctx.restore();

      // จุด landmark ทั้งหมด
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const p of lm.positions) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.3 * unit, 0, Math.PI * 2);
        ctx.fill();
      }

      // จุดปลายจมูก (จุดอ้างอิงการหันหน้า)
      const nose = lm.getNose();
      const tip = nose[6] ?? nose[nose.length - 1];
      ctx.fillStyle = "rgba(244, 63, 94, 0.95)";
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3 * unit, 0, Math.PI * 2);
      ctx.fill();
    },
    [],
  );


  useEffect(() => {
    if (!open) return;
    // resolve student
    setStepIdx(0); setSamples([]); setColorFrameIdx(0); setStatusMsg(""); setBlockedMsg(null);
    detectMetaRef.current = { misses: 0, stableHits: 0 };
    mouthStateRef.current = { opened: false, openFrames: 0, baseline: 0, samples: [], maxMar: 0 };
    (async () => {
      const { data: s } = await supabase
        .from("students").select("id").eq("student_code", studentCode).maybeSingle();
      if (!s) { toast.error("ไม่พบนักเรียน"); onOpenChange(false); return; }
      setStudentId(s.id);
    })();
    return () => { stopCamera(); if (loopRef.current) { clearTimeout(loopRef.current); loopRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentCode]);


  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, stream);
        setStreaming(true);
        try { applyCameraAutoTune(stream); } catch { /* บางอุปกรณ์ไม่รองรับ camera constraints เพิ่มเติม */ }
      }
    } catch (e: unknown) {
      const denied = errorName(e) === "NotAllowedError" || errorName(e) === "PermissionDeniedError";
      toast.error(denied
        ? "ยังไม่ได้อนุญาตใช้กล้อง กรุณากดอนุญาตกล้องในเบราว์เซอร์แล้วลองใหม่"
        : "เปิดกล้องไม่สำเร็จ: " + errorMessage(e));
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
    // wait next tick then start
    setTimeout(() => startCamera(next), 150);
  };

  // detection loop — throttled (~7 fps) so the video element keeps painting smoothly
  const runStep = useCallback(async () => {
    const next = () => {
      loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
    };
    if (busyRef.current) { next(); return; }
    if (!videoRef.current || !modelReady || !streaming) { next(); return; }
    if (videoRef.current.readyState < 2 || !videoRef.current.videoWidth) {
      setStatusMsg("กำลังเปิดภาพจากกล้อง...");
      next();
      return;
    }
    busyRef.current = true;
    const step = STEPS[stepIdx];
    let data: Awaited<ReturnType<typeof detectFaceWithLandmarks>> | null = null;
    try {
      data = await detectFaceWithLandmarks(videoRef.current);
    } catch {
      data = null;
    } finally {
      busyRef.current = false;
    }


    if (!data) {
      detectMetaRef.current.misses += 1;
      detectMetaRef.current.stableHits = 0;
      drawOverlay(null);
      setStatusMsg(
        detectMetaRef.current.misses > 12
          ? "ยังไม่เจอใบหน้า — ขยับเข้าใกล้กล้อง, เพิ่มแสง และหันหน้าตรง"
          : "ไม่พบใบหน้า — กรุณาขยับเข้าหากล้อง",
      );
      loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
      return;
    }

    detectMetaRef.current.misses = 0;
    drawOverlay(data);

    const { ear, yaw, box } = data;
    const vw = videoRef.current.videoWidth;
    const faceFrac = box.width / vw;
    const sharpness = estimateFaceSharpness(videoRef.current, box);

    if (faceFrac < 0.06) {
      detectMetaRef.current.stableHits = 0;
      setStatusMsg("ใบหน้าเล็กเกินไป — กรุณาเข้าใกล้กล้องอีกนิด");
      loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
      return;
    }

    if (sharpness < 10) {
      detectMetaRef.current.stableHits = 0;
      setStatusMsg("ภาพยังเบลอ — อยู่นิ่งๆ หรือเช็ดกล้องก่อน");
      loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
      return;
    }

    switch (step.key) {
      case "center": {
        if (faceFrac < 0.10) { detectMetaRef.current.stableHits = 0; setStatusMsg("เข้าใกล้กล้องอีกหน่อย"); break; }
        if (faceFrac > 0.65) { setStatusMsg("ถอยห่างเล็กน้อย"); break; }
        if (Math.abs(yaw) > 0.25) { detectMetaRef.current.stableHits = 0; setStatusMsg("หันหน้าตรงกล้อง"); break; }

        detectMetaRef.current.stableHits += 1;
        if (detectMetaRef.current.stableHits < 2) {
          setStatusMsg("ตรงแล้ว — อยู่นิ่งอีกนิด");
          break;
        }
        setStatusMsg("ตรงแล้ว! กำลังบันทึก...");
        detectMetaRef.current.stableHits = 0;
        setSamples((s) => [...s, captureSample(data!, "center")]);
        setStepIdx((i) => i + 1);
        break;
      }
      case "mouth": {
        const st = mouthStateRef.current;
        // คำนวณ MAR (Mouth Aspect Ratio) จาก landmarks ปาก (48..67)
        // mouth[0]=48 มุมปากซ้าย, mouth[6]=54 มุมปากขวา
        // mouth[14]=62, mouth[18]=66 → inner lip กลางบน/ล่าง
        const mouth = data.landmarks.getMouth();
        const left = mouth[0], right = mouth[6];
        const topInner = mouth[14] ?? mouth[3];
        const botInner = mouth[18] ?? mouth[9];
        const horiz = Math.hypot(right.x - left.x, right.y - left.y) || 1;
        const vert = Math.hypot(topInner.x - botInner.x, topInner.y - botInner.y);
        const mar = vert / horiz;
        if (mar > st.maxMar) st.maxMar = mar;

        // calibrate baseline ปากปิดในช่วงแรก
        if (st.baseline === 0) {
          st.samples.push(mar);
          if (st.samples.length < 6) {
            setStatusMsg(`กำลังปรับค่ากล้อง... (${st.samples.length}/6) ปิดปากปกติ`);
            break;
          }
          const sorted = [...st.samples].sort((a, b) => a - b);
          const low = sorted.slice(0, Math.ceil(sorted.length * 0.6));
          st.baseline = low.reduce((s, v) => s + v, 0) / low.length;
        }

        // ปรับตามสัดส่วนปากของแต่ละคน เพื่อรองรับกล้องมือถือและรูปหน้าที่หลากหลาย
        const openThr = Math.max(0.22, st.baseline * 1.55, st.baseline + 0.08);
        const openPct = Math.max(0, Math.min(100, Math.round(((mar - st.baseline) / Math.max(0.12, openThr - st.baseline)) * 100)));

        if (mar > openThr) {
          st.openFrames += 1;
          setStatusMsg(`อ้าปากดีแล้ว — ค้างไว้... (${st.openFrames}/3)`);
          if (st.openFrames >= 3) {
            setSamples((s) => [...s, captureSample(data!, "mouth")]);
            setStepIdx((i) => i + 1);
          }
        } else {
          st.openFrames = 0;
          setStatusMsg(`อ้าปากกว้างๆ ค้างไว้ (เปิดอยู่ ${openPct}% ต้องการ ≥ 60%)`);
        }
        break;
      }

      case "left": {
        if (yaw > 0.18) {
          detectMetaRef.current.stableHits += 1;
          if (detectMetaRef.current.stableHits < 2) {
            setStatusMsg("ดีแล้ว — ค้างไว้อีกนิด");
            break;
          }
          setStatusMsg("ดีมาก!");
          detectMetaRef.current.stableHits = 0;
          setSamples((s) => [...s, captureSample(data!, "left")]);
          setStepIdx((i) => i + 1);
        } else {
          detectMetaRef.current.stableHits = 0;
          setStatusMsg(`หันซ้ายอีก (${Math.round(Math.max(0, yaw) * 100)}%)`);
        }
        break;
      }
      case "right": {
        if (yaw < -0.18) {
          detectMetaRef.current.stableHits += 1;
          if (detectMetaRef.current.stableHits < 2) {
            setStatusMsg("ดีแล้ว — ค้างไว้อีกนิด");
            break;
          }
          setStatusMsg("ดีมาก!");
          detectMetaRef.current.stableHits = 0;
          setSamples((s) => [...s, captureSample(data!, "right")]);
          setStepIdx((i) => i + 1);
        } else {
          detectMetaRef.current.stableHits = 0;
          setStatusMsg(`หันขวาอีก (${Math.round(Math.max(0, -yaw) * 100)}%)`);
        }
        break;
      }
      case "color": {
        if (Math.abs(yaw) < 0.20) {
          setSamples((s) => {
            if (s.length >= 4 + colorFrameIdx + 1) return s;
            return [...s, captureSample(data!, "color")];
          });
        }
        setStatusMsg(`Color ${colorFrameIdx + 1}/${CHALLENGE_COLORS.length} — มองที่กล้อง`);
        break;
      }
    }
    loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
  }, [stepIdx, modelReady, streaming, colorFrameIdx, captureSample, drawOverlay]);


  useEffect(() => {
    if (!streaming || !modelReady) return;
    if (STEPS[stepIdx].key === "done") return;
    loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [streaming, modelReady, stepIdx, runStep]);

  // Color challenge orchestration
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
        }, 800);
        clearInterval(t);
      }
    };
    tick();
    const t = setInterval(tick, 1200);
    return () => { clearInterval(t); if (flashRef.current) flashRef.current.style.background = "transparent"; };
  }, [stepIdx]);

  // Save when reaching "done"
  useEffect(() => {
    if (STEPS[stepIdx].key !== "done" || !studentId || saving) return;
    if (samples.length === 0) return;
    (async () => {
      const __tid_save_1 = toast.loading(submitMode === "request" ? "กำลังตรวจสอบและส่งคำขอ..." : "กำลังตรวจสอบและบันทึก...");
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("กรุณาเข้าสู่ระบบ");

        // ---- 1) ตรวจสอบว่าทุกตัวอย่างเป็น "คนเดียวกัน" (กันสลับหน้าระหว่างขั้นตอน) ----
        let maxSelf = 0;
        for (let i = 0; i < samples.length; i++) {
          for (let j = i + 1; j < samples.length; j++) {
            const d = euclidean(samples[i].descriptor, samples[j].descriptor);
            if (d > maxSelf) maxSelf = d;
          }
        }
        if (maxSelf > SELF_CONSISTENCY_MAX) {
          setBlockedMsg(
            `ตรวจพบใบหน้าไม่ตรงกันระหว่างขั้นตอน (ค่าต่าง ${maxSelf.toFixed(2)}) — กรุณาลงทะเบียนใหม่โดยให้เป็นคนเดียวกันตลอด`,
          );
          throw new Error("ตรวจพบใบหน้ามากกว่า 1 คนระหว่างการลงทะเบียน");
        }

        // ---- 2) ตรวจสอบใบหน้าซ้ำกับนักเรียนคนอื่นในระบบ (กันจำผิดคน) ----
        const descriptorArrays = samples.map((sm) => Array.from(sm.descriptor));
        const { data: dup, error: dupErr } = await supabase.rpc("check_face_duplicate", {
          _student_id: studentId,
          _descriptors: descriptorArrays,
          _threshold: DUPLICATE_THRESHOLD,
        });
        if (dupErr) throw dupErr;
        const hit = Array.isArray(dup) ? (dup as DuplicateFaceMatch[])[0] : null;
        if (hit) {
          setBlockedMsg(
            `ใบหน้านี้ตรงกับผู้ที่ลงทะเบียนไว้แล้ว: ${hit.match_name ?? ""} (${hit.match_code ?? "-"}) ` +
            `ระยะห่าง ${Number(hit.min_distance).toFixed(3)} — ระบบไม่อนุญาตให้ลงทะเบียนซ้ำ กรุณาติดต่อเจ้าหน้าที่`,
          );
          throw new Error("ใบหน้าซ้ำกับผู้อื่นในระบบ");
        }

        if (submitMode === "request") {
          // ---- โหมดนักเรียนลงทะเบียนเอง: ส่งคำขออนุมัติ ----
          const { data: exist } = await supabase
            .from("student_face_descriptors").select("id").eq("student_id", studentId).limit(1);
          const isRereg = (exist?.length ?? 0) > 0;

          const ts = Date.now();
          const photo_urls: string[] = [];
          for (let i = 0; i < samples.length; i++) {
            const blob = dataUrlToBlob(samples[i].image);
            const path = `requests/${studentId}/${ts}_${i}_selfenroll.jpg`;
            const { error: upErr } = await supabase.storage
              .from("face-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
            if (upErr) throw upErr;
            photo_urls.push(path);
          }

          const { error } = await supabase.rpc("self_enroll_face", {
            _samples: samples.map((sm) => ({
              descriptor: Array.from(sm.descriptor),
              quality_score: sm.metrics.sharpness,
              face_image: sm.image,
              metrics: sm.metrics,
            })) as any,
            _photo_urls: photo_urls,
            _reason: reason?.trim() || null,
          });
          if (error) throw error;
          void isRereg;
          toast.success(`ลงทะเบียนใบหน้าสำเร็จ ${samples.length} ภาพ — ใช้งานได้ทันที`);
        } else {
          const { data: ex } = await supabase
            .from("student_face_descriptors")
            .select("sample_index")
            .eq("student_id", studentId)
            .order("sample_index", { ascending: false }).limit(1);
          let next = ex && ex[0] ? ex[0].sample_index + 1 : 0;
          const rows = samples.map((sm) => ({
            student_id: studentId,
            sample_index: next++,
            descriptor: Array.from(sm.descriptor),
            quality_score: sm.metrics.sharpness,
            face_image: sm.image,
            metrics: sm.metrics,
            captured_by: user?.id,
            source: "liveness_wizard",
          }));
          const { error } = await supabase.from("student_face_descriptors").insert(rows);
          if (error) throw error;
          toast.success(`ลงทะเบียนสำเร็จ ${rows.length} ตัวอย่าง (Liveness verified)`);
        }
        stopCamera();
        onComplete?.();
      } catch (e: unknown) {
        const message = errorMessage(e);
        const friendly = message.includes("row-level security") || message.includes("not authorized")
          ? "บัญชีนี้ไม่มีสิทธิ์บันทึกคำขอ กรุณาออกจากระบบแล้วเข้าสู่ระบบนักเรียนใหม่"
          : message.includes("Failed to fetch") || message.includes("NetworkError")
            ? "เชื่อมต่อระบบไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง"
            : message;
        toast.error("ลงทะเบียนไม่สำเร็จ: " + friendly, { duration: 9000 });
      } finally {
        toast.dismiss(__tid_save_1);
        setSaving(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, studentId]);


  const reset = () => {
    setStepIdx(0); setSamples([]); setColorFrameIdx(0); setBlockedMsg(null);
    detectMetaRef.current = { misses: 0, stableHits: 0 };
    mouthStateRef.current = { opened: false, openFrames: 0, baseline: 0, samples: [], maxMar: 0 };
  };


  const step = STEPS[stepIdx];
  const Icon = step.icon;
  const progress = (stepIdx / (STEPS.length - 1)) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) stopCamera(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            ลงทะเบียนใบหน้าแบบ Liveness — {displayName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1">
                <Icon className="w-3 h-3" />ขั้นที่ {stepIdx + 1}/{STEPS.length}
              </Badge>
              <span className="text-xs text-muted-foreground">{samples.length} ตัวอย่าง</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm font-semibold">{step.label}</p>
            <p className="text-xs text-muted-foreground">{step.hint}</p>
          </div>

          {/* Camera + color flash overlay */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] sm:aspect-[4/5] max-h-[70vh] mx-auto w-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
            {/* live face/nose overlay — แสดงกล่องใบหน้า + จุดจมูกที่กำลังแสกน */}
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
            <div ref={flashRef} className="absolute inset-0 mix-blend-screen opacity-60 transition-colors duration-300 pointer-events-none" />

            {/* face guide ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-[75%] aspect-[3/4] max-h-[85%] rounded-[50%] border-4 ${
                statusMsg.includes("ดีมาก") || statusMsg.includes("ตรงแล้ว")
                  ? "border-emerald-400" : "border-white/60"
              } transition-colors`} />
            </div>
            {/* switch camera button */}
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
            {/* status text */}
            {statusMsg && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full max-w-[90%] text-center">
                {statusMsg}
              </div>
            )}
            {!streaming && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button onClick={() => startCamera()} disabled={!modelReady || !!modelError} size="lg" className="gradient-primary">
                  {!modelReady ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                  {modelError ? "ระบบตรวจจับใบหน้าไม่พร้อม" : !modelReady ? "กำลังโหลดโมเดล..." : "เริ่มลงทะเบียน"}
                </Button>
              </div>
            )}
          </div>

          {modelError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {modelError}
            </div>
          )}

          {/* Captured samples — gallery (รูปใบหน้าที่ระบบบันทึกไว้ในแต่ละขั้น) */}
          {samples.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                รูปใบหน้าที่บันทึก ({samples.length})
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {samples.map((sm, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-lg overflow-hidden border bg-muted/40"
                    title={`face ${sm.metrics.faceWidthPx}×${sm.metrics.faceHeightPx}px · sharp ${sm.metrics.sharpness} · nose (${sm.metrics.noseTipX}, ${sm.metrics.noseTipY}) · yaw ${sm.metrics.yaw}`}
                  >
                    <img src={sm.image} alt={`sample-${idx + 1}`} className="w-full aspect-square object-cover" />
                    <div className="absolute top-1 left-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{sm.metrics.stepKey}</Badge>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[10px] leading-tight px-1.5 py-1 space-y-0.5">
                      <div>หน้า {sm.metrics.faceWidthPx}×{sm.metrics.faceHeightPx}px</div>
                      <div>จมูก {(sm.metrics.noseTipX * 100).toFixed(0)}%, {(sm.metrics.noseTipY * 100).toFixed(0)}% · กว้าง {(sm.metrics.noseWidthFrac * 100).toFixed(0)}%</div>
                      <div>คม {sm.metrics.sharpness} · yaw {sm.metrics.yaw}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saving / done */}
          {step.key === "done" && (
            <div className="text-center py-4 space-y-2">
              {saving ? (
                <p className="text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />กำลังตรวจสอบและบันทึก...
                </p>
              ) : blockedMsg ? (
                <div className="rounded-lg border-2 border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive font-medium">
                  {blockedMsg}
                </div>
              ) : (
                <p className="text-emerald-600 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  {submitMode === "request"
                    ? "ลงทะเบียนสำเร็จ — ใช้งานได้ทันที"
                    : "ลงทะเบียนสำเร็จ — ผ่าน Liveness Check"}
                </p>
              )}
            </div>
          )}


          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset} disabled={saving}>
              <RotateCcw className="w-4 h-4 mr-2" />เริ่มใหม่
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LivenessFaceRegisterDialog;
