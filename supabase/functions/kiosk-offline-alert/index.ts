import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { fanout } from "../_shared/fanout.ts";
import { claimKioskNotification, releaseKioskNotification } from "../_shared/kioskNotificationCooldown.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = makeAdmin();
    const threshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: offline, error } = await admin.from("kiosk_devices").select("device_id, meta, last_seen_at").lt("last_seen_at", threshold).eq("status", "online");
    if (error) throw error;
    if (offline && offline.length > 0) {
      for (const d of offline as any[]) {
        const { error: updateError } = await admin.from("kiosk_devices").update({ status: "offline" }).eq("device_id", d.device_id);
        if (updateError) throw updateError;
        const claim = await claimKioskNotification(admin, d.device_id, "offline");
        if (!claim) continue;
        const response = await fanout({
          roles: ["admin"],
          title: "ตู้ Kiosk ออฟไลน์เกิน 10 นาที",
          body: `${d.device_id} • ${(d.meta as any)?.room || ""} • last ${d.last_seen_at}`,
          type: "kiosk_offline",
          dedup_key: claim.key,
          severity: "warning",
          url: "/dashboard/admin/kiosk-health",
        }, admin);
        if (!response?.ok) await releaseKioskNotification(admin, claim);
      }
    }
    return new Response(JSON.stringify({ checked: offline?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
