// Parent login: ใช้รหัสนักเรียน/อีเมล + วันเกิด เพื่อเข้าระบบในฐานะบัญชีนักเรียน
// คืน magic link (action_link) ให้ client redirect ไปเข้าระบบอัตโนมัติ
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// rate limit (ต่อ IP)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
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

function normalizeDob(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  // DDMMYYYY พ.ศ. (8 หลัก ไม่มีขีด) — รูปแบบหลัก
  const ddmmyyyy = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (ddmmyyyy) {
    const d = +ddmmyyyy[1], m = +ddmmyyyy[2], y = +ddmmyyyy[3];
    const yy = y > 2400 ? y - 543 : y; // ถือเป็น พ.ศ. เสมอ
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    const yy = y > 2400 ? y - 543 : y;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const d = +dmy[1], m = +dmy[2], y = +dmy[3];
    const yy = y > 2400 ? y - 543 : y;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}
const dobMatches = (stored: any, given: string) => {
  const n = normalizeDob(given);
  return !!(n && stored && String(stored).slice(0, 10) === n);
};
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const respond = async (body: unknown, status = 200) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed < 300) await new Promise((r) => setTimeout(r, 300 - elapsed));
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    const ip = clientIp(req);
    if (!rateOk(ip)) return respond({ error: "rate_limited" }, 429);

    const { identifier, dob } = await req.json().catch(() => ({}));
    if (!identifier || typeof identifier !== "string" || !dob || typeof dob !== "string") {
      return respond({ error: "invalid_input" }, 400);
    }
    const id = identifier.trim();
    if (id.length < 2 || id.length > 100) return respond({ error: "invalid_input" }, 400);
    if (!normalizeDob(dob)) return respond({ error: "invalid_dob_format" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1) หานักเรียน
    let student: any = null;
    if (isEmail(id)) {
      const emailLower = id.toLowerCase();
      // 1) ลองหา profile.id โดยตรงจาก google_email
      const { data: prof } = await sb
        .from("profiles")
        .select("id")
        .eq("google_email", emailLower)
        .maybeSingle();
      let uid: string | null = prof?.id ?? null;
      // 2) Fallback: ค้นใน auth.users ทีละหน้า (รองรับโรงเรียนใหญ่)
      if (!uid) {
        for (let page = 1; page <= 10 && !uid; page++) {
          const { data: list, error: lerr } = await sb.auth.admin.listUsers({ page, perPage: 200 });
          if (lerr || !list?.users?.length) break;
          const u = list.users.find((x: any) => (x.email || "").toLowerCase() === emailLower);
          if (u) uid = u.id;
          if (list.users.length < 200) break;
        }
      }
      if (uid) {
        const { data: s } = await sb
          .from("students")
          .select("id, date_of_birth, auth_user_id, status")
          .eq("auth_user_id", uid)
          .maybeSingle();
        student = s;
      }
    } else {
      const { data: s } = await sb
        .from("students")
        .select("id, date_of_birth, auth_user_id, status")
        .eq("student_code", id)
        .maybeSingle();
      student = s;
    }

    if (!student || !student.auth_user_id) {
      return respond({ error: "not_found" }, 404);
    }
    if (student.status && student.status !== "active") {
      return respond({ error: "inactive" }, 403);
    }
    if (!dobMatches(student.date_of_birth, dob)) {
      return respond({ error: "dob_mismatch" }, 401);
    }

    // 2) ดึง email ของบัญชีนักเรียน
    const { data: au } = await sb.auth.admin.getUserById(student.auth_user_id);
    const email = au?.user?.email;
    if (!email) return respond({ error: "no_email" }, 500);

    // 3) สร้าง magic link → แลกเป็น session ฝั่ง server เลย
    // วิธีนี้ไม่ต้องพึ่ง Allowed Redirect URLs ของ Auth — client เรียก setSession() เองได้
    const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr) {
      console.error("generateLink failed", linkErr);
      return respond({ error: "link_failed" }, 500);
    }
    const props: any = (link as any)?.properties ?? {};
    const hashed_token: string | undefined = props.hashed_token;
    if (!hashed_token) return respond({ error: "link_failed" }, 500);

    // แลก token เป็น session ผ่าน anon client
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anon = createClient(supabaseUrl, anonKey);
    const { data: verified, error: verErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashed_token,
    });
    if (verErr || !verified?.session) {
      console.error("verifyOtp failed", verErr);
      return respond({ error: "verify_failed" }, 500);
    }

    return respond({
      success: true,
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    });
  } catch (e) {
    console.error("parent-login error", e);
    return respond({ error: "internal_error" }, 500);
  }
});
