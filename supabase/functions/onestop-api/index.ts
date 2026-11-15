// One-Stop API Gateway — unified read API for dashboard
// GET /onestop-api?module=all | attendance | grades | finance | library | bus | kiosk | students
import { readAllRows } from "../_shared/readAllRows.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  summarizeGrading, summarizeFinance, summarizeLibrary,
} from "../_shared/aggregates.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function todayBangkokISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Only GET allowed
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  // Require admin JWT
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  try {
    const admin = makeAdmin();

    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized", details: userErr?.message }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "director");
    if (!isAdmin) return json({ error: "Forbidden — admin/director only" }, 403);

    const url = new URL(req.url);
    const mod = (url.searchParams.get("module") || "all").toLowerCase();
    const today = todayBangkokISO();
    const generated_at = new Date().toISOString();

    // fetchers — each keeps .limit for speed and to avoid large payloads
    const fetchAttendance = async () => {
      const { data, count, error } = await admin
        .from("face_scan_logs")
        .select("id, student_id, scan_date, scan_time", { count: "exact" })
        .eq("scan_date", today)
        .order("scan_time", {ascending:false}).order("id")
        .limit(500);
      if(error)throw error;
      return {
        date: today,
        total_today: count ?? data?.length ?? 0,
        sample: data ?? [],
      };
    };

    const fetchGrades = async () => {
      const rows = await readAllRows<any>((from,to) => admin.from('student_scores').select('id,total_score,grade,academic_year,semester').order('id').range(from,to));
      const g = summarizeGrading(rows);
      return {
        count: g.total_records,
        avg_score: g.average_score,
        distribution: g.grade_distribution,
        school_gpa: g.school_gpa,
        pass_rate: g.pass_rate,
        sample: rows.slice(0, 5),
      };
    };

    const fetchFinance = async () => {
      const budget = await readAllRows<any>((from,to) => admin.from('budget_transactions').select('id,amount,transaction_type,category,fiscal_year').order('id').range(from,to));
      const b = summarizeFinance(budget);
      return { budget: { income_total: b.income_total, expense_total: b.expense_total, balance: b.balance, count: b.count }, petty_cash: null };
    };

    const fetchLibrary = async () => {
      const [books, loans] = await Promise.all([
        readAllRows<any>((from,to) => admin.from('library_books').select('id,copies_total,copies_available').order('id').range(from,to)),
        readAllRows<any>((from,to) => admin.from('library_loans').select('id,returned_at,due_at').order('id').range(from,to)),
      ]);
      return { ...summarizeLibrary(books, loans, books.length), sample_books: books.slice(0,3) };
    };

    const fetchBus = async () => {
      const routes = await readAllRows<any>((from,to) => admin.from('bus_routes').select('id,name,is_active').order('id').range(from,to));
      const byStatus: Record<string, number> = {};
      routes.forEach((r: any) => { const s = r.is_active === false ? "inactive" : r.is_active === true ? "active" : "unknown"; byStatus[s] = (byStatus[s] || 0) + 1; });
      return { total_routes: routes.length, by_status: byStatus, sample: routes.slice(0, 5) };
    };

    const fetchKiosk = async () => {
      const { count, error } = await admin.from('students').select('id',{count:'exact',head:true});
      if (error || count === null) throw error ?? new Error('student count unavailable');
      const rows = await readAllRows<any>((from,to) => admin.from('kiosk_devices').select('id,name,device_id,status,is_active,last_seen_at').order('id').range(from,to));
      return { students_count: count, devices: { count: rows.length, rows }, generated_at };
    };

    const fetchStudents = async () => {
      const { count, error } = await admin.from('students').select('id',{count:'exact',head:true});
      if (error || count === null) throw error ?? new Error('student count unavailable');
      return { total: count };
    };

    // single-module fast path
    if (mod !== "all") {
      let result: any = null;
      switch (mod) {
        case "attendance": result = await fetchAttendance(); return json({ attendance: result, generated_at });
        case "grades": result = await fetchGrades(); return json({ grades: result, generated_at });
        case "finance": result = await fetchFinance(); return json({ finance: result, generated_at });
        case "library": result = await fetchLibrary(); return json({ library: result, generated_at });
        case "bus": result = await fetchBus(); return json({ bus: result, generated_at });
        case "kiosk": result = await fetchKiosk(); return json({ kiosk: result, generated_at });
        case "students": result = await fetchStudents(); return json({ students: result, generated_at });
        default: return json({ error: "invalid_module", allowed: ["all","attendance","grades","finance","library","bus","kiosk","students"] }, 400);
      }
    }

    // module=all
    // source=auto (ค่าเริ่มต้น) → ใช้ snapshot รายคืนถ้ายังสด (<25 ชม.) สำหรับตัวเลขสะสม
    // (นักเรียน/ผลการเรียน/การเงิน) แล้วดึงสดเฉพาะข้อมูล "วันนี้" — ลดภาระ DB อย่างมาก
    // The removed district hub is not an authoritative school cache.
    // A failed dependent read must fail the response, never render fallback zeros.
    const [students,attendance,grades,finance,library,bus,kiosk] = await Promise.all([
      fetchStudents(),fetchAttendance(),fetchGrades(),fetchFinance(),fetchLibrary(),fetchBus(),fetchKiosk(),
    ]);
    return json({ students,attendance,grades,finance,library,bus,kiosk,source:'live',snapshot_generated_at:null,generated_at });

  } catch (e: any) {
    console.error("onestop-api error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
