import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, BarChart3, Search, Send, Users, User, CheckCircle2, Clock4, FileMinus2, XCircle, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { DateInput } from "@/components/ui/date-input";

type ClassRow = {
  cls: string; grade: string; size: number; sizeM: number; sizeF: number;
  present: number; presentM: number; presentF: number;
  late: number; lateM: number; lateF: number;
  leave: number; absent: number; absentM: number; absentF: number;
  cd: number; pct: number;
};


type Period = "day" | "week" | "month" | "term";

function getRange(period: Period, ref: Date): { start: string; end: string; label: string } {
  const d = new Date(ref);
  const end = new Date(d);
  const start = new Date(d);
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
    // term: 1 May–31 Oct (เทอม 1), 1 Nov–30 Apr (เทอม 2)
    const m = d.getMonth() + 1;
    if (m >= 5 && m <= 10) {
      start.setMonth(4, 1);
      end.setMonth(9, 31);
      label = `ภาคเรียนที่ 1 / ${d.getFullYear() + 543}`;
    } else {
      if (m >= 11) {
        start.setMonth(10, 1);
        end.setFullYear(d.getFullYear() + 1, 3, 30);
      } else {
        start.setFullYear(d.getFullYear() - 1, 10, 1);
        end.setMonth(3, 30);
      }
      label = `ภาคเรียนที่ 2 / ${start.getFullYear() + 543}`;
    }
  }
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), label };
}

const TONE: Record<string, string> = {
  emerald: "from-success/15 to-success/5 border-success/30 text-success",
  amber: "from-warning/15 to-warning/5 border-warning/30 text-warning",
  sky: "from-info/15 to-info/5 border-info/30 text-info",
  rose: "from-danger/15 to-danger/5 border-danger/30 text-danger",
  violet: "from-info/15 to-info/5 border-info/30 text-info",
};
function KpiTile({ color, icon, label, value, sub }: { color: keyof typeof TONE | string; icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${TONE[color] || TONE.violet}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <span className="opacity-70">{icon}</span>
      </div>
      <div className="text-2xl font-extrabold mt-1 leading-none">{value}</div>
      {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

const FaceReportTab = () => {

  const today = new Date();
  const [period, setPeriod] = useState<Period>("day");
  const [refDate, setRefDate] = useState(today.toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [groupMode, setGroupMode] = useState<"individual" | "class">("individual");
  const [sending, setSending] = useState(false);

  const range = useMemo(() => getRange(period, new Date(refDate)), [period, refDate]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["face-logs-range", range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_scan_logs")
        .select("id, scan_date, scan_time, confidence, scan_type, captured_face_url, entry_method, scanned_by, students!inner(id, prefix, first_name, last_name, student_code, photo_url, classrooms!students_classroom_id_fkey(grade_level, name))")
        .gte("scan_date", range.start)
        .lte("scan_date", range.end)
        .order("scan_time", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      // resolve scanner names in batch
      const ids = Array.from(new Set(rows.map((r) => r.scanned_by).filter(Boolean))) as string[];
      if (ids.length) {
        const [{ data: personnel }, profilesRes] = await Promise.all([
          supabase.from("personnel").select("user_id, prefix, first_name, last_name").in("user_id", ids),
          (supabase.rpc as any)("get_profiles_public", { _ids: ids }),
        ]);
        const profiles = (profilesRes?.data as any[]) || [];
        const nameMap = new Map<string, string>();
        (personnel || []).forEach((p: any) => nameMap.set(p.user_id, `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim()));
        profiles.forEach((p: any) => { if (!nameMap.has(p.id)) nameMap.set(p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()); });
        rows.forEach((r) => { r.scanner_name = nameMap.get(r.scanned_by) || "-"; });
      }
      return rows;
    },
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ["face-chart", range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_scan_logs")
        .select("scan_date")
        .gte("scan_date", range.start)
        .lte("scan_date", range.end);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data as any[]) map.set(r.scan_date, (map.get(r.scan_date) || 0) + 1);
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([d, c]) => ({
          date: new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "short" }),
          count: c,
        }));
    },
  });

  // ===== Accurate attendance summary (skip weekend/future/holiday, merge face_scan ∪ attendance ∪ leaves) =====
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: accurate } = useQuery({
    queryKey: ["face-report-accurate", range.start, range.end, todayStr],
    queryFn: async () => {
      // ⚠️ Face-scan report — นับเฉพาะข้อมูลจากการสแกนหน้า/QR เท่านั้น
      // ไม่ merge กับ attendance table (มาจากการเช็คชื่อมือของครู) เพื่อให้ตัวเลขตรงกับกราฟ/รายการล่าสุด
      const [settingRes, studentsRes, scansRes, leavesRes, eventsRes] = await Promise.all([
        supabase.from("school_settings").select("setting_value").eq("setting_key", "clock_late_threshold").maybeSingle(),
        supabase.from("students").select("id, gender, classrooms!students_classroom_id_fkey(grade_level, name)").eq("status", "active"),
        supabase.from("face_scan_logs").select("student_id, scan_date, scan_time").gte("scan_date", range.start).lte("scan_date", range.end),
        supabase.from("student_leaves").select("student_id, start_date, end_date, status").lte("start_date", range.end).gte("end_date", range.start),
        supabase.from("academic_events").select("event_date, end_date, event_type").eq("event_type", "holiday").lte("event_date", range.end),
      ]);
      const lateThreshold = (settingRes.data?.setting_value as string) || "08:30";
      const holidays = new Set<string>();
      for (const ev of (eventsRes.data as any[]) || []) {
        const s = new Date(ev.event_date);
        const e = new Date(ev.end_date || ev.event_date);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) holidays.add(d.toISOString().slice(0, 10));
      }
      // Effective dates: exclude weekend, future, holiday
      const eff: string[] = [];
      const startD = new Date(range.start), endD = new Date(range.end);
      const cap = endD < new Date(todayStr) ? endD : new Date(todayStr);
      for (let d = new Date(startD); d <= cap; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        const iso = d.toISOString().slice(0, 10);
        if (dow === 0 || dow === 6) continue;
        if (holidays.has(iso)) continue;
        eff.push(iso);
      }
      const effSet = new Set(eff);

      // Index: date -> studentId -> earliest scan time HH:mm:ss
      const scanIdx = new Map<string, Map<string, string>>();
      for (const r of (scansRes.data as any[]) || []) {
        if (!effSet.has(r.scan_date)) continue;
        const t = new Date(r.scan_time).toLocaleTimeString("en-GB", { hour12: false });
        const m = scanIdx.get(r.scan_date) || new Map<string, string>();
        const p = m.get(r.student_id);
        if (!p || t < p) m.set(r.student_id, t);
        scanIdx.set(r.scan_date, m);
      }
      // Leave coverage: studentId -> Set<date>
      const leaveIdx = new Map<string, Set<string>>();
      for (const lv of (leavesRes.data as any[]) || []) {
        if (lv.status === "rejected") continue;
        const s = new Date(lv.start_date), e = new Date(lv.end_date);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {

          const iso = d.toISOString().slice(0, 10);
          if (!effSet.has(iso)) continue;
          const set = leaveIdx.get(lv.student_id) || new Set<string>();
          set.add(iso);
          leaveIdx.set(lv.student_id, set);
        }
      }

      const classKey = (s: any) => {
        const g = s.classrooms?.grade_level || "-";
        const n = s.classrooms?.name || "-";
        return n && n !== g ? `${g}/${n}` : g;
      };
      const classMap = new Map<string, ClassRow>();
      const students = (studentsRes.data as any[]) || [];
      // Pre-init class buckets with size
      for (const s of students) {
        const k = classKey(s);
        const grade = s.classrooms?.grade_level || "-";
        const c = classMap.get(k) || { cls: k, grade, size: 0, sizeM: 0, sizeF: 0, present: 0, presentM: 0, presentF: 0, late: 0, lateM: 0, lateF: 0, leave: 0, absent: 0, absentM: 0, absentF: 0, cd: 0, pct: 0 };
        c.size++;
        if (s.gender === "ชาย") c.sizeM++; else c.sizeF++;
        classMap.set(k, c);
      }
      // Accumulate per (date, student)
      for (const date of eff) {
        const dayScan = scanIdx.get(date) || new Map<string, string>();
        for (const s of students) {
          const k = classKey(s);
          const c = classMap.get(k)!;
          c.cd++;
          const isM = s.gender === "ชาย";
          const t = dayScan.get(s.id);
          const onLeave = leaveIdx.get(s.id)?.has(date);
          let kind: "present" | "late" | "leave" | "absent";
          if (t) {
            kind = t > lateThreshold + ":00" ? "late" : "present";
          } else if (onLeave) kind = "leave";
          else kind = "absent"; // ไม่มีการสแกน = ขาด (report นี้นับเฉพาะการสแกน)
          if (kind === "present") { c.present++; if (isM) c.presentM++; else c.presentF++; }
          else if (kind === "late") { c.late++; if (isM) c.lateM++; else c.lateF++; }
          else if (kind === "leave") c.leave++;
          else { c.absent++; if (isM) c.absentM++; else c.absentF++; }
        }
      }
      const rows = Array.from(classMap.values())
        .map(c => ({ ...c, pct: c.cd > 0 ? Math.round(((c.present + c.late) / c.cd) * 1000) / 10 : 0 }))
        .sort((a, b) => {
          const order: Record<string, number> = { "อ.1": 1, "อ.2": 2, "อ.3": 3, "ป.1": 4, "ป.2": 5, "ป.3": 6, "ป.4": 7, "ป.5": 8, "ป.6": 9, "ม.1": 10, "ม.2": 11, "ม.3": 12, "ม.4": 13, "ม.5": 14, "ม.6": 15 };
          const d = (order[a.grade] ?? 99) - (order[b.grade] ?? 99);
          return d !== 0 ? d : a.cls.localeCompare(b.cls);
        });
      const totals = rows.reduce((acc, c) => ({
        cls: "รวมทั้งหมด", grade: "", size: acc.size + c.size, sizeM: acc.sizeM + c.sizeM, sizeF: acc.sizeF + c.sizeF,
        present: acc.present + c.present, presentM: acc.presentM + c.presentM, presentF: acc.presentF + c.presentF,
        late: acc.late + c.late, lateM: acc.lateM + c.lateM, lateF: acc.lateF + c.lateF,
        leave: acc.leave + c.leave,
        absent: acc.absent + c.absent, absentM: acc.absentM + c.absentM, absentF: acc.absentF + c.absentF,
        cd: acc.cd + c.cd, pct: 0,
      }) as ClassRow, { cls: "รวมทั้งหมด", grade: "", size: 0, sizeM: 0, sizeF: 0, present: 0, presentM: 0, presentF: 0, late: 0, lateM: 0, lateF: 0, leave: 0, absent: 0, absentM: 0, absentF: 0, cd: 0, pct: 0 } as ClassRow);
      totals.pct = totals.cd > 0 ? Math.round(((totals.present + totals.late) / totals.cd) * 1000) / 10 : 0;
      return { effectiveDates: eff, lateThreshold, rows, totals };
    },
    staleTime: 60_000,
  });



  // Filter by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return (logs as any[]).filter((r) => {
      const s = r.students;
      const name = `${s.prefix || ""}${s.first_name} ${s.last_name}`.toLowerCase();
      const code = (s.student_code || "").toLowerCase();
      const cls = (s.classrooms?.name || `${s.classrooms?.grade_level || ""}/${s.classrooms?.name || ""}`).toLowerCase();
      return name.includes(q) || code.includes(q) || cls.includes(q);
    });
  }, [logs, search]);

  // Group
  const grouped = useMemo(() => {
    const m = new Map<string, { key: string; label: string; subtitle?: string; count: number; lastTime: string }>();
    for (const r of filtered as any[]) {
      const s = r.students;
      if (groupMode === "individual") {
        const key = s.id;
        const label = `${s.prefix || ""}${s.first_name} ${s.last_name}`;
        const subtitle = `${s.student_code || "-"} • ${s.classrooms?.name || `${s.classrooms?.grade_level || "-"}/${s.classrooms?.name || "-"}`}`;
        const cur = m.get(key) || { key, label, subtitle, count: 0, lastTime: r.scan_time };
        cur.count++;
        if (r.scan_time > cur.lastTime) cur.lastTime = r.scan_time;
        m.set(key, cur);
      } else {
        const key = s.classrooms?.name || `${s.classrooms?.grade_level || "-"}/${s.classrooms?.name || "-"}`;
        const cur = m.get(key) || { key, label: key, count: 0, lastTime: r.scan_time };
        cur.count++;
        if (r.scan_time > cur.lastTime) cur.lastTime = r.scan_time;
        m.set(key, cur);
      }
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [filtered, groupMode]);

  const gradeOrder = (g: string) => {
    const map: Record<string, number> = { "อ.1": 1, "อ.2": 2, "อ.3": 3, "ป.1": 4, "ป.2": 5, "ป.3": 6, "ป.4": 7, "ป.5": 8, "ป.6": 9, "ม.1": 10, "ม.2": 11, "ม.3": 12, "ม.4": 13, "ม.5": 14, "ม.6": 15 };
    return map[g] ?? 99;
  };

  const exportXlsx = async () => {
    try {
      const XLSX = await import("xlsx");

      // late threshold
      const { data: setting } = await supabase
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", "clock_late_threshold")
        .maybeSingle();
      const lateThreshold = (setting?.setting_value as string) || "08:30";

      // all active students
      const { data: studentsAll } = await supabase
        .from("students")
        .select("id, prefix, first_name, last_name, student_code, gender, classrooms!students_classroom_id_fkey(grade_level, name)")
        .eq("status", "active");

      const students = (studentsAll || []) as any[];
      const classKey = (s: any) => {
        const g = s.classrooms?.grade_level || "-";
        const n = s.classrooms?.name || "-";
        return n && n !== g ? `${g}/${n}` : g;
      };

      // build date list in range
      const startD = new Date(range.start);
      const endD = new Date(range.end);
      const dates: string[] = [];
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }

      // index logs: date -> studentId -> earliest time (HH:mm:ss)
      const logIdx = new Map<string, Map<string, string>>();
      for (const r of filtered as any[]) {
        const t = new Date(r.scan_time).toLocaleTimeString("en-GB", { hour12: false });
        const m = logIdx.get(r.scan_date) || new Map<string, string>();
        const prev = m.get(r.students.id);
        if (!prev || t < prev) m.set(r.students.id, t);
        logIdx.set(r.scan_date, m);
      }

      // group students by class
      const classMap = new Map<string, { key: string; grade: string; students: any[] }>();
      for (const s of students) {
        const k = classKey(s);
        const grade = s.classrooms?.grade_level || "-";
        const c = classMap.get(k) || { key: k, grade, students: [] };
        c.students.push(s);
        classMap.set(k, c);
      }
      const classList = Array.from(classMap.values()).sort((a, b) => {
        const d = gradeOrder(a.grade) - gradeOrder(b.grade);
        return d !== 0 ? d : a.key.localeCompare(b.key);
      });

      // Build summary rows: for each date, for each class
      type Row = { date: string; cls: string; male: number; female: number; arrived: number; late: number; lateM: number; lateF: number; absent: number; absentM: number; absentF: number; totalM: number; totalF: number; total: number };
      const summaryRows: Row[] = [];
      const absentList: { date: string; cls: string; code: string; name: string; gender: string }[] = [];
      const lateList: { date: string; cls: string; code: string; name: string; gender: string; time: string }[] = [];

      for (const date of dates) {
        const dayLog = logIdx.get(date) || new Map<string, string>();
        for (const c of classList) {
          let male = 0, female = 0, late = 0, lateM = 0, lateF = 0, absent = 0, absentM = 0, absentF = 0, totalM = 0, totalF = 0;
          for (const s of c.students) {
            const isM = s.gender === "ชาย";
            if (isM) totalM++; else totalF++;
            const t = dayLog.get(s.id);
            if (t) {
              if (isM) male++; else female++;
              if (t > lateThreshold + ":00") {
                late++;
                if (isM) lateM++; else lateF++;
                lateList.push({
                  date, cls: c.key, code: s.student_code || "",
                  name: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
                  gender: s.gender || "-", time: t,
                });
              }
            } else {
              absent++;
              if (isM) absentM++; else absentF++;
              absentList.push({
                date, cls: c.key, code: s.student_code || "",
                name: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
                gender: s.gender || "-",
              });
            }
          }
          if (c.students.length === 0) continue;
          summaryRows.push({
            date, cls: c.key, male, female, arrived: male + female,
            late, lateM, lateF, absent, absentM, absentF, totalM, totalF, total: c.students.length,
          });
        }
      }


      // ===== Build workbook =====
      const wb = XLSX.utils.book_new();

      // --- Sheet 1: สรุป ---
      const aoa: any[][] = [];
      const periodLabel = { day: "รายวัน", week: "รายสัปดาห์", month: "รายเดือน", term: "รายเทอม" }[period];
      aoa.push([`รายงานสรุปการเข้าเรียน (${periodLabel})`]);
      aoa.push([`ช่วง: ${range.label}`, `เกณฑ์สาย: หลัง ${accurate?.lateThreshold || lateThreshold} น.`]);
      aoa.push([`วันเรียนจริงในช่วง: ${accurate?.effectiveDates.length ?? 0} วัน (ตัดเสาร์-อาทิตย์/วันหยุด/วันในอนาคต)`]);
      aoa.push([]);

      // ===== ภาพรวมทั้งช่วง (per-class, accurate) =====
      if (accurate && accurate.rows.length > 0) {
        aoa.push([`ภาพรวมทั้งช่วง (วันเรียนจริง ${accurate.effectiveDates.length} วัน)`]);
        aoa.push(["ชั้น", "นักเรียน", "ชาย", "หญิง", "มา", "สาย", "ลา", "ขาด (ช)", "ขาด (ญ)", "ขาดรวม", "คน-วันที่นับ", "% เข้าเรียน"]);
        for (const a of accurate.rows) {
          aoa.push([a.cls, a.size, a.sizeM, a.sizeF, a.present, a.late, a.leave, a.absentM, a.absentF, a.absent, a.cd, `${a.pct}%`]);
        }
        const t = accurate.totals;
        aoa.push(["รวมทั้งหมด", t.size, t.sizeM, t.sizeF, t.present, t.late, t.leave, t.absentM, t.absentF, t.absent, t.cd, `${t.pct}%`]);
        aoa.push([]);
      }




      // ===== แยกตามวัน =====
      const byDate = new Map<string, Row[]>();
      for (const r of summaryRows) {
        const arr = byDate.get(r.date) || [];
        arr.push(r);
        byDate.set(r.date, arr);
      }

      if (dates.length > 1) {
        aoa.push(["รายละเอียดแยกตามวัน"]);
        aoa.push([]);
      }
      for (const date of dates) {
        const rows = byDate.get(date) || [];
        if (rows.length === 0) continue;
        const thaiDate = new Date(date).toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        aoa.push([`วันที่ ${thaiDate}`]);
        aoa.push(["ชั้น", "ชาย (มา)", "หญิง (มา)", "รวมมาเรียน", "สาย", "ขาด (ชาย)", "ขาด (หญิง)", "ขาดรวม", "ชายทั้งหมด", "หญิงทั้งหมด", "นักเรียนทั้งหมด", "% เข้าเรียน"]);
        let tM = 0, tF = 0, tA = 0, tL = 0, tAbM = 0, tAbF = 0, tAb = 0, tTM = 0, tTF = 0, tT = 0;
        for (const r of rows) {
          const pct = r.total > 0 ? Math.round((r.arrived / r.total) * 1000) / 10 : 0;
          aoa.push([r.cls, r.male, r.female, r.arrived, r.late, r.absentM, r.absentF, r.absent, r.totalM, r.totalF, r.total, `${pct}%`]);
          tM += r.male; tF += r.female; tA += r.arrived; tL += r.late;
          tAbM += r.absentM; tAbF += r.absentF; tAb += r.absent;
          tTM += r.totalM; tTF += r.totalF; tT += r.total;
        }
        const pctAll = tT > 0 ? Math.round((tA / tT) * 1000) / 10 : 0;
        aoa.push(["รวมทั้งหมด", tM, tF, tA, tL, tAbM, tAbF, tAb, tTM, tTF, tT, `${pctAll}%`]);
        aoa.push([]);
      }


      if (lateList.length > 0) {
        aoa.push(["รายชื่อนักเรียนสาย"]);
        aoa.push(["วันที่", "ชั้น", "รหัส", "ชื่อ", "เพศ", "เวลาสแกน"]);
        for (const x of lateList) aoa.push([x.date, x.cls, x.code, x.name, x.gender, x.time]);
        aoa.push([]);
      }
      if (absentList.length > 0) {
        aoa.push(["รายชื่อนักเรียนขาด (ไม่ได้สแกน)"]);
        aoa.push(["วันที่", "ชั้น", "รหัส", "ชื่อ", "เพศ"]);
        for (const x of absentList) aoa.push([x.date, x.cls, x.code, x.name, x.gender]);
      }

      const ws1 = XLSX.utils.aoa_to_sheet(aoa);
      ws1["!cols"] = [{ wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];

      // Style: title, section headers, totals
      const range1 = XLSX.utils.decode_range(ws1["!ref"] as string);
      ws1["!merges"] = ws1["!merges"] || [];
      ws1["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } });
      ws1["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
      ws1["!merges"].push({ s: { r: 1, c: 6 }, e: { r: 1, c: 11 } });


      for (let R = 0; R <= range1.e.r; R++) {
        for (let C = 0; C <= range1.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws1[addr];
          if (!cell) continue;
          cell.s = cell.s || {};
          cell.s.alignment = { horizontal: C === 0 ? "left" : "center", vertical: "center", wrapText: true };
          cell.s.font = { name: "TH Sarabun New", sz: 14 };
          cell.s.border = {
            top: { style: "thin", color: { rgb: "DDDDDD" } },
            bottom: { style: "thin", color: { rgb: "DDDDDD" } },
            left: { style: "thin", color: { rgb: "DDDDDD" } },
            right: { style: "thin", color: { rgb: "DDDDDD" } },
          };
        }
        const firstCell = ws1[XLSX.utils.encode_cell({ r: R, c: 0 })];
        const text = firstCell?.v ? String(firstCell.v) : "";
        if (R === 0) {
          firstCell.s = { ...firstCell.s, font: { name: "TH Sarabun New", sz: 20, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } }, alignment: { horizontal: "center", vertical: "center" } };
        } else if (text.startsWith("วันที่ ")) {
          firstCell.s = { ...firstCell.s, font: { name: "TH Sarabun New", sz: 15, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0F766E" } } };
          ws1["!merges"].push({ s: { r: R, c: 0 }, e: { r: R, c: 11 } });
        } else if (text.startsWith("ภาพรวมทั้งช่วง") || text === "รายละเอียดแยกตามวัน") {
          firstCell.s = { ...firstCell.s, font: { name: "TH Sarabun New", sz: 16, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E40AF" } } };
          ws1["!merges"].push({ s: { r: R, c: 0 }, e: { r: R, c: 11 } });
        } else if (text === "ชั้น" || text === "วันที่") {
          for (let C = 0; C <= range1.e.c; C++) {
            const a = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws1[a]) ws1[a].s = { ...ws1[a].s, font: { name: "TH Sarabun New", sz: 14, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "475569" } } };
          }
        } else if (text === "รวมทั้งหมด") {
          for (let C = 0; C <= range1.e.c; C++) {
            const a = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws1[a]) ws1[a].s = { ...ws1[a].s, font: { name: "TH Sarabun New", sz: 14, bold: true }, fill: { fgColor: { rgb: "FEF3C7" } } };
          }
        } else if (text === "รายชื่อนักเรียนสาย" || text === "รายชื่อนักเรียนขาด (ไม่ได้สแกน)") {
          firstCell.s = { ...firstCell.s, font: { name: "TH Sarabun New", sz: 15, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: text.includes("สาย") ? "D97706" : "DC2626" } } };
          ws1["!merges"].push({ s: { r: R, c: 0 }, e: { r: R, c: 11 } });
        }

      }

      XLSX.utils.book_append_sheet(wb, ws1, "สรุป");

      // --- Sheet 2: บันทึกการสแกน ---
      const logAoa: any[][] = [["วันที่", "เวลา", "รหัส", "ชื่อ", "เพศ", "ชั้น", "ประเภท", "วิธีบันทึก", "ครูผู้บันทึก", "ความมั่นใจ"]];
      for (const r of filtered as any[]) {
        const s = r.students;
        const method = r.entry_method === "manual" ? "กรอกรหัส" : r.entry_method === "qr" ? "QR" : "ใบหน้า";
        logAoa.push([
          r.scan_date,
          new Date(r.scan_time).toLocaleTimeString("en-GB", { hour12: false }),
          s.student_code || "",
          `${s.prefix || ""}${s.first_name} ${s.last_name}`,
          s.gender || "-",
          s.classrooms?.name || `${s.classrooms?.grade_level || "-"}/${s.classrooms?.name || "-"}`,
          r.scan_type || "",
          method,
          r.scanner_name || "-",
          `${Math.round((r.confidence || 0) * 100)}%`,
        ]);
      }
      const ws2 = XLSX.utils.aoa_to_sheet(logAoa);
      ws2["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 12 }];
      const range2 = XLSX.utils.decode_range(ws2["!ref"] as string);
      for (let C = 0; C <= range2.e.c; C++) {
        const a = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws2[a]) ws2[a].s = { font: { name: "TH Sarabun New", sz: 14, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } }, alignment: { horizontal: "center", vertical: "center" } };
      }
      for (let R = 1; R <= range2.e.r; R++) {
        for (let C = 0; C <= range2.e.c; C++) {
          const a = XLSX.utils.encode_cell({ r: R, c: C });
          if (ws2[a]) ws2[a].s = { font: { name: "TH Sarabun New", sz: 13 }, alignment: { horizontal: C === 3 ? "left" : "center", vertical: "center" } };
        }
      }
      ws2["!autofilter"] = { ref: ws2["!ref"] as string };
      ws2["!freeze"] = { xSplit: 0, ySplit: 1 } as any;

      XLSX.utils.book_append_sheet(wb, ws2, "บันทึกการสแกน");

      // --- Per-class sheets (one tab per classroom) ---
      const gradePalette: Record<string, { header: string; sub: string; accent: string; tab: string }> = {
        "อ.1": { header: "7C3AED", sub: "EDE9FE", accent: "8B5CF6", tab: "C4B5FD" },
        "อ.2": { header: "7C3AED", sub: "EDE9FE", accent: "8B5CF6", tab: "C4B5FD" },
        "อ.3": { header: "7C3AED", sub: "EDE9FE", accent: "8B5CF6", tab: "C4B5FD" },
        "ป.1": { header: "DB2777", sub: "FCE7F3", accent: "EC4899", tab: "F9A8D4" },
        "ป.2": { header: "E11D48", sub: "FFE4E6", accent: "F43F5E", tab: "FDA4AF" },
        "ป.3": { header: "EA580C", sub: "FFEDD5", accent: "F97316", tab: "FDBA74" },
        "ป.4": { header: "CA8A04", sub: "FEF9C3", accent: "EAB308", tab: "FDE68A" },
        "ป.5": { header: "16A34A", sub: "DCFCE7", accent: "22C55E", tab: "86EFAC" },
        "ป.6": { header: "0D9488", sub: "CCFBF1", accent: "14B8A6", tab: "5EEAD4" },
        "ม.1": { header: "0284C7", sub: "E0F2FE", accent: "0EA5E9", tab: "7DD3FC" },
        "ม.2": { header: "2563EB", sub: "DBEAFE", accent: "3B82F6", tab: "93C5FD" },
        "ม.3": { header: "4F46E5", sub: "E0E7FF", accent: "6366F1", tab: "A5B4FC" },
        "ม.4": { header: "7C3AED", sub: "EDE9FE", accent: "8B5CF6", tab: "C4B5FD" },
        "ม.5": { header: "9333EA", sub: "F3E8FF", accent: "A855F7", tab: "D8B4FE" },
        "ม.6": { header: "C026D3", sub: "FAE8FF", accent: "D946EF", tab: "F0ABFC" },
      };
      const defPal = { header: "2563EB", sub: "DBEAFE", accent: "3B82F6", tab: "93C5FD" };

      const sanitizeSheetName = (n: string) => n.replace(/[\\\/\?\*\[\]:]/g, "-").slice(0, 31);
      const usedNames = new Set<string>(["สรุป", "บันทึกการสแกน"]);

      for (const c of classList) {
        if (c.students.length === 0) continue;
        const pal = gradePalette[c.grade] || defPal;

        const studs = [...c.students].sort((a, b) => (a.student_code || "").localeCompare(b.student_code || "") || `${a.first_name}${a.last_name}`.localeCompare(`${b.first_name}${b.last_name}`));

        const aoaC: any[][] = [];
        aoaC.push([`รายงานการสแกนเข้าโรงเรียน • ชั้น ${c.key}`]);
        aoaC.push([`ช่วง: ${range.label}`, "", "", "", `จำนวนวัน: ${dates.length}`, "", "", `นักเรียน: ${c.students.length} คน`]);
        aoaC.push([`เกณฑ์สาย: หลัง ${lateThreshold} น.`]);
        aoaC.push([]);

        let cArrived = 0, cLate = 0, cAbsent = 0, cAbsentM = 0, cAbsentF = 0, cLateM = 0, cLateF = 0;
        for (const date of dates) {
          const dayLog = logIdx.get(date) || new Map<string, string>();
          for (const s of studs) {
            const isM = s.gender === "ชาย";
            const t = dayLog.get(s.id);
            if (t) {
              cArrived++;
              if (t > lateThreshold + ":00") {
                cLate++;
                if (isM) cLateM++; else cLateF++;
              }
            } else {
              cAbsent++;
              if (isM) cAbsentM++; else cAbsentF++;
            }
          }
        }
        const cTotalCD = c.students.length * dates.length;
        const cPct = cTotalCD > 0 ? Math.round((cArrived / cTotalCD) * 1000) / 10 : 0;

        aoaC.push(["สรุปภาพรวมของชั้น"]);
        aoaC.push(["มาเรียน (คน-วัน)", "สาย (ชาย)", "สาย (หญิง)", "สายรวม", "ขาด (ชาย)", "ขาด (หญิง)", "ขาดรวม", "คน × วัน รวม", "% เข้าเรียนเฉลี่ย"]);
        aoaC.push([cArrived, cLateM, cLateF, cLate, cAbsentM, cAbsentF, cAbsent, cTotalCD, `${cPct}%`]);
        aoaC.push([]);


        aoaC.push(["ตารางรายวัน (เวลาที่สแกน / ขาด)"]);
        const header = ["ลำดับ", "รหัสนักเรียน", "ชื่อ - สกุล", "เพศ"];
        for (const d of dates) {
          const dd = new Date(d);
          header.push(dd.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" }));
        }
        header.push("มา", "สาย", "ขาด", "% เข้าเรียน");
        aoaC.push(header);

        const startGridRow = aoaC.length;
        let idx = 0;
        for (const s of studs) {
          idx++;
          const row: any[] = [
            idx,
            s.student_code || "",
            `${s.prefix || ""}${s.first_name} ${s.last_name}`,
            s.gender || "-",
          ];
          let sA = 0, sL = 0, sAb = 0;
          for (const d of dates) {
            const t = (logIdx.get(d) || new Map()).get(s.id);
            if (t) {
              sA++;
              const late = t > lateThreshold + ":00";
              if (late) sL++;
              row.push(t.slice(0, 5) + (late ? " ⚠" : ""));
            } else {
              sAb++;
              row.push("ขาด");
            }
          }
          const pct = dates.length > 0 ? Math.round((sA / dates.length) * 1000) / 10 : 0;
          row.push(sA, sL, sAb, `${pct}%`);
          aoaC.push(row);
        }

        const wsC = XLSX.utils.aoa_to_sheet(aoaC);
        const totalCols = 4 + dates.length + 4;
        wsC["!cols"] = [
          { wch: 6 }, { wch: 12 }, { wch: 26 }, { wch: 6 },
          ...dates.map(() => ({ wch: 10 })),
          { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 10 },
        ];
        wsC["!freeze"] = { xSplit: 4, ySplit: startGridRow } as any;
        wsC["!merges"] = wsC["!merges"] || [];
        wsC["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
        wsC["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } });
        wsC["!merges"].push({ s: { r: 1, c: 4 }, e: { r: 1, c: 6 } });
        wsC["!merges"].push({ s: { r: 1, c: 7 }, e: { r: 1, c: totalCols - 1 } });
        wsC["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } });
        wsC["!merges"].push({ s: { r: 4, c: 0 }, e: { r: 4, c: totalCols - 1 } });
        const dailyHeaderRow = startGridRow - 2;
        wsC["!merges"].push({ s: { r: dailyHeaderRow, c: 0 }, e: { r: dailyHeaderRow, c: totalCols - 1 } });

        const rangeC = XLSX.utils.decode_range(wsC["!ref"] as string);
        for (let R = 0; R <= rangeC.e.r; R++) {
          for (let C = 0; C <= rangeC.e.c; C++) {
            const a = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = wsC[a];
            if (!cell) continue;
            cell.s = cell.s || {};
            cell.s.font = { name: "TH Sarabun New", sz: 13 };
            cell.s.alignment = { horizontal: C === 2 ? "left" : "center", vertical: "center", wrapText: true };
            cell.s.border = {
              top: { style: "thin", color: { rgb: "E5E7EB" } },
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
              left: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "E5E7EB" } },
            };
          }
        }
        const t0 = wsC[XLSX.utils.encode_cell({ r: 0, c: 0 })];
        if (t0) t0.s = { ...t0.s, font: { name: "TH Sarabun New", sz: 22, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: pal.header } }, alignment: { horizontal: "center", vertical: "center" } };
        for (let C = 0; C <= totalCols - 1; C++) {
          const a = wsC[XLSX.utils.encode_cell({ r: 1, c: C })];
          if (a) a.s = { ...a.s, font: { name: "TH Sarabun New", sz: 13, bold: true, color: { rgb: "1F2937" } }, fill: { fgColor: { rgb: pal.sub } } };
        }
        const t2 = wsC[XLSX.utils.encode_cell({ r: 2, c: 0 })];
        if (t2) t2.s = { ...t2.s, font: { name: "TH Sarabun New", sz: 12, italic: true, color: { rgb: "6B7280" } } };
        const sh = wsC[XLSX.utils.encode_cell({ r: 4, c: 0 })];
        if (sh) sh.s = { ...sh.s, font: { name: "TH Sarabun New", sz: 14, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: pal.accent } }, alignment: { horizontal: "left", vertical: "center" } };
        // Summary table: 9 cols — late(M/F/total) คือคอลัมน์ 1-3 (เหลือง), absent(M/F/total) คือ 4-6 (แดง), pct คือ 8 (เขียว)
        for (let C = 0; C < 9; C++) {
          const h = wsC[XLSX.utils.encode_cell({ r: 5, c: C })];
          if (h) h.s = { ...h.s, font: { name: "TH Sarabun New", sz: 13, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "475569" } } };
          const v = wsC[XLSX.utils.encode_cell({ r: 6, c: C })];
          const isLate = C >= 1 && C <= 3;
          const isAbsent = C >= 4 && C <= 6;
          const isPct = C === 8;
          const color = isLate ? "B45309" : isAbsent ? "B91C1C" : isPct ? "047857" : "1F2937";
          if (v) v.s = { ...v.s, font: { name: "TH Sarabun New", sz: 14, bold: true, color: { rgb: color } }, fill: { fgColor: { rgb: "FEF3C7" } } };
        }

        const dh = wsC[XLSX.utils.encode_cell({ r: dailyHeaderRow, c: 0 })];
        if (dh) dh.s = { ...dh.s, font: { name: "TH Sarabun New", sz: 14, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: pal.accent } }, alignment: { horizontal: "left", vertical: "center" } };
        const hdrRow = startGridRow - 1;
        for (let C = 0; C <= totalCols - 1; C++) {
          const h = wsC[XLSX.utils.encode_cell({ r: hdrRow, c: C })];
          if (h) h.s = { ...h.s, font: { name: "TH Sarabun New", sz: 12, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: pal.header } } };
        }
        for (let R = startGridRow; R <= rangeC.e.r; R++) {
          const zebra = (R - startGridRow) % 2 === 1 ? pal.sub : "FFFFFF";
          for (let C = 0; C <= totalCols - 1; C++) {
            const a = wsC[XLSX.utils.encode_cell({ r: R, c: C })];
            if (!a) continue;
            const txt = String(a.v ?? "");
            let fg = zebra;
            let color = "1F2937";
            let bold = false;
            if (C >= 4 && C < 4 + dates.length) {
              if (txt === "ขาด") { fg = "FEE2E2"; color = "B91C1C"; bold = true; }
              else if (txt.includes("⚠")) { fg = "FEF3C7"; color = "B45309"; bold = true; }
              else if (txt) { fg = "DCFCE7"; color = "166534"; }
            } else if (C === 4 + dates.length + 1 && Number(a.v) > 0) {
              fg = "FEF3C7"; color = "B45309"; bold = true;
            } else if (C === 4 + dates.length + 2 && Number(a.v) > 0) {
              fg = "FEE2E2"; color = "B91C1C"; bold = true;
            } else if (C === 4 + dates.length) {
              fg = "DCFCE7"; color = "166534"; bold = true;
            } else if (C === 4 + dates.length + 3) {
              fg = pal.sub; bold = true;
            }
            a.s = { ...a.s, font: { name: "TH Sarabun New", sz: 13, bold, color: { rgb: color } }, fill: { fgColor: { rgb: fg } } };
          }
        }
        wsC["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: hdrRow, c: 0 }, e: { r: rangeC.e.r, c: totalCols - 1 } }) };

        (wsC as any)["!tabColor"] = { rgb: pal.tab };

        let name = sanitizeSheetName(`ชั้น ${c.key}`);
        let i = 2;
        while (usedNames.has(name)) { name = sanitizeSheetName(`ชั้น ${c.key} (${i++})`); }
        usedNames.add(name);
        XLSX.utils.book_append_sheet(wb, wsC, name);
      }

      (ws1 as any)["!tabColor"] = { rgb: "2563EB" };
      (ws2 as any)["!tabColor"] = { rgb: "0F766E" };

      XLSX.writeFile(wb, `รายงานการสแกนเข้าโรงเรียน-${range.start}_${range.end}.xlsx`, { cellStyles: true });
      toast.success("ส่งออกรายงานเรียบร้อย");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "ส่งออกไม่สำเร็จ");
    }
  };

  const sendReportToGoogleChat = async () => {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("face-scan-summary", {
        body: { period, start: range.start, end: range.end, broadcast: true },
      });
      if (error) throw error;
      toast.success("ส่งสรุปเข้า Google Chat แล้ว");
    } catch (e: any) {
      toast.error(e.message || "ส่งไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4" />รายงานสแกนหน้า</h3>
            <div className="flex gap-2">
              <Button onClick={exportXlsx} variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export Excel</Button>
              <Button onClick={sendReportToGoogleChat} disabled={sending} size="sm"><Send className="w-4 h-4 mr-2" />ส่งสรุปเข้า Google Chat</Button>
            </div>
          </div>

          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="day">รายวัน</TabsTrigger>
              <TabsTrigger value="week">รายสัปดาห์</TabsTrigger>
              <TabsTrigger value="month">รายเดือน</TabsTrigger>
              <TabsTrigger value="term">รายเทอม</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <DateInput value={refDate} onChange={(e) => setRefDate(e.target.value)} className="w-44" />
            <Badge variant="outline">{range.label}</Badge>
            <Badge>{filtered.length} รายการ</Badge>
            <div className="ml-auto flex gap-2">
              <Select value={groupMode} onValueChange={(v) => setGroupMode(v as any)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual"><User className="w-3 h-3 inline mr-1" />รายคน</SelectItem>
                  <SelectItem value="class"><Users className="w-3 h-3 inline mr-1" />รายชั้น</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ / ชั้น / รหัส"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-60"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Accurate attendance summary (highlight) ===== */}
      {accurate && (
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-end justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  ภาพรวมการเข้าเรียน
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {range.label} • นับเฉพาะวันเรียนจริง <b>{accurate.effectiveDates.length}</b> วัน
                  (ตัดเสาร์-อาทิตย์ / วันหยุด / วันในอนาคต) • เกณฑ์สาย {accurate.lateThreshold} น.
                </p>
              </div>
              <Badge variant="outline" className="text-sm px-3 py-1.5 font-bold bg-background">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                {accurate.totals.size} คน
              </Badge>
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiTile color="emerald" icon={<CheckCircle2 className="w-5 h-5" />} label="เข้าเรียน (รวมสาย)" value={`${accurate.totals.pct}%`}
                sub={`${(accurate.totals.present + accurate.totals.late).toLocaleString()} / ${accurate.totals.cd.toLocaleString()} คน-วัน • ตรงเวลา ${accurate.totals.present.toLocaleString()}`} />
              <KpiTile color="amber" icon={<Clock4 className="w-5 h-5" />} label="สาย" value={accurate.totals.late.toLocaleString()}
                sub={`ช ${accurate.totals.lateM} • ญ ${accurate.totals.lateF}`} />
              <KpiTile color="sky" icon={<FileMinus2 className="w-5 h-5" />} label="ลา" value={accurate.totals.leave.toLocaleString()}
                sub="มีใบลา / รออนุมัติ" />
              <KpiTile color="rose" icon={<XCircle className="w-5 h-5" />} label="ขาด" value={accurate.totals.absent.toLocaleString()}
                sub={`ช ${accurate.totals.absentM} • ญ ${accurate.totals.absentF}`} />
              <KpiTile color="violet" icon={<Users className="w-5 h-5" />} label="วันเรียนจริง" value={accurate.effectiveDates.length.toLocaleString()}
                sub="วันที่นับ" />
            </div>

            {/* Per-class table */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-gradient-to-r from-neutral to-neutral text-white">
                    <tr>
                      <th className="text-left p-2.5 font-semibold">ชั้น</th>
                      <th className="text-center p-2.5 font-semibold">นักเรียน</th>
                      <th className="text-center p-2.5 font-semibold text-success">มา (ตรงเวลา)</th>
                      <th className="text-center p-2.5 font-semibold text-warning">สาย</th>
                      <th className="text-center p-2.5 font-semibold text-info">ลา</th>
                      <th className="text-center p-2.5 font-semibold text-danger">ขาด</th>
                      <th className="text-right p-2.5 font-semibold">% เข้าเรียน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accurate.rows.map((r, i) => (
                      <tr key={r.cls} className={`border-b transition-colors hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
                        <td className="p-2.5 font-bold">{r.cls}</td>
                        <td className="p-2.5 text-center text-muted-foreground">{r.size}<span className="text-xs ml-1">(ช{r.sizeM}/ญ{r.sizeF})</span></td>
                        <td className="p-2.5 text-center"><span className="font-semibold text-success">{r.present}</span></td>
                        <td className="p-2.5 text-center"><span className={r.late ? "font-semibold text-warning" : "text-muted-foreground"}>{r.late}</span></td>
                        <td className="p-2.5 text-center"><span className={r.leave ? "font-semibold text-info" : "text-muted-foreground"}>{r.leave}</span></td>
                        <td className="p-2.5 text-center"><span className={r.absent ? "font-semibold text-danger" : "text-muted-foreground"}>{r.absent}</span></td>
                        <td className="p-2.5 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${r.pct >= 90 ? "bg-success-soft text-success-soft-foreground" : r.pct >= 75 ? "bg-warning-soft text-warning-soft-foreground" : "bg-danger-soft text-danger-soft-foreground"}`}>
                            {r.pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {accurate.rows.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">ยังไม่มีข้อมูลในช่วงนี้</td></tr>
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur">
                    <tr className="font-bold border-t-2">
                      <td className="p-2.5">รวมทั้งหมด</td>
                      <td className="p-2.5 text-center">{accurate.totals.size}</td>
                      <td className="p-2.5 text-center text-success">{accurate.totals.present}</td>
                      <td className="p-2.5 text-center text-warning">{accurate.totals.late}</td>
                      <td className="p-2.5 text-center text-info">{accurate.totals.leave}</td>
                      <td className="p-2.5 text-center text-danger">{accurate.totals.absent}</td>
                      <td className="p-2.5 text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold ${accurate.totals.pct >= 90 ? "bg-success text-success-foreground" : accurate.totals.pct >= 75 ? "bg-warning text-warning-foreground" : "bg-danger text-danger-foreground"}`}>
                          {accurate.totals.pct}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}



      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3">แนวโน้มในช่วง</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="font-semibold">สรุปแบบ{groupMode === "individual" ? "รายคน" : "รายชั้น"}</h4>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="text-left p-2">{groupMode === "individual" ? "ชื่อ" : "ชั้นเรียน"}</th>
                  <th className="text-left p-2">รายละเอียด</th>
                  <th className="text-right p-2">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => (
                  <tr key={g.key} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{g.label}</td>
                    <td className="p-2 text-muted-foreground">{g.subtitle || "-"}</td>
                    <td className="p-2 text-right"><Badge>{g.count}</Badge></td>
                  </tr>
                ))}
                {grouped.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">ไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="font-semibold">รายการการสแกน</h4>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="text-left p-2">วันที่</th>
                  <th className="text-left p-2">เวลา</th>
                  <th className="text-center p-2">รูปเทียบ</th>
                  <th className="text-left p-2">ชื่อ</th>
                  <th className="text-left p-2">รหัส</th>
                  <th className="text-left p-2">ชั้น</th>
                  <th className="text-center p-2">วิธีบันทึก</th>
                  <th className="text-left p-2">ครูผู้บันทึก</th>
                  <th className="text-right p-2">ความมั่นใจ</th>
                </tr>
              </thead>
              <tbody>
                {(filtered as any[]).slice(0, 500).map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">{r.scan_date}</td>
                    <td className="p-2">{new Date(r.scan_time).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted border" title="รูปลงทะเบียน">
                          {r.students.photo_url ? (
                            <img src={r.students.photo_url} alt="ลงทะเบียน" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground">-</div>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs">⇄</span>
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted border border-success/40" title="รูปที่ตรวจพบ">
                          {r.captured_face_url ? (
                            <img src={r.captured_face_url} alt="ที่ตรวจพบ" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground">-</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2">{r.students.prefix}{r.students.first_name} {r.students.last_name}</td>
                    <td className="p-2 text-muted-foreground">{r.students.student_code}</td>
                    <td className="p-2">{r.students.classrooms?.name || `${r.students.classrooms?.grade_level || "-"}/${r.students.classrooms?.name || "-"}`}</td>
                    <td className="p-2 text-center">
                      <Badge variant={r.entry_method === "manual" ? "secondary" : "outline"} className="text-[10px]">
                        {r.entry_method === "manual" ? "กรอกรหัส" : r.entry_method === "qr" ? "QR" : "ใบหน้า"}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs">{r.scanner_name || "-"}</td>
                    <td className="p-2 text-right"><Badge variant="outline">{Math.round((r.confidence || 0) * 100)}%</Badge></td>
                  </tr>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 500 && (
            <p className="text-xs text-muted-foreground">แสดง 500 รายการแรก — กด Export Excel เพื่อดูทั้งหมด</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FaceReportTab;
