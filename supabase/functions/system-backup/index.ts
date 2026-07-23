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

const TABLES = [
  "academic_events","account_balances","action_plans","admissions",
  "app_secrets","archive_logs","assessment_criteria","asset_damage_reports","assets",
  "attendance","audit_logs","behavior_records","budget_transactions","classrooms",
  "cms_menu_items","cms_pages","cms_settings","config_bundles","district_api_keys",
  "district_feed_logs","document_recipients","documents","early_childhood_dev",
  "eform_attachments","eform_recipients","eforms","emergency_broadcasts","enrollments",
  "face_registration_history","face_registration_requests","face_scan_logs",
  "garbage_badges","garbage_deposits","garbage_items","garbage_personnel_points",
  "garbage_redemptions","garbage_rewards","garbage_student_points","garbage_user_badges",
  "google_chat_logs","google_chat_webhooks","health_records","home_visits",
  "homeroom_records","homework_assignments","ict_devices","ict_loans","id_plan_records",
  "import_mapping_memory","inbox_items","iot_devices","iot_readings","line_sessions",
  "line_user_preferences","news_posts","notifications","pa_agreements","pa_indicator_scores",
  "pdpa_consents","personnel","personnel_assessments","pp5_files","pp6_files",
  "procurement_records","profiles","push_subscriptions","salary_records","schedules",
  "school_lunch_records","school_milk_records","school_settings","school_test_scores",
  "schools","sdq_records","social_posts","staff_evaluations","staff_leaves",
  "student_assessment_scores","student_column_scores","student_face_descriptors",
  "student_leaves","student_scores","student_screenings","student_subsidies","students",
  "subject_indicators","subject_score_columns","subjects","substitute_teaching",
  "task_assignments","teacher_assignments","time_clock","user_dashboard_widgets",
  "user_departments","user_roles","vaccine_records",
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
