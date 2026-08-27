// Kiosk face register — ลงทะเบียนใบหน้าจากตู้ door โดยไม่ต้อง login
// รับ qr หรือ student_code + descriptors แล้วบันทึกทันทีด้วย service_role (bypass RLS)
// ใช้ที่ตู้หน้าประตู: สแกนบัตร/กรอกรหัส → ถ่ายใบหน้า → บันทึก → สแกนได้ทันที
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
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
function extractCode(raw: string): { uuid?: string; code?: string } {
  const s = (raw || "").trim();
  if (!s) return {};
  const pMatch = s.match(/\/p\/([^/?#\s]+)/i);
  const token = pMatch ? decodeURIComponent(pMatch[1]) : s;
  const um = token.match(UUID_RE);
  if (um) return { uuid: um[0].toLowerCase() };
  if (/^[A-Za-z0-9_\-./]{1,64}$/.test(token)) return { code: token };
  return {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const t0 = Date.now();
  const respond = async (body: unknown, status = 200) => {
    const elapsed = Date.now() - t0;
    if (elapsed < 200) await new Promise((r) => setTimeout(r, 200 - elapsed));
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  };
  try {
    const ip = clientIp(req);
    if (!rateOk(ip)) return respond({ error: "rate_limited" }, 429);

    const { qr, student_code, student_id, descriptors, face_image } = await req.json().catch(() => ({} as any));

    // ต้องมี descriptors
    if (!Array.isArray(descriptors) || descriptors.length === 0 || descriptors.length > 5) {
      return respond({ error: "invalid_descriptors" }, 400);
    }
    for (const d of descriptors) {
      if (!Array.isArray(d) || d.length !== 512) return respond({ error: "invalid_descriptor_dim" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // หา student_id จากหลายทาง
    let sid: string | null = student_id || null;
    let studentCode: string | null = null;

    if (!sid && qr) {
      const { uuid, code } = extractCode(String(qr));
      if (uuid) {
        // ลองหาโดย id หรือ auth_user_id
        const { data: s1 } = await admin.from("students").select("id, student_code, status").eq("id", uuid).maybeSingle();
        if (s1?.id) { sid = s1.id; studentCode = s1.student_code; if (s1.status !== "active") return respond({ error: "inactive" }, 403); }
        if (!sid) {
          const { data: s2 } = await admin.from("students").select("id, student_code, status").eq("auth_user_id", uuid).maybeSingle();
          if (s2?.id) { sid = s2.id; studentCode = s2.student_code; if (s2.status !== "active") return respond({ error: "inactive" }, 403); }
        }
      }
      if (!sid && code) {
        const { data: s3 } = await admin.from("students").select("id, student_code, status").eq("student_code", code).maybeSingle();
        if (s3?.id) { sid = s3.id; studentCode = s3.student_code; if (s3.status !== "active") return respond({ error: "inactive" }, 403); }
      }
    }
    if (!sid && student_code) {
      const { data: s } = await admin.from("students").select("id, student_code, status").eq("student_code", String(student_code).trim()).maybeSingle();
      if (s?.id) { sid = s.id; studentCode = s.student_code; if (s.status !== "active") return respond({ error: "inactive" }, 403); }
    }
    if (!sid) return respond({ error: "not_found" }, 404);

    // กันใบหน้าซ้ำกับคนอื่น (check_face_duplicate)
    try {
      const { data: dup } = await admin.rpc("check_face_duplicate", { _student_id: sid, _descriptors: descriptors as any, _threshold: 0.42 });
      const hit = Array.isArray(dup) ? (dup as any[])[0] : null;
      if (hit) {
        return respond({ error: "duplicate", match_name: hit.match_name, match_code: hit.match_code, min_distance: hit.min_distance }, 409);
      }
    } catch { /* ignore duplicate check failure */ }

    // ลบของเดิมแล้วใส่ใหม่ (kiosk ลงทะเบียนแบบแทนที่)
    await admin.from("student_face_descriptors").delete().eq("student_id", sid);

    const rows = descriptors.map((desc: number[], i: number) => ({
      student_id: sid,
      sample_index: i,
      descriptor: desc,
      captured_by: null,
      source: "kiosk_door",
      face_image: i === 0 && face_image ? face_image : null,
    }));

    const { error: insErr } = await admin.from("student_face_descriptors").upsert(rows, { onConflict: "student_id,sample_index" });
    if (insErr) return respond({ error: "db_error", detail: insErr.message }, 500);

    // บันทึก history (best effort) — ใช้ direct_add ที่ผ่าน check constraint
    try {
      await admin.from("face_registration_history").insert({
        student_id: sid,
        action: "direct_add",
        previous_count: 0,
        new_count: rows.length,
        photo_urls: [],
        reason: "kiosk door self-register",
        notes: `kiosk door ${studentCode || sid}`,
        performed_by: null,
      });
    } catch {}

    return respond({ success: true, student_id: sid, student_code: studentCode, count: rows.length });
  } catch (_e) {
    return respond({ error: "internal_error" }, 500);
  }
});
// trigger redeploy
