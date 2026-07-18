import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Recycle, Coins, Users, Trophy, CalendarDays } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { th } from "date-fns/locale";
import { BE_OFFSET } from "@/lib/dateBE";

type Stats = {
  studentsTotal: number;
  pointsTotal: number;
  itemsByType: { name: string; quantity: number; points: number }[];
  topStudents: { name: string; classroom: string; points: number }[];
};

type Period = "month" | "year";
type TrendRow = { label: string; deposits: number; redemptions: number; pointsIn: number; pointsOut: number };

export default function GarbageDashboardPage() {
  const [stats, setStats] = useState<Stats>({ studentsTotal: 0, pointsTotal: 0, itemsByType: [], topStudents: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [periodSummary, setPeriodSummary] = useState({ deposits: 0, redemptions: 0, pointsIn: 0, pointsOut: 0, totalQty: 0, label: "" });
  const [periodItems, setPeriodItems] = useState<{ name: string; quantity: number; points: number }[]>([]);

  const load = async () => {
    setLoading(true);
    const { count: studentsTotal } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active");
    const { data: pointsRows } = await supabase.from("garbage_student_points").select("total_points");
    const pointsTotal = (pointsRows || []).reduce((s, r: any) => s + (r.total_points || 0), 0);

    const { data: deposits } = await supabase
      .from("garbage_deposits")
      .select("quantity, points_earned, garbage_items(name)");
    const map = new Map<string, { quantity: number; points: number }>();
    (deposits || []).forEach((d: any) => {
      const n = d.garbage_items?.name || "ไม่ระบุ";
      const cur = map.get(n) || { quantity: 0, points: 0 };
      cur.quantity += Number(d.quantity || 0);
      cur.points += Number(d.points_earned || 0);
      map.set(n, cur);
    });
    const itemsByType = Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));

    const { data: top } = await supabase
      .from("garbage_student_points")
      .select("total_points, students(prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name))")
      .order("total_points", { ascending: false })
      .limit(5);
    const topStudents = (top || []).map((r: any) => ({
      name: `${r.students?.prefix || ""}${r.students?.first_name || ""} ${r.students?.last_name || ""}`.trim(),
      classroom: r.students?.classrooms?.name || "-",
      points: r.total_points,
    }));

    setStats({ studentsTotal: studentsTotal || 0, pointsTotal, itemsByType, topStudents });
    setLoading(false);
  };

  const loadPeriod = async () => {
    const now = new Date();
    const from = period === "month" ? startOfMonth(now) : startOfYear(now);
    const to = period === "month" ? endOfMonth(now) : endOfYear(now);
    const label = period === "month"
      ? format(now, "MMMM yyyy", { locale: th })
      : `ปี พ.ศ. ${now.getFullYear() + BE_OFFSET}`;

    const [{ data: deps }, { data: reds }] = await Promise.all([
      supabase.from("garbage_deposits")
        .select("created_at, quantity, points_earned, garbage_items(name)")
        .gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
      supabase.from("garbage_redemptions")
        .select("created_at, quantity, points_used")
        .gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
    ]);
    const D = (deps || []) as any[];
    const R = (reds || []) as any[];

    // Trend buckets: month → daily, year → monthly
    const buckets = new Map<string, TrendRow>();
    const keyOf = (d: Date) => period === "month"
      ? format(d, "dd")
      : format(d, "MMM", { locale: th });

    if (period === "month") {
      const lastDay = endOfMonth(now).getDate();
      for (let i = 1; i <= lastDay; i++) buckets.set(String(i).padStart(2, "0"), { label: String(i).padStart(2, "0"), deposits: 0, redemptions: 0, pointsIn: 0, pointsOut: 0 });
    } else {
      for (let m = 0; m < 12; m++) {
        const lbl = format(new Date(now.getFullYear(), m, 1), "MMM", { locale: th });
        buckets.set(lbl, { label: lbl, deposits: 0, redemptions: 0, pointsIn: 0, pointsOut: 0 });
      }
    }
    D.forEach((d) => {
      const k = keyOf(new Date(d.created_at));
      const c = buckets.get(k); if (!c) return;
      c.deposits += 1; c.pointsIn += Number(d.points_earned || 0);
    });
    R.forEach((d) => {
      const k = keyOf(new Date(d.created_at));
      const c = buckets.get(k); if (!c) return;
      c.redemptions += 1; c.pointsOut += Number(d.points_used || 0);
    });

    // Items breakdown for the period
    const im = new Map<string, { quantity: number; points: number }>();
    D.forEach((d) => {
      const n = d.garbage_items?.name || "ไม่ระบุ";
      const c = im.get(n) || { quantity: 0, points: 0 };
      c.quantity += Number(d.quantity || 0); c.points += Number(d.points_earned || 0);
      im.set(n, c);
    });

    setTrend(Array.from(buckets.values()));
    setPeriodItems(Array.from(im.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.quantity - a.quantity));
    setPeriodSummary({
      deposits: D.length,
      redemptions: R.length,
      pointsIn: D.reduce((s, d) => s + Number(d.points_earned || 0), 0),
      pointsOut: R.reduce((s, d) => s + Number(d.points_used || 0), 0),
      totalQty: D.reduce((s, d) => s + Number(d.quantity || 0), 0),
      label,
    });
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("garbage-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "garbage_deposits" }, () => { load(); loadPeriod(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "garbage_redemptions" }, () => { load(); loadPeriod(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "garbage_student_points" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { loadPeriod(); }, [period]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Recycle className="text-emerald-500" /> ธนาคารขยะ — ภาพรวม</h1>
        <p className="text-muted-foreground text-sm">สถิติแบบเรียลไทม์ของระบบรับฝากขยะและแลกของรางวัล</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="w-10 h-10 text-blue-500" />
          <div><div className="text-2xl font-bold">{stats.studentsTotal.toLocaleString()}</div><div className="text-sm text-muted-foreground">นักเรียนทั้งหมด</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Coins className="w-10 h-10 text-amber-500" />
          <div><div className="text-2xl font-bold">{stats.pointsTotal.toLocaleString()}</div><div className="text-sm text-muted-foreground">แต้มรวมทั้งระบบ</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Recycle className="w-10 h-10 text-emerald-500" />
          <div><div className="text-2xl font-bold">{stats.itemsByType.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</div><div className="text-sm text-muted-foreground">ปริมาณขยะที่รับฝาก (รวม)</div></div>
        </CardContent></Card>
      </div>

      {/* รายเดือน / รายปี */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            ภาพรวม{period === "month" ? "รายเดือน" : "รายปี"} — {periodSummary.label}
          </CardTitle>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="month">รายเดือน</TabsTrigger>
              <TabsTrigger value="year">รายปี</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg border bg-emerald-500/5">
              <div className="text-xs text-muted-foreground">รายการฝาก</div>
              <div className="text-xl font-bold text-emerald-600">{periodSummary.deposits.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border bg-amber-500/5">
              <div className="text-xs text-muted-foreground">รายการแลก</div>
              <div className="text-xl font-bold text-amber-600">{periodSummary.redemptions.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border bg-green-500/5">
              <div className="text-xs text-muted-foreground">แต้มเข้า</div>
              <div className="text-xl font-bold text-green-600">+{periodSummary.pointsIn.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border bg-rose-500/5">
              <div className="text-xs text-muted-foreground">แต้มออก</div>
              <div className="text-xl font-bold text-rose-600">-{periodSummary.pointsOut.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border bg-teal-500/5">
              <div className="text-xs text-muted-foreground">ปริมาณรวม</div>
              <div className="text-xl font-bold text-teal-600">{periodSummary.totalQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="pointsIn" stroke="#10b981" strokeWidth={2} name="แต้มเข้า" />
              <Line type="monotone" dataKey="pointsOut" stroke="#ef4444" strokeWidth={2} name="แต้มออก" />
            </LineChart>
          </ResponsiveContainer>

          <div>
            <div className="text-sm font-medium mb-2 text-muted-foreground">ขยะที่ฝากใน{period === "month" ? "เดือนนี้" : "ปีนี้"}</div>
            {periodItems.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-6">ยังไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={periodItems}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" name="ปริมาณ" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ขยะแต่ละประเภทที่รับฝาก</CardTitle></CardHeader>
        <CardContent>
          {stats.itemsByType.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">ยังไม่มีข้อมูลการรับฝาก</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.itemsByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="hsl(var(--primary))" name="ปริมาณ" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="text-amber-500" /> Top 5 นักเรียนแต้มสูงสุด</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>อันดับ</TableHead><TableHead>ชื่อ-สกุล</TableHead><TableHead>ห้องเรียน</TableHead><TableHead className="text-right">แต้ม</TableHead></TableRow></TableHeader>
            <TableBody>
              {stats.topStudents.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
              ) : stats.topStudents.map((s, i) => (
                <TableRow key={i}><TableCell>{i + 1}</TableCell><TableCell>{s.name}</TableCell><TableCell>{s.classroom}</TableCell><TableCell className="text-right font-bold">{s.points.toLocaleString()}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}