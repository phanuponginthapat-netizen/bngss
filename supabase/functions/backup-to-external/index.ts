// Second-layer backup: copies core tables into a *separate* Supabase project
// (EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_SERVICE_KEY) as daily snapshots
// in public.backup_snapshots. Admin-only, also callable by cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { getSecret } from "../_shared/getSecret.ts";
import { secretKeys } from "../_shared/secretKeys.ts";
import { corsHeadersWithCron } from "../_shared/cors.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";

const corsHeaders = corsHeadersWithCron;

const TABLES = [
  "students", "personnel", "profiles", "user_roles", "classrooms", "subjects",
  "schedules", "attendance", "student_scores", "behavior_records", "health_records",
  "documents", "eforms", "staff_leaves", "student_leaves", "school_settings",
  "cms_settings", "cms_pages", "academic_periods", "enrollments", "assets",
  "budget_transactions", "procurement_records", "time_clock", "notifications",
];

const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  try {
    const extUrl = (await getSecret(secretKeys.externalUrl)) || Deno.env.get("EXTERNAL_SUPABASE_URL");
    const extKey = (await getSecret(secretKeys.externalServiceKey)) || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");
    if (!extUrl || !extKey) {
      return json({ error: "ยังไม่ได้ตั้งค่า EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_SERVICE_KEY" }, 400);
    }

    const admin = makeAdmin();
    const ext = createClient(extUrl, extKey, { auth: { persistSession: false } });
    const snapshotDate = new Date().toISOString().slice(0, 10);

    const body = await req.json().catch(() => ({}));
    const tables: string[] = Array.isArray(body?.tables) && body.tables.length ? body.tables : TABLES;

    let ok = 0, failed = 0;
    const results: Record<string, any> = {};

    for (const table of tables) {
      try {
        const rows: any[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await admin.from(table).select("*").range(from, from + PAGE - 1);
          if (error) throw new Error(error.message);
          rows.push(...(data || []));
          if ((data || []).length < PAGE) break;
          if (rows.length >= 50000) break; // safety cap per table
        }

        const { error: upErr } = await ext.from("backup_snapshots").upsert({
          table_name: table,
          snapshot_date: snapshotDate,
          row_count: rows.length,
          data: rows,
        }, { onConflict: "table_name,snapshot_date" });
        if (upErr) throw new Error(upErr.message);

        ok++;
        results[table] = rows.length;
      } catch (e) {
        failed++;
        results[table] = `error: ${String(e).slice(0, 200)}`;
      }
    }

    const summary = { ok, failed, tables: results, at: new Date().toISOString() };
    await admin.from("school_settings").upsert(
      { setting_key: "last_external_backup", setting_value: JSON.stringify(summary), updated_at: new Date().toISOString() },
      { onConflict: "setting_key" },
    );

    return json(summary);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
