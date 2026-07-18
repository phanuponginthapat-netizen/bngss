// games-auth: เกมภายนอกยิง QR + API key → คืนข้อมูลนักเรียน + session_token สั้น ๆ
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeadersWithHubKey as corsHeaders } from "../_shared/cors.ts";

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

function gradeToBand(grade?: string | null) {
  if (!grade) return "unknown";
  if (grade.startsWith("อ.")) return "kinder";
  if (["ป.1", "ป.2", "ป.3"].includes(grade)) return "primary_early";
  if (["ป.4", "ป.5", "ป.6"].includes(grade)) return "primary_late";
  if (["ม.1", "ม.2", "ม.3"].includes(grade)) return "secondary_lower";
  if (["ม.4", "ม.5", "ม.6"].includes(grade)) return "secondary_upper";
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const hubKey = req.headers.get("x-hub-key") || "";
    if (!hubKey) return json({ error: "missing_api_key" }, 401);

    const { qr } = await req.json().catch(() => ({}));
    if (!qr || typeof qr !== "string" || qr.length > 500) return json({ error: "invalid_input" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const keyHash = await sha256Hex(hubKey);
    const { data: apiKey } = await admin
      .from("game_hub_api_keys")
      .select("id, is_active, scopes")
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (!apiKey || !apiKey.is_active) return json({ error: "invalid_api_key" }, 401);

    const { uuid, code } = extractIdentifier(qr);
    if (!uuid && !code) return json({ error: "invalid_qr" }, 400);

    let student: any = null;
    if (uuid) {
      const { data } = await admin
        .from("students")
        .select("id, first_name, last_name, student_code, status, classroom_id, classrooms!students_classroom_id_fkey(grade_level, name)")
        .eq("auth_user_id", uuid)
        .maybeSingle();
      student = data;
    }
    if (!student && code) {
      const { data } = await admin
        .from("students")
        .select("id, first_name, last_name, student_code, status, classroom_id, classrooms!students_classroom_id_fkey(grade_level, name)")
        .eq("student_code", code)
        .maybeSingle();
      student = data;
    }
    if (!student) return json({ error: "not_found" }, 404);
    if (student.status && student.status !== "active") return json({ error: "inactive" }, 403);

    // Update last_used
    await admin.from("game_hub_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);

    // Create signed session_token = base64({student_id, api_key_id, exp}) + hmac
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const payload = { sid: student.id, kid: apiKey.id, exp: Math.floor(Date.now() / 1000) + 60 * 15 };
    const body = btoa(JSON.stringify(payload));
    const sig = await sha256Hex(body + "|" + secret);
    const session_token = `${body}.${sig.slice(0, 32)}`;

    const grade = student.classrooms?.grade_level ?? null;
    return json({
      success: true,
      session_token,
      student: {
        id: student.id,
        display_name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
        student_code: student.student_code,
        grade_level: grade,
        classroom_name: student.classrooms?.name ?? null,
        band: gradeToBand(grade),
      },
    });
  } catch (_e) {
    return json({ error: "internal_error" }, 500);
  }
});
