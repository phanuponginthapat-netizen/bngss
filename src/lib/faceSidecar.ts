/**
 * Face Sidecar client — ใช้ตัวช่วยประมวลผลใบหน้าบนเครื่องคีออส (ONNX Runtime + OpenVINO)
 *
 * แนวคิด: เฟรมส่วนใหญ่ "ไม่มีคน" การส่งเข้า pipeline หนักในเบราว์เซอร์ทุกเฟรมจึงเปลืองมาก
 * ถ้าเครื่องมี sidecar (http://127.0.0.1:8765) จะให้ sidecar คัดกรองก่อนว่ามีใบหน้าไหม
 * (เร็วมาก เพราะรันบน iGPU/OpenVINO) แล้วค่อยให้เบราว์เซอร์ทำงานเฉพาะเฟรมที่มีคนจริง
 *
 * ถ้าไม่มี sidecar → ทุกอย่างทำงานเหมือนเดิมทั้งหมด (fallback อัตโนมัติ)
 */

const DEFAULT_URL = "http://127.0.0.1:8765";
const DISABLE_KEY = "kiosk_face_sidecar_disabled";

export interface SidecarBox { x: number; y: number; width: number; height: number; score: number }
export interface SidecarHealth { ok: boolean; detector: boolean; embedder: boolean; provider: string }

let health: SidecarHealth | null = null;
let probedAt = 0;
let probing: Promise<SidecarHealth | null> | null = null;

function baseUrl(): string {
  try {
    return localStorage.getItem("kiosk_face_sidecar_url") || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

function disabled(): boolean {
  try {
    return localStorage.getItem(DISABLE_KEY) === "1";
  } catch {
    return false;
  }
}

/** ตรวจว่ามี sidecar หรือไม่ (cache 60 วินาที) */
export async function probeSidecar(force = false): Promise<SidecarHealth | null> {
  if (disabled()) return null;
  const now = Date.now();
  if (!force && health && now - probedAt < 60_000) return health;
  if (probing) return probing;
  probing = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(`${baseUrl()}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as SidecarHealth;
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

export function sidecarReady(): boolean {
  return !!health?.ok && !disabled();
}

export function sidecarProvider(): string {
  return health?.provider || "-";
}

async function toJpegBlob(source: HTMLCanvasElement | HTMLVideoElement, maxWidth = 480): Promise<Blob | null> {
  try {
    const sw = (source as HTMLVideoElement).videoWidth || (source as HTMLCanvasElement).width;
    const sh = (source as HTMLVideoElement).videoHeight || (source as HTMLCanvasElement).height;
    if (!sw || !sh) return null;
    const scale = Math.min(1, maxWidth / sw);
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source as CanvasImageSource, 0, 0, c.width, c.height);
    return await new Promise((resolve) => c.toBlob((b) => resolve(b), "image/jpeg", 0.7));
  } catch {
    return null;
  }
}

/**
 * ถามว่าเฟรมนี้มีใบหน้าหรือไม่ (pre-filter)
 * คืน null = ตอบไม่ได้/ไม่มี sidecar → ให้ผู้เรียกทำงานตามปกติ
 */
export async function sidecarHasFace(
  source: HTMLCanvasElement | HTMLVideoElement,
  opts?: { minScore?: number; timeoutMs?: number },
): Promise<boolean | null> {
  if (!sidecarReady()) return null;
  const blob = await toJpegBlob(source, 480);
  if (!blob) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 700);
    const res = await fetch(`${baseUrl()}/detect`, {
      method: "POST",
      body: blob,
      headers: { "Content-Type": "image/jpeg" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as { faces?: SidecarBox[] };
    const min = opts?.minScore ?? 0.6;
    return (data.faces || []).some((f) => (f.score ?? 1) >= min);
  } catch {
    // sidecar ล่มกลางทาง → ปิดการใช้งานชั่วคราวแล้ว fallback
    health = null;
    probedAt = Date.now();
    return null;
  }
}
