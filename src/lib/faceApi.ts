import * as faceapi from "@vladmandic/face-api";
import {
  loadArcFace,
  computeArcFaceEmbedding,
  fivePointsFromLandmarks68,
  cosineDistance,
} from "./arcface";

// Use CDN-hosted models from @vladmandic/face-api repo (jsdelivr)
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

let loaded = false;
let loadingPromise: Promise<void> | null = null;
let tinyLoaded = false;
let tinyLoadingPromise: Promise<void> | null = null;

export async function loadFaceModels(onProgress?: (msg: string) => void): Promise<void> {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    onProgress?.("กำลังโหลดโมเดล AI (detector + ArcFace)...");
    // Detector + landmarks จาก face-api + ArcFace ONNX สำหรับ 512-D embedding
    // โหลดขนานกัน — ArcFace ~14MB จะใช้เวลานานสุด
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), // keep as fallback
      loadArcFace(onProgress),
    ]);
    loaded = true;
    onProgress?.("พร้อมใช้งาน");
    // เริ่มโหลด tiny detector ใน background โดยไม่บล็อก UI
    void ensureTinyDetector();
  })();
  return loadingPromise;
}

async function ensureTinyDetector(): Promise<void> {
  if (tinyLoaded) return;
  if (tinyLoadingPromise) return tinyLoadingPromise;
  tinyLoadingPromise = faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL).then(() => {
    tinyLoaded = true;
  });
  return tinyLoadingPromise;
}

// HQ detector — ใช้ SSD MobileNet สำหรับงานที่ต้องการความแม่นยำสูงสุด
export const detectorOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.7, maxResults: 10 });

// Fallback Tiny detector — เร็วกว่าแต่แม่นยำน้อยกว่า ใช้เมื่อ HQ ทำงานช้าเกินไป
export function detectorOptionsHQ(_inputSize: 320 | 416 | 512 | 608 = 608, minConfidence = 0.7) {
  return new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults: 20 });
}

/**
 * ปรับกล้องอัตโนมัติให้คมชัดที่สุดเท่าที่ฮาร์ดแวร์รองรับ
 * รองรับมือถือหลายรุ่น โดยใช้ continuous autofocus / exposure / white-balance
 */
export async function applyCameraAutoTune(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    const caps: any = (track as any).getCapabilities?.() ?? {};
    const advanced: any[] = [];
    if (caps.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
    if (caps.exposureMode?.includes?.("continuous")) advanced.push({ exposureMode: "continuous" });
    if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
    if (caps.sharpness && typeof caps.sharpness.max === "number") advanced.push({ sharpness: caps.sharpness.max });
    if (caps.contrast && typeof caps.contrast.max === "number") {
      const target = caps.contrast.min + (caps.contrast.max - caps.contrast.min) * 0.75;
      advanced.push({ contrast: target });
    }
    if (advanced.length > 0) {
      await (track as any).applyConstraints({ advanced }).catch(() => {});
    }
  } catch { /* ไม่รองรับก็ข้าม */ }
}

type DetectableInput = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

function getInputSize(input: DetectableInput) {
  if (input instanceof HTMLVideoElement) {
    return { width: input.videoWidth, height: input.videoHeight };
  }
  if (input instanceof HTMLImageElement) {
    return { width: input.naturalWidth || input.width, height: input.naturalHeight || input.height };
  }
  return { width: input.width, height: input.height };
}

function createDetectionCanvas(
  input: DetectableInput,
  opts: { maxWidth?: number } = {},
): { canvas: HTMLCanvasElement; scaleX: number; scaleY: number } | null {
  const { width, height } = getInputSize(input);
  if (!width || !height) return null;

  const maxW = opts.maxWidth ?? 960;
  const scale = Math.min(1, maxW / width);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  (ctx as any).filter = "contrast(1.16) brightness(1.06) saturate(1.05)";
  ctx.drawImage(input as CanvasImageSource, 0, 0, w, h);
  (ctx as any).filter = "none";

  return { canvas, scaleX: width / w, scaleY: height / h };
}

async function runSingleFaceDetection(
  input: DetectableInput,
  opts: faceapi.SsdMobilenetv1Options | faceapi.TinyFaceDetectorOptions,
) {
  const single = await faceapi
    .detectSingleFace(input as any, opts as any)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (single) return single;

  const all = await faceapi
    .detectAllFaces(input as any, opts as any)
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (!all.length) return null;

  return all.sort(
    (a, b) => (b.detection.box.width * b.detection.box.height) - (a.detection.box.width * a.detection.box.height),
  )[0];
}

async function detectSingleFaceRobust(input: DetectableInput) {
  const { width } = getInputSize(input);
  if (!width) return null;
  if (input instanceof HTMLVideoElement && input.readyState < 2) return null;

  const enhanced = createDetectionCanvas(
    input,
    { maxWidth: input instanceof HTMLVideoElement ? 960 : 1280 },
  );
  const attempts: Array<{
    input: DetectableInput;
    scaleX: number;
    scaleY: number;
    opts: faceapi.SsdMobilenetv1Options | faceapi.TinyFaceDetectorOptions;
  }> = [
    { input, scaleX: 1, scaleY: 1, opts: detectorOptions },
  ];

  const enhancedInput = enhanced?.canvas ?? input;
  const scaleX = enhanced?.scaleX ?? 1;
  const scaleY = enhanced?.scaleY ?? 1;
  attempts.push(
    { input: enhancedInput, scaleX, scaleY, opts: detectorOptions },
    { input: enhancedInput, scaleX, scaleY, opts: detectorOptionsHQ(512, 0.35) },
    { input: enhancedInput, scaleX, scaleY, opts: detectorOptionsHQ(608, 0.25) },
  );

  for (const attempt of attempts) {
    const res = await runSingleFaceDetection(attempt.input, attempt.opts);
    if (res) {
      return { res, scaleX: attempt.scaleX, scaleY: attempt.scaleY };
    }
  }

  // Fallback สุดท้าย: ใช้ TinyFaceDetector — โหลด lazy ตอนนี้ถ้ายังไม่พร้อม
  try {
    await ensureTinyDetector();
    const tinyRes = await runSingleFaceDetection(
      enhancedInput,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.15 }),
    );
    if (tinyRes) return { res: tinyRes, scaleX, scaleY };
  } catch { /* tiny ไม่พร้อมก็ข้าม */ }

  return null;
}

let _normCanvas: HTMLCanvasElement | null = null;
/**
 * เตรียมเฟรมก่อนตรวจจับ: ปรับ brightness/contrast + Histogram Equalization (CLAHE-ish)
 * บน luminance — ช่วยให้กล้อง/แสงคนละแบบให้ embedding ใกล้กันมากขึ้น (bank-grade normalization)
 */
export function preprocessFrame(
  video: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  opts: { maxWidth?: number; equalize?: boolean } = {},
): HTMLCanvasElement | null {
  const vw = (video as any).videoWidth || (video as any).naturalWidth || (video as any).width;
  const vh = (video as any).videoHeight || (video as any).naturalHeight || (video as any).height;
  if (!vw || !vh) return null;
  const maxW = opts.maxWidth ?? 960;
  const scale = Math.min(1, maxW / vw);
  const w = Math.round(vw * scale), h = Math.round(vh * scale);
  if (!_normCanvas) _normCanvas = document.createElement("canvas");
  _normCanvas.width = w; _normCanvas.height = h;
  const ctx = _normCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  (ctx as any).filter = "contrast(1.12) brightness(1.04) saturate(1.04)";
  ctx.drawImage(video as any, 0, 0, w, h);
  (ctx as any).filter = "none";

  if (opts.equalize !== false) {
    try {
      const img = ctx.getImageData(0, 0, w, h);
      const data = img.data;
      const hist = new Uint32Array(256);
      // build luminance histogram
      for (let i = 0; i < data.length; i += 4) {
        const y = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
        hist[y]++;
      }
      // CDF
      const cdf = new Uint8ClampedArray(256);
      let acc = 0;
      const total = w * h;
      let cdfMin = 0;
      for (let v = 0; v < 256; v++) if (hist[v]) { cdfMin = hist[v]; break; }
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        cdf[v] = Math.max(0, Math.round(((acc - cdfMin) / Math.max(1, total - cdfMin)) * 255));
      }
      // apply per-pixel: scale RGB by ratio of new-Y / old-Y to preserve color
      for (let i = 0; i < data.length; i += 4) {
        const y = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
        const ny = cdf[y];
        // blend 60% equalized + 40% original to avoid over-amplification
        const k = (ny / Math.max(1, y)) * 0.6 + 0.4;
        data[i] = Math.min(255, data[i] * k);
        data[i + 1] = Math.min(255, data[i + 1] * k);
        data[i + 2] = Math.min(255, data[i + 2] * k);
      }
      ctx.putImageData(img, 0, 0);
    } catch { /* equalization optional */ }
  }
  return _normCanvas;
}

/**
 * วัดความสว่างเฉลี่ย (0-255) ของพื้นที่ใบหน้า — ใช้ใน quality gate
 */
export function estimateBrightness(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
): number {
  try {
    const w = (source as any).videoWidth || (source as any).naturalWidth || (source as any).width;
    const h = (source as any).videoHeight || (source as any).naturalHeight || (source as any).height;
    const sx = Math.max(0, Math.floor(box.x));
    const sy = Math.max(0, Math.floor(box.y));
    const sw = Math.max(1, Math.min(Math.floor(box.width), w - sx));
    const sh = Math.max(1, Math.min(Math.floor(box.height), h - sy));
    const target = 32;
    const c = document.createElement("canvas");
    c.width = target; c.height = target;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;
    ctx.drawImage(source as any, sx, sy, sw, sh, 0, 0, target, target);
    const img = ctx.getImageData(0, 0, target, target).data;
    let sum = 0;
    for (let i = 0; i < img.length; i += 4) {
      sum += 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
    }
    return sum / (target * target);
  } catch { return 0; }
}

/**
 * ประเมินความเบลอของพื้นที่ใบหน้า (Laplacian variance)
 * ยิ่งสูง = ยิ่งคมชัด; ต่ำกว่า ~80 มักเบลอเกินกว่าจะใช้ระบุตัวตน
 */
export function estimateFaceSharpness(
  source: HTMLVideoElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
): number {
  try {
    const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    const sx = Math.max(0, Math.floor(box.x));
    const sy = Math.max(0, Math.floor(box.y));
    const sw = Math.max(1, Math.min(Math.floor(box.width), w - sx));
    const sh = Math.max(1, Math.min(Math.floor(box.height), h - sy));
    const target = 64;
    const c = document.createElement("canvas");
    c.width = target; c.height = target;
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    ctx.drawImage(source as any, sx, sy, sw, sh, 0, 0, target, target);
    const img = ctx.getImageData(0, 0, target, target).data;
    const gray = new Float32Array(target * target);
    for (let i = 0, j = 0; i < img.length; i += 4, j++) {
      gray[j] = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
    }
    let mean = 0; const lap = new Float32Array(target * target);
    for (let y = 1; y < target - 1; y++) {
      for (let x = 1; x < target - 1; x++) {
        const k = y * target + x;
        lap[k] = 4 * gray[k] - gray[k - 1] - gray[k + 1] - gray[k - target] - gray[k + target];
        mean += lap[k];
      }
    }
    const n = (target - 2) * (target - 2);
    mean /= n;
    let varSum = 0;
    for (let y = 1; y < target - 1; y++) {
      for (let x = 1; x < target - 1; x++) {
        const d = lap[y * target + x] - mean; varSum += d * d;
      }
    }
    return varSum / n;
  } catch { return 0; }
}

/**
 * แทน 128-D descriptor ของ face-api ด้วย 512-D embedding จาก ArcFace (buffalo_s).
 * landmarks5 ต้องเป็นพิกัดในระบบพิกเซลของภาพต้นฉบับ (source), ไม่ใช่ canvas ที่ย่อ.
 */
async function embedWithArcFace(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  landmarks: faceapi.FaceLandmarks68,
  scaleX: number,
  scaleY: number,
): Promise<Float32Array | null> {
  try {
    const pts5 = fivePointsFromLandmarks68(landmarks).map(
      ([x, y]) => [x * scaleX, y * scaleY] as [number, number],
    );
    return await computeArcFaceEmbedding(source, pts5);
  } catch (e) {
    console.error("[ArcFace] embedding failed, fallback to face-api 128D", e);
    return null;
  }
}

export async function getDescriptorFromImage(
  image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<Float32Array | null> {
  const detected = await detectSingleFaceRobust(image);
  if (!detected) return null;
  const arc = await embedWithArcFace(image, detected.res.landmarks, detected.scaleX, detected.scaleY);
  return arc ?? detected.res.descriptor ?? null;
}

/**
 * ตรวจจับใบหน้า + landmarks + descriptor พร้อมกัน
 * ใช้สำหรับ Liveness Wizard: คำนวณ blink (EAR) และ head pose (yaw)
 * descriptor ที่คืน = 512-D ArcFace embedding (L2-normalized)
 */
export async function detectFaceWithLandmarks(
  image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
) {
  const detected = await detectSingleFaceRobust(image);
  if (!detected) return null;

  const { res, scaleX, scaleY } = detected;
  const lm = res.landmarks;
  const arc = await embedWithArcFace(image, lm, scaleX, scaleY);
  return {
    descriptor: arc ?? res.descriptor,
    box: {
      x: res.detection.box.x * scaleX,
      y: res.detection.box.y * scaleY,
      width: res.detection.box.width * scaleX,
      height: res.detection.box.height * scaleY,
    },
    landmarks: lm,
    ear: averageEAR(lm),
    yaw: estimateYaw(lm),
    pitch: estimatePitch(lm),
  };
}

/**
 * Eye Aspect Ratio (Soukupová & Čech, 2016)
 * EAR < ~0.20 = ตาปิด, EAR > ~0.28 = ตาเปิด
 */
function eyeEAR(eye: faceapi.Point[]): number {
  const dist = (a: faceapi.Point, b: faceapi.Point) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const v1 = dist(eye[1], eye[5]);
  const v2 = dist(eye[2], eye[4]);
  const h = dist(eye[0], eye[3]);
  return (v1 + v2) / (2 * h + 1e-6);
}

export function averageEAR(landmarks: faceapi.FaceLandmarks68): number {
  return (eyeEAR(landmarks.getLeftEye()) + eyeEAR(landmarks.getRightEye())) / 2;
}

/**
 * yaw (หันซ้าย/ขวา): -1..+1 (ลบ=ซ้าย, บวก=ขวา)
 */
export function estimateYaw(landmarks: faceapi.FaceLandmarks68): number {
  const nose = landmarks.getNose()[3];
  const jaw = landmarks.getJawOutline();
  const left = jaw[0], right = jaw[jaw.length - 1];
  const mid = (left.x + right.x) / 2;
  const half = (right.x - left.x) / 2 || 1;
  return (nose.x - mid) / half;
}

/**
 * pitch (ก้ม/เงย): ลบ=เงย, บวก=ก้ม
 */
export function estimatePitch(landmarks: faceapi.FaceLandmarks68): number {
  const nose = landmarks.getNose()[3];
  const leftEye = landmarks.getLeftEye()[0];
  const rightEye = landmarks.getRightEye()[3];
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const chin = landmarks.getJawOutline()[8];
  const total = chin.y - eyeMidY || 1;
  return (nose.y - eyeMidY) / total - 0.45;
}

export async function getAllDescriptors(
  video: HTMLVideoElement | HTMLCanvasElement,
  opts?: faceapi.SsdMobilenetv1Options | faceapi.TinyFaceDetectorOptions,
) {
  const res = await faceapi
    .detectAllFaces(video as any, (opts ?? detectorOptions) as any)
    .withFaceLandmarks()
    .withFaceDescriptors();
  // Overwrite the 128-D face-api descriptors with 512-D ArcFace embeddings.
  // Landmarks are in `video` coord space → scaleX = scaleY = 1.
  await Promise.all(
    res.map(async (d) => {
      const arc = await embedWithArcFace(video, d.landmarks, 1, 1);
      if (arc) (d as any).descriptor = arc;
    }),
  );
  return res;
}

export function euclidean(a: Float32Array | number[], b: Float32Array | number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export interface KnownFace {
  studentId: string;
  descriptors: number[][];
}

export interface MatchResult {
  studentId: string | null;
  distance: number;
  confidence: number; // 0..1 (higher = better)
  secondDistance: number; // ระยะของผู้สมัครอันดับสอง — ใช้ตรวจความชัดของตัวตน
  margin: number; // secondDistance - distance (ยิ่งมาก = ระบุตัวตนชัดเจน)
}

/**
 * จับคู่ ArcFace embedding (L2-normalized 512-D) ด้วย cosine distance ∈ [0, 2].
 * distance ยิ่งต่ำ = ยิ่งเหมือน. Threshold ~0.42 = strong match (cos_sim ≥ 0.58)
 * — เทียบเท่ามาตรฐาน InsightFace/buffalo_s
 */
export function matchDescriptor(
  query: Float32Array | number[],
  known: KnownFace[],
  threshold: number = BANK_GRADE.MATCH_THRESHOLD,
): MatchResult {
  let best: { id: string | null; d: number } = { id: null, d: Infinity };
  let second: { id: string | null; d: number } = { id: null, d: Infinity };
  for (const k of known) {
    const dists: number[] = [];
    for (const d of k.descriptors) dists.push(cosineDistance(query, d));
    if (dists.length === 0) continue;
    dists.sort((a, b) => a - b);
    const minD = dists[0];
    // ใช้ค่า median แทน mean — ทนต่อ descriptor ที่หลุด (outlier) ดีกว่า
    const median = dists[Math.floor(dists.length / 2)];
    // เน้น min (descriptor ใกล้ที่สุด) แต่กันการ overfit ด้วย median และค่าต่ำสุดอันดับ 2
    const secondMin = dists.length > 1 ? dists[1] : minD;
    const score = minD * 0.6 + secondMin * 0.25 + median * 0.15;
    if (score < best.d) {
      second = best;
      best = { id: k.studentId, d: score };
    } else if (score < second.d) {
      second = { id: k.studentId, d: score };
    }
  }
  const matched = best.d < threshold ? best.id : null;
  return {
    studentId: matched,
    distance: best.d,
    confidence: Math.max(0, 1 - best.d),
    secondDistance: second.d === Infinity ? 1 : second.d,
    margin: (second.d === Infinity ? 1 : second.d) - best.d,
  };
}

// ============================================================
// BANK-GRADE QUALITY GATE & ANTI-FALSE-POSITIVE
// ============================================================
// Thresholds tuned for ArcFace 512-D (cosine distance = 1 - cos_sim).
// InsightFace buffalo_s baseline: cos_sim ≥ 0.55 = same person, ≥ 0.65 = strong.
export const BANK_GRADE = {
  MATCH_THRESHOLD: 0.42,   // distance ≤ 0.42 → same person (cos_sim ≥ 0.58)
  MIN_MARGIN: 0.06,        // gap to runner-up
  MIN_CONFIDENCE: 0.60,    // 1 - distance = cos_sim
  STRONG_MARGIN: 0.10,
  STRONG_CONFIDENCE: 0.68,
  MIN_SHARPNESS: 90,
  MIN_SHARPNESS_SCAN: 55,
  MIN_FACE_SIZE_REGISTER: 140,
  MIN_FACE_SIZE_SCAN: 90,
  MIN_FACE_RATIO: 0.18,
  MAX_ABS_YAW: 0.30,
  MAX_ABS_PITCH: 0.22,
  MIN_EAR: 0.20,
  BRIGHTNESS_MIN: 65,
  BRIGHTNESS_MAX: 215,
  MAX_DESCRIPTORS_PER_STUDENT: 10,
} as const;

export interface QualityReport {
  ok: boolean;
  score: number;
  reasons: string[];
  metrics: {
    sharpness: number;
    brightness: number;
    yaw: number;
    pitch: number;
    ear: number;
    faceSize: number;
    faceRatio: number;
    landmarkSanity: number;
  };
}

/** Landmark sanity — กันโมเดลจับ "ต้นไม้/สิ่งของ" เป็นใบหน้า */
export function landmarkSanityScore(lm: faceapi.FaceLandmarks68): number {
  try {
    const lEye = lm.getLeftEye();
    const rEye = lm.getRightEye();
    const mouth = lm.getMouth();
    const nose = lm.getNose();
    const eyeMid = (a: faceapi.Point[]) => {
      let x = 0, y = 0;
      for (const p of a) { x += p.x; y += p.y; }
      return { x: x / a.length, y: y / a.length };
    };
    const Lc = eyeMid(lEye);
    const Rc = eyeMid(rEye);
    const Mc = eyeMid(mouth);
    const Nc = nose[3];
    const eyeDist = Math.hypot(Rc.x - Lc.x, Rc.y - Lc.y);
    const eyeMidY = (Lc.y + Rc.y) / 2;
    const eyeMidX = (Lc.x + Rc.x) / 2;
    const eyeToMouth = Math.hypot(Mc.x - eyeMidX, Mc.y - eyeMidY);
    const eyeToNose = Math.hypot(Nc.x - eyeMidX, Nc.y - eyeMidY);
    if (eyeDist < 1) return 0;
    const r1 = eyeToMouth / eyeDist;
    const r2 = eyeToNose / eyeDist;
    const score1 = r1 >= 0.85 && r1 <= 1.7 ? 1 : Math.max(0, 1 - Math.min(Math.abs(r1 - 0.85), Math.abs(r1 - 1.7)));
    const score2 = r2 >= 0.40 && r2 <= 1.00 ? 1 : Math.max(0, 1 - Math.min(Math.abs(r2 - 0.40), Math.abs(r2 - 1.00)));
    const layoutOk = Mc.y > eyeMidY && Nc.y > eyeMidY && Nc.y < Mc.y ? 1 : 0;
    return Math.max(0, Math.min(1, (score1 * 0.4 + score2 * 0.3 + layoutOk * 0.3)));
  } catch { return 0; }
}

export function assessFaceQuality(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  detection: { box: { x: number; y: number; width: number; height: number }; landmarks: faceapi.FaceLandmarks68 },
  mode: "register" | "scan" = "register",
): QualityReport {
  const w = (source as any).videoWidth || (source as any).naturalWidth || (source as any).width;
  const h = (source as any).videoHeight || (source as any).naturalHeight || (source as any).height;
  const box = detection.box;
  const sharpness = estimateFaceSharpness(source as any, box);
  const brightness = estimateBrightness(source as any, box);
  const yaw = estimateYaw(detection.landmarks);
  const pitch = estimatePitch(detection.landmarks);
  const ear = averageEAR(detection.landmarks);
  const faceSize = Math.min(box.width, box.height);
  const faceRatio = faceSize / Math.max(1, Math.min(w, h));
  const landmarkSanity = landmarkSanityScore(detection.landmarks);

  const reasons: string[] = [];
  const minSharp = mode === "register" ? BANK_GRADE.MIN_SHARPNESS : BANK_GRADE.MIN_SHARPNESS_SCAN;
  const minSize = mode === "register" ? BANK_GRADE.MIN_FACE_SIZE_REGISTER : BANK_GRADE.MIN_FACE_SIZE_SCAN;

  if (sharpness < minSharp) reasons.push(`ภาพเบลอ (ความคมชัด ${Math.round(sharpness)} ต้อง ≥ ${minSharp}) — นิ่งและถือกล้องให้มั่น`);
  if (faceSize < minSize) reasons.push(`ใบหน้าเล็กเกินไป (${Math.round(faceSize)}px ต้อง ≥ ${minSize}px) — ขยับเข้าใกล้กล้อง`);
  if (mode === "register" && faceRatio < BANK_GRADE.MIN_FACE_RATIO) reasons.push("ใบหน้ากินพื้นที่ภาพน้อย — ครอบให้ใบหน้าเต็มกรอบ");
  if (Math.abs(yaw) > BANK_GRADE.MAX_ABS_YAW) reasons.push(`หน้าเอียง (yaw ${yaw.toFixed(2)}) — มองตรงเข้ากล้อง`);
  if (Math.abs(pitch) > BANK_GRADE.MAX_ABS_PITCH) reasons.push(`ก้ม/เงยมาก (pitch ${pitch.toFixed(2)}) — ตั้งศีรษะตรง`);
  if (ear < BANK_GRADE.MIN_EAR) reasons.push(`ตาปิด/หรี่ (EAR ${ear.toFixed(2)}) — ลืมตามองกล้อง`);
  if (brightness < BANK_GRADE.BRIGHTNESS_MIN) reasons.push(`แสงมืดเกินไป (${Math.round(brightness)}) — หาที่สว่างขึ้น`);
  if (brightness > BANK_GRADE.BRIGHTNESS_MAX) reasons.push(`แสงจ้า/ย้อนแสง (${Math.round(brightness)}) — หลีกหน้าต่าง/ไฟ`);
  if (landmarkSanity < 0.5) reasons.push("โครงสร้างใบหน้าผิดสัดส่วน (สงสัยไม่ใช่ใบหน้ามนุษย์) — ลองใหม่");

  const sub = [
    Math.min(1, sharpness / (minSharp * 1.8)),
    Math.min(1, faceSize / (minSize * 1.6)),
    1 - Math.min(1, Math.abs(yaw) / 0.5),
    1 - Math.min(1, Math.abs(pitch) / 0.4),
    Math.min(1, Math.max(0, (brightness - 40) / 140)) * (brightness > 230 ? 0.3 : 1),
    landmarkSanity,
    ear > BANK_GRADE.MIN_EAR ? 1 : 0.3,
  ];
  const score = Math.round((sub.reduce((a, b) => a + b, 0) / sub.length) * 100);

  return {
    ok: reasons.length === 0,
    score,
    reasons,
    metrics: { sharpness, brightness, yaw, pitch, ear, faceSize, faceRatio, landmarkSanity },
  };
}

export function isStrongMatch(m: MatchResult): boolean {
  if (!m.studentId) return false;
  return m.distance <= BANK_GRADE.MATCH_THRESHOLD
    && m.margin >= BANK_GRADE.MIN_MARGIN
    && m.confidence >= BANK_GRADE.MIN_CONFIDENCE;
}

export function isConfirmGrade(m: MatchResult): boolean {
  if (!m.studentId) return false;
  return m.margin >= BANK_GRADE.STRONG_MARGIN && m.confidence >= BANK_GRADE.STRONG_CONFIDENCE;
}

// Multi-frame voting — รวม match จากหลายเฟรมแล้วโหวต
export interface VotingState {
  votes: Map<string, { count: number; bestConfidence: number; bestMargin: number }>;
  totalSamples: number;
  startedAt: number;
}

export function newVotingState(): VotingState {
  return { votes: new Map(), totalSamples: 0, startedAt: Date.now() };
}

export function addVote(state: VotingState, m: MatchResult): void {
  state.totalSamples++;
  if (!m.studentId || !isStrongMatch(m)) return;
  const v = state.votes.get(m.studentId) || { count: 0, bestConfidence: 0, bestMargin: 0 };
  v.count++;
  v.bestConfidence = Math.max(v.bestConfidence, m.confidence);
  v.bestMargin = Math.max(v.bestMargin, m.margin);
  state.votes.set(m.studentId, v);
}

export interface VoteResult {
  studentId: string;
  count: number;
  confidence: number;
  margin: number;
}

export function tallyVotes(state: VotingState, minVotes = 2, minSamples = 3): VoteResult | null {
  if (state.totalSamples < minSamples) return null;
  let winner: VoteResult | null = null;
  for (const [studentId, v] of state.votes.entries()) {
    if (v.count >= minVotes && (!winner || v.count > winner.count || (v.count === winner.count && v.bestConfidence > winner.confidence))) {
      winner = { studentId, count: v.count, confidence: v.bestConfidence, margin: v.bestMargin };
    }
  }
  return winner;
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Draw a polished bracket-style face frame with rounded corners and a name plate.
 */
export interface DrawFaceBoxOpts {
  box: { x: number; y: number; width: number; height: number };
  label?: string;
  sublabel?: string;
  color?: string; // hex
  matched?: boolean;
  confidence?: number;
}

export function drawFaceFrame(ctx: CanvasRenderingContext2D, opts: DrawFaceBoxOpts) {
  const { x, y, width, height } = opts.box;
  const color = opts.color || (opts.matched ? "#22c55e" : "#f97316");
  const cornerLen = Math.max(14, Math.min(width, height) * 0.18);
  const lineW = Math.max(3, Math.min(width, height) * 0.025);

  ctx.save();
  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";

  // Four corner brackets
  const corners = [
    [x, y + cornerLen, x, y, x + cornerLen, y],
    [x + width - cornerLen, y, x + width, y, x + width, y + cornerLen],
    [x + width, y + height - cornerLen, x + width, y + height, x + width - cornerLen, y + height],
    [x + cornerLen, y + height, x, y + height, x, y + height - cornerLen],
  ];
  for (const [x1, y1, cx, cy, x2, y2] of corners) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Confidence bar (top)
  if (typeof opts.confidence === "number") {
    const barH = 4;
    const barY = y - 10;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x, barY, width, barH);
    ctx.fillStyle = color;
    ctx.fillRect(x, barY, width * Math.max(0, Math.min(1, opts.confidence)), barH);
  }

  // Name plate
  if (opts.label) {
    ctx.font = "600 16px 'IBM Plex Sans Thai', system-ui, sans-serif";
    const padX = 10;
    const padY = 6;
    const textW = ctx.measureText(opts.label).width;
    const subText = opts.sublabel || "";
    ctx.font = "500 12px 'IBM Plex Sans Thai', system-ui, sans-serif";
    const subW = subText ? ctx.measureText(subText).width : 0;
    const plateW = Math.max(textW, subW) + padX * 2;
    const plateH = subText ? 44 : 28;
    const plateX = x;
    const plateY = y + height + 8;

    // Rounded plate
    ctx.fillStyle = color;
    roundedRect(ctx, plateX, plateY, plateW, plateH, 8);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 16px 'IBM Plex Sans Thai', system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(opts.label, plateX + padX, plateY + padY);
    if (subText) {
      ctx.font = "500 12px 'IBM Plex Sans Thai', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(subText, plateX + padX, plateY + padY + 18);
    }
  }
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
