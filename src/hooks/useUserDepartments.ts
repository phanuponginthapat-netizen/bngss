import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export type SchoolDepartment =
  | "academic"
  | "student_affairs"
  | "general_admin"
  | "finance_personnel"
  | "director_office";

export type DeptRole = "member" | "head" | "deputy_head" | "section_head";

export const DEPT_ROLE_LABEL_TH: Record<DeptRole, string> = {
  member: "สมาชิก",
  head: "หัวหน้าฝ่าย",
  deputy_head: "รองหัวหน้าฝ่าย",
  section_head: "หัวหน้าหมวด",
};

/**
 * โหลดฝ่ายงานของ user ปัจจุบัน
 * - admin/director มองเห็นทุกอย่างเสมอ (ถือว่ามีทุกฝ่าย)
 * - role อื่น ๆ ใช้ user_departments เป็นเกณฑ์
 */
export function useUserDepartments() {
  const { userId, role, loading: roleLoading } = useUserRole();

  const q = useQuery({
    queryKey: ["my-departments", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_departments")
        .select("department, is_head, dept_role")
        .eq("user_id", userId!);
      if (error) return [];
      return (data || []) as { department: SchoolDepartment; is_head: boolean; dept_role: DeptRole }[];
    },
  });

  // ระบบ/ผู้ดูแล = admin/director เท่านั้น
  const isPrivileged = role === "admin" || role === "director";
  // ยังไม่มีการกำหนดฝ่ายงาน/หัวหน้างาน → บุคลากรทุกคน (รวมครู) เข้าถึงงานได้ทุกฝ่าย
  const allDeptAccess = isPrivileged || role === "teacher";
  const departments: SchoolDepartment[] = allDeptAccess
    ? ["academic", "student_affairs", "general_admin", "finance_personnel", "director_office"]
    : (q.data || []).map((d) => d.department);

  const headOf = new Set((q.data || []).filter((d) => d.is_head).map((d) => d.department));
  const roleByDept = new Map<SchoolDepartment, DeptRole>(
    (q.data || []).map((d) => [d.department, d.dept_role])
  );

  return {
    departments,
    headOf,
    hasDepartment: (d: SchoolDepartment) => allDeptAccess || departments.includes(d),
    isHeadOf: (d: SchoolDepartment) => isPrivileged || headOf.has(d),
    isDeputyOf: (d: SchoolDepartment) => roleByDept.get(d) === "deputy_head",
    isSectionHeadOf: (d: SchoolDepartment) => roleByDept.get(d) === "section_head",
    roleIn: (d: SchoolDepartment): DeptRole | null =>
      isPrivileged ? "head" : roleByDept.get(d) ?? null,
    isPrivileged,
    loading: roleLoading || q.isLoading,
  };

}
