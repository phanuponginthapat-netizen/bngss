// Daily attendance digest → LINE Vault groups with notify_attendance = true
// Sends a chart image (via QuickChart) + text summary of today's check-ins.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersWithCronAndMethods } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { pushMessage } from "../_shared/lineApi.ts";

const cors = corsHeadersWithCronAndMethods;

function bkkDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400000);
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bkk = new Date(utc + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
}
function thDate(d: string): string {
  try { return new Date(d).toLocaleDateString("th-TH-u-ca-buddhist", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
}

async function getVaultToken(sb: any): Promise<string | null> {
  const env = Deno.env.get("LINE_VAULT_CHANNEL_ACCESS_TOKEN")?.trim();
  if (env) return env;
  const { data } = await sb.from("app_secrets").select("value").eq("key", "LINE_VAULT_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return (data?.value as string) || null;
}

function buildChartUrl(labels: string[], present: number[], absent: number[], late: number[], leave: number[]): string {
  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "มา", backgroundColor: "#10B981", data: present, stack: "a" },
        { label: "สาย", backgroundColor: "#F59E0B", data: late, stack: "a" },
        { label: "ลา", backgroundColor: "#6366F1", data: leave, stack: "a" },
        { label: "ขาด", backgroundColor: "#EF4444", data: absent, stack: "a" },
      ],
    },
    options: {
      title: { display: true, text: "การมาโรงเรียนแยกตามระดับชั้น", fontSize: 20 },
      legend: { position: "bottom" },
      scales: {
        xAxes: [{ stacked: true, ticks: { fontSize: 14 } }],
        yAxes: [{ stacked: true, ticks: { beginAtZero: true, fontSize: 12 } }],
      },
      plugins: { datalabels: { display: true, color: "#fff", font: { weight: "bold" } } },
    },
  };
  const params = new URLSearchParams({
    c: JSON.stringify(config),
    width: "900", height: "500", backgroundColor: "white", devicePixelRatio: "2",
  });
  return `https://quickchart.io/chart?${params.toString()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const header = req.headers.get("x-cron-secret") || "";
    const body = await req.json().catch(() => ({}));
    const forceGroupId = body?.group_id as string | undefined;
    const isCron = cronSecret && header === cronSecret;
    if (!isCron && !forceGroupId) {
      // require auth otherwise
    }

    const sb = makeAdmin();
    const today = bkkDate(0);

    // Pull today's attendance, then look up classroom grade level via students -> classrooms
    const { data: attRows, error: attErr } = await sb
      .from("attendance")
      .select("status, student_id")
      .eq("attendance_date", today);
    if (attErr) throw attErr;

    const studentIds = Array.from(new Set(((attRows as any[]) || []).map((r) => r.student_id).filter(Boolean)));
    const gradeByStudent = new Map<string, string>();
    if (studentIds.length > 0) {
      const { data: studs } = await sb
        .from("students")
        .select("id, classrooms:classroom_id(grade_level)")
        .in("id", studentIds);
      for (const s of (studs as any[]) || []) {
        gradeByStudent.set(s.id, (s.classrooms?.grade_level as string) || "ไม่ระบุ");
      }
    }

    const byGrade: Record<string, { present: number; absent: number; late: number; leave: number }> = {};
    for (const r of (attRows as any[]) || []) {
      const g = gradeByStudent.get(r.student_id) || "ไม่ระบุ";
      if (!byGrade[g]) byGrade[g] = { present: 0, absent: 0, late: 0, leave: 0 };
      const s = (r.status || "present").toLowerCase();
      if (s === "present") byGrade[g].present++;
      else if (s === "absent") byGrade[g].absent++;
      else if (s === "late") byGrade[g].late++;
      else byGrade[g].leave++;
    }
    const gradeOrder = ["อ.1","อ.2","อ.3","ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];
    const labels = Object.keys(byGrade).sort((a, b) => {
      const ia = gradeOrder.indexOf(a); const ib = gradeOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1; if (ib === -1) return -1;
      return ia - ib;
    });
    const present = labels.map(l => byGrade[l].present);
    const absent = labels.map(l => byGrade[l].absent);
    const late = labels.map(l => byGrade[l].late);
    const leave = labels.map(l => byGrade[l].leave);
    const totalPresent = present.reduce((a,b)=>a+b,0);
    const totalAbsent = absent.reduce((a,b)=>a+b,0);
    const totalLate = late.reduce((a,b)=>a+b,0);
    const totalLeave = leave.reduce((a,b)=>a+b,0);
    const totalAll = totalPresent + totalAbsent + totalLate + totalLeave;

    const chartUrl = labels.length > 0
      ? buildChartUrl(labels, present, absent, late, leave)
      : `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({type:"bar",data:{labels:["ไม่มีข้อมูล"],datasets:[{label:"-",data:[0]}]},options:{title:{display:true,text:"ยังไม่มีการสแกน"}}}))}&width=900&height=500&backgroundColor=white`;

    const summary = `📊 รายงานการมาโรงเรียน\n📅 ${thDate(today)}\n\n✅ มา ${totalPresent} คน\n⏰ สาย ${totalLate} คน\n📝 ลา ${totalLeave} คน\n❌ ขาด ${totalAbsent} คน\n────────\nรวม ${totalAll} คน (ณ เวลา 10:00 น.)`;

    const token = await getVaultToken(sb);
    if (!token) return new Response(JSON.stringify({ error: "LINE_VAULT_CHANNEL_ACCESS_TOKEN not set" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

    let q = sb.from("line_vault_groups").select("id, line_group_id, group_name, last_attendance_digest_date").eq("notify_attendance", true);
    if (forceGroupId) q = q.eq("id", forceGroupId);
    const { data: groups } = await q;

    const messages = [
      { type: "text", text: summary },
      { type: "image", originalContentUrl: chartUrl, previewImageUrl: chartUrl },
    ];

    const results: any[] = [];
    for (const g of groups || []) {
      if (!forceGroupId && g.last_attendance_digest_date === today) { results.push({ id: g.id, skipped: true }); continue; }
      try {
        await pushMessage(token, g.line_group_id, messages);
        await sb.from("line_vault_groups").update({ last_attendance_digest_date: today, last_notified_at: new Date().toISOString() }).eq("id", g.id);
        results.push({ id: g.id, ok: true });
      } catch (e) {
        console.error("attendance push failed", g.group_name, e);
        results.push({ id: g.id, ok: false, error: String(e).slice(0, 200) });
      }
    }

    return new Response(JSON.stringify({ ok: true, date: today, count: results.length, totals: { totalPresent, totalAbsent, totalLate, totalLeave, totalAll }, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
