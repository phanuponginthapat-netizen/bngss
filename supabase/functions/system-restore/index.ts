// One-file system restore.
// Accepts a ZIP produced by system-backup?mode=tables (or ?mode=full) — the file
// browser upload from the Backup & Migration Center — and re-inserts every
// tables/*.json into the current database via upsert (id conflict).
//
// POST multipart/form-data with field "file" = the .zip
// Optional query: ?truncate=1 to TRUNCATE each table before insert (destructive).
//
// Admin/director only. Uses service role after auth check.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { corsHeadersPost as corsHeaders } from "../_shared/cors.ts";

const PAGE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  // Authz: admin/director only
  const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
  const ok = (roles || []).some((r: any) => r.role === "admin" || r.role === "director");
  if (!ok) return json({ error: "forbidden — admin/director only" }, 403);

  const url = new URL(req.url);
  const truncate = url.searchParams.get("truncate") === "1";
  const dryRun = url.searchParams.get("dry") === "1";

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch (e: any) {
    return json({ error: `bad form: ${e.message}` }, 400);
  }
  if (!file) return json({ error: "missing 'file' field" }, 400);

  const admin = createClient(supaUrl, srv);
  const buf = new Uint8Array(await file.arrayBuffer());

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (e: any) {
    return json({ error: `invalid zip: ${e.message}` }, 400);
  }

  const results: any[] = [];
  const errors: any[] = [];
  let totalInserted = 0;

  // Find all tables/*.json entries
  const entries = Object.keys(zip.files).filter(
    (n) => n.startsWith("tables/") && n.endsWith(".json") && !zip.files[n].dir,
  );

  if (entries.length === 0) {
    return json({ error: "no tables/*.json entries found in zip" }, 400);
  }

  for (const entry of entries) {
    const table = entry.replace(/^tables\//, "").replace(/\.json$/, "");
    try {
      const txt = await zip.files[entry].async("string");
      const rows = JSON.parse(txt);
      if (!Array.isArray(rows)) {
        errors.push({ table, error: "not an array" });
        continue;
      }
      if (dryRun) {
        results.push({ table, rows: rows.length, dry: true });
        continue;
      }
      if (rows.length === 0) {
        results.push({ table, rows: 0, ok: true });
        continue;
      }

      if (truncate) {
        // Best-effort truncate via RPC; fallback to delete-all
        const { error: delErr } = await admin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (delErr) errors.push({ table, warn: `truncate: ${delErr.message}` });
      }

      let inserted = 0;
      for (let i = 0; i < rows.length; i += PAGE) {
        const chunk = rows.slice(i, i + PAGE);
        const { error } = await admin.from(table).upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
        if (error) {
          // fallback: try insert without conflict spec (tables w/o id)
          const { error: insErr } = await admin.from(table).insert(chunk);
          if (insErr) {
            errors.push({ table, chunk: i / PAGE, error: insErr.message });
            continue;
          }
        }
        inserted += chunk.length;
      }
      totalInserted += inserted;
      results.push({ table, rows: rows.length, inserted, ok: true });
    } catch (e: any) {
      errors.push({ table, error: e.message });
    }
  }

  return json({
    success: errors.length === 0,
    tables_processed: results.length,
    rows_inserted: totalInserted,
    errors,
    results,
    truncate,
    dry_run: dryRun,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
