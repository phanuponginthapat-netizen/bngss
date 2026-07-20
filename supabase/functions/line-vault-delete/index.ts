import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { deleteFile } from "../_shared/googleDrive.ts";

// Admin-only: delete a vault item and its underlying storage (Drive + bucket).
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

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) throw new Error("unauthorized");

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "director");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin_required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const ids: string[] = Array.isArray(body?.item_ids)
      ? body.item_ids.filter((x: any) => typeof x === "string")
      : body?.item_id ? [String(body.item_id)] : [];
    if (!ids.length) throw new Error("item_id or item_ids required");

    const { data: rows } = await admin
      .from("line_vault_items")
      .select("id, storage_path, drive_file_id")
      .in("id", ids);
    if (!rows || !rows.length) throw new Error("not found");

    for (const item of rows) {
      if (item.drive_file_id) {
        try { await deleteFile(item.drive_file_id); } catch (e) { console.error("[drive delete]", e); }
      }
      if (item.storage_path) {
        try { await admin.storage.from("line-vault").remove([item.storage_path]); } catch (e) { console.error("[bucket delete]", e); }
      }
    }

    const { error } = await admin.from("line_vault_items").delete().in("id", rows.map(r => r.id));
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, deleted: rows.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[line-vault-delete]", e);
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
