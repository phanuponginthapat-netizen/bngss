// District Nightly Snapshot — runs at night (cron) to pre-compute comprehensive
// per-school payloads. Stored in public.district_snapshots so the central hub
// can read /snapshot/cached without hitting live tables.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";

import { corsHeadersWithCron as corsHeaders } from "../_shared/cors.ts";
import { todayBangkokISO } from "../_shared/thaiDate.ts";
import {
  summarizeStudents, summarizePersonnel, summarizeGrading, summarizeAttendance,
  summarizeBehavior, summarizeLeaves, summarizeFinance, summarizeAssets,
  summarizeWelfare, summarizeProjects,
} from "../_shared/aggregates.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const runStart = Date.now();
  const startedAt = new Date().toISOString();
  const { data: runRow } = await supabase
    .from("district_snapshot_runs")
    .insert({ status: "running", started_at: startedAt, triggered_by: "cron" })
    .select("id")
    .single();
  const runId = runRow?.id as string | undefined;

  try {
    // Only schools that consented to central hub feed
    const { data: schools } = await supabase
      .from("schools")
      .select("id, school_name, school_code, obec_code, province, district, latitude, longitude")
      .eq("is_active", true)
      .eq("central_hub_consent", true);

    const results: Array<{ school_id: string | null; ok: boolean; error?: string }> = [];
    const today = todayBangkokISO();
    const year = new Date().getFullYear();

    const targets = schools && schools.length > 0
      ? schools
      : [{ id: null, school_name: "ALL", school_code: null, obec_code: null }];

    for (const s of targets) {
      try {
        const sid = s.id as string | null;
        const fSid = (q: any) => sid ? q.eq("school_id", sid) : q;

        const [
          students, personnel, classrooms, subjects,
          scores, attendance, behavior, leaves,
          procurement, budget, assets,
          news, events, health, sdq, homeVisits,
          projects,
        ] = await Promise.all([
          fSid(supabase.from("students").select("id,status,gender,grade_level,is_special_needs", { count: "exact" }).limit(50000)),
          fSid(supabase.from("personnel").select("id,status,position,academic_rank,gender", { count: "exact" }).limit(5000)),
          fSid(supabase.from("classrooms").select("id,grade_level", { count: "exact" }).limit(500)),
          fSid(supabase.from("subjects").select("id", { count: "exact", head: true })),
          fSid(supabase.from("student_scores").select("grade,total_score,academic_year").gte("academic_year", year - 1).limit(50000)),
          fSid(supabase.from("attendance").select("status,attendance_date").gte("attendance_date", `${year}-01-01`).limit(50000)),
          fSid(supabase.from("behavior_records").select("behavior_type,points,record_date").gte("record_date", `${year}-01-01`).limit(20000)),
          fSid(supabase.from("student_leaves").select("status,leave_type,start_date").gte("start_date", `${year}-01-01`).limit(10000)),
          fSid(supabase.from("procurement_records").select("total_amount,status,created_at").gte("created_at", `${year}-01-01`).limit(5000)),
          fSid(supabase.from("budget_transactions").select("transaction_type,amount,fiscal_year").eq("fiscal_year", year).limit(10000)),
          fSid(supabase.from("assets").select("id,status,asset_category", { count: "exact" }).limit(10000)),
          fSid(supabase.from("news_posts").select("id,title,published_at,is_pinned").eq("is_published", true).order("published_at", { ascending: false }).limit(20)),
          fSid(supabase.from("academic_events").select("id,title,event_date,event_type").order("event_date", { ascending: false }).limit(20)),
          fSid(supabase.from("health_records").select("id,visit_date").gte("visit_date", `${year}-01-01`).limit(10000)),
          fSid(supabase.from("sdq_records").select("id,category,assessed_at").limit(5000)),
          fSid(supabase.from("home_visits").select("id,visit_date").gte("visit_date", `${year}-01-01`).limit(5000)),
          fSid(supabase.from("hub_projects").select("id,status,budget_received,budget_spent,fiscal_year", { count: "exact" }).limit(500)),
        ]);

        const sRows = students.data || [];
        const pRows = personnel.data || [];
        const scoreRows = scores.data || [];
        const attRows = attendance.data || [];
        const behRows = behavior.data || [];
        const leaveRows = leaves.data || [];
        const procRows = procurement.data || [];
        const budRows = budget.data || [];
        const assetRows = assets.data || [];
        const projRows = projects.data || [];

        const grading = summarizeGrading(scoreRows);
        const finance = summarizeFinance(budRows, procRows);

        const payload = {
          snapshot_version: "2.0",
          generated_at: new Date().toISOString(),
          snapshot_date: today,
          school: s,
          kpi: {
            students: summarizeStudents(sRows, students.count),
            personnel: summarizePersonnel(pRows, personnel.count),
            classrooms: classrooms.count ?? (classrooms.data || []).length,
            subjects: subjects.count ?? 0,
          },
          grading: { year, ...grading },
          attendance: summarizeAttendance(attRows),
          behavior: summarizeBehavior(behRows),
          leaves: summarizeLeaves(leaveRows),
          finance: {
            fiscal_year: year,
            income_total: finance.income_total,
            expense_total: finance.expense_total,
            balance: finance.balance,
            expense_by_category: finance.expense_by_category,
            procurement_total: finance.procurement_total,
            procurement_count: finance.procurement_count,
          },
          assets: summarizeAssets(assetRows, assets.count),
          welfare: {
            ...summarizeWelfare({
              healthCount: (health.data || []).length,
              homeVisitCount: (homeVisits.data || []).length,
              sdqRows: sdq.data || [],
            }),
            sdq_records: (sdq.data || []).length,
          },
          projects: summarizeProjects(projRows, projects.count),
          activities: {
            recent_news: news.data || [],
            recent_events: events.data || [],
          },
        };

        const { error: upErr } = await supabase
          .from("district_snapshots")
          .upsert(
            { school_id: sid, snapshot_date: today, snapshot_type: "nightly", payload, generated_at: new Date().toISOString() },
            { onConflict: "school_id,snapshot_date,snapshot_type" } as any,
          );
        if (upErr) {
          // Fallback insert (handles unique index quirks)
          await supabase.from("district_snapshots").insert({ school_id: sid, snapshot_date: today, snapshot_type: "nightly", payload });
        }
        results.push({ school_id: sid, ok: true });
      } catch (e) {
        results.push({ school_id: s.id ?? null, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const failed = results.filter((r) => !r.ok).length;
    const status = failed === 0 ? "success" : (failed === results.length ? "failed" : "partial");
    if (runId) {
      await supabase.from("district_snapshot_runs").update({
        status,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - runStart,
        schools_processed: results.length,
        schools_failed: failed,
        results,
      }).eq("id", runId);
    }

    // Enqueue outbox delivery to district hub for each successful snapshot
    try {
      const hubUrl = Deno.env.get("DISTRICT_HUB_URL");
      if (hubUrl) {
        for (const r of results.filter((x) => x.ok)) {
          await supabase.rpc("district_outbox_enqueue", {
            p_endpoint: `${hubUrl.replace(/\/$/, "")}/snapshot`,
            p_payload: { school_id: r.school_id, snapshot_date: today },
            p_snapshot_id: null,
            p_max_attempts: 5,
          });
        }
      }
    } catch (_) { /* non-fatal */ }

    return new Response(JSON.stringify({ ok: true, run_id: runId, ran_at: new Date().toISOString(), count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (runId) {
      await supabase.from("district_snapshot_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - runStart,
        error: err instanceof Error ? err.message : String(err),
      }).eq("id", runId);
    }
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
