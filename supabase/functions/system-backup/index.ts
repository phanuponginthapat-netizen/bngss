// Backup: tables (fast), a single storage bucket, or FULL (tables + storage manifest + restore kit).
// Splitting avoids the 150s edge-function timeout when storage is large.
// POST /system-backup?mode=tables                  -> zip of all tables as JSON
// POST /system-backup?mode=storage&bucket=NAME     -> zip of one bucket's files
// POST /system-backup?mode=buckets                 -> { buckets: [{name}] }
// POST /system-backup?mode=full                    -> tables + storage-manifest.json + RESTORE.md + restore.sh
//
// The mode=full bundle is what the "Backup & Migration Center" UI downloads.
// To restore: create a fresh Supabase project, `supabase db push` migrations
// from the code repo, then upload the same ZIP to /system-restore.

const RESTORE_MD = `# กู้คืนระบบจากไฟล์สำรอง (Restore Guide)

## กู้คืนแบบเร็ว (2 ขั้น)

1. **สร้าง Supabase project ใหม่** (Cloud หรือ self-host) แล้ว push schema:
   \`\`\`bash
   export PROJECT_REF=<ref>
   export DB_PASSWORD=<password>
   export SUPABASE_URL=https://<ref>.supabase.co
   export SERVICE_ROLE_KEY=<service_role>
   bash scripts/deploy-external-supabase.sh
   \`\`\`
   สคริปต์นี้จะ:
   - รัน migrations ทั้งหมดใน \`supabase/migrations/\` (สร้าง schema, FK, RLS ครบ)
   - สร้าง storage buckets ทั้ง 22 ตัว
   - Deploy edge functions ทั้ง 80+ ตัว

2. **อัพโหลด ZIP นี้เข้า Backup Center** (\`/dashboard/admin/backup-center\`) → กด "กู้คืนจากไฟล์"
   หรือใช้ curl:
   \`\`\`bash
   curl -X POST "$SUPABASE_URL/functions/v1/system-restore" \\
     -H "Authorization: Bearer $ADMIN_JWT" \\
     -F "file=@smart-school-full-XXX.zip"
   \`\`\`

## Storage files
ไฟล์ใน bucket (รูป, PDF ฯลฯ) ต้องดาวน์โหลดแยกด้วย \`?mode=storage&bucket=NAME\` ต่อ bucket
เพราะขนาดใหญ่เกิน 150s timeout. รายการ bucket + จำนวนไฟล์อยู่ใน \`storage-manifest.json\`
`;

const RESTORE_SH = `#!/usr/bin/env bash
# One-shot restore. Requires: SUPABASE_URL, ADMIN_JWT, ZIP_FILE
set -euo pipefail
: "\${SUPABASE_URL:?}"; : "\${ADMIN_JWT:?}"; : "\${ZIP_FILE:?}"
curl -X POST "$SUPABASE_URL/functions/v1/system-restore" \\
  -H "Authorization: Bearer $ADMIN_JWT" \\
  -F "file=@$ZIP_FILE"
`;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

import { corsHeadersPost as corsHeaders } from "../_shared/cors.ts";

// Full list of public tables — auto-generated to include ALL app data
// (secrets, api keys, providers, logs, configs, everything).
const TABLES = [
  "academic_events","academic_periods","account_balances","action_plans","activities",
  "activity_matches","activity_participants","activity_posts","activity_scores",
  "admin_permission_grants","admissions","ai_chat_logs","ai_provider_keys","ai_providers",
  "ai_usage_logs","ai_user_memory","alumni_university","app_secrets","app_user_connections",
  "archive_logs","assessment_criteria","asset_damage_reports","assets","attendance",
  "attendance_auto_holidays","audit_logs","behavior_records","browser_logs","browser_shortcuts",
  "budget_allocations","budget_approvals","budget_audit_log","budget_categories","budget_requests",
  "budget_sources","budget_transactions","budget_transfers","bus_routes","bus_stops","bus_students",
  "cafeteria_menus","cafeteria_orders","cctv_cameras","chat_blocks","chat_conversations",
  "chat_messages","chat_participants","chat_reports","classrooms","club_advisors",
  "club_announcements","club_applications","club_attendance","club_feed_posts","club_members",
  "club_works","clubs","cms_downloads","cms_faqs","cms_menu_items","cms_nav_menu","cms_pages",
  "cms_school_info","cms_settings","config_bundles","coop_members","coop_transactions",
  "dashboard_shortcuts","director_signatures","disbursements","district_api_keys",
  "district_feed_logs","district_feed_outbox","district_snapshot_runs","district_snapshots",
  "document_recipients","documents","duty_assignments","duty_locations","duty_logs",
  "early_childhood_dev","early_warning_alerts","eform_attachments","eform_recipients",
  "eform_templates","eforms","emergency_broadcasts","enrollments","error_logs","exam_questions",
  "exam_sheets","exam_submissions","exams","exercise_catalog","face_registration_history",
  "face_registration_requests","face_scan_logs","fiscal_years","fitness_achievements",
  "fitness_exercise_logs","fitness_food_logs","fitness_points_ledger","fitness_profiles",
  "fitness_redemptions","fitness_rewards","fitness_sleep_logs","fitness_user_achievements",
  "food_catalog","form_submissions","form_templates","game_hub_api_keys","game_hub_games",
  "game_hub_scores","garbage_badges","garbage_deposits","garbage_items","garbage_personnel_points",
  "garbage_redemptions","garbage_rewards","garbage_student_points","garbage_user_badges",
  "google_chat_logs","google_chat_webhooks","guidance_records","health_measurements",
  "health_records","home_visit_summaries","home_visits","homeroom_records","homework_assignments",
  "homework_submissions","hub_project_budgets","hub_project_expenses","hub_project_updates",
  "hub_projects","ict_devices","ict_loans","id_plan_records","import_mapping_memory",
  "inbox_items","incomplete_grade_fix_requests","incomplete_grade_reports","iot_devices",
  "iot_readings","kiosk_devices","learning_center_bookings","learning_contents","learning_views",
  "lesson_plans","library_books","library_loans","line_richmenu_state","line_sessions",
  "line_user_preferences","line_vault_drive_trash","line_vault_groups","line_vault_items",
  "mascot_advice_cache","mfa_settings","mou_records","news_posts","notification_delivery_log",
  "notification_preferences","notifications","offsite_requests","pa_agreements",
  "pa_indicator_scores","padlet_boards","padlet_notes","pdf_templates","pdpa_consents",
  "pdpa_requests","personnel","personnel_assessments","portfolio_items","pp5_files","pp6_files",
  "print_template_versions","print_templates","procurement_advances","procurement_documents",
  "procurement_records","profiles","project_activities","promotion_runs","push_subscriptions",
  "question_bank","rate_limit_logs","role_notification_defaults","room_bookings","salary_records",
  "sar_evidences","saraban_documents","schedules","scholarship_awards","scholarships",
  "school_lunch_records","school_milk_records","school_settings","school_test_scores","schools",
  "sdq_records","social_posts","special_rooms","sports_day_bonus_points",
  "sports_day_house_members","sports_day_houses","sports_day_meets","staff_evaluations",
  "staff_leaves","strategic_plans","student_assessment_scores","student_column_scores",
  "student_enrollment_history","student_face_descriptors","student_leaves",
  "student_offsite_participants","student_offsite_trips","student_scores","student_screenings",
  "student_subsidies","students","subject_grading_config","subject_group_heads",
  "subject_indicators","subject_score_columns","subjects","substitute_teaching",
  "task_assignments","teacher_assignments","teaching_logbook","teaching_reflection_attachments",
  "teaching_reflection_signature_settings","teaching_reflection_signatures","teaching_reflections",
  "template_fill_history","time_clock","tuition_invoices","tutoring_bookings","tutoring_sessions",
  "upstream_subscription","user_dashboard_widgets","user_departments","user_roles",
  "user_subject_groups","vaccine_records","vehicle_bookings","visitor_logs","wall_post_comments",
  "wall_post_reactions","wall_posts","webauthn_challenges","webauthn_credentials",
  "worksheet_submissions","worksheets",
];


const EDGE_FUNCTIONS = [
  "ai-chat",
  "ai-import-analyze",
  "ai-import-execute",
  "ai-import-test-scores",
  "analyze-data",
  "analyze-pdf-template",
  "announce-pp5-scores",
  "announce-pp6-scores",
  "assess-bmi",
  "attendance-daily-report",
  "auto-pull-bundle",
  "backup-data",
  "backup-snapshot",
  "backup-to-external",
  "bootstrap-admin",
  "calendar-ics",
  "check-upcoming-events",
  "cleanup-orphan-storage",
  "code-login",
  "create-admin-user",
  "daily-line-digest",
  "district-feed-api",
  "district-feed-create-key",
  "district-nightly-snapshot",
  "district-outbox-worker",
  "exam-generate",
  "exam-grade",
  "ext-config",
  "ext-log",
  "face-scan-daily-report",
  "face-scan-summary",
  "fill-pdf-template",
  "games-auth",
  "games-leaderboard",
  "games-submit",
  "gchat-summary",
  "gdrive-admin-status",
  "gdrive-connect-finish",
  "gdrive-connect-start",
  "gdrive-proxy",
  "get-vapid-key",
  "import-teacher-schedule",
  "iot-fetch",
  "liff-submit-leave",
  "line-magic-link",
  "line-quota",
  "line-vault-delete",
  "line-vault-download",
  "line-vault-drive-cleanup",
  "line-vault-stream",
  "line-vault-webhook",
  "line-webhook",
  "link-account",
  "lookup-email",
  "manage-users",
  "manifest",
  "mascot-advice",
  "mcp",
  "notify-attendance-digest",
  "notify-calendar-digest",
  "notify-duty-teachers",
  "notify-fanout",
  "notify-google-chat",
  "notify-ict-overdue",
  "notify-line",
  "notify-line-vault-groups",
  "notify-retry",
  "parent-login",
  "parse-curriculum-pdf",
  "qr-login",
  "refresh-mascot-advice-weekly",
  "seed-test-users",
  "send-push",
  "send-push-broadcast",
  "setup-create-buckets",
  "setup-health-check",
  "setup-line-richmenu",
  "social-feed-sync",
  "suggest-proxy-mapping",
  "sync-env-secrets",
  "system-backup",
  "system-restore",
  "system-update",
  "translate-text",
  "tts-elevenlabs",
  "tts-th",
  "upload-cms-image",
  "upload-line-richmenu"
];


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  // Authz: admin/director only
  const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
  const ok = (roles || []).some((r: any) => r.role === "admin" || r.role === "director");
  if (!ok) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "tables";
  const bucketName = url.searchParams.get("bucket") || "";
  const admin = createClient(supaUrl, srv);

  // List buckets (fast)
  if (mode === "buckets") {
    const { data: buckets } = await admin.storage.listBuckets();
    return new Response(JSON.stringify({ buckets: (buckets || []).map((b) => ({ name: b.name })) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const zip = new JSZip();

  // mode=full: tables + storage-manifest + restore instructions + kit
  const isFull = mode === "full";
  const manifest: any = { version: new Date().toISOString(), mode, errors: [] };

  if (mode === "tables" || isFull) {
    manifest.tables = {};
    const tablesDir = zip.folder("tables")!;
    for (const t of TABLES) {
      try {
        const all: any[] = [];
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data, error } = await admin.from(t).select("*").range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        tablesDir.file(`${t}.json`, JSON.stringify(all));
        manifest.tables[t] = all.length;
      } catch (e: any) {
        manifest.errors.push({ table: t, error: e.message });
      }
    }

    if (isFull) {
      // ---- Schema blueprint: tables, FK, indexes, functions, triggers, grants, RLS, policies
      try {
        const { data: schemaSql, error } = await admin.rpc("export_schema_sql");
        if (error) throw error;
        zip.file("schema.sql", schemaSql as string);
        manifest.schema_bytes = (schemaSql as string)?.length ?? 0;
      } catch (e: any) {
        manifest.errors.push({ part: "schema.sql", error: e.message });
      }

      // ---- Storage RLS policies
      try {
        const { data: stPol, error } = await admin.rpc("export_storage_policies_sql");
        if (error) throw error;
        zip.file("storage-policies.sql", stPol as string);
      } catch (e: any) {
        manifest.errors.push({ part: "storage-policies.sql", error: e.message });
      }

      // ---- Bucket definitions (public flag, size limit, mime types)
      try {
        const { data: bDefs, error } = await admin.rpc("export_storage_buckets");
        if (error) throw error;
        zip.file("buckets.json", JSON.stringify(bDefs, null, 2));
        manifest.buckets = Array.isArray(bDefs) ? bDefs.length : 0;
      } catch (e: any) {
        manifest.errors.push({ part: "buckets.json", error: e.message });
      }

      // ---- Auth users + identities (password hashes preserved → same logins work)
      if (url.searchParams.get("users") !== "0") {
        try {
          const { data: authData, error } = await admin.rpc("export_auth_users");
          if (error) throw error;
          zip.file("auth-users.json", JSON.stringify(authData));
          manifest.auth_users = (authData as any)?.users?.length ?? 0;
        } catch (e: any) {
          manifest.errors.push({ part: "auth-users.json", error: e.message });
        }
      }

      // ---- Edge function inventory (source lives in the code repo)
      zip.file("edge-functions.json", JSON.stringify({ functions: EDGE_FUNCTIONS }, null, 2));
      manifest.edge_functions = EDGE_FUNCTIONS.length;

      // Storage manifest (list only — file bytes are per-bucket via mode=storage)
      const { data: buckets } = await admin.storage.listBuckets();
      const bucketList: any[] = [];
      for (const b of buckets || []) {
        const files: string[] = [];
        const walk = async (prefix: string) => {
          const { data: items } = await admin.storage.from(b.name).list(prefix, { limit: 1000 });
          for (const it of items || []) {
            const p = prefix ? `${prefix}/${it.name}` : it.name;
            if (!it.id && !(it as any).metadata) await walk(p);
            else files.push(p);
          }
        };
        try { await walk(""); } catch (_) { /* ignore */ }
        bucketList.push({ name: b.name, public: b.public, files: files.length, paths: files.slice(0, 5000) });
      }
      manifest.storage = bucketList;
      zip.file("storage-manifest.json", JSON.stringify(bucketList, null, 2));

      // Bundle restore kit
      zip.file("RESTORE.md", RESTORE_MD);
      zip.file("restore.sh", RESTORE_SH);
    }

  } else if (mode === "storage") {
    if (!bucketName) {
      return new Response(JSON.stringify({ error: "bucket required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    manifest.bucket = bucketName;
    manifest.files = 0;
    const bucketDir = zip.folder(bucketName)!;
    const walk = async (prefix: string) => {
      const { data: items, error } = await admin.storage.from(bucketName).list(prefix, { limit: 1000 });
      if (error) { manifest.errors.push({ prefix, error: error.message }); return; }
      for (const it of items || []) {
        const path = prefix ? `${prefix}/${it.name}` : it.name;
        if (!it.id && !(it as any).metadata) { await walk(path); continue; }
        const { data: blob, error: dErr } = await admin.storage.from(bucketName).download(path);
        if (dErr || !blob) { manifest.errors.push({ path, error: dErr?.message }); continue; }
        bucketDir.file(path, new Uint8Array(await blob.arrayBuffer()));
        manifest.files++;
      }
    };
    await walk("");
  } else {
    return new Response(JSON.stringify({ error: "invalid mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const tag = mode === "storage" ? `storage-${bucketName}` : mode === "full" ? "full" : "tables";
  const filename = `smart-school-${tag}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;

  return new Response(zipBuf, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
