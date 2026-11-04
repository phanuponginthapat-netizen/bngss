// Daily attendance digest → LINE Vault groups with notify_attendance = true
// Sends a chart image (via QuickChart) + text summary of today's check-ins.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersWithCronAndMethods } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { pushMessage } from "../_shared/lineApi.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { markMissingAsAbsent, readDigestRows, resolveDigestStatuses } from "../_shared/attendanceDigest.ts";

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

function shortThDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return `${day}/${m}/${y + 543}`;
}

async function getVaultToken(sb: any): Promise<string | null> {
  const env = Deno.env.get("LINE_VAULT_CHANNEL_ACCESS_TOKEN")?.trim();
  if (env) return env;
  const { data } = await sb.from("app_secrets").select("value").eq("key", "LINE_VAULT_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return (data?.value as string) || null;
}

function buildChartConfig(
  labels: string[],
  present: number[],
  absent: number[],
  late: number[],
  leave: number[],
  totals: { totalPresent: number; totalAbsent: number; totalLate: number; totalLeave: number; totalUnrecorded: number; totalAll: number },
  dateLabel: string,
  unrecorded: number[],
) {
  const pct = totals.totalAll > 0 ? Math.round(((totals.totalPresent + totals.totalLate) / totals.totalAll) * 1000) / 10 : 0;
  const subtitle = `📅 ${dateLabel}   |   รวม ${totals.totalAll} คน   |   มา ${totals.totalPresent} (${pct}%)  •  สาย ${totals.totalLate}  •  ลา ${totals.totalLeave}  •  ขาด ${totals.totalAbsent}  •  ยังไม่มีบันทึก ${totals.totalUnrecorded}`;
  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "มา",  backgroundColor: "#10B981", data: present, stack: "a", borderRadius: 4 },
        { label: "สาย", backgroundColor: "#F59E0B", data: late,    stack: "a", borderRadius: 4 },
        { label: "ลา",  backgroundColor: "#6366F1", data: leave,   stack: "a", borderRadius: 4 },
        { label: "ยังไม่มีบันทึก", backgroundColor: "#94A3B8", data: unrecorded, stack: "a", borderRadius: 4 },
        { label: "ขาด", backgroundColor: "#EF4444", data: absent,  stack: "a", borderRadius: 4 },
      ],
    },
    options: {
      title: { display: true, text: ["📊 รายงานการสแกนเข้าโรงเรียน", subtitle], fontSize: 20, fontStyle: "bold", fontColor: "#0F172A", padding: 16 },
      legend: { position: "bottom", labels: { fontSize: 14, fontStyle: "bold", padding: 14 } },
      layout: { padding: { left: 12, right: 20, top: 8, bottom: 12 } },
      scales: {
        xAxes: [{ stacked: true, gridLines: { display: false }, ticks: { fontSize: 14, fontStyle: "bold", fontColor: "#334155" } }],
        yAxes: [{ stacked: true, gridLines: { color: "#E2E8F0" }, ticks: { beginAtZero: true, fontSize: 12, fontColor: "#64748B" } }],
      },
      plugins: {
        datalabels: {
          display: (ctx: any) => (ctx.dataset.data[ctx.dataIndex] || 0) > 0,
          color: "#fff",
          font: { weight: "bold", size: 12 },
          formatter: (v: number) => v,
        },
      },
    },
  };
}

async function shortChartUrl(config: unknown): Promise<string> {
  try {
    const res = await fetch("https://quickchart.io/chart/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chart: config, width: 1100, height: 620, backgroundColor: "white", devicePixelRatio: 2, version: "2.9.4" }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j?.url) return j.url as string;
    }
    console.error("quickchart short url failed", res.status, await res.text().catch(() => ""));
  } catch (e) { console.error("quickchart short url error", e); }
  const params = new URLSearchParams({
    c: JSON.stringify(config), width: "1100", height: "620", backgroundColor: "white", devicePixelRatio: "2",
  });
  return `https://quickchart.io/chart?${params.toString()}`;
}


/** เวลา/วันปัจจุบันตามเวลาไทย */
function bkkNow(): { minutes: number; dow: number } {
  const now = new Date();
  const bkk = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 3600 * 1000);
  return { minutes: bkk.getHours() * 60 + bkk.getMinutes(), dow: bkk.getDay() };
}

async function getSettings(sb: any): Promise<Record<string, string>> {
  const { data, error } = await sb.from("school_settings")
    .select("setting_key, setting_value")
    .in("setting_key", [
      "line_digest_enabled",
      "line_digest_time",
      "line_digest_days",
      "line_digest_include_calendar",
      "clock_late_threshold",
      "clock_in_end",
    ]);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of (data as any[]) || []) if (r.setting_value != null) map[r.setting_key] = String(r.setting_value);
  return map;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const denied = await requireCronOrAdmin(req, cors);
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const forceGroupId = body?.group_id as string | undefined;
    const customImageUrl = (body?.image_url as string | undefined)?.trim();
    const customSummary = (body?.summary_text as string | undefined)?.trim();
    const includeChart = Boolean(body?.include_chart);
    const skipSchedule = Boolean(body?.force);
    const allowDuplicate = Boolean(body?.allow_duplicate);
    const dryRun = body?.dry_run === true;
    const manualRun = Boolean(forceGroupId || customImageUrl || customSummary || skipSchedule || dryRun);

    const sb = makeAdmin();
    const today = bkkDate(0);
    const settings = await getSettings(sb);

    // ⏰ ตารางเวลา/วันที่ผู้ดูแลตั้งเอง — ใช้เฉพาะรอบอัตโนมัติ (cron ทุก 15 นาที)
    if (!manualRun) {
      if (settings.line_digest_enabled === "false") {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "disabled" }),
          { headers: { ...cors, "Content-Type": "application/json" } });
      }
      const [hh, mm] = (settings.line_digest_time || "10:00").split(":").map((n) => parseInt(n, 10));
      const target = (isNaN(hh) ? 10 : hh) * 60 + (isNaN(mm) ? 0 : mm);
      const days = (settings.line_digest_days ?? "1,2,3,4,5")
        .split(",").map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d));
      const { minutes, dow } = bkkNow();
      if (days.length > 0 && !days.includes(dow)) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "day_not_selected", dow }),
          { headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (minutes < target || minutes >= target + 20) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "outside_window", minutes, target }),
          { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    let chartUrl = customImageUrl || "";
    let summary = customSummary || "";
    let totals = { totalPresent: 0, totalAbsent: 0, totalLate: 0, totalLeave: 0, totalUnrecorded: 0, totalAll: 0 };

    if (!customImageUrl || !customSummary) {
      // 1) ฐานนักเรียนทั้งหมด (active) — ใช้เป็นตัวหารเปอร์เซ็นต์
      const studs = await readDigestRows<any>((start, end) => sb.from("students")
        .select("id, classroom_id, prefix, first_name, last_name").eq("status", "active")
        .order("id").range(start, end));

      const classroomIds = Array.from(new Set(((studs as any[]) || []).map((s) => s.classroom_id).filter(Boolean)));
      const gradeByClassroom = new Map<string, string>();
      const labelByClassroom = new Map<string, string>();
      if (classroomIds.length > 0) {
        const { data: cls, error: cErr } = await sb
          .from("classrooms")
          .select("id, grade_level, name")
          .in("id", classroomIds);
        if (cErr) { console.error("classrooms fetch", cErr); throw cErr; }
        for (const c of (cls as any[]) || []) {
          const g = c.grade_level || "ไม่ระบุ";
          gradeByClassroom.set(c.id, g);
          const detail = c.name || "";
          labelByClassroom.set(c.id, detail ? `${g}/${detail}` : g);
        }
      }
      const gradeByStudent = new Map<string, string>();
      const nameByStudent = new Map<string, string>();
      const clsByStudent = new Map<string, string>();
      for (const s of (studs as any[]) || []) {
        gradeByStudent.set(s.id, gradeByClassroom.get(s.classroom_id) || "ไม่ระบุ");
        clsByStudent.set(s.id, labelByClassroom.get(s.classroom_id) || gradeByClassroom.get(s.classroom_id) || "ไม่ระบุ");
        const nm = [s.prefix, s.first_name, s.last_name].filter(Boolean).join("").trim() || "ไม่ทราบชื่อ";
        nameByStudent.set(s.id, nm);
      }


      const attRows = await readDigestRows<any>((start, end) => sb.from("attendance")
        .select("status, student_id").is("subject_id", null).eq("attendance_date", today)
        .order("id").range(start, end));
      const scanRows = await readDigestRows<any>((start, end) => sb.from("face_scan_logs")
        .select("student_id, scan_time, created_at, scan_type").eq("scan_date", today)
        .in("scan_type", ["entry", "assembly"]).order("id").range(start, end));
      const statusByStudent = resolveDigestStatuses(attRows, scanRows, settings.clock_late_threshold || "08:30");
      // Past the check-in window → students with no record/scan count as absent.
      const nowClock = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      markMissingAsAbsent(statusByStudent, ((studs as any[]) || []).map((s) => s.id), nowClock,
        settings.clock_in_end || settings.clock_late_threshold || "08:30");

      const byGrade: Record<string, { present: number; absent: number; late: number; leave: number; unrecorded: number }> = {};
      const absentByGrade: Record<string, string[]> = {};
      for (const s of (studs as any[]) || []) {
        const g = gradeByStudent.get(s.id) || "ไม่ระบุ";
        if (!byGrade[g]) byGrade[g] = { present: 0, absent: 0, late: 0, leave: 0, unrecorded: 0 };
        const st = statusByStudent.get(s.id);
        if (st === "present") byGrade[g].present++;
        else if (st === "late") byGrade[g].late++;
        else if (st === "leave" || st === "sick") byGrade[g].leave++;
        else if (st === "absent") {
          byGrade[g].absent++;
          (absentByGrade[g] ||= []).push(`${nameByStudent.get(s.id) || "ไม่ทราบชื่อ"} (${clsByStudent.get(s.id) || g})`);
        }
        else byGrade[g].unrecorded++;
      }
      const gradeOrder = ["อ.1","อ.2","อ.3","ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];
      const sortGrade = (a: string, b: string) => {
        const ia = gradeOrder.indexOf(a); const ib = gradeOrder.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      };
      const labels = Object.keys(byGrade).sort(sortGrade);
      const present = labels.map(l => byGrade[l].present);
      const absent = labels.map(l => byGrade[l].absent);
      const late = labels.map(l => byGrade[l].late);
      const leave = labels.map(l => byGrade[l].leave);
      totals.totalPresent = present.reduce((a,b)=>a+b,0);
      totals.totalAbsent = absent.reduce((a,b)=>a+b,0);
      totals.totalLate = late.reduce((a,b)=>a+b,0);
      totals.totalLeave = leave.reduce((a,b)=>a+b,0);
      totals.totalUnrecorded = labels.reduce((sum, label) => sum + byGrade[label].unrecorded, 0);
      totals.totalAll = studs.length;

      // ส่งเป็นข้อความอย่างเดียว (ไม่แนบกราฟ) เพื่อประหยัดโควต้า LINE
      // ถ้าต้องการกราฟ ให้ส่ง body { include_chart: true }
      if (!chartUrl && includeChart) {
        const chartConfig = labels.length > 0
          ? buildChartConfig(labels, present, absent, late, leave, totals, thDate(today), labels.map(l => byGrade[l].unrecorded))
          : { type: "bar", data: { labels: ["ไม่มีข้อมูล"], datasets: [{ label: "-", data: [0] }] }, options: { title: { display: true, text: "ยังไม่มีการสแกน" } } };
        chartUrl = await shortChartUrl(chartConfig);
      }

      if (!summary) {
        const pct = totals.totalAll > 0 ? Math.round(((totals.totalPresent + totals.totalLate) / totals.totalAll) * 1000) / 10 : 0;
        let s = `📊 รายงานการสแกนเข้าโรงเรียน\n📅 ${shortThDate(today)}\n\n✅ มา ${totals.totalPresent} คน\n⏰ สาย ${totals.totalLate} คน\n📝 ลา ${totals.totalLeave} คน\n❌ ขาด ${totals.totalAbsent} คน${totals.totalUnrecorded > 0 ? `\n❔ ยังไม่มีบันทึก ${totals.totalUnrecorded} คน` : ""}\n────────\nรวม ${totals.totalAll} คน • เข้าเรียน ${pct}%`;
        const absentGrades = Object.keys(absentByGrade).sort(sortGrade);
        if (absentGrades.length > 0) {
          s += `\n\n🚨 รายชื่อนักเรียนที่ขาด (${totals.totalAbsent} คน)`;
          for (const g of absentGrades) {
            const names = absentByGrade[g];
            s += `\n\n▪️ ${g} (${names.length} คน)\n  • ` + names.join("\n  • ");
          }
        }

        // 📅 รวมปฏิทินกิจกรรมไว้ในข้อความเดียวกัน (ประหยัดโควต้า LINE = 1 ข้อความ/วัน)
        if (settings.line_digest_include_calendar !== "false") {
          try {
            const in7 = bkkDate(7);
            const { data: ev } = await sb.from("academic_events")
              .select("title, event_date, location")
              .gte("event_date", today).lte("event_date", in7)
              .order("event_date").limit(6);
            if ((ev as any[])?.length) {
              s += `\n\n📅 กิจกรรม 7 วันข้างหน้า`;
              for (const e of ev as any[]) {
                s += `\n  • ${shortThDate(e.event_date)} ${e.title}${e.location ? ` @ ${e.location}` : ""}`;
              }
            }
          } catch (e) { console.error("calendar section failed", e); }
        }

        // LINE text limit is 5000 chars
        summary = s.length > 4900 ? s.slice(0, 4880) + "\n… (ตัดทอน)" : s;
      }
    }



    // A lack of scans is not evidence of a holiday. Never create holidays from this report.
    if (!manualRun) {
      const { data: holidays, error: holidayError } = await sb.from("academic_events")
        .select("id").eq("event_type", "holiday").lte("event_date", today)
        .or(`end_date.gte.${today},and(end_date.is.null,event_date.eq.${today})`).limit(1);
      if (holidayError) throw holidayError;
      if (holidays?.length) return new Response(JSON.stringify({ ok: true, skipped: true, reason: "calendar_holiday", date: today }),
        { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (dryRun) return new Response(JSON.stringify({ ok: true, dry_run: true, date: today, totals, summary }),
      { headers: { ...cors, "Content-Type": "application/json" } });

    const token = await getVaultToken(sb);
    if (!token) return new Response(JSON.stringify({ error: "LINE_VAULT_CHANNEL_ACCESS_TOKEN not set" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

    let q = sb.from("line_vault_groups").select("id, line_group_id, group_name, last_attendance_digest_date").eq("notify_attendance", true);
    if (forceGroupId) q = q.eq("id", forceGroupId);
    const { data: groups, error: groupError } = await q;
    if (groupError) throw groupError;

    // ส่งเพียง 1 ข้อความต่อวัน (ยกเว้นสั่งแนบกราฟเองด้วย include_chart)
    const messages: any[] = [];
    if (chartUrl && includeChart) {
      messages.push({ type: "image", originalContentUrl: chartUrl, previewImageUrl: chartUrl });
    } else if (summary) {
      messages.push({ type: "text", text: summary });
    }

    const results: any[] = [];
    let alreadySent = 0;
    for (const g of groups || []) {
      // 🔒 จองสิทธิ์ส่งแบบอะตอมมิก — อัปเดตวันที่ก่อนส่ง เฉพาะแถวที่ยังไม่ถูกส่งวันนี้
      // กันส่งซ้ำจากทุกช่องทาง (cron ซ้อน, ปุ่มทดสอบ, กดหลายครั้ง)
      if (!allowDuplicate) {
        const { data: claimed, error: claimError } = await sb
          .from("line_vault_groups")
          .update({ last_attendance_digest_date: today, last_notified_at: new Date().toISOString() })
          .eq("id", g.id)
          .or(`last_attendance_digest_date.is.null,last_attendance_digest_date.neq.${today}`)
          .select("id");
        if (claimError) throw claimError;
        if (!claimed || claimed.length === 0) {
          alreadySent++;
          results.push({ id: g.id, skipped: true, reason: "already_sent_today" });
          continue;
        }
      }
      try {
        await pushMessage(token, g.line_group_id, messages);
        const { error: saveError } = await sb.from("line_vault_groups").update({ last_attendance_digest_date: today, last_notified_at: new Date().toISOString() }).eq("id", g.id);
        if (saveError) {
          results.push({ id: g.id, ok: true, warning: "Delivery accepted but final timestamp was not saved" });
          console.error("attendance delivery timestamp", saveError);
          continue;
        }
        results.push({ id: g.id, ok: true });
      } catch (e) {
        console.error("attendance push failed", g.group_name, e);
        // ส่งไม่สำเร็จ — คืนสิทธิ์ให้รอบถัดไปลองใหม่ได้
        if (!allowDuplicate) {
          const { error: releaseError } = await sb.from("line_vault_groups").update({ last_attendance_digest_date: null }).eq("id", g.id).eq("last_attendance_digest_date", today);
          if (releaseError) console.error("attendance retry reservation failed", releaseError);
        }
        results.push({ id: g.id, ok: false, error: String(e).slice(0, 200) });
      }
    }

    return new Response(JSON.stringify({ ok: results.every((r) => r.ok !== false), date: today, count: results.length, sent: results.filter((r) => r.ok).length, already_sent: alreadySent, totals, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    const em = (e as any)?.message || (e as any)?.details || JSON.stringify(e);
    return new Response(JSON.stringify({ error: String(em).slice(0, 400) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
