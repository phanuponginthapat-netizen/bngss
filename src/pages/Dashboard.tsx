import React, { useEffect, lazy, Suspense } from "react";
import { todayBangkok } from "@/lib/dateBE";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, GraduationCap, BookOpen, TrendingUp, BarChart3, Activity,
  ClipboardList, Heart, Calendar, Bell, AlertTriangle, DollarSign,
  Package, FileText, Clock, CheckCircle2, XCircle, UserCheck,
  Briefcase, Shield, ArrowRight, School, Sparkles,
  Thermometer, Wind, CloudRain, Sun,
  Network, Trash2,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  useDroppable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toBE } from "@/lib/utils";
import { useWeatherData } from "@/hooks/useWeatherData";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { COLOR_THEMES, SIZE_CLASSES, type WidgetColor } from "@/lib/dashboardWidgets";
import WidgetCustomizer from "@/components/dashboard/WidgetCustomizer";

const TeacherDashboard = lazy(() => import("@/components/dashboard/TeacherDashboard"));
const StudentDashboard = lazy(() => import("@/components/dashboard/StudentDashboard"));
const AlumniDashboard = lazy(() => import("@/components/dashboard/AlumniDashboard"));
const DirectorDashboard = lazy(() => import("@/components/dashboard/DirectorDashboard"));
const IoTSummaryWidget = lazy(() => import("@/components/dashboard/IoTSummaryWidget"));
const SchoolRadarWidget = lazy(() => import("@/components/dashboard/SchoolRadarWidget"));
const DynamicHeroBackground = lazy(() => import("@/components/dashboard/DynamicHeroBackground"));
const SocialWallWidget = lazy(() => import("@/components/social/SocialWallWidget"));
const SuperAppShortcuts = lazy(() => import("@/components/dashboard/SuperAppShortcuts"));
const MascotHeroWidget = lazy(() => import("@/components/dashboard/widgets/MascotHeroWidget"));
const TodayActionWidget = lazy(() => import("@/components/dashboard/widgets/TodayActionWidget"));
const AIInsightsWidget = lazy(() => import("@/components/dashboard/widgets/AIInsightsWidget"));


const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))",
  "hsl(var(--success))", "hsl(var(--destructive))", "hsl(262 83% 58%)",
];

const Dashboard = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { role, userId } = useUserRole();
  const currentBE = toBE(new Date().getFullYear());
  const weather = useWeatherData();
  const { appName } = useSystemSettings();

  // Get user profile name
  const { data: userProfile } = useQuery({
    queryKey: ["dashboard_user_profile", userId],
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

  const displayName = userProfile
    ? (userProfile.first_name
        ? (userProfile.nickname ? `${userProfile.first_name} (${userProfile.nickname})` : userProfile.first_name)
        : (userProfile.nickname || ""))
    : "";

  // Global realtime is handled by DashboardLayout's useGlobalRealtime()

  // Heavy admin stats — only fetch when user is admin/super_admin.
  // Avoids running 17 count(*) queries for students/teachers/parents (200+ concurrent users).
  const isAdminRole = role === "admin";
  const { data: stats, isLoading } = useQuery({
    enabled: isAdminRole,
    queryKey: ["dashboard_stats_v2"],
    staleTime: 60_000,
    queryFn: async () => {
      // ✅ รวมเป็น 1 RPC call (เดิม 16+ queries) — ลดภาระ DB หลายเท่า
      const { data: s, error } = await supabase.rpc("get_admin_dashboard_stats");
      if (error || !s) throw error || new Error("no stats");
      const stats: any = s;

      // คำนวณสถานะวันนี้จาก face_scan + attendance (ทำฝั่ง client เพราะใช้ threshold/format)
      const lateThreshold: string = stats.late_threshold || "08:30";
      const statusByStudent = new Map<string, "present" | "late" | "absent">();
      const firstScan = new Map<string, Date>();
      (stats.today_face_scans || []).forEach((x: any) => {
        if (!x.student_id || !x.scan_time) return;
        const t = new Date(x.scan_time);
        const prev = firstScan.get(x.student_id);
        if (!prev || t < prev) firstScan.set(x.student_id, t);
      });
      const fmtHHMM = (d: Date) => new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(d);
      firstScan.forEach((t, sid) => {
        statusByStudent.set(sid, fmtHHMM(t) > lateThreshold ? "late" : "present");
      });
      // ใช้เฉพาะ face_scan_logs เป็นแหล่งข้อมูลเดียว (ให้ตรงกับ FaceReportTab)


      const presentCount = Array.from(statusByStudent.values()).filter(s => s === "present").length;
      const lateCount = Array.from(statusByStudent.values()).filter(s => s === "late").length;
      const explicitAbsent = Array.from(statusByStudent.values()).filter(s => s === "absent").length;
      const totalStudentsForAtt = stats.students_total || 0;
      const absentCount = Math.max(explicitAbsent, totalStudentsForAtt - presentCount - lateCount);
      const totalAtt = Math.max(totalStudentsForAtt, presentCount + lateCount + explicitAbsent);
      const attendanceRate = totalAtt > 0 ? ((presentCount / totalAtt) * 100) : 0;

      const attData = [
        { name: lang === "th" ? "มาเรียน" : "Present", value: presentCount, fill: "hsl(var(--success))" },
        { name: lang === "th" ? "ขาดเรียน" : "Absent", value: absentCount, fill: "hsl(var(--destructive))" },
        { name: lang === "th" ? "มาสาย" : "Late", value: lateCount, fill: "hsl(var(--warning))" },
      ].filter(d => d.value > 0);

      const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
      const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthNames = lang === "th" ? MONTHS_TH : MONTHS_EN;
      const budgetTrend = (stats.budget_trend || []).map((b: any) => ({
        name: monthNames[parseInt(b.month.split("-")[1]) - 1],
        income: Number(b.income) || 0,
        expense: Number(b.expense) || 0,
      }));

      return {
        students: stats.students_total || 0,
        activeStudents: stats.students_total || 0,
        maleStudents: stats.students_male || 0,
        femaleStudents: stats.students_female || 0,
        personnel: stats.personnel_total || 0,
        linkedPersonnel: stats.personnel_linked || 0,
        classrooms: stats.classrooms_total || 0,
        classroomsWithTeacher: stats.classrooms_with_teacher || 0,
        subjects: stats.subjects_total || 0,
        attendanceRate: attendanceRate.toFixed(1),
        scannedToday: firstScan.size,
        attData,
        deptData: stats.dept_data || [],
        gradeData: stats.grade_data || [],
        healthRecords: stats.health_records_total || 0,
        pendingStudentLeaves: stats.pending_student_leaves || 0,
        pendingStaffLeaves: stats.pending_staff_leaves || 0,
        totalIncome: Number(stats.income_total) || 0,
        totalExpense: Number(stats.expense_total) || 0,
        budgetTrend,
        pendingDamage: stats.pending_damage || 0,
        pendingDocs: stats.pending_docs || 0,
        totalAssetValue: Number(stats.total_asset_value) || 0,
        damagedAssets: stats.damaged_assets || 0,
        totalAssets: stats.total_assets || 0,
        positiveB: stats.positive_b || 0,
        negativeB: stats.negative_b || 0,
        sdqCount: stats.sdq_count || 0,
        enrollments: stats.enrollments_active || 0,
        homeroomRecords: stats.homeroom_records_total || 0,
        homeVisits: stats.home_visits_total || 0,
        totalDocuments: stats.total_documents || 0,
        recentNews: stats.recent_news || [],
        upcomingEvents: stats.upcoming_events || [],
      };
    },
    refetchInterval: 120_000,
  });


  const formatMoney = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString("th-TH");
  };

  const formatMoneyFull = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

  const L = (th: string, en: string) => lang === "th" ? th : en;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return L("สวัสดีตอนเช้า", "Good Morning");
    if (h < 17) return L("สวัสดีตอนบ่าย", "Good Afternoon");
    return L("สวัสดีตอนเย็น", "Good Evening");
  };

  const pendingTotal = (stats?.pendingStudentLeaves || 0) + (stats?.pendingStaffLeaves || 0) + (stats?.pendingDamage || 0);

  // Hooks ต้องอยู่ก่อน early returns ทั้งหมด (rules-of-hooks)
  const { widgets, isLoading: widgetsLoading, reorder, upsert } = useDashboardWidgets();
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  // เฉพาะ admin เท่านั้นที่ใช้ merged admin-style dashboard
  // role อื่นๆ (director/teacher/student/alumni/parent) กลับไปใช้ dashboard ตาม role เหมือนเดิม
  if (role === "director") {
    return <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}><DirectorDashboard /></Suspense>;
  }
  if (role === "teacher") {
    return <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}><TeacherDashboard /></Suspense>;
  }
  if (role === "student" || role === "parent") {
    return <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}><StudentDashboard /></Suspense>;
  }
  if (role === "alumni") {
    return <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}><AlumniDashboard /></Suspense>;
  }


  const todayBE = new Date().toLocaleDateString(lang === "th" ? "th-TH-u-ca-buddhist" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const eventsToday = (stats?.upcomingEvents || []).filter((e: any) => e.event_date === todayBangkok()).length;
  const balance = (stats?.totalIncome || 0) - (stats?.totalExpense || 0);
  const totalAtt = (stats?.attData || []).reduce((s: number, d: any) => s + d.value, 0);
  const presentN = (stats?.attData || []).find((d: any) => d.fill?.includes("success"))?.value || 0;
  const lateN = (stats?.attData || []).find((d: any) => d.fill?.includes("warning"))?.value || 0;
  const absentN = (stats?.attData || []).find((d: any) => d.fill?.includes("destructive"))?.value || 0;

  // (widgets/widgetsLoading ถูก destructure ไว้ด้านบนแล้ว)

  // ── Widget render map (admin dashboard) ──
  const widgetRenderers: Record<string, (color: WidgetColor) => React.ReactNode> = {
    hero: () => (
      <div className="gradient-hero rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-9 text-primary-foreground relative overflow-hidden min-h-[180px] sm:min-h-[220px] h-full shadow-elevated">
        <Suspense fallback={null}>
          <DynamicHeroBackground weatherCode={weather.weatherCode} isRainy={weather.isRainy} temperature={weather.temperature} />
        </Suspense>
        {/* Refined ambient glow — fewer, softer orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-16 -bottom-20 w-56 h-56 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col h-full min-w-0 gap-3">
          <div className="inline-flex items-center gap-2 self-start bg-white/12 backdrop-blur-md rounded-full pl-2.5 pr-3.5 py-1 ring-1 ring-white/15 max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_2px_rgba(110,231,183,0.6)]" />
            <span className="text-[10px] sm:text-[11px] font-semibold opacity-95 tracking-[0.12em] uppercase truncate">{appName} · {L("ภาพรวม", "Overview")}</span>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] sm:text-xs font-medium opacity-80 tracking-wide">{getGreeting()}</p>
            <h1 className="text-2xl sm:text-[2.25rem] font-bold tracking-tight leading-[1.15] drop-shadow-sm break-words">
              {displayName || L("ยินดีต้อนรับ", "Welcome back")}
            </h1>
            <p className="text-xs sm:text-sm opacity-85 font-medium break-words">
              {todayBE} · {L("ปีการศึกษา", "Academic Year")} {currentBE}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
            {weather.hasCoords && weather.temperature !== null && (
              <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/15">
                <Thermometer className="w-3.5 h-3.5" />{weather.temperature?.toFixed(1)}°C
              </span>
            )}
            {weather.pm25 !== null && (
              <span className={`inline-flex items-center gap-1.5 backdrop-blur-md rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/20 ${weather.pm25 > 75 ? "bg-danger/25" : weather.pm25 > 37.5 ? "bg-warning/25" : "bg-success/25"}`}>
                <Wind className="w-3.5 h-3.5" />PM2.5 {weather.pm25.toFixed(0)}
              </span>
            )}
            {weather.recommendations.slice(0, 2).map((rec, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md text-[11px] font-medium ring-1 ring-white/10">{rec}</span>
            ))}
          </div>
        </div>
      </div>
    ),

    mascot_hero: () => (
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <MascotHeroWidget />
      </Suspense>
    ),
    today_actions: () => (
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <TodayActionWidget />
      </Suspense>
    ),
    ai_insights: () => (
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <AIInsightsWidget />
      </Suspense>
    ),
    alerts: () => (
      <div className="grid grid-cols-2 gap-3 h-full">
        <AlertCard icon={FileText} value={stats?.pendingStudentLeaves || 0} label={L("ใบลานักเรียน", "Student Leaves")} tone="info" onClick={() => navigate("/dashboard/student/leave")} />
        <AlertCard icon={Clock} value={stats?.pendingStaffLeaves || 0} label={L("ใบลาบุคลากร", "Staff Leaves")} tone="info" onClick={() => navigate("/dashboard/hr/leave")} />
        <AlertCard icon={AlertTriangle} value={stats?.pendingDamage || 0} label={L("แจ้งซ่อม", "Repairs")} tone="warning" onClick={() => navigate("/dashboard/finance/assets")} />
        <AlertCard icon={Calendar} value={eventsToday} label={L("กิจกรรมวันนี้", "Events Today")} tone="success" onClick={() => navigate("/dashboard/academic/calendar")} />
      </div>
    ),
    kpi_students: (color) => {
      const m = stats?.maleStudents || 0;
      const f = stats?.femaleStudents || 0;
      const total = stats?.activeStudents || 0;
      const unknown = Math.max(0, total - m - f);
      const sub = m === 0 && f === 0
        ? L(`ไม่ระบุเพศ ${unknown}`, `Unspecified ${unknown}`)
        : unknown > 0
          ? L(`ช ${m} · ญ ${f} · ไม่ระบุ ${unknown}`, `M ${m} · F ${f} · N/A ${unknown}`)
          : L(`ช ${m} · ญ ${f}`, `M ${m} · F ${f}`);
      return (
        <KpiCard icon={Users} label={L("นักเรียน", "Students")} value={total} sub={sub}
          gradient={COLOR_THEMES[color].gradient} onClick={() => navigate("/dashboard/academic/all-students")} />
      );
    },
    kpi_personnel: (color) => (
      <KpiCard icon={GraduationCap} label={L("บุคลากร", "Personnel")} value={stats?.personnel || 0}
        sub={L(`เชื่อมบัญชี ${stats?.linkedPersonnel || 0} · ${stats?.deptData.length || 0} ฝ่าย`, `Linked ${stats?.linkedPersonnel || 0} · ${stats?.deptData.length || 0} depts`)}
        gradient={COLOR_THEMES[color].gradient} onClick={() => navigate("/dashboard/hr/personnel")} />
    ),
    kpi_classrooms: (color) => (
      <KpiCard icon={BookOpen} label={L("ห้องเรียน", "Classrooms")} value={stats?.classrooms || 0}
        sub={L(`ครูประจำชั้น ${stats?.classroomsWithTeacher || 0} · ${stats?.subjects || 0} วิชา`, `Homeroom ${stats?.classroomsWithTeacher || 0} · ${stats?.subjects || 0} subjects`)}
        gradient={COLOR_THEMES[color].gradient} onClick={() => navigate("/dashboard/academic/management")} />
    ),
    kpi_attendance: (color) => {
      // นับ "เข้าโรงเรียน" = present + late (จากทั้ง attendance และ face_scan รวมกันแล้วใน statusByStudent)
      const checkedIn = presentN + lateN;
      const totalStu = stats?.students || 0;
      const pct = totalStu > 0 ? Math.round((checkedIn / totalStu) * 1000) / 10 : 0;
      return (
        <KpiCard icon={UserCheck} label={L("เข้าโรงเรียนวันนี้", "Checked-in Today")} value={`${checkedIn}/${totalStu}`}
          sub={L(`${pct}% · มา ${presentN} · สาย ${lateN} · ขาด ${absentN}`, `${pct}% · On ${presentN} · Late ${lateN} · Abs ${absentN}`)}
          gradient={COLOR_THEMES[color].gradient} onClick={() => navigate("/dashboard/student/attendance")}
          progress={pct} />
      );
    },

    kpi_balance: (color) => (
      <KpiCard icon={DollarSign} label={L("งบคงเหลือ", "Balance")} value={`฿${formatMoney(balance)}`}
        sub={L(`รับ ${formatMoney(stats?.totalIncome || 0)} · จ่าย ${formatMoney(stats?.totalExpense || 0)}`, `In ${formatMoney(stats?.totalIncome || 0)} · Out ${formatMoney(stats?.totalExpense || 0)}`)}
        gradient={COLOR_THEMES[color].gradient} onClick={() => navigate("/dashboard/finance/budget")} />
    ),
    kpi_assets: (color) => (
      <KpiCard icon={Package} label={L("สินทรัพย์", "Assets")} value={stats?.totalAssets || 0}
        sub={L(`฿${formatMoney(stats?.totalAssetValue || 0)} · ชำรุด ${stats?.damagedAssets || 0}`, `฿${formatMoney(stats?.totalAssetValue || 0)} · Damaged ${stats?.damagedAssets || 0}`)}
        gradient={COLOR_THEMES[color].gradient} onClick={() => navigate("/dashboard/finance/assets")} />
    ),
    attendance_donut: (color) => {
      const theme = COLOR_THEMES[color];
      return (
        <Card className="border border-border/50 shadow-elevated rounded-2xl h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className={`w-1.5 h-4 rounded-full ${theme.gradient}`} />
              {L("การมาเรียนวันนี้", "Today's Attendance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[180px]" /> : totalAtt > 0 ? (
              <div className="flex items-center gap-5">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={stats!.attData} cx="50%" cy="50%" innerRadius={38} outerRadius={55} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {stats!.attData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5">
                  <AttRow color="hsl(var(--success))" label={L("มาเรียน", "Present")} value={presentN} total={totalAtt} />
                  <AttRow color="hsl(var(--warning))" label={L("สาย", "Late")} value={lateN} total={totalAtt} />
                  <AttRow color="hsl(var(--destructive))" label={L("ขาด", "Absent")} value={absentN} total={totalAtt} />
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">{L("ยังไม่มีการเช็คชื่อวันนี้", "No check-in yet today")}</p>
            )}
          </CardContent>
        </Card>
      );
    },
    budget_trend: (color) => {
      const theme = COLOR_THEMES[color];
      return (
        <Card className="border border-border/50 shadow-elevated rounded-2xl h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${theme.gradient} flex items-center justify-center`}>
                  <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                {L("รายรับ-รายจ่าย 6 เดือนล่าสุด", "Income & Expense — Last 6 Months")}
              </div>
              <div className="hidden sm:flex gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-success" />{L("รายรับ", "Income")}</span>
                <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-destructive" />{L("รายจ่าย", "Expense")}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[200px]" /> : stats?.budgetTrend && stats.budgetTrend.some(d => d.income + d.expense > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.budgetTrend}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => formatMoney(v)} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => `฿${formatMoneyFull(v)}`} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                  <Area type="monotone" dataKey="income" name={L("รายรับ", "Income")} stroke="hsl(var(--success))" strokeWidth={2} fill="url(#incomeGrad)" />
                  <Area type="monotone" dataKey="expense" name={L("รายจ่าย", "Expense")} stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#expenseGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-16">{L("ยังไม่มีข้อมูล", "No data yet")}</p>}
          </CardContent>
        </Card>
      );
    },
    news: (color) => {
      const theme = COLOR_THEMES[color];
      return (
        <Card className="border border-border/50 shadow-elevated rounded-2xl h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${theme.soft} flex items-center justify-center`}>
                <Bell className={`w-3.5 h-3.5 ${theme.text}`} />
              </div>
              {L("ข่าวสารล่าสุด", "Latest News")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? <Skeleton className="h-32" /> : stats?.recentNews && stats.recentNews.length > 0 ? (
              <>
                {stats.recentNews.slice(0, 4).map((n: any) => {
                  const d = new Date(n.published_at || n.created_at || Date.now());
                  return (
                    <button key={n.id} onClick={() => navigate(`/dashboard/news/${n.id}`)} className="w-full text-left group block">
                      <p className={`text-[10px] ${theme.text} font-medium mb-0.5`}>
                        {d.toLocaleDateString(lang === "th" ? "th-TH-u-ca-buddhist" : "en-GB", { day: "numeric", month: "short" })}
                      </p>
                      <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">{n.title}</p>
                    </button>
                  );
                })}
                <button onClick={() => navigate("/dashboard/admin/news")} className={`w-full text-[11px] ${theme.text} font-medium pt-2 border-t flex items-center justify-center gap-1 hover:gap-2 transition-all`}>
                  {L("ดูทั้งหมด", "View all")} <ArrowRight className="w-3 h-3" />
                </button>
              </>
            ) : <p className="text-muted-foreground text-xs text-center py-10">{L("ยังไม่มีข่าวสาร", "No news yet")}</p>}
          </CardContent>
        </Card>
      );
    },
    calendar: (color) => {
      const theme = COLOR_THEMES[color];
      return (
        <Card className="border border-border/50 shadow-elevated rounded-2xl h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${theme.gradient} flex items-center justify-center`}>
                <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              {L("ปฏิทินกิจกรรม", "Event Calendar")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40" /> : <MiniCalendar events={stats?.upcomingEvents || []} navigate={navigate} lang={lang} />}
          </CardContent>
        </Card>
      );
    },
    student_care: (color) => {
      const theme = COLOR_THEMES[color];
      return (
        <Card className="border border-border/50 shadow-elevated rounded-2xl h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${theme.gradient} flex items-center justify-center`}>
                <Shield className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              {L("ระบบดูแลนักเรียน", "Student Care")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <StatRow icon={Heart} label={L("บันทึกสุขภาพ", "Health Records")} value={stats?.healthRecords || 0} />
            <StatRow icon={CheckCircle2} label={L("พฤติกรรมดี", "Positive Behavior")} value={stats?.positiveB || 0} color="text-success" />
            <StatRow icon={XCircle} label={L("พฤติกรรมเชิงลบ", "Negative Behavior")} value={stats?.negativeB || 0} color="text-destructive" />
            <StatRow icon={ClipboardList} label="SDQ" value={stats?.sdqCount || 0} />
            <StatRow icon={Users} label={L("เยี่ยมบ้าน", "Home Visits")} value={stats?.homeVisits || 0} />
            <StatRow icon={FileText} label={L("เอกสารรอดำเนินการ", "Pending Docs")} value={stats?.pendingDocs || 0} color={stats?.pendingDocs ? "text-warning" : undefined} />
          </CardContent>
        </Card>
      );
    },
    mini_apps: () => (
      <Suspense fallback={<Skeleton className="h-44 rounded-2xl" />}>
        <SuperAppShortcuts alerts={((stats as any)?.studentLeavesPending || 0) + ((stats as any)?.staffLeavesPending || 0)} />
      </Suspense>
    ),
    departments: () => null,
    iot_summary: () => (
      <Suspense fallback={<Skeleton className="h-32 rounded-2xl" />}>
        <IoTSummaryWidget />
      </Suspense>
    ),
    school_radar: () => (
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <SchoolRadarWidget />
      </Suspense>
    ),
    module_hub: (color) => {
      const theme = COLOR_THEMES[color];
      return (
        <Card className={`h-full border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all ring-1 ring-black/[0.02] dark:ring-white/[0.04] ${theme.soft}`} onClick={() => navigate("/dashboard/hub")}>
          <CardContent className="p-5 flex items-center gap-4 h-full min-h-32">
            <div className={`w-12 h-12 rounded-xl ${theme.gradient} flex items-center justify-center text-primary-foreground shrink-0 shadow-sm`}>
              <Network className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{L("Hub โมดูล", "Module Hub")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{L("แผนผังเชื่อมโยงทุกระบบ", "Spider-web map of all modules")}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      );
    },
    social_wall: () => (
      <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
        <SocialWallWidget limit={6} title="" variant="bare" />
      </Suspense>
    ),
  };

  const enabledWidgets = widgets.filter(w => w.enabled);
  // (draggingId/sensors/reorder/upsert ถูก declare ไว้ด้านบนแล้ว)

  const handleDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = e;
    if (!over) return;
    if (over.id === "__trash__") {
      const def = widgets.find(w => w.key === active.id)?.def;
      if (def?.required) return;
      upsert.mutate({ widget_key: String(active.id), enabled: false });
      return;
    }
    if (active.id === over.id) return;
    const oldIdx = widgets.findIndex(w => w.key === active.id);
    const newIdx = widgets.findIndex(w => w.key === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    reorder.mutate(arrayMove(widgets, oldIdx, newIdx).map(w => w.key));
  };

  return (
    <div className="space-y-4 pb-24 sm:pb-4 [scrollbar-gutter:stable]">
      
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate">

          {L(`${enabledWidgets.length} วิดเจ็ตที่แสดงอยู่ · กดค้างเพื่อจัดเรียง`, `${enabledWidgets.length} widgets · long-press to rearrange`)}
        </p>
        <WidgetCustomizer />
      </div>

      {widgetsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-5 lg:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl col-span-2 lg:col-span-2" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDraggingId(null)}>
          <SortableContext items={enabledWidgets.map(w => w.key)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-5 lg:gap-6 grid-flow-dense items-stretch">
              {enabledWidgets.map((w) => {
                const render = widgetRenderers[w.key];
                if (!render) return null;
                return (
                  <SortableWidget key={w.key} id={w.key} className={`${SIZE_CLASSES[w.size]} min-w-0 h-full`}>
                    {render(w.color)}
                  </SortableWidget>
                );
              })}
            </div>

          </SortableContext>
          <TrashDropZone visible={!!draggingId} lang={lang} />
        </DndContext>
      )}
    </div>
  );
};

/* ── Sortable widget wrapper ── */
const SortableWidget = ({ id, className, children }: { id: string; className: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`${className} touch-pan-y ${isDragging ? "scale-95" : ""} transition-transform [&>*]:h-full`}>
      {children}
    </div>

  );
};

/* ── Floating trash drop zone (appears during drag) ── */
const TrashDropZone = ({ visible, lang }: { visible: boolean; lang: string }) => {
  const { isOver, setNodeRef } = useDroppable({ id: "__trash__" });
  if (!visible) return null;
  return (
    <div
      ref={setNodeRef}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed transition-all px-6 py-4 backdrop-blur-md shadow-elevated ${
        isOver ? "bg-destructive text-destructive-foreground border-destructive scale-110" : "bg-background/90 border-destructive/40 text-destructive"
      }`}
    >
      <Trash2 className={`w-6 h-6 ${isOver ? "animate-bounce" : ""}`} />
      <span className="text-xs font-medium">
        {isOver ? (lang === "th" ? "ปล่อยเพื่อซ่อน" : "Drop to hide") : (lang === "th" ? "ลากมาที่นี่เพื่อซ่อน" : "Drag here to hide")}
      </span>
    </div>
  );
};

/* ── Alert card ── */
interface AlertCardProps {
  icon: React.ComponentType<any>;
  value: number;
  label: string;
  tone: "info" | "warning" | "success" | "danger";
  onClick?: () => void;
}
const AlertCard = ({ icon: Icon, value, label, tone, onClick }: AlertCardProps) => {
  const toneMap = {
    info: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" },
    warning: { bg: "bg-warning/15", text: "text-warning", ring: "ring-warning/20" },
    success: { bg: "bg-success/15", text: "text-success", ring: "ring-success/20" },
    danger: { bg: "bg-destructive/15", text: "text-destructive", ring: "ring-destructive/20" },
  } as const;
  const c = toneMap[tone];
  return (
    <Card
      className="border-0 ring-1 ring-border/40 shadow-elevated rounded-[1.5rem] cursor-pointer hover:shadow-card-hover hover:-translate-y-1 active:scale-[0.97] transition-all duration-300 group overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-3 flex flex-col justify-between h-full min-h-[100px]">
        <div className={`w-10 h-10 rounded-2xl ${c.bg} ${c.text} ring-4 ${c.ring} flex items-center justify-center group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="mt-2">
          <p className="text-2xl font-extrabold text-foreground leading-none tabular-nums">{value}</p>
          <p className="text-[10px] text-muted-foreground mt-1 truncate font-medium">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
};

/* ── Attendance row with bar ── */
const AttRow = ({ color, label, value, total }: { color: string; label: string; value: number; total: number }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="font-semibold text-foreground">{value} <span className="text-[10px] text-muted-foreground font-normal">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="bg-muted h-1 rounded-full overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

/* ── Sub-components ── */

interface KpiCardProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  onClick?: () => void;
  progress?: number;
}

const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  ({ icon: Icon, label, value, sub, gradient, onClick, progress }, ref) => (
    <Card
      ref={ref}
      className="relative border border-border/50 bg-card/80 backdrop-blur-xl shadow-sm rounded-2xl cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-border active:translate-y-0 transition-all duration-200 group overflow-hidden"
      onClick={onClick}
    >
      <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full ${gradient} opacity-[0.08] blur-2xl group-hover:opacity-[0.14] transition-opacity`} />
      <div className={`absolute top-0 left-0 h-[2px] w-12 ${gradient} opacity-70 rounded-r-full`} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center shrink-0 shadow-md shadow-black/5 ring-1 ring-white/20`}>
            <Icon className="w-5 h-5 text-primary-foreground" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground font-semibold tracking-[0.08em] uppercase">{label}</p>
        <p className="text-[1.75rem] font-bold text-foreground leading-none mt-1.5 tabular-nums tracking-tight">{value}</p>
        {progress !== undefined && <Progress value={progress} className="h-1 mt-3 rounded-full" />}
        {sub && <p className="text-[11px] text-muted-foreground mt-2 truncate font-medium">{sub}</p>}
      </CardContent>
    </Card>
  )
);
KpiCard.displayName = "KpiCard";


interface StatRowProps {
  icon: React.ComponentType<any>;
  label: string;
  value: number;
  color?: string;
}

const StatRow = ({ icon: Icon, label, value, color }: StatRowProps) => (
  <div className="flex items-center justify-between text-sm">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className={`w-3.5 h-3.5 ${color || ""}`} /> {label}
    </div>
    <span className={`font-semibold ${color || "text-foreground"}`}>{value}</span>
  </div>
);

/* ── Mini Calendar ── */
const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS_TH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const MONTHS_EN_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MiniCalendar = ({ events: _propEvents, navigate, lang = "th" }: { events: any[]; navigate: (path: string) => void; lang?: string }) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Fetch ALL events for the current month so we can show dots + hover details
  const { data: monthEvents = [] } = useQuery({
    queryKey: ["mini_calendar_events", year, month],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString().split("T")[0];
      const end = new Date(year, month + 1, 0).toISOString().split("T")[0];
      const { data } = await supabase
        .from("academic_events")
        .select("id, title, event_date, event_type, location, description")
        .gte("event_date", start)
        .lte("event_date", end)
        .order("event_date", { ascending: true });
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Group events by day-of-month
  const eventsByDay = new Map<number, any[]>();
  for (const e of monthEvents as any[]) {
    const d = new Date(e.event_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay.has(day)) eventsByDay.set(day, []);
      eventsByDay.get(day)!.push(e);
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const typeColor: Record<string, string> = {
    holiday: "bg-destructive",
    exam: "bg-warning",
    activity: "bg-primary",
    meeting: "bg-accent",
  };

  return (
    <div>
      <p className="text-[11px] font-semibold text-center text-foreground mb-1">
        {(lang === "th" ? MONTHS_TH_FULL : MONTHS_EN_FULL)[month]} {toBE(year)}
      </p>
      <div className="grid grid-cols-7 text-center">
        {(lang === "th" ? DAYS_TH : DAYS_EN).map(d => (
          <div key={d} className="text-[9px] font-medium text-muted-foreground py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const isToday = day === today.getDate();
          const dayEvents = eventsByDay.get(day) || [];
          const hasEvent = dayEvents.length > 0;
          const dotTypes = Array.from(new Set(dayEvents.map(e => e.event_type))).slice(0, 3);

          const cell = (
            <div
              className={`relative py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                isToday
                  ? "bg-primary text-primary-foreground font-bold"
                  : hasEvent
                  ? "bg-warning/15 text-warning font-semibold hover:bg-warning/25"
                  : "text-foreground hover:bg-muted/50"
              }`}
            >
              {day}
              {hasEvent && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dotTypes.map((t, idx) => (
                    <span
                      key={idx}
                      className={`w-1 h-1 rounded-full ${
                        isToday ? "bg-primary-foreground" : (typeColor[t] || "bg-warning")
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          );

          if (!hasEvent) return <div key={day}>{cell}</div>;

          return (
            <HoverCard key={day} openDelay={100} closeDelay={100}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/academic/calendar")}
                  className="w-full"
                  aria-label={`${day} ${(lang === "th" ? MONTHS_TH_FULL : MONTHS_EN_FULL)[month]}`}
                >
                  {cell}
                </button>
              </HoverCardTrigger>
              <HoverCardContent side="top" align="center" className="w-72 p-3">
                <p className="text-xs font-semibold mb-2">
                  {day} {(lang === "th" ? MONTHS_TH_FULL : MONTHS_EN_FULL)[month]} {toBE(year)}
                </p>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {dayEvents.map((ev: any) => (
                    <div key={ev.id} className="flex items-start gap-2 text-xs">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${typeColor[ev.event_type] || "bg-warning"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{ev.title}</p>
                        {ev.event_type && (
                          <p className="text-[10px] text-muted-foreground capitalize">{ev.event_type}</p>
                        )}
                        {ev.location && (
                          <p className="text-[10px] text-muted-foreground truncate">📍 {ev.location}</p>
                        )}
                        {ev.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{ev.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
      <button
        onClick={() => navigate("/dashboard/academic/calendar")}
        className="w-full mt-1.5 text-[10px] text-primary hover:text-primary/80 font-medium flex items-center justify-center gap-1 transition-colors"
      >
        {lang === "th" ? "ดูปฏิทินทั้งหมด" : "View Full Calendar"} <ArrowRight className="w-2.5 h-2.5" />
      </button>
    </div>
  );
};

export default Dashboard;
