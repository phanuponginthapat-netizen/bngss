import { supabase } from "@/integrations/supabase/client";
import { getBackendConfig } from "@/lib/runtimeConfig";
import { getColdStorageFetchUrl, getPrivateColdStorageUrl } from "./coldStorage";
import { imageStorageSource } from './imageStorageSource';

/** base สำหรับอ่านไฟล์จาก bucket app-downloads (private) — ต้องแนบ anon key ใน header */
export const APP_DOWNLOADS_BASE = `${getBackendConfig().url}/storage/v1/object/app-downloads`;
const APP_DOWNLOADS_HEADERS = {
  apikey: getBackendConfig().anonKey,
  Authorization: `Bearer ${getBackendConfig().anonKey}`,
};

/** อ่านไฟล์ JSON (manifest รุ่นล่าสุด) จาก app-downloads — คืน null ถ้าอ่านไม่ได้ */
export async function fetchAppDownloadsJson<T = unknown>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${APP_DOWNLOADS_BASE}/${path}?t=${Date.now()}`, {
      cache: "no-store",
      headers: APP_DOWNLOADS_HEADERS,
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** บัคเก็ตที่เปิดสาธารณะ — ใช้ public URL ได้ทันที (ไม่ต้อง sign) */
const PUBLIC_BUCKETS = new Set([
  // "app-downloads" เป็น private บน Lovable Cloud — ใช้ signed URL เสมอ
  "certificate-assets",
  "cms-images",
  "cms-logos",
  "garbage-images",
  "line-richmenu",
  "padlet-media",
  "pdf-templates",
  "print-templates",
]);

const signedCache = new Map<string, { url: string; exp: number }>();

/** Explicit attachment retry renews only this backend/user/object token. */
export async function invalidateStorageSignedUrl(bucket: string, path: string): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  signedCache.delete(`${getBackendConfig().url}:${auth.session?.user.id || 'signed-out'}:${bucket}/${path}`);
}

/**
 * สำหรับ private buckets — สร้าง signed URL อายุ 1 ชั่วโมง (default)
 * ถ้าไฟล์ถูกย้ายไป cold storage แล้ว จะคืนลิงก์สตรีมจาก Google Drive แทน
 */
export async function createStorageSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data: auth } = await supabase.auth.getSession();
  const key = `${getBackendConfig().url}:${auth.session?.user.id || 'signed-out'}:${bucket}/${path}`;
  const hit = signedCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (data?.signedUrl) {
    signedCache.set(key, { url: data.signedUrl, exp: Date.now() + (expiresInSeconds - 60) * 1000 });
    return data.signedUrl;
  }
  // A missing Cloud file is not evidence of a Drive copy.
  if (await isOffloaded(bucket, path)) return getPrivateColdStorageUrl(bucket, path);
  throw error || new Error("ไม่พบไฟล์ต้นฉบับหรือสำเนาใน Drive กรุณาอัปโหลดไฟล์ใหม่");
}

/**
 * คืน URL ที่ใช้แสดงผลได้จริง รองรับทั้ง path ตรง, legacy public URL และ signed URL
 * - bucket สาธารณะ → public URL
 * - bucket ส่วนตัว → signed URL (แคชไว้ 1 ชม.)
 */
export async function resolveStorageUrl(bucket: string, pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  if (/^(data:|blob:)/i.test(pathOrUrl)) return pathOrUrl;

  const source = imageStorageSource(pathOrUrl, bucket);
  if (!source) return pathOrUrl;
  bucket = source.bucket;
  const path = source.path.replace(/^\/+/, "");

  if (await isOffloaded(bucket, path)) {
    return PUBLIC_BUCKETS.has(bucket) ? getColdStorageFetchUrl(bucket, path) : getPrivateColdStorageUrl(bucket, path);
  }

  if (PUBLIC_BUCKETS.has(bucket)) {
    // ถ้าไฟล์ถูกย้ายไปเก็บที่ Google Drive แล้ว ให้สตรีมจาก cold storage แทน
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || pathOrUrl;
  }

  return createStorageSignedUrl(bucket, path);
}

async function isOffloaded(bucket: string, path: string): Promise<boolean> {
  // Exact, current lookup avoids truncated bucket lists and stale archive entries.
  const { data, error } = await supabase
    .from("cold_storage_registry")
    .select("drive_file_id")
    .eq("bucket_name", bucket)
    .eq("file_path", path)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.drive_file_id);
}

