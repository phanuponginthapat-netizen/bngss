import { ReactNode } from "react";
import { SchoolDepartment } from "@/hooks/useUserDepartments";

interface Props {
  children: ReactNode;
  /** คงไว้เพื่อ backward-compat — ไม่มีการกรองแล้ว สิทธิ์คุมที่ระดับ role/menu/RLS */
  departments?: SchoolDepartment[];
  bypassRoles?: ("teacher" | "student" | "alumni" | "director" | "parent")[];
}

// ยกเลิกการกรองตามฝ่ายงาน (user request) — ปล่อยผ่านทั้งหมด
// การเข้าถึงคุมด้วย role + ModuleGuard + RLS แทน
export default function DepartmentRoute({ children }: Props) {
  return <>{children}</>;
}
