export type LessonStatus = "present" | "absent" | "late" | "sick" | "leave";
export interface LessonRow { student_id: string | null; subject_id: string | null; period?: number; status: string | null; }

// Lesson teachers teach outside their homeroom. Staff reads use database access
// controls, while family reads are additionally restricted to their own students.
export function lessonReadStudentIds(isParent: boolean, isStudent: boolean, childIds: string[], selfStudentId?: string): string[] | null {
  if (isParent) return childIds;
  if (isStudent) return selfStudentId ? [selfStudentId] : [];
  return null;
}

export function lessonStatusMap(rows: LessonRow[], subjectId: string, period: number): Record<string, LessonStatus> {
  const map: Record<string, LessonStatus> = {};
  for (const row of rows) {
    if (!row.student_id || row.subject_id !== subjectId || row.period !== period) continue;
    if (["present", "absent", "late", "sick", "leave"].includes(row.status || "")) map[row.student_id] = row.status as LessonStatus;
  }
  return map;
}

export function countLessonStatuses(rows: LessonRow[]) {
  const counts = { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 };
  for (const row of rows) {
    if (!row.subject_id || !Object.prototype.hasOwnProperty.call(counts, row.status || "") || row.status === "total") continue;
    counts[row.status as LessonStatus]++;
    counts.total++;
  }
  return counts;
}