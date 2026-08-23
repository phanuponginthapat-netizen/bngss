// BigData Warehouse Cron — nightly ETL into fact_* tables
// Sources: face_scan_logs -> fact_attendance, student_scores -> fact_grades, petty_cash/budget_transactions -> fact_finance
// Runs nightly via pg_cron or manual admin trigger. Uses upsert for idempotency.
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

  // Allow cron secret OR admin JWT (reuse simple check, keep code simple)
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedCron = req.headers.get("x-cron-secret");
  let authorized = false;
  if (cronSecret && providedCron && cronSecret === providedCron) authorized = true;

  const admin = makeAdmin();

  if (!authorized) {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.replace("Bearer ", "").trim();
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "director");
    if (!ok) return json({ error: "Forbidden — admin/director or cron secret required" }, 403);
  }

  try {
    const today = todayBangkokISO();
    const generated_at = new Date().toISOString();
    // ETL window: last 2 days to catch late inserts; limit to keep cron fast
    const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    // Fetch sources in parallel — use .limit as requested
    const [faceRes, gradesRes, pettyRes, budgetRes] = await Promise.all([
      admin.from("face_scan_logs").select("id, student_id, scan_date, scan_time, created_at").gte("scan_date", since).limit(5000),
      admin.from("student_scores").select("id, student_id, subject_id, total_score, grade, academic_year, semester, updated_at").gte("updated_at", since + "T00:00:00").limit(5000),
      admin.from("petty_cash").select("id, amount, type, date, description, created_at").gte("date", since).limit(5000),
      admin.from("budget_transactions").select("id, amount, transaction_type, category, transaction_date, created_at").gte("transaction_date", since).limit(5000),
    ]);

    // Prepare fact rows
    const faceRows: any[] = (faceRes as any).data ?? [];
    const gradeRows: any[] = (gradesRes as any).data ?? [];
    const pettyRows: any[] = (pettyRes as any).data ?? [];
    const budgetRows: any[] = (budgetRes as any).data ?? [];

    // face_scan_logs -> fact_attendance
    const factAttendance = faceRows.map((r: any) => ({
      id: r.id,
      student_id: r.student_id,
      scan_date: r.scan_date,
      scan_time: r.scan_time,
      source: "face_scan_logs",
      etl_at: generated_at,
    }));

    // student_scores -> fact_grades
    const factGrades = gradeRows.map((r: any) => ({
      id: r.id,
      student_id: r.student_id,
      subject_id: r.subject_id,
      total_score: r.total_score,
      grade: r.grade,
      academic_year: r.academic_year,
      semester: r.semester,
      source_updated_at: r.updated_at,
      etl_at: generated_at,
    }));

    // petty_cash + budget_transactions -> fact_finance (unified)
    const factFinancePetty = pettyRows.map((r: any) => ({
      id: `petty_${r.id}`,
      source_id: r.id,
      source_table: "petty_cash",
      amount: r.amount,
      type: r.type,
      category: r.description ?? null,
      transaction_date: r.date,
      etl_at: generated_at,
    }));
    const factFinanceBudget = budgetRows.map((r: any) => ({
      id: `budget_${r.id}`,
      source_id: r.id,
      source_table: "budget_transactions",
      amount: r.amount,
      type: r.transaction_type,
      category: r.category ?? null,
      transaction_date: r.transaction_date,
      etl_at: generated_at,
    }));
    const factFinance = [...factFinancePetty, ...factFinanceBudget];

    // Upsert with resilience — use Promise.allSettled so one missing table doesn't fail others
    async function upsertFact(table: string, rows: any[]) {
      if (rows.length === 0) return { table, inserted: 0, skipped: true };
      try {
        const { error, count } = await admin.from(table as any).upsert(rows, { onConflict: "id" } as any).select("id", { count: "exact", head: true });
        // Some Supabase versions return count null on upsert; fallback to rows.length on success
        if (error) throw error;
        return { table, inserted: count ?? rows.length, error: null };
      } catch (e: any) {
        // Table may not exist yet — return 0 but don't throw
        const msg = e?.message ?? String(e);
        if (/does not exist|relation.*not.*found|schema cache/i.test(msg)) {
          return { table, inserted: 0, error: msg, missing_table: true };
        }
        return { table, inserted: 0, error: msg };
      }
    }

    const results = await Promise.allSettled([
      upsertFact("fact_attendance", factAttendance),
      upsertFact("fact_grades", factGrades),
      upsertFact("fact_finance", factFinance),
    ]);

    const counts = {
      face_scan_logs: faceRows.length,
      student_scores: gradeRows.length,
      petty_cash: pettyRows.length,
      budget_transactions: budgetRows.length,
    };

    const etl = {
      fact_attendance: results[0].status === "fulfilled" ? results[0].value : { error: String((results[0] as any).reason) },
      fact_grades: results[1].status === "fulfilled" ? results[1].value : { error: String((results[1] as any).reason) },
      fact_finance: results[2].status === "fulfilled" ? results[2].value : { error: String((results[2] as any).reason) },
    };

    return json({
      ok: true,
      generated_at,
      window: { since, today },
      counts,
      etl,
      summary: {
        fact_attendance: (etl.fact_attendance as any)?.inserted ?? 0,
        fact_grades: (etl.fact_grades as any)?.inserted ?? 0,
        fact_finance: (etl.fact_finance as any)?.inserted ?? 0,
      },
    });
  } catch (e: any) {
    console.error("bigdata-warehouse-cron error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
