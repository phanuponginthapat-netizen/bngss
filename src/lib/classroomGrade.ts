// Returns the effective grade level for a classroom.
// Special-needs classrooms (grade_level = "การศึกษาพิเศษ") can set
// `reference_grade_level` (e.g. "ม.3") so the students keep being counted
// under their actual grade for records and reports, while remaining in
// their special classroom.
export function effectiveGrade(c?: { grade_level?: string | null; reference_grade_level?: string | null } | null): string {
  if (!c) return "";
  return (c.reference_grade_level || c.grade_level || "") as string;
}
