import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const BUCKET = "profile-images";
const LONG_EXPIRY_SEC = 60 * 60 * 24 * 365 * 10;

// In-memory cache — avoids re-signing the same avatar on every render/mount.
const cache = new Map<string, string>();

export function extractProfileImagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const m =
    url.match(/\/storage\/v1\/object\/public\/profile-images\/([^?]+)/) ||
    url.match(/\/storage\/v1\/object\/sign\/profile-images\/([^?]+)/) ||
    url.match(/\/profile-images\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function resolveProfileImageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  const path = extractProfileImagePath(url);
  if (!path) return url;
  // Already a live signed URL
  if (url.includes("/object/sign/") && url.includes("token=")) return url;
  const cached = cache.get(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, LONG_EXPIRY_SEC);
  const signed = data?.signedUrl || url;
  cache.set(path, signed);
  return signed;
}

export function useProfileImageUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url) return null;
    const path = extractProfileImagePath(url);
    return (path && cache.get(path)) || (url.includes("token=") ? url : null);
  });
  useEffect(() => {
    let alive = true;
    resolveProfileImageUrl(url).then((r) => {
      if (alive) setResolved(r);
    });
    return () => { alive = false; };
  }, [url]);
  return resolved;
}
