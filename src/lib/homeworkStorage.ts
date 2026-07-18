import { supabase } from "@/integrations/supabase/client";

export type Attachment = {
  id: string;
  name: string;
  path: string;
  mime: string;
  size: number;
  uploaded_by?: string | null;
  uploaded_at?: string;
};

const BUCKET = "homework-files";

const safeName = (name: string) => {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^\w]+/g, "").toLowerCase() : "";
  const safe = (base || "file") + (ext ? `.${ext}` : "");
  return safe.slice(-120);
};

export async function uploadHomeworkFile(file: File, folder: string): Promise<Attachment> {
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id || "anon";
  const id = crypto.randomUUID();
  const path = `${folder}/${uid}/${id}_${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return {
    id,
    name: file.name,
    path,
    mime: file.type || "application/octet-stream",
    size: file.size,
    uploaded_by: uid,
    uploaded_at: new Date().toISOString(),
  };
}

export async function signedHomeworkUrl(path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadHomeworkBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data;
}

const ext = (name?: string) => (name || "").toLowerCase().split(".").pop() || "";

export const isImageMime = (m?: string, name?: string) =>
  (!!m && m.startsWith("image/")) || ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg", "heic", "heif"].includes(ext(name));
export const isPdfMime = (m?: string, name?: string) =>
  m === "application/pdf" || ext(name) === "pdf";

export const isDocxMime = (m?: string, name?: string) =>
  m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext(name) === "docx";
export const isXlsxMime = (m?: string, name?: string) =>
  m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
  m === "text/csv" ||
  ["xlsx", "xls", "csv"].includes(ext(name));
export const isPptxMime = (m?: string, name?: string) =>
  m === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || ext(name) === "pptx";

export const isOfficeMime = (m?: string, name?: string) =>
  isDocxMime(m, name) || isXlsxMime(m, name) || isPptxMime(m, name);

export const isEditableMime = (m?: string, name?: string) =>
  isImageMime(m, name) || isPdfMime(m, name) || isOfficeMime(m, name);
