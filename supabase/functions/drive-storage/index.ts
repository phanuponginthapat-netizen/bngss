// Google Drive storage backend (ใช้แทน Supabase Storage เมื่อย้ายไป self-hosted)
// ใช้ Google OAuth refresh token ของบัญชีเดียว (service account ของโรงเรียน)
// Secrets ที่ต้องตั้ง:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN
//   GOOGLE_DRIVE_FOLDER_ID (โฟลเดอร์ปลายทาง, ไม่ตั้งก็ได้ = My Drive)
//
// POST { action: "upload", path, base64, contentType, public?: true }
// POST { action: "delete", fileId }
// POST { action: "list", path? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function accessToken(): Promise<string> {
  const client_id = Deno.env.get("GOOGLE_CLIENT_ID");
  const client_secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refresh_token = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN");
  if (!client_id || !client_secret || !refresh_token) {
    throw new Error("ยังไม่ได้ตั้ง GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error [${res.status}]: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // ต้องล็อกอินก่อนเสมอ
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json();
    const action = body.action ?? "upload";
    const token = await accessToken();
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") || undefined;

    if (action === "delete") {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${body.fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 404) return json({ error: await res.text() }, res.status);
      return json({ success: true });
    }

    if (action === "list") {
      const q = folderId ? `'${folderId}' in parents and trashed=false` : "trashed=false";
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=1000`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!res.ok) return json({ error: data }, res.status);
      return json(data);
    }

    // upload
    const { path, base64, contentType = "application/octet-stream" } = body;
    if (!path || !base64) return json({ error: "path และ base64 จำเป็น" }, 400);

    const name = String(path).split("/").pop() || `file-${Date.now()}`;
    const metadata = {
      name,
      description: String(path),
      ...(folderId ? { parents: [folderId] } : {}),
    };

    const boundary = `bng${crypto.randomUUID()}`;
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    );
    const tail = enc.encode(`\r\n--${boundary}--`);
    const fileBytes = b64ToBytes(base64);
    const payload = new Uint8Array(head.length + fileBytes.length + tail.length);
    payload.set(head, 0);
    payload.set(fileBytes, head.length);
    payload.set(tail, head.length + fileBytes.length);

    const upRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: payload,
      },
    );
    const file = await upRes.json();
    if (!upRes.ok) return json({ error: file }, upRes.status);

    // เปิดให้เข้าถึงแบบลิงก์สาธารณะ (สำหรับรูปที่ต้องแสดงในเว็บ)
    if (body.public !== false) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    }

    return json({
      success: true,
      fileId: file.id,
      path: String(path),
      publicUrl: `https://drive.google.com/uc?export=view&id=${file.id}`,
      webViewLink: file.webViewLink,
    });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
