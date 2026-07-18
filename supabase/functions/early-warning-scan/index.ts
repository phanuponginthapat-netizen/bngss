// Early Warning AI scanner
// Scans attendance + grade data and creates early_warning_alerts for at-risk students.
// Callable by: cron (x-cron-secret) OR signed-in admin/director.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { isAuthorizedAdminOrCron, unauthorized } from '../_shared/cronAuth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Factors {
  absent_days?: number;
  late_days?: number;
  attendance_rate?: number;
  failing_subjects?: number;
  avg_score?: number;
}

function classify(score: number): { severity: string; status: string } {
  if (score >= 75) return { severity: 'critical', status: 'open' };
  if (score >= 50) return { severity: 'high', status: 'open' };
  if (score >= 25) return { severity: 'medium', status: 'open' };
  return { severity: 'low', status: 'open' };
}

function buildRecommendation(f: Factors): string {
  const tips: string[] = [];
  if ((f.absent_days ?? 0) >= 5) tips.push('ติดต่อผู้ปกครองเรื่องการขาดเรียน');
  if ((f.late_days ?? 0) >= 5) tips.push('พูดคุยเรื่องการมาสาย');
  if ((f.failing_subjects ?? 0) >= 2) tips.push('จัดสอนซ่อมเสริม/ติวเพิ่ม');
  if ((f.avg_score ?? 100) < 50) tips.push('ประเมินความเข้าใจรายวิชาและส่งครูแนะแนว');
  if (!tips.length) tips.push('เฝ้าระวังต่อเนื่อง');
  return tips.join(' • ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!(await isAuthorizedAdminOrCron(req))) return unauthorized();

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const today = new Date();
    const since = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    const { data: students, error: sErr } = await sb
      .from('students')
      .select('id, school_id, student_code, first_name, last_name, status')
      .eq('status', 'active')
      .limit(5000);
    if (sErr) throw sErr;

    let createdCount = 0;
    const alerts: any[] = [];

    for (const stu of students ?? []) {
      // Attendance last 30 days
      const { data: att } = await sb
        .from('attendance')
        .select('status, attendance_date')
        .eq('student_id', stu.id)
        .gte('attendance_date', since);

      const totalAtt = att?.length ?? 0;
      const absent = att?.filter((a: any) => a.status === 'absent').length ?? 0;
      const late = att?.filter((a: any) => a.status === 'late').length ?? 0;
      const present = att?.filter((a: any) => a.status === 'present').length ?? 0;
      const attendanceRate = totalAtt ? Math.round((present / totalAtt) * 100) : 100;

      // Scores
      const { data: scores } = await sb
        .from('student_scores')
        .select('total_score, grade')
        .eq('student_code', stu.student_code ?? '___none___');

      const validScores = (scores ?? []).filter((s: any) => s.total_score != null);
      const avgScore = validScores.length
        ? validScores.reduce((a: number, b: any) => a + Number(b.total_score), 0) / validScores.length
        : 100;
      const failing = validScores.filter((s: any) =>
        Number(s.total_score) < 50 || s.grade === '0' || s.grade === 'ร' || s.grade === 'มผ'
      ).length;

      // Risk score 0-100
      let risk = 0;
      if (absent >= 3) risk += Math.min(40, absent * 5);
      if (late >= 3) risk += Math.min(15, late * 2);
      if (attendanceRate < 80) risk += (80 - attendanceRate);
      if (avgScore < 60) risk += (60 - avgScore);
      if (failing >= 1) risk += failing * 8;
      risk = Math.min(100, Math.round(risk));

      if (risk < 25) continue; // skip safe students

      const factors: Factors = {
        absent_days: absent,
        late_days: late,
        attendance_rate: attendanceRate,
        failing_subjects: failing,
        avg_score: Math.round(avgScore * 10) / 10,
      };

      const alertType = failing >= 2 ? 'academic' : (absent >= 5 ? 'attendance' : 'mixed');
      const { severity, status } = classify(risk);

      alerts.push({
        school_id: stu.school_id,
        student_id: stu.id,
        alert_type: alertType,
        severity,
        risk_score: risk,
        factors,
        recommendation: buildRecommendation(factors),
        status,
        generated_at: new Date().toISOString(),
      });
    }

    if (alerts.length) {
      // Resolve previous open alerts for these students, then insert fresh
      const studentIds = alerts.map(a => a.student_id);
      await sb.from('early_warning_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .in('student_id', studentIds)
        .eq('status', 'open');

      const { error: insErr, count } = await sb
        .from('early_warning_alerts')
        .insert(alerts, { count: 'exact' });
      if (insErr) throw insErr;
      createdCount = count ?? alerts.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: students?.length ?? 0,
        alerts_created: createdCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('early-warning-scan error', e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
