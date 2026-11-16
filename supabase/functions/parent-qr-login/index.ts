// Parent QR login: ผู้ปกครองสแกน QR บัตรนักเรียน → เข้าระบบด้วย "บัญชีผู้ปกครอง" ของนักเรียนคนนั้นทันที
// ถ้ายังไม่มีบัญชีผู้ปกครอง จะสร้างให้อัตโนมัติ พร้อมผูก students.parent_user_id และ role = parent
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from "../_shared/cors.ts";
import { ensureParentAccount } from "../_shared/parentAccount.ts";
import { dobMatches, normalizeDob } from "../_shared/lineSession.ts";

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

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function extractIdentifier(raw: string): { uuid?: string; code?: string } {
  const s = (raw || "").trim();
  if (!s) return {};
  const pMatch = s.match(/\/p\/([^/?#\s]+)/i);
  const token = pMatch ? decodeURIComponent(pMatch[1]) : s;
  const um = token.match(UUID_RE);
  if (um) return { uuid: um[0].toLowerCase() };
  if (/^[A-Za-z0-9_\-./]{2,64}$/.test(token)) return { code: token };
  return {};
}

function randomPassword() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

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
    if (!rateOk(ip)) return respond({ error: "rate_limited" }, 429);

    const { qr, dob } = await req.json().catch(() => ({}));
    if (!qr || typeof qr !== "string" || qr.length > 500) return respond({ error: "invalid_input" }, 400);

    const { uuid, code } = extractIdentifier(qr);
    if (!uuid && !code) return respond({ error: "invalid_qr" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const SELECT =
      "id, student_code, prefix, first_name, last_name, status, school_id, classroom_id, auth_user_id, parent_user_id, parent_user_id_2, date_of_birth";

    let student: any = null;
    if (uuid) {
      const { data } = await admin.from("students").select(SELECT).eq("auth_user_id", uuid).maybeSingle();
      student = data;
      if (!student) {
        const { data: byId } = await admin.from("students").select(SELECT).eq("id", uuid).maybeSingle();
        student = byId;
      }
    }
    if (!student && code) {
      const { data } = await admin.from("students").select(SELECT).eq("student_code", code).maybeSingle();
      student = data;
    }
    if (!student) return respond({ error: "not_found" }, 404);
    if (student.status && student.status !== "active") return respond({ error: "inactive" }, 403);

    // School decision: scanning the student card QR signs the parent in directly; a supplied DOB must still match.
    if (dob && typeof dob === "string" && student.date_of_birth && normalizeDob(dob) && !dobMatches(student.date_of_birth, dob)) {
      return respond({ error: "dob_mismatch" }, 401);
    }

    const ensured = await ensureParentAccount(admin, student);
    if ("error" in ensured) return respond({ error: ensured.error }, ensured.status);
    const parentUserId = ensured.parentUserId;

    // 4) ออก session ให้บัญชีผู้ปกครอง
    const { data: au } = await admin.auth.admin.getUserById(parentUserId);
    const email = au?.user?.email;
    if (!email) return respond({ error: "no_email" }, 500);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const hashed_token: string | undefined = (link as any)?.properties?.hashed_token;
    if (linkErr || !hashed_token) return respond({ error: "link_failed" }, 500);

    const anon = createClient(supabaseUrl, anonKey);
    const { data: verified, error: verErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashed_token,
    });
    if (verErr || !verified?.session) return respond({ error: "verify_failed" }, 500);

    return respond({
      success: true,
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      child: {
        student_code: student.student_code,
        display_name: `${student.prefix ?? ""}${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
      },
    });
  } catch (_e) {
    return respond({ error: "internal_error" }, 500);
  }
});
