import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";

export type AppRole =
  | "admin"
  | "teacher"
  | "student"
  | "director"
  | "alumni"
  | "parent";

const VIEW_MODE_KEY = "view_mode_override";

async function fetchUserRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data?.role as AppRole) || null;
}

function readOverride(): "admin" | "teacher" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(VIEW_MODE_KEY);
  return v === "teacher" || v === "admin" ? v : null;
}

/**
 * Central role hook.
 * - `role` = **effective** role after view-mode override (ทั้งระบบใช้ตัวนี้)
 * - `realRole` = สิทธิ์จริงจาก user_roles (สำหรับปุ่มสลับเท่านั้น)
 *
 * เมื่อ admin ที่มีข้อมูล personnel สลับเป็นโหมด "ครู" — ทุก hook flag
 * (isAdmin/isTeacher/…) จะสะท้อนบทบาทครูทันที ทั้ง sidebar/dashboard/
 * page guards จึงเปลี่ยนโดยอัตโนมัติ ไม่ต้องแก้ทีละหน้า
 */
export function useUserRole() {
  const { isReady, user } = useAuthSession();
  const userId = user?.id ?? null;

  const roleQuery = useQuery({
    queryKey: ["user-role", userId],
    enabled: isReady && !!userId,
    queryFn: async () => fetchUserRole(userId!),
    staleTime: 5 * 60 * 1000,
  });

  const realRole = userId
    ? roleQuery.isSuccess
      ? roleQuery.data || null
      : null
    : null;

  // ตรวจว่า admin คนนี้มี personnel record → เป็น "ครูที่เป็น admin"
  const teacherAdminQuery = useQuery({
    queryKey: ["is-teacher-admin", userId],
    enabled: isReady && !!userId && realRole === "admin",
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("personnel")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("status", "active");
      return (count || 0) > 0;
    },
  });
  const isTeacherAdmin = realRole === "admin" && !!teacherAdminQuery.data;

  // อ่าน override + sync ข้าม tab
  const [override, setOverride] = useState<"admin" | "teacher" | null>(readOverride);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === VIEW_MODE_KEY) setOverride(readOverride());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Effective role = ที่ระบบใช้จริงในทุก UI
  const role: AppRole | null =
    isTeacherAdmin && override === "teacher" ? "teacher" : realRole;

  const loading = !isReady || (!!userId && roleQuery.isPending);

  const isAdmin = role === "admin";
  const isDirector = role === "director";
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const isAlumni = role === "alumni";
  const isParent = role === "parent";

  return {
    role,
    realRole,
    isTeacherAdmin,
    loading,
    userId,
    isAdmin,
    isDirector,
    isTeacher,
    isStudent,
    isAlumni,
    isParent,
    // Backward compat (always false now)
    isSuperAdmin: false,
    isAreaAdmin: false,
    isSchoolAdmin: false,
  };
}
