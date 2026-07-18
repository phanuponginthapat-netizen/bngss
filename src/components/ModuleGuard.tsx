import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { getModuleKeyForPath, MODULES } from "@/lib/moduleRegistry";

/**
 * Redirects users away from pages that belong to disabled modules.
 * Mounted once inside DashboardLayout — does not render anything.
 */
export function ModuleGuard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isModuleEnabled } = useModuleToggles();
  const lastBlocked = useRef<string | null>(null);

  useEffect(() => {
    const key = getModuleKeyForPath(pathname);
    if (key && !isModuleEnabled(key)) {
      if (lastBlocked.current !== pathname) {
        lastBlocked.current = pathname;
        const m = MODULES.find((x) => x.key === key);
        toast.error("โมดูลนี้ถูกปิดใช้งาน", {
          description: m ? `"${m.label}" ถูกผู้ดูแลปิดไว้` : undefined,
        });
      }
      navigate("/dashboard", { replace: true });
    }
  }, [pathname, isModuleEnabled, navigate]);

  return null;
}
