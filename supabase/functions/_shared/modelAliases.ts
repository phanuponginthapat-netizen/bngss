// ============================================================
// Model alias + fallback map
// ผู้ให้บริการ AI เลิกใช้โมเดลเก่าอยู่เรื่อยๆ (404 model_not_found)
// ไฟล์นี้ทำหน้าที่ (1) แปลงชื่อโมเดลที่ตายแล้ว -> ชื่อปัจจุบัน
//                 (2) ให้ลิสต์โมเดลสำรองต่อผู้ให้บริการ เอาไว้ retry
// ============================================================

/** โมเดลที่ถูกยกเลิกแล้ว -> โมเดลที่ใช้แทนได้ */
export const MODEL_ALIASES: Record<string, string> = {
  // Google Gemini (OpenAI-compatible endpoint)
  "gemini-1.5-flash": "gemini-3.6-flash",
  "gemini-1.5-flash-latest": "gemini-3.6-flash",
  "gemini-1.5-pro": "gemini-3.1-pro-preview",
  "gemini-2.0-flash": "gemini-3.6-flash",
  "gemini-2.0-flash-exp": "gemini-3.6-flash",
  "gemini-2.0-flash-lite": "gemini-3.1-flash-lite",
  "gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-2.5-flash-lite": "gemini-3.1-flash-lite",
  "gemini-2.5-pro": "gemini-3.1-pro-preview",
  "models/gemini-2.0-flash": "gemini-3.8-flash",
  "models/gemini-2.5-flash": "gemini-3.8-flash",
  // 3.6-flash มีรุ่นใหม่กว่าแล้ว (3.8-flash) — ชี้ไปรุ่นล่าสุดเสมอ
  "gemini-3.6-flash": "gemini-3.8-flash",
  "gemini-3.1-flash-lite": "gemini-3.5-flash-lite",

  // Groq — รุ่น llama ทั้งหมดถูกปลดออกแล้ว (scout ปิด 17 ก.ค. 2026, 3.3/3.1 ปิด 16 ส.ค. 2026)
  // รุ่น production ปัจจุบัน: openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.8-27b
  "meta-llama/llama-4-scout-17b-16e-instruct": "openai/gpt-oss-120b",
  "meta-llama/llama-4-maverick-17b-128e-instruct": "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama3-8b-8192": "openai/gpt-oss-20b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "llama-3.2-90b-vision-preview": "openai/gpt-oss-120b",
  "llama-3.2-11b-vision-preview": "openai/gpt-oss-120b",
  "mixtral-8x7b-32768": "openai/gpt-oss-20b",
  "qwen/qwen3-32b": "qwen/qwen3.8-27b",
  "qwen/qwen3.6-27b": "qwen/qwen3.8-27b",
  "moonshotai/kimi-k2-instruct": "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct-0905": "openai/gpt-oss-120b",

  // DeepSeek — deepseek-chat เป็น alias ของ V3.1; รุ่นใหม่คือ V4.1 Flash
  "deepseek-chat": "deepseek-flash",

  // OpenAI
  "gpt-4-vision-preview": "gpt-5-mini",
  "gpt-3.5-turbo": "gpt-5-mini",
  "gpt-4o-mini": "gpt-5-mini",
  "gpt-4.1-mini": "gpt-5-mini",
};

/** ลำดับโมเดลสำรอง ใช้เมื่อโดน 404 / model_not_found */
export const PROVIDER_FALLBACK_MODELS: Record<string, string[]> = {
  gemini: ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  google: ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  groq: [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
  ],
  openai: ["gpt-5-mini", "gpt-4.1-mini"],
  deepseek: ["deepseek-flash", "deepseek-chat"],
  openrouter: ["meta-llama/llama-3.3-70b-instruct:free"],
};

/** แปลงชื่อโมเดลที่ตายแล้วให้เป็นชื่อปัจจุบัน */
export function normalizeModel(model: string | null | undefined, fallback = ""): string {
  const m = (model || "").trim();
  if (!m) return fallback;
  return MODEL_ALIASES[m] || m;
}

/** true เมื่อ error บ่งบอกว่าโมเดลไม่มีอยู่/ถูกยกเลิก -> ควรลองโมเดลสำรอง */
export function isModelNotFound(status: number, body: string): boolean {
  if (status !== 404 && status !== 400) return false;
  const t = (body || "").toLowerCase();
  return (
    t.includes("model_not_found") ||
    t.includes("does not exist") ||
    t.includes("no longer available") ||
    t.includes("is not found") ||
    t.includes("unsupported model") ||
    t.includes("decommissioned")
  );
}

/** ลิสต์โมเดลที่ควรลอง: โมเดลหลัก + สำรองของ provider (ไม่ซ้ำ) */
export function modelCandidates(providerType: string, primary: string): string[] {
  const first = normalizeModel(primary);
  const list = [first, ...(PROVIDER_FALLBACK_MODELS[providerType] || [])];
  return [...new Set(list.filter(Boolean))];
}
