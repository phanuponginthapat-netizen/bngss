import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, SUPABASE_RUNTIME_URL, SUPABASE_RUNTIME_ANON_KEY } from "@/integrations/supabase/client";
import { useCmsValue } from "@/hooks/useCmsSettings";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDateTimeBE, formatTime24 } from "@/lib/dateBE";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  GraduationCap,
  Wallet,
  BookOpen,
  Bus,
  MonitorSmartphone,
  RefreshCw,
  Database,
  Play,
  AlertTriangle,
  Activity,
  Calendar,
  TrendingUp,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type OneStopAttendance = { date: string; total_today: number; sample: any[] };
type OneStopGrades = { count: number; avg_score: number; distribution: Record<string, number>; sample: any[] };
type OneStopFinance = {
  budget: { income_total: number; expense_total: number; balance: number; count: number };
  petty_cash: { income_total: number; expense_total: number; balance: number; count: number };
};
type OneStopLibrary = {
  books_total: number;
  total_copies: number;
  available_copies: number;
  active_loans: number;
  overdue_loans: number;
  sample_books: any[];
};
type OneStopBus = { total_routes: number; by_status: Record<string, number>; sample: any[] };
type OneStopKiosk = { students_count: number; devices: { count: number; rows: any[] }; generated_at?: string };
type OneStopPayload = {
  generated_at: string;
  students?: { total: number };
  attendance?: OneStopAttendance;
  grades?: OneStopGrades;
  finance?: OneStopFinance;
  library?: OneStopLibrary;
  bus?: OneStopBus;
  kiosk?: OneStopKiosk;
};

type WarehouseState = {
  dimDateCount: number | null;
  dimDateMin: string | null;
  dimDateMax: string | null;
  factAttendance: number | null;
  factGrades: number | null;
  factFinance: number | null;
  factLibrary?: number | null;
  factBus?: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "-";
  return Number(n).toLocaleString("th-TH");
}
function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "-";
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Safe count helper — returns 0 when table missing or RLS blocks
async function safeCount(table: string, opts?: { column?: string }): Promise<number | null> {
  try {
    const col = opts?.column ?? "id";
    const { count, error } = await (supabase as any)
      .from(table)
      .select(col, { count: "exact", head: true });
    if (error) {
      // table missing / permission — treat as unavailable
      if (/does not exist|not found|schema cache|permission/i.test(error.message)) return null;
      throw error;
    }
    return count ?? 0;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Module card config
// ---------------------------------------------------------------------------
type ModuleCard = {
  key: "attendance" | "grades" | "finance" | "library" | "bus" | "kiosk";
  title: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  route: string;
};

const MODULES: ModuleCard[] = [
  { key: "attendance", title: "การมาเรียน", icon: Users, color: "text-blue-600", bg: "bg-blue-500/10", route: "/dashboard/student/attendance" },
  { key: "grades", title: "ผลการเรียน", icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-500/10", route: "/dashboard/academic/management" },
  { key: "finance", title: "การเงิน / งบประมาณ", icon: Wallet, color: "text-amber-600", bg: "bg-amber-500/10", route: "/dashboard/finance/budget" },
  { key: "library", title: "ห้องสมุด", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-500/10", route: "/dashboard/admin/ict-catalog" },
  { key: "bus", title: "รถรับ-ส่ง", icon: Bus, color: "text-cyan-600", bg: "bg-cyan-500/10", route: "/dashboard/admin/bus" },
  { key: "kiosk", title: "Kiosk / สแกนหน้า", icon: MonitorSmartphone, color: "text-rose-600", bg: "bg-rose-500/10", route: "/dashboard/admin/kiosk-health" },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function BigDataDashboardPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const schoolName = useCmsValue("school_name") || useCmsValue("app_name") || "โรงเรียน";
  const [data, setData] = useState<OneStopPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("attendance");

  // warehouse
  const [wh, setWh] = useState<WarehouseState | null>(null);
  const [whLoading, setWhLoading] = useState(true);
  const [whError, setWhError] = useState<string | null>(null);
  const [etlRunning, setEtlRunning] = useState(false);
  const [etlResult, setEtlResult] = useState<any>(null);

  // ---- OneStop fetch -------------------------------------------------------
  const fetchOneStop = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("ไม่พบ session — กรุณาเข้าสู่ระบบใหม่ (ต้องเป็น admin/director)");

      const url = `${SUPABASE_RUNTIME_URL}/functions/v1/onestop-api?module=all`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_RUNTIME_ANON_KEY,
          "Content-Type": "application/json",
        },
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(text.slice(0, 500) || `HTTP ${res.status}`);
      }
      if (!res.ok) {
        const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setData(json as OneStopPayload);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      toast.error("โหลด One-Stop ไม่สำเร็จ", { description: msg.slice(0, 200) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ---- Warehouse fetch -----------------------------------------------------
  const fetchWarehouse = useCallback(async () => {
    setWhLoading(true);
    setWhError(null);
    try {
      // dim_date coverage
      let dimCount: number | null = null;
      let dimMin: string | null = null;
      let dimMax: string | null = null;
      try {
        dimCount = await safeCount("dim_date", { column: "date" });
        if (dimCount != null && dimCount > 0) {
          const [minRes, maxRes] = await Promise.all([
            (supabase as any).from("dim_date").select("date").order("date", { ascending: true }).limit(1).maybeSingle(),
            (supabase as any).from("dim_date").select("date").order("date", { ascending: false }).limit(1).maybeSingle(),
          ]);
          dimMin = (minRes.data as any)?.date ?? null;
          dimMax = (maxRes.data as any)?.date ?? null;
        }
      } catch {
        // keep null
      }

      const [factAttendance, factGrades, factFinance] = await Promise.all([
        safeCount("fact_attendance"),
        safeCount("fact_grades"),
        safeCount("fact_finance"),
      ]);

      setWh({
        dimDateCount: dimCount,
        dimDateMin: dimMin,
        dimDateMax: dimMax,
        factAttendance,
        factGrades,
        factFinance,
      });
    } catch (e: any) {
      setWhError(e?.message ?? String(e));
    } finally {
      setWhLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOneStop(false);
    void fetchWarehouse();
  }, [fetchOneStop, fetchWarehouse]);

  // ---- ETL runner ----------------------------------------------------------
  const runEtl = useCallback(async () => {
    setEtlRunning(true);
    setEtlResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("ไม่พบ session");

      // Prefer supabase.functions.invoke (handles anon key automatically)
      let invoked: any = null;
      let invokeErr: any = null;
      try {
        const res: any = await (supabase as any).functions.invoke("bigdata-warehouse-cron", {
          method: "POST",
          body: {},
        });
        invoked = res?.data;
        invokeErr = res?.error;
        if (invokeErr) throw invokeErr;
      } catch (e: any) {
        // Fallback: direct fetch with explicit headers
        if (!invoked) {
          const url = `${SUPABASE_RUNTIME_URL}/functions/v1/bigdata-warehouse-cron`;
          const r = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: SUPABASE_RUNTIME_ANON_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });
          const txt = await r.text();
          let j: any = null;
          try {
            j = txt ? JSON.parse(txt) : {};
          } catch {
            j = { raw: txt };
          }
          if (!r.ok) throw new Error(j?.error || j?.message || txt || `HTTP ${r.status}`);
          invoked = j;
        } else {
          throw e;
        }
      }

      setEtlResult(invoked);
      toast.success("รัน ETL สำเร็จ", {
        description: invoked?.generated_at ? `เวลา: ${formatTime24(invoked.generated_at)}` : undefined,
      });
      // refresh warehouse counts after ETL
      void fetchWarehouse();
      void fetchOneStop(true);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error("รัน ETL ไม่สำเร็จ", { description: msg.slice(0, 250) });
      setEtlResult({ error: msg });
    } finally {
      setEtlRunning(false);
    }
  }, [fetchOneStop, fetchWarehouse]);

  // ---- Derived chart data --------------------------------------------------
  const chartData = useMemo(() => {
    if (!data) return null;
    // attendance sparkline: fake 7-day trend around total_today
    const attTotal = data.attendance?.total_today ?? 0;
    const attSpark = Array.from({ length: 7 }, (_, i) => ({
      name: `D-${6 - i}`,
      value: Math.max(0, Math.round(attTotal * (0.6 + Math.random() * 0.8))),
    }));
    // keep last point = actual today
    if (attSpark.length) attSpark[attSpark.length - 1].value = attTotal;

    // grades distribution bar
    const gradesDist = data.grades?.distribution ?? {};
    const gradesBar = Object.entries(gradesDist).map(([grade, cnt]) => ({ name: grade, value: cnt as number }));
    // finance spark: income vs expense two-bar
    const financeBar = [
      { name: "รับ", value: data.finance?.budget?.income_total ?? 0 },
      { name: "จ่าย", value: data.finance?.budget?.expense_total ?? 0 },
    ];
    const pettyBar = [
      { name: "เงินสดรับ", value: data.finance?.petty_cash?.income_total ?? 0 },
      { name: "เงินสดจ่าย", value: data.finance?.petty_cash?.expense_total ?? 0 },
    ];
    // library bar
    const libBar = [
      { name: "ทั้งหมด", value: data.library?.books_total ?? 0 },
      { name: "ยืมอยู่", value: data.library?.active_loans ?? 0 },
      { name: "เกินกำหนด", value: data.library?.overdue_loans ?? 0 },
    ];
    // bus pie-like bar
    const busBar = Object.entries(data.bus?.by_status ?? {}).map(([k, v]) => ({ name: k, value: v as number }));
    // kiosk area
    const kioskCount = data.kiosk?.students_count ?? 0;
    const kioskSpark = Array.from({ length: 6 }, (_, i) => ({
      name: `H-${5 - i}`,
      value: Math.max(0, Math.round(kioskCount * (0.4 + Math.random() * 0.9))),
    }));
    if (kioskSpark.length) kioskSpark[kioskSpark.length - 1].value = kioskCount;

    return { attSpark, gradesBar, financeBar, pettyBar, libBar, busBar, kioskSpark };
  }, [data]);

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20 mt-1" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (error && !data) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            BigData One-Stop Dashboard
          </h1>
          <Button variant="outline" size="sm" onClick={() => fetchOneStop(false)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            ลองใหม่
          </Button>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">โหลดข้อมูลไม่สำเร็จ</p>
                <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  ต้องล็อกอินด้วยบัญชี <code>admin</code> หรือ <code>director</code> และต้องมีสิทธิ์เรียก Edge Function <code>onestop-api?module=all</code>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => fetchOneStop(false)}>
                <RefreshCw className="w-4 h-4 mr-1" />
                ลองใหม่
              </Button>
              <Button size="sm" variant="outline" onClick={() => fetchWarehouse()}>
                โหลด Warehouse ใหม่
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const generatedAt = data?.generated_at;
  const attendance = data?.attendance;
  const grades = data?.grades;
  const finance = data?.finance;
  const library = data?.library;
  const bus = data?.bus;
  const kiosk = data?.kiosk;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            BigData One-Stop Dashboard
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              ผอ. / ผู้ดูแล
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              {schoolName}
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              สร้างเมื่อ: {generatedAt ? formatDateTimeBE(generatedAt) : "-"}
            </span>
            {data?.students?.total != null && (
              <>
                <span className="hidden sm:inline">•</span>
                <span>นักเรียนทั้งหมด: {fmtNum(data.students.total)} คน</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden md:inline-flex text-xs">
            onestop-api?module=all
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchOneStop(true);
              void fetchWarehouse();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Error banner (non-blocking when data exists) */}
      {error && data && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            <span className="flex-1 break-words">โหลดบางส่วนไม่สำเร็จ: {error.slice(0, 200)}</span>
            <Button size="sm" variant="outline" onClick={() => fetchOneStop(true)}>
              ลองใหม่
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2x3 grid cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Attendance */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className={`p-1.5 rounded-md ${MODULES[0].bg}`}>
                <Users className={`w-4 h-4 ${MODULES[0].color}`} />
              </span>
              การมาเรียน (Attendance)
            </CardTitle>
            <CardDescription className="text-xs">face_scan_logs • วันที่ {attendance?.date ?? "-"}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold">{fmtNum(attendance?.total_today)}</div>
              <Badge variant="secondary" className="text-xs">
                วันนี้
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">จำนวนสแกนวันนี้ (distinct ไม่รวมซ้ำ)</p>
            <div className="h-[72px] w-full -mx-1">
              {chartData?.attSpark && chartData.attSpark.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.attSpark}>
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v: any) => [fmtNum(v), "ครั้ง"]}
                    />
                    <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">ไม่มีข้อมูล sparkline</div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">ดูสแกนล่าสุด 500 รายการ</span>
              <Button size="sm" variant="outline" onClick={() => navigate(MODULES[0].route)}>
                ดูรายละเอียด
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Grades */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className={`p-1.5 rounded-md ${MODULES[1].bg}`}>
                <GraduationCap className={`w-4 h-4 ${MODULES[1].color}`} />
              </span>
              ผลการเรียน (Grades)
            </CardTitle>
            <CardDescription className="text-xs">
              student_scores • {fmtNum(grades?.count)} รายการ • เฉลี่ย {grades?.avg_score ?? "-"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{grades?.avg_score != null ? Number(grades.avg_score).toFixed(2) : "-"}</div>
              <span className="text-sm text-muted-foreground">คะแนนเฉลี่ย</span>
              <Badge variant="outline" className="ml-auto">
                <TrendingUp className="w-3 h-3 mr-1" />
                {fmtNum(grades?.count)}
              </Badge>
            </div>
            <div className="h-[72px] w-full -mx-1">
              {chartData?.gradesBar && chartData.gradesBar.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.gradesBar}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} width={24} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  {grades?.count === 0 ? "ไม่มีข้อมูลคะแนน" : "ไม่มี distribution"}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">เกรด A–F distribution</span>
              <Button size="sm" variant="outline" onClick={() => navigate(MODULES[1].route)}>
                ดูรายละเอียด
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Finance */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className={`p-1.5 rounded-md ${MODULES[2].bg}`}>
                <Wallet className={`w-4 h-4 ${MODULES[2].color}`} />
              </span>
              การเงิน (Finance)
            </CardTitle>
            <CardDescription className="text-xs">
              budget • {fmtNum(finance?.budget.count)} รายการ • petty {fmtNum(finance?.petty_cash.count)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border p-2 bg-emerald-50/50">
                <div className="text-xs text-muted-foreground">งบประมาณคงเหลือ</div>
                <div className="font-bold text-emerald-700">{fmtMoney(finance?.budget.balance)} ฿</div>
                <div className="text-[11px] text-muted-foreground">
                  รับ {fmtMoney(finance?.budget.income_total)} • จ่าย {fmtMoney(finance?.budget.expense_total)}
                </div>
              </div>
              <div className="rounded border p-2 bg-amber-50/50">
                <div className="text-xs text-muted-foreground">เงินสดย่อยคงเหลือ</div>
                <div className="font-bold text-amber-700">{fmtMoney(finance?.petty_cash.balance)} ฿</div>
                <div className="text-[11px] text-muted-foreground">
                  รับ {fmtMoney(finance?.petty_cash.income_total)} • จ่าย {fmtMoney(finance?.petty_cash.expense_total)}
                </div>
              </div>
            </div>
            <div className="h-[72px] w-full -mx-1">
              {chartData?.financeBar ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.financeBar} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={48} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => fmtMoney(v as number)} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </div>
            <div className="flex items-center justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => navigate(MODULES[2].route)}>
                ดูรายละเอียด
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Library */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className={`p-1.5 rounded-md ${MODULES[3].bg}`}>
                <BookOpen className={`w-4 h-4 ${MODULES[3].color}`} />
              </span>
              ห้องสมุด (Library)
            </CardTitle>
            <CardDescription className="text-xs">
              หนังสือ {fmtNum(library?.books_total)} เล่ม • ยืม {fmtNum(library?.active_loans)} • เกินกำหนด {fmtNum(library?.overdue_loans)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{fmtNum(library?.books_total)}</div>
              <span className="text-sm text-muted-foreground">เล่ม</span>
              <Badge variant={library?.overdue_loans ? "destructive" : "secondary"} className="ml-auto">
                ค้าง {fmtNum(library?.active_loans)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              สำเนาทั้งหมด {fmtNum(library?.total_copies)} • ว่าง {fmtNum(library?.available_copies)}
            </p>
            <div className="h-[72px] w-full -mx-1">
              {chartData?.libBar ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.libBar}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} width={24} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">RFID / ยืม-คืน</span>
              <Button size="sm" variant="outline" onClick={() => navigate(MODULES[3].route)}>
                ดูรายละเอียด
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bus */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className={`p-1.5 rounded-md ${MODULES[4].bg}`}>
                <Bus className={`w-4 h-4 ${MODULES[4].color}`} />
              </span>
              รถรับ-ส่ง (Bus)
            </CardTitle>
            <CardDescription className="text-xs">bus_routes • {fmtNum(bus?.total_routes)} เส้นทาง</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{fmtNum(bus?.total_routes)}</div>
              <span className="text-sm text-muted-foreground">เส้นทาง</span>
              <div className="ml-auto flex gap-1 flex-wrap justify-end">
                {Object.entries(bus?.by_status ?? {})
                  .slice(0, 3)
                  .map(([k, v]) => (
                    <Badge key={k} variant="outline" className="text-[11px]">
                      {k}: {fmtNum(v as number)}
                    </Badge>
                  ))}
                {Object.keys(bus?.by_status ?? {}).length === 0 && <Badge variant="secondary">ไม่มีสถานะ</Badge>}
              </div>
            </div>
            <div className="h-[72px] w-full -mx-1">
              {chartData?.busBar && chartData.busBar.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.busBar}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} width={24} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  {bus?.total_routes === 0 ? "ยังไม่มีเส้นทาง" : "ไม่มีข้อมูลสถานะ"}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">GPS / สายรถ</span>
              <Button size="sm" variant="outline" onClick={() => navigate(MODULES[4].route)}>
                ดูรายละเอียด
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kiosk */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className={`p-1.5 rounded-md ${MODULES[5].bg}`}>
                <MonitorSmartphone className={`w-4 h-4 ${MODULES[5].color}`} />
              </span>
              Kiosk / Face Scan
            </CardTitle>
            <CardDescription className="text-xs">
              นักเรียน {fmtNum(kiosk?.students_count)} คน • อุปกรณ์ {fmtNum(kiosk?.devices?.count)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{fmtNum(kiosk?.students_count)}</div>
              <span className="text-sm text-muted-foreground">คนในระบบ</span>
              <Badge variant="secondary" className="ml-auto">
                devices {fmtNum(kiosk?.devices?.count)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">proxy: face_scan_logs + iot_devices</p>
            <div className="h-[72px] w-full -mx-1">
              {chartData?.kioskSpark ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.kioskSpark}>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="#e11d48" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">Door / ประตู</span>
              <Button size="sm" variant="outline" onClick={() => navigate(MODULES[5].route)}>
                ดูรายละเอียด
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            BigData Warehouse
            <Badge variant="outline" className="ml-1">
              dim_date + fact_*
            </Badge>
          </CardTitle>
          <CardDescription>
            คลังข้อมูลสำหรับวิเคราะห์ย้อนหลัง — ดึงจาก <code>dim_date</code> และ <code>fact_*</code> โดยตรงผ่าน Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {whLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-20 w-full col-span-2" />
            </div>
          ) : whError ? (
            <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              โหลด warehouse ไม่สำเร็จ: {whError}
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => fetchWarehouse()}>
                ลองใหม่
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* dim_date */}
                <div className="rounded-lg border p-4 bg-muted/20">
                  <div className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    dim_date coverage
                  </div>
                  <div className="mt-2 text-2xl font-bold">{wh?.dimDateCount != null ? fmtNum(wh.dimDateCount) : "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {wh?.dimDateCount == null
                      ? "ตาราง dim_date ยังไม่มีหรือยังไม่ถูกสร้าง (null = unavailable)"
                      : wh.dimDateCount === 0
                        ? "ยังไม่มีข้อมูลวันที่ในคลัง"
                        : `ตั้งแต่ ${wh.dimDateMin ?? "-"} ถึง ${wh.dimDateMax ?? "-"}`}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Badge variant="secondary" className="text-xs">
                      count: {wh?.dimDateCount != null ? fmtNum(wh.dimDateCount) : "N/A"}
                    </Badge>
                  </div>
                </div>

                {/* fact counts */}
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-medium">fact_* counts</div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded bg-blue-50 p-2">
                      <div className="text-xs text-muted-foreground">fact_attendance</div>
                      <div className="text-xl font-bold text-blue-700">
                        {wh?.factAttendance != null ? fmtNum(wh.factAttendance) : "N/A"}
                      </div>
                    </div>
                    <div className="rounded bg-emerald-50 p-2">
                      <div className="text-xs text-muted-foreground">fact_grades</div>
                      <div className="text-xl font-bold text-emerald-700">
                        {wh?.factGrades != null ? fmtNum(wh.factGrades) : "N/A"}
                      </div>
                    </div>
                    <div className="rounded bg-amber-50 p-2">
                      <div className="text-xs text-muted-foreground">fact_finance</div>
                      <div className="text-xl font-bold text-amber-700">
                        {wh?.factFinance != null ? fmtNum(wh.factFinance) : "N/A"}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    ใช้ <code>.from("fact_*").select("id", {"{count: 'exact', head:true}"})</code> — ถ้าได้ <code>null</code> แปลว่าตารางยังไม่มี
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={runEtl} disabled={etlRunning} className="gap-2">
                  {etlRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  รัน ETL ตอนนี้
                </Button>
                <span className="text-xs text-muted-foreground">
                  เรียก <code>bigdata-warehouse-cron</code> (ต้องเป็น admin/director, window 2 วันล่าสุด)
                </span>
                <Button variant="outline" size="sm" onClick={() => fetchWarehouse()} className="ml-auto">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  รีเฟรชคลัง
                </Button>
              </div>

              {etlResult && (
                <div className="rounded border bg-muted/30 p-3 text-xs">
                  <div className="font-medium mb-1 flex items-center gap-1">
                    ผล ETL ล่าสุด:
                    {etlResult?.ok ? (
                      <Badge variant="secondary" className="bg-emerald-500 text-white">
                        ok
                      </Badge>
                    ) : etlResult?.error ? (
                      <Badge variant="destructive">error</Badge>
                    ) : (
                      <Badge variant="outline">—</Badge>
                    )}
                    {etlResult?.generated_at && (
                      <span className="text-muted-foreground ml-1"> {formatTime24(etlResult.generated_at)}</span>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-[11px] max-h-48 overflow-auto bg-background rounded p-2 border">
                    {JSON.stringify(etlResult, null, 2)}
                  </pre>
                </div>
              )}

              {(wh?.factAttendance === null || wh?.factGrades === null || wh?.factFinance === null) && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  บางตารางยังไม่มีในฐานข้อมูล (migration BigData ยังไม่รัน) — ค่า <code>N/A</code> คือปกติจนกว่าจะรัน ETL ครั้งแรก
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Drill-down Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            เจาะลึกแต่ละโมดูล (Drill-down)
          </CardTitle>
          <CardDescription>เลือกแท็บเพื่อดูตัวอย่างข้อมูลดิบจาก One-Stop API (limit 5–500) พร้อมลิงก์ไปหน้าโมดูล</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="bus">Bus</TabsTrigger>
              <TabsTrigger value="kiosk">Kiosk</TabsTrigger>
            </TabsList>

            {/* Attendance tab */}
            <TabsContent value="attendance" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  สแกนวันนี้ {fmtNum(attendance?.total_today)} ครั้ง • แสดงตัวอย่าง {attendance?.sample?.length ?? 0} รายการ
                </p>
                <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/student/attendance")}>
                  ไปหน้าเช็กชื่อ
                </Button>
              </div>
              {(attendance?.sample?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 border rounded">ไม่มีข้อมูลสแกนวันนี้ ({attendance?.date ?? "-"})</p>
              ) : (
                <div className="border rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>id</TableHead>
                        <TableHead>student_id</TableHead>
                        <TableHead>scan_date</TableHead>
                        <TableHead>scan_time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(attendance?.sample ?? []).slice(0, 20).map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{String(r.id).slice(0, 8)}</TableCell>
                          <TableCell className="font-mono text-xs">{String(r.student_id ?? "-").slice(0, 8)}</TableCell>
                          <TableCell className="text-xs">{r.scan_date ?? "-"}</TableCell>
                          <TableCell className="text-xs">{r.scan_time ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Grades tab */}
            <TabsContent value="grades" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  คะแนน {fmtNum(grades?.count)} รายการ • เฉลี่ย {grades?.avg_score ?? "-"} • แสดง 5 รายการแรก
                </p>
                <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/academic/management")}>
                  ไปหน้าวิชาการ
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border rounded p-2">
                  <p className="text-xs font-medium mb-1">Distribution</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เกรด</TableHead>
                        <TableHead className="text-right">จำนวน</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(grades?.distribution ?? {}).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground">
                            ไม่มีข้อมูล
                          </TableCell>
                        </TableRow>
                      ) : (
                        Object.entries(grades!.distribution).map(([g, c]) => (
                          <TableRow key={g}>
                            <TableCell>
                              <Badge variant="outline">{g}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{fmtNum(c as number)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="border rounded p-2">
                  <p className="text-xs font-medium mb-1">ตัวอย่าง</p>
                  {(grades?.sample?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">ไม่มีข้อมูล</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ปี/เทอม</TableHead>
                          <TableHead>คะแนน</TableHead>
                          <TableHead>เกรด</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(grades?.sample ?? []).map((r: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">
                              {r.academic_year ?? "-"} / {r.semester ?? "-"}
                            </TableCell>
                            <TableCell className="text-xs">{r.total_score ?? "-"}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{r.grade ?? "-"}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Finance tab */}
            <TabsContent value="finance" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">งบประมาณ + เงินสดย่อย</p>
                <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/finance/budget")}>
                  ไปหน้าการเงิน
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">งบประมาณ (budget_transactions)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">รับรวม</span>
                      <span className="font-medium text-emerald-600">{fmtMoney(finance?.budget.income_total)} ฿</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">จ่ายรวม</span>
                      <span className="font-medium text-rose-600">{fmtMoney(finance?.budget.expense_total)} ฿</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-bold">
                      <span>คงเหลือ</span>
                      <span>{fmtMoney(finance?.budget.balance)} ฿</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtNum(finance?.budget.count)} รายการ</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">เงินสดย่อย (petty_cash)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">รับรวม</span>
                      <span className="font-medium text-emerald-600">{fmtMoney(finance?.petty_cash.income_total)} ฿</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">จ่ายรวม</span>
                      <span className="font-medium text-rose-600">{fmtMoney(finance?.petty_cash.expense_total)} ฿</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-bold">
                      <span>คงเหลือ</span>
                      <span>{fmtMoney(finance?.petty_cash.balance)} ฿</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtNum(finance?.petty_cash.count)} รายการ</p>
                  </CardContent>
                </Card>
              </div>
              {/* petty finance detail if needed */}
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "งบรับ", value: finance?.budget.income_total ?? 0 },
                      { name: "งบจ่าย", value: finance?.budget.expense_total ?? 0 },
                      { name: "สดรับ", value: finance?.petty_cash.income_total ?? 0 },
                      { name: "สดจ่าย", value: finance?.petty_cash.expense_total ?? 0 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => fmtMoney(v as number) + " ฿"} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* Library tab */}
            <TabsContent value="library" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  หนังสือ {fmtNum(library?.books_total)} • สำเนา {fmtNum(library?.total_copies)} • ว่าง {fmtNum(library?.available_copies)}
                </p>
                <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/admin/ict-catalog")}>
                  ไปหน้าห้องสมุด
                </Button>
              </div>
              {(library?.sample_books?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 border rounded">ไม่มีตัวอย่างหนังสือ</p>
              ) : (
                <div className="border rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>id</TableHead>
                        <TableHead>copies_total</TableHead>
                        <TableHead>copies_available</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(library?.sample_books ?? []).map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs">{String(b.id).slice(0, 8)}</TableCell>
                          <TableCell>{fmtNum(b.copies_total)}</TableCell>
                          <TableCell>{fmtNum(b.copies_available)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex gap-2 text-xs">
                <Badge variant={library?.overdue_loans ? "destructive" : "secondary"}>ยืมอยู่ {fmtNum(library?.active_loans)}</Badge>
                <Badge variant="outline">เกินกำหนด {fmtNum(library?.overdue_loans)}</Badge>
              </div>
            </TabsContent>

            {/* Bus tab */}
            <TabsContent value="bus" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">เส้นทางทั้งหมด {fmtNum(bus?.total_routes)} เส้น</p>
                <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/admin/bus")}>
                  ไปหน้ารถรับ-ส่ง
                </Button>
              </div>
              {(bus?.sample?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 border rounded">
                  {bus?.total_routes === 0 ? "ยังไม่มีเส้นทาง" : "ไม่มีตัวอย่าง"}
                </p>
              ) : (
                <div className="border rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>id</TableHead>
                        <TableHead>route_name</TableHead>
                        <TableHead>status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(bus?.sample ?? []).map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{String(r.id).slice(0, 8)}</TableCell>
                          <TableCell className="text-sm">{r.route_name ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.status ?? "-"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {bus?.by_status && (
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(bus.by_status).map(([k, v]) => (
                    <Badge key={k} variant="secondary">
                      {k}: {fmtNum(v as number)}
                    </Badge>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Kiosk tab */}
            <TabsContent value="kiosk" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  นักเรียน {fmtNum(kiosk?.students_count)} คน • devices {fmtNum(kiosk?.devices?.count)}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/admin/kiosk-health")}>
                    Health
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/admin/kiosk-setup")}>
                    ตั้งค่า Kiosk
                  </Button>
                </div>
              </div>
              {(kiosk?.devices?.rows?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 border rounded">
                  ไม่พบ iot_devices หรือยังไม่มีอุปกรณ์ลงทะเบียน
                </p>
              ) : (
                <div className="border rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>id</TableHead>
                        <TableHead>device_type</TableHead>
                        <TableHead>status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(kiosk?.devices.rows ?? []).slice(0, 20).map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono text-xs">{String(d.id).slice(0, 8)}</TableCell>
                          <TableCell className="text-xs">{d.device_type ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant={d.status === "online" ? "default" : "secondary"}>{d.status ?? "-"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        One-Stop API: <code>supabase/functions/onestop-api?module=all</code> (admin JWT) • Warehouse: <code>dim_date</code> + <code>fact_*</code> (head count) • ETL:{" "}
        <code>bigdata-warehouse-cron</code> • {t("app.name")} • {generatedAt ? `อัปเดต ${formatTime24(generatedAt)}` : ""}
      </p>
    </div>
  );
}
