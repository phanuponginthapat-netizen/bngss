// Login ด้วยรหัสนักเรียน/บุคลากร + password — แก้ปัญหา lookup-email ที่ส่ง masked email
// คืน session tokens ให้ client เรียก supabase.auth.setSession()
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const ipMap = new Map<string, { count: number; resetAt: number }>();
function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}
function rateOk(ip: string) {
  const now = Date.now();
  const e = ipMap.get(ip);
  if (!e || e.resetAt < now) { ipMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return true; }
  if (e.count >= RATE_MAX) return false;
  e.count += 1; return true;
}
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const respond = async (body: unknown, status = 200) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed < 250) await new Promise((r) => setTimeout(r, 250 - elapsed));
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    const ip = clientIp(req);
    if (!rateOk(ip)) return respond({ error: "rate_limited" });

    const { identifier, password } = await req.json().catch(() => ({}));
    if (!identifier || typeof identifier !== "string" || !password || typeof password !== "string") {
      return respond({ error: "invalid_input" });
    }
    const id = identifier.trim();
    if (id.length < 2 || id.length > 100 || password.length < 1 || password.length > 200) {
      return respond({ error: "invalid_input" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) หา email จริงจาก identifier
    let email: string | null = null;

    if (isEmail(id)) {
      email = id.toLowerCase();
    } else {
      if (!/^[A-Za-z0-9_\-./]+$/.test(id)) return respond({ error: "invalid_input" });

      // personnel by employee_code
      const { data: personnel } = await admin
        .from("personnel")
        .select("email, user_id")
        .eq("employee_code", id)
        .eq("status", "active")
        .maybeSingle();
      if (personnel?.user_id) {
        const { data: au } = await admin.auth.admin.getUserById(personnel.user_id);
        email = au?.user?.email ?? null;
      }
      if (!email && personnel?.email) email = personnel.email;

      // students by student_code
      if (!email) {
        const { data: student } = await admin
          .from("students")
          .select("auth_user_id")
          .eq("student_code", id)
          .eq("status", "active")
          .maybeSingle();
        if (student?.auth_user_id) {
          const { data: au } = await admin.auth.admin.getUserById(student.auth_user_id);
          email = au?.user?.email ?? null;
        }
      }

      // profiles fallback
      if (!email) {
        let pid: string | null = null;
        const { data: p1 } = await admin.from("profiles").select("id").eq("employee_code", id).maybeSingle();
        pid = p1?.id ?? null;
        if (!pid) {
          const { data: p2 } = await admin.from("profiles").select("id").eq("student_code", id).maybeSingle();
          pid = p2?.id ?? null;
        }
        if (pid) {
          const { data: au } = await admin.auth.admin.getUserById(pid);
          email = au?.user?.email ?? null;
        }
      }
    }

    if (!email) return respond({ error: "not_found" });

    // 2) ลอง signInWithPassword ด้วย anon client → คืน session
    const anon = createClient(supabaseUrl, anonKey);
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      return respond({ error: "invalid_credentials" });
    }

    return respond({
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (_e) {
    return respond({ error: "internal_error" });
  }
});
