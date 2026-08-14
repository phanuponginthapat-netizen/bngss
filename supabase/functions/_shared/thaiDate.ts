
// Shared Thai date / Buddhist Era helpers for edge functions.
// Single source of truth — do not re-implement `+543` / `-543` inline.

/** CE year → BE year (idempotent: values > 2400 are already BE). */
export const toBE = (y: number): number => (y > 2400 ? y : y + 543);

/** BE year → CE year (idempotent: values ≤ 2400 are already CE). */
export const toCE = (y: number): number => (y > 2400 ? y - 543 : y);

/** Format a Date using Bangkok timezone + Thai locale. */
export function formatThaiDate(d: Date, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" }): string {
  return d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...opts });
}

/** "ภาคเรียนที่ N/BE" label — semester 1 = May–Sep, semester 2 = Oct–Apr. */
export function semesterLabel(d: Date = new Date()): string {
  const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "numeric" }).format(d));
  const yearCE = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(d));
  const sem = month >= 5 && month <= 9 ? 1 : 2;
  // Sem 2 (Oct–Apr) belongs to the academic year that started in May.
  const acadCE = sem === 2 && month < 5 ? yearCE - 1 : yearCE;
  return `ภาคเรียนที่ ${sem}/${toBE(acadCE)}`;
}

/** Today's date in Bangkok timezone as ISO YYYY-MM-DD. */
export function todayBangkokISO(): string {
  return bkkDateISO(new Date());
}

/** Any Date → ISO YYYY-MM-DD in Bangkok timezone (safe replacement for `bkkDateISO(d)`). */
export function bkkDateISO(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Shift `days` from base (default now) then return ISO YYYY-MM-DD in Bangkok tz. */
export function addDaysBkkISO(days: number, base: Date = new Date()): string {
  return bkkDateISO(new Date(base.getTime() + days * 86400000));
}

/** "12 พฤษภาคม 2569" — long Thai date with Buddhist year, Bangkok tz, consistent across Deno/Node/Browser. */
export function formatThaiLong(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric",
  }).format(d);
}

/** "12 พ.ค. 2569" */
export function formatThaiShort(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
  }).format(d);
}


/* ---------- เวลา 24 ชม. (Asia/Bangkok) — ห้ามใช้ AM/PM ทั้งระบบ ---------- */

const _bkkParts = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});

/** "HH:mm" (24 ชม. เวลาไทย) */
export function fmtTime24(input: Date | string | number, withSeconds = false): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  const p = _bkkParts(d);
  return withSeconds ? `${p.hour}:${p.minute}:${p.second}` : `${p.hour}:${p.minute}`;
}

/** "dd/MM/yyyy HH:mm" (ค.ศ., เวลาไทย) */
export function fmtDateTime24(input: Date | string | number, withSeconds = false): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  const p = _bkkParts(d);
  return `${p.day}/${p.month}/${p.year} ${fmtTime24(d, withSeconds)}`;
}

/** "12 พ.ค. 2569 08:30 น." */
export function fmtThaiDateTime24(input: Date | string | number, withSeconds = false): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return `${formatThaiShort(d)} ${fmtTime24(d, withSeconds)} น.`;
}

/** แปลงข้อความเวลาที่นำเข้า (รองรับ 1:05 PM / 13.05 / 13:05 น.) → "HH:mm[:ss]" */
export function toTime24(input?: string | null, withSeconds = true): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/\s+/g, " ");
  const m = s.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm|น\.?)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const se = Number(m[3] || 0);
  if (m[4] === "pm" && h < 12) h += 12;
  if (m[4] === "am" && h === 12) h = 0;
  if (h > 23 || mi > 59 || se > 59) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return withSeconds ? `${pad(h)}:${pad(mi)}:${pad(se)}` : `${pad(h)}:${pad(mi)}`;
}
