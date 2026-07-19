import { todayBangkok, bkkDateISO } from "@/lib/dateBE";
// Buddhist Era (พ.ศ.) date helpers — DD/MM/YYYY format
// Internal storage stays ISO (YYYY-MM-DD, ค.ศ.). UI shows / parses พ.ศ.
//
// ⚠️ ระบบล็อก timezone = Asia/Bangkok (UTC+7) เสมอ
// ห้ามใช้ new Date toISOString slice(0,10) ในจุดที่บันทึก/อ้างอิงวันที่ทางธุรกิจ
// ให้ใช้ todayBangkok() / nowBangkokISO() แทน มิฉะนั้นช่วงเที่ยงคืน-7 โมงเช้า
// (ที่ UTC ยังเป็นเมื่อวาน) จะคำนวณวันที่ผิด
export const BKK_TZ = "Asia/Bangkok";

export const BE_OFFSET = 543;

/** วันที่วันนี้ในเขตเวลาไทย — รูปแบบ ISO YYYY-MM-DD (ค.ศ.) ใช้บันทึกลง DB */
export function todayBangkok(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** เวลาปัจจุบันเป็น ISO string พร้อม offset +07:00 (ใช้บันทึก timestamp ที่ต้องอ้างเวลาไทย) */
export function nowBangkokISO(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BKK_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+07:00`;
}

/** เวลาปัจจุบันในเขตเวลาไทย รูปแบบ HH:MM:SS */
export function nowBangkokTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BKK_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date());
}

/** แยกชิ้นส่วน Y/M/D/H/M/S ของ Date ใดๆ ในเขตเวลาไทย */
export function getBangkokParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BKK_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get("year"), month: get("month"), day: get("day"),
    hour: get("hour"), minute: get("minute"), second: get("second"),
  };
}

/** Parse "DD/MM/YYYY" (พ.ศ. or ค.ศ.) or ISO into a Date in UTC. */
export function parseDateBE(input?: string | null): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  // ISO YYYY-MM-DD (already ค.ศ.)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = +dmy[1];
    const month = +dmy[2];
    let year = +dmy[3];
    if (year < 100) year += 2500; // assume พ.ศ. shorthand
    if (year > 2400) year -= BE_OFFSET; // convert พ.ศ. → ค.ศ.
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    return d;
  }
  return null;
}

/** Format a Date / ISO string as "DD/MM/YYYY" with Buddhist year. */
export function formatDateBE(input?: string | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : parseDateBE(input);
  if (!d || isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear() + BE_OFFSET;
  return `${day}/${month}/${year}`;
}

/** Format with month name in Thai: "12 พฤษภาคม 2569". */
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export function formatDateLongBE(input?: string | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : parseDateBE(input);
  if (!d || isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + BE_OFFSET}`;
}

/** Format Date → ISO YYYY-MM-DD (for storage / DB). */
export function toISODate(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convert ISO YYYY-MM-DD → DD/MM/YYYY พ.ศ. for input display. */
export const isoToBE = (iso?: string | null) => formatDateBE(iso);
/** Convert DD/MM/YYYY พ.ศ. → ISO YYYY-MM-DD for storage. */
export const beToISO = (be?: string | null) => toISODate(parseDateBE(be));

/** Format a Date/ISO/timestamp as 24-hour "HH:MM:SS" — อิง Asia/Bangkok เสมอ */
export function formatTime24(input?: string | Date | number | null): string {
  if (input == null || input === "") return "-";
  const d = input instanceof Date ? input : new Date(input as any);
  if (!d || isNaN(d.getTime())) return "-";
  const { hour, minute, second } = getBangkokParts(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hour)}:${p(minute)}:${p(second)}`;
}

/** Format a datetime (created_at etc.) → "DD/MM/YYYY HH:MM:SS" พ.ศ. — อิง Asia/Bangkok เสมอ */
export function formatDateTimeBE(input?: string | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(String(input));
  if (!d || isNaN(d.getTime())) return "";
  const { year, month, day, hour, minute, second } = getBangkokParts(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(day)}/${p(month)}/${year + BE_OFFSET} ${p(hour)}:${p(minute)}:${p(second)}`;
}

/**
 * แปลง Date → ISO YYYY-MM-DD ในเขตเวลาไทย (แทนการเรียก `.toISOString().slice(0,10)` ที่คลาดเคลื่อน)
 * ถ้าไม่ส่ง d จะได้ค่าเท่ากับ todayBangkok()
 */
export function bkkDateISO(d: Date = new Date()): string {
  const { year, month, day } = getBangkokParts(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}`;
}

/** เพิ่ม/ลดจำนวนวันแล้วคืน ISO YYYY-MM-DD ในเขตเวลาไทย */
export function addDaysBkkISO(days: number, base: Date = new Date()): string {
  const d = new Date(base.getTime() + days * 86400000);
  return bkkDateISO(d);
}

/**
 * รูปแบบภาษาไทยแบบยาว "12 พฤษภาคม 2569" — บังคับ Bangkok TZ + ปฏิทินพุทธ
 * ใช้ Intl (buddhist calendar) เพื่อให้ผลลัพธ์ตรงกันในทุกเบราว์เซอร์/Deno
 */
export function formatThaiLong(input?: string | Date | number | null): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : (typeof input === "string" ? (parseDateBE(input) ?? new Date(input)) : new Date(input));
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: BKK_TZ, day: "numeric", month: "long", year: "numeric",
  }).format(d);
}

/** "12 พ.ค. 2569" (สั้น) */
export function formatThaiShort(input?: string | Date | number | null): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : (typeof input === "string" ? (parseDateBE(input) ?? new Date(input)) : new Date(input));
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: BKK_TZ, day: "numeric", month: "short", year: "numeric",
  }).format(d);
}

/** วันที่+เวลาแบบไทยยาว "12 พฤษภาคม 2569 08:30" */
export function formatThaiLongTime(input?: string | Date | number | null): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : new Date(input as any);
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: BKK_TZ, day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}
