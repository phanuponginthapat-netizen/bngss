import { useState, useMemo } from "react";
import { bkkDateISO, todayBangkok } from "@/lib/dateBE";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Download, Users, UserCheck, Clock, AlertTriangle, Calendar, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { StatCard } from "@/components/shared";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal: { label: "ปกติ", color: "bg-emerald-100 text-emerald-800" },
  late: { label: "มาสาย", color: "bg-amber-100 text-amber-800" },
  absent: { label: "ขาด", color: "bg-red-100 text-red-800" },
  leave: { label: "ลา", color: "bg-blue-100 text-blue-800" },
  official: { label: "ไปราชการ", color: "bg-purple-100 text-purple-800" },
};

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

const todayIso = () => todayBangkok();
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return bkkDateISO(d);
};

export default function AttendanceDashboardPage() {
  const [startDate, setStartDate] = useState(monthAgo());
  const [endDate, setEndDate] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel-active"],
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id, prefix, first_name, last_name, employee_code, position, department").eq("status", "active").order("first_name");
      return data || [];
    },
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-dashboard", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_clock")
        .select("*, personnel(prefix, first_name, last_name, employee_code, department, position)")
        .gte("clock_date", startDate)
        .lte("clock_date", endDate)
        .order("clock_date", { ascending: false })
        .limit(2000);
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

  // Pie data
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    (records as any[]).forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({ name: STATUS_MAP[k]?.label || k, value: v }));
  }, [records]);

  // Per-person summary
  const perPerson = useMemo(() => {
    const map: Record<string, any> = {};
    personnel.forEach((p: any) => {
      map[p.id] = {
        ...p,
        total: 0, normal: 0, late: 0, absent: 0,
      };
    });
    (records as any[]).forEach((r) => {
      const p = map[r.personnel_id];
      if (!p) return;
      p.total++;
      if (r.status === "normal") p.normal++;
      if (r.status === "late") p.late++;
      if (r.status === "absent") p.absent++;
    });
    return Object.values(map).sort((a: any, b: any) => b.late - a.late);
  }, [personnel, records]);

  const exportCsv = () => {
    const rows = [
      ["วันที่", "รหัส", "ชื่อ-สกุล", "ฝ่าย/กลุ่ม", "เข้างาน", "ออกงาน", "สถานะ", "GPS", "หมายเหตุ"],
      ...filtered.map((r: any) => [
        r.clock_date,
        r.personnel?.employee_code || "",
        `${r.personnel?.prefix || ""}${r.personnel?.first_name || ""} ${r.personnel?.last_name || ""}`,
        r.personnel?.department || "",
        r.clock_in ? new Date(r.clock_in).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
        r.clock_out ? new Date(r.clock_out).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
        STATUS_MAP[r.status]?.label || r.status,
        r.gps_verified ? "ผ่าน" : "-",
        (r.notes || "").replace(/\n/g, " "),
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (ts: string | null) => ts ? new Date(ts).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";

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
                <h1 className="text-2xl font-bold">แดชบอร์ดการมาทำงาน</h1>
                <p className="text-sm text-muted-foreground">ภาพรวมการลงเวลาเข้า-ออกของบุคลากร</p>
              </div>
            </div>
            <Button onClick={exportCsv} variant="outline">
              <Download className="w-4 h-4 mr-2" />ส่งออก CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
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

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="บุคลากรทั้งหมด" value={personnel.length} icon={Users} tone="muted" />
        <StatCard label="มาตรงเวลาวันนี้" value={onTime} icon={UserCheck} tone="success" />
        <StatCard label="มาสายวันนี้" value={late} icon={Clock} tone="warning" />
        <StatCard label="ยังไม่ลงเวลา" value={absent} icon={AlertTriangle} tone="destructive" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />สถิติรายวัน</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
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
        <Card>
          <CardHeader><CardTitle className="text-base">สัดส่วนสถานะ</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">รายการลงเวลา ({filtered.length})</TabsTrigger>
          <TabsTrigger value="summary">สรุปรายบุคคล</TabsTrigger>
        </TabsList>

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
                ) : filtered.slice(0, 200).map((r: any) => {
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
                          {r.clock_in_photo_url && <a href={r.clock_in_photo_url} target="_blank" rel="noopener noreferrer"><img loading="lazy" decoding="async" src={r.clock_in_photo_url} alt="in" className="w-9 h-9 rounded object-cover border" /></a>}
                          {r.clock_out_photo_url && <a href={r.clock_out_photo_url} target="_blank" rel="noopener noreferrer"><img loading="lazy" decoding="async" src={r.clock_out_photo_url} alt="out" className="w-9 h-9 rounded object-cover border" /></a>}
                          {!r.clock_in_photo_url && !r.clock_out_photo_url && <span className="text-xs text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.gps_verified ? (
                          <a href={r.clock_lat && r.clock_lng ? `https://www.google.com/maps?q=${r.clock_lat},${r.clock_lng}` : "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-emerald-600 text-xs"><MapPin className="w-3 h-3 mr-1" />ผ่าน</a>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length > 200 && <p className="text-xs text-center text-muted-foreground p-2">แสดง 200 รายการแรก กรุณาส่งออก CSV เพื่อดูทั้งหมด</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead>ฝ่าย/ตำแหน่ง</TableHead>
                <TableHead className="text-right">มาทั้งหมด</TableHead>
                <TableHead className="text-right text-emerald-600">ปกติ</TableHead>
                <TableHead className="text-right text-amber-600">สาย</TableHead>
                <TableHead className="text-right">% ตรงเวลา</TableHead>
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
                      <TableCell className="text-right text-emerald-600">{p.normal}</TableCell>
                      <TableCell className="text-right text-amber-600">{p.late}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pct >= 90 ? "default" : pct >= 70 ? "secondary" : "destructive"}>{pct}%</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}