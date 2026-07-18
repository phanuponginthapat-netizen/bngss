import { useState, useMemo } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart3, Download, Users, UserCheck, Clock, AlertTriangle, Calendar, MapPin, FileSpreadsheet,
  TrendingDown, User, ChevronRight, Trophy, FileText,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { StatCard } from "@/components/shared";
import { useAcademicYear } from "@/hooks/useAcademicYear";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal: { label: "ปกติ", color: "bg-success-soft text-success" },
  late: { label: "มาสาย", color: "bg-warning-soft text-warning" },
  absent: { label: "ขาด", color: "bg-danger-soft text-danger" },
  leave: { label: "ลา", color: "bg-info-soft text-info" },
  official: { label: "ไปราชการ", color: "bg-info-soft text-info" },
};

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

const todayIso = () => todayBangkok();
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
};

const formatTime = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";

export default function AttendanceDashboardPage() {
  const { currentAcademicYear, currentSemester, config } = useAcademicYear();

  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Personal report
  const [reportPersonId, setReportPersonId] = useState<string>("");
  const [reportPeriod, setReportPeriod] = useState<"daily" | "monthly" | "semester" | "custom">("monthly");
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [reportDate, setReportDate] = useState(todayIso());
  const [reportSemester, setReportSemester] = useState<"1" | "2">(String(currentSemester) as "1" | "2");
  const [reportYear, setReportYear] = useState<number>(currentAcademicYear);
  const [reportStart, setReportStart] = useState(monthAgo());
  const [reportEnd, setReportEnd] = useState(todayIso());
  const [reportOpen, setReportOpen] = useState(false);

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel-active"],
    queryFn: async () => {
      const { data } = await supabase.from("personnel")
        .select("id, prefix, first_name, last_name, employee_code, position, department")
        .eq("status", "active").order("first_name");
      return data || [];
    },
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-dashboard", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_clock")
        .select("*, personnel(prefix, first_name, last_name, employee_code, department, position)")
        .gte("clock_date", startDate).lte("clock_date", endDate)
        .order("clock_date", { ascending: false }).limit(5000);
      return data || [];
    },
  });

  // Filter by search/status
  const filtered = useMemo(() => {
    return (records as any[]).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!search) return true;
      const p = r.personnel;
      const text = `${p?.first_name || ""} ${p?.last_name || ""} ${p?.employee_code || ""}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [records, search, statusFilter]);

  // KPI today
  const today = todayIso();
  const todayRecs = (records as any[]).filter((r) => r.clock_date === today);
  const onTime = todayRecs.filter((r) => r.status === "normal").length;
  const late = todayRecs.filter((r) => r.status === "late").length;
  const absent = Math.max(0, personnel.length - todayRecs.length);

  // Group by date for chart
  const byDate = useMemo(() => {
    const map: Record<string, { date: string; normal: number; late: number; total: number }> = {};
    (records as any[]).forEach((r) => {
      const d = r.clock_date;
      if (!map[d]) map[d] = { date: d, normal: 0, late: 0, total: 0 };
      map[d].total++;
      if (r.status === "normal") map[d].normal++;
      if (r.status === "late") map[d].late++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    (records as any[]).forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({ name: STATUS_MAP[k]?.label || k, value: v }));
  }, [records]);

  // Per-person summary
  const perPerson = useMemo(() => {
    const map: Record<string, any> = {};
    personnel.forEach((p: any) => {
      map[p.id] = { ...p, total: 0, normal: 0, late: 0, absent: 0, official: 0, leave: 0 };
    });
    (records as any[]).forEach((r) => {
      const p = map[r.personnel_id];
      if (!p) return;
      p.total++;
      if (p[r.status] !== undefined) p[r.status]++;
    });
    return Object.values(map).sort((a: any, b: any) => b.late - a.late);
  }, [personnel, records]);

  // Top frequent late (>=3 late days)
  const frequentLate = useMemo(
    () => (perPerson as any[]).filter((p) => p.late > 0).slice(0, 10),
    [perPerson]
  );

  // ===== Personal report range computation =====
  const reportRange = useMemo(() => {
    if (reportPeriod === "daily") return { start: reportDate, end: reportDate };
    if (reportPeriod === "monthly") {
      const [y, m] = reportMonth.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      return { start: `${reportMonth}-01`, end: `${reportMonth}-${String(last).padStart(2, "0")}` };
    }
    if (reportPeriod === "semester") {
      // semester 1: academicYearStartMonth..semester1EndMonth of CE year (reportYear - 543)
      // semester 2: semester2StartMonth..semester2EndMonth (wraps)
      const ce = reportYear - 543;
      if (reportSemester === "1") {
        const s = new Date(ce, config.semester1StartMonth - 1, 1);
        const e = new Date(ce, config.semester1EndMonth, 0);
        return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
      } else {
        const sm = config.semester2StartMonth;
        const em = config.semester2EndMonth;
        const startYear = sm > em ? ce : ce;
        const endYear = sm > em ? ce + 1 : ce;
        const s = new Date(startYear, sm - 1, 1);
        const e = new Date(endYear, em, 0);
        return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
      }
    }
    return { start: reportStart, end: reportEnd };
  }, [reportPeriod, reportDate, reportMonth, reportSemester, reportYear, reportStart, reportEnd, config]);

  const { data: personReport = [], isFetching: loadingReport } = useQuery({
    queryKey: ["person-report", reportPersonId, reportRange.start, reportRange.end],
    enabled: !!reportPersonId && reportOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("time_clock")
        .select("*")
        .eq("personnel_id", reportPersonId)
        .gte("clock_date", reportRange.start)
        .lte("clock_date", reportRange.end)
        .order("clock_date", { ascending: false });
      return data || [];
    },
  });

  const reportPerson = (personnel as any[]).find((p) => p.id === reportPersonId);

  const reportStats = useMemo(() => {
    const stats = { total: 0, normal: 0, late: 0, absent: 0, official: 0, leave: 0 };
    (personReport as any[]).forEach((r) => {
      stats.total++;
      if ((stats as any)[r.status] !== undefined) (stats as any)[r.status]++;
    });
    return stats;
  }, [personReport]);

  // ===== Excel exporters =====
  const periodLabel = () => {
    if (reportPeriod === "daily") return `รายวัน ${reportDate}`;
    if (reportPeriod === "monthly") return `รายเดือน ${reportMonth}`;
    if (reportPeriod === "semester") return `ภาคเรียนที่ ${reportSemester} ปีการศึกษา ${reportYear}`;
    return `${reportStart} ถึง ${reportEnd}`;
  };

  const exportPersonExcel = () => {
    if (!reportPerson) return;
    const wb = XLSX.utils.book_new();
    const personName = `${reportPerson.prefix || ""}${reportPerson.first_name} ${reportPerson.last_name}`;

    // Sheet 1: Summary
    const summary = [
      ["รายงานการมาทำงาน"],
      ["ชื่อ-สกุล", personName],
      ["รหัส", reportPerson.employee_code || "-"],
      ["ฝ่าย/ตำแหน่ง", reportPerson.department || reportPerson.position || "-"],
      ["ช่วงเวลา", periodLabel()],
      ["ตั้งแต่", reportRange.start, "ถึง", reportRange.end],
      [],
      ["สรุป"],
      ["รวมวันที่มา", reportStats.total],
      ["ปกติ", reportStats.normal],
      ["มาสาย", reportStats.late],
      ["ไปราชการ", reportStats.official],
      ["ลา", reportStats.leave],
      ["% ตรงเวลา", reportStats.total ? Math.round((reportStats.normal / reportStats.total) * 100) + "%" : "-"],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    ws1["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws1, "สรุป");

    // Sheet 2: Detail
    const detail = [
      ["วันที่", "เข้างาน", "ออกงาน", "สถานะ", "นอกสถานที่", "สถานที่", "GPS", "หมายเหตุ"],
      ...(personReport as any[]).map((r) => [
        r.clock_date,
        formatTime(r.clock_in),
        formatTime(r.clock_out),
        STATUS_MAP[r.status]?.label || r.status,
        r.is_offsite ? "ใช่" : "-",
        r.offsite_location || "-",
        r.gps_verified ? "ผ่าน" : "-",
        r.notes || "",
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(detail);
    ws2["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, ws2, "รายละเอียด");

    XLSX.writeFile(wb, `รายงาน_${reportPerson.employee_code || "person"}_${reportRange.start}_${reportRange.end}.xlsx`);
  };

  const exportSchoolExcel = () => {
    const wb = XLSX.utils.book_new();

    // Overview
    const overview = [
      ["รายงานภาพรวมการมาทำงาน"],
      ["ช่วงเวลา", `${startDate} ถึง ${endDate}`],
      ["บุคลากรทั้งหมด", personnel.length],
      ["รวมการลงเวลา", records.length],
      [],
      ["สถานะ", "จำนวน"],
      ...pieData.map((p) => [p.name, p.value]),
    ];
    const wsO = XLSX.utils.aoa_to_sheet(overview);
    wsO["!cols"] = [{ wch: 30 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsO, "ภาพรวม");

    // Per-person summary
    const pp = [
      ["รหัส", "ชื่อ-สกุล", "ฝ่าย/ตำแหน่ง", "รวม", "ปกติ", "สาย", "ไปราชการ", "ลา", "% ตรงเวลา"],
      ...(perPerson as any[]).map((p) => [
        p.employee_code, `${p.prefix || ""}${p.first_name} ${p.last_name}`, p.department || p.position || "-",
        p.total, p.normal, p.late, p.official, p.leave,
        p.total ? Math.round((p.normal / p.total) * 100) + "%" : "-",
      ]),
    ];
    const wsP = XLSX.utils.aoa_to_sheet(pp);
    wsP["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsP, "สรุปรายบุคคล");

    // Frequent late
    const fl = [
      ["อันดับ", "รหัส", "ชื่อ-สกุล", "จำนวนวันที่สาย", "รวมวันที่มา", "% สาย"],
      ...(perPerson as any[]).filter((p) => p.late > 0).map((p, i) => [
        i + 1, p.employee_code, `${p.prefix || ""}${p.first_name} ${p.last_name}`,
        p.late, p.total, p.total ? Math.round((p.late / p.total) * 100) + "%" : "-",
      ]),
    ];
    const wsF = XLSX.utils.aoa_to_sheet(fl);
    wsF["!cols"] = [{ wch: 8 }, { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsF, "ผู้มาสายบ่อย");

    // Records detail
    const detail = [
      ["วันที่", "รหัส", "ชื่อ-สกุล", "ฝ่าย", "เข้า", "ออก", "สถานะ", "นอกสถานที่", "สถานที่", "หมายเหตุ"],
      ...filtered.map((r: any) => [
        r.clock_date, r.personnel?.employee_code || "",
        `${r.personnel?.prefix || ""}${r.personnel?.first_name || ""} ${r.personnel?.last_name || ""}`,
        r.personnel?.department || "", formatTime(r.clock_in), formatTime(r.clock_out),
        STATUS_MAP[r.status]?.label || r.status,
        r.is_offsite ? "ใช่" : "-", r.offsite_location || "-", r.notes || "",
      ]),
    ];
    const wsD = XLSX.utils.aoa_to_sheet(detail);
    XLSX.utils.book_append_sheet(wb, wsD, "รายละเอียด");

    XLSX.writeFile(wb, `attendance_${startDate}_to_${endDate}.xlsx`);
  };

  const exportCsv = () => {
    const rows = [
      ["วันที่", "รหัส", "ชื่อ-สกุล", "ฝ่าย", "เข้า", "ออก", "สถานะ", "หมายเหตุ"],
      ...filtered.map((r: any) => [
        r.clock_date, r.personnel?.employee_code || "",
        `${r.personnel?.prefix || ""}${r.personnel?.first_name || ""} ${r.personnel?.last_name || ""}`,
        r.personnel?.department || "", formatTime(r.clock_in), formatTime(r.clock_out),
        STATUS_MAP[r.status]?.label || r.status, (r.notes || "").replace(/\n/g, " "),
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance_${startDate}_to_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openPersonReport = (id: string) => {
    setReportPersonId(id);
    setReportOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="card-gradient">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">แดชบอร์ดการมาทำงานของบุคลากร</h1>
                <p className="text-sm text-muted-foreground">ภาพรวม รายงานรายบุคคล และผู้มาสายบ่อย</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportSchoolExcel} className="bg-success hover:bg-success text-white">
                <FileSpreadsheet className="w-4 h-4 mr-2" />Excel (ภาพรวม)
              </Button>
              <Button onClick={exportCsv} variant="outline">
                <Download className="w-4 h-4 mr-2" />CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI - prominent today's snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="บุคลากรทั้งหมด" value={personnel.length} icon={Users} tone="muted" />
        <StatCard label="มาตรงเวลาวันนี้" value={onTime} icon={UserCheck} tone="success" />
        <StatCard label="มาสายวันนี้" value={late} icon={Clock} tone="warning" />
        <StatCard label="ยังไม่ลงเวลา" value={absent} icon={AlertTriangle} tone="destructive" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">เริ่มวันที่</Label>
            <BEDatePicker value={startDate} onChange={(v) => setStartDate(v)} />
          </div>
          <div>
            <Label className="text-xs">ถึงวันที่</Label>
            <BEDatePicker value={endDate} onChange={(v) => setEndDate(v)} />
          </div>
          <div>
            <Label className="text-xs">สถานะ</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">ค้นหา (ชื่อ/รหัส)</Label>
            <Input placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 mr-2" />ภาพรวม</TabsTrigger>
          <TabsTrigger value="frequent-late"><TrendingDown className="w-4 h-4 mr-2" />ผู้มาสายบ่อย</TabsTrigger>
          <TabsTrigger value="summary"><Users className="w-4 h-4 mr-2" />สรุปรายบุคคล</TabsTrigger>
          <TabsTrigger value="records"><Clock className="w-4 h-4 mr-2" />รายการลงเวลา</TabsTrigger>
          <TabsTrigger value="report"><FileText className="w-4 h-4 mr-2" />รายงานรายบุคคล</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />แนวโน้มรายวัน</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={byDate}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="normal" stroke="#10b981" strokeWidth={2} name="ปกติ" />
                    <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} name="สาย" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">สัดส่วนสถานะ</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">สถิติรายวัน (Stacked)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDate}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="normal" stackId="a" fill="#10b981" name="ปกติ" />
                  <Bar dataKey="late" stackId="a" fill="#f59e0b" name="สาย" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FREQUENT LATE */}
        <TabsContent value="frequent-late">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="w-5 h-5 text-warning" />
                อันดับผู้มาสายบ่อยที่สุด (ช่วง {startDate} ถึง {endDate})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {frequentLate.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">ไม่มีบุคลากรมาสายในช่วงนี้ 🎉</p>
              ) : (
                <div className="space-y-2">
                  {frequentLate.map((p: any, idx: number) => {
                    const pct = p.total ? Math.round((p.late / p.total) * 100) : 0;
                    const rankColor = idx === 0 ? "bg-danger" : idx === 1 ? "bg-warning" : idx === 2 ? "bg-warning" : "bg-muted-foreground";
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition">
                        <div className={`w-10 h-10 rounded-full ${rankColor} text-white font-bold flex items-center justify-center`}>{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.prefix}{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-muted-foreground">{p.employee_code} · {p.department || p.position || "-"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-warning">{p.late}</p>
                          <p className="text-xs text-muted-foreground">วัน · {pct}%</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => openPersonReport(p.id)}>
                          ดูรายงาน <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUMMARY */}
        <TabsContent value="summary">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead>ฝ่าย/ตำแหน่ง</TableHead>
                <TableHead className="text-right">มาทั้งหมด</TableHead>
                <TableHead className="text-right text-success">ปกติ</TableHead>
                <TableHead className="text-right text-warning">สาย</TableHead>
                <TableHead className="text-right">% ตรงเวลา</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(perPerson as any[]).map((p) => {
                  const pct = p.total > 0 ? Math.round((p.normal / p.total) * 100) : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.employee_code}</TableCell>
                      <TableCell>{p.prefix}{p.first_name} {p.last_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.department || p.position || "-"}</TableCell>
                      <TableCell className="text-right">{p.total}</TableCell>
                      <TableCell className="text-right text-success">{p.normal}</TableCell>
                      <TableCell className="text-right text-warning">{p.late}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pct >= 90 ? "default" : pct >= 70 ? "secondary" : "destructive"}>{pct}%</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => openPersonReport(p.id)}>
                          <FileText className="w-4 h-4 mr-1" />รายงาน
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* RECORDS */}
        <TabsContent value="records">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead>ฝ่าย</TableHead>
                <TableHead>เข้า</TableHead>
                <TableHead>ออก</TableHead>
                <TableHead>ภาพ</TableHead>
                <TableHead>GPS</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
                ) : filtered.slice(0, 300).map((r: any) => {
                  const st = STATUS_MAP[r.status] || { label: r.status, color: "" };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{r.clock_date}</TableCell>
                      <TableCell className="font-mono text-xs">{r.personnel?.employee_code}</TableCell>
                      <TableCell className="text-sm">{r.personnel?.prefix}{r.personnel?.first_name} {r.personnel?.last_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.personnel?.department || "-"}</TableCell>
                      <TableCell className="text-xs">{formatTime(r.clock_in)}</TableCell>
                      <TableCell className="text-xs">{formatTime(r.clock_out)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.clock_in_photo_url && <a href={r.clock_in_photo_url} target="_blank" rel="noopener noreferrer"><img src={r.clock_in_photo_url} alt="in" className="w-9 h-9 rounded object-cover border" /></a>}
                          {r.clock_out_photo_url && <a href={r.clock_out_photo_url} target="_blank" rel="noopener noreferrer"><img src={r.clock_out_photo_url} alt="out" className="w-9 h-9 rounded object-cover border" /></a>}
                          {!r.clock_in_photo_url && !r.clock_out_photo_url && <span className="text-xs text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.gps_verified ? (
                          <a href={r.clock_lat && r.clock_lng ? `https://www.google.com/maps?q=${r.clock_lat},${r.clock_lng}` : "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-success text-xs"><MapPin className="w-3 h-3 mr-1" />ผ่าน</a>
                        ) : r.is_offsite ? <span className="text-xs text-info">นอกสถานที่</span> : <span className="text-xs text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length > 300 && <p className="text-xs text-center text-muted-foreground p-2">แสดง 300 รายการแรก กรุณาส่งออก Excel เพื่อดูทั้งหมด</p>}
          </CardContent></Card>
        </TabsContent>

        {/* PERSONAL REPORT BUILDER */}
        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-5 h-5" />สร้างรายงานรายบุคคล</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">เลือกบุคลากร</Label>
                  <Select value={reportPersonId} onValueChange={setReportPersonId}>
                    <SelectTrigger><SelectValue placeholder="-- เลือก --" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(personnel as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.employee_code} · {p.prefix || ""}{p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">ช่วงเวลา</Label>
                  <Select value={reportPeriod} onValueChange={(v: any) => setReportPeriod(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">รายวัน</SelectItem>
                      <SelectItem value="monthly">รายเดือน</SelectItem>
                      <SelectItem value="semester">รายภาคเรียน</SelectItem>
                      <SelectItem value="custom">กำหนดเอง</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reportPeriod === "daily" && (
                <div><Label className="text-xs">วันที่</Label><BEDatePicker value={reportDate} onChange={setReportDate} /></div>
              )}
              {reportPeriod === "monthly" && (
                <div><Label className="text-xs">เดือน (YYYY-MM)</Label><Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></div>
              )}
              {reportPeriod === "semester" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">ปีการศึกษา (พ.ศ.)</Label>
                    <Input type="number" value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value) || currentAcademicYear)} />
                  </div>
                  <div>
                    <Label className="text-xs">ภาคเรียน</Label>
                    <Select value={reportSemester} onValueChange={(v: any) => setReportSemester(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
                        <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {reportPeriod === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">ตั้งแต่</Label><BEDatePicker value={reportStart} onChange={setReportStart} /></div>
                  <div><Label className="text-xs">ถึง</Label><BEDatePicker value={reportEnd} onChange={setReportEnd} /></div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button disabled={!reportPersonId} onClick={() => setReportOpen(true)}>
                  <User className="w-4 h-4 mr-2" />ดูตัวอย่าง
                </Button>
                <Button disabled={!reportPersonId} onClick={() => { setReportOpen(true); }} variant="outline">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />เปิดและพิมพ์ Excel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ช่วงที่เลือก: <span className="font-mono">{reportRange.start}</span> ถึง <span className="font-mono">{reportRange.end}</span>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PERSON REPORT DIALOG */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              รายงานการมาทำงาน — {reportPerson ? `${reportPerson.prefix || ""}${reportPerson.first_name} ${reportPerson.last_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{periodLabel()}</span> · {reportRange.start} ถึง {reportRange.end}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatCard label="มาทั้งหมด" value={reportStats.total} icon={Users} tone="muted" />
              <StatCard label="ปกติ" value={reportStats.normal} icon={UserCheck} tone="success" />
              <StatCard label="สาย" value={reportStats.late} icon={Clock} tone="warning" />
              <StatCard label="ไปราชการ" value={reportStats.official} icon={MapPin} tone="primary" />
              <StatCard label="ลา" value={reportStats.leave} icon={Calendar} tone="muted" />
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>เข้า</TableHead>
                  <TableHead>ออก</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>สถานที่</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingReport ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                  ) : (personReport as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
                  ) : (personReport as any[]).map((r) => {
                    const st = STATUS_MAP[r.status];
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">{r.clock_date}</TableCell>
                        <TableCell className="text-xs">{formatTime(r.clock_in)}</TableCell>
                        <TableCell className="text-xs">{formatTime(r.clock_out)}</TableCell>
                        <TableCell><Badge className={st?.color}>{st?.label || r.status}</Badge></TableCell>
                        <TableCell className="text-xs">{r.is_offsite ? (r.offsite_location || "นอกสถานที่") : "-"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{r.notes || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setReportOpen(false)}>ปิด</Button>
              <Button onClick={exportPersonExcel} className="bg-success hover:bg-success text-white">
                <FileSpreadsheet className="w-4 h-4 mr-2" />ดาวน์โหลด Excel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
