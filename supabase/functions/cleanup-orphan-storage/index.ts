// Cleanup orphaned storage files
// - For each bucket, list objects
// - Check if object name/URL is referenced in any known table column
// - If unreferenced AND older than minAgeDays → delete (or report in dry-run)
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Bucket → list of (table, column) where its URL/path may be referenced.
// Conservative: only buckets we know. Unknown buckets are skipped.
const REFERENCE_MAP: Record<string, Array<{ table: string; column: string }>> = {
  "profile-images": [{ table: "profiles", column: "avatar_url" }],
  "asset-photos": [
    { table: "assets", column: "photo_url" },
    { table: "asset_damage_reports", column: "photo_url" },
  ],
  "pp5-files": [{ table: "pp5_files", column: "file_path" }],
  "pp6-files": [{ table: "pp6_files", column: "file_path" }],
  "eform-attachments": [{ table: "eform_attachments", column: "file_path" }],
  "document-files": [
    { table: "documents", column: "file_path" },
    { table: "document_recipients", column: "reply_file_path" },
  ],
  "home-visit-photos": [{ table: "home_visits", column: "photo_url" }],
  "face-photos": [
    { table: "students", column: "face_photo_url" },
    { table: "face_scan_logs", column: "photo_url" },
  ],
  "pa-files": [{ table: "pa_agreements", column: "file_path" }],
  "garbage-images": [
    { table: "garbage_deposits", column: "photo_url" },
    { table: "garbage_rewards", column: "image_url" },
  ],
  "ict-loan-photos": [{ table: "ict_loans", column: "photo_url" }],
  "attendance-photos": [{ table: "attendance", column: "photo_url" }],
  // cms-images skipped: referenced inside rich-text HTML, hard to detect safely
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // AuthZ: admin/director only
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const allowed = (roles ?? []).some((r: any) => ["admin", "director"].includes(r.role));
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun: boolean = body.dryRun !== false; // default true
    const minAgeDays: number = Number(body.minAgeDays ?? 7);
    const onlyBucket: string | undefined = body.bucket;

    const cutoff = Date.now() - minAgeDays * 86400_000;
    const buckets = onlyBucket ? [onlyBucket] : Object.keys(REFERENCE_MAP);

    const report: any[] = [];

    for (const bucket of buckets) {
      const refs = REFERENCE_MAP[bucket];
      if (!refs) {
        report.push({ bucket, skipped: "unknown bucket" });
        continue;
      }

      // Load all referenced values for this bucket (one pass per column)
      const referenced = new Set<string>();
      for (const { table, column } of refs) {
        const { data, error } = await admin.from(table).select(column).not(column, "is", null);
        if (error) continue;
        for (const row of data ?? []) {
          const v = (row as any)[column];
          if (typeof v === "string" && v.length > 0) referenced.add(v);
        }
      }

      // List all objects in bucket (paginated)
      const objects: Array<{ name: string; created_at: string; size: number }> = [];
      let offset = 0;
      while (true) {
        const { data, error } = await admin.storage.from(bucket).list("", {
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error || !data || data.length === 0) break;
        for (const o of data) {
          if (o.name && !o.name.endsWith("/")) {
            objects.push({
              name: o.name,
              created_at: (o as any).created_at ?? new Date().toISOString(),
              size: (o.metadata as any)?.size ?? 0,
            });
          }
        }
        if (data.length < 1000) break;
        offset += 1000;
      }

      const orphans: typeof objects = [];
      for (const obj of objects) {
        const isReferenced = [...referenced].some(
          (ref) => ref === obj.name || ref.includes(obj.name),
        );
        const age = Date.parse(obj.created_at);
        if (!isReferenced && (isNaN(age) || age < cutoff)) {
          orphans.push(obj);
        }
      }

      let deleted = 0;
      if (!dryRun && orphans.length > 0) {
        // Delete in chunks of 100
        for (let i = 0; i < orphans.length; i += 100) {
          const chunk = orphans.slice(i, i + 100).map((o) => o.name);
          const { error } = await admin.storage.from(bucket).remove(chunk);
          if (!error) deleted += chunk.length;
        }
      }

      report.push({
        bucket,
        total_files: objects.length,
        referenced_count: referenced.size,
        orphan_count: orphans.length,
        orphan_size_bytes: orphans.reduce((s, o) => s + (o.size ?? 0), 0),
        deleted,
        sample: orphans.slice(0, 10).map((o) => o.name),
      });
    }

    return json({
      success: true,
      dry_run: dryRun,
      min_age_days: minAgeDays,
      ran_at: new Date().toISOString(),
      report,
    });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
