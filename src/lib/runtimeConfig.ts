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
 * Backend หลักของโรงเรียน (canonical) — ใช้เป็นค่าสำรองเสมอ
 * ป้องกันกรณี remix แล้วระบบไปผูกกับ Lovable Cloud โดยอัตโนมัติ
 */
export const CANONICAL_BACKEND = {
  url: "https://gwmszzoqqxmejefhayqf.supabase.co",
  anonKey: "sb_publishable_NlRn4zzOUtHsn4swyH6F7Q_ADVmUe9v",
  projectId: "gwmszzoqqxmejefhayqf",
} as const;

/** single backend — gwmszzoqqxmejefhayqf เท่านั้น */
const BLOCKED_PROJECT_REFS: string[] = [];

/** true ถ้า URL ชี้ไป backend ที่ห้ามใช้ */
export function isBlockedBackendUrl(_url?: string): boolean {
  return false;
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
      // ล้างค่าที่ชี้ไป Lovable Cloud ทิ้งทันที
      localStorage.removeItem(LS_KEY);
      console.warn("[backend] พบค่า backend ที่ชี้ไป Lovable Cloud — ล้างและใช้ backend หลักแทน");
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
 * ค่าที่ชี้ไป Lovable Cloud จะถูกกรองทิ้งเสมอ
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

export function getBackendConfig(): BackendConfig {
  const local = readLocal();
  const global = readGlobal();
  const env = readEnv();
  const pick = (k: keyof BackendConfig) =>
    (local as any)[k] || (global as any)[k] || (env as any)[k] || "";
  let url = String(pick("url") || "").replace(/\/+$/, "");
  let anonKey = String(pick("anonKey") || "");
  let projectId = String(pick("projectId") || "");

  // Fallback สุดท้าย: backend เริ่มต้น (โรงเรียนต้นทาง) — กันกรณียังไม่ได้ตั้งค่า
  if (!url || !anonKey || isBlockedBackendUrl(url)) {
    url = CANONICAL_BACKEND.url;
    anonKey = CANONICAL_BACKEND.anonKey;
    projectId = CANONICAL_BACKEND.projectId;
  }

  return {
    url,
    anonKey,
    projectId,
    storageProvider: (pick("storageProvider") as BackendConfig["storageProvider"]) || "supabase",
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
    throw new Error("ไม่อนุญาตให้ตั้ง backend เป็น Lovable Cloud — กรุณาใช้ Supabase ของโรงเรียน");
  }
  const merged = { ...readLocal(), ...cfg };
  localStorage.setItem(LS_KEY, JSON.stringify(merged));
}

export function clearBackendConfig() {
  localStorage.removeItem(LS_KEY);
}

/** ทดสอบว่า URL + anon key ใช้งานได้จริง (ใช้ได้กับ self-hosted ด้วย) */
export async function testBackendConnection(url: string, anonKey: string) {
  if (isBlockedBackendUrl(url)) throw new Error("ไม่อนุญาตให้เชื่อมต่อ Lovable Cloud");
  const base = url.replace(/\/+$/, "");
  const res = await fetch(`${base}/rest/v1/?apikey=${encodeURIComponent(anonKey)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return true;
}

export const isGoogleDriveStorage = () => getBackendConfig().storageProvider === "gdrive";
