import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { subjectInSelectionTerm } from "@/lib/subjectSelectionTerm";
import { useAcademicYear } from "./useAcademicYear";

/** Catalog for task choices only; historical lookups keep their complete catalog. */
export function useTermSubjects(academicYear?: number, semester?: number) {
  const calendar = useAcademicYear();
  const term = { academicYear: academicYear ?? calendar.currentAcademicYear, semester: semester ?? calendar.currentSemester };
  const query = useQuery({
    queryKey: ["term-subject-options", term.academicYear, term.semester],
    enabled: calendar.isReady && term.academicYear > 0 && [1, 2].includes(term.semester),
    queryFn: async () => {
      const rows = await fetchAllRows((from, to) => supabase.from("subjects").select("*").order("code").order("id").range(from, to));
      return rows.filter(row => subjectInSelectionTerm(row, term));
    },
  });
  return { ...query, data: calendar.isReady ? query.data : undefined, error: calendar.error || query.error };
}