// ระบบหลักของเขต: ผู้ดูแลกลางเพิ่มโรงเรียน / ออกรหัสลงทะเบียน
//  { action:"upsert_school", school_code, school_name, area_name?, province?, deploy_type? }
//  { action:"issue_code", school_id } -> { enrollment_code } (แสดงครั้งเดียว, หมดอายุ 7 วัน)
//  { action:"set_status", school_id, status }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
async function sha256(t: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: ok } = await db.rpc("is_district_admin", { _uid: u.user.id });
  if (!ok) return json({ error: "เฉพาะผู้ดูแลระบบหลัก" }, 403);

  try {
    const b = await req.json().catch(() => ({}));
    if (b.action === "upsert_school") {
      const code = String(b.school_code || "").trim();
      const name = String(b.school_name || "").trim();
      if (!code || !name) return json({ error: "ต้องระบุรหัสและชื่อโรงเรียน" }, 400);
      const { data, error } = await db.from("district_hub_schools").upsert({
        school_code: code, school_name: name, area_name: b.area_name || null, province: b.province || null,
        deploy_type: b.deploy_type || "cloud", updated_at: new Date().toISOString(),
      }, { onConflict: "school_code" }).select("id").single();
      if (error) throw error;
      return json({ ok: true, id: data.id });
    }
    if (b.action === "issue_code") {
      const a = new Uint8Array(5); crypto.getRandomValues(a);
      const code = Array.from(a).map((x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("") + "-" +
        Array.from(crypto.getRandomValues(new Uint8Array(5))).map((x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");
      const { error } = await db.from("district_hub_schools").update({
        enrollment_code_hash: await sha256(code),
        enrollment_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      }).eq("id", b.school_id);
      if (error) throw error;
      return json({ ok: true, enrollment_code: code });
    }
    if (b.action === "set_status") {
      if (!["active", "disabled", "pending"].includes(b.status)) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
      await db.from("district_hub_schools").update({ status: b.status }).eq("id", b.school_id);
      return json({ ok: true });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
