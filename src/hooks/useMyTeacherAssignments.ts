import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchPpSubject } from "@/lib/ppSubjectMatching";

export interface MyTeacherAssignment {
  id: string;
  subject_id: string;
  classroom_id: string;
  subjectName: string;
  subjectCode?: string;
  gradeLevel: string;
  classroomName: string;
  semester?: number;
  academicYear?: number;
  subjectSemester?: number | null;
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
      const { data: p, error: personnelError } = await supabase
        .from("personnel")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (personnelError) throw personnelError;
      const personnelId = p?.id || null;
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("teacher_assignments")
        .select("id, subject_id, classroom_id, semester, academic_year, subjects(name_th, code, semester), classrooms(name, grade_level)")
        .eq("personnel_id", personnelId)
        .order("created_at", { ascending: false });
      if (error) throw error;


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
          semester: r.semester,
          academicYear: r.academic_year > 2400 ? r.academic_year - 543 : r.academic_year,
          subjectSemester: r.subjects.semester,
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
  meta: { subjectName?: string; subjectCode?: string; gradeLevel?: string; semester?: number; academicYear?: number }
): number {
  if (!meta.academicYear || !meta.semester) return 0;
  const year = meta.academicYear > 2400 ? meta.academicYear - 543 : meta.academicYear;
  if (a.academicYear !== year || a.semester !== meta.semester) return 0;
  return matchPpSubject([{ id: a.subject_id, code: a.subjectCode, name_th: a.subjectName, grade_level: a.gradeLevel, semester: a.subjectSemester }], meta.subjectName ?? "", {
    gradeLevel: meta.gradeLevel, semester: meta.semester, academicYear: year,
  }, meta.subjectCode) ? 10 : 0;
}

/** Pick best matching assignment for a parsed file's meta. */
export function pickBestAssignment(
  assignments: MyTeacherAssignment[],
  meta: { subjectName?: string; subjectCode?: string; gradeLevel?: string; semester?: number; academicYear?: number; classroomName?: string }
): MyTeacherAssignment | undefined {
  const matches = assignments.filter(a => scoreAssignmentMatch(a, meta) > 0);
  const rooms = meta.classroomName ? matches.filter(a => a.classroomName.replace(/\s/g, "") === meta.classroomName?.replace(/\s/g, "")) : matches;
  return rooms.length === 1 ? rooms[0] : undefined;
}
