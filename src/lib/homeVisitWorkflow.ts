// Home visit workflow — auto-trigger for at-risk students + track minimum visits
import { supabase } from "@/integrations/supabase/client";
import { toCE } from "@/lib/utils";

export interface HomeVisitCheck {
  student_id: string;
  student_name: string;
  risk_factors: string[];
  visits_this_semester: number;
  min_required: number;
  overdue: boolean;
  last_visit_date: string | null;
}

/**
 * Check which at-risk students need home visits this semester.
 * OBEC requires minimum 1 visit per at-risk student per semester.
 */
export async function checkHomeVisitNeeds(
  academicYear: number,
  semester: number
): Promise<HomeVisitCheck[]> {
  const MIN_VISITS = 1;

  // Get students flagged in screening
  const { data: screened } = await (supabase.from("student_screenings" as any) as any)
    .select("student_id, screening_type, risk_level, students!inner(id, prefix, first_name, last_name)")
    .eq("academic_year", academicYear)
    .eq("semester", semester)
    .in("risk_level", ["medium", "high"]);

  if (!screened?.length) return [];

  // Get existing home visits this semester
  const { data: visits } = await supabase
    .from("home_visits")
    .select("student_id, visit_date")
    .eq("academic_year", academicYear)
    .eq("semester", semester);

  const visitCounts = new Map<string, { count: number; lastDate: string | null }>();
  for (const v of visits || []) {
    const prev = visitCounts.get(v.student_id) || { count: 0, lastDate: null };
    visitCounts.set(v.student_id, {
      count: prev.count + 1,
      lastDate: v.visit_date > (prev.lastDate || "") ? v.visit_date : prev.lastDate,
    });
  }

  const results: HomeVisitCheck[] = [];
  const seen = new Set<string>();

  for (const s of screened) {
    if (seen.has(s.student_id)) continue;
    seen.add(s.student_id);

    const v = visitCounts.get(s.student_id);
    const st = s.students as any;

    results.push({
      student_id: s.student_id,
      student_name: `${st.prefix || ""}${st.first_name} ${st.last_name}`,
      risk_factors: [s.screening_type],
      visits_this_semester: v?.count || 0,
      min_required: MIN_VISITS,
      overdue: (v?.count || 0) < MIN_VISITS,
      last_visit_date: v?.lastDate || null,
    });
  }

  return results;
}
