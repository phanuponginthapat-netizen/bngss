/**
 * ArcFace (buffalo_s / w600k_mbf) — DeepFace-grade face recognition in the browser.
 *
 * Pipeline:
 *   1. Detect face + 68 landmarks (face-api.js — already loaded)
 *   2. Compute 5-point similarity transform (Umeyama) → align to 112x112
 *   3. Run ArcFace MobileFaceNet ONNX → 512-D embedding
 *   4. L2-normalize → embeddings comparable via cosine distance
 *
 * Threshold conventions (cosine distance = 1 - cos_sim on L2-normalized vectors):
 *   • distance ≤ 0.35 → strong match  (LFW accuracy ~99.5%)
 *   • distance ≤ 0.45 → probable match
 *   • distance > 0.55 → different person
 *
 * IMPORTANT: This replaces face-api's 128-D FaceNet descriptor with a
 * 512-D ArcFace embedding. All previously registered descriptors are
 * INCOMPATIBLE and must be re-registered.
 */
import * as ort from "onnxruntime-web";
import type * as faceapi from "@vladmandic/face-api";

// Serve WASM binaries from jsDelivr so we don't have to bundle them.
// Must match the installed onnxruntime-web version.
const ORT_VERSION = "1.19.2";
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
ort.env.wasm.numThreads = 1; // avoid COOP/COEP headers requirement
ort.env.wasm.simd = true;

// buffalo_s w600k_mbf — MobileFaceNet, 512-D, ~14MB, ~99.3% LFW.
// Immich mirrors the official InsightFace models with CORS enabled.
const ARCFACE_MODEL_URL =
  "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s/w600k_mbf.onnx";

const INPUT_SIZE = 112;

/** InsightFace canonical 5-point template on a 112×112 crop. */
const ARC_TEMPLATE: Array<[number, number]> = [
  [38.2946, 51.6963], // left eye center
  [73.5318, 51.5014], // right eye center
  [56.0252, 71.7366], // nose tip
  [41.5493, 92.3655], // left mouth corner
  [70.7299, 92.2041], // right mouth corner
];

let session: ort.InferenceSession | null = null;
let loadingPromise: Promise<ort.InferenceSession> | null = null;
let inputName = "input.1";

export async function loadArcFace(onProgress?: (msg: string) => void): Promise<void> {
  if (session) return;
  if (loadingPromise) { await loadingPromise; return; }
  loadingPromise = (async () => {
    onProgress?.("กำลังโหลดโมเดลจดจำใบหน้า ArcFace...");
    const res = await fetch(ARCFACE_MODEL_URL);
    if (!res.ok) throw new Error(`ArcFace model fetch failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    const s = await ort.InferenceSession.create(buf, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    inputName = s.inputNames[0] || "input.1";
    session = s;
    onProgress?.("ArcFace พร้อมใช้งาน");
    return s;
  })();
  await loadingPromise;
}

export function isArcFaceReady(): boolean {
  return session !== null;
}

// ─────────────────────────────────────────────────────────────────
// 5-point landmark extraction from face-api 68 landmarks
// ─────────────────────────────────────────────────────────────────

function centroid(pts: faceapi.Point[]): [number, number] {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return [x / pts.length, y / pts.length];
}

export function fivePointsFromLandmarks68(lm: faceapi.FaceLandmarks68): Array<[number, number]> {
  const leftEye = centroid(lm.getLeftEye());
  const rightEye = centroid(lm.getRightEye());
  const nose = lm.getNose()[3]; // nose tip
  const mouth = lm.getMouth();
  // dlib mouth outline: index 0 = left corner (idx 48), index 6 = right corner (idx 54)
  const mouthLeft = mouth[0];
  const mouthRight = mouth[6];
  return [
    leftEye,
    rightEye,
    [nose.x, nose.y],
    [mouthLeft.x, mouthLeft.y],
    [mouthRight.x, mouthRight.y],
  ];
}

// ─────────────────────────────────────────────────────────────────
// Umeyama similarity transform (src → dst), no reflection.
// Returns 2x3 affine matrix [a c e; b d f] such that dst = M · [src; 1].
// ─────────────────────────────────────────────────────────────────

function umeyama(
  src: Array<[number, number]>,
  dst: Array<[number, number]>,
): [number, number, number, number, number, number] {
  const n = src.length;
  let sx = 0, sy = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    sx += src[i][0]; sy += src[i][1];
    dx += dst[i][0]; dy += dst[i][1];
  }
  sx /= n; sy /= n; dx /= n; dy /= n;

  let srcVar = 0;
  let sxx = 0, sxy = 0, syx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const ax = src[i][0] - sx, ay = src[i][1] - sy;
    const bx = dst[i][0] - dx, by = dst[i][1] - dy;
    srcVar += ax * ax + ay * ay;
    sxx += bx * ax; sxy += bx * ay;
    syx += by * ax; syy += by * ay;
  }
  srcVar /= n;

  // Covariance H = [[sxx sxy],[syx syy]] / n
  const hxx = sxx / n, hxy = sxy / n, hyx = syx / n, hyy = syy / n;

  // 2x2 SVD via closed form
  const E = (hxx + hyy) / 2;
  const F = (hxx - hyy) / 2;
  const G = (hyx + hxy) / 2;
  const H = (hyx - hxy) / 2;
  const Q = Math.sqrt(E * E + H * H);
  const R = Math.sqrt(F * F + G * G);
  const sx1 = Q + R;
  const sx2 = Q - R;
  const a1 = Math.atan2(G, F);
  const a2 = Math.atan2(H, E);
  const theta = (a2 - a1) / 2;
  const phi = (a2 + a1) / 2;

  // U = rot(phi), V = rot(theta), S = diag(sx1, sx2). H = U S V^T.
  // R_opt = U · diag(1, det(U V^T)) · V^T
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const ct = Math.cos(theta), st = Math.sin(theta);
  // det(U V^T) sign check — for reflection correction
  const det = (cp * ct + sp * st) * (cp * ct + sp * st) - (-sp * ct + cp * st) * (sp * ct - cp * st);
  const d = det >= 0 ? 1 : -1;

  // R = U · diag(1,d) · V^T
  const r11 = cp * ct + sp * (d * st);
  const r12 = cp * (-st) + sp * (d * ct);
  const r21 = -sp * ct + cp * (d * st);
  const r22 = -sp * (-st) + cp * (d * ct);

  const scale = srcVar > 0 ? (sx1 + d * sx2) / srcVar : 1;
  const tx = dx - scale * (r11 * sx + r12 * sy);
  const ty = dy - scale * (r21 * sx + r22 * sy);

  // canvas setTransform(a, b, c, d, e, f): x' = a*x + c*y + e, y' = b*x + d*y + f
  const a = scale * r11;
  const b = scale * r21;
  const c = scale * r12;
  const dd = scale * r22;
  return [a, b, c, dd, tx, ty];
}

// ─────────────────────────────────────────────────────────────────
// Alignment + preprocessing
// ─────────────────────────────────────────────────────────────────

let _alignCanvas: HTMLCanvasElement | null = null;

/**
 * Warp source image to a 112×112 aligned face crop using 5-point similarity.
 * `srcLandmarks` are pixel coords in the ORIGINAL source image space.
 */
export function alignFace112(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  srcLandmarks5: Array<[number, number]>,
): HTMLCanvasElement {
  if (!_alignCanvas) _alignCanvas = document.createElement("canvas");
  _alignCanvas.width = INPUT_SIZE;
  _alignCanvas.height = INPUT_SIZE;
  const ctx = _alignCanvas.getContext("2d", { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, INPUT_SIZE, INPUT_SIZE);

  const m = umeyama(srcLandmarks5, ARC_TEMPLATE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(source as CanvasImageSource, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return _alignCanvas;
}

/** Convert 112×112 RGBA canvas → NCHW Float32 tensor normalized to [-1, 1] (RGB). */
function canvasToTensor(canvas: HTMLCanvasElement): ort.Tensor {
  const ctx = canvas.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const n = INPUT_SIZE * INPUT_SIZE;
  const out = new Float32Array(3 * n);
  // Channel-first: R plane, G plane, B plane
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = (data[i] - 127.5) / 127.5;
    out[p + n] = (data[i + 1] - 127.5) / 127.5;
    out[p + 2 * n] = (data[i + 2] - 127.5) / 127.5;
  }
  return new ort.Tensor("float32", out, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

function l2normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

/**
 * Compute a 512-D L2-normalized ArcFace embedding.
 * `landmarks5` are in source-image pixel coords.
 */
export async function computeArcFaceEmbedding(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  landmarks5: Array<[number, number]>,
): Promise<Float32Array> {
  if (!session) await loadArcFace();
  if (!session) throw new Error("ArcFace session not ready");
  const aligned = alignFace112(source, landmarks5);
  const input = canvasToTensor(aligned);
  const outputs = await session.run({ [inputName]: input });
  const key = session.outputNames[0];
  const raw = outputs[key].data as Float32Array;
  return l2normalize(raw);
}

/** Cosine distance (0 = identical, 2 = opposite). Assumes both inputs L2-normalized. */
export function cosineDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += (a[i] as number) * (b[i] as number);
  return 1 - dot;
}
