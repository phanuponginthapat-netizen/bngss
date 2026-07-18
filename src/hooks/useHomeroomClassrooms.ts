import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Returns the classroom IDs that belong to the current teacher's homeroom.
 * - For admin/director: returns null (no filter, see all)
 * - For teacher: returns matching classroom IDs based on personnel name
 * - For student: returns their own classroom_id
 */
export function useHomeroomClassrooms() {
  const { role, userId, isAdmin, isDirector, isTeacher, isStudent } = useUserRole();

  // Get teacher's personnel record (need id to match classrooms.homeroom_teacher_id)
  const { data: personnel } = useQuery({
    queryKey: ["my_personnel", userId],
    enabled: isTeacher && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  // Get student's classroom
  const { data: myStudent } = useQuery({
    queryKey: ["my_student_classroom", userId],
    enabled: isStudent && !!userId,
    queryFn: async () => {
      // 1) Try direct link: students.auth_user_id
      const { data: byAuth } = await supabase
        .from("students")
        .select("id, classroom_id")
        .eq("auth_user_id", userId!)
        .maybeSingle();
      if (byAuth) return byAuth;

      // 2) Fallback: profiles.student_code → students.student_code
      const { data: profile } = await supabase
        .from("profiles")
        .select("student_code")
        .eq("id", userId!)
        .maybeSingle();
      if (!profile?.student_code) return null;
      const { data: student } = await supabase
        .from("students")
        .select("id, classroom_id")
        .eq("student_code", profile.student_code)
        .maybeSingle();
      return student;
    },
  });

  // Get all classrooms — match by homeroom_teacher_id (uuid), with name as fallback for legacy rows
  const { data: classrooms = [] } = useQuery({
    queryKey: ["all-classrooms"],
    enabled: isTeacher && !!personnel,
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
    staleTime: 30_000,
  });

  const teacherFullName = useMemo(() => {
    if (!personnel) return null;
    return `${personnel.prefix || ""}${personnel.first_name} ${personnel.last_name}`;
  }, [personnel]);

  // Loose Thai matching kept only as fallback for legacy rows where the uuid columns are empty
  const thaiLoose = (s?: string | null) => {
    if (!s) return "";
    return s
      .replace(/[\u0E48-\u0E4E\u0E3A]/g, "")
      .replace(/^(ครู|นาง\s?สาว|นางสาว|นาง|นาย|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  };

  const homeroomClassroomIds = useMemo(() => {
    if (isAdmin || isDirector) return null; // no filter
    if (isStudent) {
      return myStudent?.classroom_id ? [myStudent.classroom_id] : [];
    }
    if (isTeacher && personnel) {
      const candidates = [
        teacherFullName,
        `${personnel.first_name} ${personnel.last_name}`,
        `ครู${personnel.first_name}`,
      ]
        .filter(Boolean)
        .map((n) => thaiLoose(n));
      const ids = classrooms
        .filter((c: any) => {
          // Primary: uuid match (authoritative)
          if (c.homeroom_teacher_id === personnel.id) return true;
          if (c.homeroom_teacher_2_id === personnel.id) return true;
          // Fallback: name match only when classroom has no uuid linked at all
          if (!c.homeroom_teacher_id && !c.homeroom_teacher_2_id) {
            const a = thaiLoose(c.homeroom_teacher);
            const b = thaiLoose(c.homeroom_teacher_2);
            return candidates.some((cand) => cand && (cand === a || cand === b));
          }
          return false;
        })
        .map((c: any) => c.id);
      return ids;
    }
    return null;
  }, [isAdmin, isDirector, isStudent, isTeacher, teacherFullName, personnel, classrooms, myStudent]);

  const homeroomClassrooms = useMemo(() => {
    if (!homeroomClassroomIds) return null;
    return classrooms.filter((c: any) => homeroomClassroomIds.includes(c.id));
  }, [homeroomClassroomIds, classrooms]);

  return {
    /** null = no filter (admin/director), [] = no homeroom assigned, [...ids] = filtered */
    homeroomClassroomIds,
    homeroomClassrooms,
    teacherFullName,
    isFiltered: homeroomClassroomIds !== null,
    hasHomeroom: homeroomClassroomIds !== null && homeroomClassroomIds.length > 0,
  };
}
