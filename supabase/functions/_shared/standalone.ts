// Standalone mode guard.
// ระบบนี้ถูกออกแบบให้ "ตัดขาด" จาก Lovable Cloud / Lovable AI เมื่อนำไป deploy เอง
// ค่าเริ่มต้น = standalone (ไม่เรียก ai.gateway.lovable.dev หรือ connector-gateway.lovable.dev เลย)
// ถ้าจำเป็นต้องใช้ของ Lovable ชั่วคราว ให้ตั้ง env ALLOW_LOVABLE_FALLBACK=true

// ปิดถาวร: ระบบตัดขาดจาก Lovable Cloud / Lovable AI / Lovable Connector Gateway 100%
// ทุกการเชื่อมต่อภายนอกวิ่งผ่าน backend ของโรงเรียนเท่านั้น (Supabase + Google OAuth ของโรงเรียน)
export function lovableFallbackEnabled(): boolean {
  return false;
}

export function isStandalone(): boolean {
  return !lovableFallbackEnabled();
}

export const NO_LOVABLE_AI_MSG =
  "ระบบทำงานแบบ Standalone (ไม่ใช้ Lovable AI) — กรุณาตั้งค่า AI Provider ของคุณเองที่ /dashboard/admin/ai-providers หรือใส่คีย์ผู้ให้บริการ (OpenAI / Gemini / OpenRouter / Groq / DeepSeek)";

export const NO_LOVABLE_DRIVE_MSG =
  "ระบบทำงานแบบ Standalone (ไม่ใช้ Lovable Connector) — กรุณาตั้งค่า Google OAuth ของคุณเอง: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (และ GOOGLE_DRIVE_REFRESH_TOKEN หรือ GOOGLE_SERVICE_ACCOUNT_JSON สำหรับงานระบบ)";
