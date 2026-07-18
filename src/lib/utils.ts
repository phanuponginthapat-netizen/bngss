import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BE_OFFSET, BKK_TZ } from "@/lib/dateBE";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert CE year to Buddhist Era (พ.ศ.). Idempotent: ปีที่เกิน 2400 ถือเป็น พ.ศ. อยู่แล้ว ไม่บวกซ้ำ */
export const toBE = (ceYear: number | null | undefined): number | string => {
  if (ceYear == null) return "-";
  if (ceYear > 2400) return ceYear; // already BE — guard against double conversion (e.g. 2569 → 3112)
  return ceYear + BE_OFFSET;
};

/** Convert Buddhist Era (พ.ศ.) to CE year for DB storage. Idempotent: ปี <= 2400 ถือว่าเป็น ค.ศ. อยู่แล้ว */
export const toCE = (beYear: number | null | undefined): number => {
  if (beYear == null) return new Date().getFullYear();
  if (beYear <= 2400) return beYear; // already CE
  return beYear - BE_OFFSET;
};

/** Get current year in Buddhist Era (อิงเขตเวลาไทย) */
export const currentBEYear = (): number => {
  const y = Number(new Intl.DateTimeFormat("en-CA", { timeZone: BKK_TZ, year: "numeric" }).format(new Date()));
  return y + BE_OFFSET;
};

/** Get current BE year as string */
export const currentBEYearStr = (): string => String(currentBEYear());

