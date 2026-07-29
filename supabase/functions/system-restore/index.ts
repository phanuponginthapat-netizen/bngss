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
  const applySchema = url.searchParams.get("schema") !== "0";   // default ON
  const restoreUsers = url.searchParams.get("users") !== "0";   // default ON

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
  const storageResults: any[] = [];
  let totalInserted = 0;
  let totalFilesUploaded = 0;

  const entries = Object.keys(zip.files).filter(
    (n) => n.startsWith("tables/") && n.endsWith(".json") && !zip.files[n].dir,
  );
  const storageEntries = Object.keys(zip.files).filter(
    (n) => n.startsWith("storage/") && !zip.files[n].dir,
  );

  const hasSchema = !!zip.files["schema.sql"];
  const hasBuckets = !!zip.files["buckets.json"];
  const hasAuth = !!zip.files["auth-users.json"];

  if (entries.length === 0 && storageEntries.length === 0 && !hasSchema && !hasBuckets && !hasAuth) {
    return json({ error: "no tables/*.json, storage/*, schema.sql, buckets.json or auth-users.json in zip" }, 400);
  }

  const steps: any[] = [];

  // ---------- STEP 1: schema (tables, FK, indexes, functions, triggers, grants, RLS, policies)
  if (hasSchema && applySchema && !dryRun) {
    try {
      const sql = await zip.files["schema.sql"].async("string");
      const { error } = await admin.rpc("exec_restore_sql", { _sql: sql });
      if (error) throw error;
      steps.push({ step: "schema.sql", ok: true, bytes: sql.length });
    } catch (e: any) {
      errors.push({ step: "schema.sql", error: e.message });
      steps.push({ step: "schema.sql", ok: false, error: e.message });
    }
  } else if (hasSchema) {
    steps.push({ step: "schema.sql", skipped: true, dry: dryRun });
  }

  // ---------- STEP 1b: extras (extensions, sequences, views, cron)
  if (zip.files["extras.sql"] && applySchema && !dryRun) {
    try {
      const sql = await zip.files["extras.sql"].async("string");
      const { error } = await admin.rpc("exec_restore_sql", { _sql: sql });
      if (error) throw error;
      steps.push({ step: "extras.sql", ok: true });
    } catch (e: any) {
      errors.push({ step: "extras.sql", error: e.message });
      steps.push({ step: "extras.sql", ok: false, error: e.message });
    }
  }

  // ---------- STEP 2: buckets (create with same public/limit/mime config)
  if (hasBuckets) {
    try {
      const defs = JSON.parse(await zip.files["buckets.json"].async("string"));
      let made = 0;
      for (const b of defs || []) {
        if (dryRun) { made++; continue; }
        const { data: existing } = await admin.storage.getBucket(b.name);
        const opts: any = {
          public: !!b.public,
          fileSizeLimit: b.file_size_limit ?? undefined,
          allowedMimeTypes: b.allowed_mime_types ?? undefined,
        };
        if (!existing) await admin.storage.createBucket(b.name, opts);
        else await admin.storage.updateBucket(b.name, opts);
        made++;
      }
      steps.push({ step: "buckets", ok: true, count: made, dry: dryRun });
    } catch (e: any) {
      errors.push({ step: "buckets", error: e.message });
    }
  }

  // ---------- STEP 2b: storage RLS policies
  if (zip.files["storage-policies.sql"] && applySchema && !dryRun) {
    try {
      const sql = await zip.files["storage-policies.sql"].async("string");
      const { error } = await admin.rpc("exec_restore_sql", { _sql: sql });
      if (error) throw error;
      steps.push({ step: "storage-policies.sql", ok: true });
    } catch (e: any) {
      errors.push({ step: "storage-policies.sql", error: e.message });
    }
  }

  // ---------- STEP 3: auth users (password hashes preserved → same logins keep working)
  if (hasAuth && restoreUsers) {
    try {
      const payload = JSON.parse(await zip.files["auth-users.json"].async("string"));
      if (dryRun) {
        steps.push({ step: "auth-users", dry: true, users: payload?.users?.length ?? 0 });
      } else {
        const { data, error } = await admin.rpc("import_auth_users", { _payload: payload });
        if (error) throw error;
        steps.push({ step: "auth-users", ok: true, ...(data as any) });
      }
    } catch (e: any) {
      errors.push({ step: "auth-users", error: e.message });
    }
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
        const { error: delErr } = await admin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (delErr) errors.push({ table, warn: `truncate: ${delErr.message}` });
      }

      let inserted = 0;
      for (let i = 0; i < rows.length; i += PAGE) {
        const chunk = rows.slice(i, i + PAGE);
        const { error } = await admin.from(table).upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
        if (error) {
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

  // Restore storage: storage/<bucket>/<path...>
  const bucketCounts: Record<string, number> = {};
  const bucketsSeen = new Set<string>();
  for (const entry of storageEntries) {
    const rest = entry.replace(/^storage\//, "");
    const slash = rest.indexOf("/");
    if (slash < 0) continue;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    if (!bucket || !path) continue;
    if (dryRun) {
      bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
      continue;
    }
    try {
      if (!bucketsSeen.has(bucket)) {
        bucketsSeen.add(bucket);
        const { data: existing } = await admin.storage.getBucket(bucket);
        if (!existing) {
          await admin.storage.createBucket(bucket, { public: false });
        }
      }
      const bytes = await zip.files[entry].async("uint8array");
      const { error: upErr } = await admin.storage.from(bucket).upload(path, bytes, {
        upsert: true,
        contentType: "application/octet-stream",
      });
      if (upErr) {
        errors.push({ bucket, path, error: upErr.message });
        continue;
      }
      bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
      totalFilesUploaded++;
    } catch (e: any) {
      errors.push({ bucket, path, error: e.message });
    }
  }
  for (const [bucket, count] of Object.entries(bucketCounts)) {
    storageResults.push({ bucket, files: count, ok: true, dry: dryRun });
  }

  return json({
    success: errors.length === 0,
    steps,
    tables_processed: results.length,
    rows_inserted: totalInserted,
    storage_files_uploaded: totalFilesUploaded,
    storage_results: storageResults,
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
