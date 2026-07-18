import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";

export type AppRole =
  | "admin"
  | "teacher"
  | "student"
  | "director"
  | "alumni"
  | "parent"
  | "observer";

const ROLE_OVERRIDE_KEY = "role_override_v1";
const ROLE_OVERRIDE_EVENT = "role-override-changed";

export function getRoleOverride(): AppRole | null {
  try {
    const v = localStorage.getItem(ROLE_OVERRIDE_KEY);
    return v ? (v as AppRole) : null;
  } catch {
    return null;
  }
}

export function setRoleOverride(role: AppRole | null) {
  try {
    if (role) localStorage.setItem(ROLE_OVERRIDE_KEY, role);
    else localStorage.removeItem(ROLE_OVERRIDE_KEY);
    window.dispatchEvent(new Event(ROLE_OVERRIDE_EVENT));
  } catch {}
}

function useRoleOverride() {
  const [override, setOverride] = useState<AppRole | null>(() => getRoleOverride());
  useEffect(() => {
    const handler = () => setOverride(getRoleOverride());
    window.addEventListener(ROLE_OVERRIDE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(ROLE_OVERRIDE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return override;
}

async function fetchUserRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as AppRole) || null;
}


export function useUserRole() {
  const { isReady, user, error: authError } = useAuthSession();
  const userId = user?.id ?? null;
  const override = useRoleOverride();

  const roleQuery = useQuery({
    queryKey: ["user-role", userId],
    enabled: isReady && !!userId,
    queryFn: async () => fetchUserRole(userId!),
    staleTime: 5 * 60 * 1000,
  });

  const actualRole = userId
    ? roleQuery.isSuccess
      ? roleQuery.data || null
      : null
    : null;

  // Only admins are allowed to impersonate "teacher" mode.
  const effectiveRole: AppRole | null =
    actualRole === "admin" && override === "teacher" ? "teacher" : actualRole;

  const role = effectiveRole;
  const loading = !isReady || (!!userId && roleQuery.isPending);
  const queryError = roleQuery.error instanceof Error ? roleQuery.error.message : roleQuery.error ? String(roleQuery.error) : null;
  const error = authError || queryError;

  const isAdmin = role === "admin";
  const isDirector = role === "director";
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const isAlumni = role === "alumni";
  const isParent = role === "parent";
  const isObserver = role === "observer";

  return {
    role,
    actualRole,
    canSwitchRole: actualRole === "admin",
    isImpersonating: actualRole === "admin" && role !== "admin",
    loading,
    error,
    refetchRole: roleQuery.refetch,
    userId,
    isAdmin,
    isDirector,
    isTeacher,
    isStudent,
    isAlumni,
    isParent,
    isObserver,
    // Backward compat (always false now)
    isSuperAdmin: false,
    isAreaAdmin: false,
    isSchoolAdmin: false,
  };
}
