import { supabase } from "@/integrations/supabase/client";

export type UploadFallbackResult = {
  path: string;
  publicUrl: string;
  usedFallback: boolean;
};

const isStorageSchemaError = (error: { name?: string; message?: string } | null | undefined) => {
  const message = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    message.includes("databaseinvalidobjectdefinition") ||
    message.includes("database schema is invalid or incompatible") ||
    message.includes("invalid object definition")
  );
};

export const isDataUrl = (value?: string | null) => Boolean(value?.startsWith("data:"));

export const fileToDataUrl = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });

/**
 * Sanitize a storage object key. Supabase Storage rejects keys containing
 * non-ASCII characters (e.g. Thai), spaces, parentheses, or other special
 * symbols with `Invalid key`. We keep the directory structure (`/`), dot,
 * dash, and underscore, replace everything else with `_`, and collapse runs.
 */
export const sanitizeStorageKey = (key: string): string => {
  const segments = key.split("/").map((seg) =>
    seg
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[._-]+|[._-]+$/g, "")
  );
  const cleaned = segments.filter(Boolean).join("/");
  return cleaned || `file_${Date.now()}`;
};

export const uploadPublicFileWithFallback = async (
  bucket: string,
  rawPath: string,
  file: File | Blob,
  options?: Parameters<ReturnType<typeof supabase.storage.from>["upload"]>[2]
): Promise<UploadFallbackResult> => {
  const path = sanitizeStorageKey(rawPath);
  const { error } = await supabase.storage.from(bucket).upload(path, file, options);

  if (!error) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl, usedFallback: false };
  }

   if (!isStorageSchemaError(error)) {
    throw error;
  }

  const dataUrl = await fileToDataUrl(file);
  return { path: dataUrl, publicUrl: dataUrl, usedFallback: true };
};

export const uploadPrivateFileWithFallback = async (
  bucket: string,
  rawPath: string,
  file: File | Blob,
  options?: Parameters<ReturnType<typeof supabase.storage.from>["upload"]>[2]
): Promise<{ path: string; usedFallback: boolean }> => {
  const path = sanitizeStorageKey(rawPath);
  const { error } = await supabase.storage.from(bucket).upload(path, file, options);

  if (!error) return { path, usedFallback: false };

  if (!isStorageSchemaError(error)) {
    throw error;
  }

  return { path: await fileToDataUrl(file), usedFallback: true };
};

export const openDataUrl = (dataUrl: string, fileName = "download") => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
};