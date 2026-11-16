import { calculateGPA } from "./gradeUtils";

type Score = { student_code: string; subject_id: string; grade_point: number | null };
type Student = { id: string; student_code: string };
type Subject = { id: string; credits: number | null };

/** One actual student per term, using the same credit-weighted GPA as academic reports. */
export function probationResults(scores: Score[], students: Student[], subjects: Subject[]) {
  const credits = new Map(subjects.map(s => [s.id, s.credits]));
  const groups = new Map<string, { gradePoint: number; credits: number }[]>();
  for (const score of scores) {
    const credit = credits.get(score.subject_id);
    if (score.grade_point === null || !Number.isFinite(score.grade_point)) continue;
    if (credit === undefined || credit === null) throw new Error("อ่านหน่วยกิตรายวิชาไม่ครบ จึงยังยืนยันผลเฉลี่ยไม่ได้");
    if (!Number.isFinite(credit) || credit <= 0) continue;
    const rows = groups.get(score.student_code) || [];
    rows.push({ gradePoint: score.grade_point, credits: credit });
    groups.set(score.student_code, rows);
  }
  return students.flatMap(student => {
    const rows = groups.get(student.student_code);
    return rows?.length ? [{ student_id: student.id, student_code: student.student_code, gpax: calculateGPA(rows) }] : [];
  });
}