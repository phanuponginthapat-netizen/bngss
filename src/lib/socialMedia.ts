import { supabase } from "@/integrations/supabase/client";

// Keep durable object paths in records; renew temporary URLs only when reading.
export function storageMediaPath(value: string, bucket: string): string | null {
  if (!value) return null;
  if (!/^https?:/i.test(value)) return /^(data:|blob:)/i.test(value) ? null : value;
  try {
    const url = new URL(value);
    const backend = new URL(import.meta.env.VITE_SUPABASE_URL);
    if (url.origin !== backend.origin) return null;
    const prefix = `/storage/v1/object/`;
    for (const mode of ["sign", "public", "authenticated"]) {
      const marker = `${prefix}${mode}/${bucket}/`;
      if (url.pathname.startsWith(marker)) return decodeURIComponent(url.pathname.slice(marker.length));
    }
  } catch { return null; }
  return null;
}

export async function resolveSocialMedia(value: string, bucket: "portfolio" | "wall-media") {
  const path = storageMediaPath(value, bucket);
  if (!path) return value;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("ไม่สามารถเปิดไฟล์แนบได้");
  return data.signedUrl;
}

export function validSocialLink(value: string) {
  try { return ["https:", "http:"].includes(new URL(value.trim()).protocol); }
  catch { return false; }
}