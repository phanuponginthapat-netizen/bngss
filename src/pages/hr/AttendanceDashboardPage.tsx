import { useState, useMemo, useEffect } from "react";
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
import { readDigestRows } from "../../../supabase/functions/_shared/attendanceDigest";
import { staffAttendanceSummary, staffPercentage, staffReportDates, STAFF_STATUSES } from "@/lib/staffAttendanceSummary";
import { useUserRole } from "@/hooks/useUserRole";

const STATUS_MAP: Record<string, { label: string; color: string; fill: string }> = {
  normal: { label: "ตรงเวลา", color: "bg-success/15 text-success", fill: "hsl(var(--success))" },
  late: { label: "มาสาย", color: "bg-warning/15 text-warning", fill: "hsl(var(--warning))" },
  offsite: { label: "นอกพื้นที่", color: "bg-accent/15 text-accent", fill: "hsl(var(--accent))" },
  absent: { label: "ขาด (มีบันทึก)", color: "bg-destructive/15 text-destructive", fill: "hsl(var(--destructive))" },
  leave: { label: "ลา", color: "bg-primary/15 text-primary", fill: "hsl(var(--primary))" },
  official: { label: "ไปราชการ", color: "bg-secondary text-secondary-foreground", fill: "hsl(var(--secondary-foreground))" },
  unrecorded: { label: "ยังไม่ลงเวลา", color: "bg-muted text-muted-foreground", fill: "hsl(var(--muted-foreground))" },
};

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

  const { userId } = useUserRole();
  const [today, setToday] = useState(todayIso);
  useEffect(() => { const timer = window.setInterval(() => setToday(todayIso()), 30_000); return () => window.clearInterval(timer); }, []);
  const validRange = Boolean(startDate && endDate && startDate <= endDate && startDate <= today);
  const finish = endDate < today ? endDate : today;
  const reportQuery = useQuery({
    queryKey: ["staff-attendance-dashboard-v2", userId, startDate, finish, today],
    enabled: Boolean(userId) && validRange,
    queryFn: async () => {
      const [personnel, records, todayRecords, holidays] = await Promise.all([
        readDigestRows<any>((a,b) => supabase.from("personnel").select("id,prefix,first_name,last_name,employee_code,position,department").eq("status","active").order("id").range(a,b)),
        readDigestRows<any>((a,b) => supabase.from("time_clock").select("*,personnel(prefix,first_name,last_name,employee_code,department,position)").gte("clock_date",startDate).lte("clock_date",finish).order("clock_date",{ascending:false}).order("id").range(a,b)),
        readDigestRows<any>((a,b) => supabase.from("time_clock").select("id,personnel_id,clock_date,clock_in,status,created_at").eq("clock_date",today).order("id").range(a,b)),
        readDigestRows<any>((a,b) => supabase.from("academic_events").select("id,event_date,end_date").eq("event_type","holiday").lte("event_date",finish).or(`end_date.gte.${startDate},and(end_date.is.null,event_date.gte.${startDate})`).order("id").range(a,b)),
      ]);
      return {personnel, records, todayRecords, holidays};
    },
    staleTime: 30_000, refetchInterval: 60_000,
  });
  const personnel = reportQuery.data?.personnel ?? [];
  const records = reportQuery.data?.records ?? [];
  const isLoading = reportQuery.isLoading;
  const ready = validRange && reportQuery.isSuccess;
  const dates = useMemo(() => staffReportDates(startDate,finish,today,reportQuery.data?.holidays ?? []),[startDate,finish,today,reportQuery.data]);
  const summary = useMemo(() => staffAttendanceSummary(personnel.map(p=>p.id),dates,records),[personnel,dates,records]);
  const todaySummary = staffAttendanceSummary(personnel.map(p=>p.id),[today],reportQuery.data?.todayRecords ?? []).totals;
  const byDate = summary.daily;
  const pieData = STAFF_STATUSES.map(key=>({key,name:STATUS_MAP[key].label,value:summary.totals[key],fill:STATUS_MAP[key].fill})).filter(row=>row.value>0);
  const onTime = todaySummary.normal, late = todaySummary.late, absent = todaySummary.unrecorded;
  const periodRate = staffPercentage(summary.totals.normal + summary.totals.late + summary.totals.offsite,summary.totals.total);
  const todayRate = staffPercentage(todaySummary.normal + todaySummary.late + todaySummary.offsite,todaySummary.total);

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

  const perPerson = useMemo(() => personnel.map(p => {
    const counts = {normal:0,late:0,offsite:0,official:0,leave:0,absent:0,unrecorded:0};
    for (const date of dates) { const status = summary.statuses.get(`${date}/${p.id}`) ?? "unrecorded"; counts[status]++; }
    return {...p,...counts,total:counts.normal+counts.late+counts.offsite,expected:dates.length};
  }).sort((a,b)=>b.unrecorded-a.unrecorded),[personnel,dates,summary]);

  const exportCsv = () => {
    if (!ready) return;
    const rows = [
      ["วันที่", "รหัส", "ชื่อ-สกุล", "ฝ่าย/กลุ่ม", "เข้างาน", "ออกงาน", "สถานะ", "GPS", "หมายเหตุ"],
      ...filtered.map((r: any) => [
        r.clock_date,
        r.personnel?.employee_code || "",
        `${r.personnel?.prefix || ""}${r.personnel?.first_name || ""} ${r.personnel?.last_name || ""}`,
        r.personnel?.department || "",
        r.clock_in ? new Date(r.clock_in).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
        r.clock_out ? new Date(r.clock_out).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
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

  const formatTime = (ts: string | null) => ts ? new Date(ts).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";

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
            <Button onClick={exportCsv} variant="outline" disabled={!ready}>
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

      {!validRange && <p role="alert" className="text-destructive">เลือกช่วงวันที่ให้ถูกต้องและไม่เริ่มในอนาคต</p>}
      {isLoading && <p role="status" className="text-muted-foreground">กำลังโหลดข้อมูล…</p>}
      {reportQuery.isError && <div role="alert" className="flex gap-3 items-center text-destructive"><span>โหลดรายงานไม่สำเร็จ</span><Button variant="outline" onClick={()=>reportQuery.refetch()}>ลองใหม่</Button></div>}
      {ready && <>
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="บุคลากรทั้งหมด" value={personnel.length} icon={Users} tone="muted" />
        <StatCard label="มาตรงเวลาวันนี้" value={onTime} icon={UserCheck} tone="success" />
        <StatCard label="มาสายวันนี้" value={late} icon={Clock} tone="warning" />
        <StatCard label="ยังไม่ลงเวลา" value={absent} icon={AlertTriangle} tone="destructive" />
      </div>

      <p className="text-sm font-medium">ลงเวลาวันนี้ {todaySummary.normal+todaySummary.late+todaySummary.offsite}/{todaySummary.total} คน ({todayRate ?? "—"}%)</p>
      <p className="text-xs text-muted-foreground">ช่วงที่เลือก: {dates.length} วันทำงาน · ฐานบุคลากรกำลังปฏิบัติงานปัจจุบัน {personnel.length} คน · ไม่รวมเสาร์–อาทิตย์และวันหยุดที่บันทึกไว้</p>
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
                {STAFF_STATUSES.map(key=><Bar key={key} dataKey={key} stackId="a" fill={STATUS_MAP[key].fill} name={STATUS_MAP[key].label} />)}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">สัดส่วนสถานะช่วงที่เลือก</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map(row => <Cell key={row.key} fill={row.fill} />)}
                </Pie>
                <Tooltip formatter={(value:number)=>[`${value} คน-วัน (${staffPercentage(value,summary.totals.total)}%)`,"ยอดสะสม"]} />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-sm font-medium mb-3">ลงเวลาเข้างาน {periodRate ?? "—"}%</p>
            <div className="space-y-2">{pieData.map(row=><div key={row.key} className="flex justify-between gap-2 text-xs"><span>{row.name}</span><span>{row.value} คน-วัน · {staffPercentage(row.value,summary.totals.total)}%</span></div>)}</div>
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
                <TableHead className="text-right text-success">ปกติ</TableHead>
                <TableHead className="text-right text-warning">สาย</TableHead>
                <TableHead className="text-right">ยังไม่ลงเวลา</TableHead>
                <TableHead className="text-right">% ตรงเวลา / วันทำงาน</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(perPerson as any[]).map((p) => {
                  const pct = staffPercentage(p.normal,p.expected);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.employee_code}</TableCell>
                      <TableCell>{p.prefix}{p.first_name} {p.last_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.department || p.position || "-"}</TableCell>
                      <TableCell className="text-right">{p.total}</TableCell>
                      <TableCell className="text-right text-success">{p.normal}</TableCell>
                      <TableCell className="text-right text-warning">{p.late}</TableCell>
                      <TableCell className="text-right">{p.unrecorded}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{pct === null ? "—" : `${pct}%`}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
      </>}
    </div>
  );
}