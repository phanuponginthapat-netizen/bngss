import { useEffect, useRef, useState, useCallback } from "react";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ScanFace, CheckCircle2, Eye, ArrowLeft, ArrowRight, Sparkles,
  Camera, Loader2, RotateCcw, ShieldCheck, SwitchCamera,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  loadFaceModels, detectFaceWithLandmarks, applyCameraAutoTune, estimateFaceSharpness, euclidean,
} from "@/lib/faceApi";
import { loadOpenCV, isOpenCVReady, detectFacesCV, disposeOpenCV, type CVBox } from "@/lib/opencvFace";
import { openCamera, stopStream } from "@/lib/cameraStream";
import { urlToFaceTexture } from "@/lib/faceThumb";
import CameraSourcePicker from "@/components/mobile/CameraSourcePicker";
import CameraFocusLockToggle from "@/components/mobile/CameraFocusLockToggle";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** รหัสนักเรียน (โหมดนักเรียน) — ไม่ต้องส่งเมื่อใช้โหมดบุคลากร */
  studentCode?: string;
  displayName: string;
  onComplete?: () => void;
  /** "direct" = บันทึกลงฐานข้อมูลทันที (เจ้าหน้าที่) · "request" = ส่งคำขอรออนุมัติ (นักเรียนลงทะเบียนเอง) */
  submitMode?: "direct" | "request";
  /** เหตุผล (ใช้เมื่อเป็นการลงทะเบียนใหม่ในโหมดคำขอ) */
  reason?: string;
  /** โหมดบุคลากร: ส่ง id ของบุคลากร แล้วระบบจะบันทึกลง personnel_face_descriptors */
  personnelId?: string;
  /** บุคลากรลงทะเบียนใบหน้าของตนเอง (ใช้ RPC self_enroll_personnel_face) */
  selfPersonnel?: boolean;
}

/** ระยะห่าง "ค่ากลาง" สูงสุดที่ยอมรับได้ระหว่างตัวอย่างของคนเดียวกัน
 *  (ขั้นตอนหันซ้าย/ขวา/กะพริบตา ทำให้ระยะคู่ใดคู่หนึ่งกว้างได้ตามธรรมชาติ) */
const SELF_CONSISTENCY_MEDIAN_MAX = 0.62;
/** ตัวอย่างที่ค่ากลางห่างเกินนี้ถือเป็น outlier → ตัดทิ้งแทนการบล็อกทั้งชุด */
const SAMPLE_OUTLIER_MAX = 0.72;
/** ถ้าใบหน้าใกล้กับคนอื่นในระบบมากกว่านี้ = ถือว่าซ้ำคน */
const DUPLICATE_THRESHOLD = 0.36;
/** จำนวนภาพขั้นต่ำ/สูงสุดที่บันทึกจริง */
const MIN_SAMPLES = 3;
const MAX_SAMPLES = 8;
/** จำกัดจำนวนภาพต่อขั้นตอน เพื่อให้ได้มุมหลากหลาย ไม่ซ้ำท่าเดียว */
const MAX_PER_STEP = 2;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};


const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};


type StepKey = "center" | "near" | "left" | "right" | "color" | "done";

interface Step {
  key: StepKey;
  label: string;
  hint: string;
  icon: typeof Eye;
  color?: string;
}

const STEPS: Step[] = [
  { key: "center",  label: "จัดหน้าให้ตรงกรอบ",        hint: "มองตรงมาที่กล้อง จนกรอบล็อกเป็นสีเขียว", icon: ScanFace },
  { key: "near",    label: "ขยับหน้าเข้าใกล้กล้อง",       hint: "ค่อยๆ ขยับหน้าเข้าใกล้กล้องอีกนิด",   icon: Eye },
  { key: "left",    label: "หันหน้าไปทางซ้าย",          hint: "หันช้าๆ ประมาณ 30 องศา",            icon: ArrowLeft },
  { key: "right",   label: "หันหน้าไปทางขวา",           hint: "หันช้าๆ ประมาณ 30 องศา",            icon: ArrowRight },
  { key: "color",   label: "Color Challenge (กันรูปปลอม)", hint: "หน้าจอจะสลับสี ให้มองที่กล้อง",   icon: Sparkles },
  { key: "done",    label: "เสร็จสมบูรณ์",              hint: "บันทึกข้อมูลเรียบร้อย",            icon: CheckCircle2 },
];

const COLOR_POOL = ["#ef4444", "#22c55e", "#3b82f6", "#ffffff", "#f59e0b", "#a855f7"];
/** สุ่มลำดับสีใหม่ทุกครั้ง เพื่อกันการเล่นวิดีโอซ้ำหลอกระบบ */
const makeChallengeColors = () => {
  const pool = [...COLOR_POOL];
  const out: string[] = [];
  while (out.length < 4 && pool.length) out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  return out;
};

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

const LivenessFaceRegisterDialog = ({ open, onOpenChange, studentCode, displayName, onComplete, submitMode = "direct", reason, personnelId, selfPersonnel }: Props) => {
  const isPersonnel = !!personnelId;
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const detectMetaRef = useRef({ misses: 0, stableHits: 0 });

  // สถานะการจับ "กะพริบตา" (ตรวจม่านตา/เปลือกตาด้วย EAR)
  const blinkStateRef = useRef<{
    baseline: number;       // EAR ตอนลืมตาปกติ (calibrate ต่อคน)
    samples: number[];      // สำหรับคำนวณ baseline
    closed: boolean;        // ตาปิดอยู่หรือไม่
    closedFrames: number;   // จำนวนเฟรมที่ตาปิดต่อเนื่อง
    blinks: number;         // จำนวนครั้งที่กะพริบสำเร็จ
  }>({ baseline: 0, samples: [], closed: false, closedFrames: 0, blinks: 0, startedAt: 0, baseFrac: 0, maxFrac: 0 } as any);

  const [challengeColors, setChallengeColors] = useState<string[]>(makeChallengeColors);

  const [studentId, setStudentId] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [samples, setSamples] = useState<CapturedSample[]>([]);
  const [colorFrameIdx, setColorFrameIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [camDeviceId, setCamDeviceId] = useState<string | undefined>(undefined);
  const [camTick, setCamTick] = useState(0);

  const [modelError, setModelError] = useState<string | null>(null);


  useEffect(() => {
    loadFaceModels()
      .then(() => { setModelReady(true); setModelError(null); })
      .catch(() => setModelError("โหลดระบบตรวจจับใบหน้าไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่"));
    // โหลด OpenCV.js แบบเบื้องหลัง (ใช้ช่วยหาใบหน้าเมื่อ face-api ตรวจไม่เจอ)
    loadOpenCV();
    return () => { disposeOpenCV(); };
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

  // วาด overlay การจับใบหน้า: วงรีไกด์ระยะ + กรอบล็อกเมื่อได้ระยะ + landmark 68 จุด + ม่านตา
  // สีบอกสถานะ: เขียว = ได้ระยะ/พร้อมบันทึก, เหลือง = ต้องปรับท่า, แดง = ยังใช้ไม่ได้
  const drawOverlay = useCallback(
    (
      data: Awaited<ReturnType<typeof detectFaceWithLandmarks>> | null,
      state: "good" | "warn" | "bad" = "warn",
      cvBoxes?: CVBox[],
    ) => {
      const v = videoRef.current;
      const cv = overlayRef.current;
      if (!v || !cv) return;
      const vw = v.videoWidth, vh = v.videoHeight;
      if (!vw || !vh) return;
      // ขนาดจริงบนหน้าจอ (วิดีโอใช้ object-cover → ต้อง map พิกัดให้ตรงกับส่วนที่มองเห็น)
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cwCss = cv.clientWidth || vw;
      const chCss = cv.clientHeight || vh;
      const cw = Math.round(cwCss * dpr);
      const ch = Math.round(chCss * dpr);
      if (cv.width !== cw || cv.height !== ch) {
        cv.width = cw;
        cv.height = ch;
      }
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const locked = state === "good";
      const unitG = Math.max(1, cw / 480);

      // ---- วงรีไกด์ระยะ (อยู่กลางจอเสมอ, พิกัดหน้าจอ) ----
      const gcx = cw / 2, gcy = ch * 0.46;
      const grx = Math.min(cw, ch) * 0.30, gry = Math.min(grx * 1.32, ch * 0.42);
      ctx.save();
      ctx.setLineDash(locked ? [] : [10 * unitG, 8 * unitG]);
      ctx.lineWidth = (locked ? 3 : 2) * unitG;
      ctx.strokeStyle = locked ? "rgba(16,185,129,0.9)" : "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(gcx, gcy, grx, gry, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (locked) {
        ctx.shadowColor = "rgba(16,185,129,0.8)";
        ctx.shadowBlur = 18 * unitG;
        ctx.stroke();
      }
      ctx.restore();

      // ตั้ง transform แบบ object-cover: ทุกอย่างหลังจากนี้วาดด้วย "พิกัดวิดีโอ" ได้ตรงตำแหน่ง
      const coverScale = Math.max(cw / vw, ch / vh);
      ctx.setTransform(
        coverScale, 0, 0, coverScale,
        (cw - vw * coverScale) / 2,
        (ch - vh * coverScale) / 2,
      );


      // ---- กรอบสไตล์ OpenCV (Haar cascade) ----
      if (cvBoxes?.length) {
        ctx.save();
        ctx.lineWidth = 2 * unitG;
        ctx.font = `${11 * unitG}px monospace`;
        cvBoxes.forEach((b, i) => {
          const main = i === 0;
          ctx.strokeStyle = main ? "rgba(34,197,94,0.95)" : "rgba(148,163,184,0.8)";
          ctx.strokeRect(b.x, b.y, b.width, b.height);
          const label = `face ${Math.round(b.width)}x${Math.round(b.height)}`;
          const tw = ctx.measureText(label).width + 8 * unitG;
          ctx.fillStyle = main ? "rgba(34,197,94,0.95)" : "rgba(148,163,184,0.85)";
          ctx.fillRect(b.x, Math.max(0, b.y - 15 * unitG), tw, 15 * unitG);
          ctx.fillStyle = "rgba(0,0,0,0.9)";
          ctx.fillText(label, b.x + 4 * unitG, Math.max(11 * unitG, b.y - 4 * unitG));
        });
        ctx.restore();
      }

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

      // ---- ม่านตา (iris tracking): วงกลมกลางตา + จุดกึ่งกลาง ----
      const drawIris = (pts: { x: number; y: number }[]) => {
        if (!pts.length) return;
        const cxE = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cyE = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const wE = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
        const hE = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
        const r = Math.max(2 * unit, Math.min(wE * 0.28, Math.max(hE * 0.62, 2 * unit)));
        ctx.save();
        ctx.strokeStyle = "rgba(56,189,248,0.95)";
        ctx.lineWidth = 1.6 * unit;
        ctx.beginPath();
        ctx.arc(cxE, cyE, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(56,189,248,0.9)";
        ctx.beginPath();
        ctx.arc(cxE, cyE, 1.6 * unit, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      drawIris(lm.getLeftEye());
      drawIris(lm.getRightEye());

      // ป้าย LOCKED เมื่อได้ระยะแล้ว
      if (state === "good") {
        ctx.save();
        ctx.fillStyle = "rgba(16,185,129,0.92)";
        ctx.font = `${12 * unit}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("● LOCKED", x + w / 2, Math.max(14 * unit, y - 8 * unit));
        ctx.restore();
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
    setSaveError(null); setSavedOk(false);
    detectMetaRef.current = { misses: 0, stableHits: 0 };
    blinkStateRef.current = { baseline: 0, samples: [], closed: false, closedFrames: 0, blinks: 0, startedAt: 0, baseFrac: 0, maxFrac: 0 } as any;
    (async () => {
      if (personnelId) { setStudentId(personnelId); return; }
      const { data: s } = await supabase
        .from("students").select("id").eq("student_code", studentCode || "").maybeSingle();
      if (!s) { toast.error("ไม่พบนักเรียน"); onOpenChange(false); return; }
      setStudentId(s.id);
    })();
    return () => { stopCamera(); if (loopRef.current) { clearTimeout(loopRef.current); loopRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentCode, personnelId]);


  const startCamera = async (mode: "user" | "environment" = facingMode, deviceId?: string) => {
    try {
      const res = await openCamera({
        facing: mode,
        deviceId: deviceId ?? camDeviceId,
        width: 1280,
        height: 720,
      });
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, res.stream);
        setStreaming(true);
        setCamDeviceId(res.deviceId);
        setCamTick((t) => t + 1);
        try { applyCameraAutoTune(res.stream); } catch { /* บางอุปกรณ์ไม่รองรับ camera constraints เพิ่มเติม */ }
      } else {
        stopStream(res.stream);
      }
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "เปิดกล้องไม่สำเร็จ");
    }
  };

  const stopCamera = () => {
    stopStream(videoRef.current?.srcObject as MediaStream | null, videoRef.current);
    setStreaming(false);
  };

  const switchCamera = async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    stopCamera();
    // wait next tick then start
    setTimeout(() => startCamera(next, undefined), 150);
  };

  const pickCamera = async (deviceId: string) => {
    setCamDeviceId(deviceId);
    stopCamera();
    setTimeout(() => startCamera(facingMode, deviceId), 150);
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
      // ── fallback: ใช้ OpenCV Haar cascade ช่วยหาใบหน้า เพื่อบอกผู้ใช้ว่ากล้อง "เห็น" แล้ว ──
      let cvBoxes: CVBox[] = [];
      if (isOpenCVReady()) {
        try { cvBoxes = detectFacesCV(videoRef.current); } catch { cvBoxes = []; }
      }
      drawOverlay(null, "warn", cvBoxes);
      setStatusMsg(
        cvBoxes.length
          ? "เจอใบหน้าแล้ว (OpenCV) — จัดหน้าให้อยู่ในวงรีและเพิ่มแสงอีกนิด"
          : detectMetaRef.current.misses > 12
            ? "ยังไม่เจอใบหน้า — ขยับเข้าใกล้กล้อง, เพิ่มแสง และหันหน้าตรง"
            : "ไม่พบใบหน้า — กรุณาขยับเข้าหากล้อง",
      );
      loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
      return;
    }


    detectMetaRef.current.misses = 0;

    const { ear, yaw, box } = data;
    const vw = videoRef.current.videoWidth;
    const faceFrac = box.width / vw;
    const sharpness = estimateFaceSharpness(videoRef.current, box);

    if (faceFrac < 0.06) {
      detectMetaRef.current.stableHits = 0;
      drawOverlay(data, "bad");
      setStatusMsg("ใบหน้าเล็กเกินไป — กรุณาเข้าใกล้กล้องอีกนิด");
      loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
      return;
    }

    if (sharpness < 10) {
      detectMetaRef.current.stableHits = 0;
      drawOverlay(data, "bad");
      setStatusMsg("ภาพยังเบลอ — อยู่นิ่งๆ หรือเช็ดกล้องก่อน");
      loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
      return;
    }

    // เขียวเมื่อคุณภาพผ่านเกณฑ์และหน้าตรงพอ, เหลืองเมื่อยังต้องปรับท่า
    drawOverlay(data, faceFrac >= 0.10 && Math.abs(yaw) <= 0.25 ? "good" : "warn");


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
      case "near": {
        // ตรวจ liveness แบบ "ขยับหน้าเข้าใกล้กล้อง" (ทำง่ายกว่าการกะพริบตา)
        const st = blinkStateRef.current as any;
        if (!st.startedAt) st.startedAt = Date.now();
        const elapsed = Date.now() - st.startedAt;

        // จับขนาดใบหน้าเริ่มต้น (baseline) จาก 3 เฟรมแรก
        if (!st.baseFrac) {
          st.samples.push(faceFrac);
          if (st.samples.length < 3) {
            setStatusMsg(`กำลังวัดระยะ... (${st.samples.length}/3) อยู่นิ่งๆ`);
            break;
          }
          st.baseFrac = st.samples.reduce((a: number, b: number) => a + b, 0) / st.samples.length;
          st.maxFrac = st.baseFrac;
        }
        st.maxFrac = Math.max(st.maxFrac || 0, faceFrac);

        const grow = faceFrac / st.baseFrac;
        if (grow >= 1.15 || faceFrac > 0.5) {
          setSamples((s) => [...s, captureSample(data!, "near")]);
          setStatusMsg("ตรวจการเคลื่อนไหวผ่าน!");
          setStepIdx((i) => i + 1);
          break;
        }

        // กันค้าง: ถ้าขยับได้บ้างแล้วและเวลาเกิน 8 วิ ให้ผ่าน
        if (elapsed > 8000 && (st.maxFrac || 0) / st.baseFrac >= 1.06) {
          setSamples((s) => [...s, captureSample(data!, "near")]);
          setStatusMsg("ตรวจการเคลื่อนไหวผ่าน!");
          setStepIdx((i) => i + 1);
          break;
        }

        setStatusMsg(
          `ขยับหน้าเข้าใกล้กล้องอีกนิด (${Math.round(Math.min(100, ((grow - 1) / 0.15) * 100))}%)`,
        );
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
        setStatusMsg(`สลับสี ${colorFrameIdx + 1}/${challengeColors.length} — มองที่กล้อง`);
        break;
      }
    }
    loopRef.current = window.setTimeout(runStep, step.key === "near" ? 100 : 140) as unknown as number;
  }, [stepIdx, modelReady, streaming, colorFrameIdx, challengeColors.length, captureSample, drawOverlay]);


  useEffect(() => {
    if (!streaming || !modelReady) return;
    if (STEPS[stepIdx].key === "done") return;
    loopRef.current = window.setTimeout(runStep, 140) as unknown as number;
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [streaming, modelReady, stepIdx, runStep]);

  // Color challenge orchestration — สุ่มลำดับสีใหม่ทุกครั้งที่เข้าขั้นตอนนี้
  useEffect(() => {
    if (STEPS[stepIdx].key !== "color") return;
    const colors = makeChallengeColors();
    setChallengeColors(colors);
    setColorFrameIdx(0);
    let i = 0;
    const tick = () => {
      const el = flashRef.current;
      if (el) el.style.background = colors[i];
      i++;
      setColorFrameIdx(i);
      if (i >= colors.length) {
        setTimeout(() => {
          if (el) el.style.background = "transparent";
          setStepIdx((idx) => idx + 1);
        }, 800);
        clearInterval(t);
      }
    };
    tick();
    const t = setInterval(tick, 1100);
    return () => { clearInterval(t); if (flashRef.current) flashRef.current.style.background = "transparent"; };
  }, [stepIdx]);

  // Save when reaching "done"
  useEffect(() => {
    if (STEPS[stepIdx].key !== "done" || !studentId || saving) return;
    if (samples.length === 0) return;
    if (savedOk || blockedMsg || saveError) return;
    (async () => {
      const __tid_save_1 = toast.loading(submitMode === "request" ? "กำลังตรวจสอบและส่งคำขอ..." : "กำลังตรวจสอบและบันทึก...");
      setSaving(true);
      setSaveError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("กรุณาเข้าสู่ระบบ");

        if (samples.length < MIN_SAMPLES) {
          throw new Error(`เก็บภาพใบหน้าได้เพียง ${samples.length} ภาพ (ต้องการอย่างน้อย ${MIN_SAMPLES}) — กรุณากด "เริ่มใหม่"`);
        }

        // ---- 1) ตรวจสอบว่าตัวอย่างเป็น "คนเดียวกัน" โดยใช้ค่ากลาง + ตัด outlier ----
        const medians = samples.map((sa, i) =>
          median(samples.filter((_, j) => j !== i).map((sb) => euclidean(sa.descriptor, sb.descriptor))),
        );
        let usable = samples.filter((_, i) => medians[i] <= SAMPLE_OUTLIER_MAX);
        if (usable.length < 2) usable = samples;
        const usableMedians = usable.map((sa, i) =>
          median(usable.filter((_, j) => j !== i).map((sb) => euclidean(sa.descriptor, sb.descriptor))),
        );
        const overall = median(usableMedians);
        if (samples.length >= 3 && overall > SELF_CONSISTENCY_MEDIAN_MAX) {
          setBlockedMsg(
            `ตรวจพบใบหน้าไม่ตรงกันระหว่างขั้นตอน (ค่าต่าง ${overall.toFixed(2)}) — กรุณาลงทะเบียนใหม่โดยให้เป็นคนเดียวกันตลอด`,
          );
          throw new Error("ตรวจพบใบหน้ามากกว่า 1 คนระหว่างการลงทะเบียน");
        }

        // ---- 1.1) เลือกเฉพาะภาพคุณภาพดีที่สุด ไม่เกินเพดาน (กันข้อมูลบวม) ----
        const seenSteps = new Map<StepKey, number>();
        const picked = [...usable]
          .sort((a, b) => b.metrics.sharpness - a.metrics.sharpness)
          .filter((sm) => {
            const n = seenSteps.get(sm.metrics.stepKey) ?? 0;
            if (n >= MAX_PER_STEP) return false;
            seenSteps.set(sm.metrics.stepKey, n + 1);
            return true;
          })
          .slice(0, MAX_SAMPLES);
        const finalSamples = picked.length >= MIN_SAMPLES ? picked : usable.slice(0, MAX_SAMPLES);

        // ---- 2) ตรวจสอบใบหน้าซ้ำกับผู้อื่นในระบบ (กันจำผิดคน) ----
        const descriptorArrays = finalSamples.map((sm) => Array.from(sm.descriptor));

        if (!isPersonnel) {
          const { data: dup, error: dupErr } = await supabase.rpc("check_face_duplicate", {
            _student_id: studentId,
            _descriptors: descriptorArrays,
            _threshold: DUPLICATE_THRESHOLD,
          });
          // ตรวจซ้ำไม่สำเร็จ (สิทธิ์/ฟังก์ชันยังไม่พร้อม) ไม่ควรทำให้ลงทะเบียนล้มเหลว
          if (dupErr) console.warn("check_face_duplicate skipped:", dupErr);
          const hit = Array.isArray(dup) ? (dup as DuplicateFaceMatch[])[0] : null;
          if (hit) {
            setBlockedMsg(
              `ใบหน้านี้ตรงกับผู้ที่ลงทะเบียนไว้แล้ว: ${hit.match_name ?? ""} (${hit.match_code ?? "-"}) ` +
              `ระยะห่าง ${Number(hit.min_distance).toFixed(3)} — ระบบไม่อนุญาตให้ลงทะเบียนซ้ำ กรุณาติดต่อเจ้าหน้าที่`,
            );
            throw new Error("ใบหน้าซ้ำกับผู้อื่นในระบบ");
          }
        }

        // texture (LBP) ของแต่ละตัวอย่าง — ใช้ยืนยันพื้นผิวใบหน้าตอนสแกน
        const textures = await Promise.all(finalSamples.map((sm) => urlToFaceTexture(sm.image)));

        if (isPersonnel) {
          const payload = finalSamples.map((sm, i) => ({
            descriptor: Array.from(sm.descriptor),
            quality_score: sm.metrics.sharpness,
            face_image: sm.image,
            texture: textures[i],
            metrics: sm.metrics,
          }));
          if (selfPersonnel) {
            // ---- บุคลากรลงทะเบียนใบหน้าของตนเอง (ผ่าน RPC, ไม่ต้องมีสิทธิ์เจ้าหน้าที่) ----
            const { error } = await (supabase as any).rpc("self_enroll_personnel_face", { _samples: payload });
            if (error) throw error;
          } else {
            // ---- โหมดบุคลากร (เจ้าหน้าที่บันทึกให้): บันทึกลง personnel_face_descriptors ทันที ----
            const { data: ex } = await (supabase as any)
              .from("personnel_face_descriptors")
              .select("sample_index")
              .eq("personnel_id", personnelId)
              .order("sample_index", { ascending: false }).limit(1);
            let nextP = ex && ex[0] ? ex[0].sample_index + 1 : 0;
            const rowsP = payload.map((p) => ({
              personnel_id: personnelId,
              sample_index: nextP++,
              ...p,
              captured_by: user?.id,
              source: "liveness_wizard",
            }));
            const { error } = await (supabase as any).from("personnel_face_descriptors").insert(rowsP);
            if (error) throw error;
          }
          toast.success(`ลงทะเบียนใบหน้าบุคลากรสำเร็จ ${finalSamples.length} ภาพ`);
        } else if (submitMode === "request") {
          // ---- โหมดนักเรียนลงทะเบียนเอง: บันทึกและใช้งานได้ทันที ----
          const ts = Date.now();
          const photo_urls: string[] = [];
          for (let i = 0; i < finalSamples.length; i++) {
            try {
              const blob = dataUrlToBlob(finalSamples[i].image);
              const path = `requests/${studentId}/${ts}_${i}_selfenroll.jpg`;
              const { error: upErr } = await supabase.storage
                .from("face-photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
              if (upErr) throw upErr;
              photo_urls.push(path);
            } catch (upe) {
              // อัปโหลดรูปไม่สำเร็จไม่ควรทำให้การลงทะเบียนล้มเหลว (ภาพถูกเก็บใน descriptor อยู่แล้ว)
              console.warn("face photo upload skipped:", upe);
            }
          }


          const { error } = await supabase.rpc("self_enroll_face", {
            _samples: finalSamples.map((sm, i) => ({
              descriptor: Array.from(sm.descriptor),
              quality_score: sm.metrics.sharpness,
              face_image: sm.image,
              texture: textures[i],
              metrics: sm.metrics,
            })) as any,
            _photo_urls: photo_urls,
            _reason: reason?.trim() || null,
          });
          if (error) {
            const code = (error as any)?.code;
            if (code === "PGRST202" || code === "42883") {
              throw new Error("ระบบลงทะเบียนใบหน้ายังไม่พร้อมบนเซิร์ฟเวอร์ (ฟังก์ชัน self_enroll_face ไม่พบ) กรุณาแจ้งผู้ดูแลระบบ");
            }
            if (code === "42501") {
              throw new Error("บัญชีนี้ยังไม่มีสิทธิ์บันทึกใบหน้า กรุณาแจ้งผู้ดูแลระบบให้เปิดสิทธิ์ลงทะเบียนใบหน้า");
            }
            throw error;
          }
          toast.success(`ลงทะเบียนใบหน้าสำเร็จ ${finalSamples.length} ภาพ — ใช้งานได้ทันที`);
        } else {
          const { data: ex } = await supabase
            .from("student_face_descriptors")
            .select("sample_index")
            .eq("student_id", studentId)
            .order("sample_index", { ascending: false }).limit(1);
          let next = ex && ex[0] ? ex[0].sample_index + 1 : 0;
          const rows = finalSamples.map((sm, i) => ({
            student_id: studentId,
            sample_index: next++,
            descriptor: Array.from(sm.descriptor),
            quality_score: sm.metrics.sharpness,
            face_image: sm.image,
            texture: textures[i],
            metrics: sm.metrics,
            captured_by: user?.id,
            source: "liveness_wizard",
          }));
          const { error } = await supabase.from("student_face_descriptors").insert(rows);
          if (error) throw error;
          toast.success(`ลงทะเบียนสำเร็จ ${rows.length} ตัวอย่าง (Liveness verified)`);
        }
        setSavedOk(true);
        stopCamera();
        onComplete?.();
      } catch (e: unknown) {
        const message = errorMessage(e);
        const friendly = message.includes("row-level security") || message.includes("not authorized")
          ? "บัญชีนี้ไม่มีสิทธิ์บันทึกคำขอ กรุณาออกจากระบบแล้วเข้าสู่ระบบนักเรียนใหม่"
          : message.includes("Failed to fetch") || message.includes("NetworkError")
            ? "เชื่อมต่อระบบไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง"
            : message;
        setSaveError(friendly);
        toast.error("ลงทะเบียนไม่สำเร็จ: " + friendly, { duration: 9000 });
      } finally {
        toast.dismiss(__tid_save_1);
        setSaving(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, studentId, retryTick]);



  const reset = () => {
    setStepIdx(0); setSamples([]); setColorFrameIdx(0); setBlockedMsg(null);
    setSaveError(null); setSavedOk(false); setStatusMsg("");
    detectMetaRef.current = { misses: 0, stableHits: 0 };
    blinkStateRef.current = { baseline: 0, samples: [], closed: false, closedFrames: 0, blinks: 0, startedAt: 0, baseFrac: 0, maxFrac: 0 } as any;
    if (!streaming) void startCamera();
  };

  /** ลองบันทึกอีกครั้งโดยไม่ต้องถ่ายใหม่ (ใช้กับกรณีเน็ตหลุด/เซิร์ฟเวอร์ตอบช้า) */
  const retrySave = () => {
    setSaveError(null);
    setStepIdx((i) => i); // trigger effect ผ่าน state ด้านล่าง
    setRetryTick((t) => t + 1);
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
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
            <div ref={flashRef} className="absolute inset-0 mix-blend-screen opacity-60 transition-colors duration-300 pointer-events-none" />

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

          <div className="flex items-center gap-2 flex-wrap">
            <CameraSourcePicker value={camDeviceId} onChange={pickCamera} refreshKey={camTick} className="flex-1 min-w-[10rem]" />
            <CameraFocusLockToggle getStream={() => videoRef.current?.srcObject as MediaStream | null} active={streaming} />
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
              ) : saveError ? (
                <div className="space-y-2">
                  <div className="rounded-lg border-2 border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive font-medium">
                    บันทึกไม่สำเร็จ: {saveError}
                  </div>
                  <Button onClick={retrySave} className="gradient-primary">
                    <RotateCcw className="w-4 h-4 mr-2" />ลองบันทึกอีกครั้ง
                  </Button>
                </div>
              ) : savedOk ? (
                <p className="text-emerald-600 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  {submitMode === "request"
                    ? "ลงทะเบียนสำเร็จ — ใช้งานได้ทันที"
                    : "ลงทะเบียนสำเร็จ — ผ่าน Liveness Check"}
                </p>
              ) : null}
            </div>
          )}


          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset} disabled={saving}>
              <RotateCcw className="w-4 h-4 mr-2" />เริ่มใหม่
            </Button>
            <Button variant={savedOk ? "default" : "outline"} onClick={() => onOpenChange(false)} disabled={saving}>
              {savedOk ? "เสร็จสิ้น" : "ปิด"}
            </Button>
          </div>


        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LivenessFaceRegisterDialog;
