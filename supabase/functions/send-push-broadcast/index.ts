import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pushOne } from "../_shared/webPush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { title, body, url, tag } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth");
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
