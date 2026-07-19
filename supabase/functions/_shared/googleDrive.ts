// Google Drive gateway helper — routes calls through Lovable connector gateway.
// Env required: LOVABLE_API_KEY, GOOGLE_DRIVE_API_KEY

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

function authHeaders() {
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  const gdrive = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lovable || !gdrive) throw new Error("Google Drive connector env missing");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": gdrive,
  };
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
  const listRes = await fetch(
    `${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers: authHeaders() },
  );
  if (!listRes.ok) throw new Error(`Drive list folder failed [${listRes.status}]: ${await listRes.text()}`);
  const listData = await listRes.json();
  if (listData.files?.[0]?.id) return listData.files[0].id;

  const createRes = await fetch(`${GATEWAY}/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
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

  const res = await fetch(
    `${GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed [${res.status}]: ${await res.text()}`);
  return await res.json() as DriveFile;
}

/** Get a temporary download URL for a Drive file (returns webContentLink). */
export async function getDownloadInfo(fileId: string): Promise<{ webViewLink: string; webContentLink?: string; name: string; mimeType: string } | null> {
  const res = await fetch(
    `${GATEWAY}/drive/v3/files/${fileId}?fields=id,name,webViewLink,webContentLink,mimeType`,
    { headers: authHeaders() },
  );
  if (!res.ok) return null;
  return await res.json();
}

/** Delete a Drive file (trash). */
export async function deleteFile(fileId: string): Promise<void> {
  await fetch(`${GATEWAY}/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
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
