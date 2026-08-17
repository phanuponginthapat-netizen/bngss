/**
 * แปลง error จากฐานข้อมูล/Edge Function เป็นข้อความภาษาไทยที่ผู้ใช้เข้าใจได้
 * ใช้คู่กับ toast.error(saveErrorMessage(error))
 */
export function saveErrorMessage(err: any, fallback = "บันทึกไม่สำเร็จ"): string {
  const m = String(
    typeof err === "string" ? err : err?.message || err?.error_description || err?.error || ""
  );
  if (!m) return fallback;

  // สิทธิ์ / RLS
  if (/row-level security|violates row-level|permission denied|not authorized|insufficient_privilege/i.test(m))
    return "คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบ";
  if (/jwt|invalid token|session|refresh_token_not_found/i.test(m))
    return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";

  // ข้อมูลซ้ำ
  if (/duplicate key|already exists|unique constraint/i.test(m)) {
    if (/serial/i.test(m)) return "หมายเลขเครื่อง (S/N) นี้ถูกใช้แล้ว";
    if (/email/i.test(m)) return "อีเมลนี้ถูกใช้แล้ว";
    if (/code/i.test(m)) return "รหัสนี้ถูกใช้แล้วในระบบ";
    return "ข้อมูลซ้ำกับรายการที่มีอยู่แล้ว";
  }

  // ข้อมูลไม่ครบ / รูปแบบผิด
  if (/null value in column "([^"]+)"/i.test(m)) {
    const col = m.match(/null value in column "([^"]+)"/i)?.[1];
    return `กรุณากรอกข้อมูลให้ครบ (ฟิลด์: ${col})`;
  }
  if (/invalid input syntax for type (numeric|integer|double)/i.test(m))
    return "รูปแบบตัวเลขไม่ถูกต้อง กรุณาตรวจสอบช่องตัวเลข";
  if (/invalid input syntax for type (date|timestamp)/i.test(m))
    return "รูปแบบวันที่ไม่ถูกต้อง กรุณาเลือกวันที่ใหม่";
  if (/invalid input syntax for type uuid/i.test(m))
    return "ยังไม่ได้เลือกรายการที่เกี่ยวข้อง กรุณาเลือกก่อนบันทึก";
  if (/NaN|out of range/i.test(m)) return "ค่าตัวเลขไม่ถูกต้องหรือเกินขอบเขต";

  // ความสัมพันธ์ข้อมูล
  if (/foreign key|violates foreign key constraint/i.test(m))
    return "ข้อมูลอ้างอิงไม่ถูกต้อง หรือมีรายการอื่นเชื่อมโยงอยู่ ไม่สามารถลบ/บันทึกได้";
  if (/check constraint/i.test(m)) return "ข้อมูลไม่ผ่านเงื่อนไขที่ระบบกำหนด กรุณาตรวจสอบอีกครั้ง";

  // เครือข่าย / ระบบ
  if (/Failed to fetch|NetworkError|network request failed/i.test(m))
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
  if (/timeout|timed out|statement timeout/i.test(m))
    return "ระบบใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง";
  if (/payload too large|exceeded the maximum allowed size/i.test(m))
    return "ไฟล์มีขนาดใหญ่เกินกำหนด";
  if (/schema cache|could not find the .* column/i.test(m))
    return "ระบบยังไม่รู้จักฟิลด์นี้ กรุณารีเฟรชหน้าจอหรือแจ้งผู้ดูแลระบบ";

  return m;
}

/** แปลงข้อความเป็นตัวเลขอย่างปลอดภัย (ว่าง/NaN → ค่า fallback) */
export function safeNum(v: any, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** แปลงเป็นจำนวนเต็มอย่างปลอดภัย */
export function safeInt(v: any, fallback = 0): number {
  return Math.trunc(safeNum(v, fallback));
}

/** ค่าว่าง → null (กัน error วันที่/uuid ว่าง) */
export function nullIfEmpty<T>(v: T): T | null {
  if (v === "" || v === undefined) return null;
  return v as T;
}
