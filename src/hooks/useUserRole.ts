import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { setReadOnly } from "@/lib/readOnlyMode";

export type AppRole =
  | "admin"
  | "teacher"
  | "student"
  | "director"
  | "alumni"
  | "parent"
  | "observer";

const VIEW_MODE_KEY = "view_mode_override";

async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error || !data) return [];
  return data.map((r) => r.role as AppRole);
}

function readOverride(): "admin" | "teacher" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(VIEW_MODE_KEY);
  return v === "teacher" || v === "admin" ? v : null;
}

/**
 * Central role hook.
 * - `role` = effective role after view-mode override (used across UI)
 * - `realRole` = actual primary role from user_roles
 * - `isObserver` = true if user has the "observer" role (ศน. read-only)
 *   Observer accounts get a secondary "director" role for broad SELECT
 *   visibility; UI role is reported as "director" so sidebar shows all
 *   admin/director sections, and setReadOnly(true) blocks every mutating
 *   HTTP request via a global fetch interceptor.
 */
export function useUserRole() {
  const { isReady, user } = useAuthSession();
  const userId = user?.id ?? null;

  const rolesQuery = useQuery({
    queryKey: ["user-roles", userId],
    enabled: isReady && !!userId,
    queryFn: async () => fetchUserRoles(userId!),
    staleTime: 5 * 60 * 1000,
  });

  const roles: AppRole[] = userId && rolesQuery.isSuccess ? rolesQuery.data : [];
  const isObserver = roles.includes("observer");

  // Toggle the global read-only fetch interceptor whenever observer status changes
  useEffect(() => {
    setReadOnly(isObserver);
  }, [isObserver]);

  // Pick primary role. Observer → director (so RLS-visible + full nav).
  // Priority order matches previous behavior for non-observer accounts.
  const priority: AppRole[] = [
    "admin",
    "director",
    "teacher",
    "parent",
    "student",
    "alumni",
    "observer",
  ];
  const primary = priority.find((r) => roles.includes(r)) ?? null;
  const realRole: AppRole | null = isObserver ? "director" : primary;

  // Detect "teacher who is also admin" for view-mode toggle
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

  const [override, setOverride] = useState<"admin" | "teacher" | null>(readOverride);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === VIEW_MODE_KEY) setOverride(readOverride());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const role: AppRole | null =
    isTeacherAdmin && override === "teacher" ? "teacher" : realRole;

  const loading = !isReady || (!!userId && rolesQuery.isPending);

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
    isObserver,
    readOnly: isObserver,
    // Backward compat (always false now)
    isSuperAdmin: false,
    isAreaAdmin: false,
    isSchoolAdmin: false,
  };
}
