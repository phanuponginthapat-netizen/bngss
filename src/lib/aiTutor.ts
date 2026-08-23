/**
 * AI Tutor personalization helpers
 * - Queries weak subjects (grade 0-2 or grade_point < 2)
 * - Attendance risk & behavior summary
 * - Builds personalized system-prompt snippet for LLM
 *
 * Works with current schema:
 *   students.id (uuid) <- attendance.student_id, behavior_records.student_id, grade_remediation.student_id
 *   student_scores.student_code (text) -> not FK, so we resolve via students.student_code
 *   subjects.id -> student_scores.subject_id
 */

import { supabase } from "@/integrations/supabase/client";

export type WeakSubject = {
  id: string;
  subject_id: string;
  subject_code: string | null;
  subject_name: string | null;
  grade: string | null;
  grade_point: number | null;
  total_score: number | null;
  semester: number | null;
  academic_year: number | null;
  credits?: number | null;
};

export type AttendanceRisk = {
  total: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  absentRate: number; // 0..1
  riskLevel: "low" | "medium" | "high";
  recentAbsences: { date: string; status: string }[];
};

export type BehaviorSummary = {
  total: number;
  positive: number;
  negative: number;
  totalPoints: number;
  recent: { record_date: string; behavior_type: string; description: string; points: number | null }[];
};

export type RemediationItem = {
  id: string;
  subject_code: string;
  subject_name: string | null;
  term: string;
  original_grade: string;
  status: string;
  fix_deadline: string | null;
};

export type RecommendedLesson = {
  id: string;
  code: string;
  name_th: string;
  name_en?: string | null;
  credits?: number | null;
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const WEAK_GRADES = new Set(["0", "0.0", "1", "1.0", "1.5", "2", "2.0"]);
const REMEDIATION_GRADES = new Set(["0", "ร", "มส", "มผ"]);

function isWeakGrade(grade: string | null | undefined, gp: number | null | undefined): boolean {
  if (gp != null && Number(gp) < 2) return true;
  if (!grade) return false;
  const g = String(grade).trim();
  if (WEAK_GRADES.has(g)) return true;
  // also treat remediation grades as weak (useful for UI even if not in 0-2)
  if (REMEDIATION_GRADES.has(g)) return true;
  // numeric fallback e.g. "1.00"
  const n = Number(g);
  if (!Number.isNaN(n) && n <= 2 && n >= 0) return true;
  return false;
}

export async function resolveStudent(studentId: string): Promise<{ id: string; student_code: string; first_name: string; last_name: string } | null> {
  if (!studentId) return null;
  // 1) try by students.id
  const { data: byId } = await supabase.from("students").select("id, student_code, first_name, last_name").eq("id", studentId).maybeSingle();
  if (byId) return byId as any;
  // 2) try by auth_user_id
  const { data: byAuth } = await supabase.from("students").select("id, student_code, first_name, last_name").eq("auth_user_id", studentId).maybeSingle();
  if (byAuth) return byAuth as any;
  // 3) try by student_code
  const { data: byCode } = await supabase.from("students").select("id, student_code, first_name, last_name").eq("student_code", studentId).maybeSingle();
  if (byCode) return byCode as any;
  return null;
}

// ---------------------------------------------------------------------------
// getWeakSubjects
// ---------------------------------------------------------------------------
export async function getWeakSubjects(studentId: string): Promise<WeakSubject[]> {
  const student = await resolveStudent(studentId);
  if (!student?.student_code) return [];

  const { data, error } = await supabase
    .from("student_scores")
    .select("id, subject_id, grade, grade_point, total_score, semester, academic_year, subjects!inner(id, code, name_th, name_en, credits)")
    .eq("student_code", student.student_code)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[aiTutor] getWeakSubjects error", error);
    return [];
  }
  const rows = (data || []) as any[];
  // client-side filter for weak
  const weak = rows.filter((r) => isWeakGrade(r.grade, r.grade_point));

  return weak.map((r) => ({
    id: r.id,
    subject_id: r.subject_id,
    subject_code: r.subjects?.code ?? null,
    subject_name: r.subjects?.name_th ?? r.subjects?.code ?? null,
    grade: r.grade ?? null,
    grade_point: r.grade_point ?? null,
    total_score: r.total_score ?? null,
    semester: r.semester ?? null,
    academic_year: r.academic_year ?? null,
    credits: r.subjects?.credits ?? null,
  }));
}

// ---------------------------------------------------------------------------
// getAttendanceRisk
// ---------------------------------------------------------------------------
export async function getAttendanceRisk(studentId: string): Promise<AttendanceRisk | null> {
  const student = await resolveStudent(studentId);
  if (!student) return null;

  // last 60 days, limit 100 rows (enough for risk)
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceISO = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("attendance")
    .select("attendance_date, status")
    .eq("student_id", student.id)
    .gte("attendance_date", sinceISO)
    .order("attendance_date", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[aiTutor] getAttendanceRisk error", error);
    return { total: 0, present: 0, absent: 0, late: 0, leave: 0, absentRate: 0, riskLevel: "low", recentAbsences: [] };
  }

  const rows = (data || []) as { attendance_date: string; status: string }[];
  let present = 0, absent = 0, late = 0, leave = 0;
  rows.forEach((r) => {
    const s = (r.status || "").toLowerCase();
    if (s === "present" || s === "มาเรียน" || s === "มา") present++;
    else if (s === "absent" || s === "ขาด" || s === "ขาดเรียน") absent++;
    else if (s === "late" || s === "สาย" || s === "มาสาย") late++;
    else if (s === "leave" || s === "ลา" || s === "sick" || s === "ลาป่วย" || s === "ลากิจ") leave++;
    else if (s.includes("ขาด")) absent++;
    else if (s.includes("สาย")) late++;
    else present++;
  });
  const total = rows.length;
  const absentRate = total > 0 ? absent / total : 0;
  let riskLevel: AttendanceRisk["riskLevel"] = "low";
  if (absent >= 5 || absentRate >= 0.2) riskLevel = "high";
  else if (absent >= 2 || absentRate >= 0.1 || late >= 5) riskLevel = "medium";

  const recentAbsences = rows.filter((r) => {
    const s = (r.status || "").toLowerCase();
    return s.includes("ขาด") || s === "absent" || s === "late" || s === "สาย";
  }).slice(0, 5).map((r) => ({ date: r.attendance_date, status: r.status }));

  return { total, present, absent, late, leave, absentRate, riskLevel, recentAbsences };
}

// ---------------------------------------------------------------------------
// getBehavior
// ---------------------------------------------------------------------------
export async function getBehavior(studentId: string): Promise<BehaviorSummary | null> {
  const student = await resolveStudent(studentId);
  if (!student) return null;

  const { data, error } = await supabase
    .from("behavior_records")
    .select("record_date, behavior_type, description, points")
    .eq("student_id", student.id)
    .order("record_date", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("[aiTutor] getBehavior error", error);
    return { total: 0, positive: 0, negative: 0, totalPoints: 0, recent: [] };
  }
  const rows = (data || []) as BehaviorSummary["recent"];
  let positive = 0, negative = 0, totalPoints = 0;
  rows.forEach((r) => {
    const t = (r.behavior_type || "").toLowerCase();
    if (t === "positive" || t === "ดี" || t.includes("ชม")) positive++;
    else if (t === "negative" || t === "ไม่ดี" || t.includes("ลบ") || (r.points != null && r.points < 0)) negative++;
    else if ((r.points ?? 0) > 0) positive++;
    else if ((r.points ?? 0) < 0) negative++;
    totalPoints += Number(r.points || 0);
  });

  return { total: rows.length, positive, negative, totalPoints, recent: rows.slice(0, 5) };
}

// ---------------------------------------------------------------------------
// remediation
// ---------------------------------------------------------------------------
export async function getRemediation(studentId: string): Promise<RemediationItem[]> {
  const student = await resolveStudent(studentId);
  if (!student) return [];
  const { data, error } = await supabase
    .from("grade_remediation")
    .select("id, subject_code, subject_name, term, original_grade, status, fix_deadline")
    .eq("student_id", student.id)
    .in("original_grade", ["0", "ร", "มส", "มผ"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.warn("[aiTutor] getRemediation error", error);
    return [];
  }
  return (data || []) as RemediationItem[];
}

// ---------------------------------------------------------------------------
// recommended lessons from subjects table (weak -> same subject, else general)
// ---------------------------------------------------------------------------
export async function getRecommendedLessons(studentId: string): Promise<RecommendedLesson[]> {
  const weak = await getWeakSubjects(studentId);
  if (weak.length > 0) {
    const codes = [...new Set(weak.map((w) => w.subject_code).filter(Boolean) as string[])].slice(0, 6);
    if (codes.length) {
      const { data } = await supabase.from("subjects").select("id, code, name_th, name_en, credits").in("code", codes).limit(10);
      if (data && data.length) return data as RecommendedLesson[];
      // fallback: by subject_id
      const ids = weak.map((w) => w.subject_id).slice(0, 6);
      const { data: byId } = await supabase.from("subjects").select("id, code, name_th, name_en, credits").in("id", ids).limit(10);
      if (byId && byId.length) return byId as RecommendedLesson[];
    }
  }
  // generic: 6 random/elective subjects
  const { data } = await supabase.from("subjects").select("id, code, name_th, name_en, credits").limit(6).order("name_th");
  return (data || []) as RecommendedLesson[];
}

// ---------------------------------------------------------------------------
// buildTutorPrompt
// ---------------------------------------------------------------------------
export async function buildTutorPrompt(studentId: string): Promise<string> {
  if (!studentId) return "ไม่มีรหัสนักเรียน — ให้คำแนะนำทั่วไปตามหลักสูตรไทย";

  const student = await resolveStudent(studentId);
  if (!student) return `ไม่พบข้อมูลนักเรียน ${studentId} — ให้คำแนะนำทั่วไป`;

  const [weak, att, beh, rem] = await Promise.all([
    getWeakSubjects(student.id),
    getAttendanceRisk(student.id),
    getBehavior(student.id),
    getRemediation(student.id),
  ]);

  const name = `${student.first_name} ${student.last_name} (${student.student_code})`;

  const lines: string[] = [];
  lines.push(`[บริบทนักเรียนสำหรับติวเตอร์ — ปรับการสอนให้ตรงจุด แบบเป็นส่วนตัว]`);
  lines.push(`นักเรียน: ${name} id=${student.id}`);

  if (weak.length) {
    lines.push(`\nวิชาที่อ่อน (เกรด 0-2 หรือ grade_point < 2):`);
    weak.slice(0, 6).forEach((w) => {
      lines.push(`- ${w.subject_code || w.subject_name || w.subject_id} ${w.subject_name ? `(${w.subject_name})` : ""} เกรด ${w.grade ?? "-"} (GP ${w.grade_point ?? "-"} คะแนน ${w.total_score ?? "-"}) เทอม ${w.semester ?? "-"}/${w.academic_year ?? "-"}`);
    });
    lines.push(`แนวทาง: เน้นติววิชาเหล่านี้ก่อน, ยกตัวอย่างแบบ Socratic + worked example, ให้กำลังใจ, ชวนทำแบบฝึกหัดสั้นๆ`);
  } else {
    lines.push(`\nวิชาที่อ่อน: ไม่พบเกรด 0-2 (ภาพรวมดี) — เน้นเสริมจุดแข็งและทบทวนเชิงลึก`);
  }

  if (rem.length) {
    lines.push(`\nรายการติด 0 / ร / มส / มผ ล่าสุด:`);
    rem.slice(0, 6).forEach((r) => {
      lines.push(`- ${r.subject_code} ${r.subject_name || ""} เทอม ${r.term} เกรด ${r.original_grade} สถานะ ${r.status}${r.fix_deadline ? ` กำหนดแก้ ${r.fix_deadline}` : ""}`);
    });
    lines.push(`ต้องเตือนเรื่องการแก้ 0 ร มส ให้ทันกำหนด, ให้แผนแก้เป็นขั้นๆ`);
  }

  if (att) {
    lines.push(`\nการมาเรียน 60 วันล่าสุด: รวม ${att.total} ครั้ง มา ${att.present} ขาด ${att.absent} สาย ${att.late} ลา ${att.leave} อัตราขาด ${(att.absentRate * 100).toFixed(1)}% ระดับเสี่ยง ${att.riskLevel}`);
    if (att.recentAbsences.length) {
      lines.push(`ขาด/สายล่าสุด: ${att.recentAbsences.map((a) => `${a.date}(${a.status})`).join(", ")}`);
    }
    if (att.riskLevel === "high") lines.push(`คำแนะนำ: เสี่ยงขาดเรียนสูง — ควรชวนวางแผนการมาเรียน, ถามสาเหตุอย่างเห็นใจ`);
    else if (att.riskLevel === "medium") lines.push(`คำแนะนำ: เริ่มมีสัญญาณขาด/สาย — เตือนเบาๆ ให้กำลังใจ`);
  }

  if (beh) {
    lines.push(`\nพฤติกรรม: ทั้งหมด ${beh.total} ครั้ง บวก ${beh.positive} ลบ ${beh.negative} คะแนนรวม ${beh.totalPoints}`);
    if (beh.recent.length) {
      lines.push(`ล่าสุด: ${beh.recent.map((b) => `${b.record_date} [${b.behavior_type}] ${b.description.slice(0, 40)}`).join(" | ")}`);
    }
    if (beh.negative > beh.positive) lines.push(`เน้นเสริมแรงบวก, ชวนสะท้อนพฤติกรรมเชิงบวก`);
  }

  lines.push(`\nวิธีใช้บริบทนี้: นำไปปรับน้ำเสียงและตัวอย่างให้ตรงวิชาที่อ่อน, ถ้านักเรียนถามการบ้านให้สอนวิธีคิดแบบ Socratic (ทวนโจทย์ → หลักการ → ตัวอย่างคล้ายแก้ทีละขั้น → คำถามนำ → ชวนทำเอง) ห้ามเฉลยตรงสำหรับนักเรียน, ให้กำลังใจและใช้ภาษาไทยเป็นหลัก`);

  return lines.join("\n");
}
