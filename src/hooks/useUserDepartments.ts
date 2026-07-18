import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export type SchoolDepartment =
  | "academic"
  | "student_affairs"
  | "general_admin"
  | "personnel"
  | "budget_planning"
  | "director_office"
  | "finance_personnel"; // deprecated

export type DeptPosition = "head" | "deputy" | "assistant" | "member";

const POSITION_RANK: Record<DeptPosition, number> = {
  member: 0,
  assistant: 1,
  deputy: 2,
  head: 3,
};

/**
 * โหลดฝ่ายงานของ user ปัจจุบัน พร้อมตำแหน่งในฝ่าย
 * - admin/director ถือว่ามีทุกฝ่ายในตำแหน่ง head
 * - role อื่นใช้ user_departments เป็นเกณฑ์
 */
export function useUserDepartments() {
  const { userId, role, loading: roleLoading } = useUserRole();

  const isPrivileged = role === "admin" || role === "director";

  const q = useQuery({
    queryKey: ["my-departments", userId],
    enabled: !!userId && !roleLoading && !!role && !isPrivileged,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_departments")
        .select("department, is_head, position")
        .eq("user_id", userId!);
      if (error) return [];
      return (data || []) as {
        department: SchoolDepartment;
        is_head: boolean;
        position: DeptPosition;
      }[];
    },
  });

  const allDepts: SchoolDepartment[] = [
    "academic",
    "student_affairs",
    "general_admin",
    "personnel",
    "budget_planning",
    "director_office",
  ];

  const departments: SchoolDepartment[] = isPrivileged
    ? allDepts
    : (q.data || []).map((d) => d.department);

  const positionMap = new Map<SchoolDepartment, DeptPosition>(
    isPrivileged
      ? allDepts.map((d) => [d, "head" as DeptPosition])
      : (q.data || []).map((d) => [d.department, (d.position || "member") as DeptPosition])
  );

  const headOf = new Set(
    Array.from(positionMap.entries())
      .filter(([, p]) => p === "head")
      .map(([d]) => d)
  );

  const meetsPosition = (d: SchoolDepartment, min: DeptPosition) => {
    if (isPrivileged) return true;
    const p = positionMap.get(d);
    if (!p) return false;
    return POSITION_RANK[p] >= POSITION_RANK[min];
  };

  return {
    departments,
    headOf,
    positionMap,
    positionIn: (d: SchoolDepartment): DeptPosition | null =>
      positionMap.get(d) || (isPrivileged ? "head" : null),
    hasDepartment: (d: SchoolDepartment) => isPrivileged || departments.includes(d),
    isHeadOf: (d: SchoolDepartment) => isPrivileged || headOf.has(d),
    isDeputyOf: (d: SchoolDepartment) => meetsPosition(d, "deputy"),
    isAssistantOf: (d: SchoolDepartment) => meetsPosition(d, "assistant"),
    /** มีสิทธิ์บริหาร (head หรือ deputy) ในฝ่ายนี้ */
    canManageDept: (d: SchoolDepartment) => meetsPosition(d, "deputy"),
    isPrivileged,
    loading: roleLoading || (!isPrivileged && q.isLoading),
  };
}
