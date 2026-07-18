import { supabase } from "@/integrations/supabase/client";

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
    console.warn(`[createStorageSignedUrl] ${bucket}/${path}:`, error);
    return "";
  }
  return data.signedUrl;
}

/**
 * Helper: คืนค่า signed URL จาก path เก็บใน DB (รองรับทั้ง path ตรงและ legacy public URL)
 */
export async function resolveStorageUrl(bucket: string, pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  if (/^(data:|https?:\/\/)/i.test(pathOrUrl)) return pathOrUrl;
  // ถ้าเป็น URL เก่าที่เก็บไว้ ลองดึง path ออกมา
  const match = pathOrUrl.match(new RegExp(`/${bucket}/(.+?)(\\?|$)`));
  const path = match ? match[1] : pathOrUrl;
  return createStorageSignedUrl(bucket, path);
}
