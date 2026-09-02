import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bngss.supabase.co";

/**
 * Returns direct URL to stream an offloaded file from Drive via storage-tier Edge Function.
 */
export function getColdStorageFetchUrl(bucket: string, path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `${SUPABASE_URL}/functions/v1/storage-tier?action=fetch&bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(cleanPath)}`;
}

/**
 * Resolves file URL with automatic cold storage fallback.
 * Checks Supabase Storage public URL first; if not present, falls back to cold storage stream.
 */
export async function getFileUrlWithColdFallback(bucket: string, path: string): Promise<string> {
  if (!path) return "";
  const cleanPath = path.replace(/^\/+/, "");

  // Standard public URL from Supabase Storage
  const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
  const publicUrl = pubData?.publicUrl;

  if (!publicUrl) {
    return getColdStorageFetchUrl(bucket, cleanPath);
  }

  try {
    // Check HEAD request to verify file availability in Supabase Storage
    const res = await fetch(publicUrl, { method: "HEAD" });
    if (res.ok) {
      return publicUrl;
    }
  } catch (e) {
    // Ignore network error on HEAD check
  }

  // If missing from Supabase Storage (e.g. 404), check cold storage registry
  try {
    const { data: reg } = await (supabase as any)
      .from("cold_storage_registry")
      .select("drive_web_link, id")
      .eq("bucket_name", bucket)
      .eq("file_path", cleanPath)
      .maybeSingle();

    if (reg) {
      return getColdStorageFetchUrl(bucket, cleanPath);
    }
  } catch (e) {
    console.warn("Cold storage registry check error:", e);
  }

  // Default back to public URL
  return publicUrl;
}

/**
 * Helper to ensure AR assets / Padlet / Application assets load with cold storage fallback.
 */
export async function resolveAppAssetUrl(assetPath: string, bucket = "documents"): Promise<string> {
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://") || assetPath.startsWith("data:")) {
    return assetPath;
  }
  return await getFileUrlWithColdFallback(bucket, assetPath);
}
