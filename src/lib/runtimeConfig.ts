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
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function readGlobal(): Partial<BackendConfig> {
  const g = (typeof window !== "undefined" ? (window as any).__BNG_CONFIG__ : undefined) as
    | GlobalConfig
    | undefined;
  if (!g) return {};
  return {
    url: g.SUPABASE_URL || undefined,
    anonKey: g.SUPABASE_ANON_KEY || undefined,
    projectId: g.SUPABASE_PROJECT_ID || undefined,
    storageProvider: g.STORAGE_PROVIDER || undefined,
  };
}

// ไม่ใช้ค่าจาก build env (VITE_SUPABASE_*) อีกต่อไป — ค่าเหล่านั้นชี้ไป Lovable Cloud
// ระบบอ่าน backend จาก localStorage (Setup Wizard) หรือ /app-config.js เท่านั้น
function readEnv(): Partial<BackendConfig> {
  return {};
}

export function getBackendConfig(): BackendConfig {
  const local = readLocal();
  const global = readGlobal();
  const env = readEnv();
  const pick = (k: keyof BackendConfig) => (local as any)[k] || (global as any)[k] || (env as any)[k] || "";
  return {
    url: String(pick("url") || "").replace(/\/+$/, ""),
    anonKey: String(pick("anonKey") || ""),
    projectId: String(pick("projectId") || ""),
    storageProvider: (pick("storageProvider") as BackendConfig["storageProvider"]) || "supabase",
  };
}

/** แหล่งที่มาของค่า ใช้แสดงใน Setup Wizard */
export function getConfigSource(): "localStorage" | "app-config.js" | "build env" | "ไม่พบค่า" {
  if (readLocal().url) return "localStorage";
  if (readGlobal().url) return "app-config.js";
  if (readEnv().url) return "build env";
  return "ไม่พบค่า";
}

export function saveBackendConfig(cfg: Partial<BackendConfig>) {
  const merged = { ...readLocal(), ...cfg };
  localStorage.setItem(LS_KEY, JSON.stringify(merged));
}

export function clearBackendConfig() {
  localStorage.removeItem(LS_KEY);
}

/** ทดสอบว่า URL + anon key ใช้งานได้จริง (ใช้ได้กับ self-hosted ด้วย) */
export async function testBackendConnection(url: string, anonKey: string) {
  const base = url.replace(/\/+$/, "");
  const res = await fetch(`${base}/rest/v1/?apikey=${encodeURIComponent(anonKey)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return true;
}

export const isGoogleDriveStorage = () => getBackendConfig().storageProvider === "gdrive";
