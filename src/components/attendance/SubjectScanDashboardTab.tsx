import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { BookOpen, ScanLine, Users, TrendingUp, AlertTriangle, CheckCircle2, CalendarDays } from "lucide-react";

interface Props {
  records: any[];
  students: any[];
}

const STATUS_COLORS: Record<string, string> = {
  present: "hsl(var(--success))",
  absent: "hsl(var(--destructive))",
  late: "hsl(var(--warning))",
  sick: "hsl(var(--info))",
  leave: "hsl(var(--accent))",
};

const STATUS_TH: Record<string, string> = {
  present: "มา", absent: "ขาด", late: "สาย", sick: "ป่วย", leave: "ลา",
};

export function SubjectScanDashboardTab({ records, students }: Props) {
  const { lang } = useLanguage();

  // Only subject-level records (per-period)
  const subjectRecords = useMemo(
    () => records.filter((r: any) => r.subject_id),
    [records]
  );

  const stats = useMemo(() => {
    const total = subjectRecords.length;
    const byStatus: Record<string, number> = { present: 0, absent: 0, late: 0, sick: 0, leave: 0 };
    subjectRecords.forEach((r: any) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });
    const presentRate = total ? (byStatus.present / total) * 100 : 0;
    const absentRate = total ? ((byStatus.absent + byStatus.sick + byStatus.leave) / total) * 100 : 0;
    const lateRate = total ? (byStatus.late / total) * 100 : 0;
    return { total, byStatus, presentRate, absentRate, lateRate };
  }, [subjectRecords]);

  // Daily trend (last 30 days)
  const dailyTrend = useMemo(() => {
    const byDay: Record<string, { date: string; present: number; absent: number; late: number; total: number }> = {};
    subjectRecords.forEach((r: any) => {
      const d = r.attendance_date;
      if (!d) return;
      if (!byDay[d]) byDay[d] = { date: d, present: 0, absent: 0, late: 0, total: 0 };
      byDay[d].total++;
      if (r.status === "present") byDay[d].present++;
      else if (r.status === "late") byDay[d].late++;
      else byDay[d].absent++;
    });
    return Object.values(byDay)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map(d => ({
        ...d,
        rate: d.total ? Math.round((d.present / d.total) * 100) : 0,
        label: d.date.slice(5),
      }));
  }, [subjectRecords]);

  // Top subjects
  const topSubjects = useMemo(() => {
    const bySub: Record<string, { name: string; total: number; present: number; absent: number }> = {};
    subjectRecords.forEach((r: any) => {
      const name = r.subjects?.name_th || r.subjects?.code || (lang === "th" ? "ไม่ระบุ" : "Unknown");
      if (!bySub[r.subject_id]) bySub[r.subject_id] = { name, total: 0, present: 0, absent: 0 };
      bySub[r.subject_id].total++;
      if (r.status === "present") bySub[r.subject_id].present++;
      else bySub[r.subject_id].absent++;
    });
    return Object.values(bySub)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map(s => ({ ...s, rate: s.total ? Math.round((s.present / s.total) * 100) : 0 }));
  }, [subjectRecords, lang]);

  const statusPie = useMemo(
    () => Object.entries(stats.byStatus)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: STATUS_TH[k] || k, value: v, key: k })),
    [stats]
  );

  // Watch list: students with most absents in subject scans
  const watchList = useMemo(() => {
    const byStudent: Record<string, { name: string; code: string; classroom: string; absent: number; late: number; total: number }> = {};
    subjectRecords.forEach((r: any) => {
      const id = r.student_id;
      const s = r.students;
      if (!id || !s) return;
      if (!byStudent[id]) {
        byStudent[id] = {
          name: `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim(),
          code: s.student_code || "",
          classroom: s.classrooms?.name || "",
          absent: 0, late: 0, total: 0,
        };
      }
      byStudent[id].total++;
      if (r.status === "absent" || r.status === "sick" || r.status === "leave") byStudent[id].absent++;
      if (r.status === "late") byStudent[id].late++;
    });
    return Object.values(byStudent)
      .filter(s => s.absent + s.late > 0)
      .sort((a, b) => (b.absent + b.late) - (a.absent + a.late))
      .slice(0, 10);
  }, [subjectRecords]);

  const uniqueStudents = new Set(subjectRecords.map(r => r.student_id)).size;
  const uniqueSubjects = new Set(subjectRecords.map(r => r.subject_id)).size;
  const uniqueDays = new Set(subjectRecords.map(r => r.attendance_date)).size;

  if (subjectRecords.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <ScanLine className="w-10 h-10 mx-auto mb-3 opacity-40" />
          {lang === "th" ? "ยังไม่มีข้อมูลการเช็คชื่อรายคาบวิชา" : "No per-period attendance data yet"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={lang === "th" ? "การเช็คชื่อทั้งหมด" : "Total check-ins"}
          value={stats.total.toLocaleString()}
          icon={ScanLine}
          tone="primary"
          hint={lang === "th" ? `${uniqueDays} วันที่ผ่านมา` : `${uniqueDays} days`}
        />
        <StatCard
          label={lang === "th" ? "อัตรามาเรียน" : "Present rate"}
          value={`${stats.presentRate.toFixed(1)}%`}
          icon={CheckCircle2}
          tone="success"
          hint={`${stats.byStatus.present.toLocaleString()} ${lang === "th" ? "ครั้ง" : "times"}`}
        />
        <StatCard
          label={lang === "th" ? "อัตราขาด/ป่วย/ลา" : "Absent rate"}
          value={`${stats.absentRate.toFixed(1)}%`}
          icon={AlertTriangle}
          tone="destructive"
          hint={`${(stats.byStatus.absent + stats.byStatus.sick + stats.byStatus.leave).toLocaleString()} ${lang === "th" ? "ครั้ง" : "times"}`}
        />
        <StatCard
          label={lang === "th" ? "อัตรามาสาย" : "Late rate"}
          value={`${stats.lateRate.toFixed(1)}%`}
          icon={TrendingUp}
          tone="warning"
          hint={`${stats.byStatus.late.toLocaleString()} ${lang === "th" ? "ครั้ง" : "times"}`}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label={lang === "th" ? "นักเรียนที่ถูกเช็ค" : "Unique students"}
          value={uniqueStudents}
          icon={Users}
          tone="info"
        />
        <StatCard
          label={lang === "th" ? "วิชาที่มีการเช็ค" : "Subjects covered"}
          value={uniqueSubjects}
          icon={BookOpen}
          tone="accent"
        />
        <StatCard
          label={lang === "th" ? "วันที่มีการเช็ค" : "Active days"}
          value={uniqueDays}
          icon={CalendarDays}
          tone="muted"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {lang === "th" ? "แนวโน้มการเช็คชื่อรายวัน (30 วันล่าสุด)" : "Daily trend (last 30 days)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="present" name={lang === "th" ? "มา" : "Present"} stroke={STATUS_COLORS.present} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="absent" name={lang === "th" ? "ขาด" : "Absent"} stroke={STATUS_COLORS.absent} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="late" name={lang === "th" ? "สาย" : "Late"} stroke={STATUS_COLORS.late} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-primary" />
              {lang === "th" ? "สัดส่วนสถานะ" : "Status split"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {statusPie.map((s) => (
                    <Cell key={s.key} fill={STATUS_COLORS[s.key] || "hsl(var(--muted))"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {lang === "th" ? "อันดับวิชาที่เช็คชื่อมากสุด" : "Top subjects"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSubjects} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="present" name={lang === "th" ? "มา" : "Present"} stackId="a" fill={STATUS_COLORS.present} radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent" name={lang === "th" ? "ขาด/สาย" : "Absent/Late"} stackId="a" fill={STATUS_COLORS.absent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              {lang === "th" ? "นักเรียนที่ควรติดตาม" : "Watch list"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {watchList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {lang === "th" ? "ยังไม่มีนักเรียนที่ต้องติดตาม" : "No students to watch"}
              </p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <ul className="space-y-2">
                  {watchList.map((s, i) => {
                    const pct = s.total ? Math.round(((s.absent + s.late) / s.total) * 100) : 0;
                    return (
                      <li key={s.code + i} className="flex items-center justify-between gap-3 p-2 rounded-md border bg-card">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.code} • {s.classroom}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                            {lang === "th" ? "ขาด" : "Abs"} {s.absent}
                          </Badge>
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                            {lang === "th" ? "สาย" : "Late"} {s.late}
                          </Badge>
                          <span className="text-xs font-mono tabular-nums text-muted-foreground w-10 text-right">{pct}%</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SubjectScanDashboardTab;
