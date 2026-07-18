// Thai grade-level sort order + classification band + options list.
// Single source of truth — import from here instead of hardcoding lists.
export const KINDER_GRADES = ["อ.1", "อ.2", "อ.3"] as const;
export const PRIMARY_GRADES = ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"] as const;
export const SECONDARY_GRADES = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"] as const;
export const SPECIAL_GRADES = ["การศึกษาพิเศษ"] as const;

export const ALL_GRADE_LEVELS: string[] = [
  ...KINDER_GRADES,
  ...PRIMARY_GRADES,
  ...SECONDARY_GRADES,
  ...SPECIAL_GRADES,
];

/** Next grade for bulk promotion (อ.1 → อ.2 → อ.3 → ป.1 → ... → ม.6 = ปลายทาง) */
export const GRADE_NEXT: Record<string, string> = {
  "อ.1": "อ.2", "อ.2": "อ.3", "อ.3": "ป.1",
  "ป.1": "ป.2", "ป.2": "ป.3", "ป.3": "ป.4",
  "ป.4": "ป.5", "ป.5": "ป.6", "ป.6": "ม.1",
  "ม.1": "ม.2", "ม.2": "ม.3", "ม.3": "ม.4",
  "ม.4": "ม.5", "ม.5": "ม.6",
};

const ORDER = ALL_GRADE_LEVELS;

export const gradeRank = (g?: string | null): number => {
  if (!g) return 999;
  const i = ORDER.indexOf(g);
  return i === -1 ? 998 : i;
};

export const sortGrades = <T extends string>(grades: T[]): T[] =>
  [...grades].sort((a, b) => gradeRank(a) - gradeRank(b));

// ============ Band classification (ช่วงชั้นตามวัย) ============
export type GradeBand = "kinder" | "primary_early" | "primary_late" | "secondary_lower" | "secondary_upper" | "unknown";

export const BAND_LABEL: Record<GradeBand, string> = {
  kinder: "อนุบาล",
  primary_early: "ประถมต้น (ป.1-3)",
  primary_late: "ประถมปลาย (ป.4-6)",
  secondary_lower: "มัธยมต้น (ม.1-3)",
  secondary_upper: "มัธยมปลาย (ม.4-6)",
  unknown: "ไม่ระบุ",
};

export function gradeToBand(grade?: string | null): GradeBand {
  if (!grade) return "unknown";
  if (grade.startsWith("อ.")) return "kinder";
  if (["ป.1", "ป.2", "ป.3"].includes(grade)) return "primary_early";
  if (["ป.4", "ป.5", "ป.6"].includes(grade)) return "primary_late";
  if (["ม.1", "ม.2", "ม.3"].includes(grade)) return "secondary_lower";
  if (["ม.4", "ม.5", "ม.6"].includes(grade)) return "secondary_upper";
  return "unknown";
}

/** เดาอายุคร่าว ๆ จากระดับชั้น (อนุบาล 3 → 5 ขวบ, ป.1 → 7, ...) */
export function gradeToApproxAge(grade?: string | null): number | null {
  if (!grade) return null;
  const map: Record<string, number> = {
    "อ.1": 3, "อ.2": 4, "อ.3": 5,
    "ป.1": 7, "ป.2": 8, "ป.3": 9, "ป.4": 10, "ป.5": 11, "ป.6": 12,
    "ม.1": 13, "ม.2": 14, "ม.3": 15, "ม.4": 16, "ม.5": 17, "ม.6": 18,
  };
  return map[grade] ?? null;
}

export function gradeInRange(grade: string | null | undefined, minRank?: number | null, maxRank?: number | null) {
  if (minRank == null && maxRank == null) return true;
  const r = gradeRank(grade || undefined);
  if (r === 999 || r === 998) return true; // unknown → allow
  if (minRank != null && r < minRank) return false;
  if (maxRank != null && r > maxRank) return false;
  return true;
}

export const GRADE_OPTIONS = ALL_GRADE_LEVELS.map((g) => ({ value: g, rank: gradeRank(g), label: g }));
