/** Keep historical catalog rows intact while selecting the requested curriculum term. */
export function subjectBelongsToTerm(subject: { code?: string; grade_level?: string | null; semester?: number | null }, semester: number, academicYear: number): boolean {
  return subject.semester == null || Number(subject.semester) === semester;
}