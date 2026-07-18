import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared query สำหรับหน้า Transcript / ReportCard / Pp7 / Certificate / Vaccine
 * — ทุกหน้าใช้ queryKey เดียวกัน (`students_with_class`) จึงแชร์ cache ผ่าน TanStack Query
 * — staleTime 10 นาที + refetchOnMount:false เพื่อไม่ให้ยิง DB ซ้ำเมื่อสลับหน้า
 * — invalidate อัตโนมัติผ่าน useGlobalRealtime (มี key นี้อยู่แล้ว)
 */
export function useStudentsWithClass() {
  return useQuery({
    queryKey: ["students_with_class"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*, classrooms!students_classroom_id_fkey(*)")
        .eq("status", "active")
        .order("student_code");
      return data || [];
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
