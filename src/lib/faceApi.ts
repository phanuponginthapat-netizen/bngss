import * as faceapi from "@vladmandic/face-api";
import {
  loadArcFace,
  computeArcFaceEmbedding,
  fivePointsFromLandmarks68,
  cosineDistance,
} from "./arcface";

// Use CDN-hosted models from @vladmandic/face-api repo (jsdelivr), with a mirror
// fallback — some school networks block jsdelivr, which used to hang the
// enrollment dialog forever because loadFromUri() has no built-in timeout.
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
const MIRROR_URL = "https://unpkg.com/@vladmandic/face-api@1.7.15/model";
const MODEL_TIMEOUT_MS = 20000;
const BACKEND_TIMEOUT_MS = 15000;

/** ล้มเหลวเร็วแทนที่จะค้างตลอดกาลเมื่อเครือข่าย/CDN ไม่ตอบ */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

let loaded = false;
let loadingPromise: Promise<void> | null = null;
let tinyLoaded = false;
let tinyLoadingPromise: Promise<void> | null = null;
let backendPromise: Promise<string> | null = null;


/**
 * เตรียม TensorFlow.js backend ก่อนใช้งานโมเดล
 * สำคัญมาก: บนมือถือ/เครื่องที่ WebGL ใช้ไม่ได้ (บล็อก, หน่วยความจำเต็ม, headless)
 * ถ้าไม่ init backend ล่วงหน้า face-api จะ throw ทุกเฟรม → "ตรวจไม่เจอใบหน้า"
 */
export async function ensureTfBackend(onProgress?: (msg: string) => void): Promise<string> {
  if (backendPromise) return backendPromise;
  backendPromise = (async () => {
    const tf: any = (faceapi as any).tf;
    if (!tf) return "unknown";
    try {
      const v = tf.version_wasm || tf.version?.["tfjs-backend-wasm"] || "4.22.0";
      tf.setWasmPaths?.(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${v}/dist/`);
    } catch { /* ไม่มีก็ข้าม */ }
    try {
      await withTimeout((async () => { await tf.setBackend("webgl"); await tf.ready(); })(), BACKEND_TIMEOUT_MS, "webgl");
      if (tf.getBackend() === "webgl") return "webgl";
    } catch { /* ลอง wasm ต่อ */ }
    try {
      onProgress?.("กำลังเตรียมตัวประมวลผล (WASM)...");
      // WASM binary มาจาก CDN — ถ้าเครือข่ายบล็อกต้องไม่ค้าง ให้ตกไป cpu
      await withTimeout((async () => { await tf.setBackend("wasm"); await tf.ready(); })(), BACKEND_TIMEOUT_MS, "wasm");
      if (tf.getBackend() === "wasm") return "wasm";
    } catch { /* ลอง cpu ต่อ */ }
    try {
      await withTimeout((async () => { await tf.setBackend("cpu"); await tf.ready(); })(), BACKEND_TIMEOUT_MS, "cpu");
      return tf.getBackend();
    } catch {
      return "none";
    }
  })();
  // reset cache on failure so retry works
  backendPromise = backendPromise.then((b) => {
    if (b === "none" || b === "unknown") backendPromise = null;
    return b;
  }).catch((e) => { backendPromise = null; throw e; });
  return backendPromise;
}

export async function loadFaceModels(onProgress?: (msg: string) => void): Promise<void> {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    onProgress?.("กำลังโหลดโมเดล AI (detector + ArcFace)...");
    const backend = await ensureTfBackend(onProgress);
    if (backend === "none") throw new Error("อุปกรณ์นี้ประมวลผลโมเดล AI ไม่ได้");
    // Detector + landmarks จาก face-api + ArcFace ONNX สำหรับ 512-D embedding
    // โหลดขนานกัน — ArcFace ~14MB จะใช้เวลานานสุด (ใช้ allSettled กัน CDN ล่มบางไฟล์)
    const CUSTOM_URL = (import.meta as any).env?.VITE_FACE_MODEL_URL || null;
    // ลำดับแหล่งโหลด: ตั้งค่าเอง → jsdelivr → unpkg (แต่ละแหล่งมี timeout ของตัวเอง)
    const SOURCES = [CUSTOM_URL, MODEL_URL, MIRROR_URL].filter(Boolean) as string[];
    const loadWithFallback = async (net: any) => {
      let lastErr: unknown = null;
      for (const url of SOURCES) {
        try {
          await withTimeout(net.loadFromUri(url), MODEL_TIMEOUT_MS, "model");
          return;
        } catch (e) { lastErr = e; }
      }
      throw lastErr instanceof Error ? lastErr : new Error("model load failed");
    };
    const results = await Promise.allSettled([
      loadWithFallback(faceapi.nets.ssdMobilenetv1),
      loadWithFallback(faceapi.nets.faceLandmark68Net),
      loadWithFallback(faceapi.nets.faceRecognitionNet),
      loadArcFace(onProgress).catch(() => { /* ArcFace ไม่พร้อมก็ยังตรวจจับใบหน้าได้ */ }),
    ]);
    const failed = results.slice(0,3).filter(r => r.status === 'rejected');
    if (failed.length >= 2) throw new Error("โหลดโมเดลหลักล้มเหลว กรุณาลองใหม่หรือตรวจสอบเครือข่าย");
    loaded = true;
    onProgress?.("พร้อมใช้งาน");
    // เริ่มโหลด tiny detector ใน background โดยไม่บล็อก UI
    void ensureTinyDetector().catch(() => { /* optional */ });
  })().catch((e) => {
    loadingPromise = null;
    throw e;
  });
  return loadingPromise;
}


async function ensureTinyDetector(): Promise<void> {
  if (tinyLoaded) return;
  if (tinyLoadingPromise) return tinyLoadingPromise;
  tinyLoadingPromise = (async () => {
    for (const url of [MODEL_URL, MIRROR_URL]) {
      try {
        await withTimeout(faceapi.nets.tinyFaceDetector.loadFromUri(url), MODEL_TIMEOUT_MS, "tiny");
        tinyLoaded = true;
        return;
      } catch { /* ลองแหล่งถัดไป */ }
    }
    tinyLoadingPromise = null;
    throw new Error("tiny detector load failed");
  })();
  return tinyLoadingPromise;
}


// Detector หลัก — ลด minConfidence ลงให้จับใบหน้าได้ง่ายขึ้น (แสงน้อย/กล้องเว็บแคมคุณภาพต่ำ)
export const detectorOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35, maxResults: 10 });

// Fallback Tiny detector — เร็วกว่าแต่แม่นยำน้อยกว่า ใช้เมื่อ HQ ทำงานช้าเกินไป
export function detectorOptionsHQ(_inputSize: 320 | 416 | 512 | 608 = 608, minConfidence = 0.5) {
  return new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults: 20 });
}


/**
 * ปรับกล้องให้ "พอดี" ไม่สว่างจ้าจนหน้าขาว (over-exposure) และไม่มืดจนจับหน้าไม่ได้
 * แนวทาง: ปล่อยให้กล้อง auto-exposure/auto-WB ทำงานเป็นหลัก แล้วค่อยปรับละเอียด
 * ด้วย autoExposureBalance() ตามค่าความสว่างจริงของใบหน้าในแต่ละเฟรม
 */
export async function applyCameraAutoTune(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    const caps: any = (track as any).getCapabilities?.() ?? {};
    const advanced: any[] = [];

    if (caps.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
    // ให้ไดรเวอร์เริ่มจากโหมดอัตโนมัติเท่านั้น แล้วใช้ autoExposureBalance()
    // ปรับตามแสงจริงภายหลัง ห้ามกำหนด brightness/gain/contrast แบบค่าคงที่
    if (caps.exposureMode?.includes?.("continuous")) advanced.push({ exposureMode: "continuous" });
    if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({ whiteBalanceMode: "continuous" });

    if (advanced.length > 0) {
      await (track as any).applyConstraints({ advanced }).catch(() => {});
    }
  } catch { /* ไม่รองรับก็ข้าม */ }
}

/**
 * โหมด "ค่ากล้องเริ่มต้นของอุปกรณ์" (เหมือนหน้าลงทะเบียนใบหน้า)
 * เปิดเฉพาะ autofocus / auto-exposure / auto-white-balance
 * ไม่ไปดัน brightness / contrast / gain ใด ๆ — กันภาพขาวโพลนจนจับใบหน้าไม่ได้
 */
export async function applyCameraDefaults(stream: MediaStream | null | undefined): Promise<void> {
  const track = stream?.getVideoTracks?.()[0];
  if (!track || typeof (track as any).getCapabilities !== "function") return;
  try {
    const caps: any = (track as any).getCapabilities?.() ?? {};
    const advanced: any[] = [];
    if (caps.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
    if (caps.exposureMode?.includes?.("continuous")) advanced.push({ exposureMode: "continuous" });
    if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
    if (advanced.length) await (track as any).applyConstraints({ advanced }).catch(() => {});
  } catch { /* ข้าม */ }
}

/** คืนค่าแสง/สี กลับไปเป็นค่าอัตโนมัติของกล้อง และหรี่ลงถ้ายังขาวโพลน */
export async function resetCameraExposure(stream: MediaStream | null | undefined): Promise<void> {
  const track = stream?.getVideoTracks?.()[0];
  if (!track || typeof (track as any).getCapabilities !== "function") return;
  try {
    const caps: any = (track as any).getCapabilities?.() ?? {};
    const cur: any = (track as any).getSettings?.() ?? {};
    const advanced: any[] = [];
    if (caps.exposureMode?.includes?.("continuous")) advanced.push({ exposureMode: "continuous" });
    if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
    // หรี่ลงทีละ 10% ของช่วง (ไม่ต่ำกว่ากึ่งกลาง) แทนการดันไปค่ากลางแบบเดิม
    const down = (key: string) => {
      const c = caps[key];
      if (!c || typeof c.min !== "number" || typeof c.max !== "number") return;
      const range = c.max - c.min;
      if (range <= 0) return;
      const mid = c.min + range * 0.5;
      const now = typeof cur[key] === "number" ? cur[key] : mid;
      const next = Math.max(c.min, Math.min(now, now - range * 0.1));
      if (next < now) advanced.push({ [key]: next });
    };
    down("brightness");
    down("exposureCompensation");
    down("gain");
    if (advanced.length) await (track as any).applyConstraints({ advanced }).catch(() => {});
  } catch { /* ข้าม */ }
}

/**
 * ปรับแสงเฉพาะ "ตอนมืดมาก" เท่านั้น แบบค่อยเป็นค่อยไป
 * สว่างเกิน → คืนค่ากล้องกลับเป็นค่าเริ่มต้น (ไม่หรี่เอง เพราะทำให้ภาพเพี้ยน)
 */
export async function gentleLowLightAssist(
  stream: MediaStream | null | undefined,
  meanLum: number,
): Promise<void> {
  if (!stream || !Number.isFinite(meanLum) || meanLum <= 0) return;
  if (meanLum > 160) { await resetCameraExposure(stream); return; }
  if (meanLum >= 70) return;
  const track = stream.getVideoTracks?.()[0];
  if (!track || typeof (track as any).getCapabilities !== "function") return;
  try {
    const caps: any = (track as any).getCapabilities?.() ?? {};
    const cur: any = (track as any).getSettings?.() ?? {};
    const advanced: any[] = [];
    const step = (key: string) => {
      const c = caps[key];
      if (!c || typeof c.min !== "number" || typeof c.max !== "number") return;
      const range = c.max - c.min;
      if (range <= 0) return;
      const now = typeof cur[key] === "number" ? cur[key] : c.min + range * 0.5;
      // ค่อย ๆ ขึ้นทีละ 8% ของช่วง และไม่เกิน 75% ของช่วง
      const cap = c.min + range * 0.75;
      const next = Math.min(cap, now + range * 0.08);
      if (next > now) advanced.push({ [key]: next });
    };
    step("brightness");
    step("exposureCompensation");
    if (advanced.length) await (track as any).applyConstraints({ advanced }).catch(() => {});
  } catch { /* ข้าม */ }
}

/**
 * ปรับแสงกล้องแบบสองทาง (auto-exposure ของเราเอง)
 * meanLum 0-255 ของ "พื้นที่ใบหน้า":
 *  - < 80  → ดันสว่างขึ้นทีละสเต็ป
 *  - > 165 → หรี่ลงทีละสเต็ป (แก้อาการหน้าขาวโพลน จับใบหน้าไม่ได้)
 *  - 80-165 → ไม่แตะ
 */
export async function autoExposureBalance(
  stream: MediaStream | null | undefined,
  meanLum: number,
): Promise<void> {
  if (!stream || !Number.isFinite(meanLum) || meanLum <= 0) return;
  const dir = meanLum < 80 ? 1 : meanLum > 165 ? -1 : 0;
  if (dir === 0) return;
  const track = stream.getVideoTracks?.()[0];
  if (!track || typeof (track as any).getCapabilities !== "function") return;
  try {
    const caps: any = (track as any).getCapabilities?.() ?? {};
    const cur: any = (track as any).getSettings?.() ?? {};
    const advanced: any[] = [];
    // ยิ่งเบี่ยงจากเป้ามาก ยิ่งปรับแรงขึ้น (แต่ไม่เกิน 25% ของช่วง)
    const target = dir > 0 ? 105 : 140;
    const strength = Math.min(0.25, Math.abs(meanLum - target) / 255 + 0.05);
    const step = (key: string, scale = 1) => {
      const c = caps[key];
      if (!c || typeof c.min !== "number" || typeof c.max !== "number") return;
      const range = c.max - c.min;
      if (range <= 0) return;
      const now = typeof cur[key] === "number" ? cur[key] : c.min + range * 0.5;
      const next = Math.min(c.max, Math.max(c.min, now + dir * range * strength * scale));
      if (Math.abs(next - now) > range * 0.01) advanced.push({ [key]: next });
    };
    step("brightness");
    step("exposureCompensation");
    step("iso", 0.6);
    // ถ้ากล้องรองรับ exposureTime แบบ manual และภาพขาวโพลนมาก → ลดเวลารับแสง
    if (dir < 0 && meanLum > 200 && caps.exposureTime && caps.exposureMode?.includes?.("manual")) {
      const c = caps.exposureTime;
      const now = typeof cur.exposureTime === "number" ? cur.exposureTime : c.max;
      const next = Math.max(c.min, now * 0.75);
      if (next < now) advanced.push({ exposureMode: "manual" }, { exposureTime: next });
    }
    if (advanced.length) await (track as any).applyConstraints({ advanced }).catch(() => {});
  } catch { /* ข้าม */ }
}

/** เดิม: ดันสว่างอย่างเดียว — ตอนนี้เรียกตัวปรับสองทางเพื่อกันภาพขาวโพลน */
export async function boostCameraForLowLight(
  stream: MediaStream | null | undefined,
  meanLum: number,
): Promise<void> {
  return autoExposureBalance(stream, meanLum);
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

  // ใช้ภาพปกติตามมาตรฐาน ArcFace — ไม่ดันคอนทราสต์/ความสว่าง
  (ctx as any).filter = "none";

  ctx.drawImage(input as CanvasImageSource, 0, 0, w, h);
  (ctx as any).filter = "none";

  return { canvas, scaleX: width / w, scaleY: height / h };
}

async function runSingleFaceDetection(
  input: DetectableInput,
  opts: faceapi.SsdMobilenetv1Options | faceapi.TinyFaceDetectorOptions,
) {
  // ใช้แค่ detection + landmarks (ไม่คำนวณ descriptor 128-D ของ face-api)
  // เพราะระบบใช้ ArcFace 512-D อยู่แล้ว → เร็วขึ้นมาก ทำให้ลูปจับใบหน้าลื่นและไวขึ้น
  // เลือก "ใบหน้าใหญ่ที่สุด" เสมอ — ถ่ายภาพไหนก็ได้คนหลักกลางภาพ ไม่ใช่คนข้างๆ
  const all = await faceapi
    .detectAllFaces(input as any, opts as any)
    .withFaceLandmarks();
  if (!all.length) return null;

  return all.sort(
    (a, b) => (b.detection.box.width * b.detection.box.height) - (a.detection.box.width * a.detection.box.height),
  )[0] as any;
}

/**
 * ตรวจหาหน้าเดียวจากรูปภาพ (ใช้สำหรับคำนวณ texture ของภาพที่ลงทะเบียนไว้)
 * คืน landmarks พิกัดภาพจริง — เหมาะกับ getRegisteredTexture ใน faceTexture.ts
 */
export async function detectLandmarksFromImage(
  image: HTMLImageElement,
): Promise<{ landmarks: faceapi.FaceLandmarks68 } | null> {
  const detected = await detectSingleFaceRobust(image);
  if (!detected) return null;
  const raw = detected.res.landmarks;
  const { width: iw, height: ih } = getInputSize(image);
  const lm = (detected.scaleX !== 1 || detected.scaleY !== 1) && typeof (raw as any).forSize === "function"
    ? (raw as any).forSize(iw, ih)
    : raw;
  return { landmarks: lm };
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
    { input: enhancedInput, scaleX, scaleY, opts: detectorOptionsHQ(512, 0.2) },
    { input: enhancedInput, scaleX, scaleY, opts: detectorOptionsHQ(608, 0.1) },
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
    for (const tinyOpt of [
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }),
      new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.1 }),
    ]) {
      const tinyRes = await runSingleFaceDetection(enhancedInput, tinyOpt);
      if (tinyRes) return { res: tinyRes, scaleX, scaleY };
    }
  } catch { /* tiny ไม่พร้อมก็ข้าม */ }

  return null;
}


let _normCanvas: HTMLCanvasElement | null = null;
/** ค่าความสว่างเฉลี่ยของเฟรมล่าสุด (0-255) — ใช้ตัดสินใจว่าจะดันสว่างหรือหรี่ลง */
let _lastMeanLum = 110;
/**
 * ตัวคูณ brightness ของ canvas filter — มาตรฐาน ArcFace ใช้ภาพดิบ ไม่ดันแสง
 * ช่วยเฉพาะกรณีมืดจัดจริง ๆ เท่านั้น และไม่หรี่ภาพ (ปล่อยให้กล้อง auto-exposure ทำงาน)
 */
function _lastFrameBrightnessFactor(): number {
  if (_lastMeanLum < 60) return 1.08;
  return 1;
}

/** ให้ส่วนอื่นอ่าน/อัปเดตค่าแสงล่าสุดได้ (เช่นหน้า kiosk ที่วัดเฉพาะพื้นที่ใบหน้า) */
export function reportFrameLuminance(meanLum: number) {
  if (Number.isFinite(meanLum) && meanLum > 0) _lastMeanLum = meanLum;
}
export function getFrameLuminance() { return _lastMeanLum; }
/**
 * เตรียมเฟรมก่อนตรวจจับ — ค่าเริ่มต้นคือ "ภาพปกติตามมาตรฐาน ArcFace"
 * (resize อย่างเดียว ไม่ทำ histogram equalization / ไม่ดันแสง)
 * ต้องส่ง equalize: true เท่านั้นถึงจะเปิดการปรับแสงเสริม
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
  const bf = _lastFrameBrightnessFactor();
  (ctx as any).filter = bf === 1 ? "none" : `brightness(${bf.toFixed(3)})`;

  ctx.drawImage(video as any, 0, 0, w, h);
  (ctx as any).filter = "none";

  // วัดความสว่างเฉลี่ยไว้ใช้ตัดสินใจ (ไม่แก้ภาพ)
  try {
    const probe = ctx.getImageData(0, 0, w, h).data;
    let lumSum = 0;
    for (let i = 0; i < probe.length; i += 16) {
      lumSum += 0.299 * probe[i] + 0.587 * probe[i + 1] + 0.114 * probe[i + 2];
    }
    const meanLum = lumSum / Math.max(1, probe.length / 16);
    _lastMeanLum = _lastMeanLum * 0.6 + meanLum * 0.4;
  } catch { /* ข้าม */ }

  if (opts.equalize === true) {

    try {
      const img = ctx.getImageData(0, 0, w, h);
      const data = img.data;
      // Adaptive gamma — ถ้าเฟรมมืด ให้ยกสว่างขึ้น, ถ้าสว่างอยู่แล้วก็คงเดิม
      let lumSum = 0;
      for (let i = 0; i < data.length; i += 4) {
        lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const meanLum = lumSum / (w * h);
      _lastMeanLum = _lastMeanLum * 0.6 + meanLum * 0.4; // smooth เพื่อกัน filter กระพริบ
      // target ~110: ภาพมืด → ยกสว่าง, ภาพสว่างจ้า → หรี่ลง (แก้ทิศทางที่กลับด้าน)
      const gamma = Math.min(1.9, Math.max(0.6, (110 / Math.max(1, meanLum)) ** 0.5));
      // ถ้าภาพขาวโพลน (clipping) ให้ดึงไฮไลต์ลงเพิ่ม เพื่อคืนรายละเอียดผิวหน้า
      const highlightPull = meanLum > 185 ? 0.82 : meanLum > 165 ? 0.9 : 1;
      const gammaLut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) {
        const g = 255 * Math.pow(v / 255, 1 / gamma);
        // soft rolloff เฉพาะโซนสว่าง
        const roll = v > 200 ? highlightPull : v > 160 ? 1 - (1 - highlightPull) * ((v - 160) / 40) : 1;
        gammaLut[v] = Math.round(g * roll);
      }

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
        // รวม gamma กับ histogram equalization (ผสมตามระดับแสง)
        const gammaY = gammaLut[y];
        const ny = cdf[y];
        const blend = meanLum < 85 ? 0.45 : meanLum > 180 ? 0.25 : 0.35;
        const ny2 = Math.round(gammaY * (1 - blend) + ny * blend);
        const k = (ny2 / Math.max(1, y)) * 0.7 + 0.3;
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
export async function embedWithArcFace(
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
  return arc ?? null;
}

/**
 * ตรวจจับแค่ "กล่องใบหน้า" ของใบใหญ่สุด — ไม่คำนวณ descriptor/ArcFace เลย
 * เร็วมาก ใช้สำหรับ overlay นำทางระยะ (face guide) ตอนลงทะเบียน/สแกน
 * คืนพิกัดในระบบพิกเซลของวิดีโอ/ภาพจริง
 */
export async function detectFaceBox(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<{ box: { x: number; y: number; width: number; height: number }; landmarks: faceapi.FaceLandmarks68 } | null> {
  const detected = await detectSingleFaceRobust(input);
  if (!detected) return null;
  const { res, scaleX, scaleY } = detected;
  const box = {
    x: res.detection.box.x * scaleX,
    y: res.detection.box.y * scaleY,
    width: res.detection.box.width * scaleX,
    height: res.detection.box.height * scaleY,
  };
  return { box, landmarks: res.landmarks };
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
  // landmarks จาก detector อาจอยู่ในพิกัดของ canvas ที่ย่อแล้ว → ปรับกลับเป็นพิกัดภาพจริง
  // เพื่อให้ overlay วาดตรงตำแหน่ง และ ArcFace ครอปหน้าได้ถูกต้อง
  const rawLm = res.landmarks;
  const { width: iw, height: ih } = getInputSize(image);
  const lm = (scaleX !== 1 || scaleY !== 1) && typeof (rawLm as any).forSize === "function"
    ? (rawLm as any).forSize(iw, ih)
    : rawLm;
  const arc = await embedWithArcFace(image, lm, 1, 1);
  return {
    descriptor: arc ?? null,
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

/**
 * ตรวจจับใบหน้า + landmarks + descriptor
 * singleFace = true (ค่าเริ่มต้น): คืนเฉพาะใบหน้าใหญ่ที่สุดใบเดียวเท่านั้น
 * — ลดโหลด ArcFace (แพงสุด) เหลือ 1 ครั้ง/เฟรม + ไม่สับสนหลายคนในเฟรม → ไวและแม่นขึ้น
 */
export async function getAllDescriptors(
  video: HTMLVideoElement | HTMLCanvasElement,
  opts?: faceapi.SsdMobilenetv1Options | faceapi.TinyFaceDetectorOptions,
  extra?: { minFaceSize?: number; cacheTtlMs?: number; singleFace?: boolean },
) {
  const minFaceSize = extra?.minFaceSize ?? 0;
  const cacheTtlMs = extra?.cacheTtlMs ?? 0;
  const singleFace = extra?.singleFace ?? true;
  let res = await faceapi
    .detectAllFaces(video as any, (opts ?? detectorOptions) as any)
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (singleFace && res.length > 1) {
    // เอาเฉพาะใบที่ใหญ่ที่สุด (คนที่อยู่หน้าเครื่อง/กลางภาพ) แล้วทิ้งใบอื่นทันที
    res = [res.sort((a, b) =>
      (b.detection.box.width * b.detection.box.height) - (a.detection.box.width * a.detection.box.height),
    )[0]];
  }
  // Overwrite the 128-D face-api descriptors with 512-D ArcFace embeddings.
  // Landmarks are in `video` coord space → scaleX = scaleY = 1.
  await Promise.all(
    res.map(async (d) => {
      const box = d.detection.box;
      // ข้าม ArcFace สำหรับใบหน้าที่เล็กเกิน — ประหยัด CPU มาก (ใบหน้าเล็กจะถูกกรองออกจากลูปสแกนอยู่ดี)
      if (minFaceSize > 0 && Math.min(box.width, box.height) < minFaceSize) return;
      const arc = await embedWithCache(video, d.landmarks, cacheTtlMs);
      if (arc) (d as any).descriptor = arc;
      // ถ้า ArcFace ล้มเหลว → ลบ descriptor 128-D ทิ้ง อย่าให้หลุดไปจับคู่กับ 512-D (มิติไม่ตรง = ค่าเพี้ยน)
      else delete (d as any).descriptor;
    }),
  );
  return res;
}

// ── แคช embedding ต่อตำแหน่งใบหน้า — คนยืนนิ่งไม่ต้องคำนวณ ArcFace ซ้ำทุกเฟรม ──
const embedCache = new Map<string, { box: { x: number; y: number; width: number; height: number }; d: Float32Array; at: number }>();

async function embedWithCache(
  video: HTMLVideoElement | HTMLCanvasElement,
  landmarks: faceapi.FaceLandmarks68,
  ttlMs: number,
): Promise<Float32Array | null> {
  if (ttlMs <= 0) return computeArcFaceEmbedding(video, fivePointsFromLandmarks68(landmarks).map((p) => p as [number, number]));
  const now = Date.now();
  const lm = landmarks.positions;
  let cx = 0, cy = 0;
  for (const p of lm) { cx += p.x; cy += p.y; }
  cx /= lm.length; cy /= lm.length;
  // ตำแหน่งถูกปัดเป็นสเต็ป 8px — กันแคชยุ่งจาก jitter เฟรมต่อเฟรม
  const key = `${Math.round(cx / 8)}:${Math.round(cy / 8)}:${Math.round(Math.min(landmarks.getJawOutline().length, 68) * 0)}`;
  const hit = embedCache.get(key);
  if (hit && now - hit.at < ttlMs) return hit.d;
  const d = await computeArcFaceEmbedding(video, fivePointsFromLandmarks68(landmarks).map((p) => p as [number, number]));
  if (d) {
    embedCache.set(key, { box: { x: 0, y: 0, width: 0, height: 0 }, d, at: now });
    if (embedCache.size > 120) {
      // ตัดตัวเก่าเกิน 4 วินาทีออกเมื่อแคชบาน
      for (const [k, v] of embedCache) if (now - v.at > 4000) embedCache.delete(k);
    }
  }
  return d;
}

export function clearEmbedCache() {
  embedCache.clear();
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
let top3Cache: { key: string; top3: KnownFace[]; at: number } | null = null;
function quantizeInt8(arr: Float32Array | number[]): Int8Array {
  const out = new Int8Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = Math.max(-128, Math.min(127, Math.round((arr[i] as number) * 127)));
  return out;
}
function cosineDistanceInt8(a: Int8Array, b: number[]): number {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { const av = a[i] / 127; const bv = b[i] as number; dot += av * bv; nA += av * av; nB += bv * bv; }
  return 1 - dot / (Math.sqrt(nA) * Math.sqrt(nB) + 1e-6);
}

export function matchDescriptor(
  query: Float32Array | number[],
  known: KnownFace[],
  threshold: number = BANK_GRADE.MATCH_THRESHOLD,
): MatchResult {
  // แคช Top3 500ms — คนเดิมยืนหน้าตู้ไม่คำนวณใหม่
  const qKey = `${Math.round((query[0] as number) * 100)}:${known.length}`;
  if (top3Cache && Date.now() - top3Cache.at < 500 && top3Cache.key === qKey) {
    known = top3Cache.top3;
  } else {
  // 2 ขั้น: ขั้นไวหา Top3 ด้วย INT8 1 รูปเด่น/คน (1000 ครั้ง INT8 เร็ว 1.8เท่า) → ขั้นเป๊ะเทียบครบ 3 รูปเฉพาะ Top3 (9 ครั้ง) = 1009 แทน 3000
  if (known.length > 50) {
    const qInt8 = quantizeInt8(query as Float32Array);
    const candidates: Array<{ id: string; d: number; k: KnownFace }> = [];
    for (const k of known) {
      const d = k.descriptors[0];
      if (!d || d.length !== query.length) continue;
      const dist = cosineDistanceInt8(qInt8, d);
      candidates.push({ id: k.studentId, d: dist, k });
    }
    candidates.sort((a, b) => a.d - b.d);
    const top3 = candidates.slice(0, 3).map(c => c.k);
    if (top3.length > 0) {
      top3Cache = { key: qKey, top3, at: Date.now() };
      known = top3;
    }
  }
  }
  let best: { id: string | null; d: number } = { id: null, d: Infinity };
  let second: { id: string | null; d: number } = { id: null, d: Infinity };
  for (const k of known) {
    const dists: number[] = [];
    for (const d of k.descriptors) {
      if (d.length !== query.length) continue;
      dists.push(cosineDistance(query, d));
    }
    if (dists.length === 0) continue;
    dists.sort((a, b) => a - b);
    const minD = dists[0];
    const median = dists[Math.floor(dists.length / 2)];
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

/* ============================================================
 * Multi-condition face augmentation
 * เก็บ/สร้าง embedding ของใบหน้าเดียวกันในหลายสภาพแสง
 * (ปกติ / สว่างจ้า / มืด / โทนอุ่น / โทนเย็น / คอนทราสต์ต่ำ)
 * ทำให้ตอนสแกนจริงในแสงต่างกันยังจับได้แม่นยำ
 * ============================================================ */
export type FaceVariantKey = "normal" | "bright" | "dark" | "warm" | "cool" | "flat";

const VARIANT_FILTERS: Record<FaceVariantKey, string> = {
  normal: "none",
  // ค่าถูกลดลงจากเดิม (1.45/0.6) — ของเดิมแรงเกินจนใบหน้าเพี้ยนกลายเป็น "คนละคน"
  bright: "brightness(1.16) contrast(0.97)",
  dark: "brightness(0.84) contrast(1.05)",
  warm: "sepia(0.14) saturate(1.08) brightness(1.03)",
  cool: "saturate(0.92) hue-rotate(6deg) brightness(0.97)",
  flat: "contrast(0.88) brightness(1.05)",
};

export const DEFAULT_FACE_VARIANTS: FaceVariantKey[] = ["bright", "dark", "warm", "cool"];

/** ระยะห่างสูงสุดที่ variant ยังถือว่าเป็น "คนเดียวกัน" — เกินกว่านี้แปลว่าฟิลเตอร์ทำให้เพี้ยน ต้องทิ้ง */
export const VARIANT_MAX_DRIFT = 0.30;

/** สร้างภาพใบหน้าในสภาพแสงจำลอง 1 แบบ */
export function makeFaceVariant(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  variant: FaceVariantKey,
): HTMLCanvasElement | null {
  const w = (source as any).naturalWidth || (source as any).videoWidth || (source as any).width;
  const h = (source as any).naturalHeight || (source as any).videoHeight || (source as any).height;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  (ctx as any).filter = VARIANT_FILTERS[variant] ?? "none";
  ctx.drawImage(source as any, 0, 0, w, h);
  (ctx as any).filter = "none";
  return c;
}

/**
 * คำนวณ embedding ของใบหน้าเดียวกันในหลายสภาพแสง
 * ใช้ตอนลงทะเบียน — เพิ่มความทนต่อแสงจ้า/แสงน้อย/สีไฟต่างกัน
 */
export async function embedFaceVariants(
  source: HTMLImageElement | HTMLCanvasElement,
  variants: FaceVariantKey[] = DEFAULT_FACE_VARIANTS,
  baseDescriptor?: Float32Array | null,
): Promise<{ variant: FaceVariantKey; descriptor: Float32Array }[]> {
  const out: { variant: FaceVariantKey; descriptor: Float32Array }[] = [];
  // ต้นแบบของภาพนี้ (ไม่ใส่ฟิลเตอร์) ใช้เทียบว่า variant เพี้ยนเกินไปหรือไม่
  let ref = baseDescriptor ?? null;
  if (!ref) {
    try { ref = await getDescriptorFromImage(source as any); } catch { ref = null; }
  }
  for (const v of variants) {
    try {
      const canvas = makeFaceVariant(source, v);
      if (!canvas) continue;
      const d = await getDescriptorFromImage(canvas);
      if (!d) continue;
      // ทิ้ง variant ที่ฟิลเตอร์ทำให้ใบหน้าเพี้ยนจนกลายเป็น "คนละคน"
      if (ref && euclidean(d, ref) > VARIANT_MAX_DRIFT) continue;
      out.push({ variant: v, descriptor: d });
    } catch { /* ข้ามตัวที่ตรวจไม่เจอ */ }
  }
  return out;
}

/** สะดวก: รับ dataURL/URL ของภาพใบหน้าที่ครอบไว้แล้ว */
export async function embedFaceVariantsFromUrl(
  url: string,
  variants: FaceVariantKey[] = DEFAULT_FACE_VARIANTS,
  baseDescriptor?: Float32Array | null,
): Promise<{ variant: FaceVariantKey; descriptor: Float32Array }[]> {
  try {
    const img = await loadImageFromUrl(url);
    return await embedFaceVariants(img, variants, baseDescriptor);
  } catch { return []; }
}
