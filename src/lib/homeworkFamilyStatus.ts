export type FamilyHomeworkFilter = "all" | "not_submitted" | "submitted" | "graded" | "needs_revision";
export type FamilySubmission = { status?: string; grade?: number | null; score?: number | null; final_score?: number | null };

export function familyHomeworkStatus(submission?: FamilySubmission | null) {
  if (submission?.status === "graded") return "graded";
  if (submission?.status === "needs_revision") return "needs_revision";
  if (submission?.status === "submitted") return "submitted";
  return "not_submitted";
}

export function familyHomeworkScore(submission?: FamilySubmission | null): number | null {
  if (familyHomeworkStatus(submission) !== "graded") return null;
  return submission?.final_score ?? submission?.score ?? submission?.grade ?? null;
}

export function matchesFamilyHomework(filter: FamilyHomeworkFilter, submission?: FamilySubmission | null) {
  return filter === "all" || familyHomeworkStatus(submission) === filter;
}

export const familyHomeworkLabels = {
  not_submitted: "ยังไม่ส่ง", submitted: "ส่งแล้ว · รอตรวจ", graded: "ตรวจแล้ว", needs_revision: "ส่งแล้ว · ครูให้แก้ไข",
};