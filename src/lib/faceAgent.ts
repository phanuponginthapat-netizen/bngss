/**
 * FaceGate Agent client — ตัวประมวลผลใบหน้าแบบเนทีฟบนเครื่องคีออส (127.0.0.1:8899)
 *
 * ถ้าเครื่องติดตั้ง agent ไว้ (scripts/kiosk/facegate-agent) หน้าเว็บจะส่งภาพเฟรมไปให้
 * agent ตรวจจับใบหน้า (SCRFD) + คำนวณ embedding (ArcFace w600k_mbf 512 มิติ)
 * ซึ่งเป็นโมเดลตัวเดียวกับที่เว็บใช้ → เทียบกับใบหน้าที่ลงทะเบียนไว้ได้ทันที
 * แต่แม่นและเร็วกว่ามาก เพราะรันเนทีฟและจัดตำแหน่งใบหน้าด้วยจุดสังเกต 5 จุดจริง
 *
 * ถ้าไม่มี agent → ทุกอย่างทำงานเหมือนเดิมด้วยการประมวลผลในเบราว์เซอร์ (fallback อัตโนมัติ)
 */

const DEFAULT_URL = "http://127.0.0.1:8899";
const URL_KEY = "kiosk_face_agent_url";
const DISABLE_KEY = "kiosk_face_agent_disabled";

export interface AgentFace {
  box: { x: number; y: number; width: number; height: number };
  keypoints: Array<[number, number]>;
  score: number;
  descriptor: number[];
  live: boolean;
  sharpness: number;
  colorSpread: number;
  crop?: string | null;
}

export interface AgentHealth { ok: boolean; engine?: string; dim?: number; detSize?: number }

let health: AgentHealth | null = null;
let probedAt = 0;
let probing: Promise<AgentHealth | null> | null = null;

const baseUrl = () => {
  try { return localStorage.getItem(URL_KEY) || DEFAULT_URL; } catch { return DEFAULT_URL; }
};
const disabled = () => {
  try { return localStorage.getItem(DISABLE_KEY) === "1"; } catch { return false; }
};

export function setFaceAgentEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.removeItem(DISABLE_KEY);
    else localStorage.setItem(DISABLE_KEY, "1");
  } catch { /* โหมดส่วนตัว */ }
  health = null;
  probedAt = 0;
}

/** ตรวจว่ามี agent หรือไม่ (แคช 60 วินาที) */
export async function probeFaceAgent(force = false): Promise<AgentHealth | null> {
  if (disabled()) return null;
  const now = Date.now();
  if (!force && health && now - probedAt < 60_000) return health;
  if (probing) return probing;
  probing = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${baseUrl()}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      const data = res.ok ? ((await res.json()) as AgentHealth) : null;
      health = data?.ok ? data : null;
    } catch {
      health = null;
    } finally {
      probedAt = Date.now();
      probing = null;
    }
    return health;
  })();
  return probing;
}

export const faceAgentReady = () => !!health?.ok && !disabled();
export const faceAgentEngine = () => health?.engine || "-";

async function toJpegBlob(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  maxWidth: number,
): Promise<{ blob: Blob; scale: number } | null> {
  try {
    const sw = (source as HTMLVideoElement).videoWidth || (source as HTMLImageElement).naturalWidth || (source as HTMLCanvasElement).width;
    const sh = (source as HTMLVideoElement).videoHeight || (source as HTMLImageElement).naturalHeight || (source as HTMLCanvasElement).height;
    if (!sw || !sh) return null;
    const scale = Math.min(1, maxWidth / sw);
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source as CanvasImageSource, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob((b) => r(b), "image/jpeg", 0.82));
    return blob ? { blob, scale } : null;
  } catch {
    return null;
  }
}

/**
 * ส่งเฟรมให้ agent — คืนใบหน้าพร้อม embedding ในพิกัดของวิดีโอจริง
 * คืน null = ใช้ agent ไม่ได้ → ผู้เรียกต้อง fallback ไปประมวลผลในเบราว์เซอร์
 */
export async function agentScanFrame(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  opts?: { maxWidth?: number; timeoutMs?: number },
): Promise<AgentFace[] | null> {
  if (!faceAgentReady()) return null;
  const jpeg = await toJpegBlob(source, opts?.maxWidth ?? 640);
  if (!jpeg) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 2500);
    const res = await fetch(`${baseUrl()}/scan`, {
      method: "POST",
      body: jpeg.blob,
      headers: { "Content-Type": "image/jpeg" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as { faces?: AgentFace[] };
    const inv = 1 / (jpeg.scale || 1);
    return (data.faces || []).map((f) => ({
      ...f,
      box: { x: f.box.x * inv, y: f.box.y * inv, width: f.box.width * inv, height: f.box.height * inv },
      keypoints: (f.keypoints || []).map(([x, y]) => [x * inv, y * inv] as [number, number]),
    }));
  } catch {
    // agent ล่มกลางทาง → กลับไปใช้เบราว์เซอร์ชั่วคราว
    health = null;
    probedAt = Date.now();
    return null;
  }
}

/** คำนวณ embedding จากรูป (data URL) — ใช้ตอนลงทะเบียนใบหน้าให้แม่นเท่าตอนสแกน */
export async function agentEmbedImage(
  dataUrl: string,
  opts?: { crop?: boolean; timeoutMs?: number },
): Promise<AgentFace[] | null> {
  if (!faceAgentReady()) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 8000);
    const res = await fetch(`${baseUrl()}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, crop: !!opts?.crop }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as { faces?: AgentFace[] };
    return data.faces || [];
  } catch {
    return null;
  }
}

/** รูปแบบผลลัพธ์ให้เหมือนของ face-api เพื่อให้ลูปสแกนใช้ต่อได้ทันที (แต่ไม่มี landmarks 68 จุด) */
export interface AgentDetection {
  detection: { box: { x: number; y: number; width: number; height: number }; score: number };
  landmarks: null;
  descriptor: Float32Array;
  agent: true;
  agentLive: boolean;
  agentSharpness: number;
  keypoints: Array<[number, number]>;
}

/**
 * ตรวจจับ+คำนวณ embedding ด้วย agent เนทีฟ แล้วคืนในรูปแบบเดียวกับ getAllDescriptors
 * คืน null = ใช้ agent ไม่ได้ → ผู้เรียกต้องใช้เส้นทางเบราว์เซอร์ตามเดิม
 */
export async function agentGetDescriptors(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  opts?: { singleFace?: boolean; maxWidth?: number; timeoutMs?: number },
): Promise<AgentDetection[] | null> {
  const faces = await agentScanFrame(source, { maxWidth: opts?.maxWidth, timeoutMs: opts?.timeoutMs });
  if (!faces) return null;
  let list = faces.filter((f) => Array.isArray(f.descriptor) && f.descriptor.length > 0);
  if ((opts?.singleFace ?? true) && list.length > 1) {
    list = [list.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0]];
  }
  return list.map((f) => ({
    detection: { box: f.box, score: f.score },
    landmarks: null,
    descriptor: Float32Array.from(f.descriptor),
    agent: true as const,
    agentLive: f.live !== false,
    agentSharpness: f.sharpness ?? 0,
    keypoints: f.keypoints || [],
  }));
}
