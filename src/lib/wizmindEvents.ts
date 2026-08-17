/**
 * WizMind / CCTV bridge — ตัวรับ event ใบหน้าแบบ realtime
 *
 * สถาปัตยกรรม:
 *   กล้อง Dahua WizMind (AI Face Detection) → ส่ง snapshot ใบหน้าที่ crop แล้ว
 *   → bridge service (scripts/kiosk/wizmind-bridge.mjs) → edge function `wizmind-bridge`
 *   → ตาราง public.camera_face_events (realtime) → เครื่อง Kiosk เครื่องนี้จดจำว่าเป็นใคร
 *
 * ข้อดี: Kiosk ไม่ต้องรัน detection ทั้งเฟรมตลอดเวลา (ลด CPU มาก) และได้ภาพ "best shot"
 * ที่กล้องเลือกให้แล้ว → แม่นขึ้น + หน่วงต่ำ (~0.5–1.5 วิ)
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const WIZMIND_ENABLED_KEY = "face_kiosk_wizmind_enabled";
export const WIZMIND_CAMERA_KEY = "face_kiosk_wizmind_camera_id";

export type CameraFaceEvent = {
  id: string;
  created_at: string;
  camera_id: string;
  camera_name: string | null;
  event_type: string;
  snapshot_path: string | null;
  confidence: number | null;
  bbox: unknown;
  processed: boolean;
};

/** event ที่เก่ากว่านี้ถือว่าตกยุค — ทิ้งเพื่อรักษาความ realtime */
export const MAX_EVENT_AGE_MS = 8000;

export function isEventFresh(e: { created_at: string }, maxAgeMs = MAX_EVENT_AGE_MS): boolean {
  const t = new Date(e.created_at).getTime();
  return Number.isFinite(t) ? Date.now() - t <= maxAgeMs : true;
}

/** โหลดภาพ snapshot จาก bucket `camera-events` เป็น HTMLImageElement พร้อมใช้กับ face-api */
export async function loadEventImage(path: string, signal?: AbortSignal): Promise<HTMLImageElement | null> {
  const { data, error } = await supabase.storage.from("camera-events").createSignedUrl(path, 120);
  if (error || !data?.signedUrl) return null;
  const res = await fetch(data.signedUrl, { signal });
  if (!res.ok) return null;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image_decode_failed"));
      img.src = url;
    });
    // decode แล้วค่อยปล่อย object URL หลังจาก consumer ใช้เสร็จ (เก็บไว้บน element)
    (img as any).__objectUrl = url;
    return img;
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

export function releaseEventImage(img: HTMLImageElement | null) {
  const u = (img as any)?.__objectUrl;
  if (u) { try { URL.revokeObjectURL(u); } catch { /* noop */ } }
}

/** อัปเดตผลการจดจำกลับไปที่ event (ใช้ทำรายงาน/ตรวจสอบย้อนหลัง) */
export async function markEventProcessed(
  id: string,
  result: { matchedUserId?: string | null; matchedName?: string | null; personType?: string | null; distance?: number | null },
): Promise<void> {
  await supabase
    .from("camera_face_events" as any)
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      matched_user_id: result.matchedUserId ?? null,
      matched_name: result.matchedName ?? null,
      matched_person_type: result.personType ?? null,
      match_distance: result.distance ?? null,
    })
    .eq("id", id);
}

/**
 * สมัครรับ event แบบ realtime
 * @param cameraId ว่าง = รับทุกกล้อง
 */
export function subscribeWizmindEvents(
  cameraId: string,
  onEvent: (e: CameraFaceEvent) => void,
  onStatus?: (status: string) => void,
): () => void {
  const filter = cameraId ? `camera_id=eq.${cameraId}` : undefined;
  const channel: RealtimeChannel = supabase
    .channel(`wizmind-${cameraId || "all"}-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      "postgres_changes" as any,
      { event: "INSERT", schema: "public", table: "camera_face_events", ...(filter ? { filter } : {}) },
      (payload: any) => {
        const row = payload?.new as CameraFaceEvent | undefined;
        if (row?.snapshot_path) onEvent(row);
      },
    )
    .subscribe((status) => onStatus?.(status));

  return () => { try { supabase.removeChannel(channel); } catch { /* noop */ } };
}
