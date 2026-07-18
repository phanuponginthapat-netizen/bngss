/**
 * Monkey-patch Date.prototype methods เพื่อให้ทุกที่ที่ใช้
 * toLocaleDateString / toLocaleTimeString / toLocaleString
 * แสดงผลแบบไทย: พ.ศ. + 24 ชม. + เขตเวลา Asia/Bangkok
 *
 * Import ครั้งเดียวใน src/main.tsx — มีผลทั้งระบบ
 */
import { BE_OFFSET, BKK_TZ, getBangkokParts } from "./dateBE";

const p2 = (n: number) => String(n).padStart(2, "0");

function formatBEDate(d: Date): string {
  const { year, month, day } = getBangkokParts(d);
  return `${p2(day)}/${p2(month)}/${year + BE_OFFSET}`;
}

function format24Time(d: Date, withSeconds = true): string {
  const { hour, minute, second } = getBangkokParts(d);
  return withSeconds
    ? `${p2(hour)}:${p2(minute)}:${p2(second)}`
    : `${p2(hour)}:${p2(minute)}`;
}

// เก็บ original ไว้ใช้ใน format ที่ส่ง options เฉพาะทาง (เช่น weekday/month name)
const origDateStr = Date.prototype.toLocaleDateString;
const origTimeStr = Date.prototype.toLocaleTimeString;
const origStr = Date.prototype.toLocaleString;

Date.prototype.toLocaleDateString = function (
  locale?: any,
  options?: Intl.DateTimeFormatOptions,
) {
  if (isNaN(this.getTime())) return "";
  // ถ้ามี options ที่ขอชื่อเดือน/วัน → ใช้ original (forcing Bangkok TZ) แต่บวก 543 ให้ year
  if (
    options &&
    (options.weekday || options.month === "long" || options.month === "short" || options.era)
  ) {
    const opts: Intl.DateTimeFormatOptions = { timeZone: BKK_TZ, ...options };
    const loc = locale ?? "th-TH-u-ca-buddhist";
    try {
      return origDateStr.call(this, loc, opts);
    } catch {
      // fall through
    }
  }
  return formatBEDate(this as Date);
};

Date.prototype.toLocaleTimeString = function (
  locale?: any,
  options?: Intl.DateTimeFormatOptions,
) {
  if (isNaN(this.getTime())) return "";
  const withSeconds = options?.second !== undefined ? options.second !== undefined : true;
  // ถ้าผู้เรียกขอแค่ HH:MM
  if (options && options.hour && options.minute && options.second === undefined) {
    return format24Time(this as Date, false);
  }
  return format24Time(this as Date, withSeconds);
};

Date.prototype.toLocaleString = function (
  locale?: any,
  options?: Intl.DateTimeFormatOptions,
) {
  if (isNaN(this.getTime())) return "";
  if (
    options &&
    (options.weekday || options.month === "long" || options.month === "short" || options.era)
  ) {
    const opts: Intl.DateTimeFormatOptions = { timeZone: BKK_TZ, hour12: false, ...options };
    const loc = locale ?? "th-TH-u-ca-buddhist";
    try {
      return origStr.call(this, loc, opts);
    } catch {
      // fall through
    }
  }
  // ถ้าผู้เรียกขอเฉพาะ date หรือเฉพาะ time
  if (options && options.hour && !options.day && !options.year) {
    return format24Time(this as Date, options.second !== undefined);
  }
  if (options && options.day && !options.hour) {
    return formatBEDate(this as Date);
  }
  return `${formatBEDate(this as Date)} ${format24Time(this as Date, true)}`;
};

export {};
