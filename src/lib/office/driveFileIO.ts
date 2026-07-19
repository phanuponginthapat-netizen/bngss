// Helpers for reading/writing files on the user's Google Drive via gdrive-proxy edge function.
import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdrive-proxy`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    "apikey": ANON,
    "Authorization": `Bearer ${data.session?.access_token ?? ANON}`,
  };
}

async function callProxy(payload: unknown, binary = false): Promise<Response> {
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok && !binary) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Drive proxy error ${res.status}`);
  }
  return res;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export async function listRecentOfficeFiles(limit = 20): Promise<DriveFile[]> {
  const mimes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/pdf",
  ];
  const q = `(${mimes.map(m => `mimeType='${m}'`).join(" or ")}) and trashed=false`;
  const res = await callProxy({
    path: "/files",
    method: "GET",
    query: {
      q,
      orderBy: "modifiedTime desc",
      pageSize: limit,
      fields: "files(id,name,mimeType,modifiedTime,size,parents)",
    },
  });
  const json = await res.json();
  return json.files ?? [];
}

export async function listFolders(parentId = "root"): Promise<DriveFile[]> {
  const res = await callProxy({
    path: "/files",
    method: "GET",
    query: {
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      orderBy: "name",
      pageSize: 200,
      fields: "files(id,name,mimeType,parents)",
    },
  });
  const json = await res.json();
  return json.files ?? [];
}

export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const res = await callProxy({
    path: `/files/${fileId}`,
    method: "GET",
    query: { alt: "media" },
  }, true);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.arrayBuffer();
}

export async function getFileMeta(fileId: string): Promise<DriveFile> {
  const res = await callProxy({
    path: `/files/${fileId}`,
    method: "GET",
    query: { fields: "id,name,mimeType,modifiedTime,size,parents" },
  });
  return res.json();
}

function abToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Create a new file with the given content and name in a folder (default root). */
export async function createFile(opts: {
  name: string;
  mimeType: string;
  data: ArrayBuffer | Blob;
  folderId?: string;
}): Promise<DriveFile> {
  // Step 1: create metadata
  const metaRes = await callProxy({
    path: "/files",
    method: "POST",
    body: {
      name: opts.name,
      mimeType: opts.mimeType,
      parents: opts.folderId ? [opts.folderId] : undefined,
    },
    query: { fields: "id,name,mimeType,parents,modifiedTime" },
  });
  const meta = await metaRes.json();
  if (!meta.id) throw new Error("Create failed: " + JSON.stringify(meta));

  // Step 2: upload media
  const buf = opts.data instanceof Blob ? await opts.data.arrayBuffer() : opts.data;
  const uploadRes = await callProxy({
    upload_url: `/upload/drive/v3/files/${meta.id}`,
    method: "PATCH",
    query: { uploadType: "media" },
    headers: { "Content-Type": opts.mimeType },
    body_b64: abToBase64(buf),
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);
  return { ...meta, ...(await uploadRes.json()) };
}

/** Overwrite an existing file's content. */
export async function updateFileContent(fileId: string, data: ArrayBuffer | Blob, mimeType: string): Promise<void> {
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  const res = await callProxy({
    upload_url: `/upload/drive/v3/files/${fileId}`,
    method: "PATCH",
    query: { uploadType: "media" },
    headers: { "Content-Type": mimeType },
    body_b64: abToBase64(buf),
  });
  if (!res.ok) throw new Error(`Update failed: ${await res.text()}`);
}

export async function renameFile(fileId: string, newName: string): Promise<void> {
  const res = await callProxy({
    path: `/files/${fileId}`,
    method: "PATCH",
    body: { name: newName },
  });
  if (!res.ok) throw new Error("Rename failed");
}

export const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
} as const;

export function iconForMime(mime: string): string {
  if (mime.includes("wordprocessingml")) return "📝";
  if (mime.includes("spreadsheetml")) return "📊";
  if (mime.includes("presentationml")) return "🖼️";
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("folder")) return "📁";
  return "📎";
}

export function editorRouteForMime(mime: string, fileId: string): string {
  if (mime === MIME.docx) return `/dashboard/office/docs?file=${fileId}`;
  if (mime === MIME.xlsx) return `/dashboard/office/sheets?file=${fileId}`;
  if (mime === MIME.pptx) return `/dashboard/office/slides?file=${fileId}`;
  if (mime === MIME.pdf) return `/dashboard/office/pdf?file=${fileId}`;
  return `/dashboard/my-drive`;
}
