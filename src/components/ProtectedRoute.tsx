import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isReady, session } = useAuthSession();
  const { role, loading, userId } = useUserRole();
  const location = useLocation();

  // Check if user has linked their account (only matters for OAuth users)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-link-status", userId],
    enabled: isReady && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("account_linked, employee_code, student_code")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
    staleTime: 60 * 1000,
  });

  if (!isReady || loading || (userId && profileLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session || !userId) {
    return <Navigate to="/login" replace />;
  }

  // Admin-level roles bypass account linking requirement
  const isAdminRole = role === "admin" || role === "director";
  const provider = session.user.app_metadata?.provider;
  const needsOauthLinking = provider && provider !== "email";

  // Force account linking only for OAuth users with no linked school record yet.
  const hasCode = Boolean(profile?.employee_code || profile?.student_code);
  const linked = profile?.account_linked === true || hasCode;
  if (!isAdminRole && needsOauthLinking && !linked && !hasCode && location.pathname !== "/link-account") {
    return <Navigate to="/link-account" replace />;
  }

  if (!role) {
    // Allow link-account page even without role
    if (location.pathname === "/link-account") return <>{children}</>;
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold text-destructive mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
