/**
 * Resolve current Thai academic year (พ.ศ.) + semester from any date,
 * using semester config (defaults: AY May, sem2 = Nov–Apr wrap).
 */
export interface SemesterCfg {
  semester1StartMonth: number;
  semester1EndMonth: number;
  semester2StartMonth: number;
  semester2EndMonth: number;
  academicYearStartMonth: number;
}

export const DEFAULT_SEMESTER_CFG: SemesterCfg = {
  semester1StartMonth: 5,
  semester1EndMonth: 10,
  semester2StartMonth: 11,
  semester2EndMonth: 4,
  academicYearStartMonth: 5,
};

/** Returns { academicYearBE, semester } for a given date. */
export function resolveAcademicTerm(
  date: string | Date | null | undefined,
  cfg: SemesterCfg = DEFAULT_SEMESTER_CFG,
): { academicYearBE: number; semester: 1 | 2 } {
  const d = date ? new Date(date) : new Date();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const ceYear = month >= cfg.academicYearStartMonth ? year : year - 1;
  const academicYearBE = ceYear + 543;

  let semester: 1 | 2 = 1;
  if (cfg.semester2StartMonth > cfg.semester2EndMonth) {
    if (month >= cfg.semester2StartMonth || month <= cfg.semester2EndMonth) semester = 2;
  } else if (month >= cfg.semester2StartMonth && month <= cfg.semester2EndMonth) {
    semester = 2;
  }
  return { academicYearBE, semester };
}

/** Quick check: does a record's date fall in target academicYearBE + semester? */
export function dateMatchesTerm(
  recordDate: string | Date | null | undefined,
  targetYearBE: number,
  targetSemester: 0 | 1 | 2,
  cfg: SemesterCfg = DEFAULT_SEMESTER_CFG,
): boolean {
  if (!recordDate) return false;
  const r = resolveAcademicTerm(recordDate, cfg);
  if (r.academicYearBE !== targetYearBE) return false;
  if (targetSemester === 0) return true;
  return r.semester === targetSemester;
}
