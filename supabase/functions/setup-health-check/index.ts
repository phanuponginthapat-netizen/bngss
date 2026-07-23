// Setup health check: verify critical tables + storage buckets exist.
// Public (no JWT) — used by /setup wizard.
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

const CRITICAL_TABLES = [
  "profiles", "user_roles", "cms_settings", "school_settings",
  "students", "personnel", "subjects", "classrooms",
  "attendance", "face_scan_logs", "schedules",
  "wall_posts", "notifications", "audit_logs",
];

const CRITICAL_BUCKETS = [
  "profile-images", "cms-logos", "wall-media",
  "padlet-media", "documents", "backups",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = makeAdmin();

    // 1) Tables — probe each critical table (PostgREST doesn't expose information_schema)
    let tErr: { message: string } | null = null;
    const missingTables: string[] = [];
    await Promise.all(
      CRITICAL_TABLES.map(async (t) => {
        const { error } = await admin.from(t as any).select("*", { head: true, count: "exact" }).limit(1);
        // PGRST205 = table not found in schema cache; 42P01 = undefined_table
        if (error && (error.code === "PGRST205" || error.code === "42P01" || /does not exist|not found/i.test(error.message))) {
          missingTables.push(t);
        }
      })
    );


    // 2) Buckets
    const { data: buckets, error: bErr } = await admin.storage.listBuckets();
    const existingBuckets = new Set((buckets ?? []).map((b: any) => b.name));
    const missingBuckets = CRITICAL_BUCKETS.filter((b) => !existingBuckets.has(b));

    // 3) Admin count
    let adminCount = 0;
    try {
      const { count } = await admin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
      adminCount = count ?? 0;
    } catch { /* ignore */ }

    // 4) RLS coverage (best-effort)
    let rlsMissing: string[] = [];
    try {
      const { data: rls } = await admin.rpc("rls_policy_audit" as any);
      rlsMissing = (rls ?? [])
        .filter((r: any) => r.total_policies === 0)
        .map((r: any) => r.table_name)
        .slice(0, 10);
    } catch { /* function may not exist yet */ }

    const ok = missingTables.length === 0 && missingBuckets.length === 0;

    return new Response(JSON.stringify({
      ok,
      summary: {
        tables: { total: CRITICAL_TABLES.length, missing: missingTables.length },
        buckets: { total: CRITICAL_BUCKETS.length, missing: missingBuckets.length },
        admins: adminCount,
        rls_tables_without_policy: rlsMissing.length,
      },
      missingTables,
      missingBuckets,
      rlsMissing,
      recommendations: buildRecommendations(missingTables, missingBuckets, adminCount),
      errors: { tables: tErr?.message, buckets: bErr?.message },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildRecommendations(mt: string[], mb: string[], admins: number): string[] {
  const rec: string[] = [];
  if (mt.length) {
    rec.push(`ยังไม่มีตาราง ${mt.length} รายการ — รัน: bash scripts/deploy-external-supabase.sh (จะสร้าง schema + FK + policies ทั้งหมด)`);
  }
  if (mb.length) {
    rec.push(`ยังขาด storage bucket: ${mb.join(", ")} — กดปุ่ม "สร้าง buckets ที่ขาด" ด้านล่าง (อัตโนมัติ)`);
  }
  if (admins === 0) {
    rec.push("ยังไม่มีบัญชี admin — สมัครที่ /signup (คนแรกจะถูกตั้งเป็น admin อัตโนมัติ)");
  }
  if (!rec.length) rec.push("✅ ระบบพร้อมใช้งานทั้งหมด");
  return rec;
}
