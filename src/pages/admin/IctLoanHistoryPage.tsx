import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, AlertTriangle, History, Package, PackageCheck, Clock, Users,
  TrendingUp, Laptop,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

function LoanPhoto({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const match = url.match(/\/ict-loan-photos\/(.+?)(\?|$)/) || url.match(/\/asset-photos\/(.+?)(\?|$)/);
      if (match) {
        const bucket = url.includes("/ict-loan-photos/") ? "ict-loan-photos" : "asset-photos";
        const { data } = await supabase.storage.from(bucket).createSignedUrl(match[1], 3600);
        if (!cancelled) setSrc(data?.signedUrl || url);
      } else if (!cancelled) setSrc(url);
    })();
    return () => { cancelled = true; };
  }, [url]);
  if (!src) return <div className="w-10 h-10 rounded border bg-muted" />;
  return <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={alt} className="w-10 h-10 object-cover rounded border" /></a>;
}

type Loan = {
  id: string; status: string;
  borrowed_at: string; expected_return_at: string | null; returned_at: string | null;
  borrow_photo_url: string | null; return_photo_url: string | null;
  borrow_notes: string | null; return_notes: string | null;
  ict_devices: { name: string; asset_code: string; serial_number: string | null; category?: string | null } | null;
  students: { student_code: string; prefix: string; first_name: string; last_name: string; classrooms?: { name: string } | null } | null;
  personnel: { employee_code: string | null; prefix: string | null; first_name: string; last_name: string; department: string | null } | null;
};

const STAT_GRADIENTS = {
  total: "from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-500/30",
  active: "from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30",
  overdue: "from-rose-500/15 via-rose-500/5 to-transparent border-rose-500/30",
  returned: "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30",
  borrowers: "from-sky-500/15 via-sky-500/5 to-transparent border-sky-500/30",
  avg: "from-violet-500/15 via-violet-500/5 to-transparent border-violet-500/30",
};

function StatCard({
  icon, label, value, sub, gradient,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; gradient: string }) {
  return (
    <Card className={`relative overflow-hidden border bg-gradient-to-br ${gradient}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
          </div>
          <div className="rounded-xl bg-background/60 backdrop-blur p-2 shadow-sm">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

export default function IctLoanHistoryPage() {
  const { userId, isAdmin, isDirector, loading: roleLoading } = useUserRole();
  const canSeeAll = isAdmin || isDirector;
  const [loans, setLoans] = useState<Loan[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "returned">("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    let query = supabase.from("ict_loans")
      .select("id,status,borrowed_at,expected_return_at,returned_at,borrow_photo_url,return_photo_url,borrow_notes,return_notes,student_id,personnel_id,ict_devices(name,asset_code,serial_number,category),students(student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)),personnel(employee_code,prefix,first_name,last_name,department)")
      .order("borrowed_at", { ascending: false }).limit(500);
    if (filter === "active") query = query.eq("status", "active");
    else if (filter === "returned") query = query.eq("status", "returned");
    else if (filter === "overdue") query = query.eq("status", "active").lt("expected_return_at", new Date().toISOString());

    if (!canSeeAll) {
      const [{ data: stu }, { data: per }] = await Promise.all([
        supabase.from("students").select("id").eq("auth_user_id", userId).maybeSingle(),
        supabase.from("personnel").select("id").eq("user_id", userId).maybeSingle(),
      ]);
      const studentId = (stu as any)?.id;
      const personnelId = (per as any)?.id;
      if (!studentId && !personnelId) { setLoans([]); setLoading(false); return; }
      const ors: string[] = [];
      if (studentId) ors.push(`student_id.eq.${studentId}`);
      if (personnelId) ors.push(`personnel_id.eq.${personnelId}`);
      query = query.or(ors.join(","));
    }

    const { data } = await query;
    setLoans((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (!roleLoading) load(); }, [filter, roleLoading, userId, canSeeAll]);

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-";
  const isOverdue = (l: Loan) => l.status === "active" && !!l.expected_return_at && new Date(l.expected_return_at) < new Date();

  const filtered = loans.filter((l) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      l.students?.student_code?.toLowerCase().includes(s) ||
      `${l.students?.first_name} ${l.students?.last_name}`.toLowerCase().includes(s) ||
      (l.personnel?.employee_code || "").toLowerCase().includes(s) ||
      `${l.personnel?.first_name || ""} ${l.personnel?.last_name || ""}`.toLowerCase().includes(s) ||
      l.ict_devices?.asset_code?.toLowerCase().includes(s) ||
      l.ict_devices?.serial_number?.toLowerCase().includes(s) ||
      l.ict_devices?.name?.toLowerCase().includes(s)
    );
  });

  // ===== Stats (จากผลที่ดึงมา) =====
  const stats = useMemo(() => {
    const total = loans.length;
    const active = loans.filter((l) => l.status === "active").length;
    const overdue = loans.filter(isOverdue).length;
    const returned = loans.filter((l) => l.status === "returned").length;
    const borrowers = new Set(loans.map((l) => l.students?.student_code || l.personnel?.employee_code || "x")).size;

    // เวลายืมเฉลี่ย (ชั่วโมง) — เฉพาะที่คืนแล้ว
    const durations = loans
      .filter((l) => l.status === "returned" && l.returned_at)
      .map((l) => (new Date(l.returned_at!).getTime() - new Date(l.borrowed_at).getTime()) / 36e5);
    const avgHours = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return { total, active, overdue, returned, borrowers, avgHours };
  }, [loans]);

  // ===== Chart data =====
  const trend = useMemo(() => {
    const map = new Map<string, { date: string; ยืม: number; คืน: number }>();
    const days = 14;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }), ยืม: 0, คืน: 0 });
    }
    loans.forEach((l) => {
      const bk = l.borrowed_at?.slice(0, 10);
      if (bk && map.has(bk)) map.get(bk)!.ยืม++;
      const rk = l.returned_at?.slice(0, 10);
      if (rk && map.has(rk)) map.get(rk)!.คืน++;
    });
    return Array.from(map.values());
  }, [loans]);

  const statusPie = useMemo(() => ([
    { name: "ค้างคืน", value: stats.active - stats.overdue, color: "hsl(var(--primary))" },
    { name: "เกินกำหนด", value: stats.overdue, color: "hsl(var(--destructive))" },
    { name: "คืนแล้ว", value: stats.returned, color: "hsl(142 70% 45%)" },
  ].filter((x) => x.value > 0)), [stats]);

  const topDevices = useMemo(() => {
    const m = new Map<string, number>();
    loans.forEach((l) => {
      const n = l.ict_devices?.name;
      if (!n) return;
      m.set(n, (m.get(n) || 0) + 1);
    });
    return Array.from(m.entries()).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 6);
  }, [loans]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-5">
      {/* ===== Hero ===== */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 md:p-6">
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 text-primary">
                <History className="w-5 h-5" />
              </span>
              แดชบอร์ดประวัติการยืม-คืน ICT
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              สถิติการใช้งานอุปกรณ์ ภาพถ่ายตอนยืม/คืน และการแจ้งเตือนเกินกำหนด
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>รีเฟรช</Button>
        </div>
      </div>

      {/* ===== Stat Cards ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Package className="w-5 h-5 text-indigo-600" />} label="ทั้งหมด" value={stats.total} sub="500 รายการล่าสุด" gradient={STAT_GRADIENTS.total} />
        <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label="กำลังยืม" value={stats.active} gradient={STAT_GRADIENTS.active} />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-rose-600" />} label="เกินกำหนด" value={stats.overdue} sub={stats.overdue > 0 ? "ต้องติดตามด่วน" : "ไม่มีเกินกำหนด"} gradient={STAT_GRADIENTS.overdue} />
        <StatCard icon={<PackageCheck className="w-5 h-5 text-emerald-600" />} label="คืนแล้ว" value={stats.returned} gradient={STAT_GRADIENTS.returned} />
        <StatCard icon={<Users className="w-5 h-5 text-sky-600" />} label="ผู้ยืมไม่ซ้ำ" value={stats.borrowers} gradient={STAT_GRADIENTS.borrowers} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-violet-600" />} label="ระยะเวลายืมเฉลี่ย" value={`${stats.avgHours.toFixed(1)} ชม.`} sub="เฉพาะที่คืนแล้ว" gradient={STAT_GRADIENTS.avg} />
      </div>

      {/* ===== Charts ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">แนวโน้ม 14 วันล่าสุด</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ยืม" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="คืน" fill="hsl(142 70% 45%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">สัดส่วนสถานะ</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {statusPie.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Top devices ===== */}
      {topDevices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Laptop className="w-4 h-4" /> อุปกรณ์ที่ยืมบ่อย</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {topDevices.map((d) => (
                <div key={d.name} className="rounded-xl border bg-card p-3">
                  <div className="text-xs text-muted-foreground truncate" title={d.name}>{d.name}</div>
                  <div className="text-xl font-bold tabular-nums mt-0.5">{d.count}</div>
                  <div className="text-[10px] text-muted-foreground">ครั้ง</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Filters ===== */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>ทั้งหมด</Button>
        <Button variant={filter === "active" ? "default" : "outline"} size="sm" onClick={() => setFilter("active")}>ค้างคืน</Button>
        <Button variant={filter === "overdue" ? "default" : "outline"} size="sm" onClick={() => setFilter("overdue")}>
          <AlertTriangle className="w-4 h-4 mr-1" /> เกินกำหนด {stats.overdue > 0 && <Badge variant="destructive" className="ml-1">{stats.overdue}</Badge>}
        </Button>
        <Button variant={filter === "returned" ? "default" : "outline"} size="sm" onClick={() => setFilter("returned")}>คืนแล้ว</Button>
        <div className="ml-auto flex gap-2 items-center">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="ค้นหา (รหัส/ชื่อ/SN)" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
        </div>
      </div>

      {/* ===== Table ===== */}
      <Card>
        <CardHeader><CardTitle className="text-base">รายการ ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ยืม</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>อุปกรณ์ / SN</TableHead>
                <TableHead>ยืม</TableHead>
                <TableHead>กำหนดคืน</TableHead>
                <TableHead>คืน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>ภาพ ยืม / คืน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่พบรายการ</TableCell></TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id} className={isOverdue(l) ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <div className="font-medium">
                      {l.students ? `${l.students.prefix}${l.students.first_name} ${l.students.last_name}` :
                       l.personnel ? `${l.personnel.prefix || ""}${l.personnel.first_name} ${l.personnel.last_name}` : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.students ? `${l.students.student_code} · ${l.students.classrooms?.name || "-"}` :
                       l.personnel ? `${l.personnel.employee_code || "-"} · ${l.personnel.department || "-"}` : "-"}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{l.students ? "นักเรียน" : "บุคลากร"}</Badge></TableCell>
                  <TableCell>
                    <div>{l.ict_devices?.name || "-"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{l.ict_devices?.serial_number || l.ict_devices?.asset_code || "-"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{fmt(l.borrowed_at)}</TableCell>
                  <TableCell className="text-xs">
                    {l.expected_return_at ? (
                      <span className={isOverdue(l) ? "text-destructive font-medium" : ""}>{fmt(l.expected_return_at)}</span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-xs">{fmt(l.returned_at)}</TableCell>
                  <TableCell>
                    {isOverdue(l) ? <Badge variant="destructive">เกินกำหนด</Badge> :
                      l.status === "returned" ? <Badge variant="secondary">คืนแล้ว</Badge> :
                      <Badge variant="outline">{l.status}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {l.borrow_photo_url ? <LoanPhoto url={l.borrow_photo_url} alt="ตอนยืม" /> : <div className="w-10 h-10 rounded border bg-muted/30 text-[9px] text-muted-foreground flex items-center justify-center">ยืม</div>}
                      {l.return_photo_url ? <LoanPhoto url={l.return_photo_url} alt="ตอนคืน" /> : <div className="w-10 h-10 rounded border bg-muted/30 text-[9px] text-muted-foreground flex items-center justify-center">คืน</div>}
                    </div>
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
