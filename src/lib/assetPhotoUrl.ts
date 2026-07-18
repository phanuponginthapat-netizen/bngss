import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const BUCKET = "asset-photos";
// 10 years; long enough that stored URLs effectively never expire for this lifecycle.
const LONG_EXPIRY_SEC = 60 * 60 * 24 * 365 * 10;

/** Upload a file to asset-photos and return a long-lived signed URL. */
export async function uploadAssetPhoto(path: string, file: Blob | File): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file instanceof File ? file.type || "image/jpeg" : "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, LONG_EXPIRY_SEC);
  if (signErr || !data?.signedUrl) throw signErr || new Error("sign failed");
  return data.signedUrl;
}

/** Extract asset-photos object path from a stored URL (handles old public URLs and signed URLs). */
export function extractAssetPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const m =
    url.match(/\/storage\/v1\/object\/public\/asset-photos\/([^?]+)/) ||
    url.match(/\/storage\/v1\/object\/sign\/asset-photos\/([^?]+)/) ||
    url.match(/\/asset-photos\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Resolve any stored asset-photos URL (public or signed) to a fresh signed URL.
 * Returns input untouched if it's not an asset-photos URL.
 */
export async function resolveAssetPhotoUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const path = extractAssetPath(url);
  if (!path) return url;
  // If it's already a signed URL with a token, just use it.
  if (url.includes("/object/sign/") && url.includes("token=")) return url;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, LONG_EXPIRY_SEC);
  return data?.signedUrl || url;
}

/** React hook: resolve a stored asset-photos URL to a usable signed URL. */
export function useAssetPhotoUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(url || null);
  useEffect(() => {
    let alive = true;
    resolveAssetPhotoUrl(url).then((r) => {
      if (alive) setResolved(r);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return resolved;
}
