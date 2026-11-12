/** Keep historical catalog rows intact while selecting the requested curriculum term. */
export function subjectBelongsToTerm(subject: { code?: string; grade_level?: string | null; semester?: number | null }, semester: number, academicYear: number): boolean {
  const year = academicYear > 2400 ? academicYear - 543 : academicYear;
  const grade = subject.grade_level;
  const code = String(subject.code ?? "").replace(/[๐-๙]/g, d => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d))).replace(/\s/g, "");
  if (year === 2026 && grade && /^ม\.[123]$/.test(grade)) {
    const level = Number(grade.slice(2));
    const base = `2${level}`;
    const first = new Set([
      `ท${base}101`, `ค${base}101`, `ว${base}101`, `ว${base}103`,
      `ส${base}101`, `ส${base}102`, `พ${base}101`, `ศ${base}101`, `ง${base}101`, `อ${base}101`, `อ${base}201`,
      `ส${base}2${level === 1 ? "37" : level === 2 ? "39" : "41"}`,
      `ศ${base}2${level === 1 ? "01" : level === 2 ? "03" : "05"}`,
      ...(level === 1 ? ["ว21201", "ว21203", "ง21201"] : [`ว${base}201`, `ว${base}203`]),
    ]);
    const second = new Set([
      `ท${base}102`, `ค${base}102`, `ว${base}102`, `ว${base}104`,
      `ส${base}103`, `ส${base}104`, `พ${base}102`, `ศ${base}102`, `ง${base}102`, `อ${base}102`, `อ${base}202`,
      `ส${base}2${level === 1 ? "38" : level === 2 ? "40" : "42"}`,
      `ศ${base}2${level === 1 ? "02" : level === 2 ? "04" : "06"}`,
      ...(level === 1 ? ["ว21204", "ง21202"] : [`ว${base}202`, `ว${base}204`]),
    ]);
    if ((first.has(code) && semester !== 1) || (second.has(code) && semester !== 2)) return false;
  }
  return subject.semester == null || Number(subject.semester) === semester;
}