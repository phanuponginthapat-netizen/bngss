import { useState, useMemo } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileSpreadsheet, TrendingUp, Users, AlertTriangle, CalendarRange,
  CheckCircle2, XCircle, Clock, Stethoscope, FileText, Search, Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

interface Props {
  students: any[];
  classrooms: any[];
  filteredClassrooms: any[];
  gradeFilter: string;
  setGradeFilter: (v: string) => void;
  classroomFilter: string;
  setClassroomFilter: (v: string) => void;
  gradeOptions: string[];
  records: any[];
}

type RangePreset = "today" | "week" | "month" | "term" | "custom";

const STATUS_COLORS: Record<string, string> = {
  present: "hsl(142 71% 45%)",
  absent: "hsl(0 84% 60%)",
  late: "hsl(38 92% 50%)",
  sick: "hsl(199 89% 48%)",
  leave: "hsl(271 81% 56%)",
};

const STATUS_LABEL_TH: Record<string, string> = {
  present: "มา", absent: "ขาด", late: "สาย", sick: "ป่วย", leave: "ลา",
};
const STATUS_LABEL_EN: Record<string, string> = {
  present: "Present", absent: "Absent", late: "Late", sick: "Sick", leave: "Leave",
};

export function AttendanceReportTab({
  students, classrooms, filteredClassrooms,
  gradeFilter, setGradeFilter, classroomFilter, setClassroomFilter,
  gradeOptions, records,
}: Props) {
  const { lang } = useLanguage();
  const L = lang === "th" ? STATUS_LABEL_TH : STATUS_LABEL_EN;

  const [rangePreset, setRangePreset] = useState<RangePreset>("month");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(todayBangkok());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);

  const applyPreset = (p: RangePreset) => {
    setRangePreset(p);
    const today = todayBangkok();
    const d = new Date(today);
    if (p === "today") {
      setStartDate(today); setEndDate(today);
    } else if (p === "week") {
      const s = new Date(d); s.setDate(d.getDate() - 6);
      setStartDate(s.toISOString().split("T")[0]); setEndDate(today);
    } else if (p === "month") {
      const s = new Date(d); s.setDate(1);
      setStartDate(s.toISOString().split("T")[0]); setEndDate(today);
    } else if (p === "term") {
      const s = new Date(d); s.setMonth(d.getMonth() - 4);
      setStartDate(s.toISOString().split("T")[0]); setEndDate(today);
    }
  };

  // Scope students by grade/classroom
  const scopedStudents = useMemo(() => {
    let result = students;
    if (gradeFilter && gradeFilter !== "all") {
      const roomIds = new Set(
        classrooms.filter((c: any) => c.grade_level === gradeFilter).map((c: any) => c.id)
      );
      result = result.filter((s: any) => roomIds.has(s.classroom_id));
    }
    if (classroomFilter && classroomFilter !== "all") {
      result = result.filter((s: any) => s.classroom_id === classroomFilter);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter((s: any) =>
        (s.student_code || "").toLowerCase().includes(q) ||
        `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.toLowerCase().includes(q)
      );
    }
    return result.sort((a: any, b: any) => (a.student_code || "").localeCompare(b.student_code || ""));
  }, [students, classrooms, gradeFilter, classroomFilter, searchText]);

  const filteredRecords = useMemo(() => {
    const studentIds = new Set(scopedStudents.map((s: any) => s.id));
    return records.filter((r: any) =>
      r.student_id && studentIds.has(r.student_id) &&
      r.attendance_date >= startDate && r.attendance_date <= endDate
    );
  }, [records, scopedStudents, startDate, endDate]);

  // วันเปิดเรียนจริง = วันธรรมดา (จ-ศ) ที่มีการแสกนถึงเกณฑ์ขั้นต่ำ
  // เกณฑ์: อย่างน้อย max(10 คน, 20% ของนักเรียนในสโคป) — กันวันทดสอบ/วันหยุดที่มีแสกนไม่กี่คน
  const schoolDays = useMemo(() => {
    const countByDate: Record<string, Set<string>> = {};
    records.forEach((r: any) => {
      if (r.attendance_date < startDate || r.attendance_date > endDate) return;
      if (!r.student_id) return;
      (countByDate[r.attendance_date] ||= new Set()).add(r.student_id);
    });
    const minScans = Math.max(10, Math.ceil(scopedStudents.length * 0.2));
    const set = new Set<string>();
    Object.entries(countByDate).forEach(([date, ids]) => {
      // 'YYYY-MM-DD' → วันในสัปดาห์ (UTC ok เพราะเป็น date เปล่า)
      const dow = new Date(date + "T00:00:00").getDay();
      if (dow === 0 || dow === 6) return; // ข้ามเสาร์-อาทิตย์
      if (ids.size >= minScans) set.add(date);
    });
    return set;
  }, [records, startDate, endDate, scopedStudents.length]);
  const schoolDayCount = schoolDays.size;


  const studentSummary = useMemo(() => {
    const map: Record<string, { present: number; absent: number; late: number; sick: number; leave: number; total: number }> = {};
    scopedStudents.forEach((s: any) => {
      map[s.id] = { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: schoolDayCount };
    });
    filteredRecords.forEach((r: any) => {
      if (!schoolDays.has(r.attendance_date)) return; // นับเฉพาะวันเปิดเรียนจริง
      if (map[r.student_id]) {
        const st = r.status as string;
        if (st === "present" || st === "late") (map[r.student_id] as any)[st]++;
      }
    });
    // ขาด = วันเปิดเรียน - (มา + สาย)
    Object.values(map).forEach(s => {
      s.absent = Math.max(0, schoolDayCount - s.present - s.late);
    });
    return map;
  }, [scopedStudents, filteredRecords, schoolDayCount, schoolDays]);

  const overallStats = useMemo(() => {
    const totals = { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 };
    Object.values(studentSummary).forEach(s => {
      totals.present += s.present; totals.absent += s.absent;
      totals.late += s.late;
      totals.total += s.total;
    });
    return totals;
  }, [studentSummary]);

  const attendanceRate = overallStats.total > 0
    ? (((overallStats.present + overallStats.late) / overallStats.total) * 100) : 0;

  const atRiskStudents = useMemo(() => {
    return scopedStudents.filter((s: any) => (studentSummary[s.id]?.absent || 0) >= 3);
  }, [scopedStudents, studentSummary]);

  // Daily trend — มา/สาย จากการแสกน, ขาด = นักเรียนในสโคป - แสกน
  const dailyTrend = useMemo(() => {
    const byDate: Record<string, any> = {};
    schoolDays.forEach(d => { byDate[d] = { date: d, present: 0, late: 0, absent: 0 }; });
    filteredRecords.forEach((r: any) => {
      if (!byDate[r.attendance_date]) return;
      if (r.status === "present" || r.status === "late") byDate[r.attendance_date][r.status]++;
    });
    const totalScoped = scopedStudents.length;
    Object.values(byDate).forEach((d: any) => {
      d.absent = Math.max(0, totalScoped - d.present - d.late);
    });
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // Pie distribution
  const pieData = useMemo(() => {
    return ["present", "late", "absent"].map(k => ({
      name: L[k], value: (overallStats as any)[k], key: k,
    })).filter(d => d.value > 0);
  }, [overallStats, L]);

  // Per-classroom rate (when "all classrooms")
  const classroomRates = useMemo(() => {
    const roomMap: Record<string, { name: string; present: number; total: number }> = {};
    scopedStudents.forEach((s: any) => {
      const room = classrooms.find((c: any) => c.id === s.classroom_id);
      if (!room) return;
      if (!roomMap[room.id]) roomMap[room.id] = { name: room.name, present: 0, total: 0 };
      const sm = studentSummary[s.id];
      if (sm) { roomMap[room.id].present += sm.present + sm.late; roomMap[room.id].total += sm.total; }
    });
    return Object.values(roomMap)
      .filter(r => r.total > 0)
      .map(r => ({ name: r.name, rate: Number(((r.present / r.total) * 100).toFixed(1)) }))
      .sort((a, b) => b.rate - a.rate);
  }, [scopedStudents, classrooms, studentSummary]);

  // Visible students after status/risk filter
  const visibleStudents = useMemo(() => {
    let list = scopedStudents;
    if (riskOnly) list = list.filter((s: any) => (studentSummary[s.id]?.absent || 0) >= 3);
    if (statusFilter !== "all") {
      list = list.filter((s: any) => (studentSummary[s.id] as any)?.[statusFilter] > 0);
    }
    return list;
  }, [scopedStudents, riskOnly, statusFilter, studentSummary]);

  const exportExcel = () => {
    const rows = visibleStudents.map((s: any, i: number) => {
      const sm = studentSummary[s.id];
      const rate = sm.total > 0 ? ((sm.present / sm.total) * 100).toFixed(1) : "0";
      const room = classrooms.find((c: any) => c.id === s.classroom_id);
      return {
        "ลำดับ": i + 1,
        "รหัสนักเรียน": s.student_code,
        "ชื่อ-สกุล": `${s.prefix || ""}${s.first_name} ${s.last_name}`,
        "ห้อง": room?.name || "",
        "มา": sm.present, "สาย": sm.late, "ขาด": sm.absent,
        "รวมวัน": sm.total, "อัตราเข้าเรียน(%)": rate,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงาน");
    XLSX.writeFile(wb, `รายงานการมาเรียน_${startDate}_${endDate}.xlsx`);
  };

  const kpiCards = [
    { key: "students", icon: Users, label: lang === "th" ? "นักเรียน" : "Students", value: scopedStudents.length, color: "from-info/20 to-info/10", iconColor: "text-info dark:text-info" },
    { key: "days", icon: CalendarRange, label: lang === "th" ? "วันเปิดเรียน" : "School Days", value: schoolDayCount, color: "from-neutral/20 to-neutral/10", iconColor: "text-neutral dark:text-neutral" },
    { key: "rate", icon: TrendingUp, label: lang === "th" ? "อัตราเข้าเรียน" : "Attendance Rate", value: `${attendanceRate.toFixed(1)}%`, color: "from-success/20 to-success/10", iconColor: "text-success dark:text-success" },
    { key: "present", icon: CheckCircle2, label: L.present, value: overallStats.present, color: "from-success/20 to-success/10", iconColor: "text-success dark:text-success" },
    { key: "late", icon: Clock, label: L.late, value: overallStats.late, color: "from-warning/20 to-warning/10", iconColor: "text-warning dark:text-warning" },
    { key: "absent", icon: XCircle, label: L.absent, value: overallStats.absent, color: "from-danger/20 to-danger/10", iconColor: "text-danger dark:text-danger" },
    { key: "risk", icon: AlertTriangle, label: lang === "th" ? "เสี่ยง (≥3)" : "At Risk (≥3)", value: atRiskStudents.length, color: "from-warning/20 to-danger/10", iconColor: "text-warning dark:text-warning" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            {lang === "th" ? "ตัวกรองรายงาน" : "Report Filters"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Preset range */}
          <div className="flex flex-wrap gap-2">
            {([
              ["today", lang === "th" ? "วันนี้" : "Today"],
              ["week", lang === "th" ? "7 วัน" : "7 days"],
              ["month", lang === "th" ? "เดือนนี้" : "This month"],
              ["term", lang === "th" ? "ภาคเรียน" : "Term"],
              ["custom", lang === "th" ? "กำหนดเอง" : "Custom"],
            ] as [RangePreset, string][]).map(([key, lbl]) => (
              <Button
                key={key}
                size="sm"
                variant={rangePreset === key ? "default" : "outline"}
                onClick={() => applyPreset(key)}
                className="h-8"
              >
                <CalendarRange className="w-3 h-3 mr-1" />{lbl}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">{lang === "th" ? "ระดับชั้น" : "Grade"}</Label>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทุกระดับ" : "All"}</SelectItem>
                  {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ห้องเรียน" : "Room"}</Label>
              <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                  {filteredClassrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "สถานะ" : "Status"}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {["present","late","absent"].map(k => (
                    <SelectItem key={k} value={k}>{L[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ตั้งแต่" : "From"}</Label>
              <BEDatePicker value={startDate} onChange={(v) => { setStartDate(v); setRangePreset("custom"); }} />
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ถึง" : "To"}</Label>
              <BEDatePicker value={endDate} onChange={(v) => { setEndDate(v); setRangePreset("custom"); }} />
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ค้นหา" : "Search"}</Label>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-7"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={lang === "th" ? "รหัส/ชื่อ" : "Code/Name"}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant={riskOnly ? "default" : "outline"}
              onClick={() => setRiskOnly(!riskOnly)}
              className="h-8"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              {lang === "th" ? "เฉพาะเสี่ยงขาดเรียน" : "At-risk only"}
            </Button>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={exportExcel} disabled={visibleStudents.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                {lang === "th" ? "ส่งออก Excel" : "Export Excel"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {scopedStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {lang === "th" ? "ไม่มีนักเรียนตามตัวกรองที่เลือก" : "No students for current filters"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {kpiCards.map(c => {
              const Icon = c.icon;
              return (
                <Card key={c.key} className={`bg-gradient-to-br ${c.color} border-0 shadow-sm hover:shadow-md transition-shadow`}>
                  <CardContent className="pt-4 pb-3 text-center">
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${c.iconColor}`} />
                    <div className={`text-xl font-bold ${c.iconColor}`}>{c.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{c.label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{lang === "th" ? "แนวโน้มรายวัน" : "Daily Trend"}</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {dailyTrend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    {lang === "th" ? "ไม่มีข้อมูล" : "No data"}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {["present","late","absent"].map(k => (
                        <Line key={k} type="monotone" dataKey={k} stroke={STATUS_COLORS[k]} strokeWidth={2} dot={false} name={L[k]} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{lang === "th" ? "สัดส่วนสถานะ" : "Status Distribution"}</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {pieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    {lang === "th" ? "ไม่มีข้อมูล" : "No data"}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}>
                        {pieData.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {classroomRates.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{lang === "th" ? "อัตราเข้าเรียนรายห้อง" : "Attendance Rate by Classroom"}</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classroomRates}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v) => `${v}%`} />
                    <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={lang === "th" ? "อัตรา (%)" : "Rate (%)"} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {atRiskStudents.length > 0 && (
            <Card className="border-warning/30 bg-warning-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-warning dark:text-warning">
                  <AlertTriangle className="w-4 h-4" />
                  {lang === "th" ? "นักเรียนเสี่ยงขาดเรียน (≥ 3 วัน)" : "At Risk (Absent ≥ 3)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {atRiskStudents.map((s: any) => (
                    <Badge key={s.id} variant="outline" className="bg-background">
                      {s.prefix}{s.first_name} {s.last_name} ({studentSummary[s.id]?.absent} {lang === "th" ? "วัน" : "d"})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-student table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {lang === "th" ? "รายงานรายบุคคล" : "Per-student Report"}
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  ({visibleStudents.length} {lang === "th" ? "คน" : "students"})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-20">{lang === "th" ? "รหัส" : "Code"}</TableHead>
                    <TableHead>{lang === "th" ? "ชื่อ-สกุล" : "Name"}</TableHead>
                    <TableHead className="w-24">{lang === "th" ? "ห้อง" : "Room"}</TableHead>
                    <TableHead className="text-center w-14">{lang === "th" ? "วันเปิด" : "Days"}</TableHead>
                    <TableHead className="text-center w-12">{L.present}</TableHead>
                    <TableHead className="text-center w-12">{L.late}</TableHead>
                    <TableHead className="text-center w-12">{L.absent}</TableHead>
                    <TableHead className="w-40">{lang === "th" ? "อัตรา" : "Rate"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {lang === "th" ? "ไม่มีข้อมูล" : "No data"}
                    </TableCell></TableRow>
                  ) : visibleStudents.map((s: any, i: number) => {
                    const sm = studentSummary[s.id];
                    const rate = sm.total > 0 ? ((sm.present + sm.late) / sm.total) * 100 : 0;
                    const room = classrooms.find((c: any) => c.id === s.classroom_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                        <TableCell>{s.prefix}{s.first_name} {s.last_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{room?.name}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{sm.total}</TableCell>
                        <TableCell className="text-center text-success font-medium">{sm.present || "-"}</TableCell>
                        <TableCell className="text-center text-warning font-medium">{sm.late || "-"}</TableCell>
                        <TableCell className="text-center text-danger font-medium">{sm.absent || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={rate} className="h-2 flex-1" />
                            <span className={`text-xs font-medium w-10 text-right ${rate < 80 ? "text-danger" : "text-success"}`}>
                              {rate.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
