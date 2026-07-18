import { SchoolDepartment, useUserDepartments } from "./useUserDepartments";

export interface DeptAccess {
  /** ดูข้อมูลของฝ่ายได้ (member ขึ้นไป) */
  canView: boolean;
  /** สร้าง/แก้ไขข้อมูลของฝ่ายได้ (member ขึ้นไป — ทุกตำแหน่ง) */
  canWrite: boolean;
  /** ลบข้อมูล (เฉพาะหัวหน้าฝ่าย / admin / director) */
  canDelete: boolean;
  /** อนุมัติ (เฉพาะหัวหน้าฝ่าย / admin / director) */
  canApprove: boolean;
  loading: boolean;
}

/**
 * Hook สำหรับเช็คสิทธิ์ตามฝ่ายในระดับ component
 * ใช้สำหรับซ่อน/disable ปุ่มลบ/อนุมัติเมื่อไม่ใช่หัวหน้าฝ่าย
 *
 * @example
 * const { canDelete } = useDeptAccess("academic");
 * <Button disabled={!canDelete} onClick={handleDelete}>ลบ</Button>
 */
export function useDeptAccess(department: SchoolDepartment | SchoolDepartment[]): DeptAccess {
  const { hasDepartment, isHeadOf, isPrivileged, loading } = useUserDepartments();
  const depts = Array.isArray(department) ? department : [department];

  const inAnyDept = isPrivileged || depts.some((d) => hasDepartment(d));
  const headInAny = isPrivileged || depts.some((d) => isHeadOf(d));

  return {
    canView: inAnyDept,
    canWrite: inAnyDept,
    canDelete: headInAny,
    canApprove: headInAny,
    loading,
  };
}
