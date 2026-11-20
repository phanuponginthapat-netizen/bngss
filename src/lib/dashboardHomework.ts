import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "./fetchAllRows";
import { dashboardDateInTerm } from "./dashboardTerm";
import { familyHomeworkStatus, familyHomeworkScore, type FamilySubmission } from "./homeworkFamilyStatus";

export interface DashboardHomework {
  id: string;
  title: string;
  due_date: string | null;
  status: ReturnType<typeof familyHomeworkStatus>;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  destination: string;
}

export function taskFamilySubmission(task: { assigned_to_student_id: string | null; submissions: unknown; status: string; grade: number | null; submitted_at: string | null }, studentId: string): FamilySubmission | null {
  if (task.assigned_to_student_id === studentId) {
    return { status: task.grade !== null ? "graded" : task.submitted_at || task.status === "done" ? "submitted" : "not_submitted", grade: task.grade };
  }
  if (!task.submissions || typeof task.submissions !== "object" || Array.isArray(task.submissions)) return null;
  const mine = (task.submissions as Record<string, unknown>)[studentId];
  return mine && typeof mine === "object" && !Array.isArray(mine) ? mine as FamilySubmission : null;
}

export async function loadFamilyDashboardHomework(student: { id: string; classroom_id: string | null }, dates: { start: string; end: string }): Promise<DashboardHomework[]> {
  const [tasks, worksheets] = await Promise.all([
    fetchAllRows((from, to) => {
      let query = supabase.from("task_assignments")
        .select("id,title,due_date,assigned_date,assigned_to_student_id,classroom_id,submissions,status,grade,submitted_at,max_score,feedback")
        .eq("task_type", "homework").gte("assigned_date", dates.start).lte("assigned_date", dates.end)
        .order("id").range(from, to);
      query = student.classroom_id
        ? query.or(`assigned_to_student_id.eq.${student.id},and(assigned_to_student_id.is.null,classroom_id.eq.${student.classroom_id})`)
        : query.eq("assigned_to_student_id", student.id);
      return query;
    }),
    student.classroom_id ? fetchAllRows((from, to) => supabase.from("homework_assignments")
      .select("id,title,due_date,total_score,created_at,content_html,pdf_path").eq("classroom_id", student.classroom_id)
      .gte("created_at", `${dates.start}T00:00:00+07:00`).lte("created_at", `${dates.end}T23:59:59.999+07:00`)
      .order("id").range(from, to)) : Promise.resolve([]),
  ]);
  const rich = worksheets.filter(w => dashboardDateInTerm(w.created_at, dates) && (w.content_html || w.pdf_path));
  const submissions = [];
  for (let offset = 0; offset < rich.length; offset += 100) {
    submissions.push(...await fetchAllRows((from, to) => supabase.from("homework_submissions")
      .select("assignment_id,status,score,final_score,feedback").eq("student_id", student.id)
      .in("assignment_id", rich.slice(offset, offset + 100).map(w => w.id)).order("id").range(from, to)));
  }
  const byAssignment = new Map(submissions.map(s => [s.assignment_id, s]));
  const result: DashboardHomework[] = tasks.map(t => {
    const submission = taskFamilySubmission(t, student.id);
    const mine = t.assigned_to_student_id === student.id ? t : (t.submissions as Record<string, { feedback?: string }> | null)?.[student.id];
    return { id: t.id, title: t.title, due_date: t.due_date, status: familyHomeworkStatus(submission), score: familyHomeworkScore(submission), maxScore: t.max_score, feedback: mine?.feedback ?? null, destination: "/dashboard/homework" };
  });
  for (const w of rich) {
    const submission = byAssignment.get(w.id);
    result.push({ id: w.id, title: w.title, due_date: w.due_date, status: familyHomeworkStatus(submission), score: familyHomeworkScore(submission), maxScore: w.total_score, feedback: submission?.feedback ?? null, destination: `/dashboard/homework?worksheet=${w.id}` });
  }
  return result.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.id.localeCompare(b.id));
}