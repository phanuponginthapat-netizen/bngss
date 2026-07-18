import { useSystemSettings } from "@/hooks/useSystemSettings";

/** Mounted once at app root so CMS theme colors / title / favicon apply globally */
const ThemeApplier = () => {
  useSystemSettings();
  return null;
};

export default ThemeApplier;
