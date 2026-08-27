// One-Stop API Gateway — unified read API for dashboard
// GET /onestop-api?module=all | attendance | grades | finance | library | bus | kiosk | students
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
      const { data, count } = await admin
        .from("face_scan_logs")
        .select("id, student_id, scan_date, scan_time", { count: "exact" })
        .eq("scan_date", today)
        .limit(500);
      return {
        date: today,
        total_today: count ?? data?.length ?? 0,
        sample: data ?? [],
      };
    };

    const fetchGrades = async () => {
      const { data } = await admin
        .from("student_scores")
        .select("total_score, grade, academic_year, semester")
        .limit(500);
      const rows = data ?? [];
      const scores = rows.map((r: any) => Number(r.total_score)).filter((n: number) => Number.isFinite(n));
      const avg = scores.length ? +(scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(2) : 0;
      const dist: Record<string, number> = {};
      rows.forEach((r: any) => { const g = r.grade ?? "-"; dist[g] = (dist[g] || 0) + 1; });
      return { count: rows.length, avg_score: avg, distribution: dist, sample: rows.slice(0, 5) };
    };

    const fetchFinance = async () => {
      const [budgetRes, pettyRes] = await Promise.all([
        admin.from("budget_transactions").select("amount, transaction_type, fiscal_year").limit(1000),
        admin.from("petty_cash").select("amount, type, date").limit(1000),
      ]);
      const bRows: any[] = (budgetRes as any).data ?? [];
      const pRows: any[] = (pettyRes as any).data ?? [];
      const income = bRows.filter((r) => r.transaction_type === "income").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const expense = bRows.filter((r) => r.transaction_type === "expense").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const pettyIn = pRows.filter((r) => r.type === "income" || r.type === "in").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const pettyOut = pRows.filter((r) => r.type === "expense" || r.type === "out").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      return {
        budget: { income_total: +income.toFixed(2), expense_total: +expense.toFixed(2), balance: +(income - expense).toFixed(2), count: bRows.length },
        petty_cash: { income_total: +pettyIn.toFixed(2), expense_total: +pettyOut.toFixed(2), balance: +(pettyIn - pettyOut).toFixed(2), count: pRows.length },
      };
    };

    const fetchLibrary = async () => {
      const [booksRes, loansRes] = await Promise.all([
        admin.from("library_books").select("id, copies_total, copies_available", { count: "exact" }).limit(200),
        admin.from("library_loans").select("id, returned_at, due_at", { count: "exact" }).limit(500),
      ]);
      const books: any[] = (booksRes as any).data ?? [];
      const loans: any[] = (loansRes as any).data ?? [];
      const totalCopies = books.reduce((s: number, b: any) => s + Number(b.copies_total || 0), 0);
      const availableCopies = books.reduce((s: number, b: any) => s + Number(b.copies_available || 0), 0);
      const activeLoans = loans.filter((l: any) => !l.returned_at).length;
      const overdue = loans.filter((l: any) => !l.returned_at && l.due_at && new Date(l.due_at) < new Date()).length;
      return {
        books_total: (booksRes as any).count ?? books.length,
        total_copies: totalCopies,
        available_copies: availableCopies,
        active_loans: activeLoans,
        overdue_loans: overdue,
        sample_books: books.slice(0, 3),
      };
    };

    const fetchBus = async () => {
      const { data, count } = await admin.from("bus_routes").select("id, name, is_active", { count: "exact" }).limit(100);
      const routes: any[] = data ?? [];
      const byStatus: Record<string, number> = {};
      routes.forEach((r: any) => { const s = r.is_active === false ? "inactive" : r.is_active === true ? "active" : "unknown"; byStatus[s] = (byStatus[s] || 0) + 1; });
      return { total_routes: count ?? routes.length, by_status: byStatus, sample: routes.slice(0, 5) };
    };

    const fetchKiosk = async () => {
      // kiosk heartbeat / face_scan kiosk status — best-effort, table may vary
      const { data, count } = await admin.from("students").select("id", { count: "exact", head: true });
      // use iot_devices or fallback to face_scan_logs count today as kiosk activity proxy
      let kioskDevices: any = { count: 0, rows: [] };
      try {
        const r = await admin.from("iot_devices").select("id, device_type, last_status, is_active").limit(50);
        kioskDevices = { count: (r as any).count ?? r.data?.length ?? 0, rows: r.data ?? [] };
      } catch (_) {
        // ignore if table missing
      }
      return { students_count: count ?? 0, devices: kioskDevices, generated_at };
    };

    const fetchStudents = async () => {
      const { count } = await admin.from("students").select("id", { count: "exact", head: true });
      return { total: count ?? 0 };
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

    // module=all — parallel with resilience via Promise.allSettled
    const settled = await Promise.allSettled([
      fetchStudents(),
      fetchAttendance(),
      fetchGrades(),
      fetchFinance(),
      fetchLibrary(),
      fetchBus(),
      fetchKiosk(),
    ]);

    const get = (i: number, fallback: any = null) => settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<any>).value : { error: (settled[i] as PromiseRejectedResult).reason?.message ?? String((settled[i] as PromiseRejectedResult).reason), fallback };

    const studentsVal = get(0, { total: 0 });
    const attendanceVal = get(1, { date: today, total_today: 0, sample: [] });
    const gradesVal = get(2, { count: 0, avg_score: 0, distribution: {} });
    const financeVal = get(3, { budget: { income_total: 0, expense_total: 0, balance: 0 }, petty_cash: { income_total: 0, expense_total: 0, balance: 0 } });
    const libraryVal = get(4, { books_total: 0 });
    const busVal = get(5, { total_routes: 0 });
    const kioskVal = get(6, { students_count: 0 });

    // keep spec's top-level shape: { attendance, grades, finance, library, bus, kiosk, generated_at }
    return json({
      students: studentsVal,
      attendance: attendanceVal,
      grades: gradesVal,
      finance: financeVal,
      library: libraryVal,
      bus: busVal,
      kiosk: kioskVal,
      generated_at,
    });
  } catch (e: any) {
    console.error("onestop-api error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
