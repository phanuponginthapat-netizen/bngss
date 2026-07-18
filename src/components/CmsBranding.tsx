import { useCmsTheme } from "@/hooks/useCmsTheme";
import { useSystemSettings } from "@/hooks/useSystemSettings";

/**
 * Mounts global CMS bindings: theme colors (CSS vars), document title, favicon, manifest.
 * Render once inside QueryClientProvider so all routes (public + dashboard) inherit CMS branding.
 */
export default function CmsBranding() {
  useCmsTheme();
  useSystemSettings();
  return null;
}
