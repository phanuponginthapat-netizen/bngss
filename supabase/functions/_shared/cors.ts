// Shared CORS header presets for all edge functions.
// Import the one you need instead of re-declaring `corsHeaders` locally.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** For cron/scheduled endpoints that accept an `x-cron-secret` header. */
export const corsHeadersWithCron = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/** Cron + explicit Allow-Methods. Use for POST-only cron/webhook endpoints. */
export const corsHeadersWithCronAndMethods = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** POST-only endpoints (no cron secret). */
export const corsHeadersPost = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** For games hub endpoints that accept `x-hub-key`. */
export const corsHeadersWithHubKey = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-key",
};

/** For bootstrap endpoint (`x-bootstrap-secret`). */
export const corsHeadersWithBootstrap = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/** Build a custom cors header set with extra allowed headers. */
export const buildCorsHeaders = (extraHeaders: string[] = [], methods?: string) => {
  const base = ["authorization", "x-client-info", "apikey", "content-type", ...extraHeaders];
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": base.join(", "),
  };
  if (methods) h["Access-Control-Allow-Methods"] = methods;
  return h;
};

/** Standard preflight response — 200 OK with just the CORS headers. */
export const preflight = (headers: Record<string, string> = corsHeaders) =>
  new Response("ok", { headers });
