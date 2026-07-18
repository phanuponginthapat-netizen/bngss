// Direct lookup proxy to the user's Google Apps Script.
// GET ?table=...&id=...   → row from the sheet for that table (by id, direct TextFinder)
// GET ?op=file&table=...&id=...   → archived file metadata + viewable Drive URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const op = url.searchParams.get("op") || "row";
    const table = url.searchParams.get("table") || "";
    const id = url.searchParams.get("id") || "";
    if (!table || !id) return json({ error: "table & id required" }, 400);

    const { data: cfg } = await admin
      .from("school_settings")
      .select("setting_key,setting_value")
      .in("setting_key", ["gas_webapp_url", "gas_shared_secret"]);
    const cfgMap = Object.fromEntries((cfg ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    const gasUrl = cfgMap["gas_webapp_url"];
    const gasSecret = cfgMap["gas_shared_secret"];
    if (!gasUrl || !gasSecret) return json({ error: "ยังไม่ได้ตั้งค่า GAS" }, 400);

    const q = new URLSearchParams({ op, table, id, secret: gasSecret });
    const r = await fetch(`${gasUrl}?${q}`, { redirect: "follow" });
    const text = await r.text();
    try { return json(JSON.parse(text), r.ok ? 200 : 502); }
    catch { return json({ error: text.slice(0, 300) }, 502); }
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
