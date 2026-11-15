// BigData Warehouse Cron — nightly ETL into fact_* tables
// Sources: gate scan evidence, stored student-code scores and managed budget transactions
// Runs nightly via pg_cron or manual admin trigger. Uses upsert for idempotency.
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { readAllRows } from "./readSources.ts";
import { mapWarehouseFacts } from "./mapFacts.ts";
import { authorizeCaller, ADMIN_ROLES } from "../_shared/callerAuth.ts";

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

  const caller = await authorizeCaller(req, corsHeaders, { roles: ADMIN_ROLES, allowCron: true });
  if (caller instanceof Response) return caller;
  const admin = makeAdmin();

  try {
    const today = todayBangkokISO();
    const generated_at = new Date().toISOString();
    // ETL window: last 2 days to catch late inserts; limit to keep cron fast
    const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    // Deterministic paging; a failed source aborts before any fact writes.
    const [faceRows, gradeRows, budgetRows] = await Promise.all([
      readAllRows<any>((from, to) => admin.from("face_scan_logs").select("id,student_id,scan_date,scan_time,scan_type,entry_method").gte("scan_date", since).order("id").range(from, to)),
      readAllRows<any>((from, to) => admin.from("student_scores").select("id,student_code,subject_id,total_score,grade,grade_point,academic_year,semester,updated_at").gte("updated_at", since + "T00:00:00").order("id").range(from, to)),
      readAllRows<any>((from, to) => admin.from("budget_transactions").select("id,amount,transaction_type,category,transaction_date").gte("transaction_date", since).order("id").range(from, to)),
    ]);
    const facts = mapWarehouseFacts(faceRows, gradeRows, budgetRows, generated_at);
    const factAttendance = facts.attendance;
    const factGrades = facts.grades;
    const factFinance = facts.finance;
    // Check every destination even when the current window has no rows.
    await Promise.all(["fact_attendance", "fact_grades", "fact_finance"].map(async table => {
      const { error } = await admin.from(table).select("id").limit(1);
      if (error) throw error;
    }));

    // Upsert with resilience — use Promise.allSettled so one missing table doesn't fail others
    async function upsertFact(table: string, rows: any[]) {
      if (rows.length === 0) return { table, inserted: 0, skipped: true };
      try {
        let inserted = 0;
        for (let offset = 0; offset < rows.length; offset += 500) {
          const batch = rows.slice(offset, offset + 500);
          const { error } = await admin.from(table as any).upsert(batch, { onConflict: "id" });
          if (error) throw error;
          inserted += batch.length;
        }
        return { table, inserted, error: null };
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
      budget_transactions: budgetRows.length,
    };

    const etl = {
      fact_attendance: results[0].status === "fulfilled" ? results[0].value : { error: String((results[0] as any).reason) },
      fact_grades: results[1].status === "fulfilled" ? results[1].value : { error: String((results[1] as any).reason) },
      fact_finance: results[2].status === "fulfilled" ? results[2].value : { error: String((results[2] as any).reason) },
    };

    const ok = Object.values(etl).every(result => !result.error);
    return json({
      ok,
      generated_at,
      window: { since, today },
      counts,
      etl,
      summary: {
        fact_attendance: (etl.fact_attendance as any)?.inserted ?? 0,
        fact_grades: (etl.fact_grades as any)?.inserted ?? 0,
        fact_finance: (etl.fact_finance as any)?.inserted ?? 0,
      },
    }, ok ? 200 : 500);
  } catch (e: any) {
    console.error("bigdata-warehouse-cron error:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
