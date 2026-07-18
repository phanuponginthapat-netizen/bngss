import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

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

const SIGNED_BUCKETS = new Set(["face-photos", "asset-photos"]);

function extractBucketAndPath(value: string): { bucket: string; path: string } | null {
  const urlMatch = value.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  if (urlMatch) {
    return { bucket: decodeURIComponent(urlMatch[1]), path: decodeURIComponent(urlMatch[2]) };
  }

  // face registration stores private face-photos paths such as
  // requests/<request-id>/<file>.jpg directly in students.photo_url.
  if (/^(requests|scans)\//.test(value)) {
    return { bucket: "face-photos", path: value };
  }

  return null;
}

/**
 * Resolve image values used by profile/student/photo fields.
 * - Public URLs and data URLs are returned as-is.
 * - Private face-photos paths/URLs are converted to fresh signed URLs.
 */
export async function resolveDisplayImageUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("data:")) return value;

  const found = extractBucketAndPath(value);
  if (!found) return value;

  if (/\/object\/sign\//.test(value) && value.includes("token=")) return value;
  if (!SIGNED_BUCKETS.has(found.bucket)) return value;

  const { data, error } = await supabase.storage
    .from(found.bucket)
    .createSignedUrl(found.path, 60 * 60);
  if (error || !data?.signedUrl) {
    console.warn(`[resolveDisplayImageUrl] ${found.bucket}/${found.path}:`, error);
    return value;
  }
  return data.signedUrl;
}

export function useResolvedImageUrl(value: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(value || null);

  useEffect(() => {
    let alive = true;
    setResolved(value || null);
    resolveDisplayImageUrl(value).then((url) => {
      if (alive) setResolved(url);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  return resolved;
}
