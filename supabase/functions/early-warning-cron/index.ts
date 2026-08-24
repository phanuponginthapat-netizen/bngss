// Early-warning sweep: recomputes dropout-risk for every active student using
// set-based queries (fast), stores the snapshot in `early_warnings` and pings
// admins with a summary. Runs daily via pg_cron and manually from the admin UI.
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeadersWithCron } from "../_shared/cors.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { fanout } from "../_shared/fanout.ts";

const corsHeaders = corsHeadersWithCron;

const ATTENDANCE_THRESHOLD = 80;
const BEHAVIOR_THRESHOLD = 3;
const SDQ_HIGH = 17;
const SDQ_BORDERLINE = 14;
const WINDOW_DAYS = 90;

type Agg = {
  present: number;
  total: number;
  negatives: number;
  remediation: number;
  sdq: number | null;
};

async function pageAll(query: (from: number, to: number) => any, pageSize = 1000): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const admin = makeAdmin();
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);

    const students = await pageAll((from, to) =>
      admin.from("students")
        .select("id, student_code, prefix, first_name, last_name, classroom_id")
        .eq("status", "active")
        .range(from, to));

    if (students.length === 0) return json({ students: 0, high: 0, medium: 0, low: 0 });

    const agg = new Map<string, Agg>();
    for (const s of students) agg.set(s.id, { present: 0, total: 0, negatives: 0, remediation: 0, sdq: null });

    // attendance in window
    const attendance = await pageAll((from, to) =>
      admin.from("attendance").select("student_id, status").gte("attendance_date", since).range(from, to));
    for (const a of attendance) {
      const row = agg.get(a.student_id);
      if (!row) continue;
      row.total++;
      if (["present", "late", "leave", "excused"].includes(String(a.status))) row.present++;
    }

    // negative behaviour in window
    const behavior = await pageAll((from, to) =>
      admin.from("behavior_records").select("student_id, behavior_type, created_at")
        .eq("behavior_type", "negative").gte("created_at", since).range(from, to));
    for (const b of behavior) {
      const row = agg.get(b.student_id);
      if (row) row.negatives++;
    }

    // unresolved remediation (0 / ร / มส / มผ)
    try {
      const remediation = await pageAll((from, to) =>
        admin.from("grade_remediation").select("student_id, original_grade, status")
          .in("original_grade", ["0", "ร", "มส", "มผ"]).neq("status", "ผ่าน").range(from, to));
      for (const r of remediation) {
        const row = agg.get(r.student_id);
        if (row) row.remediation++;
      }
    } catch { /* table optional */ }

    // latest SDQ per student
    try {
      const sdq = await pageAll((from, to) =>
        admin.from("sdq_records").select("student_id, total_difficulty, created_at")
          .order("created_at", { ascending: false }).range(from, to));
      for (const s of sdq) {
        const row = agg.get(s.student_id);
        if (row && row.sdq === null && typeof s.total_difficulty === "number") row.sdq = s.total_difficulty;
      }
    } catch { /* table optional */ }

    const now = new Date().toISOString();
    const rows: any[] = [];
    const counts = { high: 0, medium: 0, low: 0 };

    for (const s of students) {
      const a = agg.get(s.id)!;
      const reasons: string[] = [];
      let score = 0;
      const rate = a.total > 0 ? Math.round((a.present / a.total) * 1000) / 10 : null;

      if (rate !== null && a.total >= 10 && rate < ATTENDANCE_THRESHOLD) {
        score += 1;
        reasons.push(`มาเรียน ${rate}% (ต่ำกว่า ${ATTENDANCE_THRESHOLD}%)`);
      }
      if (a.remediation > 0) {
        score += 1;
        reasons.push(`ติด 0/ร/มส/มผ ${a.remediation} รายวิชา`);
      }
      if (a.negatives >= BEHAVIOR_THRESHOLD) {
        score += 1;
        reasons.push(`พฤติกรรมเชิงลบ ${a.negatives} ครั้ง`);
      }
      if (a.sdq !== null && a.sdq >= SDQ_HIGH) {
        score += 1;
        reasons.push(`SDQ ${a.sdq} — มีปัญหา`);
      } else if (a.sdq !== null && a.sdq >= SDQ_BORDERLINE) {
        reasons.push(`SDQ ${a.sdq} — เสี่ยง`);
      }

      const riskLevel = score >= 3 ? "high" : score >= 2 ? "medium" : "low";
      counts[riskLevel]++;
      if (riskLevel === "low") continue;

      rows.push({
        student_id: s.id,
        risk_level: riskLevel,
        reasons,
        score,
        details: {
          attendanceRate: rate,
          totalAttendanceDays: a.total,
          remediationCount: a.remediation,
          behaviorNegativeCount: a.negatives,
          sdqTotal: a.sdq,
        },
        calculated_at: now,
        notified: false,
      });
    }

    if (!dryRun && rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from("early_warnings").insert(rows.slice(i, i + 500));
        if (error) throw new Error(error.message);
      }
      if (counts.high > 0) {
        fanout({
          roles: ["admin", "director"],
          title: "ระบบเตือนภัยล่วงหน้า",
          body: `พบนักเรียนเสี่ยงสูง ${counts.high} คน และเสี่ยงปานกลาง ${counts.medium} คน`,
          type: "early_warning",
          severity: "warning",
          url: "/dashboard/admin/early-warning",
          dedup_key: `early-warning-${now.slice(0, 10)}`,
        }, admin).catch(() => {});
      }
    }

    return json({ students: students.length, dryRun, saved: dryRun ? 0 : rows.length, ...counts });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
