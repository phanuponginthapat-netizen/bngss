/**
 * Face Texture Verification (Uniform LBP) — ชั้นตรวจสอบเพิ่มเติมนอกเหนือจาก ArcFace embedding
 *
 * ทำไมต้องมี: ArcFace มองรูปทรง/โครงสร้างใบหน้าเป็นหลัก คนหน้าคล้ายกัน (พี่น้อง, ทรงผม/แว่นคล้ายกัน,
 * เด็กวัยเดียวกัน) อาจได้ระยะใกล้กันจนถูกจับผิดคน  LBP (Local Binary Patterns) จับ "พื้นผิว" ของผิวหนัง
 * (ริ้วรอย ไฝ ความหยาบละเอียดของผิว เงา) ซึ่งเป็นข้อมูลคนละมิติ → ใช้ยืนยันซ้ำได้ผลดี
 *
 * วิธีทำงาน:
 *   1. จัดตำแหน่งใบหน้าเป็น 112×112 (Umeyama 5 จุด — เหมือนที่ ArcFace ใช้)
 *   2. แปลงเป็นเทาแล้ว normalize ความสว่าง (ทนต่อแสงต่างกัน)
 *   3. คำนวณ uniform LBP (59 บิน) แยกเป็นตาราง 4×4 บล็อก → เวกเตอร์ 944 มิติ
 *   4. เทียบด้วย chi-square distance → similarity 0..1
 */
import { alignFace112, fivePointsFromLandmarks68 } from "@/lib/arcface";
import type * as faceapi from "@vladmandic/face-api";

const SIZE = 112;
const GRID = 4;
const BINS = 59; // 58 uniform patterns + 1 non-uniform bucket

// ── ตาราง lookup ของ uniform pattern (8-bit) ─────────────────────
const UNIFORM_LUT: Int16Array = (() => {
  const lut = new Int16Array(256).fill(58);
  let idx = 0;
  for (let p = 0; p < 256; p++) {
    let transitions = 0;
    for (let i = 0; i < 8; i++) {
      const a = (p >> i) & 1;
      const b = (p >> ((i + 1) % 8)) & 1;
      if (a !== b) transitions++;
    }
    if (transitions <= 2) lut[p] = idx++;
  }
  return lut;
})();

let _cvs: HTMLCanvasElement | null = null;

/** แปลงหน้าที่จัดตำแหน่งแล้วเป็นภาพเทา + normalize ความสว่าง (mean 128, sd 48) */
function toNormalizedGray(canvas: HTMLCanvasElement): Float32Array {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const n = SIZE * SIZE;
  const g = new Float32Array(n);
  let sum = 0;
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    g[p] = v;
    sum += v;
  }
  const mean = sum / n;
  let varSum = 0;
  for (let p = 0; p < n; p++) { const d = g[p] - mean; varSum += d * d; }
  const sd = Math.sqrt(varSum / n) || 1;
  for (let p = 0; p < n; p++) g[p] = 128 + ((g[p] - mean) / sd) * 48;
  return g;
}

/** uniform LBP histogram แบบแบ่งบล็อก 4×4 (944 มิติ, แต่ละบล็อก normalize แยก) */
function lbpHistogram(gray: Float32Array): number[] {
  const blockH = SIZE / GRID;
  const hists: Float32Array[] = [];
  for (let i = 0; i < GRID * GRID; i++) hists.push(new Float32Array(BINS));

  for (let y = 1; y < SIZE - 1; y++) {
    const by = Math.min(GRID - 1, Math.floor(y / blockH));
    for (let x = 1; x < SIZE - 1; x++) {
      const c = gray[y * SIZE + x];
      let code = 0;
      // ลำดับเพื่อนบ้าน 8 ทิศ (clockwise เริ่มมุมบนซ้าย)
      code |= (gray[(y - 1) * SIZE + (x - 1)] >= c ? 1 : 0) << 0;
      code |= (gray[(y - 1) * SIZE + x] >= c ? 1 : 0) << 1;
      code |= (gray[(y - 1) * SIZE + (x + 1)] >= c ? 1 : 0) << 2;
      code |= (gray[y * SIZE + (x + 1)] >= c ? 1 : 0) << 3;
      code |= (gray[(y + 1) * SIZE + (x + 1)] >= c ? 1 : 0) << 4;
      code |= (gray[(y + 1) * SIZE + x] >= c ? 1 : 0) << 5;
      code |= (gray[(y + 1) * SIZE + (x - 1)] >= c ? 1 : 0) << 6;
      code |= (gray[y * SIZE + (x - 1)] >= c ? 1 : 0) << 7;
      const bx = Math.min(GRID - 1, Math.floor(x / blockH));
      hists[by * GRID + bx][UNIFORM_LUT[code]] += 1;
    }
  }

  const out: number[] = [];
  for (const h of hists) {
    let s = 0;
    for (let i = 0; i < BINS; i++) s += h[i];
    s = s || 1;
    for (let i = 0; i < BINS; i++) out.push(h[i] / s);
  }
  return out;
}

/** คำนวณเวกเตอร์พื้นผิวใบหน้าจากภาพต้นทาง + landmarks (พิกัดในภาพจริง) */
export function computeFaceTexture(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  landmarks: faceapi.FaceLandmarks68,
): number[] | null {
  try {
    const pts = fivePointsFromLandmarks68(landmarks);
    return computeFaceTextureFromPoints(source, pts);
  } catch {
    return null;
  }
}

/**
 * คำนวณเวกเตอร์พื้นผิวจาก landmarks ที่อยู่ในพิกัดของภาพที่ย่อแล้ว (เช่น preprocess canvas)
 * scaleX/scaleY = อัตราส่วนภาพต้นฉบับต่อภาพที่ย่อ (videoWidth / canvasWidth)
 */
export function computeFaceTextureScaled(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  landmarks: faceapi.FaceLandmarks68,
  scaleX = 1,
  scaleY = 1,
): number[] | null {
  try {
    const pts = fivePointsFromLandmarks68(landmarks).map(
      ([x, y]) => [x * scaleX, y * scaleY] as [number, number],
    );
    return computeFaceTextureFromPoints(source, pts);
  } catch {
    return null;
  }
}

function computeFaceTextureFromPoints(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  pts: Array<[number, number]>,
): number[] | null {
  try {
    const aligned = alignFace112(source, pts);
    // สำเนาออกมาก่อน เพราะ alignFace112 ใช้ canvas ร่วมกัน
    if (!_cvs) _cvs = document.createElement("canvas");
    _cvs.width = SIZE; _cvs.height = SIZE;
    const ctx = _cvs.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(aligned, 0, 0);
    return lbpHistogram(toNormalizedGray(_cvs));
  } catch {
    return null;
  }
}

/** chi-square distance ระหว่างฮิสโตแกรมพื้นผิว (0 = เหมือนกันสนิท) */
export function textureDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 1;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    const s = a[i] + b[i];
    if (s > 1e-9) sum += (d * d) / s;
  }
  // หารด้วยจำนวนบล็อก → ค่าเฉลี่ยต่อบล็อก (ปกติ 0..~1)
  return sum / (GRID * GRID);
}

/** similarity 0..1 (1 = พื้นผิวเหมือนกัน) */
export function textureSimilarity(a: number[], b: number[]): number {
  return Math.max(0, 1 - textureDistance(a, b));
}

/** เกณฑ์ขั้นต่ำของความคล้ายพื้นผิว — ต่ำกว่านี้ถือว่า "คนละคน" แม้ embedding จะใกล้ */
export const TEXTURE_GATE = {
  /** ผ่านขั้นต่ำ (ยังบันทึกได้ แต่ต้องอาศัย embedding ที่ชัด) */
  MIN_SIMILARITY: 0.55,
  /** ถือว่าพื้นผิวยืนยันตัวตนได้ชัด */
  STRONG_SIMILARITY: 0.68,
} as const;

// ── แคชพื้นผิวของ "ใบหน้าที่ลงทะเบียนไว้" ต่อคน ────────────────────
const registeredCache = new Map<string, number[] | null>();
const pending = new Map<string, Promise<number[] | null>>();

type DetectFn = (img: HTMLImageElement) => Promise<{ landmarks: faceapi.FaceLandmarks68 } | null>;

/**
 * ดึง/คำนวณเวกเตอร์พื้นผิวของภาพใบหน้าที่ลงทะเบียนไว้ (data URL หรือ signed URL)
 * คำนวณครั้งเดียวต่อคนแล้วแคชไว้ในหน่วยความจำ
 */
export async function getRegisteredTexture(
  key: string,
  imageSrc: string | null | undefined,
  detect: DetectFn,
): Promise<number[] | null> {
  if (registeredCache.has(key)) return registeredCache.get(key) ?? null;
  if (!imageSrc) { registeredCache.set(key, null); return null; }
  const existing = pending.get(key);
  if (existing) return existing;

  const job = (async () => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("load-failed"));
        img.src = imageSrc;
      });
      const det = await detect(img);
      if (!det?.landmarks) { registeredCache.set(key, null); return null; }
      const tex = computeFaceTexture(img, det.landmarks);
      registeredCache.set(key, tex);
      return tex;
    } catch {
      registeredCache.set(key, null);
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}

export function clearRegisteredTextureCache(key?: string) {
  if (key) registeredCache.delete(key);
  else registeredCache.clear();
}

// ── ตรวจ texture ตอนสแกน — กันคนหน้าคล้าย + รูปถ่าย/จอภาพ ──────────
// texture ของเฟรมสแกนเทียบกับ texture ของภาพที่ลงทะเบียนไว้
// คำนวณ texture ของภาพลงทะเบียนแค่ครั้งเดียวต่อคนแล้วแคช

const scanResultCache = new Map<string, { sim: number | null; at: number }>();
const scanResultInflight = new Map<string, Promise<number | null>>();

/**
 * ตรวจ "พื้นผิวใบหน้า" ระหว่างเฟรมสแกนสดกับภาพที่ลงทะเบียนไว้
 * @returns similarity 0..1 (null = ไม่มีภาพ/ไม่สามารถเทียบได้ → ถือว่าผ่าน)
 */
export async function verifyScanTexture(opts: {
  studentId: string;
  video: HTMLVideoElement;
  landmarks: faceapi.FaceLandmarks68;
  scaleX: number;
  scaleY: number;
  registeredImageSrc: string | null | undefined;
  minSimilarity?: number;
}): Promise<{ pass: boolean; similarity: number | null }> {
  const { studentId, video, landmarks, scaleX, scaleY, registeredImageSrc, minSimilarity = TEXTURE_GATE.MIN_SIMILARITY } = opts;

  const cached = scanResultCache.get(studentId);
  if (cached) {
    const ttl = cached.sim !== null && cached.sim >= minSimilarity ? 60_000 : 5_000;
    if (Date.now() - cached.at < ttl) {
      return { pass: cached.sim === null || cached.sim >= minSimilarity, similarity: cached.sim };
    }
  }
  const inflight = scanResultInflight.get(studentId);
  if (inflight) {
    const sim = await inflight;
    return { pass: sim === null || sim >= minSimilarity, similarity: sim };
  }

  const job = (async (): Promise<number | null> => {
    // 1) texture ของเฟรมสแกน (landmarks อยู่ในพิกัด preprocess canvas → scale กลับเป็นพิกัด video)
    const scanTex = computeFaceTextureScaled(video, landmarks, scaleX, scaleY);
    if (!scanTex) return null;
    // 2) texture ของภาพลงทะเบียน (คำนวณครั้งเดียว + แคช)
    const regTex = await getRegisteredTexture(
      studentId,
      registeredImageSrc,
      async (img) => {
        const { detectLandmarksFromImage } = await import("@/lib/faceApi");
        return detectLandmarksFromImage(img);
      },
    );
    if (!regTex) return null;
    // 3) เทียบ
    const sim = textureSimilarity(scanTex, regTex);
    return sim;
  })();

  scanResultInflight.set(studentId, job);
  try {
    const sim = await job;
    scanResultCache.set(studentId, { sim, at: Date.now() });
    return { pass: sim === null || sim >= minSimilarity, similarity: sim };
  } finally {
    scanResultInflight.delete(studentId);
  }
}

export function clearScanTextureCache(studentId?: string) {
  if (studentId) {
    scanResultCache.delete(studentId);
    registeredCache.delete(studentId);
  } else {
    scanResultCache.clear();
    registeredCache.clear();
  }
}
