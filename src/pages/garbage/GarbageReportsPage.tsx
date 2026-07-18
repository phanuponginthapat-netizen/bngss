import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { TrendingUp, Coins, Recycle, Gift, Award, Trophy, Crown, FileDown, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, addDays, startOfYear, endOfYear, subMonths, subYears } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/lib/jspdfThai";
import * as XLSX from "xlsx";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

type Mode = "daily" | "monthly" | "term" | "yearly";

// Normalize free-text unit into a standard label
const normalizeUnit = (u?: string | null) => {
  const s = (u || "").trim().toLowerCase();
  if (!s) return "หน่วย";
  if (["kg", "kgs", "kilogram", "กก.", "กก", "กิโลกรัม", "กิโล"].includes(s)) return "กก.";
  if (["g", "gram", "กรัม"].includes(s)) return "กรัม";
  if (["pcs", "pc", "piece", "ชิ้น", "อัน"].includes(s)) return "ชิ้น";
  if (["ขวด", "bottle"].includes(s)) return "ขวด";
  if (["กล่อง", "box"].includes(s)) return "กล่อง";
  if (["ใบ", "sheet"].includes(s)) return "ใบ";
  if (["ถุง", "bag"].includes(s)) return "ถุง";
  return u || "หน่วย";
};

type ItemRow = { name: string; quantity: number; points: number; count: number; unit: string };
type RangeData = {
  timeline: { label: string; pointsIn: number; pointsOut: number; deposits: number; redemptions: number }[];
  byItem: ItemRow[];
  byUnit: { unit: string; quantity: number; points: number; count: number }[];
  byReward: { name: string; quantity: number; points: number }[];
  topStudents: { name: string; classroom: string; deposits: number; points: number }[];
  summary: { totalDeposits: number; totalRedeem: number; pointsIn: number; pointsOut: number; activeUsers: number };
};

const emptyRange = (): RangeData => ({
  timeline: [], byItem: [], byUnit: [], byReward: [], topStudents: [],
  summary: { totalDeposits: 0, totalRedeem: 0, pointsIn: 0, pointsOut: 0, activeUsers: 0 },
});

export default function GarbageReportsPage() {
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const [mode, setMode] = useState<Mode>("monthly");
  const [year, setYear] = useState<number>(currentAcademicYear);
  const [semester, setSemester] = useState<number>(currentSemester);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setYear(currentAcademicYear); setSemester(currentSemester); }, [currentAcademicYear, currentSemester]);

  // Compute current and previous range for comparison
  const ranges = useMemo(() => {
    const now = new Date();
    if (mode === "daily") {
      const from = startOfDay(subDays(now, 29));
      const to = endOfDay(now);
      const prevFrom = startOfDay(subDays(from, 30));
      const prevTo = endOfDay(subDays(to, 30));
      return { from, to, prevFrom, prevTo, label: "30 วันล่าสุด", prevLabel: "30 วันก่อนหน้า" };
    } else if (mode === "monthly") {
      const from = startOfMonth(now);
      const to = endOfMonth(now);
      const prev = subMonths(now, 1);
      return { from, to, prevFrom: startOfMonth(prev), prevTo: endOfMonth(prev),
        label: format(now, "MMMM yyyy", { locale: th }),
        prevLabel: format(prev, "MMMM yyyy", { locale: th }) };
    } else if (mode === "yearly") {
      const ce = year - 543;
      const from = new Date(ce, 0, 1);
      const to = new Date(ce, 11, 31, 23, 59, 59);
      return { from, to, prevFrom: new Date(ce - 1, 0, 1), prevTo: new Date(ce - 1, 11, 31, 23, 59, 59),
        label: `ปี พ.ศ. ${year}`, prevLabel: `ปี พ.ศ. ${year - 1}` };
    } else {
      const ce = year - 543;
      let from: Date, to: Date, prevFrom: Date, prevTo: Date;
      if (semester === 1) {
        from = new Date(ce, 4, 1); to = new Date(ce, 9, 31, 23, 59, 59);
        prevFrom = new Date(ce - 1, 4, 1); prevTo = new Date(ce - 1, 9, 31, 23, 59, 59);
      } else {
        from = new Date(ce, 10, 1); to = new Date(ce + 1, 3, 30, 23, 59, 59);
        prevFrom = new Date(ce - 1, 10, 1); prevTo = new Date(ce, 3, 30, 23, 59, 59);
      }
      return { from, to, prevFrom, prevTo,
        label: `ภาคเรียน ${semester}/${year}`, prevLabel: `ภาคเรียน ${semester}/${year - 1}` };
    }
  }, [mode, year, semester]);

  const [current, setCurrent] = useState<RangeData>(emptyRange());
  const [previous, setPrevious] = useState<RangeData>(emptyRange());

  const aggregate = (deps: any[], reds: any[], from: Date, to: Date): RangeData => {
    // Timeline
    const buckets = new Map<string, { pointsIn: number; pointsOut: number; deposits: number; redemptions: number }>();
    const bucketKey = (d: Date) =>
      mode === "daily" ? format(d, "dd MMM", { locale: th })
      : mode === "monthly" ? format(d, "dd")
      : mode === "yearly" ? format(d, "MMM", { locale: th })
      : format(d, "MMM", { locale: th });

    const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
    if (days <= 400) {
      const stepIsMonth = mode === "yearly" || mode === "term";
      let cur = new Date(from);
      while (cur <= to) {
        buckets.set(bucketKey(cur), { pointsIn: 0, pointsOut: 0, deposits: 0, redemptions: 0 });
        cur = stepIsMonth ? new Date(cur.getFullYear(), cur.getMonth() + 1, 1) : addDays(cur, 1);
      }
    }
    deps.forEach((d) => {
      const k = bucketKey(new Date(d.created_at));
      const c = buckets.get(k) || { pointsIn: 0, pointsOut: 0, deposits: 0, redemptions: 0 };
      c.pointsIn += Number(d.points_earned || 0); c.deposits += 1;
      buckets.set(k, c);
    });
    reds.forEach((d) => {
      const k = bucketKey(new Date(d.created_at));
      const c = buckets.get(k) || { pointsIn: 0, pointsOut: 0, deposits: 0, redemptions: 0 };
      c.pointsOut += Number(d.points_used || 0); c.redemptions += 1;
      buckets.set(k, c);
    });
    const timeline = Array.from(buckets.entries()).map(([label, v]) => ({ label, ...v }));

    // By item with unit
    const itemMap = new Map<string, ItemRow>();
    deps.forEach((d) => {
      const n = d.garbage_items?.name || "ไม่ระบุ";
      const u = normalizeUnit(d.garbage_items?.unit);
      const key = `${n}__${u}`;
      const cur = itemMap.get(key) || { name: n, quantity: 0, points: 0, count: 0, unit: u };
      cur.quantity += Number(d.quantity || 0);
      cur.points += Number(d.points_earned || 0);
      cur.count += 1;
      itemMap.set(key, cur);
    });
    const byItem = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);

    // By unit (aggregate same unit across items)
    const unitMap = new Map<string, { quantity: number; points: number; count: number }>();
    byItem.forEach((it) => {
      const cur = unitMap.get(it.unit) || { quantity: 0, points: 0, count: 0 };
      cur.quantity += it.quantity; cur.points += it.points; cur.count += it.count;
      unitMap.set(it.unit, cur);
    });
    const byUnit = Array.from(unitMap.entries()).map(([unit, v]) => ({ unit, ...v }))
      .sort((a, b) => b.quantity - a.quantity);

    // By reward
    const rewardMap = new Map<string, { quantity: number; points: number }>();
    reds.forEach((d) => {
      const n = d.garbage_rewards?.name || "ไม่ระบุ";
      const cur = rewardMap.get(n) || { quantity: 0, points: 0 };
      cur.quantity += Number(d.quantity || 0); cur.points += Number(d.points_used || 0);
      rewardMap.set(n, cur);
    });
    const byReward = Array.from(rewardMap.entries()).map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity);

    // Top users (students + personnel combined)
    const sm = new Map<string, { name: string; classroom: string; deposits: number; points: number }>();
    deps.forEach((d) => {
      const isStudent = !!d.student_id;
      const id = d.student_id || d.personnel_id;
      if (!id) return;
      const s = isStudent ? d.students : d.personnel;
      const name = `${s?.prefix || ""}${s?.first_name || ""} ${s?.last_name || ""}`.trim() || "-";
      const classroom = isStudent ? (s?.classrooms?.name || "-") : "บุคลากร";
      const cur = sm.get(id) || { name, classroom, deposits: 0, points: 0 };
      cur.deposits += 1; cur.points += Number(d.points_earned || 0);
      sm.set(id, cur);
    });
    const topStudents = Array.from(sm.values()).sort((a, b) => b.points - a.points).slice(0, 10);

    return {
      timeline, byItem, byUnit, byReward, topStudents,
      summary: {
        totalDeposits: deps.length,
        totalRedeem: reds.length,
        pointsIn: deps.reduce((s, d) => s + Number(d.points_earned || 0), 0),
        pointsOut: reds.reduce((s, d) => s + Number(d.points_used || 0), 0),
        activeUsers: sm.size,
      },
    };
  };

  const fetchRange = async (from: Date, to: Date) => {
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const [{ data: deps }, { data: reds }] = await Promise.all([
      supabase.from("garbage_deposits")
        .select("created_at, quantity, points_earned, student_id, personnel_id, garbage_items(name, unit), students(prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)), personnel(prefix, first_name, last_name)")
        .gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("garbage_redemptions")
        .select("created_at, quantity, points_used, garbage_rewards(name)")
        .gte("created_at", fromIso).lte("created_at", toIso),
    ]);
    return aggregate((deps || []) as any[], (reds || []) as any[], from, to);
  };

  const load = async () => {
    const [cur, prev] = await Promise.all([
      fetchRange(ranges.from, ranges.to),
      fetchRange(ranges.prevFrom, ranges.prevTo),
    ]);
    setCurrent(cur);
    setPrevious(prev);
  };

  useEffect(() => { load(); }, [ranges.from.getTime(), ranges.to.getTime()]);

  // Build comparison timeline (zip current+prev)
  const comparisonData = useMemo(() => {
    const labels = current.timeline.map((t) => t.label);
    return labels.map((lbl, i) => ({
      label: lbl,
      ปัจจุบัน: current.timeline[i]?.pointsIn || 0,
      ก่อนหน้า: previous.timeline[i]?.pointsIn || 0,
    }));
  }, [current, previous]);

  const pctChange = (cur: number, prev: number) => {
    if (!prev) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  const stat = (icon: any, label: string, value: string | number, prevVal: number, curVal: number, color: string) => {
    const change = pctChange(curVal, prevVal);
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className={`p-4 bg-gradient-to-br ${color}`}>
            <div className="flex items-center justify-between">
              <div className="text-white/90">
                <div className="text-xs uppercase tracking-wider opacity-90">{label}</div>
                <div className="text-2xl font-bold mt-1">{value}</div>
                <div className="text-xs mt-1 opacity-90">
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% vs ก่อนหน้า
                </div>
              </div>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const exportFullPdf = async () => {
    setExporting(true);
    try {
      // Fetch overall (entire bank lifetime) data
      const [{ data: allDeps }, { data: allReds }, { data: spts }, { data: ppts }, { data: items }, { data: rewards }] = await Promise.all([
        supabase.from("garbage_deposits").select("created_at, quantity, points_earned, student_id, personnel_id, garbage_items(name, unit), students(prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)), personnel(prefix, first_name, last_name)"),
        supabase.from("garbage_redemptions").select("created_at, quantity, points_used, garbage_rewards(name)"),
        supabase.from("garbage_student_points").select("total_points, students(prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name))"),
        supabase.from("garbage_personnel_points").select("total_points, personnel(prefix, first_name, last_name)"),
        supabase.from("garbage_items").select("name, unit, points_per_unit"),
        supabase.from("garbage_rewards").select("name, points_required, stock"),
      ]);

      const D = (allDeps || []) as any[];
      const R = (allReds || []) as any[];
      const overall = aggregate(D, R, new Date(2000, 0, 1), new Date(2100, 0, 1));

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      await registerThaiFont(doc);
      doc.setFont("THSarabunNew", "bold");

      const W = doc.internal.pageSize.getWidth();
      let y = 14;
      doc.setFontSize(20);
      doc.text("รายงานสรุปธนาคารขยะ (ทั้งระบบ)", W / 2, y, { align: "center" });
      y += 8;
      doc.setFont("THSarabunNew", "normal");
      doc.setFontSize(12);
      doc.text(`ออกรายงาน: ${format(new Date(), "d MMMM yyyy HH:mm:ss", { locale: th })}`, W / 2, y, { align: "center" });
      y += 4;
      doc.text(`ช่วงรายงานปัจจุบัน: ${ranges.label}  (เปรียบเทียบกับ ${ranges.prevLabel})`, W / 2, y, { align: "center" });

      // Summary table
      autoTable(doc, {
        startY: y + 6,
        head: [["รายการ", "ปัจจุบัน", "ก่อนหน้า", "ทั้งระบบ"]],
        body: [
          ["รายการฝาก", current.summary.totalDeposits.toLocaleString(), previous.summary.totalDeposits.toLocaleString(), overall.summary.totalDeposits.toLocaleString()],
          ["รายการแลก", current.summary.totalRedeem.toLocaleString(), previous.summary.totalRedeem.toLocaleString(), overall.summary.totalRedeem.toLocaleString()],
          ["แต้มเข้า", `+${current.summary.pointsIn.toLocaleString()}`, `+${previous.summary.pointsIn.toLocaleString()}`, `+${overall.summary.pointsIn.toLocaleString()}`],
          ["แต้มออก", `-${current.summary.pointsOut.toLocaleString()}`, `-${previous.summary.pointsOut.toLocaleString()}`, `-${overall.summary.pointsOut.toLocaleString()}`],
          ["แต้มคงเหลือสุทธิ",
            (current.summary.pointsIn - current.summary.pointsOut).toLocaleString(),
            (previous.summary.pointsIn - previous.summary.pointsOut).toLocaleString(),
            (overall.summary.pointsIn - overall.summary.pointsOut).toLocaleString()],
          ["ผู้ใช้งานในช่วง", current.summary.activeUsers.toLocaleString(), previous.summary.activeUsers.toLocaleString(), overall.summary.activeUsers.toLocaleString()],
        ],
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [16, 185, 129] },
      });

      // ปริมาณแยกตามหน่วย (ทั้งระบบ)
      const yAfter1 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFont("THSarabunNew", "bold"); doc.setFontSize(14);
      doc.text("ปริมาณรวมแยกตามหน่วย (ทั้งระบบ)", 14, yAfter1);
      autoTable(doc, {
        startY: yAfter1 + 2,
        head: [["หน่วย", "ปริมาณรวม", "จำนวนครั้ง", "แต้มที่จ่าย"]],
        body: overall.byUnit.map((u) => [u.unit, u.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 }), u.count.toLocaleString(), `+${u.points.toLocaleString()}`]),
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [59, 130, 246] },
      });

      // ประเภทขยะ
      doc.addPage();
      doc.setFont("THSarabunNew", "bold"); doc.setFontSize(16);
      doc.text("ประเภทขยะที่นำมาฝาก (ทั้งระบบ)", 14, 16);
      autoTable(doc, {
        startY: 20,
        head: [["อันดับ", "ประเภท", "ปริมาณ", "หน่วย", "ครั้ง", "แต้มรวม"]],
        body: overall.byItem.map((it, i) => [
          i + 1, it.name,
          it.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          it.unit, it.count.toLocaleString(), `+${it.points.toLocaleString()}`,
        ]),
        styles: { font: "THSarabunNew", fontSize: 11 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [16, 185, 129] },
      });

      // ของรางวัล
      const yAfter2 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFont("THSarabunNew", "bold"); doc.setFontSize(14);
      doc.text("ของรางวัลที่ถูกแลก (ทั้งระบบ)", 14, yAfter2);
      autoTable(doc, {
        startY: yAfter2 + 2,
        head: [["อันดับ", "ของรางวัล", "จำนวนครั้ง", "แต้มที่ใช้รวม"]],
        body: overall.byReward.map((r, i) => [i + 1, r.name, r.quantity.toLocaleString(), `-${r.points.toLocaleString()}`]),
        styles: { font: "THSarabunNew", fontSize: 11 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [245, 158, 11] },
      });

      // Top นักเรียน (ทั้งระบบจาก garbage_student_points)
      doc.addPage();
      doc.setFont("THSarabunNew", "bold"); doc.setFontSize(16);
      doc.text("Top 20 นักเรียน (แต้มสะสมทั้งระบบ)", 14, 16);
      const topS = (spts || [])
        .map((p: any) => ({
          name: `${p.students?.prefix || ""}${p.students?.first_name || ""} ${p.students?.last_name || ""}`.trim(),
          classroom: p.students?.classrooms?.name || "-",
          points: Number(p.total_points || 0),
        }))
        .filter((p) => p.name)
        .sort((a, b) => b.points - a.points).slice(0, 20);
      autoTable(doc, {
        startY: 20,
        head: [["อันดับ", "นักเรียน", "ห้อง", "แต้มสะสม"]],
        body: topS.map((s, i) => [i + 1, s.name, s.classroom, s.points.toLocaleString()]),
        styles: { font: "THSarabunNew", fontSize: 11 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [59, 130, 246] },
      });

      // Top บุคลากร
      const yAfter3 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFont("THSarabunNew", "bold"); doc.setFontSize(14);
      doc.text("Top 10 บุคลากร (แต้มสะสมทั้งระบบ)", 14, yAfter3);
      const topP = (ppts || [])
        .map((p: any) => ({
          name: `${p.personnel?.prefix || ""}${p.personnel?.first_name || ""} ${p.personnel?.last_name || ""}`.trim(),
          points: Number(p.total_points || 0),
        }))
        .filter((p) => p.name)
        .sort((a, b) => b.points - a.points).slice(0, 10);
      autoTable(doc, {
        startY: yAfter3 + 2,
        head: [["อันดับ", "บุคลากร", "แต้มสะสม"]],
        body: topP.map((s, i) => [i + 1, s.name, s.points.toLocaleString()]),
        styles: { font: "THSarabunNew", fontSize: 11 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [139, 92, 246] },
      });

      // Master data: rates + rewards
      doc.addPage();
      doc.setFont("THSarabunNew", "bold"); doc.setFontSize(16);
      doc.text("อัตราแลกเปลี่ยนขยะ", 14, 16);
      autoTable(doc, {
        startY: 20,
        head: [["ประเภทขยะ", "หน่วย", "แต้มต่อหน่วย"]],
        body: (items || []).map((it: any) => [it.name, normalizeUnit(it.unit), Number(it.points_per_unit || 0).toLocaleString()]),
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [16, 185, 129] },
      });

      const yAfter4 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFont("THSarabunNew", "bold"); doc.setFontSize(14);
      doc.text("รายการของรางวัล", 14, yAfter4);
      autoTable(doc, {
        startY: yAfter4 + 2,
        head: [["รางวัล", "แต้มที่ใช้แลก", "สต๊อกคงเหลือ"]],
        body: (rewards || []).map((r: any) => [r.name, Number(r.points_required || 0).toLocaleString(), Number(r.stock || 0).toLocaleString()]),
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [245, 158, 11] },
      });

      // Footer page numbers
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("THSarabunNew", "normal"); doc.setFontSize(10);
        doc.text(`หน้า ${i}/${pageCount}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
      }

      doc.save(`รายงานธนาคารขยะ-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
      toast.success("สร้างรายงาน PDF สำเร็จ");
    } catch (e: any) {
      console.error(e);
      toast.error("เกิดข้อผิดพลาด: " + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    try {
      setExporting(true);
      // Fetch full datasets
      const [{ data: allDeps }, { data: allReds }, { data: items }, { data: rewards }, { data: spts }, { data: ppts }] = await Promise.all([
        supabase.from("garbage_deposits").select("created_at, quantity, points_earned, garbage_items(name, unit), students(prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)), personnel(prefix, first_name, last_name, department)"),
        supabase.from("garbage_redemptions").select("created_at, quantity, points_used, garbage_rewards(name), students(prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)), personnel(prefix, first_name, last_name)"),
        supabase.from("garbage_items").select("name, unit, points_per_unit, is_active"),
        supabase.from("garbage_rewards").select("name, points_required, stock, is_active"),
        supabase.from("garbage_student_points").select("total_points, students(prefix, first_name, last_name, student_code, classrooms!students_classroom_id_fkey(name))"),
        supabase.from("garbage_personnel_points").select("total_points, personnel(prefix, first_name, last_name, employee_code, department)"),
      ]);

      const wb = XLSX.utils.book_new();

      // Sheet 1: สรุป
      const overall = aggregate((allDeps || []) as any[], (allReds || []) as any[], new Date(2000, 0, 1), new Date(2100, 0, 1));
      const summary = [
        ["รายงานธนาคารขยะ", `ออก ${format(new Date(), "d MMMM yyyy HH:mm:ss", { locale: th })}`],
        [],
        ["รายการ", "ปัจจุบัน", "ก่อนหน้า", "ทั้งระบบ"],
        ["รายการฝาก", current.summary.totalDeposits, previous.summary.totalDeposits, overall.summary.totalDeposits],
        ["รายการแลก", current.summary.totalRedeem, previous.summary.totalRedeem, overall.summary.totalRedeem],
        ["แต้มเข้า", current.summary.pointsIn, previous.summary.pointsIn, overall.summary.pointsIn],
        ["แต้มออก", current.summary.pointsOut, previous.summary.pointsOut, overall.summary.pointsOut],
        ["แต้มคงเหลือสุทธิ", current.summary.pointsIn - current.summary.pointsOut, previous.summary.pointsIn - previous.summary.pointsOut, overall.summary.pointsIn - overall.summary.pointsOut],
        ["ผู้ใช้งานในช่วง", current.summary.activeUsers, previous.summary.activeUsers, overall.summary.activeUsers],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "สรุป");

      // Sheet 2: รายการฝาก
      const depRows = (allDeps || []).map((d: any) => ({
        "วันที่": format(new Date(d.created_at), "yyyy-MM-dd HH:mm:ss"),
        "ผู้ฝาก": d.students ? `${d.students.prefix || ""}${d.students.first_name} ${d.students.last_name}` : d.personnel ? `${d.personnel.prefix || ""}${d.personnel.first_name} ${d.personnel.last_name}` : "-",
        "ประเภท": d.students ? "นักเรียน" : "บุคลากร",
        "ห้อง/แผนก": d.students?.classrooms?.name || d.personnel?.department || "-",
        "ขยะ": d.garbage_items?.name || "-",
        "ปริมาณ": Number(d.quantity || 0),
        "หน่วย": normalizeUnit(d.garbage_items?.unit),
        "แต้ม": Number(d.points_earned || 0),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depRows), "ฝากขยะ");

      // Sheet 3: รายการแลก
      const redRows = (allReds || []).map((r: any) => ({
        "วันที่": format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
        "ผู้แลก": r.students ? `${r.students.prefix || ""}${r.students.first_name} ${r.students.last_name}` : r.personnel ? `${r.personnel.prefix || ""}${r.personnel.first_name} ${r.personnel.last_name}` : "-",
        "ห้อง": r.students?.classrooms?.name || "-",
        "ของรางวัล": r.garbage_rewards?.name || "-",
        "จำนวน": Number(r.quantity || 0),
        "แต้มที่ใช้": Number(r.points_used || 0),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(redRows), "แลกของรางวัล");

      // Sheet 4: นักเรียน (แต้มสะสม)
      const sRows = (spts || [])
        .map((p: any) => ({
          "รหัสนักเรียน": p.students?.student_code || "-",
          "ชื่อ-สกุล": p.students ? `${p.students.prefix || ""}${p.students.first_name} ${p.students.last_name}` : "-",
          "ห้อง": p.students?.classrooms?.name || "-",
          "แต้มสะสม": Number(p.total_points || 0),
        }))
        .sort((a: any, b: any) => b["แต้มสะสม"] - a["แต้มสะสม"]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sRows), "นักเรียน-แต้มสะสม");

      // Sheet 5: บุคลากร
      const pRows = (ppts || [])
        .map((p: any) => ({
          "รหัสบุคลากร": p.personnel?.employee_code || "-",
          "ชื่อ-สกุล": p.personnel ? `${p.personnel.prefix || ""}${p.personnel.first_name} ${p.personnel.last_name}` : "-",
          "แผนก": p.personnel?.department || "-",
          "แต้มสะสม": Number(p.total_points || 0),
        }))
        .sort((a: any, b: any) => b["แต้มสะสม"] - a["แต้มสะสม"]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pRows), "บุคลากร-แต้มสะสม");

      // Sheet 6: อัตราแลก + รางวัล
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((items || []).map((i: any) => ({
        "ประเภทขยะ": i.name, "หน่วย": normalizeUnit(i.unit), "แต้มต่อหน่วย": Number(i.points_per_unit || 0), "เปิดใช้": i.is_active ? "ใช่" : "ไม่",
      }))), "อัตราแลก");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((rewards || []).map((r: any) => ({
        "ของรางวัล": r.name, "แต้มที่ใช้แลก": Number(r.points_required || 0), "สต๊อก": Number(r.stock || 0), "เปิดใช้": r.is_active ? "ใช่" : "ไม่",
      }))), "รางวัล");

      XLSX.writeFile(wb, `รายงานธนาคารขยะ-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
      toast.success("ดาวน์โหลด Excel สำเร็จ");
    } catch (e: any) {
      console.error(e);
      toast.error("เกิดข้อผิดพลาด: " + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="text-primary" /> รายงาน & แดชบอร์ดธนาคารขยะ</h1>
          <p className="text-muted-foreground text-sm">ภาพรวม {ranges.label} • เทียบกับ {ranges.prevLabel}</p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="daily">รายวัน</TabsTrigger>
              <TabsTrigger value="monthly">รายเดือน</TabsTrigger>
              <TabsTrigger value="term">รายเทอม</TabsTrigger>
              <TabsTrigger value="yearly">รายปี</TabsTrigger>
            </TabsList>
          </Tabs>
          {(mode === "term" || mode === "yearly") && (
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{academicYearOptions.map((y) => <SelectItem key={y} value={String(y)}>ปี {y}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {mode === "term" && (
            <Select value={String(semester)} onValueChange={(v) => setSemester(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">ภาคเรียน 1</SelectItem>
                <SelectItem value="2">ภาคเรียน 2</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button onClick={exportFullPdf} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            PDF ทั้งระบบ
          </Button>
          <Button onClick={exportExcel} disabled={exporting} variant="outline" className="gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stat(<Recycle className="w-8 h-8 text-white/70" />, "รายการฝาก", current.summary.totalDeposits.toLocaleString(), previous.summary.totalDeposits, current.summary.totalDeposits, "from-success to-success")}
        {stat(<Gift className="w-8 h-8 text-white/70" />, "รายการแลก", current.summary.totalRedeem.toLocaleString(), previous.summary.totalRedeem, current.summary.totalRedeem, "from-warning to-warning")}
        {stat(<Coins className="w-8 h-8 text-white/70" />, "แต้มเข้า", `+${current.summary.pointsIn.toLocaleString()}`, previous.summary.pointsIn, current.summary.pointsIn, "from-success to-success")}
        {stat(<Coins className="w-8 h-8 text-white/70" />, "แต้มออก", `-${current.summary.pointsOut.toLocaleString()}`, previous.summary.pointsOut, current.summary.pointsOut, "from-danger to-danger")}
        {stat(<Award className="w-8 h-8 text-white/70" />, "ผู้ใช้งาน", current.summary.activeUsers.toLocaleString(), previous.summary.activeUsers, current.summary.activeUsers, "from-info to-info")}
      </div>

      {/* ปริมาณรวมตามหน่วย */}
      <Card>
        <CardHeader><CardTitle>ปริมาณรวมตามหน่วยมาตรฐาน</CardTitle></CardHeader>
        <CardContent>
          {current.byUnit.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">ไม่มีข้อมูล</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {current.byUnit.map((u) => (
                <div key={u.unit} className="p-4 rounded-lg border bg-gradient-to-br from-muted/40 to-background">
                  <div className="text-xs text-muted-foreground">หน่วย</div>
                  <div className="text-lg font-bold">{u.unit}</div>
                  <div className="mt-2 text-2xl font-bold text-success">
                    {u.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {u.count.toLocaleString()} ครั้ง • +{u.points.toLocaleString()} แต้ม
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* แนวโน้มและการเปรียบเทียบ */}
      <Card>
        <CardHeader>
          <CardTitle>เปรียบเทียบแต้มเข้า: {ranges.label} vs {ranges.prevLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {comparisonData.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">ไม่มีข้อมูลในช่วงนี้</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ปัจจุบัน" stroke="#10b981" strokeWidth={2.5} />
                <Line type="monotone" dataKey="ก่อนหน้า" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>แต้มเข้า vs. ออก ({ranges.label})</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={current.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="pointsIn" stroke="#10b981" strokeWidth={2} name="แต้มเข้า" />
              <Line type="monotone" dataKey="pointsOut" stroke="#ef4444" strokeWidth={2} name="แต้มออก" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ประเภทขยะที่นำมาฝากมากที่สุด */}
      <Card className="border-success/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-success" />
            ประเภทขยะที่นำมาฝากมากที่สุด
          </CardTitle>
          <p className="text-sm text-muted-foreground">เรียงตามปริมาณรวม • แสดงหน่วยมาตรฐานของแต่ละประเภท</p>
        </CardHeader>
        <CardContent>
          {current.byItem.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={Math.max(220, current.byItem.length * 36)}>
                <BarChart data={current.byItem.slice(0, 10).map(it => ({ ...it, label: `${it.name} (${it.unit})` }))} layout="vertical" margin={{ left: 16, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v: any, _k: any, p: any) => `${v} ${p.payload.unit}`} />
                  <Bar dataKey="quantity" fill="#10b981" name="ปริมาณ" radius={[0, 6, 6, 0]}>
                    {current.byItem.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
                {(() => {
                  // For percentage, group by unit so we don't mix kg with pcs
                  const totalsByUnit = new Map<string, number>();
                  current.byItem.forEach((it) => {
                    totalsByUnit.set(it.unit, (totalsByUnit.get(it.unit) || 0) + it.quantity);
                  });
                  return current.byItem.map((it, i) => {
                    const total = totalsByUnit.get(it.unit) || 1;
                    const pct = (it.quantity / total) * 100;
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                    return (
                      <div key={it.name + it.unit} className="p-3 rounded-lg border bg-card hover:bg-muted/30">
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base font-bold w-8 text-center">{medal}</span>
                            <span className="font-medium truncate">{it.name}</span>
                            <Badge variant="secondary" className="shrink-0">{it.unit}</Badge>
                          </div>
                          <Badge variant="outline" className="shrink-0">{pct.toFixed(1)}%</Badge>
                        </div>
                        <Progress value={pct} className="h-2 mb-2" />
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>ปริมาณ <span className="font-bold text-foreground">{it.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {it.unit}</span></span>
                          <span>ครั้ง <span className="font-bold text-foreground">{it.count.toLocaleString()}</span></span>
                          <span>แต้ม <span className="font-bold text-success">+{it.points.toLocaleString()}</span></span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="w-4 h-4 text-warning" />ของรางวัลที่แลกบ่อยสุด</CardTitle></CardHeader>
        <CardContent>
          {current.byReward.length === 0 ? <div className="text-center text-muted-foreground py-12">ยังไม่มีข้อมูล</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={current.byReward} dataKey="quantity" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={(e: any) => `${e.name}: ${e.quantity}`}>
                  {current.byReward.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="text-warning" />Top 10 ผู้ใช้งาน ({ranges.label})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">อันดับ</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ห้อง/กลุ่ม</TableHead>
                <TableHead className="text-right">ครั้งที่ฝาก</TableHead>
                <TableHead className="text-right">แต้มที่ได้</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {current.topStudents.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">ไม่มีข้อมูล</TableCell></TableRow>
              ) : current.topStudents.map((s, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {i < 3 ? <Badge className={i === 0 ? "bg-warning" : i === 1 ? "bg-neutral" : "bg-warning"}>{i + 1}</Badge> : i + 1}
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.classroom}</TableCell>
                  <TableCell className="text-right">{s.deposits}</TableCell>
                  <TableCell className="text-right font-bold text-success">+{s.points.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
