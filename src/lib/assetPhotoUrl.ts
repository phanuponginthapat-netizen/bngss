import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { resolveStorageUrl } from "./storageUrl";

const BUCKET = "asset-photos";
/** Upload a file and persist a durable bucket/path reference; sign only at read time. */
export async function uploadAssetPhoto(path: string, file: Blob | File): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file instanceof File ? file.type || "image/jpeg" : "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return `${BUCKET}/${path}`;
}

/** Extract asset-photos object path from a stored URL (handles old public URLs and signed URLs). */
export function extractAssetPath(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith(`${BUCKET}/`)) return url.slice(BUCKET.length + 1);
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
  return resolveStorageUrl(BUCKET, path);
}

/** React hook: resolve a stored asset-photos URL to a usable signed URL. */
export function useAssetPhotoUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(url || null);
  useEffect(() => {
    let alive = true;
    setResolved(null);
    resolveAssetPhotoUrl(url).then((r) => {
      if (alive) setResolved(r);
    }).catch(() => { if (alive) setResolved(null); });
    return () => {
      alive = false;
    };
  }, [url]);
  return resolved;
}
