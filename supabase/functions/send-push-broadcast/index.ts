import { pushOne } from "../_shared/webPush.ts";
import { sendFcm } from "../_shared/fcmPush.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = makeAdmin();

    // SECURITY: admin-only
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData } = await admin.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: callerRole } = await admin.from("user_roles")
      .select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body, url, tag } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,provider,device_token");
    if (error) throw error;
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0, failed = 0;
    const errors: string[] = [];
    await Promise.all(subs.map(async (s: any) => {
      const isFcm = s.provider === "fcm" && !!s.device_token;
      const r = isFcm
        ? await sendFcm(s.device_token, { title, body, url, tag })
        : await pushOne(s, { title, body, url, tag });
      if (r.ok) sent++;
      else {
        failed++;
        if (r.gone) await admin.from("push_subscriptions").delete().eq("id", s.id);
        if (!r.skipped && r.error && errors.length < 5) errors.push(`${r.status ?? "?"}: ${r.error}`);
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
