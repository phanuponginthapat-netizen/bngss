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
import { getSecret } from "../_shared/getSecret.ts";
import { recoverLineVaultFile } from "../_shared/lineVaultRecovery.ts";

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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    // Enforce RLS by reading via the user's client
    const { data: item, error } = await userClient
      .from("line_vault_items")
      .select("id, storage_path, drive_file_id, original_filename, mime_type, kind, source, line_message_id, line_group_id, created_at, title")
      .eq("id", itemId)
      .maybeSingle();
    if (error) throw error;
    if (!item) return new Response("forbidden", { status: 403, headers: corsHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE);
    if (!item.storage_path && !item.drive_file_id && item.source === "line" && item.kind !== "note") {
      const recovered = await recoverLineVaultFile(admin, item, async (messageId) => {
        const token = Deno.env.get("LINE_VAULT_CHANNEL_ACCESS_TOKEN")?.trim() || await getSecret("LINE_VAULT_CHANNEL_ACCESS_TOKEN");
        if (!token) throw new Error("LINE Vault recovery is not configured");
        const response = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
          headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000),
        });
        if (response.status === 404 || response.status === 410) return null;
        if (!response.ok) throw new Error(`LINE recovery unavailable [${response.status}]`);
        return { data: new Uint8Array(await response.arrayBuffer()), mime: response.headers.get("content-type") || "application/octet-stream" };
      });
      if (!recovered) return new Response("source_expired", { status: 410, headers: corsHeaders });
      Object.assign(item, recovered);
    }

    const filename = item.original_filename || `${item.id}.bin`;
    const disposition = url.searchParams.get("download")
      ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;

    // ---- Google Drive fallback for legacy Drive-only rows ----
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
      if (!item.storage_path) return new Response("drive_unavailable", { status: 502, headers: corsHeaders });
    }

    // Cloud is a fallback only; verified Drive files are read without re-uploading.
    if (item.storage_path) {
      const { data: blob, error: dlErr } = await admin.storage
        .from("line-vault")
        .download(item.storage_path);
      if (!dlErr && blob) {
        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", item.mime_type || blob.type || "application/octet-stream");
        headers.set("Content-Disposition", disposition);
        headers.set("Cache-Control", "private, max-age=3600");
        return new Response(blob.stream(), { status: 200, headers });
      }
      console.error("[line-vault-stream storage]", dlErr);
    }

    return new Response("no_file", { status: 404, headers: corsHeaders });

  } catch (e: any) {
    console.error("[line-vault-stream]", e);
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      return new Response("line_source_timeout", { status: 504, headers: corsHeaders });
    }
    return new Response(e?.message || "internal error", { status: 500, headers: corsHeaders });
  }
});
