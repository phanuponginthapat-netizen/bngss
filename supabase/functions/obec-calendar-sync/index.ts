import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = makeAdmin();
    // URL ปฏิทิน สพฐ. เก็บใน app_settings key: obec_calendar_url (ICS)
    const { data: cfg } = await admin.from("app_settings").select("value").eq("key", "obec_calendar_url").maybeSingle();
    const url = (cfg as any)?.value?.url || (cfg as any)?.value;
    if (!url || typeof url !== "string" || !url.startsWith("https://")) {
      return new Response(JSON.stringify({ skipped: "no obec_calendar_url" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const ics = await res.text();
    // ส่งต่อให้ calendar-ics import logic (reuse by inserting raw ics into calendar_events via existing parser)
    // Minimal: store raw ics for calendar-ics to consume
    await admin.from("app_settings").upsert({ key: "obec_calendar_raw", value: { ics, fetched_at: new Date().toISOString() } as any });
    let imported = 0;
    try {
      // Call calendar-ics edge function internally to parse
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${supabaseUrl}/functions/v1/calendar-ics`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "text/calendar" }, body: ics });
      if (r.ok) imported = 1;
    } catch {}
    return new Response(JSON.stringify({ ok: true, bytes: ics.length, imported }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
