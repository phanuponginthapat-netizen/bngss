// Mirror legacy Drive-only LINE Vault items into the `line-vault` storage bucket
// so previews keep working even when Google Drive OAuth is unavailable.
// Admin/director only. Idempotent — safe to run repeatedly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { downloadFile } from "../_shared/googleDrive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extFromMime(mime: string | null, filename: string | null) {
  const fromName = filename?.includes(".") ? filename.split(".").pop() : null;
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.includes("jpeg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("gif")) return "gif";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("m4a") || m.includes("aac")) return "m4a";
  return "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "director"])
      .limit(1)
      .maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const limit = Math.min(Math.max(Number(body?.limit) || 25, 1), 100);
    const dryRun = body?.dryRun === true;

    const { count: pending } = await admin
      .from("line_vault_items")
      .select("id", { count: "exact", head: true })
      .is("storage_path", null)
      .not("drive_file_id", "is", null);

    if (dryRun) return json({ ok: true, pending: pending ?? 0, dryRun: true });

    const { data: rows, error: rowsErr } = await admin
      .from("line_vault_items")
      .select("id, drive_file_id, mime_type, original_filename, created_at")
      .is("storage_path", null)
      .not("drive_file_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (rowsErr) throw rowsErr;

    let migrated = 0;
    const failures: { id: string; error: string }[] = [];

    for (const row of rows ?? []) {
      try {
        const res = await downloadFile(row.drive_file_id as string);
        if (!res.ok) throw new Error(`drive ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const d = new Date(row.created_at as string);
        const ext = extFromMime(row.mime_type as string | null, row.original_filename as string | null);
        const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/backfill/${row.id}.${ext}`;

        const { error: upErr } = await admin.storage.from("line-vault").upload(path, bytes, {
          contentType: (row.mime_type as string) || res.headers.get("content-type") || "application/octet-stream",
          upsert: true,
        });
        if (upErr) throw upErr;

        const { error: updErr } = await admin
          .from("line_vault_items")
          .update({ storage_path: path })
          .eq("id", row.id);
        if (updErr) throw updErr;

        migrated++;
      } catch (e) {
        const message = (e as Error)?.message || String(e);
        console.error("[vault backfill]", row.id, message);
        failures.push({ id: row.id as string, error: message });
      }
    }

    const remaining = Math.max((pending ?? 0) - migrated, 0);
    return json({ ok: true, scanned: rows?.length ?? 0, migrated, remaining, failures });
  } catch (e) {
    console.error("line-vault-backfill-storage failed", e);
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
