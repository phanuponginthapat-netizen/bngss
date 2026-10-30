export type CmsMap = Record<string, string>;
export const CMS_CACHE_KEY = "cms_settings_bulk_v3";
export const CMS_CACHE_TTL = 24 * 60 * 60 * 1000;

export function parseCmsCache(raw: string | null, backend: string, now: number) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.backend !== backend || !Number.isFinite(parsed.at) ||
        parsed.at > now || now - parsed.at > CMS_CACHE_TTL ||
        !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data) ||
        !Object.keys(parsed.data).length ||
        !Object.values(parsed.data).every(value => typeof value === "string")) return null;
    return { at: parsed.at as number, data: parsed.data as CmsMap };
  } catch { return null; }
}