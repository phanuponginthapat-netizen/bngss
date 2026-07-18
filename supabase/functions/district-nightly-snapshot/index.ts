import { isAuthorizedCron, unauthorized } from "../_shared/cronAuth.ts";
// District Nightly Snapshot — runs at night (cron) to pre-compute comprehensive
// per-school payloads. Stored in public.district_snapshots so the central hub
// can read /snapshot/cached without hitting live tables.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isAuthorizedCron(req))) return unauthorized();


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Only schools that consented to central hub feed
    const { data: schools } = await supabase
      .from("schools")
      .select("id, school_name, school_code, obec_code, province, district, latitude, longitude")
      .eq("is_active", true)
      .eq("central_hub_consent", true);

    const results: Array<{ school_id: string | null; ok: boolean; error?: string }> = [];
    const today = new Date().toISOString().slice(0, 10);
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

        const byGrade: Record<string, number> = {};
        const byGender = { male: 0, female: 0, other: 0 };
        let specialNeeds = 0;
        sRows.forEach((s: any) => {
          if (s.status !== "active") return;
          byGrade[s.grade_level || "unknown"] = (byGrade[s.grade_level || "unknown"] || 0) + 1;
          if (s.gender === "ชาย" || s.gender === "male") byGender.male++;
          else if (s.gender === "หญิง" || s.gender === "female") byGender.female++;
          else byGender.other++;
          if (s.is_special_needs) specialNeeds++;
        });

        const gradeDist: Record<string, number> = {};
        let sum = 0, cnt = 0, pass = 0, fail = 0;
        scoreRows.forEach((r: any) => {
          gradeDist[r.grade || "-"] = (gradeDist[r.grade || "-"] || 0) + 1;
          const ts = Number(r.total_score);
          if (Number.isFinite(ts)) { sum += ts; cnt++; if (ts >= 50) pass++; else fail++; }
        });
        const gpaMap: Record<string, number> = { "4": 4, "3.5": 3.5, "3": 3, "2.5": 2.5, "2": 2, "1.5": 1.5, "1": 1, "0": 0 };
        let gpaSum = 0, gpaN = 0;
        Object.entries(gradeDist).forEach(([g, n]) => {
          if (gpaMap[g] !== undefined) { gpaSum += gpaMap[g] * n; gpaN += n; }
        });

        const attSummary = { present: 0, absent: 0, late: 0, leave: 0, total: attRows.length };
        attRows.forEach((r: any) => {
          if (r.status === "present") attSummary.present++;
          else if (r.status === "absent") attSummary.absent++;
          else if (r.status === "late") attSummary.late++;
          else if (r.status === "leave") attSummary.leave++;
        });

        const behSummary = {
          total: behRows.length,
          positive: behRows.filter((r: any) => r.behavior_type === "positive").length,
          negative: behRows.filter((r: any) => r.behavior_type === "negative").length,
        };

        const income = budRows.filter((r: any) => r.transaction_type === "income").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const expense = budRows.filter((r: any) => r.transaction_type === "expense").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const procTotal = procRows.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

        const assetByCat: Record<string, number> = {};
        const assetByStatus: Record<string, number> = {};
        assetRows.forEach((a: any) => {
          assetByCat[a.asset_category || "อื่น ๆ"] = (assetByCat[a.asset_category || "อื่น ๆ"] || 0) + 1;
          assetByStatus[a.status || "unknown"] = (assetByStatus[a.status || "unknown"] || 0) + 1;
        });

        const payload = {
          snapshot_version: "2.0",
          generated_at: new Date().toISOString(),
          snapshot_date: today,
          school: s,
          kpi: {
            students: {
              total: students.count ?? sRows.length,
              active: sRows.filter((r: any) => r.status === "active").length,
              by_grade: byGrade,
              by_gender: byGender,
              special_needs: specialNeeds,
            },
            personnel: {
              total: personnel.count ?? pRows.length,
              active: pRows.filter((r: any) => r.status === "active").length,
              by_rank: pRows.reduce((acc: any, p: any) => {
                const k = p.academic_rank || "ไม่ระบุ"; acc[k] = (acc[k] || 0) + 1; return acc;
              }, {}),
            },
            classrooms: classrooms.count ?? (classrooms.data || []).length,
            subjects: subjects.count ?? 0,
          },
          grading: {
            year, total_records: scoreRows.length,
            grade_distribution: gradeDist,
            average_score: cnt ? +(sum / cnt).toFixed(2) : 0,
            school_gpa: gpaN ? +(gpaSum / gpaN).toFixed(2) : 0,
            pass_count: pass, fail_count: fail,
            pass_rate: (pass + fail) ? +((pass / (pass + fail)) * 100).toFixed(2) : 0,
          },
          attendance: attSummary,
          behavior: behSummary,
          leaves: {
            total: leaveRows.length,
            approved: leaveRows.filter((r: any) => r.status === "approved").length,
            pending: leaveRows.filter((r: any) => r.status === "pending").length,
            rejected: leaveRows.filter((r: any) => r.status === "rejected").length,
          },
          finance: {
            fiscal_year: year,
            income_total: +income.toFixed(2),
            expense_total: +expense.toFixed(2),
            balance: +(income - expense).toFixed(2),
            procurement_total: +procTotal.toFixed(2),
            procurement_count: procRows.length,
          },
          assets: {
            total: assets.count ?? assetRows.length,
            by_category: assetByCat,
            by_status: assetByStatus,
          },
          welfare: {
            health_visits: (health.data || []).length,
            sdq_records: (sdq.data || []).length,
            home_visits: (homeVisits.data || []).length,
          },
          projects: {
            total: projects.count ?? projRows.length,
            budget_received_total: projRows.reduce((s: number, r: any) => s + Number(r.budget_received || 0), 0),
            budget_spent_total: projRows.reduce((s: number, r: any) => s + Number(r.budget_spent || 0), 0),
            by_status: projRows.reduce((acc: any, r: any) => {
              const k = r.status || "unknown"; acc[k] = (acc[k] || 0) + 1; return acc;
            }, {}),
          },
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

    return new Response(JSON.stringify({ ok: true, ran_at: new Date().toISOString(), count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
