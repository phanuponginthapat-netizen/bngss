// Shared CORS header presets for all edge functions.
// Import the one you need instead of re-declaring `corsHeaders` locally.

const ALLOWED_ORIGINS = [
  "https://bngss.vercel.app",
  "https://bngss.lovable.app",
  "http://localhost:8080",
  "http://localhost:3000",
];

function resolveOrigin(reqOrigin: string | null): string {
  if (!reqOrigin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  // allow lovable preview subdomains
  if (reqOrigin.endsWith(".lovable.app") || reqOrigin.endsWith(".lovableproject.com")) return reqOrigin;
  return ALLOWED_ORIGINS[0];
}

export function getCorsHeaders(req?: Request, extra?: string[]) {
  const origin = resolveOrigin(req?.headers.get("origin") ?? null);
  const headers = extra ? [...extra] : [];
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": ["authorization", "x-client-info", "apikey", "content-type", ...headers].join(", "),
    "Vary": "Origin",
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

/** For cron/scheduled endpoints that accept an `x-cron-secret` header. */
export const corsHeadersWithCron = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Vary": "Origin",
};

/** Cron + explicit Allow-Methods. Use for POST-only cron/webhook endpoints. */
export const corsHeadersWithCronAndMethods = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

/** POST-only endpoints (no cron secret). */
export const corsHeadersPost = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

/** For games hub endpoints that accept `x-hub-key`. */
export const corsHeadersWithHubKey = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-key",
  "Vary": "Origin",
};

/** For bootstrap endpoint (`x-bootstrap-secret`). */
export const corsHeadersWithBootstrap = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Vary": "Origin",
};

/** Build a custom cors header set with extra allowed headers. */
export const buildCorsHeaders = (extraHeaders: string[] = [], methods?: string) => {
  const base = ["authorization", "x-client-info", "apikey", "content-type", ...extraHeaders];
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": base.join(", "),
    "Vary": "Origin",
  };
  if (methods) h["Access-Control-Allow-Methods"] = methods;
  return h;
};

/** Standard preflight response — 200 OK with just the CORS headers. */
export const preflight = (headers: Record<string, string> = corsHeaders) =>
  new Response("ok", { headers });
