// Shared in-memory rate limiter for Supabase Edge Functions.
// Usage:
//   import { rateLimit } from "../_shared/rateLimit.ts";
//   const rl = await rateLimit(req, { name: "ai-chat", limit: 30, windowMs: 60_000 });
//   if (rl.blocked) return rl.response;
//
// Notes:
// - Stores counters in-memory per function instance (best-effort; resets on cold start).
// - Optionally logs blocked attempts to public.rate_limit_logs via the REST API if
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present.

const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitOptions {
  name: string;             // function name / route key
  limit: number;            // max requests per window
  windowMs: number;         // window in ms
  identifier?: string;      // explicit identifier (e.g. user id); falls back to IP
}

export interface RateLimitResult {
  blocked: boolean;
  remaining: number;
  resetAt: number;
  identifier: string;
  response?: Response;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

async function logBlocked(name: string, identifier: string, count: number) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    await fetch(`${url}/rest/v1/rate_limit_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        function_name: name,
        identifier,
        request_count: count,
        blocked: true,
      }),
    });
  } catch (_) {
    // best effort
  }
}

export async function rateLimit(
  req: Request,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const identifier = opts.identifier ?? clientIp(req);
  const key = `${opts.name}::${identifier}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { blocked: false, remaining: opts.limit - 1, resetAt: now + opts.windowMs, identifier };
  }

  bucket.count += 1;

  if (bucket.count > opts.limit) {
    logBlocked(opts.name, identifier, bucket.count);
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    const response = new Response(
      JSON.stringify({
        error: "rate_limited",
        message: "เรียกใช้งานบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
        retry_after: retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
    return { blocked: true, remaining: 0, resetAt: bucket.resetAt, identifier, response };
  }

  return {
    blocked: false,
    remaining: Math.max(0, opts.limit - bucket.count),
    resetAt: bucket.resetAt,
    identifier,
  };
}
