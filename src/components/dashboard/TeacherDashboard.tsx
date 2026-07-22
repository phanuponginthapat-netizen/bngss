import { useState, lazy, Suspense } from "react";
import { todayBangkok } from "@/lib/dateBE";
const DynamicHeroBackground = lazy(() => import("./DynamicHeroBackground"));
const MascotHeroWidget = lazy(() => import("./widgets/MascotHeroWidget"));
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useHomeroomClassrooms } from "@/hooks/useHomeroomClassrooms";
import { useUserRole } from "@/hooks/useUserRole";
import { toBE } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users, BookOpen, UserCheck, Clock, Heart, CheckCircle2, XCircle,
  ClipboardList, ArrowRight, Sparkles, Calendar, Bell,
  GraduationCap, FileText, Home, AlertTriangle, Activity,
  ListTodo, Plus, Thermometer, Wind,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { TeacherTasksPanel } from "./TeacherTasksPanel";
import AnnotateImageDialog from "@/components/homework/AnnotateImageDialog";
import HomeworkReplies from "@/components/homework/HomeworkReplies";
import { TeacherDailyBriefing } from "./TeacherDailyBriefing";
import { useWeatherData } from "@/hooks/useWeatherData";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import GpsTrackingCard from "@/components/GpsTrackingCard";

interface SubjectItem {
  id: string;
  name_th?: string | null;
  code?: string | null;
  grade_level?: string | null;
  classrooms?: { id: string; name: string; grade_level?: string | null }[];
}

const SubjectTabsNav = ({
  hasHomeroom,
  classroomName,
  subjects,
  activeTab,
  onChange,
}: {
  hasHomeroom: boolean;
  classroomName: string;
  subjects: SubjectItem[];
  activeTab: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const activeSubject = subjects.find((s) => `subject-${s.id}` === activeTab);
  const subjectActive = !!activeSubject;

  // group by grade level
  const grouped = subjects.reduce<Record<string, SubjectItem[]>>((acc, s) => {
    const g = s.grade_level || "อื่น ๆ";
    (acc[g] = acc[g] || []).push(s);
    return acc;
  }, {});
  const gradeOrder = Object.keys(grouped).sort();

  const subjectSummary = activeSubject
    ? `${activeSubject.name_th || activeSubject.code}${
        activeSubject.classrooms?.length
          ? ` · ${activeSubject.classrooms.map((c) => c.name).join(", ")}`
          : ""
      }`
    : `เลือกวิชาที่สอน (${subjects.length})`;

  const inactiveBtn = "bg-muted text-foreground border border-border/60 hover:bg-primary/10 hover:border-primary/40 hover:text-primary";
  const activeBtn = "gradient-primary text-primary-foreground border border-primary shadow-elevated";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
      {hasHomeroom && (
        <button
          type="button"
          onClick={() => onChange("homeroom")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
            activeTab === "homeroom" ? activeBtn : inactiveBtn
          )}
        >
          <Home className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ประจำชั้น</span>
          <span>{classroomName}</span>
        </button>
      )}

      {subjects.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all min-w-[220px] justify-between flex-1 max-w-md",
                subjectActive ? activeBtn : inactiveBtn
              )}
            >
              <span className="inline-flex items-center gap-1.5 truncate">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{subjectSummary}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[360px] p-0 z-[1000] shadow-2xl border-border"
            align="start"
            sideOffset={6}
          >
            <Command>
              <CommandInput placeholder="ค้นหาวิชา / รหัสวิชา / ห้อง..." />
              <CommandList className="max-h-[380px]">
                <CommandEmpty>ไม่พบวิชา</CommandEmpty>
                {gradeOrder.map((grade) => (
                  <CommandGroup key={grade} heading={grade}>
                    {grouped[grade].map((s) => {
                      const isActive = `subject-${s.id}` === activeTab;
                      return (
                        <CommandItem
                          key={s.id}
                          value={`${s.name_th || ""} ${s.code || ""} ${(s.classrooms || []).map((c) => c.name).join(" ")}`}
                          onSelect={() => {
                            onChange(`subject-${s.id}`);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex items-start gap-2 py-2",
                            isActive && "bg-primary/10 text-foreground"
                          )}
                        >
                          <Check className={cn("w-4 h-4 mt-0.5 shrink-0", isActive ? "opacity-100 text-primary" : "opacity-0")} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate text-foreground">
                              {s.name_th || s.code}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1 mt-0.5">
                              {s.code && <span>{s.code}</span>}
                              {(s.classrooms || []).map((c) => (
                                <span key={c.id} className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[10px]">
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      <button
        type="button"
        onClick={() => onChange("tasks")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ml-auto",
          activeTab === "tasks" ? activeBtn : inactiveBtn
        )}
      >
        <ListTodo className="w-3.5 h-3.5" />
        <span>ภาระงาน</span>
      </button>
    </div>
  );
};

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { userId } = useUserRole();
  const { homeroomClassroomIds, homeroomClassrooms, hasHomeroom } = useHomeroomClassrooms();
  const currentBE = toBE(new Date().getFullYear());
  const weather = useWeatherData();

  const { data: myPersonnel } = useQuery({
    queryKey: ["my_personnel_dashboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name, department, position")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  // Homeroom data
  const { data: homeroomData, isLoading: homeroomLoading } = useQuery({
    queryKey: ["homeroom_dashboard", homeroomClassroomIds],
    enabled: hasHomeroom && !!homeroomClassroomIds?.length,
    queryFn: async () => {
      const classIds = homeroomClassroomIds!;
      const { data: studentList } = await supabase.from("students")
        .select("id, prefix, first_name, last_name, gender, status, student_code, photo_url")
        .in("classroom_id", classIds).eq("status", "active");
      const studentIds = (studentList || []).map(s => s.id);

      const today = todayBangkok();
      const [attendance, behavior, leaves, homeVisits, sdq, faceLogs, lateSetting] = await Promise.all([
        supabase.from("attendance").select("id, status, student_id").in("student_id", studentIds).eq("attendance_date", today),
        supabase.from("behavior_records").select("id, behavior_type, description, record_date")
          .in("student_id", studentIds).order("record_date", { ascending: false }).limit(10),
        supabase.from("student_leaves").select("id, status").in("student_id", studentIds),
        supabase.from("home_visits").select("id").in("classroom_id", classIds),
        supabase.from("sdq_records").select("id").in("student_id", studentIds),
        supabase.from("face_scan_logs").select("student_id, scan_time").in("student_id", studentIds).eq("scan_date", today),
        supabase.from("school_settings").select("setting_value").eq("setting_key", "face_scan_late_threshold").maybeSingle(),
      ]);

      const lateThreshold = (lateSetting.data?.setting_value as string) || "08:00";
      const statusByStudent = new Map<string, "present" | "late" | "absent">();
      attendance.data?.forEach((a: any) => {
        if (a.student_id && (a.status === "present" || a.status === "late" || a.status === "absent")) {
          statusByStudent.set(a.student_id, a.status);
        }
      });
      const firstScan = new Map<string, Date>();
      (faceLogs.data || []).forEach((x: any) => {
        const t = new Date(x.scan_time);
        const prev = firstScan.get(x.student_id);
        if (!prev || t < prev) firstScan.set(x.student_id, t);
      });
      const fmtHHMM = (d: Date) => new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(d);
      firstScan.forEach((t, sid) => {
        if (statusByStudent.has(sid)) return;
        statusByStudent.set(sid, fmtHHMM(t) > lateThreshold ? "late" : "present");
      });

      const totalStu = studentList?.length || 0;
      const present = Array.from(statusByStudent.values()).filter(s => s === "present").length;
      const late = Array.from(statusByStudent.values()).filter(s => s === "late").length;
      const explicitAbsent = Array.from(statusByStudent.values()).filter(s => s === "absent").length;
      const absent = Math.max(explicitAbsent, totalStu - present - late);
      const totalAtt = Math.max(totalStu, present + late + explicitAbsent);
      const rate = totalAtt > 0 ? ((present / totalAtt) * 100) : 0;
      const maleCount = studentList?.filter(s => s.gender === "ช" || s.gender === "ชาย" || s.gender === "male").length || 0;

      return {
        students: studentList || [],
        studentCount: studentList?.length || 0,
        maleCount,
        femaleCount: (studentList?.length || 0) - maleCount,
        attendanceRate: rate.toFixed(1),
        attChart: [
          { name: "มาเรียน", value: present, fill: "hsl(var(--success))" },
          { name: "ขาดเรียน", value: absent, fill: "hsl(var(--destructive))" },
          { name: "มาสาย", value: late, fill: "hsl(var(--warning))" },
        ].filter(d => d.value > 0),
        pendingLeaves: leaves.data?.filter(l => l.status === "pending").length || 0,
        positiveB: behavior.data?.filter(b => b.behavior_type === "positive").length || 0,
        negativeB: behavior.data?.filter(b => b.behavior_type === "negative").length || 0,
        homeVisitCount: homeVisits.data?.length || 0,
        sdqCount: sdq.data?.length || 0,
      };
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Subject assignments
  const { data: subjectData, isLoading: subjectLoading } = useQuery({
    queryKey: ["subject_dashboard", myPersonnel?.id],
    enabled: !!myPersonnel,
    queryFn: async () => {
      const fullName = `${myPersonnel!.prefix || ""}${myPersonnel!.first_name} ${myPersonnel!.last_name}`;
      const { data: assignments } = await supabase
        .from("teacher_assignments")
        .select("subject_id, classroom_id, subjects(*), classrooms(*)")
        .eq("personnel_id", myPersonnel!.id);

      const uniqueSubjects = new Map<string, any>();
      (assignments || []).forEach(a => {
        if (a.subjects && !uniqueSubjects.has(a.subject_id)) {
          uniqueSubjects.set(a.subject_id, {
            ...a.subjects,
            classrooms: (assignments || []).filter(x => x.subject_id === a.subject_id).map(x => x.classrooms).filter(Boolean),
          });
        }
      });

      const [schedules, news, events] = await Promise.all([
        // ★ ใช้ teacher_id เป็นหลัก, fallback ด้วย teacher_name สำหรับแถวเก่า
        supabase.from("schedules").select("id, day_of_week, period, start_time, end_time, classroom_id, subject_id, teacher_id, teacher_name")
          .or(`teacher_id.eq.${myPersonnel!.id},teacher_name.eq.${fullName}`),
        supabase.from("news_posts").select("id, title, category, published_at")
          .eq("is_published", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("academic_events").select("id, title, event_date, event_type")
          .gte("event_date", todayBangkok()).order("event_date").limit(5),
      ]);

      // Get enrollment counts per subject
      const subjectIds = [...uniqueSubjects.keys()];
      let enrollmentMap: Record<string, number> = {};
      if (subjectIds.length) {
        const { data: enrollments } = await supabase.from("enrollments")
          .select("subject_id").in("subject_id", subjectIds).eq("status", "active");
        (enrollments || []).forEach(e => {
          enrollmentMap[e.subject_id] = (enrollmentMap[e.subject_id] || 0) + 1;
        });
      }

      return {
        subjects: [...uniqueSubjects.values()],
        enrollmentMap,
        todaySchedules: (schedules.data || []).filter(s => s.day_of_week === new Date().getDay()),
        allSchedules: schedules.data || [],
        news: news.data || [],
        events: events.data || [],
      };
    },
  });

  const isLoading = homeroomLoading || subjectLoading;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "สวัสดีตอนเช้า";
    if (h < 17) return "สวัสดีตอนบ่าย";
    return "สวัสดีตอนเย็น";
  };

  const displayName = myPersonnel
    ? `${myPersonnel.prefix || ""}${myPersonnel.first_name} ${myPersonnel.last_name}`
    : "";

  const classroomName = homeroomClassrooms?.[0]
    ? (homeroomClassrooms[0] as any).name
    : "";

  const defaultTab = hasHomeroom
    ? "homeroom"
    : (subjectData?.subjects?.[0] ? `subject-${subjectData.subjects[0].id}` : "tasks");

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  // Keep activeTab valid once data loads
  if (activeTab === "tasks" && defaultTab !== "tasks" && !isLoading) {
    // no-op; user chose tasks explicitly
  }


  return (
    <div className="space-y-6">
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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 opacity-80" />
                <span className="text-xs font-medium opacity-80 tracking-wide uppercase">
                  {hasHomeroom ? "ครูประจำชั้น" : "ครูผู้สอน"}
                </span>
              </div>
              <h1 className="text-2xl font-bold mb-1">{getGreeting()}{displayName ? `, ${displayName}` : ""} 👋</h1>
              <p className="text-sm opacity-90">
                {hasHomeroom && classroomName && <span>ประจำชั้น {classroomName} · </span>}
                <span className="opacity-80">ปีการศึกษา {currentBE}</span>
              </p>
            </div>

            {/* Weather Widget */}
            {weather.hasCoords && !weather.isLoading && weather.temperature !== null && (
              <div className="hidden sm:flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5">
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

      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <MascotHeroWidget />
      </Suspense>

      {/* Daily Briefing */}
      <TeacherDailyBriefing
        userId={userId}
        personnelId={myPersonnel?.id}
        personnelFullName={displayName || undefined}
        homeroomClassroomIds={homeroomClassroomIds}
      />

      {/* Tabs */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  ห้องเรียนและวิชาของฉัน
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTab === "homeroom" && "ภาพรวมห้องประจำชั้น – นักเรียน, การมาเรียน, และงานที่ต้องดูแล"}
                  {activeTab.startsWith("subject-") && "รายละเอียดวิชา – ตารางสอน, ห้องที่สอน, และสั่งการบ้าน"}
                  {activeTab === "tasks" && "รวมภาระงานทั้งหมด – งานที่นักเรียนส่ง และงานที่รอตรวจ"}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                เลือกหัวข้อจากปุ่มด้านล่าง
              </span>
            </div>
            <SubjectTabsNav
              hasHomeroom={hasHomeroom}
              classroomName={classroomName}
              subjects={subjectData?.subjects || []}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>



          {/* Homeroom Tab */}
          {hasHomeroom && (
            <TabsContent value="homeroom">
              <HomeroomTabContent data={homeroomData} navigate={navigate} />
            </TabsContent>
          )}

          {/* Subject Tabs */}
          {(subjectData?.subjects || []).map((subject: any) => (
            <TabsContent key={subject.id} value={`subject-${subject.id}`}>
              <SubjectTabContent
                subject={subject}
                enrollmentCount={subjectData?.enrollmentMap?.[subject.id] || 0}
                schedules={(subjectData?.allSchedules || []).filter((s: any) => s.subject_id === subject.id)}
                navigate={navigate}
                personnelId={myPersonnel?.id}
                userId={userId}
              />
            </TabsContent>
          ))}

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <TeacherTasksPanel userId={userId} personnelId={myPersonnel?.id} />
          </TabsContent>
        </Tabs>
      )}

      {/* GPS warm-up & live location */}
      <GpsTrackingCard />

      {/* News + Events */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        <Card onClick={() => navigate("/dashboard/admin/news")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="w-3 h-3 text-primary" />
              </div>
              <span className="text-xs font-semibold text-foreground">ข่าวสารล่าสุด</span>
            </div>
            {subjectData?.news?.length ? (
              <div className="space-y-0.5">
                {subjectData.news.slice(0, 4).map((n: any) => (
                  <button
                    type="button"
                    key={n.id}
                    onClick={(e) => { e.stopPropagation(); navigate(`/news/${n.id}`); }}
                    className="w-full text-left flex items-center gap-2 py-1 hover:bg-muted/40 rounded px-1"
                  >
                    <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    <span className="text-[11px] text-foreground truncate leading-tight">{n.title}</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-[11px] text-center py-6">ยังไม่มีข่าวสาร</p>}
          </CardContent>
        </Card>
        <Card onClick={() => navigate("/dashboard/academic/calendar")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg gradient-warning flex items-center justify-center">
                <Calendar className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold text-foreground">กิจกรรมที่กำลังจะมาถึง</span>
            </div>
            {subjectData?.events?.length ? (
              <div className="space-y-1">
                {subjectData.events.slice(0, 4).map((e: any) => (
                  <div key={e.id} className="flex items-center gap-2 py-1">
                    <div className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {new Date(e.event_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    </div>
                    <span className="text-[11px] text-foreground truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-[11px] text-center py-6">ไม่มีกิจกรรม</p>}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">ทางลัด</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: "ตารางสอน", icon: Calendar, gradient: "gradient-primary", link: "/dashboard/academic/schedule" },
            { name: "ลงเวลาปฏิบัติงาน", icon: Clock, gradient: "gradient-success", link: "/dashboard/hr/time-clock" },
            { name: "ขอลา", icon: FileText, gradient: "gradient-warning", link: "/dashboard/hr/leave" },
            { name: "โปรไฟล์", icon: GraduationCap, gradient: "gradient-accent", link: "/dashboard/profile" },
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

/* ── Homeroom Tab Content ── */
const HomeroomTabContent = ({ data, navigate }: { data: any; navigate: any }) => {
  if (!data) return <p className="text-muted-foreground text-sm text-center py-8">กำลังโหลด...</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKpi icon={Users} label="นักเรียน" gradient="gradient-primary" value={data.studentCount}
          sub={`ชาย ${data.maleCount} · หญิง ${data.femaleCount}`} onClick={() => navigate("/dashboard/student/attendance")} />
        <MiniKpi icon={UserCheck} label="อัตราเข้าเรียน" gradient="gradient-success" value={`${data.attendanceRate}%`}
          progress={parseFloat(data.attendanceRate)} onClick={() => navigate("/dashboard/student/face-scan?tab=report")} />
        <MiniKpi icon={CheckCircle2} label="พฤติกรรมดี" gradient="gradient-accent" value={data.positiveB}
          sub={`เชิงลบ ${data.negativeB}`} onClick={() => navigate("/dashboard/student/behavior")} />
        <MiniKpi icon={Clock} label="ใบลารอดำเนินการ" gradient="gradient-warning" value={data.pendingLeaves}
          onClick={() => navigate("/dashboard/student/leave")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card onClick={() => navigate("/dashboard/student/attendance")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-success flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              สถิติการเข้าเรียน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.attChart?.length ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data.attChart} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {data.attChart.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-1">
                  {data.attChart.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-muted-foreground">{d.name} <span className="font-semibold text-foreground">({d.value})</span></span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-muted-foreground text-sm text-center py-12">ยังไม่มีข้อมูล</p>}
          </CardContent>
        </Card>

        <Card onClick={() => navigate("/dashboard/hub/student-health")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                <Heart className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              ระบบดูแลนักเรียน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickLink icon={ClipboardList} label="SDQ ที่ทำแล้ว" value={data.sdqCount} onClick={() => navigate("/dashboard/student/sdq")} />
            <QuickLink icon={Home} label="เยี่ยมบ้าน" value={data.homeVisitCount} onClick={() => navigate("/dashboard/student/home-visit")} />
            <QuickLink icon={CheckCircle2} label="พฤติกรรมดี" value={data.positiveB} color="text-success" onClick={() => navigate("/dashboard/student/behavior")} />
            <QuickLink icon={XCircle} label="พฤติกรรมเชิงลบ" value={data.negativeB} color="text-destructive" onClick={() => navigate("/dashboard/student/behavior")} />
            <QuickLink icon={FileText} label="บันทึกโฮมรูม" onClick={() => navigate("/dashboard/student/homeroom")} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ── Subject Tab Content (with homework assignment) ── */
const SubjectTabContent = ({ subject, enrollmentCount, schedules, navigate, personnelId, userId }: {
  subject: any; enrollmentCount: number; schedules: any[]; navigate: any; personnelId?: string; userId?: string | null;
}) => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [hwTitle, setHwTitle] = useState("");
  const [hwDesc, setHwDesc] = useState("");
  const [hwDue, setHwDue] = useState("");
  const [hwClassroom, setHwClassroom] = useState("");

  const todaySchedules = schedules.filter(s => s.day_of_week === new Date().getDay());
  const DAY_NAMES = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

  // Homework assigned for this subject
  const { data: homeworkList = [] } = useQuery({
    queryKey: ["subject_homework", subject.id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("*")
        .eq("subject_id", subject.id)
        .eq("assigned_by", userId!)
        .eq("task_type", "homework")
        .order("created_at", { ascending: false })
        .limit(30);
      // Group by title+due_date (one row per student under the hood)
      const seen = new Map<string, any>();
      (data || []).forEach((t: any) => {
        const key = `${t.title}-${t.due_date}`;
        if (!seen.has(key)) {
          seen.set(key, { ...t, _count: 1, _submitted: t.submitted_at ? 1 : 0, _ids: [t.id] });
        } else {
          const g = seen.get(key);
          g._count++;
          if (t.submitted_at) g._submitted++;
          g._ids.push(t.id);
        }
      });
      return [...seen.values()];
    },
  });

  const handleAssignHomework = async () => {
    if (!hwTitle.trim()) { toast.error("กรุณากรอกชื่อการบ้าน"); return; }
    if (!hwClassroom) { toast.error("กรุณาเลือกห้องเรียน"); return; }
    if (!userId) return;

    const { data: students } = await supabase.from("students")
      .select("id, auth_user_id").eq("classroom_id", hwClassroom).eq("status", "active");

    const rows = (students || []).map(s => ({
      task_type: "homework" as const,
      title: hwTitle.trim(),
      description: hwDesc.trim() || null,
      assigned_by: userId,
      assigned_to_user_id: s.auth_user_id || null,
      assigned_to_student_id: s.id,
      subject_id: subject.id,
      classroom_id: hwClassroom,
      due_date: hwDue || null,
      status: "pending" as const,
    }));

    if (rows.length === 0) { toast.error("ไม่พบนักเรียนในห้องเรียนนี้"); return; }

    const { error } = await supabase.from("task_assignments").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`สั่งการบ้านให้นักเรียน ${rows.length} คนสำเร็จ`);

    qc.invalidateQueries({ queryKey: ["subject_homework"] });
    setCreateOpen(false);
    setHwTitle(""); setHwDesc(""); setHwDue(""); setHwClassroom("");
  };

  return (
    <div className="space-y-4">
      {/* Subject Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKpi icon={BookOpen} label="รหัสวิชา" gradient="gradient-primary" value={subject.code} sub={`${subject.credits || 0} หน่วยกิต`} />
        <MiniKpi icon={GraduationCap} label="ระดับชั้น" gradient="gradient-accent" value={subject.grade_level || "-"} />
        <MiniKpi icon={Users} label="นักเรียนลงทะเบียน" gradient="gradient-success" value={enrollmentCount} />
        <MiniKpi icon={Calendar} label="คาบสอน/สัปดาห์" gradient="gradient-warning" value={schedules.length} sub={`วันนี้ ${todaySchedules.length} คาบ`} />
      </div>

      {/* Classrooms taught */}
      {subject.classrooms?.length > 0 && (
        <Card onClick={() => navigate("/dashboard/academic/management")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">ห้องเรียนที่สอน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {subject.classrooms.map((c: any) => (
                <Badge key={c.id} variant="secondary" className="text-xs">{c.name} ({c.grade_level})</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule */}
      {schedules.length > 0 && (
        <Card onClick={() => navigate("/dashboard/academic/schedule")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> ตารางสอนรายวิชานี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {schedules.sort((a, b) => a.day_of_week - b.day_of_week || a.period - b.period).map((sch: any) => (
                <div key={sch.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {DAY_NAMES[sch.day_of_week]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">คาบที่ {sch.period}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {sch.start_time && sch.end_time ? `${sch.start_time} - ${sch.end_time}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Homework Section */}
      <Card className="border border-border/50 shadow-elevated rounded-2xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <ListTodo className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            การบ้าน / งานที่สั่ง
          </CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> สั่งการบ้าน</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>สั่งการบ้าน - {subject.name_th || subject.code}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>ชื่อการบ้าน</Label>
                  <Input value={hwTitle} onChange={e => setHwTitle(e.target.value)} placeholder="เช่น ใบงานบทที่ 3" />
                </div>
                <div>
                  <Label>รายละเอียด</Label>
                  <Textarea value={hwDesc} onChange={e => setHwDesc(e.target.value)} placeholder="อธิบายงาน..." rows={3} />
                </div>
                <div>
                  <Label>ห้องเรียน</Label>
                  <Select value={hwClassroom} onValueChange={setHwClassroom}>
                    <SelectTrigger><SelectValue placeholder="เลือกห้องเรียน" /></SelectTrigger>
                    <SelectContent>
                      {(subject.classrooms || []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>กำหนดส่ง</Label>
                  <BEDatePicker value={hwDue} onChange={(v) => setHwDue(v)} />
                </div>
                <Button onClick={handleAssignHomework} className="w-full">มอบหมายการบ้าน</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {homeworkList.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">ยังไม่มีการบ้านที่สั่ง</p>
          ) : (
            <div className="space-y-2">
              {homeworkList.map((hw: any) => (
                <div key={hw.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{hw.title}</p>
                    <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>สั่งเมื่อ: {new Date(hw.assigned_date).toLocaleDateString("th-TH")}</span>
                      {hw.due_date && <span>· กำหนดส่ง: {new Date(hw.due_date).toLocaleDateString("th-TH")}</span>}
                    </div>
                  </div>
                  <Badge className={`border-0 text-[10px] ${
                    hw._submitted === hw._count ? "bg-success/10 text-success"
                      : hw._submitted > 0 ? "bg-primary/10 text-primary"
                      : "bg-warning/10 text-warning"
                  }`}>
                    ส่งแล้ว {hw._submitted}/{hw._count}
                  </Badge>
                  <HomeworkSubmissionsDialog title={hw.title} ids={hw._ids} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ── Sub-components ── */
interface MiniKpiProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  progress?: number;
  onClick?: () => void;
}

const MiniKpi = ({ icon: Icon, label, value, sub, gradient, progress, onClick }: MiniKpiProps) => (
  <Card
    className={`border border-border/50 shadow-elevated rounded-2xl overflow-hidden ${onClick ? "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5" : ""} transition-all`}
    onClick={onClick}
  >
    <CardContent className="p-3">
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-xl ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
          <p className="text-lg font-bold text-foreground leading-tight mt-0.5">{value}</p>
          {progress !== undefined && <Progress value={progress} className="h-1 mt-1.5" />}
          {sub && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

interface QuickLinkProps {
  icon: React.ComponentType<any>;
  label: string;
  value?: number;
  color?: string;
  onClick?: () => void;
}

const QuickLink = ({ icon: Icon, label, value, color, onClick }: QuickLinkProps) => (
  <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} className="flex items-center justify-between w-full text-sm hover:bg-muted/40 rounded-lg px-2 py-1.5 transition-colors">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className={`w-3.5 h-3.5 ${color || ""}`} /> {label}
    </div>
    <div className="flex items-center gap-1">
      {value !== undefined && <span className={`font-semibold ${color || "text-foreground"}`}>{value}</span>}
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
    </div>
  </button>
);

/* ── Homework submissions viewer / grader / annotator ── */
const isImageUrl = (u?: string | null) => !!u && /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(u);

const HomeworkSubmissionsDialog = ({ title, ids }: { title: string; ids: string[] }) => {
  const qc = useQueryClient();
  const { userId } = useUserRole();
  const [open, setOpen] = useState(false);
  const [annotateFor, setAnnotateFor] = useState<{ id: string; url: string; existing: string | null } | null>(null);

  const { data: subs = [] } = useQuery({
    queryKey: ["hw_submissions", ids.join(",")],
    enabled: open && ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("id, title, description, due_date, submission_text, submission_file_url, annotated_file_url, submitted_at, grade, feedback, status, assigned_to_student_id, replies, students:assigned_to_student_id(prefix, first_name, last_name, student_code)")
        .in("id", ids)
        .order("submitted_at", { ascending: false, nullsFirst: false });
      return data || [];
    },
  });

  const saveGrade = async (id: string, grade: string, feedback: string) => {
    const g = grade === "" ? null : Number(grade);
    if (grade !== "" && Number.isNaN(g)) { toast.error("คะแนนไม่ถูกต้อง"); return; }
    const { error } = await supabase.from("task_assignments").update({ grade: g, feedback: feedback || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกคะแนนแล้ว");
    qc.invalidateQueries({ queryKey: ["hw_submissions"] });
    qc.invalidateQueries({ queryKey: ["subject_homework"] });
  };

  const saveAnnotated = async (id: string, url: string) => {
    const { error } = await supabase.from("task_assignments").update({ annotated_file_url: url }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["hw_submissions"] });
  };

  const detail = subs[0];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]">ดู / ตรวจ</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>การส่งงาน: {title}</DialogTitle></DialogHeader>
          {detail && (detail.description || detail.due_date) && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">รายละเอียดงานที่ครูสั่ง</div>
              {detail.description && <p className="whitespace-pre-wrap text-muted-foreground">{detail.description}</p>}
              {detail.due_date && <p className="text-xs font-medium text-foreground">กำหนดส่ง {new Date(detail.due_date).toLocaleDateString("th-TH")}</p>}
            </div>
          )}
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีนักเรียนคนใดส่งงาน</p>
          ) : (
            <div className="space-y-3">
              {subs.map((s: any) => {
                const displayUrl = s.annotated_file_url || s.submission_file_url;
                const canAnnotate = isImageUrl(s.submission_file_url);
                return (
                  <div key={s.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">
                        {s.students ? `${s.students.prefix || ""}${s.students.first_name} ${s.students.last_name}` : "นักเรียน"}
                        <span className="text-xs text-muted-foreground ml-2">{s.students?.student_code}</span>
                      </div>
                      <Badge className={`text-[10px] border-0 shrink-0 ${s.submitted_at ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                        {s.submitted_at ? `ส่งแล้ว ${new Date(s.submitted_at).toLocaleString("th-TH")}` : "ยังไม่ส่ง"}
                      </Badge>
                    </div>
                    {s.submission_text && <p className="text-xs whitespace-pre-wrap bg-muted/30 rounded p-2">{s.submission_text}</p>}
                    {displayUrl && (
                      <div className="space-y-1">
                        {isImageUrl(displayUrl) ? (
                          <img src={displayUrl} alt="submission" className="max-h-72 rounded border border-border object-contain bg-muted/30" />
                        ) : (
                          <a href={displayUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">📎 ดูไฟล์ที่แนบ</a>
                        )}
                        {s.annotated_file_url && <p className="text-[10px] text-success">✓ ตรวจแล้ว (แสดงรูปที่ครูตรวจ)</p>}
                      </div>
                    )}
                    {canAnnotate && (
                      <Button size="sm" variant="outline" onClick={() => setAnnotateFor({ id: s.id, url: s.submission_file_url, existing: s.annotated_file_url })}>
                        🖍️ {s.annotated_file_url ? "แก้ไขการตรวจ" : "ตรวจรูป (ขีด / วง / ใส่ข้อความ)"}
                      </Button>
                    )}
                    {s.submitted_at && (
                      <GradeRow id={s.id} grade={s.grade ?? ""} feedback={s.feedback ?? ""} onSave={saveGrade} />
                    )}
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground mb-1">ตอบกลับ (เห็นได้ทั้งครูและนักเรียน)</p>
                      <HomeworkReplies
                        taskId={s.id}
                        replies={(s.replies || []) as any}
                        currentUserId={userId}
                        currentRole="teacher"
                        currentName="ครู"
                        invalidateKeys={[["hw_submissions"], ["student_dashboard"]]}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {annotateFor && (
        <AnnotateImageDialog
          open={!!annotateFor}
          onOpenChange={(v) => { if (!v) setAnnotateFor(null); }}
          imageUrl={annotateFor.url}
          initialAnnotatedUrl={annotateFor.existing}
          onSaved={(url) => saveAnnotated(annotateFor.id, url)}
        />
      )}
    </>
  );
};

const GradeRow = ({ id, grade, feedback, onSave }: {
  id: string; grade: number | string; feedback: string;
  onSave: (id: string, grade: string, feedback: string) => void;
}) => {
  const [g, setG] = useState<string>(grade === null ? "" : String(grade));
  const [f, setF] = useState<string>(feedback || "");
  return (
    <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-end pt-2 border-t border-border/50">
      <div className="flex-1">
        <Label className="text-[10px]">คะแนน</Label>
        <Input type="number" step="0.01" value={g} onChange={(e) => setG(e.target.value)} placeholder="เช่น 10" className="h-8" />
      </div>
      <div className="flex-[2]">
        <Label className="text-[10px]">คำแนะนำ</Label>
        <Input value={f} onChange={(e) => setF(e.target.value)} placeholder="ความเห็นถึงนักเรียน" className="h-8" />
      </div>
      <Button size="sm" onClick={() => onSave(id, g, f)}>บันทึกคะแนน</Button>
    </div>
  );
};

export default TeacherDashboard;
