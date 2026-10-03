// ระบบหลักของเขต: รับการลงทะเบียนและข้อมูลสรุปจากโรงเรียน (Cloud / Standalone)
//  POST { action:"enroll", school_code, enrollment_code, deploy_type?, app_version? } -> { ingest_key }
//  POST { action:"snapshot", snapshot_date, payload }  (header x-school-key)
//  POST { action:"ping" } (header x-school-key)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-school-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(t: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomKey() {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  return "dhk_" + Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ตัดข้อมูลที่อาจระบุตัวบุคคลออก เหลือเฉพาะตัวเลขสรุป
function sanitize(p: any) {
  if (!p || typeof p !== "object") return {};
  const { activities: _a, ...rest } = p;
  const s = JSON.stringify(rest);
  if (s.length > 200_000) throw new Error("payload ใหญ่เกินไป");
  return rest;
}

export async function handle_ingest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "enroll") {
      const code = String(body.school_code || "").trim();
      const enr = String(body.enrollment_code || "").trim();
      if (!code || !enr) return json({ error: "ต้องระบุรหัสโรงเรียนและรหัสลงทะเบียน" }, 400);
      const { data: s } = await db.from("district_hub_schools")
        .select("id, enrollment_code_hash, enrollment_expires_at, status").eq("school_code", code).maybeSingle();
      if (!s || !s.enrollment_code_hash || s.enrollment_code_hash !== await sha256(enr))
        return json({ error: "รหัสโรงเรียนหรือรหัสลงทะเบียนไม่ถูกต้อง" }, 403);
      if (s.status === "disabled") return json({ error: "โรงเรียนถูกปิดการใช้งาน" }, 403);
      if (s.enrollment_expires_at && new Date(s.enrollment_expires_at) < new Date())
        return json({ error: "รหัสลงทะเบียนหมดอายุ กรุณาขอรหัสใหม่จากเขต" }, 403);
      const key = randomKey();
      const dt = ["cloud", "standalone", "hybrid"].includes(body.deploy_type) ? body.deploy_type : undefined;
      await db.from("district_hub_schools").update({
        ingest_key_hash: await sha256(key), enrollment_code_hash: null, enrollment_expires_at: null,
        status: "active", enrolled_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
        app_version: body.app_version ?? null, updated_at: new Date().toISOString(),
        ...(dt ? { deploy_type: dt } : {}),
      }).eq("id", s.id);
      return json({ ok: true, ingest_key: key });
    }

    const key = req.headers.get("x-school-key") || "";
    if (!key.startsWith("dhk_")) return json({ error: "ไม่มีกุญแจโรงเรียน" }, 401);
    const { data: school } = await db.from("district_hub_schools")
      .select("id, status, last_seen_at").eq("ingest_key_hash", await sha256(key)).maybeSingle();
    if (!school || school.status !== "active") return json({ error: "กุญแจไม่ถูกต้องหรือถูกปิด" }, 403);

    if (action === "ping") {
      await db.from("district_hub_schools").update({ last_seen_at: new Date().toISOString() }).eq("id", school.id);
      return json({ ok: true });
    }

    if (action === "snapshot") {
      // จำกัดอัตรา: ไม่เกิน 1 ครั้ง / 20 วินาที
      if (school.last_seen_at && Date.now() - new Date(school.last_seen_at).getTime() < 20_000)
        return json({ error: "ส่งถี่เกินไป" }, 429);
      const date = String(body.snapshot_date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "snapshot_date ไม่ถูกต้อง" }, 400);
      const payload = sanitize(body.payload);
      const { error } = await db.from("district_hub_snapshots").upsert(
        { school_id: school.id, snapshot_date: date, payload, received_at: new Date().toISOString() },
        { onConflict: "school_id,snapshot_date" },
      );
      if (error) return json({ error: error.message }, 500);
      await db.from("district_hub_schools").update({
        last_seen_at: new Date().toISOString(), app_version: body.app_version ?? undefined,
      }).eq("id", school.id);
      return json({ ok: true });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
