import { supabase } from "@/integrations/supabase/client";

export const LEAVE_BUCKET = "leave-attachments";

/**
 * Upload a leave attachment (image/PDF) and return the storage path.
 * The path is always scoped to the authenticated user's id so that
 * storage RLS policies can enforce per-owner access. The optional
 * `ownerHint` is kept for backward compatibility but is no longer used
 * for the storage folder.
 */
export async function uploadLeaveAttachment(file: File, _ownerHint?: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ต้องเข้าสู่ระบบก่อนอัปโหลดไฟล์");
  const ext = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(LEAVE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

/** Open a leave attachment by generating a temporary signed URL. */
export async function openLeaveAttachment(pathOrUrl: string) {
  if (!pathOrUrl) return;
  if (pathOrUrl.startsWith("http")) {
    window.open(pathOrUrl, "_blank");
    return;
  }
  const { data, error } = await supabase.storage
    .from(LEAVE_BUCKET)
    .createSignedUrl(pathOrUrl, 60 * 10);
  if (error || !data?.signedUrl) throw error || new Error("Cannot create signed URL");
  window.open(data.signedUrl, "_blank");
}
