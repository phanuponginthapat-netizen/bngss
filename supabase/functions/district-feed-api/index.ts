// District Feed API — public endpoint for external district systems
// Auth: Bearer API key (from district_api_keys, stored as SHA-256 hash)
// Endpoints:
//   GET /                       -> service info
//   GET /openapi.json           -> OpenAPI 3.0 spec (no auth)
//   GET /health                 -> health check (no auth)
//   GET /schools                -> list schools
//   GET /schools/:id            -> school detail
//   GET /stats                  -> aggregate stats (?school_id, ?academic_year)
//   GET /students               -> paginated students (?school_id, ?grade_level, ?status, ?page, ?page_size)
//   GET /personnel              -> paginated personnel (?school_id, ?status, ?page, ?page_size)
//   GET /attendance/summary     -> attendance summary (?school_id, ?from, ?to, ?academic_year)
//   GET /documents/summary      -> documents summary (?school_id, ?from, ?to)
//   GET /reports/obec           -> OBEC reports summary
//   GET /reports/pp             -> PP (ปพ) reports summary
//   GET /news                   -> published news posts (?school_id, ?page, ?page_size, ?since)
//   GET /events                 -> academic events (?school_id, ?from, ?to)
//   GET /changes?since=ISO      -> cross-table incremental feed for central aggregator
// Pagination: page (>=1), page_size (1..200, default 50)
// Cache: GET 200 responses cached 5 min by default; /health and /openapi.json cached 1h

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  summarizeGrading, summarizeAttendance, summarizeBehavior, summarizeFinance,
  summarizeAssets, summarizeWelfare,
} from "../_shared/aggregates.ts";

import { buildCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = buildCorsHeaders(['x-api-key'], "GET, OPTIONS");

const json = (body: unknown, status = 200, cacheSeconds = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(cacheSeconds > 0 && status === 200
        ? { "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}` }
        : { "Cache-Control": "no-store" }),
    },
  });

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- validation helpers ----------
function parseInt32(value: string | null, def: number, min: number, max: number): number {
  if (value == null) return def;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateOptional(value: string | null, re: RegExp): string | null {
  if (!value) return null;
  return re.test(value) ? value : null;
}

// ---------- OpenAPI spec ----------
const OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "District Feed API",
    version: "1.1.0",
    description: "Read-only feed of school data for district / OBEC integrations.",
  },
  servers: [{ url: "/functions/v1/district-feed-api" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
    },
    parameters: {
      page: { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
      page_size: { name: "page_size", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
      school_id: { name: "school_id", in: "query", schema: { type: "string", format: "uuid" } },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/health": { get: { summary: "Health check", security: [], responses: { "200": { description: "OK" } } } },
    "/openapi.json": { get: { summary: "OpenAPI spec", security: [], responses: { "200": { description: "OK" } } } },
    "/schools": { get: { summary: "List active schools", responses: { "200": { description: "OK" } } } },
    "/schools/{id}": { get: { summary: "School detail", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "OK" } } } },
    "/stats": { get: { summary: "Aggregate stats", parameters: [{ $ref: "#/components/parameters/school_id" }], responses: { "200": { description: "OK" } } } },
    "/students": { get: { summary: "Paginated students", parameters: [{ $ref: "#/components/parameters/school_id" }, { $ref: "#/components/parameters/page" }, { $ref: "#/components/parameters/page_size" }, { name: "grade_level", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string" } }], responses: { "200": { description: "OK" } } } },
    "/personnel": { get: { summary: "Paginated personnel", parameters: [{ $ref: "#/components/parameters/school_id" }, { $ref: "#/components/parameters/page" }, { $ref: "#/components/parameters/page_size" }, { name: "status", in: "query", schema: { type: "string" } }], responses: { "200": { description: "OK" } } } },
    "/attendance/summary": { get: { summary: "Attendance summary", parameters: [{ $ref: "#/components/parameters/school_id" }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }, { name: "academic_year", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "OK" } } } },
    "/documents/summary": { get: { summary: "Documents summary", parameters: [{ $ref: "#/components/parameters/school_id" }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: { "200": { description: "OK" } } } },
    "/reports/obec": { get: { summary: "OBEC reports summary", responses: { "200": { description: "OK" } } } },
    "/reports/pp": { get: { summary: "PP (ปพ) reports", parameters: [{ $ref: "#/components/parameters/school_id" }, { name: "academic_year", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "OK" } } } },
    "/news": { get: { summary: "Published news posts", parameters: [{ $ref: "#/components/parameters/school_id" }, { $ref: "#/components/parameters/page" }, { $ref: "#/components/parameters/page_size" }, { name: "since", in: "query", schema: { type: "string", format: "date-time" } }], responses: { "200": { description: "OK" } } } },
    "/events": { get: { summary: "Academic events", parameters: [{ $ref: "#/components/parameters/school_id" }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: { "200": { description: "OK" } } } },
    "/assets": { get: { summary: "ทะเบียนวัสดุ-ครุภัณฑ์ (รายชิ้น) สำหรับ Hub กลาง", parameters: [{ $ref: "#/components/parameters/school_id" }, { $ref: "#/components/parameters/page" }, { $ref: "#/components/parameters/page_size" }, { name: "category", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string" } }, { name: "from", in: "query", schema: { type: "string", format: "date-time" } }, { name: "to", in: "query", schema: { type: "string", format: "date-time" } }], responses: { "200": { description: "OK" } } } },
    "/assets/summary": { get: { summary: "สรุปทรัพย์สิน-ครุภัณฑ์ ตามหมวด/สถานะ/มูลค่ารวม", parameters: [{ $ref: "#/components/parameters/school_id" }], responses: { "200": { description: "OK" } } } },
    "/changes": { get: { summary: "Incremental change feed for central aggregator", parameters: [{ $ref: "#/components/parameters/school_id" }, { name: "since", in: "query", required: true, schema: { type: "string", format: "date-time" } }, { name: "tables", in: "query", schema: { type: "string", description: "comma-separated table names" } }], responses: { "200": { description: "OK" } } } },
    "/test-scores": { get: { summary: "Standardized test scores (O-NET/NT/RT/PISA)", parameters: [{ $ref: "#/components/parameters/school_id" }, { name: "test_type", in: "query", schema: { type: "string", enum: ["onet", "nt", "rt", "pisa", "other"] } }, { name: "academic_year", in: "query", schema: { type: "integer" } }, { $ref: "#/components/parameters/page" }, { $ref: "#/components/parameters/page_size" }], responses: { "200": { description: "OK" } } } },
    "/test-scores/summary": { get: { summary: "Aggregated test score summary", parameters: [{ $ref: "#/components/parameters/school_id" }, { name: "academic_year", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "OK" } } } },
    "/health/summary": { get: { summary: "สรุปงานสุขภาพ + BMI เฉลี่ย + วัคซีน + คัดกรอง" } },
    "/health/measurements": { get: { summary: "ข้อมูลส่วนสูง/น้ำหนัก/BMI รายคน" } },
    "/vaccines": { get: { summary: "รายการวัคซีนของนักเรียน" } },
    "/sdq/summary": { get: { summary: "สรุปแบบประเมิน SDQ ตามกลุ่ม" } },
    "/leaves/students": { get: { summary: "รายการลาของนักเรียน" } },
    "/leaves/staff": { get: { summary: "รายการลาของบุคลากร" } },
    "/leaves/summary": { get: { summary: "สรุปการลานักเรียน+บุคลากร" } },
    "/substitute/summary": { get: { summary: "สรุปการสอนแทน" } },
    "/lunch/daily": { get: { summary: "อาหารกลางวันรายวัน" } },
    "/milk/daily": { get: { summary: "นมโรงเรียนรายวัน" } },
    "/procurement": { get: { summary: "ทะเบียนจัดซื้อจัดจ้าง" } },
    "/budget/transactions": { get: { summary: "รายการรับ-จ่ายงบประมาณ" } },
    "/salary/summary": { get: { summary: "สรุปเงินเดือนบุคลากร (gross/net)" } },
    "/assets/damage": { get: { summary: "รายงานครุภัณฑ์เสียหาย" } },
    "/classrooms": { get: { summary: "ห้องเรียนของโรงเรียน" } },
    "/subjects": { get: { summary: "รายวิชา" } },
    "/schedules": { get: { summary: "ตารางสอน" } },
    "/exams/summary": { get: { summary: "สรุปข้อสอบและการส่ง" } },
    "/homework/summary": { get: { summary: "สรุปการบ้าน" } },
    "/admissions/summary": { get: { summary: "สรุปการรับสมัครเข้าเรียน" } },
    "/home-visits/summary": { get: { summary: "สรุปการเยี่ยมบ้านนักเรียน" } },
    "/pa/summary": { get: { summary: "สรุปข้อตกลง PA + ID Plan ของครู" } },
    "/iot/devices": { get: { summary: "อุปกรณ์ IoT ทั้งหมด" } },
    "/iot/readings": { get: { summary: "ค่าที่อ่านจาก IoT sensor (device_id, from, to)" } },
    "/iot/summary": { get: { summary: "สรุปอุปกรณ์ IoT ตามชนิด/สถานะ" } },
    "/ict/devices": { get: { summary: "ทะเบียน ICT (PC/Tablet/Notebook)" } },
    "/ict/loans": { get: { summary: "การยืม-คืน ICT" } },
    "/special-rooms": { get: { summary: "ห้องพิเศษ (lab/computer/library)" } },
    "/subsidies/summary": { get: { summary: "สรุปทุนการศึกษา/เงินอุดหนุน" } },
    "/early-childhood/summary": { get: { summary: "สรุปพัฒนาการเด็กปฐมวัย" } },
    "/action-plans": { get: { summary: "แผนปฏิบัติการประจำปี" } },
    "/evaluations/summary": { get: { summary: "สรุปการประเมินบุคลากร" } },
    "/pdpa/summary": { get: { summary: "สรุปการให้ความยินยอม PDPA" } },
    "/face-scan/summary": { get: { summary: "สรุปการสแกนใบหน้าเช็คชื่อ" } },
    "/social-posts": { get: { summary: "โพสต์จาก Facebook Page (mirrored)" } },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/district-feed-api/, "") || "/";

  // Public endpoints (no auth)
  if (path === "/health") return json({ status: "ok", time: new Date().toISOString() }, 200, 3600);
  if (path === "/openapi.json") return json(OPENAPI_SPEC, 200, 3600);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth via API key
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!apiKey) return json({ error: "missing_api_key" }, 401);

  const keyHash = await sha256(apiKey);
  const { data: keyRow } = await supabase
    .from("district_api_keys")
    .select("id, scopes, is_active, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!keyRow || !keyRow.is_active) return json({ error: "invalid_api_key" }, 401);
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return json({ error: "api_key_expired" }, 401);
  }

  // Update last_used_at (fire-and-forget)
  supabase.from("district_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});

  const scopes: string[] = keyRow.scopes || [];

  const requireScope = (s: string) => scopes.includes(s) || scopes.includes("*");

  // Pagination params (validated)
  const page = parseInt32(url.searchParams.get("page"), 1, 1, 100000);
  const pageSize = parseInt32(url.searchParams.get("page_size"), 50, 1, 200);
  const offset = (page - 1) * pageSize;
  const schoolIdParam = validateOptional(url.searchParams.get("school_id"), UUID_RE);
  const fromParam = validateOptional(url.searchParams.get("from"), ISO_DATE_RE);
  const toParam = validateOptional(url.searchParams.get("to"), ISO_DATE_RE);

  let body: unknown;
  let statusCode = 200;

  try {
    if (path === "/" || path === "") {
      body = {
        name: "District Feed API",
        version: "2.0.0",
        endpoints: [
          "/health", "/openapi.json",
          "/schools", "/schools/:id", "/stats",
          "/students", "/personnel",
          "/attendance/summary", "/documents/summary",
          "/reports/obec", "/reports/pp",
          "/news", "/events", "/changes",
          "/school-info", "/school-grading", "/activities", "/snapshot",
          "/snapshot/cached", "/snapshot/history",
          "/dashboard", "/finance/summary", "/assets", "/assets/summary",
          "/behavior/summary", "/welfare/summary",
          "/projects", "/projects/:id",
          "/test-scores", "/test-scores/summary",
          "/health/summary", "/health/measurements", "/vaccines", "/sdq/summary",
          "/leaves/students", "/leaves/staff", "/leaves/summary", "/substitute/summary",
          "/lunch/daily", "/milk/daily", "/procurement", "/budget/transactions", "/salary/summary",
          "/assets/damage", "/classrooms", "/subjects", "/schedules",
          "/exams/summary", "/homework/summary", "/admissions/summary", "/home-visits/summary",
          "/pa/summary", "/iot/devices", "/iot/readings", "/iot/summary",
          "/ict/devices", "/ict/loans", "/special-rooms", "/subsidies/summary",
          "/early-childhood/summary", "/action-plans", "/evaluations/summary",
          "/pdpa/summary", "/face-scan/summary", "/social-posts",
        ],
        scopes,
        docs: "GET /openapi.json",
        tip: "Append ?format=csv to /students, /personnel for CSV export. Use /snapshot/cached for nightly pre-computed payload.",
      };
    } else if (path === "/snapshot/cached") {
      // Pre-computed nightly snapshot — fast, no live aggregation
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("district_snapshots").select("school_id, snapshot_date, generated_at, payload")
        .eq("snapshot_type", "nightly")
        .order("snapshot_date", { ascending: false }).limit(1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q.maybeSingle();
      if (!data) { statusCode = 404; body = { error: "no_snapshot_yet", hint: "nightly job has not run yet" }; }
      else body = data;
    } else if (path === "/snapshot/history") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("district_snapshots").select("school_id, snapshot_date, generated_at")
        .eq("snapshot_type", "nightly")
        .order("snapshot_date", { ascending: false }).limit(pageSize);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      body = { history: data || [] };
    } else if (path === "/dashboard") {
      // Comprehensive one-stop view — uses cached snapshot if fresh (<25h), else live
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("district_snapshots").select("payload, generated_at")
        .eq("snapshot_type", "nightly")
        .order("snapshot_date", { ascending: false }).limit(1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q.maybeSingle();
      const fresh = data && (Date.now() - new Date(data.generated_at).getTime() < 25 * 3600 * 1000);
      if (fresh) {
        body = { source: "cached", generated_at: data.generated_at, ...data.payload };
      } else {
        body = { source: "live_fallback", hint: "nightly snapshot stale or missing — call /snapshot for live computation", schools_consented: 0 };
      }
    } else if (path === "/finance/summary") {
      if (!requireScope("*") && !requireScope("stats") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      const fiscalYear = parseInt32(url.searchParams.get("fiscal_year"), new Date().getFullYear(), 2000, 3000);
      let bq = supabase.from("budget_transactions").select("transaction_type, amount, category, fiscal_year").eq("fiscal_year", fiscalYear).limit(20000);
      let pq = supabase.from("procurement_records").select("total_amount, status, created_at").gte("created_at", `${fiscalYear}-01-01`).limit(10000);
      if (schoolIdParam) { bq = bq.eq("school_id", schoolIdParam); pq = pq.eq("school_id", schoolIdParam); }
      const [bRes, pRes] = await Promise.all([bq, pq]);
      const f = summarizeFinance(bRes.data || [], pRes.data || []);
      body = {
        school_id: schoolIdParam, fiscal_year: fiscalYear,
        finance: {
          income_total: f.income_total,
          expense_total: f.expense_total,
          balance: f.balance,
          expense_by_category: f.expense_by_category,
          procurement_total: f.procurement_total,
          procurement_count: f.procurement_count,
        },
      };
    } else if (path === "/assets") {
      // รายการทรัพย์สิน/ครุภัณฑ์ รายชิ้น ส่ง Hub กลาง
      if (!requireScope("*") && !requireScope("assets") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const category = url.searchParams.get("category");
      const status = url.searchParams.get("status");
      let q = supabase.from("assets").select(
        "id, school_id, asset_code, asset_name, asset_category, asset_type, status, condition, " +
        "serial_number, barcode, gfmis_code, budget_source, supplier, acquisition_date, acquisition_value, " +
        "useful_life_years, warranty_until, location, building, room, floor, latitude, longitude, " +
        "responsible_person, responsible_user_id, notes, photos, created_at, updated_at",
        { count: "exact" }
      ).order("updated_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (category) q = q.eq("asset_category", category);
      if (status) q = q.eq("status", status);
      if (fromParam) q = q.gte("updated_at", fromParam);
      if (toParam) q = q.lte("updated_at", toParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, school_id: schoolIdParam, assets: data || [] };
    } else if (path === "/assets/summary") {
      if (!requireScope("*") && !requireScope("stats") && !requireScope("assets")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("assets").select("id, status, asset_category, acquisition_value").limit(20000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      body = { school_id: schoolIdParam, assets: summarizeAssets(data || []) };
    } else if (path === "/behavior/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("behavior_records").select("behavior_type, points, record_date").limit(20000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fromParam) q = q.gte("record_date", fromParam);
      if (toParam) q = q.lte("record_date", toParam);
      const { data } = await q;
      body = {
        school_id: schoolIdParam, from: fromParam, to: toParam,
        behavior: summarizeBehavior(data || []),
      };
    } else if (path === "/welfare/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const filterSid = (q: any) => schoolIdParam ? q.eq("school_id", schoolIdParam) : q;
      const [health, sdq, hv, vac] = await Promise.all([
        filterSid(supabase.from("health_records").select("id", { count: "exact", head: true })),
        filterSid(supabase.from("sdq_records").select("id, category", { count: "exact" }).limit(5000)),
        filterSid(supabase.from("home_visits").select("id", { count: "exact", head: true })),
        filterSid(supabase.from("vaccine_records").select("id", { count: "exact", head: true })),
      ]);
      body = {
        school_id: schoolIdParam,
        welfare: summarizeWelfare({
          healthCount: health.count ?? 0,
          homeVisitCount: hv.count ?? 0,
          vaccineCount: vac.count ?? 0,
          sdqRows: sdq.data || [],
          sdqCount: sdq.count,
        }),
      };
    } else if (path === "/school-info") {
      // ConnextED-style school info: profile + KPIs
      if (!requireScope("schools") && !requireScope("*")) return json({ error: "scope_denied" }, 403);
      const sid = schoolIdParam;
      const schoolQ = sid
        ? supabase.from("schools").select("*").eq("id", sid).maybeSingle()
        : supabase.from("schools").select("*").eq("is_active", true).limit(1).maybeSingle();
      const school = (await schoolQ).data;
      const filterSid = (q: any) => sid ? q.eq("school_id", sid) : q;
      const [studentsRes, personnelRes, classroomsRes, subjectsRes] = await Promise.all([
        filterSid(supabase.from("students").select("id,status,gender,grade_level", { count: "exact" })),
        filterSid(supabase.from("personnel").select("id,status,position,academic_rank", { count: "exact" })),
        filterSid(supabase.from("classrooms").select("id,grade_level", { count: "exact" })),
        filterSid(supabase.from("subjects").select("id", { count: "exact", head: true })),
      ]);
      const students = studentsRes.data || [];
      const personnel = personnelRes.data || [];
      const byGrade: Record<string, number> = {};
      const byGender: Record<string, number> = { male: 0, female: 0 };
      students.forEach((s: any) => {
        if (s.status !== "active") return;
        byGrade[s.grade_level || "unknown"] = (byGrade[s.grade_level || "unknown"] || 0) + 1;
        if (s.gender === "ชาย" || s.gender === "male") byGender.male++;
        else if (s.gender === "หญิง" || s.gender === "female") byGender.female++;
      });
      body = {
        school,
        kpi: {
          students_total: studentsRes.count ?? 0,
          students_active: students.filter((s: any) => s.status === "active").length,
          students_by_grade: byGrade,
          students_by_gender: byGender,
          personnel_total: personnelRes.count ?? 0,
          personnel_active: personnel.filter((p: any) => p.status === "active").length,
          classrooms_total: classroomsRes.count ?? 0,
          subjects_total: subjectsRes.count ?? 0,
        },
        server_time: new Date().toISOString(),
      };
    } else if (path === "/school-grading") {
      // ConnextED-style grading summary
      if (!requireScope("reports") && !requireScope("*")) return json({ error: "scope_denied" }, 403);
      const academicYear = url.searchParams.get("academic_year");
      const semester = url.searchParams.get("semester");
      let q = supabase.from("student_scores").select("grade, total_score, academic_year, semester, subject_id, school_id").limit(50000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (academicYear) q = q.eq("academic_year", parseInt(academicYear, 10));
      if (semester) q = q.eq("semester", parseInt(semester, 10));
      const { data } = await q;
      body = {
        school_id: schoolIdParam, academic_year: academicYear, semester,
        grading: summarizeGrading(data || []),
      };
    } else if (path === "/activities") {
      // Overview of school activities
      if (!requireScope("*") && !requireScope("events") && !requireScope("news")) return json({ error: "scope_denied" }, 403);
      const sid = schoolIdParam;
      const since = url.searchParams.get("since");
      const filterSid = (q: any) => sid ? q.eq("school_id", sid) : q;
      const sinceFilter = (q: any, col: string) => since ? q.gte(col, since) : q;
      const [events, news, behavior, leaves, procurement] = await Promise.all([
        sinceFilter(filterSid(supabase.from("academic_events").select("id,title,event_date,event_type,description").order("event_date", { ascending: false }).limit(50)), "event_date"),
        sinceFilter(filterSid(supabase.from("news_posts").select("id,title,category,published_at,is_pinned").eq("is_published", true).order("published_at", { ascending: false }).limit(50)), "published_at"),
        filterSid(supabase.from("behavior_records").select("id", { count: "exact", head: true })),
        filterSid(supabase.from("student_leaves").select("id,status,leave_type").limit(1000)),
        filterSid(supabase.from("procurement_records").select("id,total_amount,status,created_at").limit(1000)),
      ]);
      const leaveRows = leaves.data || [];
      const procRows = procurement.data || [];
      body = {
        school_id: sid, since,
        activities: {
          recent_events: events.data || [],
          recent_news: news.data || [],
          behavior_total: behavior.count ?? 0,
          leaves: {
            total: leaveRows.length,
            approved: leaveRows.filter((r: any) => r.status === "approved").length,
            pending: leaveRows.filter((r: any) => r.status === "pending").length,
          },
          procurement: {
            total_records: procRows.length,
            total_amount: procRows.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
          },
        },
        server_time: new Date().toISOString(),
      };
    } else if (path === "/snapshot") {
      // Full snapshot for central system
      if (!requireScope("*")) return json({ error: "scope_denied", hint: "snapshot requires '*' scope" }, 403);
      const sid = schoolIdParam;
      const filterSid = (q: any) => sid ? q.eq("school_id", sid) : q;
      const [school, students, personnel, classrooms, subjects, events, news, scores] = await Promise.all([
        sid ? supabase.from("schools").select("*").eq("id", sid).maybeSingle() : supabase.from("schools").select("*").eq("is_active", true).limit(1).maybeSingle(),
        filterSid(supabase.from("students").select("id,status,gender,grade_level", { count: "exact" })),
        filterSid(supabase.from("personnel").select("id,status", { count: "exact" })),
        filterSid(supabase.from("classrooms").select("id", { count: "exact", head: true })),
        filterSid(supabase.from("subjects").select("id", { count: "exact", head: true })),
        filterSid(supabase.from("academic_events").select("id,title,event_date,event_type").order("event_date", { ascending: false }).limit(20)),
        filterSid(supabase.from("news_posts").select("id,title,published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(20)),
        filterSid(supabase.from("student_scores").select("grade,total_score").limit(50000)),
      ]);
      const sRows = students.data || [];
      const gradeDist: Record<string, number> = {};
      let scoreSum = 0, scoreN = 0;
      (scores.data || []).forEach((r: any) => {
        gradeDist[r.grade || "-"] = (gradeDist[r.grade || "-"] || 0) + 1;
        const ts = Number(r.total_score);
        if (Number.isFinite(ts)) { scoreSum += ts; scoreN++; }
      });
      body = {
        snapshot_version: "1.0",
        generated_at: new Date().toISOString(),
        school: school.data,
        kpi: {
          students: { total: students.count ?? 0, active: sRows.filter((s: any) => s.status === "active").length },
          personnel: { total: personnel.count ?? 0 },
          classrooms: classrooms.count ?? 0,
          subjects: subjects.count ?? 0,
        },
        grading: {
          grade_distribution: gradeDist,
          average_score: scoreN ? +(scoreSum / scoreN).toFixed(2) : 0,
          total_records: (scores.data || []).length,
        },
        activities: {
          recent_events: events.data || [],
          recent_news: news.data || [],
        },
      };
    } else if (path === "/schools") {
      if (!requireScope("schools")) return json({ error: "scope_denied" }, 403);
      const { data } = await supabase
        .from("schools")
        .select("id, school_code, obec_code, school_name, short_name, province, district, address, postal_code, phone, email, website, logo_url, director_name, total_students, total_personnel, size_category, latitude, longitude, is_active")
        .eq("is_active", true)
        .order("school_name");
      // GeoJSON-friendly payload สำหรับระบบเขต/ส่วนกลาง ใช้ปักหมุดบนแผนที่ได้ทันที
      const features = (data || [])
        .filter((s: any) => s.latitude != null && s.longitude != null)
        .map((s: any) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
          properties: s,
        }));
      body = {
        schools: data || [],
        count: data?.length ?? 0,
        geojson: { type: "FeatureCollection", features },
      };
    } else if (path.startsWith("/schools/")) {
      if (!requireScope("schools")) return json({ error: "scope_denied" }, 403);
      const schoolId = path.replace("/schools/", "");
      if (!UUID_RE.test(schoolId)) { statusCode = 400; body = { error: "invalid_school_id" }; }
      else {
      const { data } = await supabase.from("schools").select("*").eq("id", schoolId).maybeSingle();
      if (!data) { statusCode = 404; body = { error: "not_found" }; }
      else body = { school: data };
      }
    } else if (path === "/stats") {
      if (!requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const schoolId = schoolIdParam;
      const baseStudent = supabase.from("students").select("id, school_id, classroom_id, status", { count: "exact", head: false });
      const baseStaff = supabase.from("personnel").select("id, school_id, status", { count: "exact", head: false });
      const baseClass = supabase.from("classrooms").select("id, school_id", { count: "exact", head: false });
      const [students, staff, classes] = await Promise.all([
        schoolId ? baseStudent.eq("school_id", schoolId) : baseStudent,
        schoolId ? baseStaff.eq("school_id", schoolId) : baseStaff,
        schoolId ? baseClass.eq("school_id", schoolId) : baseClass,
      ]);
      body = {
        school_id: schoolId,
        stats: {
          total_students: students.count ?? 0,
          active_students: (students.data || []).filter((s: any) => s.status === "active").length,
          total_personnel: staff.count ?? 0,
          total_classrooms: classes.count ?? 0,
        },
      };
    } else if (path === "/students") {
      if (!requireScope("students") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const grade = url.searchParams.get("grade_level");
      const status = url.searchParams.get("status");
      let q = supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, grade_level, classroom_id, school_id, status, gender", { count: "exact" })
        .order("student_code", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (grade) q = q.eq("grade_level", grade);
      if (status) q = q.eq("status", status);
      const { data, count } = await q;
      body = {
        page, page_size: pageSize, total: count ?? 0,
        total_pages: count ? Math.ceil(count / pageSize) : 0,
        students: data || [],
      };
    } else if (path === "/personnel") {
      if (!requireScope("personnel") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const status = url.searchParams.get("status");
      let q = supabase
        .from("personnel")
        .select("id, employee_code, prefix, first_name, last_name, position, academic_rank, school_id, status", { count: "exact" })
        .order("employee_code", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (status) q = q.eq("status", status);
      const { data, count } = await q;
      body = {
        page, page_size: pageSize, total: count ?? 0,
        total_pages: count ? Math.ceil(count / pageSize) : 0,
        personnel: data || [],
      };
    } else if (path === "/attendance/summary") {
      if (!requireScope("attendance") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const academicYear = url.searchParams.get("academic_year");
      let q = supabase
        .from("attendance")
        .select("status, attendance_date, school_id, academic_year");
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (academicYear) q = q.eq("academic_year", parseInt(academicYear, 10));
      if (fromParam) q = q.gte("attendance_date", fromParam);
      if (toParam) q = q.lte("attendance_date", toParam);
      const { data } = await q.limit(20000);
      body = { school_id: schoolIdParam, from: fromParam, to: toParam, summary: summarizeAttendance(data || []) };
    } else if (path === "/documents/summary") {
      if (!requireScope("documents") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("documents").select("doc_type, doc_date, school_id");
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fromParam) q = q.gte("doc_date", fromParam);
      if (toParam) q = q.lte("doc_date", toParam);
      const { data } = await q.limit(20000);
      const byType: Record<string, number> = {};
      (data || []).forEach((r: any) => { byType[r.doc_type || "unknown"] = (byType[r.doc_type || "unknown"] || 0) + 1; });
      body = { school_id: schoolIdParam, from: fromParam, to: toParam, total: data?.length ?? 0, by_type: byType };
    } else if (path === "/reports/obec") {
      if (!requireScope("reports")) return json({ error: "scope_denied" }, 403);
      const schoolId = schoolIdParam;
      const lunchQ = supabase.from("school_lunch_records").select("id, record_date, students_served, total_cost, school_id").order("record_date", { ascending: false }).limit(100);
      const milkQ = supabase.from("school_milk_records").select("id, record_date, bottles_distributed, school_id").order("record_date", { ascending: false }).limit(100);
      const [lunch, milk] = await Promise.all([
        schoolId ? lunchQ.eq("school_id", schoolId) : lunchQ,
        schoolId ? milkQ.eq("school_id", schoolId) : milkQ,
      ]);
      body = {
        school_id: schoolId,
        obec: {
          school_lunch: lunch.data || [],
          school_milk: milk.data || [],
        },
      };
    } else if (path === "/reports/pp") {
      if (!requireScope("reports")) return json({ error: "scope_denied" }, 403);
      const schoolId = schoolIdParam;
      const academicYear = url.searchParams.get("academic_year");
      let q = supabase
        .from("enrollments")
        .select("student_id, subject_id, classroom_id, academic_year, semester, status, school_id")
        .order("academic_year", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (schoolId) q = q.eq("school_id", schoolId);
      if (academicYear) q = q.eq("academic_year", parseInt(academicYear, 10));
      const { data, count } = await q;
      body = {
        school_id: schoolId,
        academic_year: academicYear,
        page, page_size: pageSize, total: count ?? data?.length ?? 0,
        pp: { enrollments: data || [], count: data?.length ?? 0 },
      };
    } else if (path === "/news") {
      if (!requireScope("news") && !requireScope("*")) return json({ error: "scope_denied" }, 403);
      const since = url.searchParams.get("since");
      let q = supabase
        .from("news_posts")
        .select("id, title, content, category, is_pinned, published_at, created_at, updated_at, school_id", { count: "exact" })
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (since) q = q.gte("updated_at", since);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, news: data || [] };
    } else if (path === "/events") {
      if (!requireScope("events") && !requireScope("*")) return json({ error: "scope_denied" }, 403);
      let q = supabase
        .from("academic_events")
        .select("id, title, description, event_date, end_date, event_type, school_id")
        .order("event_date", { ascending: false })
        .limit(pageSize);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fromParam) q = q.gte("event_date", fromParam);
      if (toParam) q = q.lte("event_date", toParam);
      const { data } = await q;
      body = { school_id: schoolIdParam, events: data || [] };
    } else if (path === "/changes") {
      // Incremental change feed: returns rows updated_at >= since across whitelisted tables.
      // For central aggregator polling at any interval.
      const since = url.searchParams.get("since");
      if (!since) { statusCode = 400; body = { error: "missing_since", hint: "pass ?since=ISO-8601 timestamp" }; }
      else {
        const allow = ["students", "personnel", "schools", "classrooms", "subjects",
          "news_posts", "academic_events", "attendance", "documents", "enrollments",
          "behavior_records", "student_leaves", "health_records", "assets"];
        // Per-table column allow-list — strips PII (national_id, parent ids, phones, addresses, auth_user_id, symptoms/treatment, attachments, reasons)
        const columnMap: Record<string, string> = {
          students: "id, school_id, student_code, first_name, last_name, grade_level, classroom_id, gender, status, enrollment_date, updated_at",
          personnel: "id, school_id, first_name, last_name, position, department, status, updated_at",
          schools: "id, school_name, school_code, obec_code, province, district, sub_district, postcode, latitude, longitude, updated_at",
          classrooms: "id, school_id, name, grade_level, academic_year, homeroom_teacher_id, updated_at",
          subjects: "id, school_id, code, name, grade_level, credits, updated_at",
          news_posts: "id, school_id, title, content, category, is_pinned, is_published, published_at, updated_at",
          academic_events: "id, school_id, title, description, event_date, end_date, event_type, updated_at",
          attendance: "id, school_id, student_id, attendance_date, status, period, updated_at",
          documents: "id, school_id, title, doc_type, doc_number, doc_date, status, updated_at",
          enrollments: "id, school_id, student_id, classroom_id, academic_year, status, updated_at",
          behavior_records: "id, school_id, student_id, category, score, record_date, updated_at",
          student_leaves: "id, school_id, student_id, leave_type, start_date, end_date, status, updated_at",
          health_records: "id, school_id, student_id, record_type, recorded_at, updated_at",
          assets: "id, school_id, asset_code, name, category, status, acquired_at, updated_at",
        };
        const requested = (url.searchParams.get("tables") || "").split(",").map(s => s.trim()).filter(Boolean);
        const tables = requested.length ? requested.filter(t => allow.includes(t)) : allow;
        const result: Record<string, { count: number; rows: any[] }> = {};
        for (const t of tables) {
          if (!requireScope(t) && !requireScope("*")) continue;
          const cols = columnMap[t] || "id, school_id, updated_at";
          let q: any = supabase.from(t).select(cols, { count: "exact" })
            .gte("updated_at", since)
            .order("updated_at", { ascending: true })
            .limit(pageSize);
          if (schoolIdParam && ["students","personnel","schools","classrooms","news_posts","academic_events","documents","attendance","enrollments","assets"].includes(t)) {
            q = q.eq("school_id", schoolIdParam);
          }
          const { data, count, error } = await q;
          if (error) result[t] = { count: 0, rows: [] };
          else result[t] = { count: count ?? data?.length ?? 0, rows: data || [] };
        }
        body = { since, school_id: schoolIdParam, page_size: pageSize, tables: result, server_time: new Date().toISOString() };
      }
    } else if (path === "/test-scores") {
      // Standardized test scores: O-NET / NT / RT / PISA / อื่นๆ
      if (!requireScope("reports") && !requireScope("stats") && !requireScope("*")) return json({ error: "scope_denied" }, 403);
      const testType = url.searchParams.get("test_type"); // onet | nt | rt | pisa
      const academicYear = parseInt32(url.searchParams.get("academic_year"), 0, 0, 3000);
      let q = supabase.from("school_test_scores")
        .select("school_id, academic_year, test_type, grade_level, subject, avg_score, student_count, national_avg, area_avg, notes, updated_at", { count: "exact" })
        .order("academic_year", { ascending: false })
        .order("test_type")
        .order("subject")
        .range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (testType) q = q.eq("test_type", testType);
      if (academicYear) q = q.eq("academic_year", academicYear);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, scores: data || [] };
    } else if (path === "/test-scores/summary") {
      // Aggregated avg per test_type x subject for the latest year (or specified)
      if (!requireScope("reports") && !requireScope("stats") && !requireScope("*")) return json({ error: "scope_denied" }, 403);
      const academicYear = parseInt32(url.searchParams.get("academic_year"), 0, 0, 3000);
      let q = supabase.from("school_test_scores")
        .select("academic_year, test_type, grade_level, subject, avg_score, student_count, national_avg, area_avg")
        .limit(5000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (academicYear) q = q.eq("academic_year", academicYear);
      const { data } = await q;
      const rows = data || [];
      const years = [...new Set(rows.map((r: any) => r.academic_year))].sort((a, b) => b - a);
      const latestYear = academicYear || years[0] || null;
      const latest = rows.filter((r: any) => r.academic_year === latestYear);
      const byType: Record<string, any[]> = {};
      latest.forEach((r: any) => {
        const t = r.test_type || "other";
        (byType[t] = byType[t] || []).push(r);
      });
      const avgOf = (xs: number[]) => xs.length ? +(xs.reduce((s, n) => s + n, 0) / xs.length).toFixed(2) : null;
      const summary: any = {};
      for (const [t, arr] of Object.entries(byType)) {
        // Weighted by student_count only when provided (>0); otherwise fall back to simple average
        const weighted = arr.filter((r: any) => Number(r.student_count) > 0);
        let weightedAvg: number;
        if (weighted.length) {
          const totalScore = weighted.reduce((s: number, r: any) => s + Number(r.avg_score || 0) * Number(r.student_count), 0);
          const totalStudents = weighted.reduce((s: number, r: any) => s + Number(r.student_count), 0);
          weightedAvg = +(totalScore / totalStudents).toFixed(2);
        } else {
          weightedAvg = +(arr.reduce((s: number, r: any) => s + Number(r.avg_score || 0), 0) / arr.length).toFixed(2);
        }
        const natVals = arr.map((r: any) => r.national_avg).filter((v: any) => v != null).map(Number);
        const areaVals = arr.map((r: any) => r.area_avg).filter((v: any) => v != null).map(Number);
        summary[t] = {
          subjects: arr.length,
          weighted_avg: weightedAvg,
          national_avg: avgOf(natVals),
          area_avg: avgOf(areaVals),
          details: arr,
        };
      }
      body = { school_id: schoolIdParam, academic_year: latestYear, available_years: years, summary };
    } else if (path === "/projects" || path === "/hub-projects") {
      // Hub-funded special projects with budget summary
      if (!requireScope("reports") && !requireScope("projects") && !requireScope("*")) {
        return json({ error: "scope_denied" }, 403);
      }
      let q = supabase.from("hub_projects").select("*", { count: "exact" })
        .order("fiscal_year", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status);
      const year = url.searchParams.get("fiscal_year");
      if (year && /^\d{4}$/.test(year)) q = q.eq("fiscal_year", Number(year));
      const { data, count, error } = await q;
      if (error) throw error;
      body = { page, page_size: pageSize, total: count ?? 0, items: data || [] };
    } else if (path.startsWith("/projects/") || path.startsWith("/hub-projects/")) {
      if (!requireScope("reports") && !requireScope("projects") && !requireScope("*")) {
        return json({ error: "scope_denied" }, 403);
      }
      const pid = path.split("/").pop();
      if (!pid || !UUID_RE.test(pid)) {
        statusCode = 400; body = { error: "invalid_project_id" };
      } else {
        const [proj, upd, exp, bud] = await Promise.all([
          supabase.from("hub_projects").select("*").eq("id", pid).maybeSingle(),
          supabase.from("hub_project_updates").select("*").eq("project_id", pid).eq("is_published", true).order("update_date", { ascending: false }),
          supabase.from("hub_project_expenses").select("expense_date,category,amount,description,vendor,receipt_no").eq("project_id", pid).order("expense_date", { ascending: false }),
          supabase.from("hub_project_budgets").select("received_date,amount,source,reference_no").eq("project_id", pid).order("received_date", { ascending: false }),
        ]);
        if (!proj.data) { statusCode = 404; body = { error: "project_not_found" }; }
        else {
          const byCat: Record<string, number> = {};
          (exp.data || []).forEach((e: any) => {
            byCat[e.category || "อื่น ๆ"] = (byCat[e.category || "อื่น ๆ"] || 0) + Number(e.amount);
          });
          body = {
            project: proj.data,
            summary: {
              budget_received: Number(proj.data.budget_received || 0),
              budget_spent: Number(proj.data.budget_spent || 0),
              budget_remaining: Number(proj.data.budget_received || 0) - Number(proj.data.budget_spent || 0),
              expenses_by_category: byCat,
              updates_count: (upd.data || []).length,
              expenses_count: (exp.data || []).length,
            },
            updates: upd.data || [],
            expenses: exp.data || [],
            budgets: bud.data || [],
          };
        }
      }
    } else if (path === "/health/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const filterSid = (q: any) => schoolIdParam ? q.eq("school_id", schoolIdParam) : q;
      const [hr, hm, vac, scr] = await Promise.all([
        filterSid(supabase.from("health_records").select("id, record_type", { count: "exact" }).limit(5000)),
        filterSid(supabase.from("health_measurements").select("id, height_cm, weight_kg, bmi, measured_at").limit(20000)),
        filterSid(supabase.from("vaccine_records").select("id, vaccine_name").limit(5000)),
        filterSid(supabase.from("student_screenings").select("id, screening_type, result").limit(5000)),
      ]);
      const hmRows = hm.data || [];
      const bmis = hmRows.map((r: any) => Number(r.bmi)).filter((v: number) => Number.isFinite(v));
      const vacByName: Record<string, number> = {};
      (vac.data || []).forEach((r: any) => { vacByName[r.vaccine_name || "อื่น ๆ"] = (vacByName[r.vaccine_name || "อื่น ๆ"] || 0) + 1; });
      const scrByType: Record<string, number> = {};
      (scr.data || []).forEach((r: any) => { scrByType[r.screening_type || "อื่น ๆ"] = (scrByType[r.screening_type || "อื่น ๆ"] || 0) + 1; });
      body = {
        school_id: schoolIdParam,
        health: {
          records_total: hr.count ?? 0,
          measurements_total: hmRows.length,
          avg_bmi: bmis.length ? +(bmis.reduce((s, n) => s + n, 0) / bmis.length).toFixed(2) : null,
          vaccines_by_name: vacByName,
          screenings_by_type: scrByType,
        },
      };
    } else if (path === "/health/measurements") {
      if (!requireScope("*") && !requireScope("students") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("health_measurements").select("id, student_id, school_id, height_cm, weight_kg, bmi, measured_at, grade_level, term", { count: "exact" })
        .order("measured_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, measurements: data || [] };
    } else if (path === "/vaccines") {
      if (!requireScope("*") && !requireScope("students") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("vaccine_records").select("id, school_id, student_id, vaccine_name, dose_number, vaccinated_at, updated_at", { count: "exact" })
        .order("vaccinated_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, vaccines: data || [] };
    } else if (path === "/sdq/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("sdq_records").select("category, total_score, assessed_at").limit(20000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      const rows = data || [];
      const byCat: Record<string, number> = {};
      rows.forEach((r: any) => { byCat[r.category || "ไม่ระบุ"] = (byCat[r.category || "ไม่ระบุ"] || 0) + 1; });
      body = { school_id: schoolIdParam, sdq: { total: rows.length, by_category: byCat } };
    } else if (path === "/leaves/students") {
      if (!requireScope("*") && !requireScope("students") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("student_leaves").select("id, school_id, student_id, leave_type, start_date, end_date, status, updated_at", { count: "exact" })
        .order("start_date", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fromParam) q = q.gte("start_date", fromParam);
      if (toParam) q = q.lte("start_date", toParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, leaves: data || [] };
    } else if (path === "/leaves/staff") {
      if (!requireScope("*") && !requireScope("personnel") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("staff_leaves").select("id, school_id, user_id, leave_type, start_date, end_date, status, updated_at", { count: "exact" })
        .order("start_date", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fromParam) q = q.gte("start_date", fromParam);
      if (toParam) q = q.lte("start_date", toParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, leaves: data || [] };
    } else if (path === "/leaves/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const filterSid = (q: any) => schoolIdParam ? q.eq("school_id", schoolIdParam) : q;
      const [sl, tl] = await Promise.all([
        filterSid(supabase.from("student_leaves").select("status, leave_type").limit(10000)),
        filterSid(supabase.from("staff_leaves").select("status, leave_type").limit(5000)),
      ]);
      const agg = (rows: any[]) => {
        const out = { total: rows.length, approved: 0, pending: 0, rejected: 0, by_type: {} as Record<string, number> };
        rows.forEach((r: any) => {
          if (r.status === "approved") out.approved++;
          else if (r.status === "pending") out.pending++;
          else if (r.status === "rejected") out.rejected++;
          out.by_type[r.leave_type || "อื่น ๆ"] = (out.by_type[r.leave_type || "อื่น ๆ"] || 0) + 1;
        });
        return out;
      };
      body = { school_id: schoolIdParam, students: agg(sl.data || []), staff: agg(tl.data || []) };
    } else if (path === "/substitute/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("substitute_teaching").select("status, substitute_date").limit(10000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      const rows = data || [];
      const byStatus: Record<string, number> = {};
      rows.forEach((r: any) => { byStatus[r.status || "unknown"] = (byStatus[r.status || "unknown"] || 0) + 1; });
      body = { school_id: schoolIdParam, substitute: { total: rows.length, by_status: byStatus } };
    } else if (path === "/lunch/daily") {
      if (!requireScope("*") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("school_lunch_records").select("*", { count: "exact" })
        .order("record_date", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fromParam) q = q.gte("record_date", fromParam);
      if (toParam) q = q.lte("record_date", toParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, lunch: data || [] };
    } else if (path === "/milk/daily") {
      if (!requireScope("*") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("school_milk_records").select("*", { count: "exact" })
        .order("record_date", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fromParam) q = q.gte("record_date", fromParam);
      if (toParam) q = q.lte("record_date", toParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, milk: data || [] };
    } else if (path === "/procurement") {
      if (!requireScope("*") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("procurement_records").select("*", { count: "exact" })
        .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, items: data || [] };
    } else if (path === "/budget/transactions") {
      if (!requireScope("*") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      const fiscalYear = parseInt32(url.searchParams.get("fiscal_year"), 0, 2000, 3000);
      let q = supabase.from("budget_transactions").select("*", { count: "exact" })
        .order("transaction_date", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fiscalYear) q = q.eq("fiscal_year", fiscalYear);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, transactions: data || [] };
    } else if (path === "/salary/summary") {
      if (!requireScope("*") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("salary_records").select("gross_amount, net_amount, pay_period, paid_at").limit(20000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      const rows = data || [];
      body = {
        school_id: schoolIdParam,
        salary: {
          records: rows.length,
          gross_total: +rows.reduce((s, r: any) => s + Number(r.gross_amount || 0), 0).toFixed(2),
          net_total: +rows.reduce((s, r: any) => s + Number(r.net_amount || 0), 0).toFixed(2),
        },
      };
    } else if (path === "/assets/damage") {
      if (!requireScope("*") && !requireScope("assets")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("asset_damage_reports").select("*", { count: "exact" })
        .order("reported_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, damage_reports: data || [] };
    } else if (path === "/classrooms") {
      if (!requireScope("*") && !requireScope("schools") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("classrooms").select("*", { count: "exact" })
        .order("grade_level").range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, classrooms: data || [] };
    } else if (path === "/subjects") {
      if (!requireScope("*") && !requireScope("schools") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("subjects").select("*", { count: "exact" })
        .order("subject_code").range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, subjects: data || [] };
    } else if (path === "/schedules") {
      if (!requireScope("*") && !requireScope("schools")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("schedules").select("*", { count: "exact" })
        .order("day_of_week").range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, schedules: data || [] };
    } else if (path === "/exams/summary") {
      if (!requireScope("*") && !requireScope("reports") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const filterSid = (q: any) => schoolIdParam ? q.eq("school_id", schoolIdParam) : q;
      const [exRes, subRes] = await Promise.all([
        filterSid(supabase.from("exams").select("id, exam_type, status", { count: "exact" }).limit(5000)),
        filterSid(supabase.from("exam_submissions").select("id, score, status").limit(20000)),
      ]);
      const subs = subRes.data || [];
      const scores = subs.map((r: any) => Number(r.score)).filter((v: number) => Number.isFinite(v));
      body = {
        school_id: schoolIdParam,
        exams: {
          total: exRes.count ?? 0,
          submissions_total: subs.length,
          avg_score: scores.length ? +(scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(2) : null,
        },
      };
    } else if (path === "/homework/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("homework_assignments").select("id, status, due_date", { count: "exact" }).limit(10000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      const rows = data || [];
      const byStatus: Record<string, number> = {};
      rows.forEach((r: any) => { byStatus[r.status || "active"] = (byStatus[r.status || "active"] || 0) + 1; });
      body = { school_id: schoolIdParam, homework: { total: count ?? rows.length, by_status: byStatus } };
    } else if (path === "/admissions/summary") {
      if (!requireScope("*") && !requireScope("students") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("admissions").select("status, grade_level, academic_year").limit(10000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      const rows = data || [];
      const byStatus: Record<string, number> = {};
      const byGrade: Record<string, number> = {};
      rows.forEach((r: any) => {
        byStatus[r.status || "unknown"] = (byStatus[r.status || "unknown"] || 0) + 1;
        byGrade[r.grade_level || "unknown"] = (byGrade[r.grade_level || "unknown"] || 0) + 1;
      });
      body = { school_id: schoolIdParam, admissions: { total: rows.length, by_status: byStatus, by_grade: byGrade } };
    } else if (path === "/home-visits/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("home_visits").select("id, visit_date, status", { count: "exact" }).limit(10000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      const rows = data || [];
      const byStatus: Record<string, number> = {};
      rows.forEach((r: any) => { byStatus[r.status || "unknown"] = (byStatus[r.status || "unknown"] || 0) + 1; });
      body = { school_id: schoolIdParam, home_visits: { total: count ?? rows.length, by_status: byStatus } };
    } else if (path === "/pa/summary") {
      // Performance Agreement (PA / ID Plan)
      if (!requireScope("*") && !requireScope("personnel") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      const filterSid = (q: any) => schoolIdParam ? q.eq("school_id", schoolIdParam) : q;
      const [pa, id] = await Promise.all([
        filterSid(supabase.from("pa_agreements").select("id, status, fiscal_year", { count: "exact" }).limit(5000)),
        filterSid(supabase.from("id_plan_records").select("id, status", { count: "exact" }).limit(5000)),
      ]);
      body = {
        school_id: schoolIdParam,
        pa: { agreements_total: pa.count ?? 0, id_plans_total: id.count ?? 0 },
      };
    } else if (path === "/iot/devices") {
      if (!requireScope("*") && !requireScope("iot") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("iot_devices").select("id, name, description, device_type, icon, unit, source_type, entity_id, poll_interval_seconds, location, display_order, is_active, last_value, last_value_numeric, last_status, last_fetched_at, system_category, color, school_id, status, created_at, updated_at", { count: "exact" })
        .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const type = url.searchParams.get("device_type");
      if (type) q = q.eq("device_type", type);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, devices: data || [] };
    } else if (path === "/iot/readings") {
      if (!requireScope("*") && !requireScope("iot")) return json({ error: "scope_denied" }, 403);
      const deviceId = url.searchParams.get("device_id");
      let q = supabase.from("iot_readings").select("*", { count: "exact" })
        .order("recorded_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (deviceId && UUID_RE.test(deviceId)) q = q.eq("device_id", deviceId);
      if (fromParam) q = q.gte("recorded_at", fromParam);
      if (toParam) q = q.lte("recorded_at", toParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, readings: data || [] };
    } else if (path === "/iot/summary") {
      if (!requireScope("*") && !requireScope("iot") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("iot_devices").select("device_type, status").limit(10000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      const rows = data || [];
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      rows.forEach((r: any) => {
        byType[r.device_type || "อื่น ๆ"] = (byType[r.device_type || "อื่น ๆ"] || 0) + 1;
        byStatus[r.status || "unknown"] = (byStatus[r.status || "unknown"] || 0) + 1;
      });
      body = { school_id: schoolIdParam, iot: { devices_total: rows.length, by_type: byType, by_status: byStatus } };
    } else if (path === "/ict/devices") {
      if (!requireScope("*") && !requireScope("assets") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("ict_devices").select("*", { count: "exact" })
        .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, devices: data || [] };
    } else if (path === "/ict/loans") {
      if (!requireScope("*") && !requireScope("assets") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("ict_loans").select("*", { count: "exact" })
        .order("loan_date", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, loans: data || [] };
    } else if (path === "/special-rooms") {
      if (!requireScope("*") && !requireScope("schools") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("special_rooms").select("*", { count: "exact" })
        .order("room_name").range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, rooms: data || [] };
    } else if (path === "/subsidies/summary") {
      if (!requireScope("*") && !requireScope("stats") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("student_subsidies").select("subsidy_type, amount, fiscal_year").limit(20000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      const rows = data || [];
      const byType: Record<string, number> = {};
      let total = 0;
      rows.forEach((r: any) => {
        byType[r.subsidy_type || "อื่น ๆ"] = (byType[r.subsidy_type || "อื่น ๆ"] || 0) + Number(r.amount || 0);
        total += Number(r.amount || 0);
      });
      body = { school_id: schoolIdParam, subsidies: { records: rows.length, total_amount: +total.toFixed(2), by_type: byType } };
    } else if (path === "/early-childhood/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("early_childhood_dev").select("development_area, level").limit(10000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      const rows = data || [];
      const byArea: Record<string, Record<string, number>> = {};
      rows.forEach((r: any) => {
        const a = r.development_area || "อื่น ๆ"; const l = r.level || "-";
        byArea[a] = byArea[a] || {}; byArea[a][l] = (byArea[a][l] || 0) + 1;
      });
      body = { school_id: schoolIdParam, early_childhood: { records: rows.length, by_area: byArea } };
    } else if (path === "/action-plans") {
      if (!requireScope("*") && !requireScope("reports")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("action_plans").select("*", { count: "exact" })
        .order("fiscal_year", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const fy = url.searchParams.get("fiscal_year");
      if (fy && /^\d{4}$/.test(fy)) q = q.eq("fiscal_year", Number(fy));
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, plans: data || [] };
    } else if (path === "/evaluations/summary") {
      if (!requireScope("*") && !requireScope("personnel") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      const filterSid = (q: any) => schoolIdParam ? q.eq("school_id", schoolIdParam) : q;
      const [se, pe] = await Promise.all([
        filterSid(supabase.from("staff_evaluations").select("id, overall_score", { count: "exact" }).limit(5000)),
        filterSid(supabase.from("personnel_assessments").select("id, total_score", { count: "exact" }).limit(5000)),
      ]);
      const seScores = (se.data || []).map((r: any) => Number(r.overall_score)).filter((v: number) => Number.isFinite(v));
      const peScores = (pe.data || []).map((r: any) => Number(r.total_score)).filter((v: number) => Number.isFinite(v));
      const avg = (xs: number[]) => xs.length ? +(xs.reduce((s, n) => s + n, 0) / xs.length).toFixed(2) : null;
      body = {
        school_id: schoolIdParam,
        evaluations: {
          staff_evaluations_total: se.count ?? 0,
          staff_evaluations_avg: avg(seScores),
          personnel_assessments_total: pe.count ?? 0,
          personnel_assessments_avg: avg(peScores),
        },
      };
    } else if (path === "/pdpa/summary") {
      if (!requireScope("*") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("pdpa_consents").select("consent_type, status").limit(20000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const { data } = await q;
      const rows = data || [];
      const byType: Record<string, Record<string, number>> = {};
      rows.forEach((r: any) => {
        const t = r.consent_type || "อื่น ๆ"; const s = r.status || "unknown";
        byType[t] = byType[t] || {}; byType[t][s] = (byType[t][s] || 0) + 1;
      });
      body = { school_id: schoolIdParam, pdpa: { total: rows.length, by_type: byType } };
    } else if (path === "/face-scan/summary") {
      if (!requireScope("*") && !requireScope("attendance") && !requireScope("stats")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("face_scan_logs").select("status, scanned_at").limit(20000);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      if (fromParam) q = q.gte("scanned_at", fromParam);
      if (toParam) q = q.lte("scanned_at", toParam);
      const { data } = await q;
      const rows = data || [];
      const byStatus: Record<string, number> = {};
      rows.forEach((r: any) => { byStatus[r.status || "unknown"] = (byStatus[r.status || "unknown"] || 0) + 1; });
      body = { school_id: schoolIdParam, face_scan: { total: rows.length, by_status: byStatus } };
    } else if (path === "/social-posts") {
      if (!requireScope("*") && !requireScope("news")) return json({ error: "scope_denied" }, 403);
      let q = supabase.from("social_posts").select("id, source, message, posted_at, image_url, link_url, reactions_count, comments_count, shares_count, school_id", { count: "exact" })
        .order("posted_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (schoolIdParam) q = q.eq("school_id", schoolIdParam);
      const since = url.searchParams.get("since");
      if (since) q = q.gte("posted_at", since);
      const { data, count } = await q;
      body = { page, page_size: pageSize, total: count ?? 0, posts: data || [] };
    } else {
      statusCode = 404;
      body = { error: "endpoint_not_found", path };
    }
  } catch (err) {
    console.error("district-feed-api error:", err);
    statusCode = 500;
    body = { error: "internal_error", message: "An internal error occurred. Please contact support." };
  }

  // Audit log (fire-and-forget)
  supabase.from("district_feed_logs").insert({
    api_key_id: keyRow.id,
    endpoint: path,
    method: req.method,
    status_code: statusCode,
    ip_address: req.headers.get("x-forwarded-for") || null,
    query_params: Object.fromEntries(url.searchParams.entries()),
    response_size: JSON.stringify(body).length,
  }).then(() => {});

  // CSV export: ?format=csv on list endpoints
  const format = url.searchParams.get("format");
  if (format === "csv" && statusCode === 200 && body && typeof body === "object") {
    const b = body as any;
    const rows: any[] | null = b.students || b.personnel || b.news || b.events || b.items || null;
    if (rows && Array.isArray(rows) && rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const esc = (v: any) => {
        if (v == null) return "";
        const s = typeof v === "object" ? JSON.stringify(v) : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="district-feed-${Date.now()}.csv"`,
          "Cache-Control": "public, max-age=300",
        },
      });
    }
  }

  // Cache GET responses for 5 minutes (300s) — district queries change rarely
  const cacheable = statusCode === 200 && req.method === "GET";
  return json(body, statusCode, cacheable ? 300 : 0);
});

