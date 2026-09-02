import { supabase } from "@/integrations/supabase/client";
import { getFileUrlWithColdFallback } from "./coldStorage";

/**
 * สำหรับ private buckets — สร้าง signed URL อายุ 1 ชั่วโมง (default)
 * ใช้แทน getPublicUrl กับ buckets: home-visit-photos, pa-files, pp6-files
 */
export async function createStorageSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    // Fallback to cold storage stream if missing/offloaded
    return getFileUrlWithColdFallback(bucket, path);
  }
  return data.signedUrl;
}

/**
 * Helper: คืนค่า URL พร้อม Cold Storage (Google Drive) Fallback โดยอัตโนมัติ
 * รองรับทั้ง path ตรง, legacy public URL และไฟล์ที่ถูก offload ไปแล้ว
 */
export async function resolveStorageUrl(bucket: string, pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  if (/^(data:|https?:\/\/)/i.test(pathOrUrl)) return pathOrUrl;
  
  const match = pathOrUrl.match(new RegExp(`/${bucket}/(.+?)(\\?|$)`));
  const path = match ? match[1] : pathOrUrl;
  
  return await getFileUrlWithColdFallback(bucket, path);
}
