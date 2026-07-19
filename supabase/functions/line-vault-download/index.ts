import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Given an item_id, verify the caller can SELECT the row (RLS), then return a short-lived signed URL.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client scoped to the user (RLS enforced)
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { item_id, expires_in } = await req.json();
    if (!item_id) {
      return new Response(JSON.stringify({ error: "item_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Row read is gated by RLS — if not permitted returns null
    const { data: item, error } = await userClient
      .from("line_vault_items")
      .select("id, kind, storage_path, drive_file_id, drive_web_view_link, original_filename, mime_type, note_text, title")
      .eq("id", item_id)
      .maybeSingle();

    if (error) throw error;
    if (!item) {
      return new Response(JSON.stringify({ error: "ไม่มีสิทธิ์เข้าถึงหรือไม่พบไฟล์" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notes have no file
    if (item.kind === "note") {
      return new Response(JSON.stringify({
        kind: item.kind, title: item.title, note_text: item.note_text,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Prefer Google Drive
    if (item.drive_file_id) {
      const { getDownloadInfo } = await import("../_shared/googleDrive.ts");
      const info = await getDownloadInfo(item.drive_file_id);
      const url = info?.webContentLink || info?.webViewLink || item.drive_web_view_link;
      if (!url) throw new Error("ไม่พบลิงก์ใน Google Drive");
      return new Response(JSON.stringify({
        url,
        provider: "google_drive",
        filename: item.original_filename,
        mime_type: item.mime_type,
        kind: item.kind,
        title: item.title,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fallback: legacy Supabase storage
    if (!item.storage_path) {
      return new Response(JSON.stringify({ error: "ไม่มีไฟล์แนบ" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE);
    const expiry = Math.min(Math.max(Number(expires_in) || 600, 60), 3600);
    const { data: signed, error: signErr } = await admin.storage
      .from("line-vault")
      .createSignedUrl(item.storage_path, expiry, { download: item.original_filename || undefined });

    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message || "ไม่สามารถสร้างลิงก์ดาวน์โหลดได้");
    }

    return new Response(JSON.stringify({
      url: signed.signedUrl,
      expires_in: expiry,
      provider: "storage",
      filename: item.original_filename,
      mime_type: item.mime_type,
      kind: item.kind,
      title: item.title,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("[line-vault-download]", e);
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
