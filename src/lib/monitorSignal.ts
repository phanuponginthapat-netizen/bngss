/**
 * WebRTC signaling ผ่าน Supabase Realtime broadcast — ไม่ต้องมี server แยก
 * ใช้กับ Classroom Monitor (Phase 3, NetSupport-style)
 *
 * Command actions ที่รองรับ:
 *   - lock / unlock          : ล็อก/ปลดล็อกหน้าจอ (fullscreen overlay + extension lock all tabs)
 *   - message                : ส่งข้อความเด้งบนหน้าจอนักเรียน
 *   - open-url               : เปิดลิงก์ให้นักเรียนทุกเครื่องอัตโนมัติ
 *   - shutdown / reboot      : สั่งปิด/รีสตาร์ทเครื่อง (ผ่าน local daemon port 9998)
 *   - logout                 : สั่ง logout session ปัจจุบัน
 *   - screenshot             : ขอ screenshot จากเครื่องนักเรียน
 *   - screenshot-image       : ส่งภาพ screenshot กลับหา viewer (base64 dataURL)
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const MONITOR_CHANNEL = "classroom-monitor";
export const LOCAL_CTL_URL = "http://127.0.0.1:9998";

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

export function createMonitorChannel(userId: string): RealtimeChannel {
  return supabase.channel(MONITOR_CHANNEL, {
    config: { presence: { key: userId }, broadcast: { self: false, ack: false } },
  });
}

export type CommandAction =
  | "lock"
  | "unlock"
  | "message"
  | "open-url"
  | "shutdown"
  | "reboot"
  | "logout"
  | "screenshot";

export type MonitorEvent =
  | { type: "request-stream"; from: string; to: string }
  | { type: "stop-stream"; from: string; to: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "command"; from: string; to: string; action: CommandAction; payload?: any }
  | { type: "screenshot-image"; from: string; to: string; image: string /* dataURL */ };

export interface AgentPresence {
  user_id: string;
  name: string;
  classroom?: string | null;
  /** ห้องคอมพิวเตอร์/สถานที่จริงของเครื่อง (จาก kiosk_devices.meta.room) */
  room?: string | null;
  role?: string;
  online_at: string;
}

/** ยิงคำสั่งไปยัง local control daemon บนเครื่อง Kiosk (Student mode) */
export async function callLocalCtl(path: string, body?: any): Promise<boolean> {
  try {
    const r = await fetch(`${LOCAL_CTL_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      // สั้น ๆ พอ — ถ้าไม่ได้เปิด daemon จะ error เร็ว
      signal: AbortSignal.timeout(2500),
    });
    return r.ok;
  } catch {
    return false;
  }
}
