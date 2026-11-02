import { supabase } from "@/integrations/supabase/client";
import { getBackendConfig } from "./runtimeConfig";

/**
 * Returns direct URL to stream an offloaded file from Drive via storage-tier Edge Function.
 */
export function getColdStorageFetchUrl(bucket: string, path: string): string {
  const base = getBackendConfig().url.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${base}/functions/v1/storage-tier?action=fetch&bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(cleanPath)}`;
}

/** Private files use the user's session, never an unprotected browser URL. */
export async function getPrivateColdStorageUrl(bucket: string, path: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("กรุณาเข้าสู่ระบบก่อนเปิดไฟล์");
  const response = await fetch(getColdStorageFetchUrl(bucket, path), {
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: getBackendConfig().anonKey },
  });
  if (!response.ok) throw new Error(`เปิดไฟล์ Drive ไม่สำเร็จ (${response.status})`);
  const objectUrl = URL.createObjectURL(await response.blob());
  // Do not retain copies in Cloud; release this temporary browser allocation.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 60 * 1000);
  return objectUrl;
}

/**
 * Resolves file URL with automatic cold storage fallback.
 * Uses the Supabase public URL and only falls back to Drive when the object
 * is registered as offloaded.
 */
export async function getFileUrlWithColdFallback(bucket: string, path: string): Promise<string> {
  if (!path) return "";
  const cleanPath = path.replace(/^\/+/, "");

  const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
  const publicUrl = pubData?.publicUrl;
  if (!publicUrl) return getColdStorageFetchUrl(bucket, cleanPath);

  try {
    const res = await fetch(publicUrl, { method: "HEAD" });
    if (res.ok) return publicUrl;
  } catch {
    // ignore network error on HEAD check
  }

  try {
    const { data: reg } = await (supabase as any)
      .from("cold_storage_registry")
      .select("id")
      .eq("bucket_name", bucket)
      .eq("file_path", cleanPath)
      .maybeSingle();
    if (reg) return getColdStorageFetchUrl(bucket, cleanPath);
  } catch (e) {
    console.warn("Cold storage registry check error:", e);
  }

  return publicUrl;
}

/**
 * Helper to ensure AR assets / Padlet / Application assets load with cold storage fallback.
 */
export async function resolveAppAssetUrl(assetPath: string, bucket = "documents"): Promise<string> {
  if (/^(https?:\/\/|data:|blob:)/i.test(assetPath)) return assetPath;
  return await getFileUrlWithColdFallback(bucket, assetPath);
}
