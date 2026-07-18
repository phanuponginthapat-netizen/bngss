import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock, ListTodo, AlertTriangle, ArrowRight, BookOpen, MapPin, CalendarDays,
} from "lucide-react";

interface Props {
  userId?: string | null;
  personnelId?: string | null;
  personnelFullName?: string;
  homeroomClassroomIds?: string[];
}

const DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export const TeacherDailyBriefing = ({ userId, personnelId, personnelFullName, homeroomClassroomIds }: Props) => {
  const navigate = useNavigate();
  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  const dow = today.getDay();

  const { data, isLoading } = useQuery({
    queryKey: ["teacher_daily_briefing", userId, personnelId, personnelFullName, homeroomClassroomIds],
    enabled: !!userId,
    queryFn: async () => {
      // Today's schedule — ใช้ teacher_id เป็นหลัก, fallback teacher_name
      let todaySchedules: any[] = [];
      if (personnelId || personnelFullName) {
        let q = supabase
          .from("schedules")
          .select("id, period, start_time, end_time, classroom_id, subject_id, teacher_id, teacher_name, classrooms(name), subjects(name_th, code)")
          .eq("day_of_week", dow)
          .order("period", { ascending: true });
        if (personnelId && personnelFullName) {
          q = q.or(`teacher_id.eq.${personnelId},teacher_name.eq.${personnelFullName}`);
        } else if (personnelId) {
          q = q.eq("teacher_id", personnelId);
        } else if (personnelFullName) {
          q = q.eq("teacher_name", personnelFullName);
        }
        const { data: sched } = await q;
        todaySchedules = sched || [];
      }

      // Homework that needs review (pending & due on/before today)
      const { data: hwAll } = await supabase
        .from("task_assignments")
        .select("id, title, due_date, status, subject_id, classroom_id, subjects(name_th, code), classrooms(name)")
        .eq("assigned_by", userId!)
        .eq("task_type", "homework")
        .order("due_date", { ascending: true })
        .limit(200);

      // Group by title+subject+due_date so 1 row per assignment, count students pending
      const groups = new Map<string, any>();
      (hwAll || []).forEach((t) => {
        const key = `${t.title}|${t.subject_id}|${t.classroom_id}|${t.due_date}`;
        if (!groups.has(key)) {
          groups.set(key, { ...t, _pending: 0, _total: 0 });
        }
        const g = groups.get(key);
        g._total++;
        if (t.status === "pending") g._pending++;
      });
      const hwToReview = [...groups.values()]
        .filter((g) => g._pending > 0 && (!g.due_date || g.due_date <= todayISO))
        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
        .slice(0, 5);

      // Recent student issues (homeroom only)
      let issues: any[] = [];
      if (homeroomClassroomIds?.length) {
        const { data: studs } = await supabase
          .from("students")
          .select("id, prefix, first_name, last_name, classroom_id")
          .in("classroom_id", homeroomClassroomIds)
          .eq("status", "active");
        const studentIds = (studs || []).map((s) => s.id);
        const studMap = new Map((studs || []).map((s) => [s.id, s]));

        if (studentIds.length) {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString().split("T")[0];

          const [{ data: behaviors }, { data: absences }] = await Promise.all([
            supabase
              .from("behavior_records")
              .select("id, student_id, description, record_date, behavior_type")
              .in("student_id", studentIds)
              .eq("behavior_type", "negative")
              .gte("record_date", sevenDaysAgo)
              .order("record_date", { ascending: false })
              .limit(10),
            supabase
              .from("attendance")
              .select("id, student_id, status, attendance_date")
              .in("student_id", studentIds)
              .in("status", ["absent", "late"])
              .gte("attendance_date", sevenDaysAgo)
              .order("attendance_date", { ascending: false })
              .limit(20),
          ]);

          (behaviors || []).forEach((b) => {
            const s: any = studMap.get(b.student_id);
            if (!s) return;
            issues.push({
              id: `b-${b.id}`,
              kind: "behavior",
              date: b.record_date,
              studentName: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
              detail: b.description || "พฤติกรรมเชิงลบ",
            });
          });
          (absences || []).forEach((a) => {
            const s: any = studMap.get(a.student_id);
            if (!s) return;
            issues.push({
              id: `a-${a.id}`,
              kind: a.status,
              date: a.attendance_date,
              studentName: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
              detail: a.status === "absent" ? "ขาดเรียน" : "มาสาย",
            });
          });
          issues = issues
            .sort((x, y) => (y.date || "").localeCompare(x.date || ""))
            .slice(0, 6);
        }
      }

      return { todaySchedules, hwToReview, issues };
    },
  });

  return (
    <Card className="border border-border/50 shadow-elevated rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-primary-foreground" />
          </div>
          สรุปภาระงานวันนี้
          <span className="text-xs font-normal text-muted-foreground ml-1">
            · วัน{DAY_NAMES[dow]}ที่ {today.toLocaleDateString("th-TH", { day: "numeric", month: "long" })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
          {/* Today's schedule */}
          <Section
            icon={<Clock className="w-3.5 h-3.5" />}
            title="ตารางสอนวันนี้"
            count={data?.todaySchedules?.length || 0}
            onMore={() => navigate("/dashboard/academic/schedule")}
          >
            {isLoading ? (
              <SkeletonRows />
            ) : !data?.todaySchedules?.length ? (
              <Empty text="ไม่มีคาบสอนวันนี้" />
            ) : (
              <div className="space-y-1.5">
                {data.todaySchedules.map((s: any) => (
                  <button type="button" key={s.id} onClick={() => navigate("/dashboard/academic/schedule")} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] text-muted-foreground leading-none">คาบ</span>
                      <span className="text-sm font-bold text-primary leading-tight">{s.period}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {s.subjects?.name_th || s.subjects?.code || "-"}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {s.start_time && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {s.start_time?.slice(0, 8)}-{s.end_time?.slice(0, 8)}
                          </span>
                        )}
                        {s.classrooms?.name && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {s.classrooms.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* Homework to grade */}
          <Section
            icon={<ListTodo className="w-3.5 h-3.5" />}
            title="การบ้านที่ต้องตรวจ"
            count={data?.hwToReview?.length || 0}
            onMore={() => navigate("/dashboard/homework")}
          >
            {isLoading ? (
              <SkeletonRows />
            ) : !data?.hwToReview?.length ? (
              <Empty text="ไม่มีงานค้างตรวจ" />
            ) : (
              <div className="space-y-1.5">
                {data.hwToReview.map((hw: any) => (
                  <button type="button" key={hw.id} onClick={() => navigate("/dashboard/homework")} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                    <div className="w-9 h-9 rounded-lg gradient-warning flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{hw.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="truncate">
                          {hw.subjects?.name_th || hw.subjects?.code || "-"}
                          {hw.classrooms?.name ? ` · ${hw.classrooms.name}` : ""}
                        </span>
                      </div>
                    </div>
                    <Badge className="bg-warning/15 text-warning border-0 text-[10px] shrink-0">
                      {hw._pending} รอตรวจ
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* Recent student issues */}
          <Section
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            title="นักเรียนที่ต้องดูแล"
            count={data?.issues?.length || 0}
            onMore={() => navigate("/dashboard/student/behavior")}
          >
            {isLoading ? (
              <SkeletonRows />
            ) : !homeroomClassroomIds?.length ? (
              <Empty text="ไม่ได้เป็นครูประจำชั้น" />
            ) : !data?.issues?.length ? (
              <Empty text="ไม่มีปัญหาในรอบ 7 วัน" />
            ) : (
              <div className="space-y-1.5">
                {data.issues.map((i: any) => (
                  <button type="button" key={i.id} onClick={() => navigate(i.kind === "behavior" ? "/dashboard/student/behavior" : "/dashboard/student/attendance")} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      i.kind === "behavior"
                        ? "bg-destructive/15"
                        : i.kind === "absent"
                        ? "bg-destructive/10"
                        : "bg-warning/15"
                    }`}>
                      <AlertTriangle className={`w-4 h-4 ${
                        i.kind === "late" ? "text-warning" : "text-destructive"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{i.studentName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {i.detail} · {new Date(i.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>
      </CardContent>
    </Card>
  );
};

const Section = ({ icon, title, count, onMore, children }: {
  icon: React.ReactNode; title: string; count: number; onMore: () => void; children: React.ReactNode;
}) => (
  <div className="p-3">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {icon} {title}
        {count > 0 && (
          <span className="ml-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </div>
      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-muted-foreground" onClick={onMore}>
        ดูทั้งหมด <ArrowRight className="w-3 h-3 ml-0.5" />
      </Button>
    </div>
    {children}
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <p className="text-[11px] text-muted-foreground text-center py-6">{text}</p>
);

const SkeletonRows = () => (
  <div className="space-y-1.5">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
    ))}
  </div>
);

export default TeacherDailyBriefing;
