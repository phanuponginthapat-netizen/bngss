// สรุปการสแกนหน้า → ส่งเข้า Google Chat (CardV2 แบบตาราง)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { readDigestRows, resolveDigestStatuses, markMissingAsAbsent } from "../_shared/attendanceDigest.ts";
import { attendanceGender } from "../_shared/publicAttendance.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { notifyGChat } from "../_shared/fanout.ts";
import { bkkDateISO } from "../_shared/thaiDate.ts";

type Period = "day" | "week" | "month" | "term";

function getRange(period: Period, ref: Date) {
  const d = new Date(ref);
  const start = new Date(d);
  const end = new Date(d);
  let label = "";
  if (period === "day") {
    label = d.toLocaleDateString("th-TH");
  } else if (period === "week") {
    const day = d.getDay() || 7;
    start.setDate(d.getDate() - (day - 1));
    end.setDate(start.getDate() + 6);
    label = `สัปดาห์ ${start.toLocaleDateString("th-TH")} - ${end.toLocaleDateString("th-TH")}`;
  } else if (period === "month") {
    start.setDate(1);
    end.setMonth(d.getMonth() + 1, 0);
    label = d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  } else {
    const m = d.getMonth() + 1;
    if (m >= 5 && m <= 10) {
      start.setMonth(4, 1); end.setMonth(9, 31);
      label = `ภาคเรียนที่ 1/${d.getFullYear() + 543}`;
    } else if (m >= 11) {
      start.setMonth(10, 1); end.setFullYear(d.getFullYear() + 1, 3, 30);
      label = `ภาคเรียนที่ 2/${d.getFullYear() + 543}`;
    } else {
      start.setFullYear(d.getFullYear() - 1, 10, 1); end.setMonth(3, 30);
      label = `ภาคเรียนที่ 2/${start.getFullYear() + 543}`;
    }
  }
  const fmt = (x: Date) => bkkDateISO(x);
  return { start: fmt(start), end: fmt(end), label };
}

function bangkokHHMM(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

function pad(s: string, n: number) {
  // ใช้ความยาวอักขระ (Thai/emoji อาจยาวต่างจริง แต่ดีพอสำหรับ pre-block)
  const len = [...s].length;
  return len >= n ? s : s + " ".repeat(n - len);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const period: Period = body.period || "day";
    const ref = body.ref_date ? new Date(body.ref_date) : new Date();
    let r = body.start && body.end
      ? { start: body.start, end: body.end, label: body.label || `${body.start} - ${body.end}` }
      : getRange(period, ref);
    const broadcast = body.broadcast !== false;

    const sb = makeAdmin();

    if(period === "term" && !(body.start && body.end)) {
      const day = bkkDateISO(ref);
      const {data: term,error} = await sb.from("academic_periods").select("start_date,end_date,semester,academic_year_be").lte("start_date",day).gte("end_date",day).order("start_date",{ascending:false}).limit(1).maybeSingle();
      if(error || !term) throw new Error("Term calendar unavailable");
      r = {start:term.start_date,end:term.end_date,label:`ภาคเรียน ${term.semester}/${term.academic_year_be}`};
    }
    const {data: settingRows, error: settingsError} = await sb.from("school_settings").select("setting_key,setting_value").in("setting_key", ["clock_late_threshold", "clock_in_end"]);
    if(settingsError) throw settingsError;
    const settings = Object.fromEntries((settingRows ?? []).map(row=>[row.setting_key,row.setting_value]));
    const threshold = settings.clock_late_threshold || "08:30";
    const [students, logs, attendance] = await Promise.all([
      readDigestRows<any>((a,b)=>sb.from("students").select("id,gender,classrooms!students_classroom_id_fkey(grade_level,name)").eq("status","active").order("id").range(a,b)),
      readDigestRows<any>((a,b)=>sb.from("face_scan_logs").select("student_id,scan_date,scan_time,scan_type").in("scan_type",["entry","assembly"]).gte("scan_date",r.start).lte("scan_date",r.end).order("id").range(a,b)),
      readDigestRows<any>((a,b)=>sb.from("attendance").select("student_id,status,attendance_date").is("subject_id",null).gte("attendance_date",r.start).lte("attendance_date",r.end).order("id").range(a,b)),
    ]);

    // วันที่ในช่วง
    const dates: string[] = [];
    for (let d = new Date(r.start); d <= new Date(r.end); d.setDate(d.getDate() + 1)) {
      dates.push(bkkDateISO(d));
    }

    // รวมต่อชั้น (รวมทั้งช่วง)
    type Row = { cls: string; grade: string; male: number; female: number; arrived: number; late: number; absent: number; totalM: number; totalF: number; total: number; unrecorded: number; leave: number };
    const clsMap = new Map<string, Row>();
    const clsKey = (s: any) => {
      const g = s.classrooms?.grade_level || "-";
      const n = s.classrooms?.name || "-";
      return n && n !== g ? `${g}/${n}` : g;
    };
    const statusesByDate = new Map(dates.map(date => {
      const statuses = resolveDigestStatuses(attendance.filter(a=>a.attendance_date===date),logs.filter(l=>l.scan_date===date),threshold);
      if(date<=bkkDateISO(new Date())) markMissingAsAbsent(statuses,students.map(s=>s.id),date<bkkDateISO(new Date())?"23:59:59":new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Bangkok",hour12:false}),settings.clock_in_end||threshold);
      return [date,statuses] as const;
    }));
    for (const s of (students || []) as any[]) {
      const k = clsKey(s);
      if (!clsMap.has(k)) clsMap.set(k, {
        cls: k, grade: s.classrooms?.grade_level || "-",
        male: 0, female: 0, arrived: 0, late: 0, absent: 0,
        totalM: 0, totalF: 0, total: 0, unrecorded: 0, leave: 0,
      });
      const row = clsMap.get(k);
      if (!row) throw new Error("Class summary unavailable");
      const gender = attendanceGender(s.gender);
      const isM = gender === "male";
      // เพิ่ม count นักเรียนต่อวัน
      for (const d of dates) {
        if (isM) row.totalM++; else if (gender === "female") row.totalF++;
        row.total++;
        const status = statusesByDate.get(d)?.get(s.id) ?? "unrecorded";
        if (status === "present" || status === "late") {
          row.arrived++;
          if (isM) row.male++; else if (gender === "female") row.female++;
          if (status === "late") row.late++;
        } else if (status === "absent") row.absent++;
        else if (status === "leave" || status === "sick") row.leave++;
        else row.unrecorded++;
      }
    }

    const gradeOrder = (g: string) => {
      const m: Record<string, number> = { "ป.1":1,"ป.2":2,"ป.3":3,"ป.4":4,"ป.5":5,"ป.6":6,"ม.1":7,"ม.2":8,"ม.3":9,"ม.4":10,"ม.5":11,"ม.6":12 };
      return m[g] ?? 99;
    };
    const rows = Array.from(clsMap.values()).sort((a, b) => {
      const d = gradeOrder(a.grade) - gradeOrder(b.grade);
      return d !== 0 ? d : a.cls.localeCompare(b.cls);
    });

    // รวมทั้งโรงเรียน
    const sum = rows.reduce((a, r) => ({
      male: a.male + r.male, female: a.female + r.female,
      arrived: a.arrived + r.arrived, late: a.late + r.late,
      absent: a.absent + r.absent, totalM: a.totalM + r.totalM,
      totalF: a.totalF + r.totalF, total: a.total + r.total, unrecorded: a.unrecorded+r.unrecorded, leave: a.leave+r.leave,
    }), { male:0, female:0, arrived:0, late:0, absent:0, totalM:0, totalF:0, total:0, unrecorded:0, leave:0 });

    const pct = sum.total > 0 ? Math.round((sum.arrived / sum.total) * 1000) / 10 : 0;
    const periodLabel = { day: "รายวัน", week: "รายสัปดาห์", month: "รายเดือน", term: "รายเทอม" }[period];

    // สร้างตาราง (monospace) สำหรับ pre block
    const head = `${pad("ชั้น", 8)}${pad("ชาย", 6)}${pad("หญิง", 6)}${pad("รวม", 6)}${pad("สาย", 6)}${pad("ขาด", 6)}`;
    const sep  = "─".repeat(38);
    const lines = [head, sep, ...rows.map(r =>
      `${pad(r.cls, 8)}${pad(String(r.male), 6)}${pad(String(r.female), 6)}${pad(String(r.arrived), 6)}${pad(String(r.late), 6)}${pad(String(r.absent), 6)}`
    ), sep, `${pad("รวม", 8)}${pad(String(sum.male), 6)}${pad(String(sum.female), 6)}${pad(String(sum.arrived), 6)}${pad(String(sum.late), 6)}${pad(String(sum.absent), 6)}`];
    const tableText = "<pre>" + lines.join("\n") + "</pre>";

    // สร้าง CardV2 เอง (ส่งตรงไปยัง webhook ผ่าน notify-google-chat ใช้ buildCardV2 ภายใน
    // แต่เราต้องการตารางใหญ่ → ส่งเป็น message ผ่าน notify-google-chat ก็พอ)
    const title = `📊 สรุปการสแกนเข้าโรงเรียน (${periodLabel})`;
    const fields = {
      "ช่วงเวลา": r.label,
      "เกณฑ์เวลาสาย": `หลัง ${threshold} น.`,
      "นักเรียนทั้งหมด (รวมทุกวัน)": `${sum.total.toLocaleString()} คน`,
      "มาเรียน (✅)": `${sum.arrived.toLocaleString()} ครั้ง (${pct}%)`,
      "ตรงเวลา": `${(sum.arrived - sum.late).toLocaleString()} ครั้ง`,
      "สาย (⏰)": `${sum.late.toLocaleString()} ครั้ง`,
      "ยังไม่บันทึก": `${sum.unrecorded.toLocaleString()} ครั้ง`,
      "ลา": `${sum.leave.toLocaleString()} ครั้ง`,
      "ขาด (❌)": `${sum.absent.toLocaleString()} ครั้ง`,
      "ชาย (มาเรียน)": `${sum.male.toLocaleString()} ครั้ง`,
      "หญิง (มาเรียน)": `${sum.female.toLocaleString()} ครั้ง`,
    };

    const message = `${tableText}`;

    const { data: notifyData } = await notifyGChat({
      title, message,
      severity: "info",
      notification_type: "face_scan",
      fields,
    });

    return new Response(
      JSON.stringify({ ok: true, period, range: r, stats: { rows, sum, pct }, gchat: notifyData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("face-scan-summary error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
