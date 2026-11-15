// รายงานสรุปการสแกนหน้าประจำวัน — ส่งเข้า LINE OA ให้ครู/ผอ/แอดมิน
// เรียกอัตโนมัติทุกวัน 09:00 น. (Asia/Bangkok) ผ่าน pg_cron
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { corsHeadersWithCron as corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { readDigestRows, resolveDigestStatuses, markMissingAsAbsent } from "../_shared/attendanceDigest.ts";
import { notifyLine } from "../_shared/fanout.ts";

// เกณฑ์เริ่มถือว่า "สาย" (เวลาท้องถิ่นไทย HH:MM)
const DEFAULT_LATE_THRESHOLD = "08:00";

function bangkokTodayISO(): string {
  // คืน YYYY-MM-DD ตามเวลา Asia/Bangkok
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
}

function bangkokTimeHHMM(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return fmt.format(d);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const targetDate: string = body.date || bangkokTodayISO();
    const lateThreshold: string = body.late_threshold || DEFAULT_LATE_THRESHOLD;
    const sendLine: boolean = body.send_line !== false;

    const sb = makeAdmin();

    const {data: settingRows, error: settingsError} = await sb.from("school_settings").select("setting_key,setting_value").in("setting_key", ["clock_late_threshold", "clock_in_end"]);
    if(settingsError) throw settingsError;
    const settings = Object.fromEntries((settingRows ?? []).map(row => [row.setting_key,row.setting_value]));
    const threshold = settings.clock_late_threshold || lateThreshold;
    const students = await readDigestRows<any>((a,b) => sb.from("students").select("id,prefix,first_name,last_name,classroom_id,classrooms!students_classroom_id_fkey(grade_level,room_number,name)").eq("status","active").order("id").range(a,b));
    const totalStudents = students.length;
    const [logs, attendance] = await Promise.all([
      readDigestRows<any>((a,b)=>sb.from("face_scan_logs").select("student_id,scan_time,scan_type,match_engine,geometry_score").eq("scan_date", targetDate).in("scan_type",["entry","assembly"]).order("id").range(a,b)),
      readDigestRows<any>((a,b)=>sb.from("attendance").select("student_id,status").is("subject_id",null).eq("attendance_date",targetDate).order("id").range(a,b)),
    ]);
    const statuses = resolveDigestStatuses(attendance,logs,threshold);
    markMissingAsAbsent(statuses, students.map(s=>s.id), targetDate < bangkokTodayISO() ? "23:59:59" : new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Bangkok",hour12:false}), settings.clock_in_end || threshold);

    // 3) นับ มา / สาย / ขาด ต่อชั้นเรียน
    let present = 0, late = 0, absent = 0, unrecorded = 0, leave = 0;
    const byClass = new Map<string, { present: number; late: number; absent: number; total: number }>();

    for (const s of (students || []) as any[]) {
      const clsName = s.classrooms?.name
        || `${s.classrooms?.grade_level || "-"}/${s.classrooms?.room_number || "-"}`;
      if (!byClass.has(clsName)) byClass.set(clsName, { present: 0, late: 0, absent: 0, total: 0 });
      const row = byClass.get(clsName);
      if (!row) throw new Error("Class summary unavailable");
      row.total += 1;

      const status = statuses.get(s.id) ?? "unrecorded";
      if (status === "present" || status === "late") {
        present++; row.present++;
        if (status === "late") {late++; row.late++;}
      } else if (status === "absent") { absent++; row.absent++; }
      else if (status === "leave" || status === "sick") leave++;
      else unrecorded++;
    }

    const onTime = present - late;
    const dateTH = new Date(targetDate + "T00:00:00+07:00")
      .toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // ห้องที่ขาดเยอะที่สุด top 5
    const topAbsent = Array.from(byClass.entries())
      .filter(([, v]) => v.absent > 0)
      .sort((a, b) => b[1].absent - a[1].absent)
      .slice(0, 5);

    const pct = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;

    const title = `📊 สรุปการมาเรียน ${dateTH}`;
    const lines = [
      `👥 นักเรียนทั้งหมด: ${totalStudents} คน`,
      `✅ มาเรียน: ${present} คน (${pct}%)`,
      `   • ตรงเวลา: ${onTime} คน`,
      `   • สาย (หลัง ${threshold} น.): ${late} คน`,
      `❌ ขาด: ${absent} คน`,
      `📝 ลา: ${leave} คน`,
      `ยังไม่บันทึก: ${unrecorded} คน`,
    ];
    // คุณภาพการตรวจใบหน้า — สแกนด้วยตัวประมวลผลเนทีฟ (แม่นกว่า) กี่เปอร์เซ็นต์
    const scanRows = (logs || []) as any[];
    const nativeScans = scanRows.filter((x) => x.match_engine && x.match_engine !== "browser").length;
    const geomRows = scanRows.filter((x) => typeof x.geometry_score === "number");
    if (scanRows.length > 0 && (nativeScans > 0 || geomRows.length > 0)) {
      const nativePct = Math.round((nativeScans / scanRows.length) * 100);
      const geomAvg = geomRows.length
        ? Math.round((geomRows.reduce((a, b) => a + b.geometry_score, 0) / geomRows.length) * 100)
        : null;
      lines.push(
        "",
        `🎯 คุณภาพการตรวจใบหน้า: เนทีฟ ${nativePct}%` +
          (geomAvg != null ? ` • ตรงโครงหน้าเฉลี่ย ${geomAvg}%` : ""),
      );
    }
    if (topAbsent.length > 0) {
      lines.push("", "🏫 ห้องที่ขาดมากที่สุด:");
      topAbsent.forEach(([c, v], i) => {
        lines.push(`  ${i + 1}. ${c} — ขาด ${v.absent}/${v.total} คน`);
      });
    }
    const message = lines.join("\n");

    // URL หน้ารายงานสรุปบน dashboard (ตั้งค่าได้ผ่าน school_settings.dashboard_base_url)
    const { data: urlSetting } = await sb
      .from("school_settings")
      .select("setting_value")
      .eq("setting_key", "dashboard_base_url")
      .maybeSingle();
    const baseUrl = ((urlSetting?.setting_value as string) || Deno.env.get("PUBLIC_ORIGIN") || Deno.env.get("APP_URL") || "").replace(/\/+$/, "");
    const reportUrl = `${baseUrl}/dashboard/student/face-scan?date=${targetDate}`;

    let lineResult: any = { skipped: true };
    if (sendLine) {
      // ส่งให้ ครู / ผอ / แอดมิน ผ่าน notify-line (จะใช้ LINE ID ที่ผูกบัญชีไว้)
      lineResult = await notifyLine({
        title, message,
        roles: ["teacher", "director", "admin"],
        use_flex: true,
        severity: "info",
        notification_type: "face_scan_daily_report",
        action_url: reportUrl,
        action_label: "เปิดรายงานบน Dashboard",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date: targetDate,
        threshold,
        stats: { total: totalStudents, present, on_time: onTime, late, absent, leave, unrecorded, percent: pct },
        top_absent_classes: topAbsent.map(([c, v]) => ({ classroom: c, absent: v.absent, total: v.total })),
        line: lineResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("face-scan-daily-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
