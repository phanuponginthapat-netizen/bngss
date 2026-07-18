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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
