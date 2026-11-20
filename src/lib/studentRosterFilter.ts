/** Presentation scope only; all roster reads remain authorized by the server. */
export function rosterClassroomScope(
  homeroomIds: string[] | null,
  scope: "homeroom" | "school" = "homeroom",
): string[] | null {
  return scope === "school" ? null : homeroomIds;
}

export function exactStudentCode<T extends { student_code: string | null }>(students: T[], value: string): T | null {
  const code = value.trim();
  return code ? students.find(student => student.student_code === code) ?? null : null;
}