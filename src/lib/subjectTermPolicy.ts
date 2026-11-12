/** Keep historical catalog rows intact while selecting the requested curriculum term. */
export function subjectBelongsToTerm(subject: { code?: string; grade_level?: string | null; semester?: number | null }, semester: number, academicYear: number): boolean {
  const year = academicYear > 2400 ? academicYear - 543 : academicYear;
  const healthCodes: Record<string, readonly string[]> = {
    "ม.1": ["พ21101", "พ21102"],
    "ม.2": ["พ22101", "พ22102"],
    "ม.3": ["พ23101", "พ23102"],
  };
  const codes = subject.grade_level ? healthCodes[subject.grade_level] : undefined;
  const code = String(subject.code ?? "").replace(/[๐-๙]/g, d => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d))).replace(/\s/g, "");
  if (year === 2026 && codes?.includes(code)) {
    const curriculumSemester = codes.indexOf(code) + 1;
    if (curriculumSemester !== semester) return false;
  }
  return subject.semester == null || Number(subject.semester) === semester;
}