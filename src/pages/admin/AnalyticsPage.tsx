import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, GraduationCap, ClipboardList, FileText, TrendingUp, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--muted-foreground))", "#f59e0b", "#10b981"];

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  totalClassrooms: number;
  totalEforms: number;
  attendanceToday: { present: number; absent: number; late: number; leave: number };
  studentsByGrade: { grade: string; count: number }[];
  attendance30d: { date: string; present: number; absent: number }[];
  behavior30d: { type: string; count: number }[];
}

export default function AnalyticsPage() {
  const { data: stats, isLoading: loading, isError, error, refetch } = useQuery<Stats>({
    queryKey: ["analytics-summary"],
    queryFn: async () => {
      const today = todayBangkok();
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const [studentsRes, personnelRes, classroomsRes, eformsRes, todayAttRes, allAttRes, behaviorRes] = await Promise.all([
        supabase.from("students").select("id, classrooms:classroom_id(grade_level)", { count: "exact" }).eq("status", "active"),
        supabase.from("personnel").select("id", { count: "exact", head: true }),
        supabase.from("classrooms").select("id", { count: "exact", head: true }),
        supabase.from("eforms").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("status").eq("attendance_date", today),
        supabase.from("attendance").select("attendance_date, status").gte("attendance_date", since),
        supabase.from("behavior_records").select("behavior_type").gte("record_date", since),
      ]);

      // Surface any error so isError reflects truth
      const firstErr = [studentsRes, personnelRes, classroomsRes, eformsRes, todayAttRes, allAttRes, behaviorRes]
        .map((r: any) => r.error).find(Boolean);
      if (firstErr) throw firstErr;

      const att = { present: 0, absent: 0, late: 0, leave: 0 };
      (todayAttRes.data || []).forEach((r: any) => {
        if (att[r.status as keyof typeof att] !== undefined) att[r.status as keyof typeof att]++;
      });

      const gradeMap = new Map<string, number>();
      (studentsRes.data || []).forEach((s: any) => {
        const g = s.classrooms?.grade_level || "ไม่ระบุ";
        gradeMap.set(g, (gradeMap.get(g) || 0) + 1);
      });
      const studentsByGrade = Array.from(gradeMap.entries())
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => a.grade.localeCompare(b.grade));

      const attMap = new Map<string, { present: number; absent: number }>();
      (allAttRes.data || []).forEach((r: any) => {
        const cur = attMap.get(r.attendance_date) || { present: 0, absent: 0 };
        if (r.status === "present") cur.present++;
        else if (r.status === "absent") cur.absent++;
        attMap.set(r.attendance_date, cur);
      });
      const attendance30d = Array.from(attMap.entries())
        .map(([date, v]) => ({ date: date.slice(5), ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const behMap = new Map<string, number>();
      (behaviorRes.data || []).forEach((r: any) => {
        behMap.set(r.behavior_type, (behMap.get(r.behavior_type) || 0) + 1);
      });
      const behavior30d = Array.from(behMap.entries()).map(([type, count]) => ({ type, count }));

      return {
        totalStudents: studentsRes.count || 0,
        totalTeachers: personnelRes.count || 0,
        totalClassrooms: classroomsRes.count || 0,
        totalEforms: eformsRes.count || 0,
        attendanceToday: att,
        studentsByGrade,
        attendance30d,
        behavior30d,
      };
    },
    staleTime: 60_000,
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div className="h-8 w-64 bg-muted/60 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive/30">
          <CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
            <p className="font-semibold">ไม่สามารถโหลดข้อมูลการวิเคราะห์ได้</p>
            <p className="text-sm text-muted-foreground">{(error as any)?.message || "เกิดข้อผิดพลาดในการดึงข้อมูล"}</p>
            <button onClick={() => refetch()} className="text-sm text-primary underline">ลองใหม่อีกครั้ง</button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const attPie = [
    { name: "มาเรียน", value: stats.attendanceToday.present },
    { name: "ขาด", value: stats.attendanceToday.absent },
    { name: "สาย", value: stats.attendanceToday.late },
    { name: "ลา", value: stats.attendanceToday.leave },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> วิเคราะห์ข้อมูลโรงเรียน
        </h1>
        <p className="text-muted-foreground text-sm mt-1">ภาพรวมและแนวโน้ม 30 วันย้อนหลัง</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Users} label="นักเรียนทั้งหมด" value={stats.totalStudents} color="text-info" />
        <KPI icon={GraduationCap} label="บุคลากร" value={stats.totalTeachers} color="text-success" />
        <KPI icon={ClipboardList} label="ห้องเรียน" value={stats.totalClassrooms} color="text-warning" />
        <KPI icon={FileText} label="E-Form ทั้งหมด" value={stats.totalEforms} color="text-info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">การเข้าเรียนวันนี้</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={attPie} dataKey="value" nameKey="name" outerRadius={90} label>
                  {attPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">นักเรียนแยกตามระดับชั้น</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.studentsByGrade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> แนวโน้มการเข้าเรียน 30 วัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.attendance30d}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#10b981" name="มาเรียน" strokeWidth={2} />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" name="ขาด" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">บันทึกพฤติกรรม 30 วัน</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.behavior30d}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}