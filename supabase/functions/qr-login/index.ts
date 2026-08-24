// QR login: สแกน QR จากบัตรนักเรียน (URL /p/:uuid) → ยืนยันว่ามีนักเรียนคนนี้ในระบบ → คืน session
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from "../_shared/cors.ts";

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
  // URL รูปแบบ .../p/<uuid> หรือ .../p/<code>
  const pMatch = s.match(/\/p\/([^/?#\s]+)/i);
  const token = pMatch ? decodeURIComponent(pMatch[1]) : s;
  const um = token.match(UUID_RE);
  if (um) return { uuid: um[0].toLowerCase() };
  if (/^[A-Za-z0-9_\-./]{2,64}$/.test(token)) return { code: token };
  return {};
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

    const { qr } = await req.json().catch(() => ({}));
    if (!qr || typeof qr !== "string" || qr.length > 500) {
      return respond({ error: "invalid_input" }, 400);
    }

    const { uuid, code } = extractIdentifier(qr);
    if (!uuid && !code) return respond({ error: "invalid_qr" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // หา auth_user_id จากทั้งนักเรียนและบุคลากร (ครู/เจ้าหน้าที่)
    let authUserId: string | null = null;
    let foundButNoAccount = false;
    if (uuid) {
      // 1) ตรง auth_user_id ของนักเรียน
      const { data: s } = await admin
        .from("students")
        .select("auth_user_id, status")
        .eq("auth_user_id", uuid)
        .maybeSingle();
      if (s?.auth_user_id) {
        if (s.status && s.status !== "active") return respond({ error: "inactive" }, 403);
        authUserId = s.auth_user_id;
      }
      // 2) บัตรบางใบพิมพ์ QR เป็น students.id (กรณีนักเรียนยังไม่มีบัญชีตอนพิมพ์)
      if (!authUserId) {
        const { data: sById } = await admin
          .from("students")
          .select("auth_user_id, status")
          .eq("id", uuid)
          .maybeSingle();
        if (sById) {
          if (sById.status && sById.status !== "active") return respond({ error: "inactive" }, 403);
          if (sById.auth_user_id) authUserId = sById.auth_user_id;
          else foundButNoAccount = true;
        }
      }
      if (!authUserId && !foundButNoAccount) {
        const { data: p } = await admin
          .from("personnel")
          .select("user_id, status")
          .eq("user_id", uuid)
          .maybeSingle();
        if (p?.user_id) {
          if (p.status && p.status !== "active") return respond({ error: "inactive" }, 403);
          authUserId = p.user_id;
        }
      }
      // 3) บัตรบุคลากรที่พิมพ์ QR เป็น personnel.id
      if (!authUserId && !foundButNoAccount) {
        const { data: pById } = await admin
          .from("personnel")
          .select("user_id, status")
          .eq("id", uuid)
          .maybeSingle();
        if (pById) {
          if (pById.status && pById.status !== "active") return respond({ error: "inactive" }, 403);
          if (pById.user_id) authUserId = pById.user_id;
          else foundButNoAccount = true;
        }
      }
    }
    if (!authUserId && code) {
      const { data: s } = await admin
        .from("students")
        .select("auth_user_id, status")
        .eq("student_code", code)
        .maybeSingle();
      if (s?.auth_user_id) {
        if (s.status && s.status !== "active") return respond({ error: "inactive" }, 403);
        authUserId = s.auth_user_id;
      } else if (s) {
        foundButNoAccount = true;
      }
      if (!authUserId && !foundButNoAccount) {
        const { data: p } = await admin
          .from("personnel")
          .select("user_id, status")
          .eq("employee_code", code)
          .maybeSingle();
        if (p?.user_id) {
          if (p.status && p.status !== "active") return respond({ error: "inactive" }, 403);
          authUserId = p.user_id;
        } else if (p) {
          foundButNoAccount = true;
        }
      }
    }
    if (!authUserId && foundButNoAccount) return respond({ error: "no_account" }, 409);
    if (!authUserId) return respond({ error: "not_found" }, 404);


    // ดึง email แล้วออก magic link → แลกเป็น session
    const { data: au } = await admin.auth.admin.getUserById(authUserId);
    const email = au?.user?.email;
    if (!email) return respond({ error: "no_email" }, 500);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr) return respond({ error: "link_failed" }, 500);
    const hashed_token: string | undefined = (link as any)?.properties?.hashed_token;
    if (!hashed_token) return respond({ error: "link_failed" }, 500);

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
    });
  } catch (_e) {
    return respond({ error: "internal_error" }, 500);
  }
});
