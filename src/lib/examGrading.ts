// ตรวจคำตอบจากกระดาษ (แบบ ZipGrade) — เฉลยเก็บเป็น A-D เสมอ, คำตอบจาก OCR ถูกแปลงเป็น A-D แล้ว
export const CANONICAL_CHOICES = ["A", "B", "C", "D"] as const;

export type ScoringMode = "normal" | "free" | "excluded";
export interface AnswerKeyRow { question_no: number; correct_answer: string | null; scoring_mode?: ScoringMode | string | null }

export interface GradeResult {
  score: number;
  total: number;
  percentage: number;
  blank: number;
  correctMap: Record<string, boolean>;
}

export const normChoice = (v: unknown) => {
  const s = String(v ?? "").trim().toUpperCase();
  return (CANONICAL_CHOICES as readonly string[]).includes(s) ? s : null;
};
const norm = normChoice;
const modeOf = (q: AnswerKeyRow): ScoringMode =>
  q.scoring_mode === "free" || q.scoring_mode === "excluded" ? q.scoring_mode : "normal";

/** ข้อฟรี = ทุกคนได้คะแนน, ข้อตัดออก = ไม่นับทั้งคะแนนและคะแนนเต็ม */
export function gradeAnswers(key: AnswerKeyRow[], answers: Record<string, string | null | undefined>): GradeResult {
  const correctMap: Record<string, boolean> = {};
  let score = 0, blank = 0, total = 0;
  for (const q of key) {
    const mode = modeOf(q);
    const ans = norm(answers[String(q.question_no)]);
    if (mode === "excluded") continue;
    total++;
    if (!ans) blank++;
    const ok = mode === "free" || (!!ans && ans === norm(q.correct_answer));
    correctMap[String(q.question_no)] = ok;
    if (ok) score++;
  }
  return { score, total, blank, correctMap, percentage: total > 0 ? Math.round((score / total) * 10000) / 100 : 0 };
}

/** เฉลยต้องครบทุกข้อและเป็น A-D ก่อนตรวจ (ยกเว้นข้อฟรี/ตัดออก) */
export function answerKeyProblem(key: AnswerKeyRow[], expectedCount: number): string | null {
  if (!key.length) return "ข้อสอบนี้ยังไม่มีเฉลย";
  if (expectedCount && key.length !== expectedCount) return `เฉลยมี ${key.length} ข้อ แต่ข้อสอบกำหนด ${expectedCount} ข้อ`;
  const bad = key.filter((q) => modeOf(q) === "normal" && !norm(q.correct_answer)).map((q) => q.question_no);
  if (bad.length) return `เฉลยข้อ ${bad.slice(0, 10).join(", ")} ยังไม่ได้ระบุ`;
  if (!key.some((q) => modeOf(q) !== "excluded")) return "ตัดข้อสอบออกหมดทุกข้อ";
  return null;
}

/** รหัสนักเรียนต้องมีตัวเลขครบตามจำนวนช่อง ไม่เติม 0 เอง (กันจับคู่ผิดคน) */
export function cleanStudentCode(raw: unknown, digits: number): string | null {
  const code = String(raw ?? "").replace(/[^0-9]/g, "");
  return code.length === digits ? code : null;
}

const CHOICE_ALIASES: Record<string, string> = {
  A: "A", B: "B", C: "C", D: "D", "1": "A", "2": "B", "3": "C", "4": "D", "ก": "A", "ข": "B", "ค": "C", "ง": "D",
};
/** แปลงข้อความเฉลยยาว เช่น "กขคง", "1234", "ABCD" หรือ "1.ก 2.ข" เป็น A-D; "-" หรือ "_" = เว้นว่าง */
export function parseAnswerKeyText(text: string): (string | null)[] {
  const cleaned = String(text || "").toUpperCase().replace(/\d+\s*[.)]\s*/g, "");
  const out: (string | null)[] = [];
  for (const ch of cleaned) {
    if (CHOICE_ALIASES[ch]) out.push(CHOICE_ALIASES[ch]);
    else if (ch === "-" || ch === "_" || ch === "?") out.push(null);
  }
  return out;
}

/** เหตุผลที่ต้องให้ครูตรวจทาน — ว่างแปลว่าตรวจสมบูรณ์ */
export function reviewReasons(input: {
  studentCode: string | null; studentFound: boolean; duplicate: boolean;
  blank: number; total: number; multiMarked?: number; confidence?: number | null;
}): string[] {
  const r: string[] = [];
  if (!input.studentCode) r.push("อ่านรหัสนักเรียนไม่ครบ");
  else if (!input.studentFound) r.push("ไม่พบรหัสนักเรียนในระบบ");
  if (input.duplicate) r.push("สแกนซ้ำรหัสเดิม");
  if ((input.multiMarked || 0) > 0) r.push(`ฝนหลายคำตอบ ${input.multiMarked} ข้อ`);
  if (input.total > 0 && input.blank / input.total >= 0.3) r.push(`ไม่ได้ฝน ${input.blank} ข้อ (อาจฝนจาง)`);
  if (typeof input.confidence === "number" && input.confidence < 0.7) r.push("ความมั่นใจในการอ่านต่ำ");
  return r;
}

// ---------------- การวิเคราะห์ข้อสอบ (กลุ่มสูง-กลุ่มต่ำ) ----------------
export interface AnalysisSubmission { answers: Record<string, string | null | undefined> }
export interface ItemStat {
  question_no: number; mode: ScoringMode; correct: string | null;
  p: number | null; r: number | null; pAll: number | null;
  choiceCounts: Record<string, { high: number; low: number; all: number }>;
  blank: number; verdict: string; distractorWarnings: string[];
}
export interface ExamAnalysis {
  n: number; groupSize: number; ratio: number;
  mean: number; sd: number; median: number; max: number; min: number; kr20: number | null;
  items: ItemStat[];
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function itemVerdict(p: number | null, r: number | null): string {
  if (p == null || r == null) return "-";
  if (p >= 0.2 && p <= 0.8 && r >= 0.2) return "ใช้ได้";
  if (r < 0) return "ควรตัดทิ้ง (จำแนกกลับ)";
  if (p < 0.2) return "ยากเกินไป";
  if (p > 0.8) return "ง่ายเกินไป";
  return "ควรปรับปรุง";
}

export function analyzeExam(key: AnswerKeyRow[], subs: AnalysisSubmission[], ratio = 0.27): ExamAnalysis {
  const scored = subs.map((s) => ({ s, score: gradeAnswers(key, s.answers).score }));
  const n = scored.length;
  const scores = scored.map((x) => x.score);
  const mean = n ? scores.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n > 1 ? scores.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : 0;
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const g = n >= 2 ? Math.max(1, Math.round(n * ratio)) : 0;
  const high = ranked.slice(0, g), low = g ? ranked.slice(-g) : [];
  const counted = key.filter((q) => modeOf(q) === "normal");

  let pqSum = 0;
  const items: ItemStat[] = key.map((q) => {
    const k = String(q.question_no), correct = norm(q.correct_answer), mode = modeOf(q);
    const choiceCounts: ItemStat["choiceCounts"] = {};
    for (const c of CANONICAL_CHOICES) choiceCounts[c] = { high: 0, low: 0, all: 0 };
    let blank = 0;
    for (const x of scored) { const a = norm(x.s.answers[k]); if (a) choiceCounts[a].all++; else blank++; }
    for (const x of high) { const a = norm(x.s.answers[k]); if (a) choiceCounts[a].high++; }
    for (const x of low) { const a = norm(x.s.answers[k]); if (a) choiceCounts[a].low++; }
    if (mode !== "normal" || !correct || !g) {
      return { question_no: q.question_no, mode, correct, p: null, r: null, pAll: null, choiceCounts, blank, verdict: mode === "normal" ? "-" : mode === "free" ? "ข้อฟรี" : "ตัดออก", distractorWarnings: [] };
    }
    const H = choiceCounts[correct].high, L = choiceCounts[correct].low;
    const p = round((H + L) / (2 * g)), r = round((H - L) / g);
    const pAll = n ? choiceCounts[correct].all / n : 0;
    pqSum += pAll * (1 - pAll);
    const distractorWarnings: string[] = [];
    for (const c of CANONICAL_CHOICES) {
      if (c === correct) continue;
      const cc = choiceCounts[c];
      if (cc.all === 0) distractorWarnings.push(`${c}: ไม่มีคนเลือก`);
      else if (cc.high > cc.low) distractorWarnings.push(`${c}: กลุ่มสูงเลือกมากกว่า`);
    }
    return { question_no: q.question_no, mode, correct, p, r, pAll: round(pAll), choiceCounts, blank, verdict: itemVerdict(p, r), distractorWarnings };
  });
  const k = counted.length;
  const kr20 = n > 1 && k > 1 && variance > 0 ? round((k / (k - 1)) * (1 - pqSum / variance), 3) : null;
  return { n, groupSize: g, ratio, mean: round(mean), sd: round(Math.sqrt(variance)), median, max: n ? sorted[n - 1] : 0, min: n ? sorted[0] : 0, kr20, items };
}

/** ไฟล์ข้อความสำหรับนำเข้า EVANA: บรรทัดแรกเฉลย, ต่อด้วย รหัส(เว้นวรรค)คำตอบ 1-4, 0 = ไม่ตอบ */
export function evanaText(key: AnswerKeyRow[], subs: { code: string | null; answers: Record<string, string | null | undefined> }[]): string {
  const toDigit = (v: unknown) => { const c = norm(v); return c ? String(CANONICAL_CHOICES.indexOf(c as any) + 1) : "0"; };
  const lines = ["KEY " + key.map((q) => toDigit(q.correct_answer)).join("")];
  for (const s of subs) lines.push(`${s.code || "-"} ${key.map((q) => toDigit(s.answers[String(q.question_no)])).join("")}`);
  return lines.join("\r\n") + "\r\n";
}

/** แปลงคะแนนสอบเป็นคะแนนช่องในสมุดคะแนน (ปัดทศนิยม 2 ตำแหน่ง) */
export function scaleScore(score: number, total: number, fullMark: number): number {
  if (!(total > 0) || !(fullMark > 0)) return 0;
  return round((Math.max(0, Math.min(score, total)) / total) * fullMark);
}
