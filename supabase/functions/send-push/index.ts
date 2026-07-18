import { pushOne } from "../_shared/webPush.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = makeAdmin();
    const payload = await req.json().catch(() => ({} as any));
    const { user_id, title, body, url, tag } = payload || {};
    if (typeof user_id !== "string" || !user_id || typeof title !== "string" || !title) {
      return new Response(JSON.stringify({ error: "user_id (string) and title (string) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", user_id);
    if (error) throw error;
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0, failed = 0;
    const errors: string[] = [];
    await Promise.all(subs.map(async (s: any) => {
      const r = await pushOne(s, { title, body, url, tag });
      if (r.ok) sent++;
      else {
        failed++;
        if (r.gone) await admin.from("push_subscriptions").delete().eq("id", s.id);
        if (r.error && errors.length < 5) errors.push(`${r.status ?? "?"}: ${r.error}`);
      }
    }));

    return new Response(JSON.stringify({ sent, failed, total: subs.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
