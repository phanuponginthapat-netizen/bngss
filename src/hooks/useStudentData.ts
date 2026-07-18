import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useHomeroomClassrooms } from "@/hooks/useHomeroomClassrooms";
import { sortGrades } from "@/lib/gradeOrder";
import { effectiveGrade } from "@/lib/classroomGrade";


/**
 * Centralized hook for student-related pages.
 * Provides shared queries (students, classrooms) with consistent cache keys,
 * homeroom auto-filtering, and grade/classroom filter state.
 *
 * Eliminates duplicated queries across Attendance, Behavior, HomeVisit,
 * Homeroom, SDQ, Screening, and Leave pages.
 */
export function useStudentData(options?: {
  /** Skip auto-setting classroom filter for homeroom teachers */
  skipAutoFilter?: boolean;
  /** Initial value for classroom filter (overridden by homeroom if teacher) */
  initialClassroom?: string;
}) {
  const { homeroomClassroomIds, isFiltered, teacherFullName } = useHomeroomClassrooms();

  // ─── Shared queries with stable keys ───
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["active-students-with-class"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*, classrooms!students_classroom_id_fkey(name, grade_level)")
        .eq("status", "active")
        .order("student_code");
      return data || [];
    },
    staleTime: 30_000,
  });

  const { data: classrooms = [], isLoading: classroomsLoading } = useQuery({
    queryKey: ["all-classrooms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("classrooms")
        .select("*")
        .order("grade_level")
        .order("name");
      return data || [];
    },
    staleTime: 30_000,
  });

  // ─── Homeroom-scoped classrooms ───
  const availableClassrooms = useMemo(() => {
    if (!isFiltered || !homeroomClassroomIds) return classrooms;
    return classrooms.filter((c: any) => homeroomClassroomIds.includes(c.id));
  }, [classrooms, isFiltered, homeroomClassroomIds]);

  // ─── Filter state ───
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [classroomFilter, setClassroomFilter] = useState(
    options?.initialClassroom || "all"
  );

  // Auto-set classroom for homeroom teachers
  useEffect(() => {
    if (options?.skipAutoFilter) return;
    if (
      isFiltered &&
      homeroomClassroomIds &&
      homeroomClassroomIds.length > 0 &&
      (classroomFilter === "all" || classroomFilter === "")
    ) {
      setClassroomFilter(homeroomClassroomIds[0]);
    }
  }, [isFiltered, homeroomClassroomIds, options?.skipAutoFilter]);

  // ─── Derived data ───
  const gradeOptions = useMemo(() => {
    return sortGrades([...new Set(availableClassrooms.map((c: any) => effectiveGrade(c)).filter(Boolean))]);
  }, [availableClassrooms]);

  const filteredClassrooms = useMemo(() => {
    if (gradeFilter === "all") return availableClassrooms;
    return availableClassrooms.filter((c: any) => effectiveGrade(c) === gradeFilter);
  }, [availableClassrooms, gradeFilter]);


  const filteredStudents = useMemo(() => {
    let result = students;
    const q = search.trim().toLowerCase();
    const hasSearch = q.length > 0;

    // Scope to homeroom if teacher (always — security/UX boundary)
    if (isFiltered && homeroomClassroomIds) {
      result = result.filter((s: any) => homeroomClassroomIds.includes(s.classroom_id));
    }

    // Apply grade/classroom filters only when there is no active search,
    // so typing a student code/name always finds the student regardless of
    // which class is currently selected in the dropdowns.
    if (!hasSearch) {
      if (gradeFilter !== "all") {
        const classroomIds = filteredClassrooms.map((c: any) => c.id);
        result = result.filter((s: any) => classroomIds.includes(s.classroom_id));
      }
      if (classroomFilter !== "all" && classroomFilter !== "") {
        result = result.filter((s: any) => s.classroom_id === classroomFilter);
      }
    } else {
      result = result.filter(
        (s: any) =>
          s.student_code?.toLowerCase().includes(q) ||
          `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase().includes(q) ||
          `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.toLowerCase().includes(q)
      );
    }

    return result;
  }, [students, isFiltered, homeroomClassroomIds, gradeFilter, classroomFilter, search, filteredClassrooms]);

  // Exact match by student_code (typed in search) — pages can auto-select on this
  const exactMatch = useMemo(() => {
    const q = search.trim();
    if (!q) return null;
    return filteredStudents.find((s: any) => s.student_code === q) || null;
  }, [filteredStudents, search]);


  return {
    // Raw data
    students,
    classrooms,
    availableClassrooms,
    isLoading: studentsLoading || classroomsLoading,

    // Filter state
    search,
    setSearch,
    gradeFilter,
    setGradeFilter: (v: string) => {
      setGradeFilter(v);
      setClassroomFilter("all");
    },
    classroomFilter,
    setClassroomFilter,

    // Derived
    gradeOptions,
    filteredClassrooms,
    filteredStudents,
    exactMatch,


    // Homeroom info
    isFiltered,
    homeroomClassroomIds,
    teacherFullName,
  };
}
