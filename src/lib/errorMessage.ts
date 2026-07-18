/**
 * แปลง error object เป็นข้อความภาษาไทยที่เข้าใจง่าย
 * รองรับ: FunctionsHttpError (Supabase Edge Function), PostgrestError,
 * AuthError, TypeError (network), Error ทั่วไป และ string
 *
 * ใช้:
 *   import { toThaiError } from "@/lib/errorMessage";
 *   swal.error("บันทึกไม่สำเร็จ", await toThaiError(err));
 */

// จับคู่ pattern → ข้อความไทยที่มีความหมาย
const PATTERNS: Array<[RegExp, string]> = [
  // ── Network / connectivity ──
  [/Failed to fetch|NetworkError|network request failed|ERR_NETWORK/i,
    "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบสัญญาณอินเทอร์เน็ต"],
  [/timeout|timed out|ETIMEDOUT/i,
    "เซิร์ฟเวอร์ตอบสนองช้าเกินไป — ลองใหม่อีกครั้ง"],
  [/CORS|Cross-Origin/i,
    "ระบบปฏิเสธคำขอข้ามโดเมน (CORS) — โปรดแจ้งผู้ดูแลระบบ"],

  // ── Auth ──
  [/Invalid login credentials|invalid.*password/i, "อีเมลหรือรหัสผ่านไม่ถูกต้อง"],
  [/Email not confirmed/i, "ยังไม่ได้ยืนยันอีเมล — โปรดตรวจกล่องจดหมาย"],
  [/User already registered|already been registered/i, "อีเมลนี้ถูกใช้ลงทะเบียนแล้ว"],
  [/User not found/i, "ไม่พบผู้ใช้ในระบบ"],
  [/JWT expired|token.*expired/i, "เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่"],
  [/refresh_token_not_found|Invalid Refresh Token/i, "เซสชันไม่ถูกต้อง — กรุณาเข้าสู่ระบบใหม่"],
  [/Password should be at least/i, "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)"],
  [/rate limit|too many requests/i, "ทำรายการบ่อยเกินไป — กรุณารอสักครู่แล้วลองใหม่"],

  // ── Permission / RLS ──
  [/Admin or director access required/i, "ต้องเป็นผู้ดูแลระบบหรือผู้อำนวยการเท่านั้น"],
  [/permission denied for (?:table|schema)/i, "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้"],
  [/new row violates row-level security|violates row-level security policy/i,
    "ไม่มีสิทธิ์บันทึกข้อมูลนี้ (ติดกฎ RLS)"],
  [/insufficient_privilege|not authorized|Unauthorized/i, "ไม่มีสิทธิ์ทำรายการนี้"],
  [/Forbidden/i, "ระบบปฏิเสธคำขอ (Forbidden)"],

  // ── Database ──
  [/duplicate key value|already exists|unique constraint/i,
    "ข้อมูลนี้มีอยู่ในระบบแล้ว (ซ้ำ)"],
  [/violates foreign key constraint/i,
    "ข้อมูลอ้างอิงไม่ถูกต้อง — รายการที่เชื่อมโยงอาจถูกลบ"],
  [/violates not-null constraint|null value in column/i,
    "กรอกข้อมูลไม่ครบ — มีช่องที่จำเป็นยังว่างอยู่"],
  [/violates check constraint/i, "ข้อมูลไม่ผ่านการตรวจสอบเงื่อนไข"],
  [/invalid input syntax/i, "รูปแบบข้อมูลไม่ถูกต้อง"],
  [/relation .* does not exist|column .* does not exist/i,
    "โครงสร้างฐานข้อมูลไม่ตรงกับที่ระบบต้องการ — โปรดแจ้งผู้ดูแล"],

  // ── HTTP status generic ──
  [/^404|Not Found/i, "ไม่พบข้อมูลที่ร้องขอ"],
  [/^500|Internal Server Error/i, "เกิดข้อผิดพลาดในเซิร์ฟเวอร์"],
  [/^502|Bad Gateway/i, "เซิร์ฟเวอร์ตอบผิดพลาด (Bad Gateway)"],
  [/^503|Service Unavailable/i, "บริการไม่พร้อมใช้งานชั่วคราว"],

  // ── File / upload ──
  [/Payload too large|exceeded the maximum allowed size|file.*too large/i,
    "ไฟล์มีขนาดใหญ่เกินกำหนด"],
  [/mime|file type.*not.*allowed/i, "ชนิดไฟล์นี้ไม่รองรับ"],
];

/**
 * พยายามดึงข้อความจริงจาก Supabase Edge Function error
 * FunctionsHttpError.context.response คือ Response object ที่มี body {error: "..."}
 */
async function extractEdgeFunctionMessage(err: any): Promise<string | null> {
  try {
    const res: Response | undefined = err?.context?.response ?? err?.response;
    if (!res || typeof res.text !== "function") return null;
    // clone ก่อนอ่านเผื่อ caller ต้องใช้ต่อ
    const cloned = res.clone ? res.clone() : res;
    const text = await cloned.text();
    if (!text) return null;
    try {
      const j = JSON.parse(text);
      return j.error || j.message || j.msg || j.detail || text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return null;
  }
}

function translate(raw: string): string {
  const s = raw.trim();
  if (!s) return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  for (const [re, thai] of PATTERNS) {
    if (re.test(s)) return thai;
  }
  // ข้อความมาตรฐานไม่มีความหมายกับผู้ใช้ทั่วไป → แทนที่
  if (/Edge Function returned a non-2xx status code/i.test(s)) {
    return "ฟังก์ชันฝั่งเซิร์ฟเวอร์ตอบกลับข้อผิดพลาด (โปรดลองใหม่หรือแจ้งผู้ดูแล)";
  }
  if (/^\[?object /i.test(s)) return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  return s;
}

/**
 * รับ error ในรูปแบบใดก็ได้ → คืนข้อความไทย (async เพราะต้องอ่าน edge function body)
 */
export async function toThaiError(err: unknown): Promise<string> {
  if (err == null) return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  if (typeof err === "string") return translate(err);

  const anyErr = err as any;

  // 1) ลองดึง body ของ edge function ก่อน — ให้ความหมายที่สุด
  const efMsg = await extractEdgeFunctionMessage(anyErr);
  if (efMsg) return translate(efMsg);

  // 2) PostgrestError / AuthError / Error ทั่วไป
  const msg =
    anyErr?.message ||
    anyErr?.error_description ||
    anyErr?.error ||
    anyErr?.hint ||
    anyErr?.details ||
    (() => {
      try { return JSON.stringify(anyErr); } catch { return String(anyErr); }
    })();

  return translate(String(msg));
}

/**
 * เวอร์ชัน sync — สำหรับที่ไม่สามารถ await ได้ (จะไม่พยายามอ่าน response body)
 */
export function toThaiErrorSync(err: unknown): string {
  if (err == null) return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  if (typeof err === "string") return translate(err);
  const anyErr = err as any;
  const msg =
    anyErr?.message ||
    anyErr?.error_description ||
    anyErr?.error ||
    String(anyErr);
  return translate(String(msg));
}
