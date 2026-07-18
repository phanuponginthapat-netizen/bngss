// Full system backup: dump every public table as JSON + all storage files into a single ZIP.
// POST /system-backup  -> returns application/zip stream
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// All user-data tables in public schema (kept in sync with project schema).
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

  const admin = createClient(supaUrl, srv);
  const zip = new JSZip();
  const manifest: any = { version: new Date().toISOString(), tables: {}, storage: {}, errors: [] };

  // 1) Dump tables (paginated to bypass the default 1000-row PostgREST cap)
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
      tablesDir.file(`${t}.json`, JSON.stringify(all, null, 2));
      manifest.tables[t] = all.length;
    } catch (e: any) {
      manifest.errors.push({ table: t, error: e.message });
    }
  }

  // 2) Dump storage: every bucket, every file
  const storageDir = zip.folder("storage")!;
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    for (const b of buckets || []) {
      const bucketDir = storageDir.folder(b.name)!;
      let count = 0;
      const walk = async (prefix: string) => {
        const { data: items, error } = await admin.storage.from(b.name).list(prefix, { limit: 1000 });
        if (error) { manifest.errors.push({ bucket: b.name, prefix, error: error.message }); return; }
        for (const it of items || []) {
          const path = prefix ? `${prefix}/${it.name}` : it.name;
          // Folder entries have no id/metadata
          if (!it.id && !(it as any).metadata) {
            await walk(path);
            continue;
          }
          const { data: blob, error: dErr } = await admin.storage.from(b.name).download(path);
          if (dErr || !blob) { manifest.errors.push({ bucket: b.name, path, error: dErr?.message }); continue; }
          bucketDir.file(path, new Uint8Array(await blob.arrayBuffer()));
          count++;
        }
      };
      await walk("");
      manifest.storage[b.name] = count;
    }
  } catch (e: any) {
    manifest.errors.push({ stage: "storage", error: e.message });
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("README.txt",
    "Smart School Full Backup\n" +
    `Generated: ${manifest.version}\n` +
    `Tables: ${Object.keys(manifest.tables).length}\n` +
    `Storage buckets: ${Object.keys(manifest.storage).length}\n` +
    "Restore: ใช้หน้า 'อัพเดทระบบ' หรือ system-update edge function เพื่อ apply ข้อมูลกลับเข้าระบบ\n");

  const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const filename = `smart-school-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;

  return new Response(zipBuf, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
