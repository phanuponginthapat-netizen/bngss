import { supabase } from "@/integrations/supabase/client";

/**
 * อ่านภาพที่เก็บไวใน Storage (พาธสวนตัว, public URL หรือ signed URL จาก backend ใดก็ได)
 * ด้วยลิงก์สั้่นที่สรางขึ้่นใหมทุกครัง
 *
 * เก็บเฉพาะ "พาธ" ไวในฐานข้อมูลเสมอ เพราะลิงก์ชั้่นคราวหมดอายุได และ
 * ลิงก์ที่เก็บไวตังแต backend เก่าจะอางถิงเครื่องที่เลิกใชงานแล้ว
 *
 * ถาอ่านไมได (ไฟลยไมมี, เชื่อมตอขัดขอ) ใหคืน null แทนการโยนขอกำเนิด
 * เพื่ือใหรายการทังหนายังแสดงได ตอใหรูปบางรูปอางไมไดก็ตาม
 */

const SIGNED_SECONDS = 3600;
/** ไมพยามยามอ่านพาธที่ลมเหลวซำทุก 15 วินาที */
const FAILURE_RETRY_MS = 10 * 60_000;

const readable = new Map<string, { url: string; exp: number }>();
const unreadable = new Map<string, number>();

/** แยกคาที่เก็บไวออกเป็นชื่อบัคเก็ตกับพาธ */
export function kioskMediaParts(raw: unknown, defaultBucket = "face-photos"): { bucket: string; path: string } | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  const match = value.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?]+)\/([^?#]+)/);
  if (match) {
    const path = decodeURIComponent(match[2]).replace(/^\/+/, "");
    return match[1] && path ? { bucket: match[1], path } : null;
  }
  if (/^https?:\/\//i.test(value)) return null;
  const path = decodeURIComponent(value).replace(/^\/+/, "");
  return path ? { bucket: defaultBucket, path } : null;
}

export async function resolveKioskMediaUrl(raw: unknown, defaultBucket = "face-photos"): Promise<string | null> {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  if (/^(data:|blob:)/i.test(value)) return null;

  const parts = kioskMediaParts(value, defaultBucket);
  if (!parts) return null;
  const key = `${parts.bucket}/${parts.path}`;

  const hit = readable.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const retryAt = unreadable.get(key);
  if (retryAt && retryAt > Date.now()) return null;

  try {
    const { data, error } = await supabase.storage.from(parts.bucket).createSignedUrl(parts.path, SIGNED_SECONDS);
    if (error || !data?.signedUrl) {
      unreadable.set(key, Date.now() + FAILURE_RETRY_MS);
      return null;
    }
    readable.set(key, { url: data.signedUrl, exp: Date.now() + (SIGNED_SECONDS - 120) * 1000 });
    return data.signedUrl;
  } catch {
    unreadable.set(key, Date.now() + FAILURE_RETRY_MS);
    return null;
  }
}
