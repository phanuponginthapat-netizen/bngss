// SDQ Auto-flag workflow — flag at-risk students and trigger follow-up
import { supabase } from "@/integrations/supabase/client";
import { toCE } from "@/lib/utils";

export interface SdqFlagResult {
  student_id: string;
  student_name: string;
  total_difficulties: number;
  band: "normal" | "at_risk" | "problematic";
  auto_actions: string[];
}

/**
 * Auto-flag at-risk students from SDQ scores.
 * Returns list of students needing follow-up.
 */
export async function autoFlagSdqStudents(academicYear: number, semester: number): Promise<SdqFlagResult[]> {
  void semester;
  const { data: scores, error } = await (supabase.from("sdq_records" as any) as any)
    .select("student_id, total_difficulty, assessment_type, students!inner(id, prefix, first_name, last_name)")
    .eq("academic_year", toCE(academicYear));

  if (error || !scores) return [];

  const results: SdqFlagResult[] = [];
  const CUTOFFS = { normal: 13, at_risk: 17 }; // Thai DPH 25-question cutoffs

  for (const score of scores) {
    const td = (score as any).total_difficulty ?? (score as any).total_difficulties ?? 0;
    let band: "normal" | "at_risk" | "problematic" = "normal";
    if (td >= CUTOFFS.at_risk) band = "problematic";
    else if (td >= CUTOFFS.normal) band = "at_risk";

    if (band === "normal") continue;

    const s = score.students as any;
    const autoActions: string[] = [];

    if (band === "problematic") {
      autoActions.push("แจ้งหัวหน้างานกิจการนักเรียน");
      autoActions.push("นัดพบผู้ปกครอง");
      autoActions.push("ส่งต่อศูนย์ervisor");
    } else {
      autoActions.push("แจ้งครูที่ปรึกษา");
      autoActions.push("ติดตามผลใน 30 วัน");
    }

    results.push({
      student_id: score.student_id,
      student_name: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
      total_difficulties: td,
      band,
      auto_actions: autoActions,
    });
  }

  return results;
}
