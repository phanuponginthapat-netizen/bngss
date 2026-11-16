import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { imageStorageSource } from './imageStorageSource';
import { getBackendConfig } from './runtimeConfig';

const BUCKET = "profile-images";
const LONG_EXPIRY_SEC = 3600;

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

export async function resolveProfileImageUrl(url: string | null | undefined, forceRefresh = false): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  const source = imageStorageSource(url);
  if (!source) return url;
  const { path, bucket } = source;
  const { data: sessionData } = await supabase.auth.getSession();
  const key = `${getBackendConfig().url}:${sessionData.session?.user.id || 'signed-out'}:${bucket}/${path}`;
  const cached = !forceRefresh && readStored(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, LONG_EXPIRY_SEC);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('อ่านลิงก์รูปไม่สำเร็จ');
    const signed = data.signedUrl;
    if (data?.signedUrl) {
      writeStored(key, data.signedUrl);
    }
    return signed;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Concurrent mounts share one request; signed URLs persist for a week across reloads.
const inflight = new Map<string, Promise<string>>();
const STORE_KEY = "profile-img-signed:";
const STORE_TTL_MS = 50 * 60 * 1000;
function readStored(path: string): string | null {
  try {
    const raw = localStorage.getItem(STORE_KEY + path);
    if (!raw) return null;
    const { u, t } = JSON.parse(raw);
    return Date.now() - t < STORE_TTL_MS ? u : null;
  } catch { return null; }
}
function writeStored(path: string, u: string) {
  try { localStorage.setItem(STORE_KEY + path, JSON.stringify({ u, t: Date.now() })); } catch { /* quota */ }
}

export function useProfileImageUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url) return null;
    const path = extractProfileImagePath(url);
    return imageStorageSource(url) ? null : url;
  });
  useEffect(() => {
    let alive = true;
    setResolved(null);
    resolveProfileImageUrl(url).then((r) => {
      if (alive) setResolved(r);
    }).catch(() => { if (alive) setResolved(null); });
    return () => { alive = false; };
  }, [url]);
  return resolved;
}
