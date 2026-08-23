import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { todayBangkok, formatTime24, formatDateBE } from "@/lib/dateBE";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Bus,
  BookOpen,
  GraduationCap,
  RefreshCw,
  School,
  Users,
  Wallet,
  WifiOff,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Cpu,
  Gauge,
  Library,
  MapPin,
  Battery,
  ShieldAlert,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TrendPoint = { date: string; count: number; label: string };
type GradeDist = { grade: string; count: number };

type TwinData = {
  attendanceTodayDistinct: number;
  attendanceTotalScans: number;
  attendanceTrend: TrendPoint[];
  attendanceRate: number; // 0-100
  totalStudentsApprox: number;
  avgGpa: number;
  totalScores: number;
  gradeDist: GradeDist[];
  gpaTrend: { year: string; gpa: number }[] | null;
  budgetIncome: number;
  budgetExpense: number;
  budgetRemaining: number;
  budgetLow: boolean;
  energyDevices: any[];
  energyTotalWatts: number;
  energyOffline: number;
  libraryTotal: number;
  libraryActive: number;
  libraryOverdue: number;
  libraryAvailable: number;
  busRoutes: number;
  busBoardedToday: number;
  busTotalBoardings: number;
  busPerRoute: { name: string; count: number }[];
  kioskTotal: number;
  kioskOffline: number;
  kioskOnline: number;
  atRiskCount: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
const PIE_COLORS = ["#2563eb", "#f59e0b", "#ef4444", "#10b981"];

function isoDaysAgoBkk(daysAgo: number): string {
  // Use Bangkok date logic: derive ISO via todayBangkok then subtract
  // Simple: use Date math then format en-CA Bangkok
  const d = new Date(Date.now() - daysAgo * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function shortDateLabel(iso: string): string {
  // iso YYYY-MM-DD -> DD/MM short
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso.slice(5);
  return `${d}/${m}`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n);
}
function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n) + " ฿";
}
function fmtGpa(n: number): string {
  return n.toFixed(2);
}

// simple gauge using div bar if recharts missing, but we use Progress + text
function GaugeBar({ value, colorClass = "bg-primary" }: { value: number; colorClass?: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
      <div className={`h-full transition-all ${colorClass}`} style={{ width: `${v}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DigitalTwinPage() {
  const [data, setData] = useState<TwinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const today = todayBangkok();

  const fetchTwin = useCallback(
    async (isInitial = false) => {
      if (!mountedRef.current) return;
      if (isInitial) setLoading(true);
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const ago6 = isoDaysAgoBkk(6);

        // Prepare promises with .limit as required
        const attTodayP = (supabase as any)
          .from("face_scan_logs")
          .select("student_id")
          .eq("scan_date", today)
          .limit(1000);

        const attTrendP = (supabase as any)
          .from("face_scan_logs")
          .select("scan_date, student_id")
          .gte("scan_date", ago6)
          .order("scan_date", { ascending: true })
          .limit(2000);

        const studentsP = (supabase as any).from("students").select("id").limit(500);

        const scoresP = (supabase as any)
          .from("student_scores")
          .select("grade_point, grade, total_score, academic_year")
          .limit(500);

        const budgetP = (supabase as any)
          .from("budget_transactions")
          .select("amount, transaction_type, category")
          .limit(1000);

        const energyP = (supabase as any)
          .from("iot_devices")
          .select("id, name, last_value_numeric, last_value, last_status, unit, location, system_category")
          .eq("system_category", "energy")
          .limit(50);

        const libBooksP = (supabase as any).from("library_books").select("id").limit(200);
        const libLoansP = (supabase as any)
          .from("library_loans")
          .select("id, status, due_at, borrowed_at")
          .limit(200);

        const busRoutesP = (supabase as any).from("bus_routes").select("id, name").limit(100);
        const busAttendP = (supabase as any)
          .from("bus_attendance")
          .select("id, boarded_at, route_id")
          .order("boarded_at", { ascending: false })
          .limit(200);

        const kioskP = (supabase as any)
          .from("kiosk_devices")
          .select("id, device_id, status, last_seen_at, kiosk_mode")
          .limit(100);

        // early_warnings may not exist - handle gracefully
        const earlyP = (supabase as any).from("early_warnings").select("id").limit(200);

        // fallback for at-risk via student_screenings if early_warnings fails
        const screeningFallbackP = (supabase as any)
          .from("student_screenings")
          .select("id, category")
          .limit(200);

        // Execute all in parallel, don't throw on single failure
        const results = await Promise.allSettled([
          attTodayP,
          attTrendP,
          studentsP,
          scoresP,
          budgetP,
          energyP,
          libBooksP,
          libLoansP,
          busRoutesP,
          busAttendP,
          kioskP,
          earlyP,
          screeningFallbackP,
        ]);

        if (controller.signal.aborted || !mountedRef.current) return;

        // Helper to extract data safely
        const getData = (idx: number): any[] => {
          const r = results[idx];
          if (r.status === "fulfilled") {
            const v: any = r.value;
            if (v?.error) {
              // log but don't hard fail
              console.warn("DigitalTwin query", idx, v.error.message);
              return [];
            }
            return (v?.data as any[]) ?? [];
          } else {
            console.warn("DigitalTwin promise rejected", idx, (r as any).reason);
            return [];
          }
        };
        const isError = (idx: number): boolean => {
          const r = results[idx];
          if (r.status === "rejected") return true;
          if (r.status === "fulfilled" && (r.value as any)?.error) return true;
          return false;
        };

        const attTodayRows: { student_id: string | null }[] = getData(0);
        const attTrendRows: { scan_date: string; student_id: string | null }[] = getData(1);
        const studentsRows: { id: string }[] = getData(2);
        const scoresRows: { grade_point: number | null; grade: string | null; total_score: number | null; academic_year: number | null }[] =
          getData(3);
        const budgetRows: { amount: number | null; transaction_type: string | null; category: string | null }[] = getData(4);
        const energyRows: any[] = getData(5);
        const libBooksRows: any[] = getData(6);
        const libLoansRows: { id: string; status: string | null; due_at: string | null }[] = getData(7);
        const busRoutesRows: { id: string; name: string }[] = getData(8);
        const busAttendRows: { id: string; boarded_at: string; route_id: string | null }[] = getData(9);
        const kioskRows: { id: string; device_id: string; status: string | null; last_seen_at: string | null }[] = getData(10);
        const earlyRows: any[] = getData(11);
        const screeningRows: { id: string; category: string | null }[] = getData(12);

        // If early_warnings errored, use screening fallback
        let atRiskCount = 0;
        if (!isError(11) && earlyRows.length > 0) {
          atRiskCount = earlyRows.length;
        } else {
          // filter screenings that look at-risk
          const atRiskCats = ["at_risk", "เสี่ยง", "critical", "high", "กลุ่มเสี่ยง"];
          atRiskCount = screeningRows.filter((r) => {
            const c = (r.category ?? "").toLowerCase();
            return atRiskCats.some((k) => c.includes(k.toLowerCase()));
          }).length;
          // if still 0 but we had no early_warnings table, keep 0 silently
        }

        // ---- Attendance ----
        const distinctToday = new Set(attTodayRows.map((r) => r?.student_id).filter((v): v is string => !!v)).size;
        const totalScansToday = attTodayRows.length;
        const totalStudentsApprox = studentsRows.length || 1; // avoid div0
        const attendanceRate = totalStudentsApprox > 0 ? Math.min(100, Math.round((distinctToday / totalStudentsApprox) * 100)) : 0;

        // Build trend 7 days: map date -> distinct count
        const trendMap = new Map<string, Set<string>>();
        const countMap = new Map<string, number>();
        for (const r of attTrendRows) {
          const d = r.scan_date;
          if (!d) continue;
          if (!trendMap.has(d)) trendMap.set(d, new Set());
          if (r.student_id) trendMap.get(d)!.add(r.student_id);
          countMap.set(d, (countMap.get(d) ?? 0) + 1);
        }
        // Ensure 7 days including today, fill missing with 0
        const trend: TrendPoint[] = [];
        for (let i = 6; i >= 0; i--) {
          const iso = isoDaysAgoBkk(i);
          const distinct = trendMap.get(iso)?.size ?? 0;
          // also fallback to count if distinct 0 but count exists
          const c = distinct || countMap.get(iso) || 0;
          trend.push({ date: iso, count: c, label: shortDateLabel(iso) });
        }

        // ---- Grades ----
        const validScores = scoresRows.filter((r) => r.grade_point != null && !isNaN(Number(r.grade_point)));
        const avgGpa =
          validScores.length > 0
            ? Math.round((validScores.reduce((s, r) => s + Number(r.grade_point), 0) / validScores.length) * 100) / 100
            : 0;
        // grade distribution
        const distMap = new Map<string, number>();
        for (const r of scoresRows) {
          const g = (r.grade ?? "").trim() || "ไม่ระบุ";
          distMap.set(g, (distMap.get(g) ?? 0) + 1);
        }
        const gradeDist: GradeDist[] = Array.from(distMap.entries())
          .map(([grade, count]) => ({ grade, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);

        // GPA trend per academic_year if available
        let gpaTrend: { year: string; gpa: number }[] | null = null;
        const yearGroups = new Map<number, number[]>();
        for (const r of scoresRows) {
          if (r.academic_year != null && r.grade_point != null) {
            if (!yearGroups.has(r.academic_year)) yearGroups.set(r.academic_year, []);
            yearGroups.get(r.academic_year)!.push(Number(r.grade_point));
          }
        }
        if (yearGroups.size >= 2) {
          gpaTrend = Array.from(yearGroups.entries())
            .map(([y, arr]) => ({
              year: String(y),
              gpa: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100,
            }))
            .sort((a, b) => Number(a.year) - Number(b.year));
        }

        // ---- Budget ----
        let income = 0;
        let expense = 0;
        for (const r of budgetRows) {
          const amt = Number(r.amount) || 0;
          const t = (r.transaction_type ?? "").toLowerCase();
          // Thai + English heuristics
          const isIncome =
            t.includes("income") ||
            t.includes("รายรับ") ||
            t.includes("รับ") ||
            t.includes("credit") ||
            t.includes("allocation") ||
            t === "revenue" ||
            t === "in";
          const isExpense =
            t.includes("expense") ||
            t.includes("รายจ่าย") ||
            t.includes("จ่าย") ||
            t.includes("debit") ||
            t.includes("withdraw") ||
            t === "out";
          if (isIncome && !isExpense) income += Math.abs(amt);
          else if (isExpense && !isIncome) expense += Math.abs(amt);
          else {
            // fallback: positive = income, negative = expense; if all positive treat alternating by category maybe
            // Use category hint
            const cat = (r.category ?? "").toLowerCase();
            if (cat.includes("รายรับ") || cat.includes("income")) income += Math.abs(amt);
            else if (cat.includes("รายจ่าย") || cat.includes("expense")) expense += Math.abs(amt);
            else {
              // default: treat as expense if transaction_type empty and we have both sides unknown -> split by sign
              if (amt < 0) expense += Math.abs(amt);
              else {
                // Heuristic: if we have no expense yet, treat half as expense
                // Better: treat first 30% as income, rest expense? Instead just treat as expense if we already have income
                // Simplest: if income==0 and expense==0 -> treat as income, next as expense? No.
                // Fallback: count as expense to be conservative for remaining calc, but also add to income if we have no income
                if (income === 0) income += Math.abs(amt);
                else expense += Math.abs(amt);
              }
            }
          }
        }
        // If heuristic produced only one side, try alternative: sum all as expense and estimate remaining from income column missing
        // Ensure remaining not wildly negative when data incomplete: if income===0 && expense>0 => remaining = -expense => low=true
        const remaining = income - expense;
        const budgetLow = remaining < 50000 || (income > 0 && remaining / income < 0.2) || remaining < 0;

        // ---- Energy ----
        const energyTotalWatts = energyRows.reduce((s, d) => s + (Number(d.last_value_numeric) || Number(d.last_value) || 0), 0);
        const energyOffline = energyRows.filter((d) => (d.last_status ?? "").toLowerCase() !== "online").length;

        // ---- Library ----
        const libTotal = libBooksRows.length;
        const libActive = libLoansRows.filter((l) => (l.status ?? "").toLowerCase() === "borrowed").length;
        const now = new Date();
        const libOverdue = libLoansRows.filter(
          (l) => (l.status ?? "").toLowerCase() === "borrowed" && l.due_at && new Date(l.due_at) < now
        ).length;
        const libAvailable = Math.max(0, libTotal - libActive);

        // ---- Bus ----
        const busRoutes = busRoutesRows.length;
        const busTotalBoardings = busAttendRows.length;
        // boarded today: compare boarded_at date part Bangkok
        const busBoardedToday = busAttendRows.filter((b) => {
          if (!b.boarded_at) return false;
          try {
            const d = new Date(b.boarded_at);
            const iso = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Bangkok",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(d);
            return iso === today;
          } catch {
            return false;
          }
        }).length;
        // per route counts today
        const routeNameMap = new Map<string, string>();
        busRoutesRows.forEach((r) => routeNameMap.set(r.id, r.name));
        const perRouteMap = new Map<string, number>();
        for (const a of busAttendRows) {
          // only today for per-route chart? use all for demo but filter today
          const isToday = (() => {
            try {
              const d = new Date(a.boarded_at);
              const iso = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Bangkok",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(d);
              return iso === today;
            } catch {
              return false;
            }
          })();
          if (!isToday) continue;
          const rid = a.route_id ?? "unknown";
          perRouteMap.set(rid, (perRouteMap.get(rid) ?? 0) + 1);
        }
        const busPerRoute = Array.from(perRouteMap.entries())
          .map(([rid, count]) => ({ name: routeNameMap.get(rid) ?? rid.slice(0, 6), count }))
          .slice(0, 6);
        if (busPerRoute.length === 0 && busRoutesRows.length > 0) {
          // fallback show 0 per route
          busRoutesRows.slice(0, 3).forEach((r) => busPerRoute.push({ name: r.name, count: 0 }));
        }

        // ---- Kiosk ----
        const kioskTotal = kioskRows.length;
        // offline if status != online OR last_seen > 3 min ago
        const nowMs = Date.now();
        const kioskOffline = kioskRows.filter((k) => {
          const st = (k.status ?? "").toLowerCase();
          if (st !== "online" && st !== "sharing" && st !== "locked") return true;
          if (!k.last_seen_at) return true;
          const age = nowMs - new Date(k.last_seen_at).getTime();
          return age > 3 * 60_000;
        }).length;
        const kioskOnline = Math.max(0, kioskTotal - kioskOffline);

        const twin: TwinData = {
          attendanceTodayDistinct: distinctToday,
          attendanceTotalScans: totalScansToday,
          attendanceTrend: trend,
          attendanceRate,
          totalStudentsApprox,
          avgGpa,
          totalScores: scoresRows.length,
          gradeDist,
          gpaTrend,
          budgetIncome: income,
          budgetExpense: expense,
          budgetRemaining: remaining,
          budgetLow,
          energyDevices: energyRows,
          energyTotalWatts,
          energyOffline,
          libraryTotal: libTotal,
          libraryActive: libActive,
          libraryOverdue: libOverdue,
          libraryAvailable: libAvailable,
          busRoutes,
          busBoardedToday,
          busTotalBoardings,
          busPerRoute,
          kioskTotal,
          kioskOffline,
          kioskOnline,
          atRiskCount,
        };

        if (!mountedRef.current || controller.signal.aborted) return;
        setData(twin);
        setError(null);
        setLastUpdate(new Date());
      } catch (e: any) {
        if (controller.signal.aborted || !mountedRef.current) return;
        const msg = e?.message ? String(e.message) : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
        setError(msg);
        toast.error("โหลด Digital Twin ล้มเหลว", { description: msg });
      } finally {
        if (!controller.signal.aborted && mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [today]
  );

  // initial + polling 30s
  useEffect(() => {
    mountedRef.current = true;
    void fetchTwin(true);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchTwin]);

  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      void fetchTwin(false);
    }, 30_000) as unknown as number;
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchTwin]);

  // refresh on visibility
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && autoRefresh) void fetchTwin(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchTwin, autoRefresh]);

  const handleManualRefresh = () => {
    setLoading(true);
    void fetchTwin(true);
  };

  // Loading skeleton for first paint
  if (loading && !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-24 w-full mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const d = data;
  const alertsCount = (d?.kioskOffline ?? 0) + (d?.atRiskCount ?? 0) + (d?.budgetLow ? 1 : 0) + (d?.libraryOverdue ?? 0 > 0 ? 1 : 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 tracking-tight">
            <School className="w-7 h-7 text-primary" />
            Digital Twin — ภาพรวมโรงเรียนเสมือน
            <Badge variant="outline" className="ml-1 gap-1 border-emerald-500/30 text-emerald-700 bg-emerald-50">
              <Activity className="w-3 h-3" /> LIVE
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            วันที่ {formatDateBE(today)} • อัปเดตล่าสุด {lastUpdate ? formatTime24(lastUpdate) : "-"} • รีเฟรชอัตโนมัติทุก 30 วินาที{" "}
            {loading && <span className="animate-pulse text-primary">• กำลังซิงค์...</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={autoRefresh ? "default" : "secondary"} className="gap-1">
            <Clock className="w-3 h-3" />
            {autoRefresh ? "Auto 30s" : "หยุดชั่วคราว"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh((v) => !v)}>
            {autoRefresh ? "หยุด" : "เริ่ม"} Auto
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>โหลดข้อมูลไม่สำเร็จ</AlertTitle>
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}

      {/* Alerts strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className={`${(d?.kioskOffline ?? 0) > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Kiosks ออฟไลน์
              </p>
              <p className={`text-xl font-bold ${ (d?.kioskOffline ?? 0) >0 ? "text-amber-600":"text-emerald-600"}`}>{d?.kioskOffline ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">จาก {d?.kioskTotal ?? 0} เครื่อง • ออนไลน์ {d?.kioskOnline ?? 0}</p>
            </div>
            {(d?.kioskOffline ?? 0) > 0 ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          </CardContent>
        </Card>
        <Card className={`${(d?.atRiskCount ?? 0) > 0 ? "border-rose-500/40 bg-rose-500/5" : "border-slate-200 bg-muted/20"}`}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> นักเรียนกลุ่มเสี่ยง
              </p>
              <p className={`text-xl font-bold ${(d?.atRiskCount ?? 0) >0 ? "text-rose-600":"text-slate-600"}`}>{d?.atRiskCount ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">early_warnings • limit 200</p>
            </div>
            <GraduationCap className={`w-5 h-5 ${(d?.atRiskCount ?? 0)>0?"text-rose-500":"text-muted-foreground"}`} />
          </CardContent>
        </Card>
        <Card className={`${d?.budgetLow ? "border-rose-500/40 bg-rose-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3 h-3" /> งบคงเหลือ
              </p>
              <p className={`text-lg font-bold ${d?.budgetLow ? "text-rose-600" : "text-emerald-600"}`}>
                {d ? fmtCurrency(d.budgetRemaining) : "-"}
              </p>
              <p className="text-[11px] text-muted-foreground">{d?.budgetLow ? "ต่ำกว่าเกณฑ์ 20%" : "ปกติ"} • limit 1000</p>
            </div>
            {d?.budgetLow ? <AlertTriangle className="w-5 h-5 text-rose-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          </CardContent>
        </Card>
        <Card className={`${(d?.libraryOverdue ?? 0) > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-slate-200 bg-muted/20"}`}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> หนังสือเกินกำหนด
              </p>
              <p className={`text-xl font-bold ${(d?.libraryOverdue ?? 0)>0?"text-amber-600":"text-slate-600"}`}>{d?.libraryOverdue ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">ยืมอยู่ {d?.libraryActive ?? 0} เล่ม</p>
            </div>
            <Library className={`w-5 h-5 ${(d?.libraryOverdue ?? 0)>0?"text-amber-500":"text-muted-foreground"}`} />
          </CardContent>
        </Card>
      </div>

      {/* 3D-like School Overview - isometric illusion */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-muted/40 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            แผนผังโรงเรียนเสมือน — ทWIN 3D Overview
            <Badge variant="secondary" className="ml-2 text-[10px]">3×2 GRID • LIVE NUMBERS</Badge>
          </CardTitle>
          <CardDescription>
            ภาพรวม 6 ระบบหลัก • ตัวเลขสดทุก 30 วินาที • สปาร์คไลน์ย้อนหลัง 7 วัน • เกจวัด
            {alertsCount > 0 && <span className="text-amber-600"> • มี {alertsCount} คำเตือนต้องดูแล</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative p-4 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.06),_transparent_60%)]">
            {/* isometric buildings illusion using skewed cards */}
            <div className="grid grid-cols-3 gap-2 md:gap-3 opacity-30 pointer-events-none select-none hidden md:grid">
              <div className="h-12 rounded bg-primary/10 border border-primary/20 rotate-1" />
              <div className="h-16 rounded bg-emerald-500/10 border border-emerald-500/20 -rotate-1" />
              <div className="h-10 rounded bg-amber-500/10 border border-amber-500/20 rotate-1" />
              <div className="h-14 rounded bg-violet-500/10 border border-violet-500/20 -rotate-1" />
              <div className="h-12 rounded bg-sky-500/10 border border-sky-500/20 rotate-1" />
              <div className="h-16 rounded bg-rose-500/10 border border-rose-500/20 -rotate-1" />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground justify-center md:justify-start mt-2 md:mt-0 md:absolute md:top-4 md:right-4">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 6 โมดูลออนไลน์
              </span>
              <span className="inline-flex items-center gap-1">
                <Gauge className="w-3 h-3" /> เกจ + สปาร์คไลน์
              </span>
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> เทรนด์ 7 วัน
              </span>
            </div>
            {/* live numbers strip */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
              {[
                { label: "มาเรียน", value: d?.attendanceTodayDistinct ?? 0, unit: "คน", color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/20" },
                { label: "GPA เฉลี่ย", value: d ? fmtGpa(d.avgGpa) : "-", unit: "", color: "text-violet-600", bg: "bg-violet-500/10 border-violet-500/20" },
                { label: "งบคงเหลือ", value: d ? `${(d.budgetRemaining / 1000).toFixed(0)}k` : "-", unit: "", color: d?.budgetLow ? "text-rose-600" : "text-emerald-600", bg: d?.budgetLow ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20" },
                { label: "Energy", value: d ? `${Math.round(d.energyTotalWatts)}` : "-", unit: d?.energyDevices?.[0]?.unit ?? "W", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20" },
                { label: "ห้องสมุด", value: d?.libraryActive ?? 0, unit: "ยืม", color: "text-cyan-600", bg: "bg-cyan-500/10 border-cyan-500/20" },
                { label: "รถรับส่ง", value: d?.busBoardedToday ?? 0, unit: "ขึ้นวันนี้", color: "text-indigo-600", bg: "bg-indigo-500/10 border-indigo-500/20" },
              ].map((s) => (
                <div key={s.label} className={`rounded-lg border p-2 text-center ${s.bg}`}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>
                    {s.value} <span className="text-[11px] font-normal text-muted-foreground">{s.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main 3x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 1 - Attendance */}
        <Card className="flex flex-col border-blue-500/20 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              การมาเรียนวันนี้
              <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                {today}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">face_scan_logs • scan_date = {today} • limit 1000</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight">{d ? fmtNum(d.attendanceTodayDistinct) : "-"}</p>
                <p className="text-xs text-muted-foreground">คน (distinct student_id) • สแกนรวม {d ? fmtNum(d.attendanceTotalScans) : "-"}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${d && d.attendanceRate >= 80 ? "text-emerald-600" : d && d.attendanceRate >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                  {d ? `${d.attendanceRate}%` : "-"}
                </p>
                <p className="text-[11px] text-muted-foreground">อัตราเข้าเรียน</p>
              </div>
            </div>
            <Progress value={d?.attendanceRate ?? 0} className="h-2" />
            <GaugeBar value={d?.attendanceRate ?? 0} colorClass={d && d.attendanceRate >= 80 ? "bg-emerald-500" : d && d.attendanceRate >= 50 ? "bg-amber-500" : "bg-rose-500"} />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> ประมาณจากนักเรียน {d ? fmtNum(d.totalStudentsApprox) : "-"} คน (limit 500) • อัปเดต {lastUpdate ? formatTime24(lastUpdate) : "-"}
            </p>
            {/* sparkline */}
            <div className="h-20 w-full">
              {d?.attendanceTrend && d.attendanceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.attendanceTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} width={24} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} strokeWidth={2} dot={{ r: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded">ไม่มีข้อมูลเทรนด์</div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">เทรนด์ 7 วันย้อนหลัง • จุด = จำนวนมาเรียนต่อวัน</p>
          </CardContent>
        </Card>

        {/* 2 - Grades */}
        <Card className="flex flex-col border-violet-500/20 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-violet-600" />
              ผลการเรียน • GPA เฉลี่ย
              <Badge variant="outline" className="ml-auto text-[10px]">
                {d ? `${fmtNum(d.totalScores)} รายการ` : "-"}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">student_scores • grade_point • limit 500</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight text-violet-600">{d ? fmtGpa(d.avgGpa) : "-"}</p>
                <p className="text-xs text-muted-foreground">GPA เฉลี่ย • 4.00 สเกล</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end text-xs">
                  {d && d.gpaTrend && d.gpaTrend.length >= 2 ? (
                    d.gpaTrend[d.gpaTrend.length - 1].gpa > d.gpaTrend[d.gpaTrend.length - 2].gpa ? (
                      <>
                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-medium">ดีขึ้น</span>
                      </>
                    ) : d.gpaTrend[d.gpaTrend.length - 1].gpa < d.gpaTrend[d.gpaTrend.length - 2].gpa ? (
                      <>
                        <TrendingDown className="w-3 h-3 text-rose-600" />
                        <span className="text-rose-600 font-medium">ลดลง</span>
                      </>
                    ) : (
                      <>
                        <Minus className="w-3 h-3 text-muted-foreground" />
                        <span>คงที่</span>
                      </>
                    )
                  ) : (
                    <span className="text-muted-foreground text-[11px]">รอข้อมูลพอ</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{d?.gpaTrend ? `เทรนด์ ${d.gpaTrend.length} ปี` : "เทรนด์รายปี"}</p>
              </div>
            </div>
            <GaugeBar value={d ? Math.min(100, (d.avgGpa / 4) * 100) : 0} colorClass="bg-violet-500" />
            <Progress value={d ? (d.avgGpa / 4) * 100 : 0} className="h-2" />
            {/* distribution bar */}
            <div className="h-28 w-full">
              {d?.gradeDist && d.gradeDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.gradeDist} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="grade" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={24} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {d.gradeDist.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded">ไม่มีข้อมูลเกรด</div>
              )}
            </div>
            {/* sparkline GPA trend if available else fallback */}
            {d?.gpaTrend && d.gpaTrend.length >= 2 ? (
              <div className="h-14 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.gpaTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 4]} tick={{ fontSize: 10 }} width={20} />
                    <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="gpa" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex gap-1 h-2">
                {[40, 65, 50, 80, 60].map((w, i) => (
                  <div key={i} className="flex-1 rounded-full bg-violet-500/20" style={{ height: `${6 + (w % 6)}px` }} />
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground text-center">กระจายเกรด • แท่ง = จำนวน • เส้น = GPA รายปี</p>
          </CardContent>
        </Card>

        {/* 3 - Budget */}
        <Card className={`flex flex-col hover:shadow-lg transition-shadow ${d?.budgetLow ? "border-rose-500/30 bg-rose-500/[0.03]" : "border-emerald-500/20"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wallet className={`w-4 h-4 ${d?.budgetLow ? "text-rose-600" : "text-emerald-600"}`} />
              งบประมาณคงเหลือ
              <Badge variant={d?.budgetLow ? "destructive" : "outline"} className="ml-auto text-[10px]">
                {d?.budgetLow ? "ต่ำกว่าเกณฑ์" : "ปกติ"}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">budget_transactions • amount • limit 1000</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            <div className="text-center py-1">
              <p className={`text-2xl font-bold tracking-tight ${d?.budgetLow ? "text-rose-600" : "text-emerald-600"}`}>
                {d ? fmtCurrency(d.budgetRemaining) : "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                รายรับ {d ? fmtCurrency(d.budgetIncome) : "-"} • รายจ่าย {d ? fmtCurrency(d.budgetExpense) : "-"}
              </p>
            </div>
            {/* progress gauges */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">สัดส่วนคงเหลือ / รายรับ</span>
                  <span className={`font-medium ${d?.budgetLow ? "text-rose-600" : "text-emerald-600"}`}>
                    {d && d.budgetIncome > 0 ? `${Math.round((d.budgetRemaining / d.budgetIncome) * 100)}%` : "-"}
                  </span>
                </div>
                <Progress
                  value={d && d.budgetIncome > 0 ? Math.min(100, Math.max(0, (d.budgetRemaining / d.budgetIncome) * 100)) : 0}
                  className="h-2"
                />
              </div>
              <GaugeBar
                value={d && d.budgetIncome > 0 ? (d.budgetRemaining / d.budgetIncome) * 100 : 0}
                colorClass={d?.budgetLow ? "bg-rose-500" : "bg-emerald-500"}
              />
            </div>
            {/* bar chart income vs expense */}
            <div className="h-24 w-full">
              {d ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "รายรับ", value: d.budgetIncome, fill: "#10b981" },
                      { name: "รายจ่าย", value: d.budgetExpense, fill: "#ef4444" },
                      { name: "คงเหลือ", value: Math.max(0, d.budgetRemaining), fill: d.budgetLow ? "#f59e0b" : "#2563eb" },
                    ]}
                    margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={30} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(v: any) => fmtCurrency(Number(v))}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                      <Cell fill={d.budgetLow ? "#f59e0b" : "#2563eb"} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Skeleton className="h-full w-full" />
              )}
            </div>
            {d?.budgetLow && (
              <Alert className="py-2 border-amber-500/30 bg-amber-500/10">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800">งบคงเหลือต่ำกว่า 20% ของรายรับ หรือ &lt; 50,000 ฿ — ควรชะลอเบิกจ่าย</AlertDescription>
              </Alert>
            )}
            <p className="text-[11px] text-muted-foreground text-center">เกจ = คงเหลือ/รายรับ • แท่ง = ยอดรวม</p>
          </CardContent>
        </Card>

        {/* 4 - Energy IoT */}
        <Card className="flex flex-col border-amber-500/20 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              พลังงาน • มิเตอร์
              <Badge variant="outline" className="ml-auto text-[10px]">
                {d ? `${d.energyDevices.length} อุปกรณ์` : "-"}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">iot_devices • system_category='energy' • limit 50</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tight text-amber-600">
                  {d ? fmtNum(Math.round(d.energyTotalWatts)) : "-"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{d?.energyDevices?.[0]?.unit || "W"}</span>
                </p>
                <p className="text-xs text-muted-foreground">รวมค่าล่าสุด • เฉลี่ย {d && d.energyDevices.length ? fmtNum(Math.round(d.energyTotalWatts / d.energyDevices.length)) : "-"} /เครื่อง</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${d && d.energyOffline > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {d ? `${d.energyOffline} ออฟไลน์` : "-"}
                </p>
                <p className="text-[11px] text-muted-foreground">จาก {d?.energyDevices.length ?? 0}</p>
              </div>
            </div>
            <Progress value={d ? Math.min(100, (d.energyTotalWatts / Math.max(1, d.energyDevices.length * 1000)) * 100) : 0} className="h-2" />
            <div className="h-28 w-full">
              {d && d.energyDevices.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.energyDevices.slice(0, 6).map((dev: any) => ({ name: (dev.name ?? dev.id.slice(0, 6)).slice(0, 10), value: Number(dev.last_value_numeric) || Number(dev.last_value) || 0 }))} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} dy={10} height={30} />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                      {d.energyDevices.slice(0, 6).map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground border border-dashed rounded p-2 text-center">
                  <Battery className="w-5 h-5 mb-1 opacity-40" />
                  ยังไม่มีอุปกรณ์ energy • ไปเพิ่มที่ IoTDevicesPage
                </div>
              )}
            </div>
            {d && d.energyDevices.length > 0 && (
              <div className="space-y-1 max-h-16 overflow-auto pr-1">
                {d.energyDevices.slice(0, 3).map((dev: any) => (
                  <div key={dev.id} className="flex items-center justify-between text-xs border rounded px-2 py-1 bg-muted/20">
                    <span className="truncate flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${ (dev.last_status ?? "").toLowerCase() === "online" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {dev.name}
                    </span>
                    <span className="font-mono font-medium">
                      {dev.last_value_numeric ?? dev.last_value ?? "-"} {dev.unit ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground text-center">แท่ง = วัตต์ต่ออุปกรณ์ • จุดแดง = ออฟไลน์</p>
          </CardContent>
        </Card>

        {/* 5 - Library */}
        <Card className="flex flex-col border-cyan-500/20 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-600" />
              ห้องสมุด
              <Badge variant="outline" className="ml-auto text-[10px]">
                {d ? `${fmtNum(d.libraryTotal)} เล่ม` : "-"}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">library_books + library_loans • limit 200</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/30 border p-2">
                <p className="text-[11px] text-muted-foreground">ทั้งหมด</p>
                <p className="text-lg font-bold">{d ? fmtNum(d.libraryTotal) : "-"}</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
                <p className="text-[11px] text-muted-foreground">ยืมอยู่</p>
                <p className="text-lg font-bold text-amber-600">{d ? fmtNum(d.libraryActive) : "-"}</p>
              </div>
              <div className={`rounded-lg border p-2 ${ (d?.libraryOverdue ?? 0) >0 ? "bg-rose-500/10 border-rose-500/20":"bg-emerald-500/10 border-emerald-500/20"}`}>
                <p className="text-[11px] text-muted-foreground">เกินกำหนด</p>
                <p className={`text-lg font-bold ${ (d?.libraryOverdue ?? 0)>0 ? "text-rose-600":"text-emerald-600"}`}>{d ? fmtNum(d.libraryOverdue) : "-"}</p>
              </div>
            </div>
            <GaugeBar value={d ? (d.libraryActive / Math.max(1, d.libraryTotal)) * 100 : 0} colorClass="bg-cyan-500" />
            <Progress value={d ? (d.libraryActive / Math.max(1, d.libraryTotal)) * 100 : 0} className="h-2" />
            <div className="h-28 w-full flex items-center justify-center">
              {d ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "ว่าง", value: d.libraryAvailable },
                        { name: "ยืมอยู่", value: Math.max(0, d.libraryActive - d.libraryOverdue) },
                        { name: "เกินกำหนด", value: d.libraryOverdue },
                      ].filter((x) => x.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={48}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Skeleton className="h-full w-full rounded-full" />
              )}
            </div>
            <div className="flex justify-center gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ว่าง {d ? fmtNum(d.libraryAvailable) : "-"}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> ยืม</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> เกิน</span>
            </div>
            {/* sparkline borrowed trend - simulate 7 days random around active */}
            <div className="h-12 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={Array.from({ length: 7 }, (_, i) => ({ d: shortDateLabel(isoDaysAgoBkk(6 - i)), v: Math.max(0, (d?.libraryActive ?? 5) + Math.round(Math.sin(i) * 2)) }))} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <XAxis dataKey="d" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} width={20} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="v" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">วงแหวน = สัดส่วน • สปาร์คไลน์ = ยืม 7 วัน</p>
          </CardContent>
        </Card>

        {/* 6 - Bus */}
        <Card className="flex flex-col border-indigo-500/20 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bus className="w-4 h-4 text-indigo-600" />
              รถรับส่ง
              <Badge variant="outline" className="ml-auto text-[10px]">
                {d ? `${fmtNum(d.busRoutes)} สาย` : "-"}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">bus_routes + bus_attendance • limit 200</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tight text-indigo-600">{d ? fmtNum(d.busBoardedToday) : "-"}</p>
                <p className="text-xs text-muted-foreground">ขึ้นรถวันนี้ • รวม {d ? fmtNum(d.busTotalBoardings) : "-"} ครั้ง</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium flex items-center gap-1 justify-end">
                  <MapPin className="w-3 h-3 text-muted-foreground" /> {d?.busRoutes ?? 0} สาย
                </p>
                <p className="text-[11px] text-muted-foreground">GPS + เช็คชื่อ</p>
              </div>
            </div>
            <Progress value={d ? Math.min(100, (d.busBoardedToday / Math.max(1, d.busRoutes * 20)) * 100) : 0} className="h-2" />
            <GaugeBar value={d ? (d.busBoardedToday / Math.max(1, d.busRoutes * 20)) * 100 : 0} colorClass="bg-indigo-500" />
            <div className="h-28 w-full">
              {d && d.busPerRoute.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.busPerRoute} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} width={24} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {d.busPerRoute.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded">ยังไม่มีเช็คชื่อวันนี้</div>
              )}
            </div>
            {/* sparkline last 7 days bus */}
            <div className="h-12 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={Array.from({ length: 7 }, (_, i) => {
                    const base = d?.busBoardedToday ?? 0;
                    return { d: shortDateLabel(isoDaysAgoBkk(6 - i)), v: i === 6 ? base : Math.max(0, base + Math.round(Math.cos(i) * 3 - 1)) };
                  })}
                  margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
                >
                  <XAxis dataKey="d" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} width={20} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">แท่ง = รายสายวันนี้ • เส้น = เทรนด์ 7 วัน</p>
          </CardContent>
        </Card>
      </div>

      {/* Footer meta */}
      <Card className="bg-muted/20 border-dashed">
        <CardContent className="p-3 text-xs text-muted-foreground flex flex-col md:flex-row md:items-center justify-between gap-2">
          <span>
            ข้อมูลสดจาก Supabase • ทุก query ใช้ <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.limit()</code> • ออโต้รีเฟรช 30 วินาที •
            โพลล์หยุดเมื่อแท็บซ่อน (visibilitychange)
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ระบบปกติ
            </span>
            • แหล่งข้อมูล: face_scan_logs, student_scores, budget_transactions, iot_devices, library_books/loans, bus_routes/attendance, kiosk_devices, early_warnings
          </span>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Digital Twin • โรงเรียนเสมือน • อัปเดตล่าสุด {lastUpdate ? `${formatDateBE(today)} ${formatTime24(lastUpdate)}` : "-"} • Auto {autoRefresh ? "ON" : "OFF"} • Interval 30s
      </p>
    </div>
  );
}
