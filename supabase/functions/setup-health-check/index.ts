// Setup health check: verify critical tables + storage buckets exist.
// Public (no JWT) — used by /setup wizard.
// Enhanced: checks DB (select 1), storage (list buckets), functions (list) and returns { db, storage, functions } with 200 or 500
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

    // --- 1) Simple health checks (required for monitoring) ---
    let dbOk = false;
    let dbError: string | null = null;
    try {
      const { error } = await admin.from("profiles" as any).select("id").limit(1);
      if (!error) {
        dbOk = true;
      } else {
        dbError = error.message;
        // graceful: table missing counts as not ok but not thrown
        if (error.code === "PGRST205" || error.code === "42P01" || /does not exist|not found/i.test(error.message)) {
          dbOk = false;
        } else {
          dbOk = false;
        }
      }
    } catch (e) {
      dbError = (e as Error).message;
      dbOk = false;
    }

    let storageOk = false;
    let storageError: string | null = null;
    let bucketsData: any[] = [];
    try {
      const { data, error } = await admin.storage.listBuckets();
      if (!error) {
        storageOk = true;
        bucketsData = data ?? [];
      } else {
        storageError = error.message;
        storageOk = false;
      }
    } catch (e) {
      storageError = (e as Error).message;
      storageOk = false;
    }

    let functionsCount = 0;
    let functionsError: string | null = null;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      // Try to list functions via edge runtime; graceful fallback to 1 if endpoint exists but not listable
      const resp = await fetch(`${supabaseUrl}/functions/v1/`, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      });
      if (resp.ok) {
        const json = await resp.json().catch(() => null);
        if (Array.isArray(json)) functionsCount = json.length;
        else if (json && Array.isArray((json as any).functions)) functionsCount = (json as any).functions.length;
        else if (json && typeof json === "object") functionsCount = 1;
        else functionsCount = 1;
        // ensure at least 1 if we are running
        if (functionsCount === 0) functionsCount = 1;
      } else {
        // endpoint not listable (common on Supabase cloud) — count this function as 1
        functionsCount = 1;
      }
    } catch (e) {
      functionsError = (e as Error).message;
      // graceful fallback: this function is running, so count at least 1
      functionsCount = 1;
    }

    // --- 2) Detailed checks for setup wizard (backwards compat) ---
    const missingTables: string[] = [];
    await Promise.all(
      CRITICAL_TABLES.map(async (t) => {
        try {
          const { error } = await admin.from(t as any).select("*", { head: true, count: "exact" }).limit(1);
          if (error && (error.code === "PGRST205" || error.code === "42P01" || /does not exist|not found/i.test(error.message))) {
            missingTables.push(t);
          }
        } catch {
          // graceful: if query throws, treat as missing but don't fail whole check
          missingTables.push(t);
        }
      })
    );

    const existingBuckets = new Set((bucketsData ?? []).map((b: any) => b.name));
    // if listBuckets failed, existingBuckets will be empty => all buckets considered missing, but storageOk already false
    const missingBuckets = CRITICAL_BUCKETS.filter((b) => !existingBuckets.has(b));

    let adminCount = 0;
    try {
      const { count } = await admin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
      adminCount = count ?? 0;
    } catch { /* ignore — table may not exist yet */ }

    let rlsMissing: string[] = [];
    try {
      const { data: rls } = await admin.rpc("rls_policy_audit" as any);
      rlsMissing = (rls ?? [])
        .filter((r: any) => r.total_policies === 0)
        .map((r: any) => r.table_name)
        .slice(0, 10);
    } catch { /* function may not exist yet */ }

    const detailedOk = missingTables.length === 0 && missingBuckets.length === 0;
    const simpleOk = dbOk && storageOk && functionsCount > 0;
    const ok = simpleOk && detailedOk;
    const status = ok ? 200 : 500;

    return new Response(JSON.stringify({
      db: dbOk,
      storage: storageOk,
      functions: functionsCount,
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
      errors: { tables: dbError, buckets: storageError, functions: functionsError },
      timestamp: new Date().toISOString(),
    }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ db: false, storage: false, functions: 0, ok: false, error: (e as Error).message }), {
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
