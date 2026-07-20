// Stream a LINE Vault file's bytes to the browser after verifying the caller
// can SELECT the row (RLS). Used by <img>/<video>/<audio> where the browser
// cannot set Authorization headers on the resource itself.
//
// Client usage:
//   await fetch(`${SUPABASE_URL}/functions/v1/line-vault-stream?id=${itemId}`, {
//     headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON },
//   }).then(r => r.blob()).then(b => URL.createObjectURL(b));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-type, content-length",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

function driveAuthHeaders() {
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  const gdrive = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!lovable || !gdrive) throw new Error("Google Drive connector env missing");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": gdrive,
  };
}

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

    // ---- Google Drive path ----
    if (item.drive_file_id) {
      const driveRes = await fetch(
        `${GATEWAY}/drive/v3/files/${item.drive_file_id}?alt=media`,
        { headers: driveAuthHeaders() },
      );
      if (!driveRes.ok) {
        const text = await driveRes.text().catch(() => "");
        console.error("[line-vault-stream drive]", driveRes.status, text);
        return new Response("drive_fetch_failed", { status: 502, headers: corsHeaders });
      }
      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", item.mime_type || driveRes.headers.get("content-type") || "application/octet-stream");
      const len = driveRes.headers.get("content-length");
      if (len) headers.set("Content-Length", len);
      headers.set("Content-Disposition", disposition);
      headers.set("Cache-Control", "private, max-age=3600");
      return new Response(driveRes.body, { status: 200, headers });
    }

    // ---- Supabase Storage fallback ----
    if (!item.storage_path) {
      return new Response("no_file", { status: 404, headers: corsHeaders });
    }
    const admin = createClient(SUPABASE_URL, SERVICE);
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
