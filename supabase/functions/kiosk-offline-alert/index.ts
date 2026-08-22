import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyRole } from "../_shared/fanout.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = makeAdmin();
    const threshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: offline } = await admin.from("kiosk_devices").select("device_id, meta, last_heartbeat").lt("last_heartbeat", threshold).eq("status", "online");
    if (offline && offline.length > 0) {
      for (const d of offline as any[]) {
        await admin.from("kiosk_devices").update({ status: "offline" }).eq("device_id", d.device_id);
        notifyRole(admin, "admin", {
          title: "ตู้ Kiosk ออฟไลน์เกิน 10 นาที",
          body: `${d.device_id} • ${(d.meta as any)?.room || ""} • last ${d.last_heartbeat}`,
          type: "kiosk_offline",
          severity: "warning",
          url: "/dashboard/admin/kiosk-health",
        }).catch(()=>{});
      }
    }
    return new Response(JSON.stringify({ checked: offline?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
