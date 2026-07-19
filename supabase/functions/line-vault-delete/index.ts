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

    const { item_id } = await req.json();
    if (!item_id) throw new Error("item_id required");

    const { data: item } = await admin
      .from("line_vault_items")
      .select("id, storage_path, drive_file_id")
      .eq("id", item_id)
      .maybeSingle();
    if (!item) throw new Error("not found");

    if (item.drive_file_id) {
      try { await deleteFile(item.drive_file_id); } catch (e) { console.error("[drive delete]", e); }
    }
    if (item.storage_path) {
      try { await admin.storage.from("line-vault").remove([item.storage_path]); } catch (e) { console.error("[bucket delete]", e); }
    }

    const { error } = await admin.from("line_vault_items").delete().eq("id", item_id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[line-vault-delete]", e);
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
