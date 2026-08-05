import { supabase } from "@/integrations/supabase/client";
import { isGoogleDriveStorage } from "@/lib/runtimeConfig";

export type DriveUploadResult = {
  fileId: string;
  path: string;
  publicUrl: string;
  webViewLink?: string;
};

const toBase64 = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const v = String(reader.result || "");
      resolve(v.includes(",") ? v.split(",")[1] : v);
    };
    reader.onerror = () => reject(reader.error ?? new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });

/** อัปโหลดไฟล์ขึ้น Google Drive ผ่าน edge function drive-storage */
export async function uploadToDrive(
  path: string,
  file: File | Blob,
  opts?: { contentType?: string; public?: boolean },
): Promise<DriveUploadResult> {
  const { data, error } = await supabase.functions.invoke("drive-storage", {
    body: {
      action: "upload",
      path,
      base64: await toBase64(file),
      contentType: opts?.contentType || (file as File).type || "application/octet-stream",
      public: opts?.public ?? true,
    },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ? JSON.stringify(data.error) : "อัปโหลดขึ้น Google Drive ไม่สำเร็จ");
  return data as DriveUploadResult;
}

export async function deleteFromDrive(fileId: string) {
  const { error } = await supabase.functions.invoke("drive-storage", { body: { action: "delete", fileId } });
  if (error) throw error;
}

export async function listDriveFiles() {
  const { data, error } = await supabase.functions.invoke("drive-storage", { body: { action: "list" } });
  if (error) throw error;
  return (data?.files ?? []) as { id: string; name: string; mimeType: string; size?: string }[];
}

export const driveStorageEnabled = isGoogleDriveStorage;
