import { useParentChildren } from "@/hooks/useParentChildren";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dashboardTermDates } from "@/lib/dashboardTerm";
import { loadFamilyDashboardHomework } from "@/lib/dashboardHomework";
import { familyHomeworkLabels } from "@/lib/homeworkFamilyStatus";
import DashboardIntroGrid from "./DashboardIntroGrid";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { IdCardPhoto } from "@/components/IdCardPhoto";
import { useEffect, useState, lazy, Suspense } from "react";
import DailyTaskBar from "./DailyTaskBar";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { familyGradeSemester } from "@/lib/familyGrades";
import { calculateGPA } from '@/lib/gradeUtils';
import { requireSuccessfulReads } from "@/lib/dataReliability";
import { toCE } from "@/lib/utils";
import { bkkDateISO, todayBangkok } from "@/lib/dateBE";
import { useWeatherData } from "@/hooks/useWeatherData";
const DynamicHeroBackground = lazy(() => import("./DynamicHeroBackground"));
const MascotHeroWidget = lazy(() => import("./widgets/MascotHeroWidget"));
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toBE } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, Sparkles, Calendar, Bell, BookOpen,
  ClipboardList, FileText, Heart, ArrowRight, CheckCircle2, XCircle, Clock,
  User as UserIcon, Upload, Thermometer, Wind, Award, TrendingUp, TrendingDown,
  Timer, Layers, BookMarked, AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
const MyRadarWidget = lazy(() => import("./MyRadarWidget"));

const StudentDashboard = () => {
  const { lang } = useLanguage();
  const { userId, isParent, isStudent } = useUserRole();
  const navigate = useNavigate();
  const { children, isLoading: childrenLoading, error: childrenError } = useParentChildren();
  const [childId, setChildId] = useState("");
  const selectedChild = children.find(child=>child.id === childId) ?? children[0];
  const qc = useQueryClient();
  // ตารางสอนของนั กเรียนตองจัดใหอยู่ในภาคเรียนปัจจุบันเทานั้ น
  const { currentAcademicYear, currentSemester, today: schoolDate, isReady: termReady, periods, error: termError } = useAcademicYear();
  const currentBE = currentAcademicYear;
  const gradeSemester = familyGradeSemester(isParent || isStudent, currentSemester);
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const weather = useWeatherData();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return L("สวัสดีตอนเช้า", "Good Morning");
    if (h < 17) return L("สวัสดีตอนบ่าย", "Good Afternoon");
    return L("สวัสดีตอนเย็น", "Good Evening");
  })();

  const { data, isLoading, error: dashboardError, refetch: retryDashboard } = useQuery({
    queryKey: ["student_dashboard", userId, isParent, currentAcademicYear, currentSemester, schoolDate, selectedChild?.id],
    enabled: !!userId && termReady && (!isParent || !childrenLoading),
    queryFn: async () => {
      if (!userId) throw new Error("กรุณาเข้าสู่ระบบ");
      const dates = dashboardTermDates(periods, currentAcademicYear, currentSemester);
      // Parents see their linked child (students.parent_user_id/_2); students see themselves.
      const base = supabase
        .from("students")
        .select("id, prefix, first_name, last_name, student_code, classroom_id, photo_url");
      const { data: student, error: studentError } = isParent
        ? selectedChild ? await base.eq("id", selectedChild.id).maybeSingle() : {data:null,error:null}
        : await base.eq("auth_user_id", userId).maybeSingle();
      if (studentError) throw studentError;

      if (!student) {
        const [news, events] = await Promise.all([
          supabase.from("news_posts").select("id, title, category, published_at")
            .eq("is_published", true).order("created_at", { ascending: false }).limit(5),
          supabase.from("academic_events").select("id, title, event_date, event_type")
            .gte("event_date", todayBangkok())
            .order("event_date").limit(5),
        ]);
        requireSuccessfulReads([news, events]);
        return { student: null, news: news.data || [], events: events.data || [] } as any;
      }

      const today = new Date();
      const todayDow = new Date(`${schoolDate}T00:00:00Z`).getUTCDay();
      const todayStr = bkkDateISO(today);

      const [classroom, attendance, behavior, leaves, homework, schedule, news, events] = await Promise.all([
        student.classroom_id
          ? supabase.from("classrooms").select("name, grade_level, homeroom_teacher").eq("id", student.classroom_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        fetchAllRows((from,to)=>supabase.from("attendance").select("status, attendance_date").is("subject_id", null).eq("period", 0).eq("student_id", student.id).gte("attendance_date", dates.start).lte("attendance_date", dates.end).order("id").range(from,to)).then(data=>({data,error:null})),
        fetchAllRows((from,to)=>supabase.from("behavior_records").select("id, behavior_type, description, record_date, points")
          .eq("student_id", student.id).gte("record_date", dates.start).lte("record_date", dates.end).order("record_date", { ascending: false }).order("id").range(from,to)).then(data=>({data,error:null})),
        supabase.from("student_leaves").select("id, status, start_date, end_date, reason")
          .eq("student_id", student.id).gte("end_date", dates.start).lte("start_date", dates.end).order("start_date", { ascending: false }).limit(5),
        loadFamilyDashboardHomework(student, dates).then(data=>({data,error:null})),
        student.classroom_id
          ? supabase.from("schedules").select("period, start_time, end_time, day_of_week, teacher_name, subjects(name_th, code)")
              .eq("classroom_id", student.classroom_id).eq("day_of_week", todayDow)
              .eq("academic_year", toCE(currentAcademicYear)).eq("semester", currentSemester)
              .order("period")
          : Promise.resolve({ data: [] } as any),
        supabase.from("news_posts").select("id, title, category, published_at")
          .eq("is_published", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("academic_events").select("id, title, event_date, event_type")
          .gte("event_date", todayStr > dates.start ? todayStr : dates.start).lte("event_date", dates.end).order("event_date").limit(5),
      ]);
      requireSuccessfulReads([classroom, attendance, behavior, leaves, homework, schedule, news, events]);

      // นับเป็น "วัน" จริง — วันเดียวกันหลายคาบนับครั้งเดียว (มา > สาย > ลา > ป่วย > ขาด)
      const PRIORITY: Record<string, number> = { present: 5, late: 4, leave: 3, sick: 2, absent: 1 };
      const dayStatus: Record<string, string> = {};
      (attendance.data || []).forEach((a: any) => {
        if (!a.attendance_date || !(a.status in PRIORITY)) return;
        const prev = dayStatus[a.attendance_date];
        if (!prev || PRIORITY[a.status] > PRIORITY[prev]) dayStatus[a.attendance_date] = a.status;
      });
      const days = Object.values(dayStatus);
      const total = days.length;
      const present = days.filter((s) => s === "present").length;
      const absent = days.filter((s) => s === "absent").length;
      const late = days.filter((s) => s === "late").length;
      const leaveDays = days.filter((s) => s === "leave" || s === "sick").length;
      const rate = total > 0 ? (((present + late) / total) * 100).toFixed(1) : "—";

      const positiveB = behavior.data?.filter((b: any) => b.behavior_type === "positive").length || 0;
      const negativeB = behavior.data?.filter((b: any) => b.behavior_type === "negative").length || 0;
      const totalPoints = behavior.data?.reduce((s: number, b: any) => s + (b.points || 0), 0) || 0;

      return {
        student,
        classroom: (classroom as any)?.data || null,
        rate, present, absent, late, leaveDays,
        positiveB, negativeB, totalPoints,
        recentBehavior: (behavior.data || []).slice(0, 5),
        recentLeaves: leaves.data || [],
        homework: homework.data || [],
        todaySchedule: schedule.data || [],
        news: news.data || [],
        events: events.data || [],
      };
    },
  });

  const displayName = data?.student
    ? `${data.student.first_name} ${data.student.last_name}`
    : "";

  // ── Enhanced student KPIs: GPA, upcoming exams, recent grades, sparkline trends ──
  const { data: gpaData, error: gpaError } = useQuery({
    queryKey: ["student_gpa", data?.student?.student_code, currentAcademicYear, gradeSemester],
    enabled: !!data?.student?.student_code && termReady,
    queryFn: async () => {
      const rows = await fetchAllRows((from, to) => supabase
        .from("student_scores")
        .select("id, grade_point, total_score, grade, updated_at, subjects(credits)")
        .eq("student_code", data?.student?.student_code ?? "")
        .eq("academic_year", toCE(currentAcademicYear)).eq("semester", gradeSemester)
        .order("updated_at", { ascending: false }).order('id').range(from, to));
      const pts = rows.map(r => r.grade_point ?? (/^[0-4](\.5)?$/.test(r.grade ?? "") ? Number(r.grade) : null)).filter((n): n is number => n != null && Number.isFinite(n));
      const avg = calculateGPA(rows.map(r => ({ gradePoint: r.grade_point ?? (/^[0-4](\.5)?$/.test(r.grade ?? "") ? Number(r.grade) : null), credits: Number(r.subjects?.credits ?? 0) })));
      const spark = (rows || []).slice(0, 7).reverse().map(r => ({ v: Number(r.grade_point) || 0 }));
      const recent = (rows || []).slice(0, 5);
      return { gpa: pts.length ? avg.toFixed(2) : "—", count: pts.length, spark, recent, avgNum: avg };
    },
  });

  const upcomingExams = data?.events ?? [];

  const { data: recentGrades, error: gradesError } = useQuery({
    queryKey: ["student_recent_grades", data?.student?.student_code, currentAcademicYear, gradeSemester],
    enabled: !!data?.student?.student_code && termReady,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("student_scores")
        .select("id, grade, total_score, grade_point, subjects(name_th, code)")
        .eq("student_code", data?.student?.student_code ?? "")
        .eq("academic_year", toCE(currentAcademicYear)).eq("semester", gradeSemester)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return rows || [];
    },
  });

  const pendingHomeworkCount = (data?.homework || []).filter((h: any) => (h.status === "not_submitted" || h.status === "needs_revision")).length;
  const overdueHomeworkCount = (data?.homework || []).filter((h: any) => h.due_date && h.due_date < schoolDate && (h.status === "not_submitted" || h.status === "needs_revision")).length;

  return (
    <div className="space-y-6">
      {(dashboardError || termError || childrenError || gpaError || gradesError) && <div role="alert" className="text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ <Button variant="outline" onClick={() => { void retryDashboard(); void qc.invalidateQueries({queryKey:["student_gpa"]}); void qc.invalidateQueries({queryKey:["student_recent_grades"]}); void qc.invalidateQueries({queryKey:["academic-periods"]}); void qc.invalidateQueries({queryKey:["semester-config"]}); }}>ลองใหม่</Button></div>}
      {isParent && children.length > 1 && <Select value={selectedChild?.id ?? ""} onValueChange={setChildId}><SelectTrigger aria-label="เลือกบุตรหลาน" className="w-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent>{children.map(child=><SelectItem key={child.id} value={child.id}>{child.first_name} {child.last_name}</SelectItem>)}</SelectContent></Select>}
      {/* Hero */}
      <DashboardIntroGrid>
      <div className="gradient-hero rounded-2xl p-6 text-primary-foreground relative overflow-hidden min-h-[180px]">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/20" />
          <div className="absolute -left-4 -bottom-4 w-28 h-28 rounded-full bg-white/10" />
        </div>
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 shrink-0 rounded-2xl overflow-hidden ring-2 ring-primary-foreground/40 flex items-center justify-center" data-student-photo>
                <IdCardPhoto url={data?.student?.photo_url || undefined} name={displayName} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 opacity-80" />
                  <span className="text-xs font-medium opacity-80 tracking-wide uppercase">{isParent ? L("ผู้ปกครอง", "Parent") : L("นักเรียน", "Student")}</span>
                </div>
                <h1 className="text-2xl font-bold mb-1 truncate">{greeting}{displayName ? `, ${displayName}` : ""} 👋</h1>
                <p className="text-sm opacity-90 truncate">
                  {data?.student?.student_code && <span>{L("รหัส", "Code")}: {data.student.student_code} · </span>}
                  {data?.classroom && <span>{data.classroom.grade_level}/{data.classroom.name} · </span>}
                  <span className="opacity-80">{L("ปีการศึกษา", "Year")} {currentBE} · {L("เทอม", "Term")} {currentSemester}</span>
                </p>
              </div>
            </div>

            {/* Weather Widget */}
            {weather.hasCoords && !weather.isLoading && weather.temperature !== null && (
              <div className="hidden sm:flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4" />
                  <span className="text-lg font-bold">{weather.temperature?.toFixed(1)}°C</span>
                </div>
                <div className="w-px h-8 bg-white/30" />
                <div className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4" />
                  <div className="text-xs">
                    <span className="font-semibold">PM2.5</span>
                    <span className={`block font-bold ${weather.pm25 !== null && weather.pm25 > 75 ? "text-red-200" : weather.pm25 !== null && weather.pm25 > 37.5 ? "text-yellow-200" : ""}`}>
                      {weather.pm25 !== null ? `${weather.pm25.toFixed(0)} µg/m³` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Weather info for mobile */}
          {weather.hasCoords && !weather.isLoading && weather.temperature !== null && (
            <div className="sm:hidden flex items-center gap-3 mt-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 w-fit">
              <Thermometer className="w-3.5 h-3.5" />
              <span className="text-sm font-bold">{weather.temperature?.toFixed(1)}°C</span>
              <span className="text-xs opacity-70">|</span>
              <Wind className="w-3.5 h-3.5" />
              <span className="text-xs">PM2.5: {weather.pm25 !== null ? `${weather.pm25.toFixed(0)}` : "N/A"} µg/m³</span>
            </div>
          )}

          {/* Daily Recommendations */}
          {weather.recommendations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {weather.recommendations.map((rec, i) => (
                <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-medium">
                  {rec}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
        <div><Suspense fallback={<Skeleton className="h-full w-full" />}><MascotHeroWidget /></Suspense></div>
      </DashboardIntroGrid>

      {!data?.student && !isLoading && !dashboardError && !termError && (
        <Card className="border border-border/50 shadow-elevated rounded-2xl">
          <CardContent className="py-10 text-center">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {L("ยังไม่ได้เชื่อมบัญชีกับข้อมูลนักเรียน กรุณาติดต่อผู้ดูแลระบบ", "Account not linked to student profile. Please contact admin.")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ทางลัดงานประจำวัน — วางไว้ก่่อนส่วนสรุปภาระงาน */}
      <DailyTaskBar />

      {/* ── Modern KPI: GPA, Attendance %, Homework, Exams, Recent Grades ── */}
      {data?.student && !dashboardError && !termError && !childrenError && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> {L("ภาพรวมการเรียนของฉัน", "My Learning Overview")}
            <span className="text-[11px] font-normal text-muted-foreground">{L("อัปเดตเรียลไทม์ · แตะเพื่อดูรายละเอียด", "Live · tap for details")}</span>
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="rounded-2xl border border-border/40">
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-7 w-12" />
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
              className="grid grid-cols-2 lg:grid-cols-5 gap-3"
            >
              {/* GPA */}
              <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
                <Card onClick={() => navigate("/dashboard/student/grades")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
                  <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full gradient-primary opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
                        <Award className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">{gpaError ? "—" : gpaData?.count ?? "—"} {L("วิชา", "subjects")}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">{L("เกรดเฉลี่ย (GPA)", "My GPA")} · {L("เทอม", "Term")} {gradeSemester}</p>
                    <p className="text-2xl font-extrabold tabular-nums">{gpaData?.gpa || "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      {(gpaData?.avgNum || 0) >= 3 ? <><TrendingUp className="w-3 h-3 text-success" /> {L("ดีมาก", "Excellent")}</> : (gpaData?.avgNum || 0) >= 2 ? <><TrendingUp className="w-3 h-3 text-amber-500" /> {L("พอใช้", "Average")}</> : gpaData?.gpa === "—" ? L("ยังไม่มีคะแนน", "No grades yet") : <><TrendingDown className="w-3 h-3 text-destructive" /> {L("ต้องพัฒนา", "Needs improvement")}</>}
                    </p>
                    <div className="mt-2 h-[28px]">
                      {gpaData?.spark && gpaData.spark.length > 1 ? (
                        <ResponsiveContainer width="100%" height={28}>
                          <AreaChart data={gpaData.spark}>
                            <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="hsl(var(--primary) / 0.18)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center text-[10px] text-muted-foreground/60">{L("— ไม่มีข้อมูล —", "— no data —")}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Attendance % */}
              <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
                <Card onClick={() => navigate("/dashboard/student/attendance")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
                  <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full gradient-success opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl gradient-success flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <Badge variant="secondary" className={`text-[10px] border-0 ${parseFloat(data.rate) >= 80 ? "bg-success/10 text-success" : parseFloat(data.rate) >= 60 ? "bg-amber-100 text-amber-700" : "bg-destructive/10 text-destructive"}`}>{data.rate === "—" ? "—" : `${data.rate}%`}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">{L("อัตรามาเรียนจากวันที่บันทึก", "Recorded attendance %")}</p>
                    <p className="text-2xl font-extrabold tabular-nums">{data.rate === "—" ? "—" : `${data.rate}%`}</p>
                    <Progress value={parseFloat(data.rate) || 0} className="h-1.5 mt-2" />
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{L(`มา ${data.present} · ขาด ${data.absent} · สาย ${data.late}`, `Present ${data.present} · Absent ${data.absent} · Late ${data.late}`)}</p>
                    <div className="mt-2 h-[28px] flex gap-1 items-end">
                      <div className="flex-1 bg-success rounded-t-sm" style={{ height: `${(data.present / Math.max(1, data.present + data.absent + data.late + data.leaveDays)) * 100}%` }} />
                      <div className="flex-1 bg-warning rounded-t-sm" style={{ height: `${(data.late / Math.max(1, data.present + data.absent + data.late + data.leaveDays)) * 100}%` }} />
                      <div className="flex-1 bg-destructive rounded-t-sm" style={{ height: `${(data.absent / Math.max(1, data.present + data.absent + data.late + data.leaveDays)) * 100}%` }} />
                      <div className="flex-1 bg-muted rounded-t-sm" style={{height: `${data.leaveDays / Math.max(1,data.present+data.absent+data.late+data.leaveDays)*100}%`}} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Upcoming Homework */}
              <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
                <Card onClick={() => navigate("/dashboard/homework")} className={`relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 h-full ${overdueHomeworkCount > 0 ? "ring-destructive/30" : "ring-border/40"}`}>
                  <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity ${overdueHomeworkCount > 0 ? "bg-destructive" : "gradient-warning"}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${overdueHomeworkCount > 0 ? "bg-destructive" : "gradient-warning"}`}>
                        <BookMarked className="w-5 h-5 text-primary-foreground" />
                      </div>
                      {pendingHomeworkCount > 0 ? <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-0">{pendingHomeworkCount} {L("ค้าง", "pending")}</Badge> : <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-0">{L("ครบ", "done")}</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">{L("การบ้านค้างส่ง", "Upcoming Homework")}</p>
                    <p className="text-2xl font-extrabold tabular-nums">{pendingHomeworkCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {overdueHomeworkCount > 0 ? <span className="text-destructive font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {L(`เกินกำหนด ${overdueHomeworkCount}`, `Overdue ${overdueHomeworkCount}`)}</span> : `${L("ทั้งหมด", "Total")} ${(data.homework || []).length} ${L("ชิ้น", "items")}`}
                    </p>
                    <div className="mt-2">
                      {pendingHomeworkCount === 0 && data.homework.length > 0 ? (
                        <div className="h-[28px] flex items-center justify-center rounded-lg bg-success/10 text-[10px] text-success font-medium">✓ {L("ส่งครบแล้ว", "All submitted")}</div>
                      ) : (
                        <div className="h-[28px] rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 flex items-center justify-center text-[10px] font-medium text-amber-700">{L(`เหลือ ${pendingHomeworkCount} งาน`, `${pendingHomeworkCount} pending`)}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Upcoming Exams */}
              <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
                <Card onClick={() => navigate("/dashboard/academic/calendar")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
                  <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full gradient-accent opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-lg">
                        <Timer className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">{upcomingExams?.length || 0} {L("รายการ", "items")}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">{L("สอบ/กิจกรรมที่จะถึง", "Upcoming Exams")}</p>
                    <p className="text-2xl font-extrabold tabular-nums">{upcomingExams?.length || 0}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      {upcomingExams && upcomingExams.length > 0 ? new Date(upcomingExams[0].event_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" }) + " · " + upcomingExams[0].title.slice(0, 18) : L("ไม่มีสอบเร็วๆ นี้", "No exams soon")}
                    </p>
                    <div className="mt-2 h-[28px]">
                      {upcomingExams && upcomingExams.length > 0 ? (
                        <div className="flex gap-1 h-full items-center">
                          {upcomingExams.slice(0, 4).map((e: any, i: number) => (
                            <div key={e.id} className="flex-1 text-center">
                              <div className="text-[9px] font-bold text-primary bg-primary/10 rounded px-1 py-0.5 truncate">{new Date(e.event_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" })}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">{L("ไม่มีกิจกรรม", "No events")}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Grades */}
              <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
                <Card onClick={() => navigate("/dashboard/student/grades")} className="relative overflow-hidden border-0 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-1 transition-all group ring-1 ring-border/40 h-full">
                  <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-primary opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                        <Layers className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">{recentGrades?.length || 0} {L("รายการ", "items")}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">{L("คะแนนล่าสุด", "Recent Grades")} · {L("เทอม", "Term")} {gradeSemester}</p>
                    <p className="text-2xl font-extrabold tabular-nums">{recentGrades && recentGrades.length > 0 ? recentGrades[0].grade ?? recentGrades[0].total_score ?? "—" : "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      {recentGrades && recentGrades.length > 0 ? `${recentGrades[0].subjects?.name_th || recentGrades[0].subjects?.code || L("วิชา", "Subject")} · ${recentGrades[0].total_score ?? ""}` : L("ยังไม่มีคะแนน", "No grades yet")}
                    </p>
                    <div className="mt-2">
                      {recentGrades && recentGrades.length > 0 ? (
                        <div className="flex gap-1">
                          {recentGrades.slice(0, 5).map((g: any) => (
                            <div key={g.id} className={`flex-1 h-[28px] rounded flex items-center justify-center text-[10px] font-bold ${String(g.grade) === "4" || Number(g.grade) >= 3.5 ? "bg-success/15 text-success" : String(g.grade) === "0" || ["ร","มส","มผ"].includes(String(g.grade)) ? "bg-destructive/15 text-destructive" : "bg-muted text-foreground"}`}>{g.grade || "—"}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-[28px] flex items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">{L("— ไม่มีข้อมูล —", "— no data —")}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </div>
      )}

      {/* Today schedule + Homework */}
      {data?.student && !dashboardError && !termError && !childrenError && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card onClick={() => navigate("/dashboard/academic/schedule")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                {L("ตารางเรียนวันนี้", "Today's Schedule")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.todaySchedule.length === 0 ? (
                <p className="text-muted-foreground text-xs text-center py-6">{L("ไม่มีคาบเรียน", "No classes today")}</p>
              ) : (
                <div className="space-y-1.5">
                  {data.todaySchedule.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                      <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded shrink-0">
                        {s.start_time?.substring(0, 8)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{s.subjects?.name_th || s.subjects?.code || "-"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.teacher_name || "-"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-elevated rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg gradient-warning flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                {L("การบ้าน/งานที่ได้รับมอบหมาย", "Homework Assignments")} · {L("เทอม", "Term")} {currentSemester}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.homework.length === 0 ? (
                <p className="text-muted-foreground text-xs text-center py-6">{L("ไม่มีการบ้าน", "No homework")}</p>
              ) : (
                <div className="space-y-1.5">
                  {data.homework.map((h: any) => (
                    <div key={h.id} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                      <BookOpen className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold break-words">{h.title}</p>
                        <Badge variant={h.status === "graded" ? "default" : "secondary"}>{familyHomeworkLabels[h.status as keyof typeof familyHomeworkLabels]}</Badge>
                        {h.due_date && <p className="text-xs text-muted-foreground">{L("กำหนดส่ง", "Due")} {new Date(h.due_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US")}</p>}
                        {h.score !== null && <p className="text-xs font-semibold text-primary">{L("คะแนนครู", "Teacher score")}: {h.score}{h.maxScore !== null ? ` / ${h.maxScore}` : ""}</p>}
                        {h.feedback && <p className="text-xs text-muted-foreground break-words">{h.feedback}</p>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(h.destination)}>{isParent || h.status !== "not_submitted" ? L("ดูงาน", "View") : L("ทำงาน", "Open")}</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* คะแนนของฉัน — กราฟใยแมงมุม 8 กลุ่มสาระ */}
      {data?.student && !dashboardError && !termError && !childrenError && (
        <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
          <MyRadarWidget studentCode={data.student.student_code} />
        </Suspense>
      )}

      {/* News + Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/50 shadow-elevated rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-primary" />
              </div>
              {L("ข่าวสาร / ประชาสัมพันธ์", "News & Announcements")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24" /> : data?.news?.length ? (
              <div className="space-y-1.5">
                {data.news.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => navigate(`/dashboard/news/${n.id}`)}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/40 transition cursor-pointer group"
                  >
                    <Badge variant="secondary" className="text-[9px] shrink-0">{n.category}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate group-hover:text-primary">{n.title}</p>
                      {n.published_at && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(n.published_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-xs text-center py-6">{L("ยังไม่มีข่าวสาร", "No news")}</p>}
          </CardContent>
        </Card>

        <Card onClick={() => navigate("/dashboard/academic/calendar")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-warning flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              {L("กิจกรรมที่กำลังจะมาถึง", "Upcoming Events")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24" /> : data?.events?.length ? (
              <div className="space-y-1.5">
                {data.events.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition">
                    <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded shrink-0">
                      {new Date(e.event_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" })}
                    </div>
                    <span className="text-xs truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-xs text-center py-6">{L("ไม่มีกิจกรรม", "No events")}</p>}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default StudentDashboard;
