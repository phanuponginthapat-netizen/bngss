import { authorizeCaller, ADMIN_ROLES } from "../_shared/callerAuth.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { fanout } from "../_shared/fanout.ts";
import { claimKioskNotification, releaseKioskNotification } from "../_shared/kioskNotificationCooldown.ts";
import { isPlannedOffline, isStudentBrowser, PLANNED_POWER_ACTIONS } from "../_shared/kioskOfflinePolicy.ts";

async function loadKioskSettings(admin: any) {
  const { data, error } = await admin.from("school_settings").select("setting_value").eq("setting_key", "kiosk_config").maybeSingle();
  if (error) throw error;
  let v: any = data?.setting_value ?? {};
  if (typeof v === "string") v = JSON.parse(v);
  return v && typeof v === "object" ? v : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const __caller = await authorizeCaller(req, corsHeaders, { roles: ADMIN_ROLES, allowCron: true });
  if (__caller instanceof Response) return __caller;

  try {
    const admin = makeAdmin();
    const threshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: offline, error } = await admin.from("kiosk_devices").select("device_id, meta, last_seen_at, platform").lt("last_seen_at", threshold).eq("status", "online");
    if (error) throw error;
    let alerted = 0, skipped = 0;
    const settings = offline?.length ? await loadKioskSettings(admin) : {};
    for (const d of (offline ?? []) as any[]) {
      // อัปเดตแบบมีเงื่อนไข: รอบที่ทำงานพร้อมกันจะมีแค่รอบเดียวที่เปลี่ยนสถานะได้ → ไม่แจ้งซ้ำ
      const { data: changed, error: updateError } = await admin.from("kiosk_devices").update({ status: "offline" }).eq("device_id", d.device_id).eq("status", "online").select("device_id");
      if (updateError) throw updateError;
      if (!changed?.length) continue;
      if (isStudentBrowser(d.platform)) { skipped++; continue; }
      const lastSeenMs = Date.parse(d.last_seen_at);
      const { data: cmds, error: cmdError } = await admin.from("kiosk_commands").select("action, consumed_at")
        .eq("device_id", d.device_id).eq("kind", "power").in("action", PLANNED_POWER_ACTIONS)
        .gte("consumed_at", new Date(lastSeenMs - 20 * 60_000).toISOString());
      if (cmdError) throw cmdError;
      if (isPlannedOffline(lastSeenMs, settings, cmds ?? [])) { skipped++; continue; }
      const claim = await claimKioskNotification(admin, d.device_id, "offline");
      if (!claim) continue;
      const response = await fanout({
        roles: ["admin"],
        title: "ตู้สแกนดับกะทันหัน (ออฟไลน์เกิน 10 นาที)",
        body: `${d.device_id} • ${(d.meta as any)?.room || ""} • ล่าสุด ${new Date(lastSeenMs).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`,
        type: "kiosk_offline",
        dedup_key: claim.key,
        severity: "warning",
        url: "/dashboard/admin/kiosk-health",
      }, admin);
      if (!response?.ok) await releaseKioskNotification(admin, claim); else alerted++;
    }
    return new Response(JSON.stringify({ checked: offline?.length || 0, alerted, skipped }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
