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
  "models/gemini-2.0-flash": "gemini-3.6-flash",
  "models/gemini-2.5-flash": "gemini-3.6-flash",

  // Groq — llama-3.3-70b-versatile ถูกปลดจากหลาย account แล้ว
  "llama-3.3-70b-versatile": "llama-3.1-8b-instant",
  "llama3-70b-8192": "llama-3.1-8b-instant",
  "llama3-8b-8192": "llama-3.1-8b-instant",
  "llama-3.2-90b-vision-preview": "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.2-11b-vision-preview": "meta-llama/llama-4-scout-17b-16e-instruct",
  "mixtral-8x7b-32768": "llama-3.1-8b-instant",

  // OpenAI
  "gpt-4-vision-preview": "gpt-4o-mini",
  "gpt-3.5-turbo": "gpt-4o-mini",
};

/** ลำดับโมเดลสำรอง ใช้เมื่อโดน 404 / model_not_found */
export const PROVIDER_FALLBACK_MODELS: Record<string, string[]> = {
  gemini: ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"],
  google: ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"],
  groq: [
    "llama-3.1-8b-instant",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "openai/gpt-oss-20b",
  ],
  openai: ["gpt-4o-mini", "gpt-4.1-mini"],
  openrouter: ["deepseek/deepseek-chat-v3.1:free", "meta-llama/llama-3.3-70b-instruct:free"],
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
