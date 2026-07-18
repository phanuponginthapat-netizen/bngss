// Thai grade-level sort order: อนุบาล → ประถม → มัธยม
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

