import { supabase } from "@/integrations/supabase/client";
import { getColdStorageFetchUrl } from "./coldStorage";

/** บัคเก็ตที่เปิดสาธารณะ — ใช้ public URL ได้ทันที (ไม่ต้อง sign) */
const PUBLIC_BUCKETS = new Set([
  "app-downloads",
  "ar-media",
  "certificate-assets",
  "cms-images",
  "cms-logos",
  "exam-scans",
  "game-covers",
  "garbage-images",
  "line-richmenu",
  "padlet-media",
  "pdf-templates",
  "print-templates",
  "profile-images",
]);

const signedCache = new Map<string, { url: string; exp: number }>();

/**
 * สำหรับ private buckets — สร้าง signed URL อายุ 1 ชั่วโมง (default)
 * ถ้าไฟล์ถูกย้ายไป cold storage แล้ว จะคืนลิงก์สตรีมจาก Google Drive แทน
 */
export async function createStorageSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const key = `${bucket}/${path}`;
  const hit = signedCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;

  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (data?.signedUrl) {
    signedCache.set(key, { url: data.signedUrl, exp: Date.now() + (expiresInSeconds - 60) * 1000 });
    return data.signedUrl;
  }
  // ไม่พบไฟล์ / ถูก offload → ลองสตรีมจาก cold storage
  return getColdStorageFetchUrl(bucket, path);
}

/**
 * คืน URL ที่ใช้แสดงผลได้จริง รองรับทั้ง path ตรง, legacy public URL และ signed URL
 * - bucket สาธารณะ → public URL
 * - bucket ส่วนตัว → signed URL (แคชไว้ 1 ชม.)
 */
export async function resolveStorageUrl(bucket: string, pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  if (/^(data:|blob:)/i.test(pathOrUrl)) return pathOrUrl;

  // ลิงก์เต็มที่ไม่ใช่ของ storage bucket นี้ → คืนค่าเดิม
  const match = pathOrUrl.match(new RegExp(`/${bucket}/(.+?)(\\?|$)`));
  if (/^https?:\/\//i.test(pathOrUrl) && !match) return pathOrUrl;

  // signed URL ที่ยังมี token อยู่แล้ว → ใช้ได้เลย
  if (pathOrUrl.includes("/object/sign/") && pathOrUrl.includes("token=")) return pathOrUrl;

  const path = decodeURIComponent(match ? match[1] : pathOrUrl).replace(/^\/+/, "");

  if (PUBLIC_BUCKETS.has(bucket)) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || pathOrUrl;
  }

  return createStorageSignedUrl(bucket, path);
}
