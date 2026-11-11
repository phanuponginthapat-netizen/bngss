import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { readDigestRows } from "../_shared/attendanceDigest.ts";
import { aggregatePublicAttendance, type SchoolAttendanceRow, type SchoolScanRow } from "../_shared/publicAttendance.ts";

serve(async req => {
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  try {
    const body = await req.json();
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    const clock = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false });
    const sb = makeAdmin();
    const [periodResult, settingsResult] = await Promise.all([
      sb.from("academic_periods").select("academic_year_be, semester, start_date, end_date").order("start_date", { ascending: false }),
      sb.from("school_settings").select("setting_key, setting_value").in("setting_key", ["academic_year_override", "semester_override", "clock_late_threshold", "clock_in_end"]),
    ]);
    if (periodResult.error || settingsResult.error) throw new Error("Calendar read failed");
    const periods = periodResult.data ?? [];
    const settings = Object.fromEntries((settingsResult.data ?? []).map(r => [r.setting_key, r.setting_value]));
    const yearOverride = Number(settings.academic_year_override);
    const semOverride = Number(settings.semester_override);
    const automatic = periods.find(p => p.start_date && p.end_date && p.start_date <= today && p.end_date >= today)
      ?? periods.find(p => p.end_date && p.end_date < today);
    const current = periods.find(p => Number(p.academic_year_be) === (yearOverride > 2000 ? yearOverride : Number(automatic?.academic_year_be)) && Number(p.semester) === ([1, 2].includes(semOverride) ? semOverride : Number(automatic?.semester)));
    let start = today, finish = today;
    if (body.mode === "day") {
      if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date)) || body.date > today) throw new Error("Invalid date");
      start = finish = body.date;
    } else if (body.mode === "month") {
      if (typeof body.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)) throw new Error("Invalid month");
      start = `${body.month}-01`;
      const [year, month] = body.month.split("-").map(Number);
      finish = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    } else if (body.mode === "term") {
      const selected = periods.find(p => Number(p.academic_year_be) === Number(body.year) && Number(p.semester) === Number(body.semester));
      if (!selected?.start_date || !selected.end_date) throw new Error("Term dates unavailable");
      start = selected.start_date; finish = selected.end_date;
    } else throw new Error("Invalid mode");
    if (finish > today) finish = today;
    const dates: string[] = [];
    if (start <= finish) {
      if ((Date.parse(finish) - Date.parse(start)) / 86400000 > 370) throw new Error("Date range too long");
      for (let time = Date.parse(start); time <= Date.parse(finish); time += 86400000) dates.push(new Date(time).toISOString().slice(0, 10));
    }
    const students = await readDigestRows<{ id: string }>((a, b) => sb.from("students").select("id").eq("status", "active").order("id").range(a, b));
    const [attendance, scans] = dates.length ? await Promise.all([
      readDigestRows<SchoolAttendanceRow>((a, b) => sb.from("attendance").select("student_id,status,attendance_date").is("subject_id", null).gte("attendance_date", start).lte("attendance_date", finish).order("id").range(a, b)),
      readDigestRows<SchoolScanRow>((a, b) => sb.from("face_scan_logs").select("student_id,scan_date,scan_time,created_at,scan_type").in("scan_type", ["entry", "assembly"]).gte("scan_date", start).lte("scan_date", finish).order("id").range(a, b)),
    ]) : [[], []];
    const daily = aggregatePublicAttendance(students.map(s => s.id), dates, attendance, scans, today, clock, settings.clock_late_threshold || "08:30", settings.clock_in_end || settings.clock_late_threshold || "08:30");
    return new Response(JSON.stringify({ today, current: current ?? null, periods, rosterTotal: students.length, daily, updatedAt: now.toISOString() }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "ไม่สามารถโหลดสถิติการมาโรงเรียนได้ กรุณาลองใหม่" }), { status: 400, headers });
  }
});