/**
 * แปลง error object เป็นข้อความภาษาไทยที่เข้าใจง่าย + คำแนะนำถัดไป
 * รองรับ: FunctionsHttpError (Supabase Edge Function), PostgrestError,
 * AuthError, TypeError (network), Error ทั่วไป และ string
 *
 * ใช้:
 *   import { toThaiError, toThaiErrorDetailed } from "@/lib/errorMessage";
 *   const { reason, hint } = await toThaiErrorDetailed(err);
 */

export type ThaiErrorDetail = {
  /** สาเหตุเป็นภาษาไทย */
  reason: string;
  /** คำแนะนำถัดไป (ควรทำอย่างไร/ต้องตรวจอะไร) */
  hint: string;
  /** ข้อความดิบจากระบบ (ไว้ debug — อาจย่อ) */
  raw?: string;
};

// จับคู่ pattern → { reason, hint }
const PATTERNS: Array<[RegExp, { reason: string; hint: string }]> = [
  // ── Network / connectivity ──
  [/Failed to fetch|NetworkError|network request failed|ERR_NETWORK/i, {
    reason: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้",
    hint: "ตรวจสอบสัญญาณอินเทอร์เน็ต แล้วกดลองใหม่อีกครั้ง หากยังไม่ได้ให้รีเฟรชหน้าเว็บ",
  }],
  [/timeout|timed out|ETIMEDOUT/i, {
    reason: "เซิร์ฟเวอร์ตอบสนองช้าเกินไป (Timeout)",
    hint: "ลองส่งใหม่อีกครั้ง หรือรอสักครู่แล้วลองใหม่ ถ้ายังช้าอยู่ให้แจ้งผู้ดูแลระบบ",
  }],
  [/CORS|Cross-Origin/i, {
    reason: "ระบบปฏิเสธคำขอข้ามโดเมน (CORS)",
    hint: "โปรดแจ้งผู้ดูแลระบบให้ตรวจการตั้งค่า CORS ของ Edge Function",
  }],

  // ── Auth ──
  [/Invalid login credentials|invalid.*password/i, {
    reason: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    hint: "ตรวจสอบการพิมพ์อีกครั้ง (สลับภาษา/Caps Lock) หรือกดลืมรหัสผ่านเพื่อรีเซ็ต",
  }],
  [/Email not confirmed/i, {
    reason: "ยังไม่ได้ยืนยันอีเมล",
    hint: "เปิดกล่องจดหมาย (รวมถึง Spam) และคลิกลิงก์ยืนยัน แล้วกลับมาเข้าสู่ระบบใหม่",
  }],
  [/User already registered|already been registered/i, {
    reason: "อีเมลนี้ถูกใช้ลงทะเบียนแล้ว",
    hint: "เข้าสู่ระบบด้วยอีเมลนี้ หรือใช้อีเมลอื่นในการสมัคร",
  }],
  [/User not found/i, {
    reason: "ไม่พบผู้ใช้ในระบบ",
    hint: "ตรวจสอบอีเมลอีกครั้ง หรือติดต่อผู้ดูแลเพื่อสร้างบัญชี",
  }],
  [/JWT expired|token.*expired/i, {
    reason: "เซสชันหมดอายุ",
    hint: "กรุณาออกจากระบบและเข้าสู่ระบบใหม่",
  }],
  [/refresh_token_not_found|Invalid Refresh Token/i, {
    reason: "เซสชันไม่ถูกต้อง",
    hint: "ล้าง cookie/แคชของเบราว์เซอร์ แล้วเข้าสู่ระบบใหม่",
  }],
  [/Password should be at least/i, {
    reason: "รหัสผ่านสั้นเกินไป",
    hint: "ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร ควรมีตัวเลข/ตัวอักษรพิเศษเพิ่มความปลอดภัย",
  }],
  [/rate limit|too many requests/i, {
    reason: "ทำรายการบ่อยเกินไป",
    hint: "รอประมาณ 1–2 นาที แล้วลองใหม่",
  }],

  // ── Permission / RLS ──
  [/Admin or director access required/i, {
    reason: "ต้องเป็นผู้ดูแลระบบหรือผู้อำนวยการเท่านั้น",
    hint: "เข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์ หรือขอสิทธิ์จากผู้ดูแลระบบ",
  }],
  [/permission denied for (?:table|schema)/i, {
    reason: "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
    hint: "ตรวจสอบว่าล็อกอินอยู่ในบทบาทที่ถูกต้อง หรือขอสิทธิ์เพิ่มจากผู้ดูแล",
  }],
  [/new row violates row-level security|violates row-level security policy/i, {
    reason: "ไม่มีสิทธิ์บันทึกข้อมูลนี้ (ติดกฎ RLS)",
    hint: "ตรวจว่าใส่ผู้เป็นเจ้าของ (user_id/school_id) ถูกต้อง หรือแจ้งผู้ดูแลปรับ policy",
  }],
  [/insufficient_privilege|not authorized|Unauthorized/i, {
    reason: "ไม่มีสิทธิ์ทำรายการนี้",
    hint: "ตรวจการเข้าสู่ระบบ และตรวจว่ามีบทบาทตรงกับที่ระบบต้องการ",
  }],
  [/Forbidden/i, {
    reason: "ระบบปฏิเสธคำขอ (Forbidden)",
    hint: "ตรวจสิทธิ์การเข้าถึง หรือติดต่อผู้ดูแลระบบ",
  }],

  // ── Database ──
  [/duplicate key value|already exists|unique constraint/i, {
    reason: "ข้อมูลนี้มีอยู่ในระบบแล้ว (ซ้ำ)",
    hint: "ตรวจว่ามีรายการเดิมอยู่แล้ว หรือแก้ค่าที่ต้องไม่ซ้ำ เช่น อีเมล/รหัส/ชื่อ",
  }],
  [/violates foreign key constraint/i, {
    reason: "ข้อมูลอ้างอิงไม่ถูกต้อง",
    hint: "รายการที่เชื่อมโยงอาจถูกลบไปแล้ว — เลือกรายการใหม่หรือรีเฟรชหน้าเพื่อโหลดข้อมูลล่าสุด",
  }],
  [/violates not-null constraint|null value in column/i, {
    reason: "กรอกข้อมูลไม่ครบ",
    hint: "ตรวจฟอร์มว่าช่องที่จำเป็น (มีเครื่องหมาย *) ถูกกรอกครบทุกช่อง",
  }],
  [/violates check constraint/i, {
    reason: "ข้อมูลไม่ผ่านการตรวจสอบเงื่อนไข",
    hint: "ตรวจว่าค่าที่กรอกอยู่ในช่วง/รูปแบบที่ระบบยอมรับ",
  }],
  [/invalid input syntax/i, {
    reason: "รูปแบบข้อมูลไม่ถูกต้อง",
    hint: "ตรวจว่าตัวเลข/วันที่/อีเมล อยู่ในรูปแบบที่ถูกต้อง",
  }],
  [/relation .* does not exist|column .* does not exist/i, {
    reason: "โครงสร้างฐานข้อมูลไม่ตรงกับที่ระบบต้องการ",
    hint: "โปรดแจ้งผู้ดูแลให้ตรวจ migration ล่าสุด",
  }],

  // ── HTTP status generic ──
  [/(^|\s)404(\s|$)|Not Found/i, {
    reason: "ไม่พบข้อมูลที่ร้องขอ (404)",
    hint: "รายการอาจถูกลบ หรือ URL ไม่ถูกต้อง — รีเฟรชหรือกลับไปเลือกใหม่",
  }],
  [/(^|\s)500(\s|$)|Internal Server Error/i, {
    reason: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์ (500)",
    hint: "ลองใหม่อีกครั้ง หากยังไม่ได้ ให้แจ้งผู้ดูแลพร้อมเวลาที่เกิดปัญหา",
  }],
  [/(^|\s)502(\s|$)|Bad Gateway/i, {
    reason: "เซิร์ฟเวอร์ตอบผิดพลาด (Bad Gateway 502)",
    hint: "รอสักครู่แล้วลองใหม่ ระบบเบื้องหลังอาจกำลังรีสตาร์ท",
  }],
  [/(^|\s)503(\s|$)|Service Unavailable/i, {
    reason: "บริการไม่พร้อมใช้งานชั่วคราว (503)",
    hint: "รอสักครู่แล้วลองใหม่",
  }],

  // ── File / upload ──
  [/Payload too large|exceeded the maximum allowed size|file.*too large/i, {
    reason: "ไฟล์มีขนาดใหญ่เกินกำหนด",
    hint: "ย่อขนาด/บีบอัดไฟล์ก่อนอัปโหลด หรือแบ่งเป็นหลายไฟล์",
  }],
  [/mime|file type.*not.*allowed/i, {
    reason: "ชนิดไฟล์นี้ไม่รองรับ",
    hint: "แปลงเป็นชนิดไฟล์ที่ระบบยอมรับ (เช่น PDF, JPG, PNG, XLSX)",
  }],

  // ── Edge function generic ──
  [/Edge Function returned a non-2xx status code/i, {
    reason: "ฟังก์ชันฝั่งเซิร์ฟเวอร์ตอบกลับข้อผิดพลาด",
    hint: "ลองใหม่อีกครั้ง หากยังไม่ได้ ให้แจ้งผู้ดูแลพร้อมชื่อเมนู/ขั้นตอนที่กด",
  }],
];

const DEFAULT_DETAIL: { reason: string; hint: string } = {
  reason: "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
  hint: "ลองใหม่อีกครั้ง หากยังไม่ได้ให้รีเฟรชหน้า หรือแจ้งผู้ดูแลระบบพร้อมภาพหน้าจอ",
};

/**
 * พยายามดึงข้อความจริงจาก Supabase Edge Function error
 * FunctionsHttpError.context.response คือ Response object ที่มี body {error: "..."}
 */
async function extractEdgeFunctionMessage(err: any): Promise<string | null> {
  try {
    const res: Response | undefined = err?.context?.response ?? err?.response;
    if (!res || typeof res.text !== "function") return null;
    const cloned = res.clone ? res.clone() : res;
    const text = await cloned.text();
    if (!text) return null;
    try {
      const j = JSON.parse(text);
      return j.error || j.message || j.msg || j.detail || text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return null;
  }
}

function translateDetail(raw: string): { reason: string; hint: string } {
  const s = raw.trim();
  if (!s) return DEFAULT_DETAIL;
  for (const [re, detail] of PATTERNS) {
    if (re.test(s)) return detail;
  }
  if (/^\[?object /i.test(s)) return DEFAULT_DETAIL;
  // ไม่รู้จัก pattern — ใช้ข้อความดิบเป็น reason พร้อม hint ทั่วไป
  return {
    reason: s.length > 240 ? s.slice(0, 240) + "…" : s,
    hint: DEFAULT_DETAIL.hint,
  };
}

/**
 * รับ error ในรูปแบบใดก็ได้ → คืน { reason, hint, raw }
 */
export async function toThaiErrorDetailed(err: unknown): Promise<ThaiErrorDetail> {
  if (err == null) return { ...DEFAULT_DETAIL };
  if (typeof err === "string") {
    return { ...translateDetail(err), raw: err };
  }

  const anyErr = err as any;

  // 1) ลองดึง body ของ edge function ก่อน — ให้ความหมายที่สุด
  const efMsg = await extractEdgeFunctionMessage(anyErr);
  if (efMsg) return { ...translateDetail(efMsg), raw: efMsg };

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

  const raw = String(msg);
  return { ...translateDetail(raw), raw };
}

/** เวอร์ชัน sync — ไม่พยายามอ่าน response body ของ edge function */
export function toThaiErrorDetailedSync(err: unknown): ThaiErrorDetail {
  if (err == null) return { ...DEFAULT_DETAIL };
  if (typeof err === "string") return { ...translateDetail(err), raw: err };
  const anyErr = err as any;
  const msg =
    anyErr?.message ||
    anyErr?.error_description ||
    anyErr?.error ||
    String(anyErr);
  const raw = String(msg);
  return { ...translateDetail(raw), raw };
}

/** ── Backward-compatible: คืนข้อความเดียว (reason + hint รวมกัน) ── */
export async function toThaiError(err: unknown): Promise<string> {
  const d = await toThaiErrorDetailed(err);
  return `${d.reason}\n\n💡 ${d.hint}`;
}

export function toThaiErrorSync(err: unknown): string {
  const d = toThaiErrorDetailedSync(err);
  return `${d.reason}\n\n💡 ${d.hint}`;
}
