/** Keys consumed by both homework formats, including open grading views. */
export function homeworkRealtimeKeys(table: string): string[][] {
  switch (table) {
    case "task_assignments":
      return [["homework-list"], ["teacher-tasks"], ["student-tasks"]];
    case "homework_assignments":
      return [["hw-assignments"], ["homework_assignments"], ["homework-list"], ["subject_score_columns"], ["student_column_scores"]];
    case "homework_submissions":
      return [["hw-submissions"], ["homework_submissions"], ["student_column_scores"]];
    default:
      return [];
  }
}