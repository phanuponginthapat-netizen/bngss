import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// In-memory rate limiter to mitigate enumeration attacks against this
// pre-auth lookup endpoint. Tracks attempts per client IP.
const RATE_WINDOW_MS = 60_000; // 1 minute window
const RATE_MAX_ATTEMPTS = 10;  // max lookups per IP per window
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

// Constant-ish minimum response time to reduce timing-based enumeration.
const MIN_RESPONSE_MS = 250;

// Mask an email address for pre-auth disclosure to mitigate enumeration.
// The masked form lets a user confirm they typed the right code without
// exposing the full address to bulk scrapers.
//   "alice@example.com" -> "a***e@example.com"
//   "bo@school.ac.th"   -> "b*@school.ac.th"
//   "x@y.z"             -> "*@y.z"
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 1) return `*${domain}`;
  if (local.length === 2) return `${local[0]}*${domain}`;
  if (local.length <= 4) {
    return `${local[0]}${'*'.repeat(local.length - 1)}${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}${domain}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const respond = async (body: unknown, status: number) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  };

  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return respond({ error: 'rate_limited' }, 429);
    }

    const { code } = await req.json();

    if (!code || typeof code !== 'string' || code.trim().length < 2 || code.length > 64) {
      return respond({ error: 'Invalid code' }, 400);
    }

    const trimmed = code.trim();

    // Reject codes containing characters that aren't legitimate identifiers
    // (defense-in-depth — the queries are parameterized but this prevents abuse).
    if (!/^[A-Za-z0-9_\-./]+$/.test(trimmed)) {
      return respond({ error: 'Invalid code' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Check personnel by employee_code
    const { data: personnel } = await supabase
      .from('personnel')
      .select('email, user_id')
      .eq('employee_code', trimmed)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (personnel) {
      if (personnel.user_id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(personnel.user_id);
        if (authUser?.user?.email) {
          return respond({ email: maskEmail(authUser.user.email) }, 200);
        }
      }
      if (personnel.email) {
        return respond({ email: maskEmail(personnel.email) }, 200);
      }
    }

    // 2. Check students by student_code
    const { data: student } = await supabase
      .from('students')
      .select('auth_user_id')
      .eq('student_code', trimmed)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (student?.auth_user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(student.auth_user_id);
      if (authUser?.user?.email) {
        return respond({ email: maskEmail(authUser.user.email) }, 200);
      }
    }

    // 3. Check profiles (avoid OR-string with user input — use sequential lookups)
    const { data: profileByEmp } = await supabase
      .from('profiles')
      .select('id')
      .eq('employee_code', trimmed)
      .limit(1)
      .maybeSingle();

    let profileId = profileByEmp?.id ?? null;
    if (!profileId) {
      const { data: profileByStu } = await supabase
        .from('profiles')
        .select('id')
        .eq('student_code', trimmed)
        .limit(1)
        .maybeSingle();
      profileId = profileByStu?.id ?? null;
    }

    if (profileId) {
      const { data: authUser } = await supabase.auth.admin.getUserById(profileId);
      if (authUser?.user?.email) {
        return respond({ email: maskEmail(authUser.user.email) }, 200);
      }
    }

    return respond({ error: 'not_found' }, 404);
  } catch (_error) {
    // Do not leak internal error messages to unauthenticated callers
    return respond({ error: 'internal_error' }, 500);
  }
});
