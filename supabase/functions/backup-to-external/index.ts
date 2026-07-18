// Backup tables from Lovable Cloud (local Supabase) to an external Supabase project
// for disaster recovery. Stores each table as one row in `backup_snapshots(table_name, snapshot_date, row_count, data jsonb)`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret } from "../_shared/getSecret.ts";
import { secretKeys } from "../_shared/secretKeys.ts";

import { corsHeadersPost as corsHeaders } from "../_shared/cors.ts";

// Tables to back up (must exist in public schema). Keep ordered by importance.
const DEFAULT_TABLES = [
  "profiles", "user_roles", "personnel", "students", "alumni",
  "classrooms", "subjects", "schedules", "enrollments",
  "attendance", "behavior_records", "homeroom_records", "student_leaves",
  "scores", "evaluations", "pa_agreements",
  "documents", "document_recipients",
  "eforms", "eform_recipients", "eform_attachments",
  "news_posts", "emergency_broadcasts",
  "assets", "asset_damage_reports",
  "budget_transactions",
  "school_settings", "academic_periods",
];

const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const localUrl = Deno.env.get("SUPABASE_URL")!;
    const localKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const extUrl = await getSecret(secretKeys.externalUrl);
    const extKey = await getSecret(secretKeys.externalServiceKey);

    if (!extUrl || !extKey) {
      return json({ error: "ยังไม่ได้ตั้งค่าปลายทางสำรองข้อมูลภายนอก" }, 400);
    }

    // Auth check: only admin/director can trigger manually. Cron sends x-cron-secret.
    const cronSecret = await getSecret(secretKeys.cron);
    const isCron = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
    const local = createClient(localUrl, localKey);

    if (!isCron) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const userClient = createClient(localUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: roles } = await local.from("user_roles").select("role").eq("user_id", user.id);
      const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "director");
      if (!ok) return json({ error: "Forbidden: admin/director only" }, 403);
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const tables: string[] = Array.isArray(body.tables) && body.tables.length > 0 ? body.tables : DEFAULT_TABLES;
    const snapshotDate = (body.date as string) || new Date().toISOString().slice(0, 10);

    const ext = createClient(extUrl, extKey);

    // Ensure target table exists (best-effort; user is told to create it manually too)
    const results: any[] = [];
    let okCount = 0, failCount = 0;

    for (const t of tables) {
      try {
        const rows: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await local.from(t).select("*").range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          rows.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }

        const { error: upErr } = await ext.from("backup_snapshots").upsert({
          table_name: t,
          snapshot_date: snapshotDate,
          row_count: rows.length,
          data: rows,
        }, { onConflict: "table_name,snapshot_date" });

        if (upErr) throw upErr;
        okCount++;
        results.push({ table: t, rows: rows.length, ok: true });
      } catch (e: any) {
        failCount++;
        results.push({ table: t, ok: false, error: String(e?.message ?? e) });
      }
    }

    // Log into local school_settings for visibility
    await local.from("school_settings").upsert({
      setting_key: "last_external_backup",
      setting_value: JSON.stringify({
        ran_at: new Date().toISOString(),
        snapshot_date: snapshotDate,
        ok: okCount, failed: failCount,
        results,
      }),
    }, { onConflict: "setting_key" });

    return json({ success: true, snapshot_date: snapshotDate, ok: okCount, failed: failCount, results });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
