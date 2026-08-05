// Google Drive helper (งานระบบ)
// โหมดหลัก: เรียก googleapis.com โดยตรงด้วย Service Account / Refresh Token (Standalone)
// โหมดสำรอง: Lovable connector gateway — ใช้ได้ต่อเมื่อ ALLOW_LOVABLE_FALLBACK=true เท่านั้น
import { getSystemDriveToken } from "./googleOauth.ts";
import { lovableFallbackEnabled, NO_LOVABLE_DRIVE_MSG } from "./standalone.ts";

const GOOGLE_API = "https://www.googleapis.com";
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

type Mode = { base: string; headers: Record<string, string> };

async function resolveMode(): Promise<Mode> {
  const token = await getSystemDriveToken();
  if (token) {
    return { base: GOOGLE_API, headers: { Authorization: `Bearer ${token}` } };
  }
  if (lovableFallbackEnabled()) {
    const lovable = Deno.env.get("LOVABLE_API_KEY");
    const gdrive = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (lovable && gdrive) {
      return {
        base: GATEWAY,
        headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": gdrive },
      };
    }
  }
  throw new Error(NO_LOVABLE_DRIVE_MSG);
}

async function driveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const mode = await resolveMode();
  const headers = { ...(init.headers as Record<string, string> | undefined), ...mode.headers };
  return await fetch(`${mode.base}${path}`, { ...init, headers });
}

export interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  mimeType?: string;
}

/** Find or create a subfolder named `name` under `parentId` (or root if null). */
export async function ensureFolder(name: string, parentId: string | null): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const parentClause = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
  const q = `mimeType='application/vnd.google-apps.folder' and name='${safeName}'${parentClause} and trashed=false`;
  const listRes = await driveFetch(
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  if (!listRes.ok) throw new Error(`Drive list folder failed [${listRes.status}]: ${await listRes.text()}`);
  const listData = await listRes.json();
  if (listData.files?.[0]?.id) return listData.files[0].id;

  const createRes = await driveFetch(`/drive/v3/files?fields=id&supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!createRes.ok) throw new Error(`Drive create folder failed [${createRes.status}]: ${await createRes.text()}`);
  const created = await createRes.json();
  return created.id;
}

/** Upload bytes to Drive using multipart upload. Returns file id + webViewLink. */
export async function uploadFile(
  name: string,
  mime: string,
  data: Uint8Array,
  parentId: string | null,
): Promise<DriveFile> {
  const metadata = {
    name,
    mimeType: mime,
    parents: parentId ? [parentId] : undefined,
  };

  const boundary = `lvault_${crypto.randomUUID()}`;
  const enc = new TextEncoder();
  const pre = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const post = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(pre.length + data.length + post.length);
  body.set(pre, 0);
  body.set(data, pre.length);
  body.set(post, pre.length + data.length);

  const res = await driveFetch(
    `/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,mimeType`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed [${res.status}]: ${await res.text()}`);
  return await res.json() as DriveFile;
}

/** Get a temporary download URL for a Drive file (returns webContentLink). */
export async function getDownloadInfo(fileId: string): Promise<{ webViewLink: string; webContentLink?: string; name: string; mimeType: string } | null> {
  const res = await driveFetch(
    `/drive/v3/files/${fileId}?fields=id,name,webViewLink,webContentLink,mimeType&supportsAllDrives=true`,
  );
  if (!res.ok) return null;
  return await res.json();
}

/** Download raw file bytes. */
export async function downloadFile(fileId: string): Promise<Response> {
  return await driveFetch(`/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`);
}

/** Delete a Drive file (trash). */
export async function deleteFile(fileId: string): Promise<void> {
  await driveFetch(`/drive/v3/files/${fileId}?supportsAllDrives=true`, { method: "DELETE" });
}

/** Ensure folder path like ["LineVault", "2569", "T1", "group-abc"]. Returns leaf folder id. */
export async function ensureFolderPath(segments: string[]): Promise<string> {
  let parent: string | null = null;
  for (const seg of segments) {
    if (!seg) continue;
    parent = await ensureFolder(seg, parent);
  }
  if (!parent) throw new Error("ensureFolderPath: empty path");
  return parent;
}

export { driveFetch };
