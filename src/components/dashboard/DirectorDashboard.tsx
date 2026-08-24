import React, { lazy, Suspense } from "react";
import { bkkDateISO, todayBangkok } from "@/lib/dateBE";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toBE } from "@/lib/utils";
import { useWeatherData } from "@/hooks/useWeatherData";
import {
  Users, GraduationCap, UserCheck, ClipboardList, Award,
  TrendingUp, FileText, Sparkles, Thermometer, Wind, Calendar, Bell,
  ArrowRight, ShieldCheck, BookOpenCheck, AlertTriangle, ChartBar, DollarSign, Activity, HeartPulse, TrendingDown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { motion } from "framer-motion";

const DynamicHeroBackground = lazy(() => import("./DynamicHeroBackground"));
const MascotHeroWidget = lazy(() => import("./widgets/MascotHeroWidget"));

const DirectorDashboard = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { userId } = useUserRole();
  const currentBE = toBE(new Date().getFullYear());
  const weather = useWeatherData();
  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const { data: profile } = useQuery({
    queryKey: ["director_profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, nickname")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
  });
  const displayName = profile
    ? profile.nickname || [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "";

  const { data: stats, isLoading } = useQuery({
    queryKey: ["director_dashboard_stats"],
    queryFn: async () => {
      const [
        students, personnel, classrooms, attendance,
        studentLeaves, staffLeaves, news, events,
        behavior, paAgreements, evaluations, documents,
      ] = await Promise.all([
        supabase.from("students").select("id, gender", { count: "exact" }).eq("status", "active"),
        supabase.from("personnel").select("id, position", { count: "exact" }).eq("status", "active"),
        supabase.from("classrooms").select("id, homeroom_teacher", { count: "exact" }),
        fetchAllRows((f, t) => supabase.from("attendance").select("status, attendance_date").gte("attendance_date", bkkDateISO(new Date(Date.now() - 30 * 86400000))).order("attendance_date").range(f, t)).then((data) => ({ data })),
        supabase.from("student_leaves").select("id, status"),
        supabase.from("staff_leaves").select("id, status"),
        supabase.from("news_posts").select("id, title, is_published").eq("is_published", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("academic_events").select("id, title, event_date").gte("event_date", todayBangkok()).order("event_date").limit(5),
        supabase.from("behavior_records").select("behavior_type"),
        supabase.from("pa_agreements").select("id, status"),
        supabase.from("staff_evaluations").select("id"),
        supabase.from("documents").select("id, status"),
      ]);

      const today = todayBangkok();
      const todayRows = attendance.data?.filter(a => a.attendance_date === today) || [];
      const totalAtt = todayRows.length;
      const present = todayRows.filter(a => a.status === "present").length;
      const absent = todayRows.filter(a => a.status === "absent").length;
      const late = todayRows.filter(a => a.status === "late").length;
      const rate = totalAtt > 0 ? (present / totalAtt) * 100 : 0;

      // 14-day attendance trend (context)
      const dayMap: Record<string, { p: number; t: number }> = {};
      attendance.data?.forEach(a => {
        const k = a.attendance_date;
        if (!k) return;
        if (!dayMap[k]) dayMap[k] = { p: 0, t: 0 };
        dayMap[k].t += 1;
        if (a.status === "present") dayMap[k].p += 1;
      });
      const trend = Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([d, v]) => ({
          name: new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" }),
          rate: v.t > 0 ? Number(((v.p / v.t) * 100).toFixed(1)) : 0,
        }));

      const male = students.data?.filter(s => ["ช", "ชาย", "male"].includes(s.gender || "")).length || 0;
      const female = (students.count || 0) - male;
      const positiveB = behavior.data?.filter(b => b.behavior_type === "positive").length || 0;
      const negativeB = behavior.data?.filter(b => b.behavior_type === "negative").length || 0;

      return {
        students: students.count || 0,
        male,
        female,
        personnel: personnel.count || 0,
        classrooms: classrooms.count || 0,
        classroomsWithTeacher: classrooms.data?.filter((c: any) => c.homeroom_teacher).length || 0,
        attendanceRate: rate.toFixed(1),
        attData: [
          { name: L("มาเรียน", "Present"), value: present, fill: "hsl(var(--success))" },
          { name: L("ขาดเรียน", "Absent"), value: absent, fill: "hsl(var(--destructive))" },
          { name: L("มาสาย", "Late"), value: late, fill: "hsl(var(--warning))" },
        ].filter(d => d.value > 0),
        trend,
        pendingStudentLeaves: studentLeaves.data?.filter(l => l.status === "pending").length || 0,
        pendingStaffLeaves: staffLeaves.data?.filter(l => l.status === "pending").length || 0,
        pendingDocs: documents.data?.filter((d: any) => d.status === "pending").length || 0,
        positiveB,
        negativeB,
        paTotal: paAgreements.data?.length || 0,
        paApproved: paAgreements.data?.filter(p => p.status === "approved" || p.status === "completed").length || 0,
        evalTotal: evaluations.data?.length || 0,
        recentNews: news.data || [],
        upcomingEvents: events.data || [],
      };
    },
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return L("สวัสดีตอนเช้า", "Good Morning");
    if (h < 17) return L("สวัสดีตอนบ่าย", "Good Afternoon");
    return L("สวัสดีตอนเย็น", "Good Evening");
  };

  const pendingTotal =
    (stats?.pendingStudentLeaves || 0) +
    (stats?.pendingStaffLeaves || 0) +
    (stats?.pendingDocs || 0);

  const capacity = stats?.classrooms
    ? Math.round((stats.students || 0) / stats.classrooms)
    : 0;
  const homeroomCoverage = stats?.classrooms
    ? Math.round(((stats.classroomsWithTeacher || 0) / stats.classrooms) * 100)
    : 0;

  // ── Extra KPIs: avg GPA, budget remaining, at-risk (simplified DigitalTwin) ──
  const { data: directorExtras, isLoading: extrasLoading } = useQuery({
    queryKey: ["director_extras"],
    queryFn: async () => {
      const [scores, budgetTx, remediation, warnings, sdq] = await Promise.all([
        supabase.from("student_scores").select("grade_point, total_score").not("grade_point", "is", null).limit(500),
        supabase.from("budget_transactions").select("transaction_type, amount").limit(500),
        (supabase as any).from("grade_remediation").select("id", { count: "exact", head: true }).neq("status", "ผ่าน").limit(1),
        ((supabase as any).from("early_warnings").select("id", { count: "exact", head: true }).limit(1) as any).then((r: any) => r).catch(() => ({ count: 0 } as any)),
        (supabase.from("sdq_records").select("id", { count: "exact", head: true }).limit(1) as any).then((r: any) => r).catch(() => ({ count: 0 } as any)),
      ]);
      const pts = (scores.data || []).map((s: any) => Number(s.grade_point)).filter((n: number) => !isNaN(n) && n > 0);
      const avgGpa = pts.length ? (pts.reduce((a: number, b: number) => a + b, 0) / pts.length).toFixed(2) : "—";
      const totalIncome = (budgetTx.data || []).filter((t: any) => t.transaction_type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalExpense = (budgetTx.data || []).filter((t: any) => t.transaction_type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const remaining = totalIncome - totalExpense;
      const atRisk = (remediation as any)?.count || 0;
      const warningsCount = (warnings as any)?.count || 0;
      const sdqCount = (sdq as any)?.count || 0;
      // sparkline: gpa trend last 6 months simulated from scores total_score average per month
      const sparkGpa = pts.length ? pts.slice(0, 7).map((v: number) => ({ v })) : [];
      const sparkBudget = [
        { v: totalIncome / 1000 },
        { v: (totalIncome - totalExpense * 0.3) / 1000 },
        { v: (totalIncome - totalExpense * 0.6) / 1000 },
        { v: remaining / 1000 },
      ];
      return { avgGpa, avgNum: pts.length ? Number(avgGpa) : 0, remaining, atRisk, warningsCount, sdqCount, sparkGpa, sparkBudget, totalIncome, totalExpense };
    },
    staleTime: 5 * 60_000,
  });

  const formatMoneyShort = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString("th-TH");
  };

  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <MascotHeroWidget />
      </Suspense>
      {/* Hero */}
      <div className="gradient-hero rounded-2xl p-6 text-primary-foreground relative overflow-hidden min-h-[180px]">
        <Suspense fallback={null}>
          <DynamicHeroBackground
            weatherCode={weather.weatherCode}
            isRainy={weather.isRainy}
            temperature={weather.temperature}
          />
        </Suspense>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/20" />
          <div className="absolute -left-4 -bottom-4 w-28 h-28 rounded-full bg-white/10" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80 tracking-wide uppercase">
                  {L("ผู้อำนวยการ", "Director")}
                </span>
              </div>
              <h1 className="text-2xl font-bold mb-1 truncate">
                {getGreeting()}{displayName ? `, ${displayName}` : ""}
              </h1>
              <p className="text-sm opacity-80">
                {L("ภาพรวมเชิงบริหาร · ปีการศึกษา", "Executive Overview · Academic Year")} {currentBE}
              </p>
            </div>

            {weather.hasCoords && !weather.isLoading && weather.temperature !== null && (
              <div className="hidden sm:flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 shrink-0">
                <Thermometer className="w-4 h-4" />
                <span className="text-lg font-bold tabular-nums">{weather.temperature?.toFixed(1)}°C</span>
                <div className="w-px h-8 bg-white/30" />
                <Wind className="w-4 h-4" />
                <span className="text-xs font-semibold tabular-nums">
                  PM2.5 {weather.pm25 !== null ? `${weather.pm25.toFixed(0)}` : "N/A"}
                </span>
              </div>
            )}
          </div>

          {/* Executive snapshot — 3 ตัวเลขสำคัญสุดเห็นทันที */}
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <SnapshotStat
              label={L("เข้าเรียนวันนี้", "Attendance today")}
              value={`${stats?.attendanceRate ?? "0"}%`}
            />
            <SnapshotStat
              label={L("ห้องมีครูประจำ", "Homeroom coverage")}
              value={`${homeroomCoverage}%`}
            />
            <SnapshotStat
              label={L("รออนุมัติทั้งหมด", "Pending approvals")}
              value={String(pendingTotal)}
              highlight={pendingTotal > 0}
            />
          </div>

          {pendingTotal > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(stats?.pendingStaffLeaves || 0) > 0 && (
                <button
                  onClick={() => navigate("/dashboard/hr/leave")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 transition text-xs font-medium backdrop-blur-sm"
                >
                  <ClipboardList className="w-3 h-3" /> {L("ลาบุคลากร", "Staff leaves")} {stats?.pendingStaffLeaves}
                </button>
              )}
              {(stats?.pendingStudentLeaves || 0) > 0 && (
                <button
                  onClick={() => navigate("/dashboard/student/leave")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 transition text-xs font-medium backdrop-blur-sm"
                >
                  <ClipboardList className="w-3 h-3" /> {L("ลานักเรียน", "Student leaves")} {stats?.pendingStudentLeaves}
                </button>
              )}
              {(stats?.pendingDocs || 0) > 0 && (
                <button
                  onClick={() => navigate("/dashboard/admin/document")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 transition text-xs font-medium backdrop-blur-sm"
                >
                  <FileText className="w-3 h-3" /> {L("เอกสารรอลงนาม", "Documents")} {stats?.pendingDocs}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Strategic KPIs — modern gradient cards with sparkline, stagger 0.1s, skeleton + empty states */}
      {(isLoading || extrasLoading) ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border border-border/40">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          className="grid grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
            <Card onClick={() => navigate("/dashboard/academic/all-students")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full gradient-primary opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-sm"><Users className="w-5 h-5 text-primary-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">{L("นักเรียนทั้งหมด", "Total Students")}</p>
                    <p className="text-xl font-bold tabular-nums">{stats?.students || 0}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{L(`ช ${stats?.male} · ญ ${stats?.female} · ~${capacity}/ห้อง`, `M ${stats?.male} · F ${stats?.female} · ~${capacity}/class`)}</p>
                  </div>
                </div>
                <div className="mt-2 h-[24px]"><ResponsiveContainer width="100%" height={24}><AreaChart data={stats?.trend?.slice(-7).map((d: any) => ({ v: d.rate })) || []}><Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="hsl(var(--primary) / 0.12)" /></AreaChart></ResponsiveContainer></div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
            <Card onClick={() => navigate("/dashboard/hr/personnel")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full gradient-accent opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shrink-0 shadow-sm"><GraduationCap className="w-5 h-5 text-primary-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">{L("บุคลากร", "Personnel")}</p>
                    <p className="text-xl font-bold tabular-nums">{stats?.personnel || 0}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{L(`${stats?.classroomsWithTeacher}/${stats?.classrooms} ห้องมีครูประจำ`, `${stats?.classroomsWithTeacher}/${stats?.classrooms} homerooms staffed`)}</p>
                  </div>
                </div>
                <div className="mt-2 h-[24px] flex items-center text-[10px] text-muted-foreground">{stats?.personnel ? `${L("ครอบคลุม", "Coverage")} ${homeroomCoverage}%` : L("ยังไม่มีข้อมูล", "No data")}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
            <Card onClick={() => navigate("/dashboard/student/face-scan?tab=report")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full gradient-success opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-success flex items-center justify-center shrink-0 shadow-sm"><UserCheck className="w-5 h-5 text-primary-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">{L("อัตราเข้าเรียนวันนี้", "Attendance today")}</p>
                    <p className="text-xl font-bold tabular-nums">{stats?.attendanceRate}%</p>
                    <Progress value={parseFloat(stats?.attendanceRate || "0")} className="h-1.5 mt-1" />
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{stats?.attData?.length ? stats.attData.map((d: any) => `${d.name} ${d.value}`).join(" · ") : L("ยังไม่มีเช็คชื่อ", "No check-in")}</p>
                  </div>
                </div>
                <div className="mt-2 h-[24px]"><ResponsiveContainer width="100%" height={24}><AreaChart data={stats?.trend?.slice(-7).map((d: any) => ({ v: d.rate })) || []}><Area type="monotone" dataKey="v" stroke="hsl(var(--success))" strokeWidth={1.5} fill="hsl(var(--success) / 0.18)" /></AreaChart></ResponsiveContainer></div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
            <Card onClick={() => navigate("/dashboard/academic/transcript")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full gradient-primary opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-sm"><Award className="w-5 h-5 text-primary-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">{L("เกรดเฉลี่ยรวม (GPA)", "Avg GPA")}</p>
                    <p className="text-xl font-bold tabular-nums">{directorExtras?.avgGpa || "—"}</p>
                    <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">{directorExtras?.avgNum >= 3 ? <><TrendingUp className="w-3 h-3 text-success" /> {L("ดี", "Good")}</> : directorExtras?.avgNum >= 2 ? <><Activity className="w-3 h-3 text-amber-500" /> {L("ปานกลาง", "Average")}</> : directorExtras?.avgGpa === "—" ? L("ยังไม่มีคะแนน", "No grades") : <><TrendingDown className="w-3 h-3 text-destructive" /> {L("ต้องพัฒนา", "Needs focus")}</>}</p>
                  </div>
                </div>
                <div className="mt-2 h-[24px]">{directorExtras?.sparkGpa?.length ? <ResponsiveContainer width="100%" height={24}><AreaChart data={directorExtras.sparkGpa}><Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="hsl(var(--primary) / 0.12)" /></AreaChart></ResponsiveContainer> : <div className="text-[10px] text-muted-foreground/60">{L("— ไม่มีข้อมูล —", "— no data —")}</div>}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
            <Card onClick={() => navigate("/dashboard/finance/budget")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
              <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity ${(directorExtras?.remaining ?? 0) < 0 ? "bg-destructive" : "gradient-success"}`} />
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${(directorExtras?.remaining ?? 0) < 0 ? "bg-destructive" : "gradient-success"}`}><DollarSign className="w-5 h-5 text-primary-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">{L("งบคงเหลือ", "Budget Remaining")}</p>
                    <p className={`text-xl font-bold tabular-nums ${(directorExtras?.remaining ?? 0) < 0 ? "text-destructive" : "text-foreground"}`}>฿{formatMoneyShort(directorExtras?.remaining ?? 0)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{L(`รับ ${formatMoneyShort(directorExtras?.totalIncome || 0)} · จ่าย ${formatMoneyShort(directorExtras?.totalExpense || 0)}`, `In ${formatMoneyShort(directorExtras?.totalIncome || 0)} · Out ${formatMoneyShort(directorExtras?.totalExpense || 0)}`)}</p>
                  </div>
                </div>
                <div className="mt-2 h-[24px]"><ResponsiveContainer width="100%" height={24}><AreaChart data={directorExtras?.sparkBudget || []}><Area type="monotone" dataKey="v" stroke={(directorExtras?.remaining ?? 0) < 0 ? "hsl(var(--destructive))" : "hsl(var(--success))"} strokeWidth={1.5} fill={(directorExtras?.remaining ?? 0) < 0 ? "hsl(var(--destructive) / 0.12)" : "hsl(var(--success) / 0.12)"} /></AreaChart></ResponsiveContainer></div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
            <Card onClick={() => navigate("/dashboard/admin/early-warning")} className={`relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 h-full ${(directorExtras?.atRisk || 0) > 0 ? "ring-destructive/30" : "ring-border/40"}`}>
              <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity ${(directorExtras?.atRisk || 0) > 0 ? "bg-destructive" : "gradient-warning"}`} />
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${(directorExtras?.atRisk || 0) > 0 ? "bg-destructive" : "gradient-warning"}`}><HeartPulse className="w-5 h-5 text-primary-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">{L("นักเรียนกลุ่มเสี่ยง / ติด 0 ร มส", "At-risk / 0/R/MS")}</p>
                    <p className="text-xl font-bold tabular-nums">{directorExtras?.atRisk ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{L(`SDQ ${directorExtras?.sdqCount ?? 0} · Early warnings ${directorExtras?.warningsCount ?? 0}`, `SDQ ${directorExtras?.sdqCount ?? 0} · Warnings ${directorExtras?.warningsCount ?? 0}`)}</p>
                  </div>
                </div>
                <div className="mt-2">
                  {(directorExtras?.atRisk || 0) === 0 ? (
                    <div className="h-[24px] flex items-center justify-center rounded-lg bg-success/10 text-[10px] text-success font-medium">✓ {L("ไม่มีกลุ่มเสี่ยง", "No at-risk")}</div>
                  ) : (
                    <div className="h-[24px] flex items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20 text-[10px] font-semibold text-destructive">{L(`ต้องติดตาม ${directorExtras?.atRisk} คน`, `${directorExtras?.atRisk} need follow-up`)}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}


      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card onClick={() => navigate("/dashboard/student/face-scan?tab=report")} className="border border-border/50 shadow-elevated rounded-2xl lg:col-span-2 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-success flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              {L("แนวโน้มอัตราเข้าเรียน 14 วัน", "Attendance Rate Trend (14 days)")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px]" />
            ) : stats?.trend && stats.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.trend}>
                  <defs>
                    <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                  <Area type="monotone" dataKey="rate" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#rateGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-16">{L("ยังไม่มีข้อมูล", "No data yet")}</p>
            )}
          </CardContent>
        </Card>

        <Card onClick={() => navigate("/dashboard/student/face-scan?tab=report")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                <ChartBar className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              {L("สัดส่วนการเข้าเรียนวันนี้", "Today's Attendance Mix")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px]" />
            ) : stats?.attData && stats.attData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={stats.attData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {stats.attData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-3 mt-1 flex-wrap">
                  {stats.attData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-muted-foreground">{d.name} <span className="font-semibold text-foreground">({d.value})</span></span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-16">{L("ยังไม่มีข้อมูล", "No data yet")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quality & approvals + News/Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card onClick={() => navigate("/dashboard/hub/student-health")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-accent flex items-center justify-center">
                <BookOpenCheck className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              {L("คุณภาพและการดูแลนักเรียน", "Quality & Student Care")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <StatRow
              icon={UserCheck}
              label={L("ห้องเรียนที่มีครูประจำชั้น", "Classrooms with Homeroom")}
              value={`${stats?.classroomsWithTeacher || 0}/${stats?.classrooms || 0}`}
            />
            <StatRow
              icon={Sparkles}
              label={L("พฤติกรรมเชิงบวก", "Positive Behavior")}
              value={stats?.positiveB || 0}
              color="text-success"
            />
            <StatRow
              icon={AlertTriangle}
              label={L("พฤติกรรมเชิงลบ", "Negative Behavior")}
              value={stats?.negativeB || 0}
              color={stats?.negativeB ? "text-destructive" : undefined}
            />
            <StatRow
              icon={Award}
              label={L("ผลการประเมินบุคลากร", "Personnel Evaluations")}
              value={stats?.evalTotal || 0}
            />
            <StatRow
              icon={FileText}
              label={L("เอกสารรอลงนาม", "Documents pending")}
              value={stats?.pendingDocs || 0}
              color={stats?.pendingDocs ? "text-warning" : undefined}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card onClick={() => navigate("/dashboard/admin/news")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">{L("ข่าวสารล่าสุด", "Latest News")}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-20" />
              ) : stats?.recentNews?.length ? (
                <div className="space-y-0.5">
                  {stats.recentNews.slice(0, 4).map((n: any) => (
                    <div key={n.id} className="flex items-center gap-2 py-1">
                      <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      <span className="text-[11px] text-foreground truncate leading-tight">{n.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-[11px] text-center py-6">{L("ยังไม่มีข่าวสาร", "No news yet")}</p>
              )}
            </CardContent>
          </Card>

          <Card onClick={() => navigate("/dashboard/academic/calendar")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg gradient-warning flex items-center justify-center">
                  <Calendar className="w-3 h-3 text-primary-foreground" />
                </div>
                <span className="text-xs font-semibold text-foreground">{L("กิจกรรมที่กำลังจะมาถึง", "Upcoming Events")}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-20" />
              ) : stats?.upcomingEvents?.length ? (
                <div className="space-y-1">
                  {stats.upcomingEvents.slice(0, 4).map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 py-1">
                      <div className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {new Date(e.event_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" })}
                      </div>
                      <span className="text-[11px] text-foreground truncate">{e.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-[11px] text-center py-6">{L("ไม่มีกิจกรรม", "No events")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Director shortcuts */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">{L("ทางลัดผู้บริหาร", "Director Shortcuts")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: L("อนุมัติลา", "Approve Leaves"), icon: ClipboardList, gradient: "gradient-primary", link: "/dashboard/hr/leave" },
            { name: L("ประเมินบุคลากร", "Evaluations"), icon: Award, gradient: "gradient-accent", link: "/dashboard/hr/evaluation" },
            { name: L("เอกสารราชการ", "Official Documents"), icon: FileText, gradient: "gradient-warning", link: "/dashboard/admin/document" },
            { name: L("รายงานสรุป", "Reports"), icon: TrendingUp, gradient: "gradient-success", link: "/dashboard/admin/analytics" },
          ].map(item => (
            <Card
              key={item.name}
              className="border border-border/50 shadow-elevated rounded-2xl hover:shadow-card-hover transition-all hover:-translate-y-0.5 cursor-pointer overflow-hidden group"
              onClick={() => navigate(item.link)}
            >
              <div className={`h-1 ${item.gradient}`} />
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${item.gradient} flex items-center justify-center shrink-0`}>
                  <item.icon className="w-4 h-4 text-primary-foreground" />
                </div>
                <p className="text-xs font-semibold text-foreground">{item.name}</p>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

interface KpiCardProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  onClick?: () => void;
  progress?: number;
}

const KpiCard = ({ icon: Icon, label, value, sub, gradient, onClick, progress }: KpiCardProps) => (
  <Card
    className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all group overflow-hidden"
    onClick={onClick}
  >
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-xl font-bold text-foreground leading-tight mt-0.5 tabular-nums truncate">{value}</p>
          {progress !== undefined && <Progress value={progress} className="h-1.5 mt-2" />}
          {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const StatRow = ({ icon: Icon, label, value, color }: { icon: React.ComponentType<any>; label: string; value: number | string; color?: string }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color || "text-muted-foreground"}`} />
      <span className="text-xs text-foreground">{label}</span>
    </div>
    <span className={`text-sm font-bold ${color || "text-foreground"}`}>{value}</span>
  </div>
);

const SnapshotStat = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-xl px-3 py-2 backdrop-blur-sm min-w-0 ${highlight ? "bg-white/25 ring-1 ring-white/40" : "bg-white/10"}`}>
    <p className="text-[10px] uppercase tracking-wide opacity-75 truncate">{label}</p>
    <p className="text-lg sm:text-xl font-bold tabular-nums truncate leading-tight">{value}</p>
  </div>
);


export default DirectorDashboard;
