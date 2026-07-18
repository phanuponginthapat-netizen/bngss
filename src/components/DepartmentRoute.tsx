import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { SchoolDepartment, useUserDepartments } from "@/hooks/useUserDepartments";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
  /** ฝ่ายที่อนุญาตเข้าถึง — ต้องอยู่ในฝ่ายใดฝ่ายหนึ่ง (อย่างน้อยตำแหน่ง member) */
  departments?: SchoolDepartment[];
  /** role ที่ข้ามการตรวจฝ่าย (เช่น parent/student ที่ดูข้อมูลของตัวเอง) */
  bypassRoles?: ("teacher" | "student" | "alumni" | "director" | "admin" | "parent")[];
}

/**
 * คุมการเข้าถึงตามฝ่ายงาน: ต้องอยู่ในฝ่ายที่กำหนด (member ขึ้นไป)
 * - admin/director ผ่านเสมอ
 * - role ใน bypassRoles ผ่านเสมอ (เพราะใช้ดูข้อมูลของตัวเอง ไม่ใช่งานฝ่าย)
 */
export default function DepartmentRoute({ children, departments, bypassRoles = [] }: Props) {
  const location = useLocation();
  const { role, loading: roleLoading } = useUserRole();
  const { hasDepartment, isPrivileged, loading } = useUserDepartments();

  // bypass ตาม role
  if (role && bypassRoles.includes(role as any)) return <>{children}</>;
  // admin / director ผ่านเสมอ
  if (isPrivileged) return <>{children}</>;
  // ไม่ระบุฝ่าย → ผ่าน
  if (!departments || departments.length === 0) return <>{children}</>;

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ต้องอยู่ในฝ่ายอย่างน้อยหนึ่งฝ่าย
  if (departments.some((d) => hasDepartment(d))) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <ShieldAlert className="h-14 w-14 text-amber-500" />
      <div>
        <h2 className="text-xl font-semibold mb-1">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          หน้านี้อยู่ภายใต้ฝ่ายที่ท่านไม่ได้สังกัด หากต้องการเข้าถึง
          กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มท่านเข้าฝ่ายที่เกี่ยวข้อง
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/dashboard" state={{ from: location }}>กลับหน้าหลัก</Link>
      </Button>
    </div>
  );
}
