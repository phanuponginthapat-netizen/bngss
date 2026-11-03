/**
 * On-device FaceGate engine for the tablet scanner app (no PC needed).
 *
 * Runs the same models as the FaceGate PC program — SCRFD det_500m for
 * detection + 5 landmarks and ArcFace w600k_mbf for the 512-D embedding — so
 * faces registered through FaceGate match on the tablet without re-enrolling.
 */
import * as ort from "onnxruntime-web";
import { computeArcFaceEmbedding, loadArcFace } from "@/lib/arcface";

const DET_MODEL_URL = "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s/det_500m.onnx";
const DET_SIZE = 320;
const STRIDES = [8, 16, 32];
const ANCHORS = 2;
const CACHE = "ai-models-v1";
const FLAG_KEY = "kiosk_on_device_face";

export interface OnDeviceFace {
  box: { x: number; y: number; width: number; height: number };
  keypoints: Array<[number, number]>;
  score: number;
  descriptor: number[];
}

let det: ort.InferenceSession | null = null;
let loading: Promise<boolean> | null = null;
let failed = false;

function isNativeApp(): boolean {
  const cap = (globalThis as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** Tablet app always, or any browser where an admin switched it on. */
export function onDeviceFaceAllowed(): boolean {
  try {
    const v = localStorage.getItem(FLAG_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch { /* private mode */ }
  return isNativeApp();
}

export function setOnDeviceFace(enabled: boolean) {
  try { localStorage.setItem(FLAG_KEY, enabled ? "1" : "0"); } catch { /* ignore */ }
}

async function cachedBuffer(url: string): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return await hit.arrayBuffer();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`model ${res.status}`);
    try { await cache.put(url, res.clone()); } catch { /* quota */ }
    return await res.arrayBuffer();
  } catch (e) {
    const res = await fetch(url);
    if (!res.ok) throw e;
    return await res.arrayBuffer();
  }
}

export async function loadOnDeviceFace(): Promise<boolean> {
  if (det) return true;
  if (failed) return false;
  if (!loading) {
    loading = (async () => {
      try {
        const buf = await cachedBuffer(DET_MODEL_URL);
        det = await ort.InferenceSession.create(buf, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
        await loadArcFace();
        return true;
      } catch (e) {
        console.warn("[on-device face] load failed", e);
        failed = true;
        return false;
      } finally {
        loading = null;
      }
    })();
  }
  return loading;
}

export const onDeviceFaceReady = () => det !== null;

let canvas: HTMLCanvasElement | null = null;

type Source = HTMLCanvasElement | HTMLVideoElement | HTMLImageElement;

function sourceSize(s: Source): [number, number] {
  const w = (s as HTMLVideoElement).videoWidth || (s as HTMLImageElement).naturalWidth || (s as HTMLCanvasElement).width;
  const h = (s as HTMLVideoElement).videoHeight || (s as HTMLImageElement).naturalHeight || (s as HTMLCanvasElement).height;
  return [w || 0, h || 0];
}

/** Letterbox to 320×320 (top-left), RGB, (x-127.5)/128 — same as InsightFace SCRFD. */
function prepare(source: Source): { tensor: ort.Tensor; scale: number } | null {
  const [w, h] = sourceSize(source);
  if (!w || !h) return null;
  const scale = Math.min(DET_SIZE / w, DET_SIZE / h);
  if (!canvas) canvas = document.createElement("canvas");
  canvas.width = DET_SIZE;
  canvas.height = DET_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, DET_SIZE, DET_SIZE);
  ctx.drawImage(source as CanvasImageSource, 0, 0, Math.round(w * scale), Math.round(h * scale));
  const { data } = ctx.getImageData(0, 0, DET_SIZE, DET_SIZE);
  const n = DET_SIZE * DET_SIZE;
  const out = new Float32Array(3 * n);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    out[p] = (data[i] - 127.5) / 128;
    out[p + n] = (data[i + 1] - 127.5) / 128;
    out[p + 2 * n] = (data[i + 2] - 127.5) / 128;
  }
  return { tensor: new ort.Tensor("float32", out, [1, 3, DET_SIZE, DET_SIZE]), scale };
}

interface Raw { x1: number; y1: number; x2: number; y2: number; score: number; kps: Array<[number, number]> }

/** Decode SCRFD outputs (scores/boxes/kps per stride) — exported for tests. */
export function decodeScrfd(outputs: Float32Array[], size: number, threshold: number): Raw[] {
  const found: Raw[] = [];
  STRIDES.forEach((stride, si) => {
    const scores = outputs[si];
    const boxes = outputs[si + 3];
    const kps = outputs[si + 6];
    const gw = Math.ceil(size / stride);
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      if (score < threshold) continue;
      const cell = Math.floor(i / ANCHORS);
      const cx = (cell % gw) * stride;
      const cy = Math.floor(cell / gw) * stride;
      const b = i * 4;
      const k = i * 10;
      const points: Array<[number, number]> = [];
      for (let j = 0; j < 5; j++) points.push([cx + kps[k + j * 2] * stride, cy + kps[k + j * 2 + 1] * stride]);
      found.push({
        x1: cx - boxes[b] * stride, y1: cy - boxes[b + 1] * stride,
        x2: cx + boxes[b + 2] * stride, y2: cy + boxes[b + 3] * stride,
        score, kps: points,
      });
    }
  });
  return nms(found, 0.4);
}

function nms(list: Raw[], iouMax: number): Raw[] {
  const sorted = [...list].sort((a, b) => b.score - a.score);
  const keep: Raw[] = [];
  for (const r of sorted) {
    const overlaps = keep.some((k) => {
      const ix = Math.max(0, Math.min(r.x2, k.x2) - Math.max(r.x1, k.x1));
      const iy = Math.max(0, Math.min(r.y2, k.y2) - Math.max(r.y1, k.y1));
      const inter = ix * iy;
      const union = (r.x2 - r.x1) * (r.y2 - r.y1) + (k.x2 - k.x1) * (k.y2 - k.y1) - inter;
      return union > 0 && inter / union > iouMax;
    });
    if (!overlaps) keep.push(r);
  }
  return keep;
}

/** Detect faces; embed only the largest one (one student at a time). */
export async function onDeviceScan(source: Source, minScore = 0.5): Promise<{ faces: OnDeviceFace[]; count: number } | null> {
  if (!det && !(await loadOnDeviceFace())) return null;
  const prep = prepare(source);
  if (!prep || !det) return null;
  const res = await det.run({ [det.inputNames[0]]: prep.tensor });
  const outs = det.outputNames.map((n) => res[n].data as Float32Array);
  const raws = decodeScrfd(outs, DET_SIZE, minScore);
  if (!raws.length) return { faces: [], count: 0 };
  const inv = 1 / prep.scale;
  const main = raws.reduce((a, b) => ((b.x2 - b.x1) * (b.y2 - b.y1) > (a.x2 - a.x1) * (a.y2 - a.y1) ? b : a));
  const kps = main.kps.map(([x, y]) => [x * inv, y * inv] as [number, number]);
  const descriptor = Array.from(await computeArcFaceEmbedding(source, kps));
  return {
    count: raws.length,
    faces: [{
      box: { x: main.x1 * inv, y: main.y1 * inv, width: (main.x2 - main.x1) * inv, height: (main.y2 - main.y1) * inv },
      keypoints: kps,
      score: main.score,
      descriptor,
    }],
  };
}
