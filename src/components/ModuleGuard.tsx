import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { getModuleKeyForPath, MODULES } from "@/lib/moduleRegistry";

/**
 * Disabled modules are fully hidden: any direct link to them is redirected
 * silently, and every in-page link pointing at them is hidden via CSS.
 * Mounted once inside DashboardLayout.
 */
export function ModuleGuard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isModuleEnabled, disabledKeys } = useModuleToggles();

  useEffect(() => {
    const key = getModuleKeyForPath(pathname);
    if (key && !isModuleEnabled(key)) navigate("/dashboard", { replace: true });
  }, [pathname, isModuleEnabled, navigate]);

  const css = useMemo(() => {
    const sel: string[] = [];
    for (const m of MODULES) {
      if (!disabledKeys.has(m.key)) continue;
      for (const p of m.urlPrefixes) {
        sel.push(`a[href="${p}"]`, `a[href^="${p}/"]`, `a[href^="${p}?"]`);
      }
    }
    return sel.length ? `${sel.join(",")}{display:none!important}` : "";
  }, [disabledKeys]);

  return css ? <style data-module-guard>{css}</style> : null;
}
