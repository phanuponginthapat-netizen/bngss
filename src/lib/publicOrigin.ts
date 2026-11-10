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

/** Compatibility for kiosk setup: do not suggest a preview as a public site. */
export function guessPublicOrigin(): string | null {
  const origin = window.location.origin;
  if (SCHOOL_ORIGINS.has(origin) || origin === "https://bngss.vercel.app") return origin;
  return null;
}