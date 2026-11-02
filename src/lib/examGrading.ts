// ตรวจคำตอบจากกระดาษ (แบบ ZipGrade) — เฉลยเก็บเป็น A-D เสมอ, คำตอบจาก OCR ถูกแปลงเป็น A-D แล้ว
export const CANONICAL_CHOICES = ["A", "B", "C", "D"] as const;

export interface AnswerKeyRow { question_no: number; correct_answer: string | null }

export interface GradeResult {
  score: number;
  total: number;
  percentage: number;
  blank: number;
  correctMap: Record<string, boolean>;
}

const norm = (v: unknown) => {
  const s = String(v ?? "").trim().toUpperCase();
  return (CANONICAL_CHOICES as readonly string[]).includes(s) ? s : null;
};

export function gradeAnswers(key: AnswerKeyRow[], answers: Record<string, string | null | undefined>): GradeResult {
  const correctMap: Record<string, boolean> = {};
  let score = 0;
  let blank = 0;
  for (const q of key) {
    const ans = norm(answers[String(q.question_no)]);
    const correct = norm(q.correct_answer);
    if (!ans) blank++;
    const ok = !!ans && !!correct && ans === correct;
    correctMap[String(q.question_no)] = ok;
    if (ok) score++;
  }
  const total = key.length;
  return { score, total, blank, correctMap, percentage: total > 0 ? Math.round((score / total) * 10000) / 100 : 0 };
}

/** เฉลยต้องครบทุกข้อและเป็น A-D ก่อนตรวจ — กันการบันทึกคะแนน 0 จากเฉลยที่ยังไม่ครบ */
export function answerKeyProblem(key: AnswerKeyRow[], expectedCount: number): string | null {
  if (!key.length) return "ข้อสอบนี้ยังไม่มีเฉลย";
  if (expectedCount && key.length !== expectedCount) return `เฉลยมี ${key.length} ข้อ แต่ข้อสอบกำหนด ${expectedCount} ข้อ`;
  const bad = key.filter((q) => !norm(q.correct_answer)).map((q) => q.question_no);
  if (bad.length) return `เฉลยข้อ ${bad.slice(0, 10).join(", ")} ยังไม่ได้ระบุ`;
  return null;
}

/** รหัสนักเรียนต้องมีตัวเลขครบตามจำนวนช่อง ไม่เติม 0 เอง (กันจับคู่ผิดคน) */
export function cleanStudentCode(raw: unknown, digits: number): string | null {
  const code = String(raw ?? "").replace(/[^0-9]/g, "");
  return code.length === digits ? code : null;
}
