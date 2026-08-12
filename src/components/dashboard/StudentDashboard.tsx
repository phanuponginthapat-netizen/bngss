import { useEffect, useState, lazy, Suspense } from "react";
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
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toBE } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import HomeworkReplies from "@/components/homework/HomeworkReplies";
import {
  GraduationCap, Sparkles, Calendar, Bell, BookOpen,
  ClipboardList, FileText, Heart, ArrowRight, CheckCircle2, XCircle, Clock,
  User as UserIcon, Upload, Thermometer, Wind,
} from "lucide-react";
const MyRadarWidget = lazy(() => import("./MyRadarWidget"));

const StudentDashboard = () => {
  const { lang } = useLanguage();
  const { userId } = useUserRole();
  const navigate = useNavigate();
  const currentBE = toBE(new Date().getFullYear());
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const weather = useWeatherData();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return L("สวัสดีตอนเช้า", "Good Morning");
    if (h < 17) return L("สวัสดีตอนบ่าย", "Good Afternoon");
    return L("สวัสดีตอนเย็น", "Good Evening");
  })();

  const { data, isLoading } = useQuery({
    queryKey: ["student_dashboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: student } = await supabase
        .from("students")
        .select("id, prefix, first_name, last_name, student_code, classroom_id, photo_url")
        .eq("auth_user_id", userId!)
        .maybeSingle();

      if (!student) {
        const [news, events] = await Promise.all([
          supabase.from("news_posts").select("id, title, category, published_at")
            .eq("is_published", true).order("created_at", { ascending: false }).limit(5),
          supabase.from("academic_events").select("id, title, event_date, event_type")
            .gte("event_date", todayBangkok())
            .order("event_date").limit(5),
        ]);
        return { student: null, news: news.data || [], events: events.data || [] } as any;
      }

      const today = new Date();
      const todayDow = today.getDay();
      const todayStr = bkkDateISO(today);

      const [classroom, attendance, behavior, leaves, homework, schedule, news, events] = await Promise.all([
        student.classroom_id
          ? supabase.from("classrooms").select("name, grade_level, homeroom_teacher").eq("id", student.classroom_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from("attendance").select("status, attendance_date").eq("student_id", student.id),
        supabase.from("behavior_records").select("id, behavior_type, description, record_date, points")
          .eq("student_id", student.id).order("record_date", { ascending: false }).limit(5),
        supabase.from("student_leaves").select("id, status, leave_date, reason")
          .eq("student_id", student.id).order("leave_date", { ascending: false }).limit(5),
        supabase.from("task_assignments")
          .select("id, title, description, due_date, status, submitted_at, grade, feedback, submission_text, submission_file_url, annotated_file_url, replies, subjects(name_th)")
          .eq("assigned_to_student_id", student.id)
          .eq("task_type", "homework")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(10),
        student.classroom_id
          ? supabase.from("schedules").select("period, start_time, end_time, day_of_week, teacher_name, subjects(name_th, code)")
              .eq("classroom_id", student.classroom_id).eq("day_of_week", todayDow)
              .order("period")
          : Promise.resolve({ data: [] } as any),
        supabase.from("news_posts").select("id, title, category, published_at")
          .eq("is_published", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("academic_events").select("id, title, event_date, event_type")
          .gte("event_date", todayStr).order("event_date").limit(5),
      ]);

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
      const rate = total > 0 ? (((present + late) / total) * 100).toFixed(1) : "0";

      const positiveB = behavior.data?.filter((b: any) => b.behavior_type === "positive").length || 0;
      const negativeB = behavior.data?.filter((b: any) => b.behavior_type === "negative").length || 0;
      const totalPoints = behavior.data?.reduce((s: number, b: any) => s + (b.points || 0), 0) || 0;

      return {
        student,
        classroom: (classroom as any)?.data || null,
        rate, present, absent, late,
        positiveB, negativeB, totalPoints,
        recentBehavior: behavior.data || [],
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {data?.student?.photo_url ? (
                <img loading="lazy" decoding="async" src={data.student.photo_url} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/40" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
                  <UserIcon className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 opacity-80" />
                  <span className="text-xs font-medium opacity-80 tracking-wide uppercase">{L("นักเรียน", "Student")}</span>
                </div>
                <h1 className="text-2xl font-bold mb-1 truncate">{greeting}{displayName ? `, ${displayName}` : ""} 👋</h1>
                <p className="text-sm opacity-90 truncate">
                  {data?.student?.student_code && <span>{L("รหัส", "Code")}: {data.student.student_code} · </span>}
                  {data?.classroom && <span>{data.classroom.grade_level}/{data.classroom.name} · </span>}
                  <span className="opacity-80">{L("ปีการศึกษา", "Year")} {currentBE}</span>
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

      {!data?.student && !isLoading && (
        <Card className="border border-border/50 shadow-elevated rounded-2xl">
          <CardContent className="py-10 text-center">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {L("ยังไม่ได้เชื่อมบัญชีกับข้อมูลนักเรียน กรุณาติดต่อผู้ดูแลระบบ", "Account not linked to student profile. Please contact admin.")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI */}
      {data?.student && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (
            <>
              <MiniKpi icon={CheckCircle2} label={L("เข้าเรียน", "Attendance")} value={`${data.rate}%`} gradient="gradient-success" />
              <MiniKpi icon={XCircle} label={L("ขาดเรียน (วัน)", "Absent (days)")} value={data.absent} gradient="gradient-warning" />
              <MiniKpi icon={Heart} label={L("คะแนนพฤติกรรม", "Behavior Pts")} value={data.totalPoints} gradient="gradient-primary" />
              <MiniKpi icon={FileText} label={L("ลา (วัน)", "Leave (days)")} value={data.leaveDays} gradient="gradient-info" />
            </>
          )}
        </div>
      )}

      {/* Today schedule + Homework */}
      {data?.student && (
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
                {L("การบ้าน/งานที่ได้รับมอบหมาย", "Homework Assignments")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.homework.length === 0 ? (
                <p className="text-muted-foreground text-xs text-center py-6">{L("ไม่มีการบ้าน", "No homework")}</p>
              ) : (
                <div className="space-y-1.5">
                  {data.homework.map((h: any) => (
                    <HomeworkRow key={h.id} h={h} lang={lang} L={L} userId={userId} studentName={`${data.student?.first_name || ""} ${data.student?.last_name || ""}`.trim() || "นักเรียน"} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* คะแนนของฉัน — กราฟใยแมงมุม 8 กลุ่มสาระ */}
      {data?.student && (
        <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
          <MyRadarWidget />
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

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">{L("ทางลัด", "Quick Actions")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: L("โปรไฟล์", "Profile"), icon: UserIcon, gradient: "gradient-primary", link: "/dashboard/profile" },
            { name: L("ขอลา", "Request Leave"), icon: FileText, gradient: "gradient-warning", link: "/dashboard/student/leave" },
            { name: L("ตารางเรียน", "Schedule"), icon: Calendar, gradient: "gradient-info", link: "/dashboard/academic/schedule" },
            { name: L("ผลการเรียน", "Transcript"), icon: BookOpen, gradient: "gradient-accent", link: "/dashboard/academic/transcript" },
          ].map(item => (
            <Card key={item.name} className="border border-border/50 shadow-elevated rounded-2xl hover:shadow-card-hover transition-all hover:-translate-y-0.5 cursor-pointer overflow-hidden group" onClick={() => navigate(item.link)}>
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

const MiniKpi = ({ icon: Icon, label, value, gradient }: any) => (
  <Card className="border border-border/50 shadow-elevated rounded-2xl overflow-hidden">
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight mt-0.5">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const isImageUrl = (u?: string | null) => !!u && /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(u);

const HomeworkRow = ({ h, lang, L, userId, studentName }: {
  h: any; lang: string; L: (t: string, e: string) => string;
  userId: string | null | undefined; studentName: string;
}) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(h.submission_text || "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const overdue = h.due_date && h.status !== "done" && new Date(h.due_date) < new Date(new Date().toDateString());
  const submitted = h.status === "done" || !!h.submitted_at;
  const reviewed = !!h.annotated_file_url;

  const submit = async () => {
    setBusy(true);
    try {
      let fileUrl: string | null = h.submission_file_url || null;
      if (file) {
        const path = sanitizeStorageKey(`homework/${h.id}/${Date.now()}_${file.name}`);
        const { data: up, error: upErr } = await supabase.storage.from("homework-files").upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("homework-files").createSignedUrl(up.path, 60 * 60 * 24 * 365 * 5);
        fileUrl = signed?.signedUrl || null;
      }
      const { error } = await supabase.from("task_assignments").update({
        submission_text: text.trim() || null,
        submission_file_url: fileUrl,
        submitted_at: new Date().toISOString(),
        status: "done",
      }).eq("id", h.id);
      if (error) throw error;
      toast.success(L("ส่งงานสำเร็จ", "Submitted"));
      qc.invalidateQueries({ queryKey: ["student_dashboard"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className={`flex items-start gap-2 p-2 rounded-lg ${reviewed ? "bg-primary/5 border border-primary/30" : submitted ? "bg-emerald-50 dark:bg-emerald-950/20" : overdue ? "bg-rose-50 dark:bg-rose-950/20" : "bg-muted/40"}`}>
        {reviewed ? <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          : submitted ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
          : overdue ? <XCircle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
          : <ClipboardList className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{h.title}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {h.subjects?.name_th && `${h.subjects.name_th} · `}
            {h.due_date ? `${L("ส่งภายใน", "Due")} ${new Date(h.due_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" })}` : ""}
            {submitted && ` · ${L("ส่งแล้ว", "Submitted")}`}
            {reviewed && ` · ${L("ครูตรวจแล้ว", "Reviewed")}`}
            {h.grade != null && ` · ${L("คะแนน", "Grade")}: ${h.grade}`}
          </p>
          {h.feedback && <p className="text-[10px] text-primary mt-0.5 italic truncate">💬 {h.feedback}</p>}
        </div>
        <Button size="sm" variant={submitted ? "ghost" : "outline"} className="h-7 px-2 text-[10px]" onClick={() => setOpen(true)}>
          {submitted ? L("ดู / ตอบกลับ", "View / Reply") : L("ส่งงาน", "Submit")}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{h.title}</DialogTitle></DialogHeader>
          {h.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{h.description}</p>}

          {/* Teacher's reviewed image takes priority */}
          {reviewed && isImageUrl(h.annotated_file_url) && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-primary">📝 {L("รูปที่ครูตรวจ", "Teacher's review")}</p>
              <img loading="lazy" decoding="async" src={h.annotated_file_url} alt="reviewed" className="w-full rounded border border-primary/40" />
            </div>
          )}
          {h.submission_file_url && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">{L("ไฟล์ที่ส่ง", "Your submission")}</p>
              {isImageUrl(h.submission_file_url) ? (
                <img loading="lazy" decoding="async" src={h.submission_file_url} alt="submission" className="w-full max-h-60 object-contain rounded border border-border bg-muted/30" />
              ) : (
                <a href={h.submission_file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">📎 {L("เปิดไฟล์", "Open file")}</a>
              )}
            </div>
          )}
          {h.grade != null && (
            <div className="rounded-lg bg-primary/5 border border-primary/30 p-2 text-sm">
              <span className="font-semibold">{L("คะแนน", "Grade")}: </span>{h.grade}
              {h.feedback && <p className="text-xs text-foreground mt-1">💬 {h.feedback}</p>}
            </div>
          )}

          {/* Inline conversation */}
          <div className="border-t border-border pt-2">
            <p className="text-xs font-semibold mb-1">{L("สนทนา (ตอบกลับครูได้ทันที)", "Conversation (reply inline)")}</p>
            <HomeworkReplies
              taskId={h.id}
              replies={h.replies || []}
              currentUserId={userId}
              currentRole="student"
              currentName={studentName}
              invalidateKeys={[["student_dashboard"], ["hw_submissions"]]}
              compact
            />
          </div>

          {/* Submit / re-submit area */}
          {!reviewed && (
            <div className="border-t border-border pt-2 space-y-2">
              <p className="text-xs font-semibold">{submitted ? L("แก้ไขการส่งงาน", "Update submission") : L("ส่งการบ้าน", "Submit homework")}</p>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={L("เขียนคำตอบ / หมายเหตุ...", "Write your answer / note...")} rows={3} />
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Button onClick={submit} disabled={busy} className="w-full" size="sm">
                <Upload className="w-3.5 h-3.5 mr-1" />
                {busy ? L("กำลังส่ง...", "Sending...") : submitted ? L("ส่งใหม่", "Resubmit") : L("ส่งงาน", "Submit")}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{L("ปิด", "Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentDashboard;