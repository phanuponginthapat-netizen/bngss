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
  latest: number;
  previous: number;
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
  if (!latest) return { subject, status: "stable", latest: 0, previous: 0 };
  if (!previous) return { subject, status: "stable", latest: latest.avg_score, previous: 0 };
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

  const { data: allScores = [], isLoading } = useQuery({
    queryKey: ["trend-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_scores" as any)
        .select("academic_year, subject, score")
        .order("academic_year", { ascending: true });
      if (error) throw error;
      const raw = (data || []) as { academic_year: number; subject: string; score: number }[];
      const grouped: Record<string, TrendRow> = {};
      for (const r of raw) {
        const key = `${r.academic_year}-${r.subject}`;
        if (!grouped[key]) {
          grouped[key] = { academic_year: r.academic_year, subject: r.subject, avg_score: 0, student_count: 0 };
        }
        grouped[key].avg_score += r.score;
        grouped[key].student_count += 1;
      }
      return Object.values(grouped).map((g) => ({
        ...g,
        avg_score: g.student_count ? Math.round((g.avg_score / g.student_count) * 100) / 100 : 0,
      }));
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
      const row: Record<string, number | string> = { academic_year: String(year) };
      for (const subj of visibleSubjects) {
        const match = allScores.find((r) => r.academic_year === year && r.subject === subj);
        row[subj] = match ? match.avg_score : 0;
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
              <div className="text-2xl font-bold">{s.latest}</div>
              <p className="text-xs text-muted-foreground">
                {s.previous > 0 ? `${s.previous} → ` : ""}{statusLabel(s.status)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
