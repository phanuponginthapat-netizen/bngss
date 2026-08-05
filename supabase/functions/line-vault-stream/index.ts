// Stream a LINE Vault file's bytes to the browser after verifying the caller
// can SELECT the row (RLS). Used by <img>/<video>/<audio> where the browser
// cannot set Authorization headers on the resource itself.
//
// Client usage:
//   await fetch(`${SUPABASE_URL}/functions/v1/line-vault-stream?id=${itemId}`, {
//     headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON },
//   }).then(r => r.blob()).then(b => URL.createObjectURL(b));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadFile } from "../_shared/googleDrive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-type, content-length",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response("unauthorized", { status: 401, headers: corsHeaders });
    }
    const url = new URL(req.url);
    const itemId = url.searchParams.get("id") || url.searchParams.get("item_id");
    if (!itemId) return new Response("id required", { status: 400, headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    // Enforce RLS by reading via the user's client
    const { data: item, error } = await userClient
      .from("line_vault_items")
      .select("id, storage_path, drive_file_id, original_filename, mime_type, kind")
      .eq("id", itemId)
      .maybeSingle();
    if (error) throw error;
    if (!item) return new Response("forbidden", { status: 403, headers: corsHeaders });

    const filename = item.original_filename || `${item.id}.bin`;
    const disposition = url.searchParams.get("download")
      ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;

    const admin = createClient(SUPABASE_URL, SERVICE);

    // ---- Google Drive path ----
    if (item.drive_file_id) {
      let driveRes: Response | null = null;
      try {
        driveRes = await downloadFile(item.drive_file_id);
      } catch (driveErr) {
        console.error("[line-vault-stream drive unavailable]", (driveErr as any)?.message || driveErr);
      }
      if (driveRes?.ok) {
        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", item.mime_type || driveRes.headers.get("content-type") || "application/octet-stream");
        const len = driveRes.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        headers.set("Content-Disposition", disposition);
        headers.set("Cache-Control", "private, max-age=3600");
        return new Response(driveRes.body, { status: 200, headers });
      }
      if (driveRes) {
        const text = await driveRes.text().catch(() => "");
        console.error("[line-vault-stream drive]", driveRes.status, text);
      }
      // ตกลงมาใช้ไฟล์สำเนาใน Supabase Storage ถ้ามี
      if (!item.storage_path) {
        return new Response("drive_unavailable", { status: 502, headers: corsHeaders });
      }
    }

    // ---- Supabase Storage ----
    if (!item.storage_path) {
      return new Response("no_file", { status: 404, headers: corsHeaders });
    }
    const { data: blob, error: dlErr } = await admin.storage
      .from("line-vault")
      .download(item.storage_path);
    if (dlErr || !blob) {
      console.error("[line-vault-stream storage]", dlErr);
      return new Response("storage_fetch_failed", { status: 502, headers: corsHeaders });
    }
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", item.mime_type || blob.type || "application/octet-stream");
    headers.set("Content-Disposition", disposition);
    headers.set("Cache-Control", "private, max-age=3600");
    return new Response(blob.stream(), { status: 200, headers });

  } catch (e: any) {
    console.error("[line-vault-stream]", e);
    return new Response(e?.message || "internal error", { status: 500, headers: corsHeaders });
  }
});
