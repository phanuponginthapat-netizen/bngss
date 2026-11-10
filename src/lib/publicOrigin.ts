const PUBLISHED_ORIGIN = "https://bngss.lovable.app";
const SCHOOL_ORIGINS = new Set([
  PUBLISHED_ORIGIN,
  "https://www.bngss.online",
  "https://bngss.online",
]);

/** Preserve the school's current domain, but never share preview/local URLs. */
export function getSchoolPublicOrigin(origin = window.location.origin): string {
  return SCHOOL_ORIGINS.has(origin) ? origin : PUBLISHED_ORIGIN;
}