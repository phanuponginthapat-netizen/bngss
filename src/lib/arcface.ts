/**
 * ArcFace (MobileFaceNet / buffalo_s) — DeepFace-grade face embedding in the browser.
 *
 *  - 512-dim L2-normalized embedding
 *  - ~99.4% accuracy on LFW (DeepFace's default ArcFace model)
 *  - ONNX Runtime Web (WASM + SIMD), ~13.6 MB, cached by the browser after first load
 *
 *  Pipeline:
 *    face-api landmarks → 5-point → similarity transform → 112x112 BGR tensor →
 *    ArcFace ONNX → 512-dim vector → L2-normalize → cosine similarity
 */

import * as ort from "onnxruntime-web";
import type * as faceapi from "@vladmandic/face-api";
import arcfaceAsset from "@/assets/models/arcface_mbf.onnx.asset.json";

// ============================================================
// Session loader
// ============================================================

let session: ort.InferenceSession | null = null;
let loadPromise: Promise<ort.InferenceSession> | null = null;
let loadError: Error | null = null;
let inputName = "input.1";
let outputName = "fc1";

// Use jsDelivr CDN for the .wasm runtime files — avoids bundling issues with Vite.
// numThreads = 1 so we don't need cross-origin isolation headers (SharedArrayBuffer).
try {
  (ort.env.wasm as any).wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
  (ort.env.wasm as any).numThreads = 1;
  (ort.env.wasm as any).simd = true;
  (ort.env as any).logLevel = "error";
} catch {
  /* ignore */
}

export function isArcFaceReady(): boolean {
  return session !== null;
}

export function getArcFaceError(): Error | null {
  return loadError;
}

export async function loadArcFace(
  onProgress?: (msg: string) => void,
): Promise<ort.InferenceSession> {
  if (session) return session;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      onProgress?.("กำลังโหลด AI ใบหน้า (ArcFace ~14 MB)...");
      const resp = await fetch(arcfaceAsset.url, { cache: "force-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = await resp.arrayBuffer();
      onProgress?.("กำลังเตรียมโมเดล...");
      session = await ort.InferenceSession.create(buf, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      if (session.inputNames?.length) inputName = session.inputNames[0];
      if (session.outputNames?.length) outputName = session.outputNames[0];
      onProgress?.("พร้อมใช้งาน");
      return session;
    } catch (e: any) {
      loadError = e;
      loadPromise = null;
      throw e;
    }
  })();
  return loadPromise;
}

// ============================================================
// Alignment: 68 landmarks → 5-point → Umeyama similarity → 112×112
// ============================================================

// InsightFace standard 5-point template (arcface_src), 112×112 reference frame
const ARC_TEMPLATE: Array<[number, number]> = [
  [38.2946, 51.6963], // left eye
  [73.5318, 51.5014], // right eye
  [56.0252, 71.7366], // nose tip
  [41.5493, 92.3655], // mouth left
  [70.7299, 92.2041], // mouth right
];

function centroid(points: faceapi.Point[]): { x: number; y: number } {
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}

/** Convert face-api 68 landmarks → 5-point used by ArcFace. */
function fivePointFromLandmarks(lm: faceapi.FaceLandmarks68): Array<{ x: number; y: number }> {
  const leftEye = centroid(lm.getLeftEye());
  const rightEye = centroid(lm.getRightEye());
  const nose = lm.getNose()[3]; // tip
  const mouth = lm.getMouth();
  return [
    leftEye,
    rightEye,
    { x: nose.x, y: nose.y },
    { x: mouth[0].x, y: mouth[0].y }, // mouth left corner
    { x: mouth[6].x, y: mouth[6].y }, // mouth right corner
  ];
}

/**
 * Compute 2D similarity transform (rotation + uniform scale + translation)
 * that maps `src` onto `dst` in the least-squares sense.
 * Returns canvas-compatible matrix: x' = a*x + c*y + e, y' = b*x + d*y + f
 */
function umeyamaSimilarity(
  src: Array<{ x: number; y: number }>,
  dst: Array<[number, number]>,
): { a: number; b: number; c: number; d: number; e: number; f: number } {
  const n = src.length;
  let mSx = 0, mSy = 0, mDx = 0, mDy = 0;
  for (let i = 0; i < n; i++) {
    mSx += src[i].x; mSy += src[i].y;
    mDx += dst[i][0]; mDy += dst[i][1];
  }
  mSx /= n; mSy /= n; mDx /= n; mDy /= n;

  let varSrc = 0;
  let sxx = 0, sxy = 0, syx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i].x - mSx, sy = src[i].y - mSy;
    const dx = dst[i][0] - mDx, dy = dst[i][1] - mDy;
    varSrc += sx * sx + sy * sy;
    sxx += dx * sx; sxy += dx * sy;
    syx += dy * sx; syy += dy * sy;
  }
  varSrc /= n;
  if (varSrc < 1e-8) varSrc = 1e-8;

  const aMean = (sxx + syy) / n;
  const bMean = (syx - sxy) / n;
  const theta = Math.atan2(bMean, aMean);
  const scale = Math.sqrt(aMean * aMean + bMean * bMean) / varSrc;
  const cosT = Math.cos(theta), sinT = Math.sin(theta);

  // Translation: dstMean - scale*R*srcMean
  const sRmx = scale * (cosT * mSx - sinT * mSy);
  const sRmy = scale * (sinT * mSx + cosT * mSy);

  return {
    a: scale * cosT,
    b: scale * sinT,
    c: -scale * sinT,
    d: scale * cosT,
    e: mDx - sRmx,
    f: mDy - sRmy,
  };
}

let _alignCanvas: HTMLCanvasElement | null = null;

/** Warp the source image so the 5-point landmarks align to the ArcFace template (112×112). */
function alignFace(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  landmarks: faceapi.FaceLandmarks68,
): HTMLCanvasElement | null {
  try {
    const five = fivePointFromLandmarks(landmarks);
    const T = umeyamaSimilarity(five, ARC_TEMPLATE);
    if (!_alignCanvas) _alignCanvas = document.createElement("canvas");
    _alignCanvas.width = 112;
    _alignCanvas.height = 112;
    const ctx = _alignCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 112, 112);
    ctx.setTransform(T.a, T.b, T.c, T.d, T.e, T.f);
    (ctx as any).imageSmoothingQuality = "high";
    ctx.drawImage(source as any, 0, 0);
    ctx.restore();
    return _alignCanvas;
  } catch {
    return null;
  }
}

// ============================================================
// Inference
// ============================================================

/** Build NCHW BGR tensor in [-1, 1] from a 112×112 canvas. */
function canvasToArcFaceTensor(c: HTMLCanvasElement): ort.Tensor {
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, 112, 112).data;
  const out = new Float32Array(3 * 112 * 112);
  const plane = 112 * 112;
  for (let i = 0, p = 0; i < img.length; i += 4, p++) {
    const r = img[i], g = img[i + 1], b = img[i + 2];
    // InsightFace ArcFace expects BGR, NCHW, scaled to [-1, 1]
    out[p] = (b - 127.5) / 127.5;
    out[plane + p] = (g - 127.5) / 127.5;
    out[2 * plane + p] = (r - 127.5) / 127.5;
  }
  return new ort.Tensor("float32", out, [1, 3, 112, 112]);
}

/** L2-normalize a vector in place. */
function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/**
 * Run ArcFace on the given face. Returns 512-dim L2-normalized embedding,
 * or null if the model isn't loaded or alignment failed.
 */
export async function computeArcFaceEmbedding(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  landmarks: faceapi.FaceLandmarks68,
): Promise<Float32Array | null> {
  if (!session) return null;
  const aligned = alignFace(source, landmarks);
  if (!aligned) return null;
  try {
    const tensor = canvasToArcFaceTensor(aligned);
    const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };
    const out = await session.run(feeds);
    const raw = out[outputName] ?? out[Object.keys(out)[0]];
    const data = raw.data as Float32Array;
    // Copy + L2 normalize (some exports already normalize, some don't — be safe)
    return l2Normalize(new Float32Array(data));
  } catch {
    return null;
  }
}

// ============================================================
// Matching
// ============================================================

export function cosineSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[],
): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as number, y = b[i] as number;
    dot += x * y; na += x * x; nb += y * y;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

export interface KnownArcFace {
  studentId: string;
  embeddings: number[][]; // 512-dim each, L2-normalized
}

export interface ArcFaceMatch {
  studentId: string | null;
  similarity: number; // 0..1 (higher = better)
  secondSimilarity: number;
  margin: number; // best - second
}

/**
 * Cosine-similarity matching. Threshold defaults follow DeepFace's ArcFace
 * recommendations:
 *   - 0.42  = default match
 *   - 0.50  = strict (very low false-accept)
 *   - margin ≥ 0.06 to avoid ambiguous matches
 */
export function matchArcFace(
  query: Float32Array,
  known: KnownArcFace[],
  threshold = 0.42,
): ArcFaceMatch {
  let best = { id: null as string | null, sim: -Infinity };
  let second = { id: null as string | null, sim: -Infinity };
  for (const k of known) {
    let topForStudent = -Infinity;
    for (const e of k.embeddings) {
      const s = cosineSimilarity(query, e);
      if (s > topForStudent) topForStudent = s;
    }
    if (topForStudent > best.sim) {
      second = best;
      best = { id: k.studentId, sim: topForStudent };
    } else if (topForStudent > second.sim) {
      second = { id: k.studentId, sim: topForStudent };
    }
  }
  const sim = best.sim === -Infinity ? 0 : best.sim;
  const second2 = second.sim === -Infinity ? 0 : second.sim;
  return {
    studentId: sim >= threshold ? best.id : null,
    similarity: sim,
    secondSimilarity: second2,
    margin: sim - second2,
  };
}

/** Average several embeddings (e.g. from multiple capture frames) then re-normalize. */
export function averageEmbeddings(list: Float32Array[]): Float32Array | null {
  if (list.length === 0) return null;
  const dim = list[0].length;
  const out = new Float32Array(dim);
  for (const v of list) {
    if (v.length !== dim) continue;
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  for (let i = 0; i < dim; i++) out[i] /= list.length;
  return l2Normalize(out);
}

// ============================================================
// Bank-grade thresholds (DeepFace-equivalent)
// ============================================================

export const ARCFACE_GRADE = {
  /** Default match threshold (cosine similarity). */
  MATCH_THRESHOLD: 0.42,
  /** Strong-match — used to skip second-look review. */
  STRONG_THRESHOLD: 0.50,
  /** Best vs second-best gap to avoid mistaken identity. */
  MIN_MARGIN: 0.06,
  MODEL_VERSION: "arcface-mbf-v1",
} as const;
