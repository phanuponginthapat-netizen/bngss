import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, HeartPulse, Compass } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { RISK_META, APTITUDE_AREAS, areaMeta, type RiskLevel } from "@/lib/wellbeingTools";

interface MentalRow {
  id: string; tool: string; total_score: number; risk_level: string; created_at: string;
  student_id: string;
  students?: { first_name: string; last_name: string; student_code: string | null; classrooms?: { name: string } | null } | null;
}
interface CareerRow { id: string; top_areas: string[]; student_id: string }

export default function WellbeingDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["wellbeing-dashboard"],
    queryFn: async () => {
      const [m, c] = await Promise.all([
        supabase
          .from("mental_health_assessments")
          .select("id, tool, total_score, risk_level, created_at, student_id, students(first_name,last_name,student_code,classrooms(name))")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("career_aptitude_assessments").select("id, top_areas, student_id").limit(1000),
      ]);
      return {
        mental: (m.data || []) as unknown as MentalRow[],
        career: (c.data || []) as unknown as CareerRow[],
      };
    },
  });

  const mental = data?.mental ?? [];
  const career = data?.career ?? [];

  const riskCounts = useMemo(() => {
    const keys: RiskLevel[] = ["normal", "mild", "moderate", "severe"];
    return keys.map((k) => ({
      key: k,
      name: RISK_META[k].label,
      value: mental.filter((r) => r.risk_level === k).length,
      color: RISK_META[k].color,
    }));
  }, [mental]);

  const byTool = useMemo(() => {
    const tools = ["2Q", "9Q", "8Q", "ST5"];
    return tools.map((t) => ({
      tool: t,
      ทั้งหมด: mental.filter((r) => r.tool === t).length,
      เฝ้าระวัง: mental.filter((r) => r.tool === t && (r.risk_level === "moderate" || r.risk_level === "severe")).length,
    }));
  }, [mental]);

  const aptitudeDist = useMemo(() => {
    const counts: Record<string, number> = {};
    career.forEach((r) => (r.top_areas || []).forEach((k) => { counts[k] = (counts[k] || 0) + 1; }));
    return APTITUDE_AREAS.map((a) => ({ name: `${a.emoji} ${a.name}`, value: counts[a.key] || 0, color: a.color }));
  }, [career]);

  const atRisk = useMemo(() => {
    const seen = new Set<string>();
    return mental
      .filter((r) => r.risk_level === "moderate" || r.risk_level === "severe")
      .filter((r) => (seen.has(r.student_id) ? false : (seen.add(r.student_id), true)))
      .slice(0, 25);
  }, [mental]);

  const uniqueStudents = new Set([...mental.map((r) => r.student_id), ...career.map((r) => r.student_id)]).size;

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">กำลังโหลดข้อมูล...</div>;

  const stats = [
    { icon: Users, label: "นักเรียนที่เข้าร่วมประเมิน", value: uniqueStudents, tone: "text-primary" },
    { icon: HeartPulse, label: "แบบประเมินสุขภาพจิตทั้งหมด", value: mental.length, tone: "text-rose-500" },
    { icon: Compass, label: "แบบวัดแววอาชีพทั้งหมด", value: career.length, tone: "text-amber-500" },
    { icon: AlertTriangle, label: "รายที่ต้องเฝ้าระวัง", value: atRisk.length, tone: "text-red-500" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.tone}`} />
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">สัดส่วนระดับความเสี่ยงด้านสุขภาพจิต</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskCounts} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label>
                  {riskCounts.map((e) => <Cell key={e.key} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">จำนวนการประเมินแยกตามเครื่องมือ</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTool}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tool" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ทั้งหมด" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="เฝ้าระวัง" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">แววอาชีพเด่นของนักเรียนทั้งโรงเรียน</CardTitle></CardHeader>
        <CardContent className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aptitudeDist} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {aptitudeDist.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> รายชื่อนักเรียนที่ควรติดตามดูแล
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {atRisk.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีนักเรียนในกลุ่มเฝ้าระวัง</p>}
          {atRisk.map((r) => {
            const meta = RISK_META[(r.risk_level as RiskLevel)] ?? RISK_META.normal;
            const s = r.students;
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <div className="font-medium">{s ? `${s.first_name} ${s.last_name}` : "ไม่ทราบชื่อ"}</div>
                  <div className="text-xs text-muted-foreground">
                    {s?.student_code ?? "-"} • {s?.classrooms?.name ?? "-"} • {r.tool} {r.total_score} คะแนน •{" "}
                    {new Date(r.created_at).toLocaleDateString("th-TH", { dateStyle: "medium" })}
                  </div>
                </div>
                <Badge className={meta.badge}>{meta.emoji} {meta.label}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
