import { useMemo, useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import BackButton from "@/components/BackButton";
import {
  BarChart3, Download, FileSpreadsheet, FileText, Package, Search, Filter, X,
  Layers, MapPin, Building2, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/lib/jspdfThai";

const ASSET_CATEGORIES = [
  "ครุภัณฑ์สำนักงาน", "ครุภัณฑ์คอมพิวเตอร์", "ครุภัณฑ์การศึกษา",
  "ครุภัณฑ์งานบ้านงานครัว", "ครุภัณฑ์ยานพาหนะ", "ครุภัณฑ์โฆษณาและเผยแพร่",
  "สิ่งก่อสร้าง", "วัสดุสิ้นเปลือง",
];

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
];

const CONDITIONS = ["ปกติ", "ชำรุด", "จำหน่าย"];

type GroupBy = "category" | "location" | "responsible_person" | "condition" | "status";

const GROUP_LABELS: Record<GroupBy, string> = {
  category: "หมวดหมู่",
  location: "สถานที่/อาคาร",
  responsible_person: "หน่วยงาน/ผู้รับผิดชอบ",
  condition: "สภาพ",
  status: "สถานะ",
};

const formatMoney = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AssetReportsPage = () => {
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [search, setSearch] = useState("");

  const { data: records = [] } = useQuery({
    queryKey: ["assets-report"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("*").order("category");
      return data || [];
    },
  });

  const locations = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r: any) => r.location && set.add(r.location));
    return Array.from(set).sort();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r: any) => {
      const matchSearch = !search ||
        r.asset_code?.toLowerCase().includes(search.toLowerCase()) ||
        r.asset_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.serial_number?.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === "all" || r.category === filterCategory;
      const matchLoc = filterLocation === "all" || r.location === filterLocation;
      const matchCond = filterCondition === "all" || r.condition === filterCondition;
      return matchSearch && matchCat && matchLoc && matchCond;
    });
  }, [records, search, filterCategory, filterLocation, filterCondition]);

  // Group breakdown
  const grouped = useMemo(() => {
    const map: Record<string, { count: number; quantity: number; cost: number; value: number; items: any[] }> = {};
    filtered.forEach((r: any) => {
      const key = (r[groupBy] as string) || "ไม่ระบุ";
      if (!map[key]) map[key] = { count: 0, quantity: 0, cost: 0, value: 0, items: [] };
      const qty = Number(r.quantity) || 1;
      map[key].count++;
      map[key].quantity += qty;
      map[key].cost += Number(r.acquisition_cost || 0);
      map[key].value += Number(r.current_value || 0);
      map[key].items.push(r);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, groupBy]);

  // Stats
  const totalItems = filtered.length;
  const totalQty = filtered.reduce((s: number, r: any) => s + (Number(r.quantity) || 1), 0);
  const totalCost = filtered.reduce((s: number, r: any) => s + Number(r.acquisition_cost || 0), 0);
  const totalValue = filtered.reduce((s: number, r: any) => s + Number(r.current_value || 0), 0);
  const damagedQty = filtered
    .filter((r: any) => r.condition === "ชำรุด")
    .reduce((s: number, r: any) => s + (Number(r.quantity) || 1), 0);

  // Category breakdown for donut
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r: any) => {
      const k = r.category || "ไม่ระบุ";
      map[k] = (map[k] || 0) + (Number(r.quantity) || 1);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Export Excel
  const exportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary by group
      const summary = grouped.map((g, i) => ({
        ลำดับ: i + 1,
        [GROUP_LABELS[groupBy]]: g.name,
        "รายการ (รหัส)": g.count,
        "จำนวนรวม (ชิ้น)": g.quantity,
        "ราคารวม (บาท)": g.cost,
        "มูลค่าคงเหลือ (บาท)": g.value,
      }));
      summary.push({
        ลำดับ: 0,
        [GROUP_LABELS[groupBy]]: "รวมทั้งสิ้น",
        "รายการ (รหัส)": totalItems,
        "จำนวนรวม (ชิ้น)": totalQty,
        "ราคารวม (บาท)": totalCost,
        "มูลค่าคงเหลือ (บาท)": totalValue,
      } as any);
      const ws1 = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, ws1, `สรุปตาม${GROUP_LABELS[groupBy]}`);

      // Sheet 2: Detailed list
      const detail = filtered.map((r: any, i: number) => ({
        ลำดับ: i + 1,
        รหัส: r.asset_code,
        ชื่อ: r.asset_name,
        หมวดหมู่: r.category,
        "S/N": r.serial_number || "",
        "จำนวน (ชิ้น)": r.quantity || 1,
        สถานที่: r.location || "",
        ผู้รับผิดชอบ: r.responsible_person || "",
        สภาพ: r.condition,
        สถานะ: r.status,
        "ราคาที่ได้มา": Number(r.acquisition_cost || 0),
        "มูลค่าคงเหลือ": Number(r.current_value || 0),
        "วันที่ได้มา": r.acquisition_date || "",
      }));
      const ws2 = XLSX.utils.json_to_sheet(detail);
      XLSX.utils.book_append_sheet(wb, ws2, "รายการละเอียด");

      const ts = todayBangkok();
      XLSX.writeFile(wb, `รายงานสต็อกทรัพย์สิน_${ts}.xlsx`);
      toast.success("ส่งออก Excel สำเร็จ");
    } catch (e: any) {
      toast.error("ส่งออกไม่สำเร็จ: " + e.message);
    }
  };

  // Export PDF — A4 landscape, Thai font (TH Sarabun), autoTable for clean layout
  const exportPDF = async () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      await registerThaiFont(doc);

      const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
      const marginX = 10;
      const today = new Date().toLocaleDateString("th-TH", {
        day: "2-digit", month: "long", year: "numeric",
      });

      // Title
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(20);
      doc.text("รายงานสต็อกทรัพย์สิน", pageWidth / 2, 14, { align: "center" });

      doc.setFont("THSarabunNew", "normal");
      doc.setFontSize(13);
      doc.text(`จัดกลุ่มตาม: ${GROUP_LABELS[groupBy]}`, marginX, 22);
      doc.text(`วันที่ออกรายงาน: ${today}`, pageWidth - marginX, 22, { align: "right" });

      doc.setFontSize(12);
      doc.text(
        `รายการทั้งหมด: ${totalItems}  |  จำนวนรวม: ${totalQty.toLocaleString()} ชิ้น  |  ราคารวม: ฿${formatMoney(totalCost)}  |  มูลค่าคงเหลือ: ฿${formatMoney(totalValue)}`,
        marginX, 28
      );

      // ----- Summary table -----
      autoTable(doc, {
        startY: 33,
        head: [["ลำดับ", GROUP_LABELS[groupBy], "รายการ", "จำนวน (ชิ้น)", "ราคารวม (บาท)", "มูลค่าคงเหลือ (บาท)", "%"]],
        body: grouped.map((g, i) => [
          String(i + 1),
          g.name,
          String(g.count),
          g.quantity.toLocaleString(),
          formatMoney(g.cost),
          formatMoney(g.value),
          (totalQty > 0 ? Math.round((g.quantity / totalQty) * 100) : 0) + "%",
        ]),
        foot: [[
          "", "รวมทั้งสิ้น",
          String(totalItems), totalQty.toLocaleString(),
          formatMoney(totalCost), formatMoney(totalValue), "100%",
        ]],
        styles: { font: "THSarabunNew", fontStyle: "normal", fontSize: 11, cellPadding: 1.5, overflow: "linebreak" },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [59, 130, 246], textColor: 255, halign: "center" },
        footStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [241, 245, 249], textColor: 20 },
        columnStyles: {
          0: { halign: "center", cellWidth: 14 },
          1: { cellWidth: "auto" },
          2: { halign: "right", cellWidth: 22 },
          3: { halign: "right", cellWidth: 30 },
          4: { halign: "right", cellWidth: 38 },
          5: { halign: "right", cellWidth: 42 },
          6: { halign: "right", cellWidth: 16 },
        },
        margin: { left: marginX, right: marginX },
        theme: "striped",
      });

      // ----- Detail table on new page -----
      doc.addPage();
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(16);
      doc.text("รายการทรัพย์สิน (รายละเอียด)", pageWidth / 2, 14, { align: "center" });

      autoTable(doc, {
        startY: 20,
        head: [["รหัส", "ชื่อ", "หมวดหมู่", "S/N", "จำนวน", "สถานที่", "ผู้รับผิดชอบ", "สภาพ", "มูลค่าคงเหลือ"]],
        body: filtered.map((r: any) => [
          r.asset_code || "",
          r.asset_name || "",
          r.category || "",
          r.serial_number || "-",
          String(r.quantity || 1),
          r.location || "-",
          r.responsible_person || "-",
          r.condition || "",
          formatMoney(Number(r.current_value || 0)),
        ]),
        styles: { font: "THSarabunNew", fontStyle: "normal", fontSize: 10, cellPadding: 1.2, overflow: "linebreak" },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [59, 130, 246], textColor: 255, halign: "center" },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 50 },
          2: { cellWidth: 36 },
          3: { cellWidth: 28 },
          4: { halign: "right", cellWidth: 14 },
          5: { cellWidth: 32 },
          6: { cellWidth: 32 },
          7: { cellWidth: 18, halign: "center" },
          8: { halign: "right", cellWidth: 30 },
        },
        margin: { left: marginX, right: marginX },
        theme: "striped",
        didDrawPage: () => {
          // Page number footer
          const pageNum = doc.getNumberOfPages();
          doc.setFont("THSarabunNew", "normal");
          doc.setFontSize(10);
          doc.text(`หน้า ${pageNum}`, pageWidth - marginX, doc.internal.pageSize.getHeight() - 5, { align: "right" });
        },
      });

      const ts = todayBangkok();
      doc.save(`รายงานสต็อกทรัพย์สิน_${ts}.pdf`);
      toast.success("ส่งออก PDF สำเร็จ");
    } catch (e: any) {
      toast.error("ส่งออกไม่สำเร็จ: " + e.message);
    }
  };

  const clearFilters = () => {
    setSearch(""); setFilterCategory("all"); setFilterLocation("all"); setFilterCondition("all");
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            รายงานสต็อกทรัพย์สิน & แดชบอร์ด
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            สรุปจำนวนคงเหลือแยกตามหมวด • อาคาร • หน่วยงาน • พร้อมส่งออก Excel/PDF
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />Excel
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <FileText className="w-4 h-4 mr-2" />PDF
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">รายการทั้งหมด</div>
          <div className="text-2xl font-bold mt-1">{totalItems}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">จำนวนรวม (ชิ้น)</div>
          <div className="text-2xl font-bold mt-1 text-primary">{totalQty.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">ราคารวม</div>
          <div className="text-lg font-bold mt-1">฿{formatMoney(totalCost)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">มูลค่าคงเหลือ</div>
          <div className="text-lg font-bold mt-1 text-emerald-600">฿{formatMoney(totalValue)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">ชำรุด</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{damagedQty}</div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ค้นหา รหัส/ชื่อ/SN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={groupBy} onValueChange={(v: GroupBy) => setGroupBy(v)}>
                <SelectTrigger className="w-[180px]"><Layers className="w-3 h-3 mr-1.5" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(GROUP_LABELS) as GroupBy[]).map(k => (
                    <SelectItem key={k} value={k}>จัดกลุ่มตาม{GROUP_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px]"><Filter className="w-3 h-3 mr-1.5" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                  {ASSET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[160px]"><Building2 className="w-3 h-3 mr-1.5" /><SelectValue placeholder="สถานที่" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานที่</SelectItem>
                  {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterCondition} onValueChange={setFilterCondition}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="สภาพ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสภาพ</SelectItem>
                  {CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {(search || filterCategory !== "all" || filterLocation !== "all" || filterCondition !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />ล้าง
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />ประเภทอุปกรณ์ที่โรงเรียนมี
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} label={(e: any) => `${e.value}`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />จำนวนคงเหลือแยกตาม{GROUP_LABELS[groupBy]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {grouped.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={grouped.slice(0, 10)} margin={{ left: 0, right: 10, top: 5, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" angle={-25} textAnchor="end" height={70} tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="quantity" name="จำนวน (ชิ้น)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Summary + Detail */}
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary"><Layers className="w-4 h-4 mr-1.5" />สรุปตาม{GROUP_LABELS[groupBy]}</TabsTrigger>
          <TabsTrigger value="detail"><Package className="w-4 h-4 mr-1.5" />รายการละเอียด</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[60px]">ลำดับ</TableHead>
                    <TableHead>{GROUP_LABELS[groupBy]}</TableHead>
                    <TableHead className="text-right">รายการ</TableHead>
                    <TableHead className="text-right">จำนวน (ชิ้น)</TableHead>
                    <TableHead className="text-right">ราคารวม</TableHead>
                    <TableHead className="text-right">มูลค่าคงเหลือ</TableHead>
                    <TableHead className="text-right">% ของทั้งหมด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.map((g, i) => (
                    <TableRow key={g.name}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-right">{g.count}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{g.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-xs">฿{formatMoney(g.cost)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600">฿{formatMoney(g.value)}</TableCell>
                      <TableCell className="text-right text-xs">{totalQty > 0 ? Math.round((g.quantity / totalQty) * 100) : 0}%</TableCell>
                    </TableRow>
                  ))}
                  {grouped.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
                  )}
                  {grouped.length > 0 && (
                    <TableRow className="bg-muted/40 font-bold">
                      <TableCell></TableCell>
                      <TableCell>รวมทั้งสิ้น</TableCell>
                      <TableCell className="text-right">{totalItems}</TableCell>
                      <TableCell className="text-right text-primary">{totalQty.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-xs">฿{formatMoney(totalCost)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600">฿{formatMoney(totalValue)}</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>หมวดหมู่</TableHead>
                    <TableHead>S/N</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead>สถานที่</TableHead>
                    <TableHead>ผู้รับผิดชอบ</TableHead>
                    <TableHead>สภาพ</TableHead>
                    <TableHead className="text-right">มูลค่าคงเหลือ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.asset_code}</TableCell>
                      <TableCell className="font-medium text-sm">{r.asset_name}</TableCell>
                      <TableCell className="text-xs">{r.category}</TableCell>
                      <TableCell className="font-mono text-xs">{r.serial_number || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{r.quantity || 1}</TableCell>
                      <TableCell className="text-xs"><span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{r.location || "-"}</span></TableCell>
                      <TableCell className="text-xs">{r.responsible_person || "-"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.condition}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600">฿{formatMoney(Number(r.current_value || 0))}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssetReportsPage;