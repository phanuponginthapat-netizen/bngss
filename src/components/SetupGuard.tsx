import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getBackendConfig } from "@/lib/runtimeConfig";
import SystemLoader from "@/components/SystemLoader";

/**
 * ป้องกันหน้า /setup
 * - ถ้ายังไม่ได้ตั้งค่า backend (bootstrap ครั้งแรก) → เข้าได้เลย
 * - ถ้าตั้งค่าแล้ว → ต้องเป็น admin/director เท่านั้น
 */
export default function SetupGuard({ children }: { children: React.ReactNode }) {
  const cfg = getBackendConfig();
  const configured = Boolean(cfg?.url && cfg?.anonKey);
  const { isReady, session } = useAuthSession();
  const { role, realRole, loading } = useUserRole();

  if (!configured) return <>{children}</>;
  if (!isReady || loading) return <SystemLoader />;
  if (!session) return <Navigate to="/login" replace />;

  const allowed = ["admin", "director"];
  if (!allowed.includes(role || "") && !allowed.includes(realRole || "")) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
