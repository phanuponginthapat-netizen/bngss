import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useUserRole } from "@/hooks/useUserRole";
import { useMyPersonnel } from "@/hooks/useMyPersonnel";
import { formatDateBE } from "@/lib/dateBE";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, LineChart, Line, Legend } from "recharts";
import {
  BookOpenCheck, FileEdit, ClipboardList, Sparkles, TrendingUp, Clock,
  CheckCircle2, AlertCircle, Users, GraduationCap, Target, Plus, ArrowRight, Award, Flame
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(215 20% 65%)",
  submitted: "hsl(45 93% 58%)",
  approved: "hsl(142 71% 45%)",
  revise_needed: "hsl(0 84% 60%)",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  submitted: "รอนิเทศ",
  approved: "อนุมัติ",
  revise_needed: "ปรับแก้",
};

export default function TeachingHubPage() {
  const { currentAcademicYear: currentYear } = useAcademicYear();
  const { isAdmin, isDirector } = useUserRole();
  const canSupervise = isAdmin || isDirector;
  const { data: myPersonnel } = useMyPersonnel();

  const [year, setYear] = useState<number>(currentYear || new Date().getFullYear() + 543);
  const [semester, setSemester] = useState<number>(1);
  const [scope, setScope] = useState<"mine" | "all">(canSupervise ? "all" : "mine");

  // Lesson plans
  const { data: plans = [] } = useQuery({
    queryKey: ["teaching-hub-plans", year, semester, scope, myPersonnel?.id],
    queryFn: async () => {
      let q = (supabase.from("lesson_plans" as any) as any)
        .select("id,unit_title,lesson_title,status,subject_id,teacher_id,hours,updated_at,submitted_at,reviewed_at,academic_year,semester")
        .eq("academic_year", year)
        .eq("semester", semester);
      if (scope === "mine" && myPersonnel?.id) q = q.eq("teacher_id", myPersonnel.id);
      const { data } = await q.order("updated_at", { ascending: false });
      return data || [];
    },
  });

  // Logbook
  const { data: logs = [] } = useQuery({
    queryKey: ["teaching-hub-logs", year, semester, scope, myPersonnel?.id],
    queryFn: async () => {
      let q = (supabase.from("teaching_logbook" as any) as any)
        .select("id,teaching_date,period,subject_id,teacher_id,topic,students_present,students_total,academic_year,semester")
        .eq("academic_year", year)
        .eq("semester", semester);
      if (scope === "mine" && myPersonnel?.id) q = q.eq("teacher_id", myPersonnel.id);
      const { data } = await q.order("teaching_date", { ascending: false }).limit(500);
      return data || [];
    },
  });

  // PA agreements (existing table)
  const { data: pa = [] } = useQuery({
    queryKey: ["teaching-hub-pa", year, scope, myPersonnel?.id],
    queryFn: async () => {
      let q = supabase.from("pa_agreements").select("id,status,total_score,result_level,personnel_id,academic_year,position_type").eq("academic_year", year);
      if (scope === "mine" && myPersonnel?.id) q = q.eq("personnel_id", myPersonnel.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Subjects lookup for chart labels
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-lookup"],
    queryFn: async () => (await supabase.from("subjects").select("id,name_th,code")).data || [],
  });

  const kpis = useMemo(() => {
    const total = plans.length;
    const approved = plans.filter((p: any) => p.status === "approved").length;
    const pending = plans.filter((p: any) => p.status === "submitted").length;
    const revise = plans.filter((p: any) => p.status === "revise_needed").length;
    const draft = plans.filter((p: any) => p.status === "draft").length;
    const totalHours = plans.reduce((s: number, p: any) => s + (p.hours || 0), 0);
    const approvalRate = total ? Math.round((approved / total) * 100) : 0;
    const logCount = logs.length;
    const today = new Date().toISOString().slice(0, 10);
    const logsToday = logs.filter((l: any) => l.teaching_date === today).length;
    const paCount = pa.length;
    const paApproved = pa.filter((p: any) => p.status === "approved" || p.status === "evaluated").length;
    return { total, approved, pending, revise, draft, totalHours, approvalRate, logCount, logsToday, paCount, paApproved };
  }, [plans, logs, pa]);

  const statusChart = useMemo(() =>
    Object.keys(STATUS_LABEL).map((s) => ({
      name: STATUS_LABEL[s],
      value: plans.filter((p: any) => p.status === s).length,
      color: STATUS_COLORS[s],
    })).filter((x) => x.value > 0),
  [plans]);

  const subjectChart = useMemo(() => {
    const map = new Map<string, number>();
    plans.forEach((p: any) => map.set(p.subject_id || "unknown", (map.get(p.subject_id || "unknown") || 0) + 1));
    return Array.from(map.entries()).map(([sid, count]) => ({
      name: subjects.find((s: any) => s.id === sid)?.name_th || subjects.find((s: any) => s.id === sid)?.code || "อื่นๆ",
      count,
    })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [plans, subjects]);

  const weeklyLogs = useMemo(() => {
    // Last 8 weeks
    const bins = new Map<string, number>();
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      bins.set(key, 0);
    }
    logs.forEach((l: any) => {
      const d = new Date(l.teaching_date);
      const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 7));
      if (diff >= 0 && diff < 8) {
        const d2 = new Date(now);
        d2.setDate(d2.getDate() - diff * 7);
        const key = `${d2.getMonth() + 1}/${d2.getDate()}`;
        bins.set(key, (bins.get(key) || 0) + 1);
      }
    });
    return Array.from(bins.entries()).reverse().map(([week, count]) => ({ week, count })).reverse();
  }, [logs]);

  const recentActivity = useMemo(() => {
    const items: Array<{ type: string; title: string; time: string; badge?: string; badgeColor?: string; icon: any }> = [];
    plans.slice(0, 5).forEach((p: any) => items.push({
      type: "plan",
      title: `${p.unit_title}${p.lesson_title ? " · " + p.lesson_title : ""}`,
      time: p.updated_at,
      badge: STATUS_LABEL[p.status],
      badgeColor: STATUS_COLORS[p.status],
      icon: FileEdit,
    }));
    logs.slice(0, 5).forEach((l: any) => items.push({
      type: "log",
      title: `${l.topic} (คาบ ${l.period ?? "-"})`,
      time: l.teaching_date,
      icon: ClipboardList,
    }));
    return items.sort((a, b) => (b.time || "").localeCompare(a.time || "")).slice(0, 8);
  }, [plans, logs]);

  return (
    <div className="space-y-6 pb-20">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground p-6 md:p-8 shadow-xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,white,transparent_50%),radial-gradient(circle_at_80%_80%,white,transparent_50%)]" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm opacity-90 mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Teaching Excellence Suite</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">งานสอนของครู</h1>
            <p className="mt-1 text-sm md:text-base opacity-90">
              แผนการจัดการเรียนรู้ · บันทึกการสอน · วPA — ครบในที่เดียว
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[140px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2].map((offset) => {
                  const y = (currentYear || new Date().getFullYear() + 543) - offset;
                  return <SelectItem key={y} value={String(y)}>ปีการศึกษา {y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Select value={String(semester)} onValueChange={(v) => setSemester(Number(v))}>
              <SelectTrigger className="w-[120px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">ภาคเรียน 1</SelectItem>
                <SelectItem value="2">ภาคเรียน 2</SelectItem>
              </SelectContent>
            </Select>
            {canSupervise && (
              <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                <SelectTrigger className="w-[130px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งโรงเรียน</SelectItem>
                  <SelectItem value="mine">ของฉัน</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="relative mt-6 flex flex-wrap gap-2">
          <Link to="/dashboard/academic/lesson-plans">
            <Button variant="secondary" className="rounded-full shadow-md gap-2">
              <Plus className="w-4 h-4" /> สร้างแผนการสอน
            </Button>
          </Link>
          <Link to="/dashboard/academic/logbook">
            <Button variant="secondary" className="rounded-full shadow-md gap-2">
              <ClipboardList className="w-4 h-4" /> บันทึกวันนี้
            </Button>
          </Link>
          <Link to="/dashboard/hr/evaluation">
            <Button variant="secondary" className="rounded-full shadow-md gap-2">
              <Award className="w-4 h-4" /> ประเมิน วPA
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          icon={<FileEdit className="w-5 h-5" />}
          label="แผนการสอน"
          value={kpis.total}
          sub={`${kpis.totalHours} คาบรวม`}
          gradient="from-blue-500/20 to-blue-500/5"
          iconColor="text-blue-500"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="อนุมัติแล้ว"
          value={kpis.approved}
          sub={`${kpis.approvalRate}% ของทั้งหมด`}
          gradient="from-emerald-500/20 to-emerald-500/5"
          iconColor="text-emerald-500"
          progress={kpis.approvalRate}
        />
        <KpiCard
          icon={<ClipboardList className="w-5 h-5" />}
          label="บันทึกการสอน"
          value={kpis.logCount}
          sub={`วันนี้ ${kpis.logsToday} รายการ`}
          gradient="from-fuchsia-500/20 to-fuchsia-500/5"
          iconColor="text-fuchsia-500"
        />
        <KpiCard
          icon={<Award className="w-5 h-5" />}
          label="ข้อตกลง วPA"
          value={kpis.paCount}
          sub={`ประเมิน ${kpis.paApproved}/${kpis.paCount}`}
          gradient="from-amber-500/20 to-amber-500/5"
          iconColor="text-amber-500"
        />
      </div>

      {/* Alerts row */}
      {(kpis.revise > 0 || kpis.pending > 0) && (
        <div className="grid md:grid-cols-2 gap-3">
          {kpis.pending > 0 && (
            <Link to="/dashboard/academic/lesson-plans?tab=review">
              <Card className="border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      {canSupervise ? `รอนิเทศ ${kpis.pending} แผน` : `แผนของคุณรอนิเทศ ${kpis.pending} แผน`}
                    </div>
                    <div className="text-xs text-amber-700/80 dark:text-amber-300/80">
                      {canSupervise ? "คลิกเพื่อไปหน้ารอนิเทศ" : "รอผู้อำนวยการ/หัวหน้าฝ่ายตรวจ"}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-600" />
                </CardContent>
              </Card>
            </Link>
          )}
          {kpis.revise > 0 && (
            <Link to="/dashboard/academic/lesson-plans?tab=mine">
              <Card className="border-red-500/40 bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-900 dark:text-red-200">
                      {kpis.revise} แผนต้องปรับแก้
                    </div>
                    <div className="text-xs text-red-700/80 dark:text-red-300/80">
                      ผู้นิเทศได้ให้ความเห็น กรุณาแก้ไขและส่งใหม่
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-red-600" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  บันทึกการสอนย้อนหลัง 8 สัปดาห์
                </div>
                <div className="text-xs text-muted-foreground">จำนวนคาบที่บันทึกต่อสัปดาห์</div>
              </div>
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyLogs}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              สถานะแผนการสอน
            </div>
            {statusChart.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {statusChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyMini text="ยังไม่มีแผน" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <div className="text-sm font-semibold flex items-center gap-2 mb-4">
              <BookOpenCheck className="w-4 h-4 text-primary" />
              แผนการสอนต่อรายวิชา (Top 8)
            </div>
            {subjectChart.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={subjectChart} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyMini text="ยังไม่มีข้อมูล" />
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary" />
              กิจกรรมล่าสุด
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {recentActivity.length === 0 && <div className="text-xs text-muted-foreground py-6 text-center">ยังไม่มีกิจกรรม</div>}
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${a.type === "plan" ? "bg-blue-500/10" : "bg-fuchsia-500/10"}`}>
                    <a.icon className={`w-3.5 h-3.5 ${a.type === "plan" ? "text-blue-500" : "text-fuchsia-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{a.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {a.time ? formatDateBE(a.time) : "-"}
                    </div>
                  </div>
                  {a.badge && (
                    <Badge className="text-[9px] px-1.5 py-0" style={{ backgroundColor: a.badgeColor + "22", color: a.badgeColor, border: `1px solid ${a.badgeColor}44` }}>
                      {a.badge}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, gradient, iconColor, progress }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string; gradient: string; iconColor: string; progress?: number;
}) {
  return (
    <Card className={`relative overflow-hidden border-border/60 bg-gradient-to-br ${gradient}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground font-medium">{label}</div>
            <div className="text-2xl md:text-3xl font-bold mt-1 tabular-nums">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
          </div>
          <div className={`w-10 h-10 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center ${iconColor} shadow-sm`}>
            {icon}
          </div>
        </div>
        {typeof progress === "number" && (
          <div className="mt-3 h-1.5 rounded-full bg-background/50 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">{text}</div>;
}
