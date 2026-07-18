import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, TrendingDown, TrendingUp, AlertTriangle, Award, Users2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface BehaviorRecord {
  id: string;
  student_id: string;
  behavior_type: "positive" | "negative";
  description?: string | null;
  points?: number | null;
  record_date?: string | null;
  recorded_by?: string | null;
  students?: any;
}

interface Props {
  records: BehaviorRecord[];
  startingPoints: number;
  topicCatalog: { value: string; label: string }[];
  showRecorder?: boolean;
}

const colors = ["hsl(var(--primary))", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)", "hsl(217 91% 60%)", "hsl(280 65% 60%)", "hsl(160 60% 45%)", "hsl(24 95% 53%)", "hsl(330 75% 55%)"];

export default function BehaviorReportDashboard({ records, startingPoints, topicCatalog, showRecorder }: Props) {
  const topicLabel = useMemo(
    () => Object.fromEntries(topicCatalog.map((t) => [t.label, t.label])),
    [topicCatalog],
  );

  const extractTopic = (desc?: string | null) => {
    if (!desc) return "อื่นๆ";
    const m = /^\[([^\]]+)\]/.exec(desc);
    return (m && topicLabel[m[1]]) || m?.[1] || "อื่นๆ";
  };

  /** by topic */
  const byTopic = useMemo(() => {
    const map = new Map<string, { topic: string; pos: number; neg: number; net: number; count: number }>();
    for (const r of records) {
      const t = extractTopic(r.description);
      const cur = map.get(t) || { topic: t, pos: 0, neg: 0, net: 0, count: 0 };
      const p = r.points || 0;
      if (r.behavior_type === "positive") { cur.pos += p; cur.net += p; }
      else { cur.neg += p; cur.net -= p; }
      cur.count += 1;
      map.set(t, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [records]);

  /** by classroom */
  const byClassroom = useMemo(() => {
    const map = new Map<string, { key: string; classroom: string; grade: string; pos: number; neg: number; count: number; students: Set<string> }>();
    for (const r of records) {
      const cls = r.students?.classrooms;
      const key = cls ? `${cls.grade_level || ""}|${cls.name || ""}` : "-";
      const cur = map.get(key) || { key, classroom: cls?.name || "—", grade: cls?.grade_level || "—", pos: 0, neg: 0, count: 0, students: new Set<string>() };
      const p = r.points || 0;
      if (r.behavior_type === "positive") cur.pos += p; else cur.neg += p;
      cur.count += 1;
      if (r.student_id) cur.students.add(r.student_id);
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((x) => ({ ...x, students: x.students.size }))
      .sort((a, b) => b.neg - a.neg || b.count - a.count);
  }, [records]);

  /** per student aggregates */
  const perStudent = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of records) {
      const sid = r.student_id; if (!sid) continue;
      const s = r.students || {};
      const cur = map.get(sid) || {
        id: sid,
        code: s.student_code || "",
        name: `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim(),
        classroom: s.classrooms?.name || "",
        grade: s.classrooms?.grade_level || "",
        pos: 0, neg: 0, count: 0,
      };
      const p = r.points || 0;
      if (r.behavior_type === "positive") cur.pos += p; else cur.neg += p;
      cur.count += 1;
      map.set(sid, cur);
    }
    return Array.from(map.values()).map((s) => ({ ...s, balance: startingPoints + s.pos - s.neg }));
  }, [records, startingPoints]);

  const topRisk = useMemo(() => [...perStudent].filter(s => s.neg > 0).sort((a, b) => b.neg - a.neg).slice(0, 10), [perStudent]);
  const topShine = useMemo(() => [...perStudent].filter(s => s.pos > 0).sort((a, b) => b.pos - a.pos).slice(0, 10), [perStudent]);

  /** by recorder (teacher) */
  const byRecorder = useMemo(() => {
    const map = new Map<string, { recorder: string; pos: number; neg: number; net: number; count: number; students: Set<string> }>();
    for (const r of records) {
      const name = (r.recorded_by || "").trim();
      if (!name) continue; // ข้ามรายการที่ไม่มีชื่อครูผู้บันทึก (ข้อมูลเก่าก่อนบังคับใส่ชื่อ)
      const cur = map.get(name) || { recorder: name, pos: 0, neg: 0, net: 0, count: 0, students: new Set<string>() };
      const p = r.points || 0;
      if (r.behavior_type === "positive") { cur.pos += p; cur.net += p; }
      else { cur.neg += p; cur.net -= p; }
      cur.count += 1;
      if (r.student_id) cur.students.add(r.student_id);
      map.set(name, cur);
    }
    return Array.from(map.values()).map((x) => ({ ...x, students: x.students.size })).sort((a, b) => b.count - a.count);
  }, [records]);


  const maxTopicCount = Math.max(1, ...byTopic.map((t) => t.count));

  const pieData = byTopic.map((t) => ({ name: t.topic, value: t.count }));

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-card bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15 text-primary"><Activity className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">บันทึกทั้งหมด</p>
              <p className="text-2xl font-bold">{records.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card bg-gradient-to-br from-success/10 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/15 text-success"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">นักเรียนได้คะแนนดี</p>
              <p className="text-2xl font-bold text-success">{topShine.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card bg-gradient-to-br from-destructive/10 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/15 text-destructive"><TrendingDown className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">นักเรียนถูกหักคะแนน</p>
              <p className="text-2xl font-bold text-destructive">{topRisk.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card bg-gradient-to-br from-warning/10 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/15 text-warning"><Users2 className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">นักเรียนถูกบันทึก</p>
              <p className="text-2xl font-bold">{perStudent.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />คะแนนตามหัวข้อ สพฐ.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byTopic} margin={{ left: 0, right: 8, top: 4, bottom: 30 }}>
                  <XAxis dataKey="topic" interval={0} tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="pos" name="เพิ่ม" fill="hsl(142 71% 45%)" />
                  <Bar dataKey="neg" name="หัก" fill="hsl(0 84% 60%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />สัดส่วนหัวข้อ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(d) => `${d.name} (${d.value})`}>
                    {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topic table */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">สรุปตามหัวข้อ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>หัวข้อ</TableHead>
                  <TableHead className="text-right">ครั้ง</TableHead>
                  <TableHead className="text-right text-success">+ เพิ่ม</TableHead>
                  <TableHead className="text-right text-destructive">− หัก</TableHead>
                  <TableHead className="text-right">สุทธิ</TableHead>
                  <TableHead className="min-w-[140px]">ความถี่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byTopic.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">ไม่มีข้อมูล</TableCell></TableRow>}
                {byTopic.map((t) => (
                  <TableRow key={t.topic}>
                    <TableCell className="font-medium">{t.topic}</TableCell>
                    <TableCell className="text-right">{t.count}</TableCell>
                    <TableCell className="text-right text-success">+{t.pos}</TableCell>
                    <TableCell className="text-right text-destructive">−{t.neg}</TableCell>
                    <TableCell className={`text-right font-semibold ${t.net >= 0 ? "text-success" : "text-destructive"}`}>{t.net >= 0 ? "+" : ""}{t.net}</TableCell>
                    <TableCell><Progress value={(t.count / maxTopicCount) * 100} className="h-2" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* By classroom + Top lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="border-0 shadow-card lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users2 className="w-4 h-4" />สรุปรายห้อง</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ห้อง</TableHead>
                  <TableHead className="text-right">นร.</TableHead>
                  <TableHead className="text-right text-success">+</TableHead>
                  <TableHead className="text-right text-destructive">−</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {byClassroom.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">—</TableCell></TableRow>}
                  {byClassroom.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="text-sm">{c.grade} {c.classroom}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{c.students}</TableCell>
                      <TableCell className="text-right text-success text-sm">+{c.pos}</TableCell>
                      <TableCell className="text-right text-destructive text-sm">−{c.neg}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" />ถูกหักคะแนนสูงสุด</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>นักเรียน</TableHead>
                  <TableHead className="text-right">หัก</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {topRisk.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">—</TableCell></TableRow>}
                  {topRisk.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.code} · {s.grade} {s.classroom}</div>
                      </TableCell>
                      <TableCell className="text-right text-destructive font-semibold">−{s.neg}</TableCell>
                      <TableCell className={`text-right font-semibold ${s.balance >= startingPoints * 0.7 ? "text-success" : s.balance >= startingPoints * 0.4 ? "text-warning" : "text-destructive"}`}>{s.balance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-success" />ได้คะแนนดีสูงสุด</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>นักเรียน</TableHead>
                  <TableHead className="text-right">เพิ่ม</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {topShine.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">—</TableCell></TableRow>}
                  {topShine.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.code} · {s.grade} {s.classroom}</div>
                      </TableCell>
                      <TableCell className="text-right text-success font-semibold">+{s.pos}</TableCell>
                      <TableCell className="text-right font-semibold">{s.balance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By recorder (admin/director only) */}
      {showRecorder && (
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 className="w-4 h-4" />สรุปตามครูผู้บันทึก
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>ครูผู้บันทึก</TableHead>
                    <TableHead className="text-right">ครั้ง</TableHead>
                    <TableHead className="text-right">นร.</TableHead>
                    <TableHead className="text-right text-success">+ เพิ่ม</TableHead>
                    <TableHead className="text-right text-destructive">− หัก</TableHead>
                    <TableHead className="text-right">สุทธิ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byRecorder.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">ไม่มีข้อมูล</TableCell></TableRow>
                  )}
                  {byRecorder.map((r, i) => (
                    <TableRow key={r.recorder}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.recorder}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{r.students}</TableCell>
                      <TableCell className="text-right text-success">+{r.pos}</TableCell>
                      <TableCell className="text-right text-destructive">−{r.neg}</TableCell>
                      <TableCell className={`text-right font-semibold ${r.net >= 0 ? "text-success" : "text-destructive"}`}>{r.net >= 0 ? "+" : ""}{r.net}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
