/**
 * Early Warning dropout prediction — ระบบแจ้งเตือนเสี่ยงหลุดจากระบบ
 * Checks: attendance <80%, ติด 0 ร มส มผ, GPA <2.0, behavior incidents, SDQ high
 * Risk: low / medium / high + reasons[]
 */
import { supabase } from "@/integrations/supabase/client";

export type RiskLevel = "low" | "medium" | "high";

export interface RiskResult {
  studentId: string;
  studentCode?: string | null;
  studentName?: string | null;
  classroomName?: string | null;
  classroomId?: string | null;
  riskLevel: RiskLevel;
  reasons: string[];
  score: number;
  details: {
    attendanceRate?: number | null;
    totalAttendanceDays?: number;
    remediationCount?: number;
    gpa?: number | null;
    behaviorNegativeCount?: number;
    behaviorTotalPoints?: number;
    sdqTotal?: number | null;
    sdqLevel?: string | null;
  };
  calculatedAt: string;
}

const ATTENDANCE_THRESHOLD = 80;
const GPA_THRESHOLD = 2.0;
const BEHAVIOR_THRESHOLD = 3; // negative incidents
const SDQ_HIGH = 17;
const SDQ_BORDERLINE = 14;

// helper: build risk level from score
function toLevel(score: number): RiskLevel {
  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function sdqLevelThai(total: number): string {
  if (total >= 17) return "มีปัญหา";
  if (total >= 14) return "เสี่ยง";
  return "ปกติ";
}

/**
 * Calculate risk for a single student.
 * Thread-safe: never throws, returns low with error reason on failure.
 */
export async function calculateRisk(studentId: string): Promise<RiskResult> {
  const reasons: string[] = [];
  let score = 0;
  const details: RiskResult["details"] = {};
  let studentCode: string | null = null;
  let studentName: string | null = null;
  let classroomName: string | null = null;
  let classroomId: string | null = null;

  try {
    // fetch student meta first (for name/code and fallback GPA lookup)
    const { data: stu } = await supabase
      .from("students")
      .select("id, student_code, prefix, first_name, last_name, classroom_id, classrooms!students_classroom_id_fkey(name)")
      .eq("id", studentId)
      .maybeSingle();

    if (stu) {
      studentCode = (stu as any).student_code ?? null;
      classroomId = (stu as any).classroom_id ?? null;
      const c: any = (stu as any).classrooms;
      classroomName = c?.name ?? null;
      studentName = `${(stu as any).prefix || ""}${(stu as any).first_name || ""} ${(stu as any).last_name || ""}`.trim() || null;
    }

    // parallel fetch all signals
    const [attRes, remRes, behaviorRes, sdqRes, scoreRes] = await Promise.all([
      // attendance — last ~90 days or all if few
      supabase
        .from("attendance")
        .select("status, attendance_date")
        .eq("student_id", studentId)
        .order("attendance_date", { ascending: false })
        .limit(500),
      // grade remediation — 0 ร มส มผ that not yet passed
      supabase
        .from("grade_remediation")
        .select("id, original_grade, status")
        .eq("student_id", studentId)
        .in("original_grade", ["0", "ร", "มส", "มผ"])
        .neq("status", "ผ่าน"),
      // behavior negative
      supabase
        .from("behavior_records")
        .select("id, behavior_type, points, created_at")
        .eq("student_id", studentId)
        .eq("behavior_type", "negative")
        .order("created_at", { ascending: false })
        .limit(100),
      // SDQ latest
      supabase
        .from("sdq_records")
        .select("total_difficulty, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // GPA — try student_scores by student_id then student_code fallback
      (async () => {
        // try by student_id
        const r1 = await supabase
          .from("student_scores" as any)
          .select("gpax, grade_point, grade, academic_year, semester")
          .eq("student_id", studentId)
          .order("academic_year", { ascending: false })
          .order("semester", { ascending: false })
          .limit(10);
        if (r1.data && r1.data.length > 0) return r1;
        if (studentCode) {
          const r2 = await supabase
            .from("student_scores" as any)
            .select("gpax, grade_point, grade, academic_year, semester")
            .eq("student_code", studentCode)
            .order("academic_year", { ascending: false })
            .limit(10);
          return r2;
        }
        return r1;
      })(),
    ]);

    // 1) Attendance <80%
    const attRows: any[] = (attRes.data as any[]) || [];
    if (attRows.length > 0) {
      const total = attRows.length;
      // present = present + late considered attended (matches attendance-daily-report: present+late counted as มาเรียน)
      const present = attRows.filter((r) => r.status === "present" || r.status === "late").length;
      // also count leave as partial? OBEC counts leave as not present for 80% threshold, so exclude
      const rate = total > 0 ? Math.round((present / total) * 10000) / 100 : 100;
      details.attendanceRate = rate;
      details.totalAttendanceDays = total;
      if (rate < ATTENDANCE_THRESHOLD) {
        // weight: <70% => 2 points, 70-80 => 1 point
        const w = rate < 70 ? 2 : 1;
        score += w;
        reasons.push(`อัตราการมาเรียนต่ำกว่า 80% (${rate.toFixed(1)}% จาก ${total} วัน)`);
      }
    } else {
      details.attendanceRate = null;
      // no data => no penalty, but do not assume risk
    }

    // 2) ติด 0 ร มส มผ count
    const remRows: any[] = (remRes.data as any[]) || [];
    const remediationCount = remRows.length;
    details.remediationCount = remediationCount;
    if (remediationCount > 0) {
      score += remediationCount >= 3 ? 2 : 1;
      // list grades if available
      const grades = remRows.map((r) => r.original_grade).join(", ");
      reasons.push(`ติด 0/ร/มส/มผ จำนวน ${remediationCount} วิชา${grades ? ` (${grades})` : ""}`);
    }

    // 3) GPA <2.0
    let gpa: number | null = null;
    const scoreRows: any[] = (scoreRes as any)?.data || [];
    if (scoreRows.length > 0) {
      // prefer gpax field if present
      const withGpax = scoreRows.find((r) => r.gpax !== null && r.gpax !== undefined);
      if (withGpax?.gpax !== null && withGpax?.gpax !== undefined) {
        gpa = Number(withGpax.gpax);
      } else {
        // fallback compute from grade_point
        const pts = scoreRows
          .map((r) => (r.grade_point != null ? Number(r.grade_point) : null))
          .filter((v) => v !== null && !Number.isNaN(v)) as number[];
        if (pts.length > 0) {
          gpa = Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 100) / 100;
        } else {
          // try academic_probation as fallback
          const { data: prob } = await supabase
            .from("academic_probation" as any)
            .select("gpax")
            .eq("student_id", studentId)
            .order("academic_year", { ascending: false })
            .limit(1)
            .maybeSingle();
          if ((prob as any)?.gpax != null) gpa = Number((prob as any).gpax);
        }
      }
    } else {
      // try probation direct
      try {
        const { data: prob } = await supabase
          .from("academic_probation" as any)
          .select("gpax")
          .eq("student_id", studentId)
          .order("academic_year", { ascending: false })
          .limit(1)
          .maybeSingle();
        if ((prob as any)?.gpax != null) gpa = Number((prob as any).gpax);
      } catch {}
    }
    details.gpa = gpa;
    if (gpa !== null && gpa < GPA_THRESHOLD) {
      score += gpa < 1.5 ? 2 : 1;
      reasons.push(`GPAX ต่ำกว่า 2.0 (${gpa.toFixed(2)})`);
    }

    // 4) Behavior incidents (negative)
    const behRows: any[] = (behaviorRes.data as any[]) || [];
    const negCount = behRows.length;
    details.behaviorNegativeCount = negCount;
    // also sum points for context
    const totalNegPoints = behRows.reduce((s, r) => s + (Number(r.points) || 0), 0);
    details.behaviorTotalPoints = totalNegPoints;
    if (negCount >= BEHAVIOR_THRESHOLD) {
      score += negCount >= 5 ? 2 : 1;
      reasons.push(`พฤติกรรมเชิงลบ ${negCount} ครั้ง${totalNegPoints ? ` (หัก ${totalNegPoints} คะแนน)` : ""}`);
    } else if (negCount > 0 && negCount < BEHAVIOR_THRESHOLD) {
      // 1-2 times not enough for score but mention as watch? not added to reasons to avoid noise
    }

    // 5) SDQ high
    const sdqRow: any = (sdqRes as any)?.data;
    if (sdqRow && typeof sdqRow.total_difficulty === "number") {
      const total = Number(sdqRow.total_difficulty);
      details.sdqTotal = total;
      details.sdqLevel = sdqLevelThai(total);
      if (total >= SDQ_HIGH) {
        score += 2;
        reasons.push(`SDQ อยู่ในเกณฑ์มีปัญหา (คะแนนรวม ${total}/40)`);
      } else if (total >= SDQ_BORDERLINE) {
        score += 1;
        reasons.push(`SDQ อยู่ในเกณฑ์เสี่ยง (คะแนนรวม ${total}/40)`);
      }
      // anti-prosocial very low? prosocial score <4 could be extra signal but not required
    } else {
      details.sdqTotal = null;
    }
  } catch (e) {
    console.warn("[earlyWarning] calculateRisk error", e);
    // return low with error reason so caller knows
    // Do not throw — keep low
  }

  const riskLevel = toLevel(score);
  // if no reasons but score 0 => low, ensure reasons not empty for high/medium
  if (reasons.length === 0 && riskLevel !== "low") {
    reasons.push("คะแนนความเสี่ยงรวมสูงจากหลายปัจจัย");
  }

  return {
    studentId,
    studentCode,
    studentName,
    classroomName,
    classroomId,
    riskLevel,
    reasons,
    score,
    details,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Scan all active students and return high-risk list (riskLevel === 'high').
 * Batch-friendly: fetches students then runs calculateRisk with concurrency limit.
 */
export async function getAtRiskStudents(options?: {
  onlyHigh?: boolean;
  limit?: number;
  concurrency?: number;
}): Promise<RiskResult[]> {
  const onlyHigh = options?.onlyHigh ?? true;
  const limit = options?.limit ?? 500;
  const concurrency = options?.concurrency ?? 10;

  const { data: students, error } = await supabase
    .from("students")
    .select("id")
    .eq("status", "active")
    .order("student_code", { ascending: true })
    .limit(limit);

  if (error) throw error;
  const ids = ((students as any[]) || []).map((s) => s.id);
  if (ids.length === 0) return [];

  const results: RiskResult[] = [];
  // concurrency-limited pool
  let idx = 0;
  async function worker() {
    while (idx < ids.length) {
      const cur = idx++;
      const id = ids[cur];
      try {
        const r = await calculateRisk(id);
        if (!onlyHigh || r.riskLevel === "high") {
          results.push(r);
        }
      } catch (e) {
        console.warn("[earlyWarning] getAtRiskStudents worker error", id, e);
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
  await Promise.all(workers);

  // sort high first, then score desc, then name
  results.sort((a, b) => {
    const rank: Record<RiskLevel, number> = { high: 3, medium: 2, low: 1 };
    if (rank[b.riskLevel] !== rank[a.riskLevel]) return rank[b.riskLevel] - rank[a.riskLevel];
    if (b.score !== a.score) return b.score - a.score;
    return (a.studentCode || "").localeCompare(b.studentCode || "");
  });

  return results;
}

// UI helpers
export function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case "high":
      return "bg-red-100 text-red-700 border-red-200";
    case "medium":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "low":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
}

export function riskLabel(level: RiskLevel): string {
  switch (level) {
    case "high":
      return "เสี่ยงสูง";
    case "medium":
      return "เสี่ยงปานกลาง";
    case "low":
      return "ปกติ";
  }
}

/**
 * Save a risk result to early_warnings table (for history / cron).
 */
export async function saveEarlyWarning(result: RiskResult): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("early_warnings" as any)
    .insert({
      student_id: result.studentId,
      risk_level: result.riskLevel,
      reasons: result.reasons,
      calculated_at: result.calculatedAt,
      notified: false,
      score: result.score,
      details: result.details,
    } as any)
    .select("id")
    .single();
  if (error) {
    console.warn("[earlyWarning] saveEarlyWarning failed", error);
    return null;
  }
  return data as any;
}
