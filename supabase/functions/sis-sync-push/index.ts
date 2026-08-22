import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = makeAdmin();
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const { data: u } = await admin.auth.getUser(token);
      if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: role } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).maybeSingle();
      if (!role || !["admin","director"].includes((role as any).role)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: queue } = await admin.from("sis_sync_queue").select("*").eq("direction","outbound").eq("status","pending").limit(100);
    let processed = 0, failed = 0;
    for (const item of (queue as any[]) || []) {
      try {
        await admin.from("sis_sync_queue").update({ status: "processing" }).eq("id", item.id);
        // Push to district-feed-api (mock: log and mark completed, real would POST to external SIS)
        const payload = item.payload || {};
        // Try district-feed-api if configured, otherwise just mark completed
        try {
          const districtUrl = Deno.env.get("DISTRICT_SIS_URL");
          if (districtUrl) {
            await fetch(districtUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("DISTRICT_SIS_TOKEN") || ""}` }, body: JSON.stringify({ entity_type: item.entity_type, operation: item.operation, payload }) });
          }
        } catch {}
        await admin.from("sis_sync_queue").update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", item.id);
        // Also insert to district_outbox for reliable delivery if table exists
        try { await admin.from("district_outbox").insert({ entity_type: item.entity_type, payload, status: "sent" } as any); } catch {}
        processed++;
      } catch (e: any) {
        await admin.from("sis_sync_queue").update({ status: "failed", error_message: String(e?.message || e) }).eq("id", item.id);
        failed++;
      }
    }
    return new Response(JSON.stringify({ processed, failed, total: queue?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
