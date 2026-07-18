import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MyTeacherAssignment {
  id: string;
  subject_id: string;
  classroom_id: string;
  subjectName: string;
  subjectCode?: string;
  gradeLevel: string;
  classroomName: string;
}

/**
 * Loads the current signed-in user's teacher_assignments as a flat list
 * of subject × classroom pairs. Admin/director get ALL assignments so they
 * can also guide imports on behalf of teachers.
 */
export function useMyTeacherAssignments() {
  return useQuery({
    queryKey: ["my_teacher_assignments_for_import"],
    queryFn: async (): Promise<MyTeacherAssignment[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return [];

      // ต้องมี personnel record ถึงจะมี "วิชาที่ได้รับมอบหมาย"
      // admin/director ที่ไม่มี personnel = ไม่มีวิชาสอนของตัวเอง
      const { data: p } = await supabase
        .from("personnel")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      const personnelId = p?.id || null;
      if (!personnelId) return [];

      const { data } = await supabase
        .from("teacher_assignments")
        .select("id, subject_id, classroom_id, subjects(name_th, code), classrooms(name, grade_level)")
        .eq("personnel_id", personnelId)
        .order("created_at", { ascending: false });


      return (data || [])
        .filter((r: any) => r.subjects && r.classrooms)
        .map((r: any) => ({
          id: r.id,
          subject_id: r.subject_id,
          classroom_id: r.classroom_id,
          subjectName: r.subjects.name_th,
          subjectCode: r.subjects.code || undefined,
          gradeLevel: r.classrooms.grade_level,
          classroomName: r.classrooms.name,
        }));
    },
  });
}

/**
 * Score how well an assignment matches parsed workbook meta (subjectName / gradeLevel).
 * Higher = better. Returns 0 for no signal.
 */
export function scoreAssignmentMatch(
  a: MyTeacherAssignment,
  meta: { subjectName?: string; subjectCode?: string; gradeLevel?: string }
): number {
  let score = 0;
  const norm = (s?: string) => (s || "").toLowerCase().replace(/\s+/g, "");
  const subj = norm(meta.subjectName);
  const code = norm(meta.subjectCode);
  const grade = norm(meta.gradeLevel);
  const aSubj = norm(a.subjectName);
  const aCode = norm(a.subjectCode);
  const aGrade = norm(a.gradeLevel);
  const aRoom = norm(a.classroomName);

  if (code && aCode && code === aCode) score += 10;
  if (subj && aSubj) {
    if (subj === aSubj) score += 8;
    else if (aSubj.includes(subj) || subj.includes(aSubj)) score += 5;
  }
  if (grade && (aGrade === grade || aRoom.startsWith(grade))) score += 3;
  return score;
}

/** Pick best matching assignment for a parsed file's meta. */
export function pickBestAssignment(
  assignments: MyTeacherAssignment[],
  meta: { subjectName?: string; subjectCode?: string; gradeLevel?: string }
): MyTeacherAssignment | undefined {
  let best: MyTeacherAssignment | undefined;
  let bestScore = 0;
  for (const a of assignments) {
    const s = scoreAssignmentMatch(a, meta);
    if (s > bestScore) {
      best = a;
      bestScore = s;
    }
  }
  return bestScore > 0 ? best : undefined;
}
