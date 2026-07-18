import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert CE year to Buddhist Era (พ.ศ.) */
export const toBE = (ceYear: number | null | undefined): number | string => {
  if (ceYear == null) return "-";
  return ceYear + 543;
};

/** Convert Buddhist Era (พ.ศ.) to CE year for DB storage */
export const toCE = (beYear: number): number => beYear - 543;

/** Get current year in Buddhist Era */
export const currentBEYear = (): number => new Date().getFullYear() + 543;

/** Get current BE year as string */
export const currentBEYearStr = (): string => String(currentBEYear());
