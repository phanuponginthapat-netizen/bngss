/**
 * บังคับให้ "ทุกส่วน" ของระบบแสดง/บันทึกเวลาเป็นรูปแบบ 24 ชั่วโมง
 * และอิงเขตเวลา Asia/Bangkok เสมอ (ห้ามมี AM/PM)
 *
 * ไฟล์นี้ patch Intl.DateTimeFormat และ Date.prototype.toLocale*String
 * ตั้งแต่ก่อน React mount จึงครอบคลุมทุกโมดูล/ทุกไลบรารีที่ใช้ API มาตรฐาน
 */
export const BKK = "Asia/Bangkok";

type DTFOptions = Intl.DateTimeFormatOptions | undefined;

function hasTime(o: Intl.DateTimeFormatOptions) {
  return (
    o.hour !== undefined ||
    o.minute !== undefined ||
    o.second !== undefined ||
    o.timeStyle !== undefined ||
    (o as { fractionalSecondDigits?: number }).fractionalSecondDigits !== undefined
  );
}

/** เติม timeZone = Asia/Bangkok และบังคับ 24 ชม. */
export function force24(options: DTFOptions): Intl.DateTimeFormatOptions {
  const o: Intl.DateTimeFormatOptions = { ...(options || {}) };
  if (!o.timeZone) o.timeZone = BKK;
  const timeRequested = hasTime(o) || !options; // ไม่ระบุ options = แสดงทั้งวันที่+เวลา
  if (timeRequested) {
    o.hour12 = false;
    (o as { hourCycle?: string }).hourCycle = "h23";
  }
  return o;
}

let installed = false;

export function installTime24() {
  if (installed || typeof Intl === "undefined") return;
  installed = true;

  const OriginalDTF = Intl.DateTimeFormat;

  const PatchedDTF = function (this: unknown, locales?: Intl.LocalesArgument, options?: DTFOptions) {
    const opts = force24(options);
    // new Intl.DateTimeFormat(...) และ Intl.DateTimeFormat(...) ต้องได้ผลเหมือนกัน
    return new (OriginalDTF as unknown as new (
      l?: Intl.LocalesArgument,
      o?: Intl.DateTimeFormatOptions,
    ) => Intl.DateTimeFormat)(locales, opts);
  } as unknown as typeof Intl.DateTimeFormat;

  PatchedDTF.prototype = OriginalDTF.prototype;
  PatchedDTF.supportedLocalesOf = OriginalDTF.supportedLocalesOf.bind(OriginalDTF);

  Intl.DateTimeFormat = PatchedDTF;

  const dp = Date.prototype;
  const origToLocaleString = dp.toLocaleString;
  const origToLocaleTimeString = dp.toLocaleTimeString;
  const origToLocaleDateString = dp.toLocaleDateString;

  dp.toLocaleString = function (locales?: Intl.LocalesArgument, options?: DTFOptions) {
    return origToLocaleString.call(this, locales as never, force24(options) as never);
  };
  dp.toLocaleTimeString = function (locales?: Intl.LocalesArgument, options?: DTFOptions) {
    const o = force24(options);
    o.hour12 = false;
    (o as { hourCycle?: string }).hourCycle = "h23";
    return origToLocaleTimeString.call(this, locales as never, o as never);
  };
  dp.toLocaleDateString = function (locales?: Intl.LocalesArgument, options?: DTFOptions) {
    const o: Intl.DateTimeFormatOptions = { ...(options || {}) };
    if (!o.timeZone) o.timeZone = BKK;
    return origToLocaleDateString.call(this, locales as never, o as never);
  };
}

/* ---------- helper สำหรับใช้งานทั่วระบบ ---------- */

const p = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: BKK,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});

const toDate = (v: Date | string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/** HH:mm (24 ชม. เวลาไทย) */
export function fmtTime24(v: Date | string | number | null | undefined, withSeconds = false) {
  const d = toDate(v);
  if (!d) return "";
  const x = p(d);
  return withSeconds ? `${x.hour}:${x.minute}:${x.second}` : `${x.hour}:${x.minute}`;
}

/** dd/MM/yyyy HH:mm (ค.ศ., เวลาไทย) */
export function fmtDateTime24(v: Date | string | number | null | undefined, withSeconds = false) {
  const d = toDate(v);
  if (!d) return "";
  const x = p(d);
  return `${x.day}/${x.month}/${x.year} ${fmtTime24(d, withSeconds)}`;
}

/** dd/MM/พ.ศ. HH:mm น. */
export function fmtDateTimeBE(v: Date | string | number | null | undefined, withSeconds = false) {
  const d = toDate(v);
  if (!d) return "";
  const x = p(d);
  return `${x.day}/${x.month}/${Number(x.year) + 543} ${fmtTime24(d, withSeconds)} น.`;
}

/** normalize ค่าเวลาที่ผู้ใช้/ไฟล์นำเข้าให้เป็น HH:mm:ss 24 ชม. (รองรับ 1:05 PM) */
export function toTime24(input?: string | null, withSeconds = true): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/\s+/g, " ");
  const m = s.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm|น\.?)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const se = Number(m[3] || 0);
  const mer = m[4];
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  if (h > 23 || mi > 59 || se > 59) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return withSeconds ? `${pad(h)}:${pad(mi)}:${pad(se)}` : `${pad(h)}:${pad(mi)}`;
}
