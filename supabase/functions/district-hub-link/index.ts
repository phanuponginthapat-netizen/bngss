// ฝั่งโรงเรียน: เชื่อมกับระบบหลักของเขต (เก็บกุญแจไว้ฝั่ง server เท่านั้น)
//  { action:"status" } | { action:"link", hub_url, school_code, enrollment_code, deploy_type }
//  { action:"test" } | { action:"unlink" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { corsHeadersWithCron as corsHeaders } from "../_shared/cors.ts";
import { invalidateSecretCache } from "../_shared/getSecret.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const HUB_SETTING = "district_hub_link";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const action = body?.action || "status";

  const readCfg = async () => {
    const { data } = await db.from("app_secrets").select("value").eq("key", HUB_SETTING).maybeSingle();
    try { return data?.value ? JSON.parse(data.value) : null; } catch { return null; }
  };
  const call = async (hubUrl: string, payload: unknown, key?: string) => {
    const r = await fetch(`${hubUrl.replace(/\/+$/, "")}/functions/v1/district-ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { "x-school-key": key } : {}) },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
    return j;
  };

  try {
    if (action === "status") {
      const c = await readCfg();
      return json({ linked: !!c?.ingest_key, hub_url: c?.hub_url ?? null, school_code: c?.school_code ?? null, linked_at: c?.linked_at ?? null });
    }
    if (action === "link") {
      const hub_url = String(body.hub_url || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\//.test(hub_url)) return json({ error: "URL ระบบหลักไม่ถูกต้อง" }, 400);
      const r = await call(hub_url, {
        action: "enroll", school_code: body.school_code, enrollment_code: body.enrollment_code,
        deploy_type: body.deploy_type || Deno.env.get("DEPLOY_MODE") || "cloud",
      });
      const value = JSON.stringify({ hub_url, school_code: body.school_code, ingest_key: r.ingest_key, linked_at: new Date().toISOString() });
      const { error } = await db.from("app_secrets").upsert({ key: HUB_SETTING, value }, { onConflict: "key" });
      if (error) throw error;
      invalidateSecretCache(HUB_SETTING);
      return json({ ok: true });
    }
    if (action === "test") {
      const c = await readCfg();
      if (!c?.ingest_key) return json({ error: "ยังไม่ได้เชื่อมระบบเขต" }, 400);
      await call(c.hub_url, { action: "ping" }, c.ingest_key);
      return json({ ok: true });
    }
    if (action === "unlink") {
      await db.from("app_secrets").delete().eq("key", HUB_SETTING);
      return json({ ok: true });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
