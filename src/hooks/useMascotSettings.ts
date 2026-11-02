import { useCmsSettingsBulk } from "./useCmsSettings";
import defaultHappy from "@/assets/mascot-happy.png";
import defaultNeutral from "@/assets/mascot-neutral.png";
import defaultWorried from "@/assets/mascot-worried.png";
import defaultBg from "@/assets/mascot-bg-school.jpg";

export interface MascotSettings {
  name: string;
  happyUrl: string;
  neutralUrl: string;
  worriedUrl: string;
  backgroundUrl: string;
}

export const MASCOT_DEFAULTS = { happy: defaultHappy, neutral: defaultNeutral, worried: defaultWorried, bg: defaultBg };

const activeHost = (() => {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL).host; } catch { return ""; }
})();

/** Drop file links that point to a different (retired) backend — they never load and slow the page. */
export function usableMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).host;
    if (host.endsWith(".supabase.co") && activeHost && host !== activeHost) return null;
  } catch { /* relative path */ }
  return url;
}

export function useMascotSettings(): MascotSettings {
  const { data } = useCmsSettingsBulk();
  return {
    name: data?.mascot_name || "",
    happyUrl: usableMediaUrl(data?.mascot_happy_url) || defaultHappy,
    neutralUrl: usableMediaUrl(data?.mascot_neutral_url) || defaultNeutral,
    worriedUrl: usableMediaUrl(data?.mascot_worried_url) || defaultWorried,
    backgroundUrl: usableMediaUrl(data?.mascot_bg_url) || defaultBg,
  };
}
