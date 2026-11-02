/**
 * Runtime backend configuration.
 *
 * ลำดับความสำคัญ (สูง → ต่ำ)
 *  1. localStorage  → ตั้งจากหน้า Setup Wizard (ต่อเครื่อง/เบราว์เซอร์)
 *  2. window.__BNG_CONFIG__ → มาจาก /app-config.js (แก้ไฟล์เดียวหลัง deploy ได้ ไม่ต้อง build ใหม่)
 *  3. import.meta.env → ค่าที่ฝังตอน build (Lovable Cloud / Vercel / Cloudflare env)
 *
 * ทำให้ย้ายไป Supabase self-hosted ได้ทันทีโดยไม่ต้อง rebuild
 */

export type BackendConfig = {
  url: string;
  anonKey: string;
  projectId?: string;
  /** "supabase" (default) หรือ "gdrive" */
  storageProvider?: "supabase" | "gdrive";
};

const LS_KEY = "bng.backend.config";

/**
 * Active hosted backend. Legacy per-browser school settings must not override recovery.
 */
export const CANONICAL_BACKEND = {
  url: "https://dlkyxvhnnffblerwedjz.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa3l4dmhubmZmYmxlcndlZGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjY5MTIsImV4cCI6MjA5OTk0MjkxMn0.bQqqX3veJ_pGr9fSa0a-bKIS-w7UmR569a2xDZQ6Cx4",
  projectId: "dlkyxvhnnffblerwedjz",
} as const;

/** Reject the restricted source backend during Cloud recovery. */
const BLOCKED_PROJECT_REFS: string[] = ["gwmszzoqqxmejefhayqf"];

/** true ถ้า URL ชี้ไป backend ที่ห้ามใช้ */
export function isBlockedBackendUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return BLOCKED_PROJECT_REFS.some(
      (ref) => host === `${ref}.supabase.co` || host.endsWith(`.${ref}.supabase.co`),
    );
  } catch {
    return false;
  }
}

type GlobalConfig = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_PROJECT_ID?: string;
  STORAGE_PROVIDER?: "supabase" | "gdrive";
};

function readLocal(): Partial<BackendConfig> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || !parsed) return {};
    if (isBlockedBackendUrl(parsed.url)) {
      // Discard the restricted school override, preserving the original backend data.
      localStorage.removeItem(LS_KEY);
      console.warn("[backend] ล้างการเชื่อมต่อเดิมและใช้ Lovable Cloud");
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function readGlobal(): Partial<BackendConfig> {
  const g = (typeof window !== "undefined" ? (window as any).__BNG_CONFIG__ : undefined) as
    | GlobalConfig
    | undefined;
  if (!g) return {};
  if (isBlockedBackendUrl(g.SUPABASE_URL)) return {};
  return {
    url: g.SUPABASE_URL || undefined,
    anonKey: g.SUPABASE_ANON_KEY || undefined,
    projectId: g.SUPABASE_PROJECT_ID || undefined,
    storageProvider: g.STORAGE_PROVIDER || undefined,
  };
}

/**
 * ค่าจาก build env (VITE_SUPABASE_*) — รองรับผู้ที่นำระบบไปใช้กับ Supabase ของตัวเอง
 * ค่าที่ชี้ไปบริการโรงเรียนที่ถูกระงับจะถูกกรองทิ้ง
 */
function readEnv(): Partial<BackendConfig> {
  try {
    const env: any = (import.meta as any)?.env ?? {};
    const url = env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY) as
      | string
      | undefined;
    if (!url || !anonKey || isBlockedBackendUrl(url)) return {};
    return { url, anonKey, projectId: env.VITE_SUPABASE_PROJECT_ID || undefined };
  } catch {
    return {};
  }
}

/**
 * ชุดติดตั้งในโรงเรียน (standalone/hybrid): ห้ามแตะ backend ของระบบหลักเด็ดขาด
 * ใช้เฉพาะค่าจาก /app-config.js ที่ตัวติดตั้งเขียนให้ (ชี้ไปเครื่องแม่ข่ายบน HDD)
 */
export function isLocalInstall(): boolean {
  const env: any = (import.meta as any)?.env ?? {};
  if (env.VITE_STANDALONE === "1") return true;
  const g = typeof window !== "undefined" ? (window as any).__BNG_CONFIG__ : undefined;
  const m = String(g?.DEPLOY_MODE || "").toLowerCase();
  return m === "standalone" || m === "hybrid";
}

export function getBackendConfig(): BackendConfig {
  // Recovery uses a single hosted backend; stale installer/browser settings cannot
  // split authentication, CMS and school records across projects.
  readLocal();
  const env = readEnv();
  return {
    ...CANONICAL_BACKEND,
    anonKey: env.url?.replace(/\/+$/, "") === CANONICAL_BACKEND.url && env.anonKey
      ? env.anonKey : CANONICAL_BACKEND.anonKey,
    storageProvider: "supabase",
  };
}

/** true ถ้ายังใช้ backend เริ่มต้น (ยังไม่ได้ตั้ง backend ของตัวเอง) */
export function isUsingDefaultBackend(): boolean {
  return getBackendConfig().url === CANONICAL_BACKEND.url;
}

/** แหล่งที่มาของค่า ใช้แสดงใน Setup Wizard */
export function getConfigSource(): "localStorage" | "app-config.js" | "build env" | "ไม่พบค่า" {
  if (readLocal().url) return "localStorage";
  if (readGlobal().url) return "app-config.js";
  if (readEnv().url) return "build env";
  return "ไม่พบค่า";
}

export function saveBackendConfig(cfg: Partial<BackendConfig>) {
  if (isBlockedBackendUrl(cfg.url)) {
    throw new Error("ระบบกำลังใช้ Lovable Cloud; ไม่สามารถสลับกลับบริการโรงเรียนที่ถูกระงับได้");
  }
  const merged = { ...readLocal(), ...cfg };
  localStorage.setItem(LS_KEY, JSON.stringify(merged));
}

export function clearBackendConfig() {
  localStorage.removeItem(LS_KEY);
}

/** ทดสอบว่า URL + anon key ใช้งานได้จริง (ใช้ได้กับ self-hosted ด้วย) */
export async function testBackendConnection(url: string, anonKey: string) {
  if (isBlockedBackendUrl(url)) throw new Error("บริการโรงเรียนเดิมถูกระงับ กรุณาใช้ Lovable Cloud");
  const base = url.replace(/\/+$/, "");
  const res = await fetch(`${base}/rest/v1/?apikey=${encodeURIComponent(anonKey)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return true;
}

export const isGoogleDriveStorage = () => getBackendConfig().storageProvider === "gdrive";
