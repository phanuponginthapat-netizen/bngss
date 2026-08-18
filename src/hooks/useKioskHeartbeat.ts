import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId, getDeviceHostnameHint } from "@/lib/deviceId";
import { getBackendConfig } from "@/lib/runtimeConfig";
import { collectKioskTelemetry } from "@/lib/kioskTelemetry";

/** ระยะห่างการบันทึกประวัติสถานะ (สำหรับกราฟ) */
const SAMPLE_EVERY_MS = 3 * 60_000;

type HeartbeatInput = {
  enabled?: boolean;
  status?: "online" | "locked" | "sharing" | "offline";
  kioskMode?: "door" | "student" | null;
  configUpdatedAt?: string | null;
  extensionInstalled?: boolean;
  uptimeSec?: number;
};

/**
 * ดึงค่า room ที่แอดมินตั้งไว้ให้กับเครื่องนี้จาก kiosk_devices.meta.room
 * ใช้ใน StudentAgentPage เพื่อรวมไว้ใน presence
 */
export async function fetchDeviceRoom(): Promise<string | null> {
  try {
    const device_id = getDeviceId();
    const { data } = await supabase
      .from("kiosk_devices")
      .select("meta")
      .eq("device_id", device_id)
      .maybeSingle();
    const room = (data as any)?.meta?.room;
    return typeof room === "string" && room.trim() ? room.trim() : null;
  } catch {
    return null;
  }
}

/**
 * ส่ง heartbeat ไปยังตาราง kiosk_devices ทุก 30 วิ
 * เมื่อออกจากหน้า → set status = offline
 */
export function useKioskHeartbeat(input: HeartbeatInput) {
  const {
    enabled = true,
    status = "online",
    kioskMode = null,
    configUpdatedAt = null,
    extensionInstalled = false,
    uptimeSec = 0,
  } = input;

  const lastPingRef = useRef<number>(0);
  const lastSampleRef = useRef<number>(0);

  // main heartbeat loop
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const ping = async () => {
      try {
        if (cancelled) return;
        const { data: { user } } = await supabase.auth.getUser();
        const device_id = getDeviceId();
        const payload = {
          device_id,
          user_id: user?.id ?? null,
          hostname: getDeviceHostnameHint(),
          user_agent: navigator.userAgent,
          status,
          kiosk_mode: kioskMode,
          config_updated_at: configUpdatedAt,
          uptime_sec: uptimeSec,
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          extension_installed: extensionInstalled,
          last_seen_at: new Date().toISOString(),
        };
        // NOTE: ไม่แตะ meta — admin เป็นคนตั้ง room ผ่าน KioskDevicesLiveCard
        // ใช้ RPC (security definer) เพื่อให้เครื่องที่เคยลงทะเบียนด้วยบัญชีอื่นอัปเดตได้
        const { error: rpcErr } = await (supabase as any).rpc("kiosk_heartbeat", {
          _device_id: device_id,
          _hostname: payload.hostname,
          _user_agent: payload.user_agent,
          _status: status,
          _kiosk_mode: kioskMode,
          _config_updated_at: configUpdatedAt,
          _uptime_sec: Math.round(uptimeSec) || 0,
          _screen_resolution: payload.screen_resolution,
          _extension_installed: extensionInstalled,
        });
        if (rpcErr && user) {
          // fallback สำหรับ backend ที่ยังไม่มีฟังก์ชัน
          await supabase
            .from("kiosk_devices")
            .upsert([payload], { onConflict: "device_id" });
        }
        lastPingRef.current = Date.now();


        // ---- บันทึกประวัติสถานะเครื่อง (แบต/หน่วยความจำ/uptime) ทุก 3 นาที สำหรับกราฟ ----
        const now = Date.now();
        if (now - lastSampleRef.current >= SAMPLE_EVERY_MS) {
          lastSampleRef.current = now;
          try {
            const t = await collectKioskTelemetry();
            if (!cancelled) {
              await (supabase as any).from("kiosk_health_samples").insert({
                device_id,
                kiosk_mode: kioskMode,
                status,
                uptime_sec: uptimeSec,
                battery_percent: t.battery_percent,
                battery_charging: t.battery_charging,
                battery_status: t.battery_status,
                memory_used_mb: t.memory_used_mb,
                latency_ms: t.latency_ms,
                meta: { extension_installed: extensionInstalled },
              });
            }
          } catch { /* silent */ }
        }
      } catch (e) {
        // silent
      }
    };

    ping();
    const iv = window.setInterval(ping, 30_000);

    // ping ตอน visibilitychange (กลับมาที่ tab)
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);

    // set offline เมื่อออก
    const onBeforeUnload = () => {
      try {
        const device_id = getDeviceId();
        const body = JSON.stringify({
          device_id,
          status: "offline",
          last_seen_at: new Date().toISOString(),
        });
        // beacon (best-effort)
        const url = `${getBackendConfig().url}/rest/v1/kiosk_devices?device_id=eq.${encodeURIComponent(device_id)}`;
        if (url && navigator.sendBeacon) {
          navigator.sendBeacon(url, body);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, status, kioskMode, configUpdatedAt, extensionInstalled, uptimeSec]);
}
