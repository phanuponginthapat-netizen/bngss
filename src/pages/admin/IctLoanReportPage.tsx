import { useEffect, useMemo, useState } from "react";
import { bkkDateISO, todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, Filter, AlertTriangle, Package, Users, RefreshCw } from "lucide-react";
import { BEDatePicker } from "@/components/ui/be-date-picker";

type Loan = {
  id: string; status: string;
  borrowed_at: string; expected_return_at: string | null; returned_at: string | null;
  borrow_photo_url: string | null; return_photo_url: string | null;
  ict_devices: { id: string; name: string; asset_code: string; serial_number: string | null; category?: string | null } | null;
  students: { id: string; student_code: string; prefix: string; first_name: string; last_name: string; classrooms?: { name: string } | null } | null;
  personnel: { id: string; employee_code: string | null; prefix: string | null; first_name: string; last_name: string; department: string | null } | null;
};

const todayISO = () => todayBangkok();
const daysAgoISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return bkkDateISO(d); };

export default function IctLoanReportPage() {
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [borrowerType, setBorrowerType] = useState<"all" | "student" | "personnel">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "overdue" | "returned">("all");
  const [personQuery, setPersonQuery] = useState("");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const sel = "id,status,borrowed_at,expected_return_at,returned_at,borrow_photo_url,return_photo_url,ict_devices(id,name,asset_code,serial_number,category),students(id,student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)),personnel(id,employee_code,prefix,first_name,last_name,department)";
    let q = supabase.from("ict_loans").select(sel)
      .gte("borrowed_at", from + "T00:00:00")
      .lte("borrowed_at", to + "T23:59:59")
      .order("borrowed_at", { ascending: false }).limit(1000);
    if (statusFilter === "active") q = q.eq("status", "active");
    else if (statusFilter === "returned") q = q.eq("status", "returned");
    else if (statusFilter === "overdue") q = q.eq("status", "active").lt("expected_return_at", new Date().toISOString());
    if (borrowerType === "student") q = q.not("student_id", "is", null);
    else if (borrowerType === "personnel") q = q.not("personnel_id", "is", null);
    const { data } = await q;
    setLoans((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load();   }, [from, to, borrowerType, statusFilter]);

  const isOverdue = (l: Loan) => l.status === "active" && l.expected_return_at && new Date(l.expected_return_at) < new Date();
  const personOf = (l: Loan) =>
    l.students ? `${l.students.prefix}${l.students.first_name} ${l.students.last_name}` :
    l.personnel ? `${l.personnel.prefix || ""}${l.personnel.first_name} ${l.personnel.last_name}` : "-";
  const codeOf = (l: Loan) => l.students?.student_code || l.personnel?.employee_code || "-";

  const filtered = useMemo(() => {
    if (!personQuery.trim()) return loans;
    const s = personQuery.toLowerCase();
    return loans.filter((l) =>
      personOf(l).toLowerCase().includes(s) ||
      (codeOf(l) || "").toLowerCase().includes(s) ||
      (l.ict_devices?.name || "").toLowerCase().includes(s) ||
      (l.ict_devices?.serial_number || "").toLowerCase().includes(s) ||
      (l.ict_devices?.asset_code || "").toLowerCase().includes(s)
    );
  }, [loans, personQuery]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((l) => l.status === "active").length;
    const overdue = filtered.filter(isOverdue).length;
    const returned = filtered.filter((l) => l.status === "returned").length;
    const byBorrower: Record<string, { name: string; count: number }> = {};
    const byDevice: Record<string, { name: string; count: number }> = {};
    for (const l of filtered) {
      const pkey = l.students?.id || l.personnel?.id || "_";
      byBorrower[pkey] = byBorrower[pkey] || { name: personOf(l), count: 0 };
      byBorrower[pkey].count++;
      const dkey = l.ict_devices?.id || "_";
      byDevice[dkey] = byDevice[dkey] || { name: l.ict_devices?.name || "-", count: 0 };
      byDevice[dkey].count++;
    }
    return {
      total, active, overdue, returned,
      topBorrowers: Object.values(byBorrower).sort((a, b) => b.count - a.count).slice(0, 5),
      topDevices: Object.values(byDevice).sort((a, b) => b.count - a.count).slice(0, 5),
    };
  }, [filtered]);

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-";

  const exportCsv = () => {
    const rows = [
      ["ผู้ยืม", "รหัส", "ประเภท", "อุปกรณ์", "S/N", "ยืมเมื่อ", "กำหนดคืน", "คืนเมื่อ", "สถานะ"],
      ...filtered.map((l) => [
        personOf(l), codeOf(l),
        l.students ? "นักเรียน" : "บุคลากร",
        l.ict_devices?.name || "-",
        l.ict_devices?.serial_number || l.ict_devices?.asset_code || "-",
        fmt(l.borrowed_at), fmt(l.expected_return_at), fmt(l.returned_at),
        isOverdue(l) ? "เกินกำหนด" : l.status,
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ict-loan-report-${from}-to-${to}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> รายงานยืม-คืน ICT</h1>
          <p className="text-sm text-muted-foreground">กรองตามช่วงเวลา ผู้ยืม สถานะ พร้อมสรุปอุปกรณ์ที่ยังค้างอยู่</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช</Button>
          <Button size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> ส่งออก CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Filter className="w-4 h-4" /> ตัวกรอง</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-5 gap-3">
            <div><Label>ตั้งแต่</Label><BEDatePicker value={from} onChange={(v) => setFrom(v)} /></div>
            <div><Label>ถึง</Label><BEDatePicker value={to} onChange={(v) => setTo(v)} /></div>
            <div>
              <Label>ประเภทผู้ยืม</Label>
              <Select value={borrowerType} onValueChange={(v: any) => setBorrowerType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="student">นักเรียน</SelectItem>
                  <SelectItem value="personnel">ครู/บุคลากร</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>สถานะ</Label>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="active">ค้างคืน</SelectItem>
                  <SelectItem value="overdue">เกินกำหนด</SelectItem>
                  <SelectItem value="returned">คืนแล้ว</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>ค้นหา</Label><Input placeholder="ชื่อ/รหัส/SN" value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">รายการทั้งหมด</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ค้างคืน</div><div className="text-2xl font-bold text-amber-500">{stats.active}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> เกินกำหนด</div><div className="text-2xl font-bold text-destructive">{stats.overdue}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">คืนแล้ว</div><div className="text-2xl font-bold text-emerald-500">{stats.returned}</div></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> ผู้ยืมบ่อยที่สุด</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.topBorrowers.length === 0 ? <div className="text-sm text-muted-foreground">ไม่มีข้อมูล</div> :
              stats.topBorrowers.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{b.name}</span><Badge variant="outline">{b.count} ครั้ง</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> อุปกรณ์ถูกยืมบ่อย</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.topDevices.length === 0 ? <div className="text-sm text-muted-foreground">ไม่มีข้อมูล</div> :
              stats.topDevices.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{d.name}</span><Badge variant="outline">{d.count} ครั้ง</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">รายการ ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ผู้ยืม</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>อุปกรณ์ / SN</TableHead>
              <TableHead>ยืม</TableHead>
              <TableHead>กำหนดคืน</TableHead>
              <TableHead>คืน</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ไม่พบรายการ</TableCell></TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id} className={isOverdue(l) ? "bg-destructive/5" : ""}>
                  <TableCell><div>{personOf(l)}</div><div className="text-xs text-muted-foreground">{codeOf(l)}</div></TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{l.students ? "นักเรียน" : "บุคลากร"}</Badge></TableCell>
                  <TableCell><div>{l.ict_devices?.name || "-"}</div><div className="text-xs text-muted-foreground font-mono">{l.ict_devices?.serial_number || l.ict_devices?.asset_code || "-"}</div></TableCell>
                  <TableCell className="text-xs">{fmt(l.borrowed_at)}</TableCell>
                  <TableCell className="text-xs"><span className={isOverdue(l) ? "text-destructive font-medium" : ""}>{fmt(l.expected_return_at)}</span></TableCell>
                  <TableCell className="text-xs">{fmt(l.returned_at)}</TableCell>
                  <TableCell>
                    {isOverdue(l) ? <Badge variant="destructive">เกินกำหนด</Badge> :
                      l.status === "returned" ? <Badge variant="secondary">คืนแล้ว</Badge> :
                      <Badge variant="outline">{l.status}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}