import { useEffect, useMemo, useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, Recycle, Gift, Search, Download, Coins, GraduationCap, Briefcase, Eye } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";
import { BEDatePicker } from "@/components/ui/be-date-picker";

type HolderKind = "student" | "personnel";
type Row = {
  id: string;
  type: "deposit" | "redeem";
  created_at: string;
  holder_kind: HolderKind;
  holder_id: string;
  holder_name: string;
  holder_code: string;
  holder_sub: string; // ห้อง/ตำแหน่ง
  item_name: string;
  unit: string;
  quantity: number;
  points: number;
  recorded_by_name: string | null;
};

const today = () => todayBangkok();
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return bkkDateISO(d); };

export default function GarbageHistoryPage() {
  const [type, setType] = useState<"all" | "deposit" | "redeem">("all");
  const [holderFilter, setHolderFilter] = useState<"all" | HolderKind>("all");
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{ kind: HolderKind; id: string; name: string; sub: string } | null>(null);
  const [detailPoints, setDetailPoints] = useState(0);

  const load = async () => {
    setLoading(true);
    const fromDt = `${from}T00:00:00`;
    const toDt = `${to}T23:59:59`;
    const result: Row[] = [];

    if (type !== "redeem") {
      const { data } = await supabase
        .from("garbage_deposits")
        .select("id, created_at, quantity, points_earned, recorded_by_name, student_id, personnel_id, garbage_items(name, unit), students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)), personnel(employee_code, prefix, first_name, last_name, position)")
        .gte("created_at", fromDt).lte("created_at", toDt)
        .order("created_at", { ascending: false });
      (data || []).forEach((d: any) => {
        const isStudent = !!d.student_id;
        result.push({
          id: d.id, type: "deposit", created_at: d.created_at,
          holder_kind: isStudent ? "student" : "personnel",
          holder_id: isStudent ? d.student_id : d.personnel_id,
          holder_name: isStudent
            ? `${d.students?.prefix || ""}${d.students?.first_name || ""} ${d.students?.last_name || ""}`.trim()
            : `${d.personnel?.prefix || ""}${d.personnel?.first_name || ""} ${d.personnel?.last_name || ""}`.trim(),
          holder_code: isStudent ? (d.students?.student_code || "-") : (d.personnel?.employee_code || "-"),
          holder_sub: isStudent ? (d.students?.classrooms?.name || "-") : (d.personnel?.position || "-"),
          item_name: d.garbage_items?.name || "-",
          unit: d.garbage_items?.unit || "",
          quantity: Number(d.quantity || 0),
          points: Number(d.points_earned || 0),
          recorded_by_name: d.recorded_by_name,
        });
      });
    }

    if (type !== "deposit") {
      const { data } = await supabase
        .from("garbage_redemptions")
        .select("id, created_at, quantity, points_used, recorded_by_name, student_id, personnel_id, garbage_rewards(name), students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)), personnel(employee_code, prefix, first_name, last_name, position)")
        .gte("created_at", fromDt).lte("created_at", toDt)
        .order("created_at", { ascending: false });
      (data || []).forEach((d: any) => {
        const isStudent = !!d.student_id;
        result.push({
          id: d.id, type: "redeem", created_at: d.created_at,
          holder_kind: isStudent ? "student" : "personnel",
          holder_id: isStudent ? d.student_id : d.personnel_id,
          holder_name: isStudent
            ? `${d.students?.prefix || ""}${d.students?.first_name || ""} ${d.students?.last_name || ""}`.trim()
            : `${d.personnel?.prefix || ""}${d.personnel?.first_name || ""} ${d.personnel?.last_name || ""}`.trim(),
          holder_code: isStudent ? (d.students?.student_code || "-") : (d.personnel?.employee_code || "-"),
          holder_sub: isStudent ? (d.students?.classrooms?.name || "-") : (d.personnel?.position || "-"),
          item_name: d.garbage_rewards?.name || "-",
          unit: "ชิ้น",
          quantity: Number(d.quantity || 0),
          points: -Number(d.points_used || 0),
          recorded_by_name: d.recorded_by_name,
        });
      });
    }

    result.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setRows(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, [type, from, to]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (holderFilter !== "all" && r.holder_kind !== holderFilter) return false;
      if (!q) return true;
      return r.holder_name.toLowerCase().includes(q) ||
        r.holder_code.toLowerCase().includes(q) ||
        r.holder_sub.toLowerCase().includes(q) ||
        r.item_name.toLowerCase().includes(q);
    });
  }, [rows, search, holderFilter]);

  const summary = useMemo(() => {
    const dep = filtered.filter((r) => r.type === "deposit");
    const red = filtered.filter((r) => r.type === "redeem");
    return {
      totalDeposit: dep.length, totalRedeem: red.length,
      pointsIn: dep.reduce((s, r) => s + r.points, 0),
      pointsOut: -red.reduce((s, r) => s + r.points, 0),
    };
  }, [filtered]);

  // detail per holder (filter rows by selected holder)
  const detailRows = useMemo(() => {
    if (!detail) return [] as Row[];
    return rows.filter((r) => r.holder_kind === detail.kind && r.holder_id === detail.id);
  }, [rows, detail]);

  const detailSummary = useMemo(() => {
    const dep = detailRows.filter((r) => r.type === "deposit");
    const red = detailRows.filter((r) => r.type === "redeem");
    return {
      pointsIn: dep.reduce((s, r) => s + r.points, 0),
      pointsOut: -red.reduce((s, r) => s + r.points, 0),
      totalKg: dep.reduce((s, r) => s + r.quantity, 0),
    };
  }, [detailRows]);

  const openDetail = async (r: Row) => {
    setDetail({ kind: r.holder_kind, id: r.holder_id, name: r.holder_name, sub: r.holder_sub });
    if (r.holder_kind === "student") {
      const { data } = await supabase.from("garbage_student_points").select("total_points").eq("student_id", r.holder_id).maybeSingle();
      setDetailPoints((data as any)?.total_points || 0);
    } else {
      const { data } = await supabase.from("garbage_personnel_points").select("total_points").eq("personnel_id", r.holder_id).maybeSingle();
      setDetailPoints((data as any)?.total_points || 0);
    }
  };

  const exportCsv = () => {
    if (filtered.length === 0) { toast.error("ไม่มีข้อมูลให้ส่งออก"); return; }
    const header = ["วันเวลา", "ประเภท", "ผู้ใช้", "รหัส", "ชื่อ-สกุล", "ห้อง/ตำแหน่ง", "รายการ", "จำนวน", "หน่วย", "แต้ม", "ผู้บันทึก"];
    const rows2 = filtered.map((r) => [
      format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss"),
      r.type === "deposit" ? "ฝากขยะ" : "แลกรางวัล",
      r.holder_kind === "student" ? "นักเรียน" : "บุคลากร",
      r.holder_code, r.holder_name, r.holder_sub, r.item_name,
      r.quantity, r.unit, r.points, r.recorded_by_name || "",
    ]);
    const csv = [header, ...rows2].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `garbage-history-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><History className="text-primary" /> ประวัติธุรกรรมธนาคารขยะ</h1>
        <p className="text-muted-foreground text-sm">กรองตามช่วงเวลา ประเภท ผู้ใช้ และค้นหารายการ — กดที่แถวเพื่อดูรายละเอียดบุคคล</p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>ประเภทรายการ</Label>
            <Tabs value={type} onValueChange={(v) => setType(v as any)} className="mt-1">
              <TabsList className="grid grid-cols-1 sm:grid-cols-3 w-full">
                <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                <TabsTrigger value="deposit"><Recycle className="w-3.5 h-3.5 mr-1" />ฝาก</TabsTrigger>
                <TabsTrigger value="redeem"><Gift className="w-3.5 h-3.5 mr-1" />แลก</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="md:col-span-2">
            <Label>กลุ่มผู้ใช้</Label>
            <Tabs value={holderFilter} onValueChange={(v) => setHolderFilter(v as any)} className="mt-1">
              <TabsList className="grid grid-cols-1 sm:grid-cols-3 w-full">
                <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                <TabsTrigger value="student"><GraduationCap className="w-3.5 h-3.5 mr-1" />นักเรียน</TabsTrigger>
                <TabsTrigger value="personnel"><Briefcase className="w-3.5 h-3.5 mr-1" />บุคลากร</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div>
            <Label>จากวันที่</Label>
            <BEDatePicker value={from} onChange={(v) => setFrom(v)} />
          </div>
          <div>
            <Label>ถึงวันที่</Label>
            <BEDatePicker value={to} onChange={(v) => setTo(v)} />
          </div>
          <div className="md:col-span-2">
            <Label>ช่วงสำเร็จรูป</Label>
            <Select onValueChange={(v) => { if (v === "today") { setFrom(today()); setTo(today()); } else if (v === "7") { setFrom(daysAgo(7)); setTo(today()); } else if (v === "30") { setFrom(daysAgo(30)); setTo(today()); } else if (v === "90") { setFrom(daysAgo(90)); setTo(today()); } }}>
              <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">วันนี้</SelectItem>
                <SelectItem value="7">7 วันล่าสุด</SelectItem>
                <SelectItem value="30">30 วันล่าสุด</SelectItem>
                <SelectItem value="90">90 วันล่าสุด</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4 relative">
            <Label>ค้นหา</Label>
            <Search className="absolute left-2.5 bottom-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="พิมพ์ชื่อ / รหัส / ห้อง / ตำแหน่ง / รายการ..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">รายการฝาก</div><div className="text-2xl font-bold text-emerald-600">{summary.totalDeposit}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">รายการแลก</div><div className="text-2xl font-bold text-amber-600">{summary.totalRedeem}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">แต้มเข้า</div><div className="text-2xl font-bold text-emerald-600">+{summary.pointsIn.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">แต้มออก</div><div className="text-2xl font-bold text-rose-600">-{summary.pointsOut.toLocaleString()}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">รายการ ({filtered.length})</CardTitle>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />CSV</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันเวลา</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ผู้ใช้</TableHead>
                  <TableHead>ห้อง/ตำแหน่ง</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead className="text-right">แต้ม</TableHead>
                  <TableHead>ผู้บันทึก</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">กำลังโหลด...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">ไม่พบรายการ</TableCell></TableRow>
                ) : filtered.slice(0, 500).map((r) => (
                  <TableRow key={r.type + r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(r)}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_at), "dd MMM yy HH:mm:ss", { locale: th })}</TableCell>
                    <TableCell>
                      {r.type === "deposit"
                        ? <Badge className="bg-emerald-500 hover:bg-emerald-500">ฝาก</Badge>
                        : <Badge className="bg-amber-500 hover:bg-amber-500">แลก</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm flex items-center gap-1">
                        {r.holder_kind === "student" ? <GraduationCap className="w-3 h-3 text-primary" /> : <Briefcase className="w-3 h-3 text-primary" />}
                        {r.holder_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.holder_code}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.holder_sub}</TableCell>
                    <TableCell className="text-sm">{r.item_name}</TableCell>
                    <TableCell className="text-right text-sm">{r.quantity} {r.unit}</TableCell>
                    <TableCell className={`text-right font-bold ${r.points >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.points >= 0 ? "+" : ""}{r.points.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.recorded_by_name || "-"}</TableCell>
                    <TableCell><Eye className="w-3.5 h-3.5 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length > 500 && <p className="text-xs text-muted-foreground text-center mt-2">แสดง 500 รายการแรก — กรุณากรองช่วงเวลาให้แคบลง</p>}
          </div>
        </CardContent>
      </Card>

      {/* Per-holder detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-3xl sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail?.kind === "student" ? <GraduationCap className="w-5 h-5 text-primary" /> : <Briefcase className="w-5 h-5 text-primary" />}
              {detail?.name}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{detail.kind === "student" ? "ห้อง" : "ตำแหน่ง"}</div><div className="text-sm font-medium">{detail.sub}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3" />แต้มปัจจุบัน</div><div className="text-xl font-bold text-amber-600">{detailPoints.toLocaleString()}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">ฝากในช่วงนี้</div><div className="text-xl font-bold text-emerald-600">+{detailSummary.pointsIn.toLocaleString()}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">แลกในช่วงนี้</div><div className="text-xl font-bold text-rose-600">-{detailSummary.pointsOut.toLocaleString()}</div></CardContent></Card>
              </div>
              <div className="text-sm text-muted-foreground">รายการในช่วง {from} ถึง {to} ({detailRows.length} รายการ)</div>
              <Table>
                <TableHeader><TableRow><TableHead>วันเวลา</TableHead><TableHead>ประเภท</TableHead><TableHead>รายการ</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">แต้ม</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detailRows.map((r) => (
                    <TableRow key={r.type + r.id}>
                      <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM HH:mm:ss", { locale: th })}</TableCell>
                      <TableCell>{r.type === "deposit" ? <Badge className="bg-emerald-500">ฝาก</Badge> : <Badge className="bg-amber-500">แลก</Badge>}</TableCell>
                      <TableCell className="text-sm">{r.item_name}</TableCell>
                      <TableCell className="text-right text-sm">{r.quantity} {r.unit}</TableCell>
                      <TableCell className={`text-right font-bold ${r.points >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.points >= 0 ? "+" : ""}{r.points.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
