import { fetchAllRows } from "@/lib/fetchAllRows";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const SUBJECTS = [
  "คณิตศาสตร์", "วิทยาศาสตร์", "ภาษาไทย", "ภาษาอังกฤษ",
  "สังคมศึกษา", "พลศึกษา", "ศิลปะ", "การงานอาชีพ",
];

type TrendRow = {
  academic_year: number;
  subject: string;
  avg_score: number;
  student_count: number;
};

type SummaryCard = {
  subject: string;
  status: "improving" | "declining" | "stable";
  latest: number | null;
  previous: number | null;
};

const CHART_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ea580c", "#8b5cf6", "#0891b2", "#d946ef", "#65a30d",
];

function analyzeTrend(rows: TrendRow[], subject: string): SummaryCard {
  const filtered = rows
    .filter((r) => r.subject === subject)
    .sort((a, b) => a.academic_year - b.academic_year);
  const latest = filtered[filtered.length - 1];
  const previous = filtered[filtered.length - 2];
  if (!latest) return { subject, status: "stable", latest: null, previous: null };
  if (!previous) return { subject, status: "stable", latest: latest.avg_score, previous: null };
  const diff = latest.avg_score - previous.avg_score;
  return {
    subject,
    status: diff > 1 ? "improving" : diff < -1 ? "declining" : "stable",
    latest: latest.avg_score,
    previous: previous.avg_score,
  };
}

const statusIcon = (s: "improving" | "declining" | "stable") => {
  if (s === "improving") return <TrendingUp className="h-5 w-5 text-green-600" />;
  if (s === "declining") return <TrendingDown className="h-5 w-5 text-red-600" />;
  return <Minus className="h-5 w-5 text-muted-foreground" />;
};

const statusLabel = (s: "improving" | "declining" | "stable") => {
  if (s === "improving") return "ดีขึ้น";
  if (s === "declining") return "ลดลง";
  return "คงที่";
};

export default function TrendAnalyticsPage() {
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  const { data: allScores = [], isLoading, error: readError, refetch } = useQuery({
    queryKey: ["trend-analytics"],
    queryFn: async () => {
      const rows = await fetchAllRows((from,to)=>supabase.from("student_scores").select("academic_year,total_score,subjects(name_th)").not("academic_year","is",null).not("semester","is",null).not("total_score","is",null).order("id").range(from,to));
      const grouped = new Map<string, TrendRow>();
      rows.forEach(r=> {
        const subject = (r.subjects as {name_th:string} | null)?.name_th;
        if (!subject || r.total_score === null || !Number.isFinite(Number(r.total_score))) return;
        const key = `${r.academic_year}:${subject}`;
        const slot = grouped.get(key) ?? {academic_year:Number(r.academic_year),subject,avg_score:0,student_count:0};
        slot.avg_score += Number(r.total_score); slot.student_count += 1; grouped.set(key,slot);
      });
      return [...grouped.values()].map(r=>({...r,avg_score:Math.round(r.avg_score/r.student_count*100)/100}));

    },
  });

  const years = useMemo(() => [...new Set(allScores.map((r) => r.academic_year))].sort(), [allScores]);

  const visibleSubjects = useMemo(() => {
    if (selectedSubject === "all") {
      return [...new Set(allScores.map((r) => r.subject))];
    }
    return [selectedSubject];
  }, [allScores, selectedSubject]);

  const chartData = useMemo(() => {
    return years.map((year) => {
      const row: Record<string, number | string | null> = { academic_year: String(year) };
      for (const subj of visibleSubjects) {
        const match = allScores.find((r) => r.academic_year === year && r.subject === subj);
        row[subj] = match ? match.avg_score : null;
      }
      return row;
    });
  }, [years, visibleSubjects, allScores]);

  const summaries = useMemo(() => {
    const subjects = selectedSubject === "all"
      ? [...new Set(allScores.map((r) => r.subject))]
      : [selectedSubject];
    return subjects.map((s) => analyzeTrend(allScores, s));
  }, [allScores, selectedSubject]);

  if (readError) return <div role="alert" className="p-6">อ่านแนวโน้มคะแนนไม่สำเร็จ <Button variant="outline" onClick={() => void refetch()}>ลองใหม่</Button></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6" />
        <h1 className="text-2xl font-bold">สถิติแนวโน้มผลการเรียน</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>เลือกวิชา</CardTitle>
          <CardDescription>แสดงกราฟแนวโน้มคะแนนเฉลี่ยตามปีการศึกษา</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกวิชา</SelectItem>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>กราฟแนวโน้มคะแนนเฉลี่ย</CardTitle>
          <CardDescription>คะแนนเฉลี่ยแยกตามวิชาและปีการศึกษา</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">ไม่มีข้อมูล</p>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="academic_year" />
                <YAxis />
                <Tooltip />
                <Legend />
                {visibleSubjects.map((subj, idx) => (
                  <Line
                    key={subj}
                    type="monotone"
                    dataKey={subj}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaries.map((s) => (
          <Card key={s.subject}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{s.subject}</CardTitle>
              {statusIcon(s.status)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.latest ?? "—"}</div>
              <p className="text-xs text-muted-foreground">
                {s.previous !== null ? `${s.previous} → ` : ""}{s.previous === null ? "ข้อมูลเปรียบเทียบไม่ครบ" : statusLabel(s.status)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
