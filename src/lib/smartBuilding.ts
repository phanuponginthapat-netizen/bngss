import { supabase } from "@/integrations/supabase/client";

export type BuildingAction = { device_id: string; action: "turn_off" | "turn_on"; reason: string };

export async function checkBuildingAutomation(): Promise<BuildingAction[]> {
  const actions: BuildingAction[] = [];
  // Check occupancy via PIR or face scan: if no scan in last 30 min, turn off AC/light in that zone
  const { data: devices } = await supabase.from("iot_devices").select("*").eq("system_category", "energy").eq("is_active", true).limit(50);
  const { data: scans } = await supabase.from("face_scan_logs").select("scan_time").gte("scan_time", new Date(Date.now() - 30*60000).toISOString()).limit(100);
  const hasOccupancy = (scans as any[])?.length > 0;
  for (const d of (devices as any[]) || []) {
    if (!hasOccupancy && d.last_status === "online") {
      actions.push({ device_id: d.id, action: "turn_off", reason: "ไม่มีคน 30 นาที" });
    }
  }
  return actions;
}

export async function executeBuildingActions(actions: BuildingAction[]) {
  for (const a of actions) {
    try {
      await supabase.functions.invoke("iot-fetch", { body: { device_id: a.device_id, action: a.action } });
    } catch {}
  }
}
