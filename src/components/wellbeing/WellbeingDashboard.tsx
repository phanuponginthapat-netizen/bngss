import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Users, HeartPulse, Compass, Info, FileDown, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie, Legend, LineChart, Line,
} from "recharts";
import { RISK_META, APTITUDE_AREAS, type RiskLevel } from "@/lib/wellbeingTools";
import { useHomeroomClassrooms } from "@/hooks/useHomeroomClassrooms";

interface StudentJoin {
  first_name: string; last_name: string; student_code: string | null; classroom_id: string | null;
  classrooms?: { name: string; grade_level: string | null } | null;
}
interface MentalRow {
  id: string; tool: string; total_score: number; risk_level: string; created_at: string;
  student_id: string; students?: StudentJoin | null;
}
interface CareerRow { id: string; top_areas: string[]; student_id: string; created_at: string; students?: StudentJoin | null }

const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS_TH[Number(m) - 1]} ${String(Number(y) + 543).slice(-2)}`;
};

export default function WellbeingDashboard() {
  const { homeroomClassroomIds, isFiltered, hasHomeroom, teacherFullName } = useHomeroomClassrooms();
  const [gradeFilter, setGradeFilter] = useState("all");
  const [classroomFilter, setClassroomFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["wellbeing-dashboard"],
    queryFn: async () => {
      const sJoin = "students(first_name,last_name,student_code,classroom_id,classrooms(name,grade_level))";
      const [m, c] = await Promise.all([
        supabase
          .from("mental_health_assessments")
          .select(`id, tool, total_score, risk_level, created_at, student_id, ${sJoin}`)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("career_aptitude_assessments")
          .select(`id, top_areas, student_id, created_at, ${sJoin}`)
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);
      return {
        mental: (m.data || []) as unknown as MentalRow[],
        career: (c.data || []) as unknown as CareerRow[],
      };
    },
  });

  const allMental = data?.mental ?? [];
  const allCareer = data?.career ?? [];

  // ครูประจำชั้นเห็นเฉพาะห้องของตน / ผู้บริหารเห็นทั้งหมด
  const inScope = <T extends { students?: StudentJoin | null }>(r: T) => {
    const cid = r.students?.classroom_id ?? null;
    if (isFiltered && homeroomClassroomIds && (!cid || !homeroomClassroomIds.includes(cid))) return false;
    if (gradeFilter !== "all" && r.students?.classrooms?.grade_level !== gradeFilter) return false;
    if (classroomFilter !== "all" && cid !== classroomFilter) return false;
    return true;
  };

  const mental = useMemo(() => allMental.filter(inScope), [allMental, isFiltered, homeroomClassroomIds, gradeFilter, classroomFilter]);
  const career = useMemo(() => allCareer.filter(inScope), [allCareer, isFiltered, homeroomClassroomIds, gradeFilter, classroomFilter]);

  // ตัวเลือกระดับชั้น/ห้องเรียน จากข้อมูลที่มีอยู่ (จำกัดตามสิทธิ์)
  const scopedRows = useMemo(() => {
    const rows = [...allMental, ...allCareer].filter((r) => {
      const cid = r.students?.classroom_id ?? null;
      return !(isFiltered && homeroomClassroomIds && (!cid || !homeroomClassroomIds.includes(cid)));
    });
    return rows;
  }, [allMental, allCareer, isFiltered, homeroomClassroomIds]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    scopedRows.forEach((r) => { const g = r.students?.classrooms?.grade_level; if (g) set.add(g); });
    return Array.from(set).sort();
  }, [scopedRows]);

  const classroomOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; grade: string | null }>();
    scopedRows.forEach((r) => {
      const cid = r.students?.classroom_id;
      const cls = r.students?.classrooms;
      if (cid && cls && !map.has(cid)) map.set(cid, { id: cid, name: cls.name, grade: cls.grade_level ?? null });
    });
    return Array.from(map.values())
      .filter((c) => gradeFilter === "all" || c.grade === gradeFilter)
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [scopedRows, gradeFilter]);

  const riskCounts = useMemo(() => {
    const keys: RiskLevel[] = ["normal", "mild", "moderate", "severe"];
    return keys.map((k) => ({
      key: k, name: RISK_META[k].label,
      value: mental.filter((r) => r.risk_level === k).length,
      color: RISK_META[k].color,
    }));
  }, [mental]);

  const byTool = useMemo(() => {
    return ["2Q", "9Q", "8Q", "ST5"].map((t) => ({
      tool: t,
      ทั้งหมด: mental.filter((r) => r.tool === t).length,
      เฝ้าระวัง: mental.filter((r) => r.tool === t && (r.risk_level === "moderate" || r.risk_level === "severe")).length,
    }));
  }, [mental]);

  // สรุปรายชั้นเรียน: จำนวนผู้เข้าร่วม / กลุ่มเฝ้าระวัง / อัตราการทำแบบวัดแวว
  const byClassroom = useMemo(() => {
    const map = new Map<string, { name: string; participants: Set<string>; atRisk: Set<string>; career: Set<string>; assessments: number }>();
    const ensure = (r: { students?: StudentJoin | null }) => {
      const name = r.students?.classrooms?.name ?? "ไม่ระบุห้อง";
      if (!map.has(name)) map.set(name, { name, participants: new Set(), atRisk: new Set(), career: new Set(), assessments: 0 });
      return map.get(name)!;
    };
    mental.forEach((r) => {
      const e = ensure(r);
      e.participants.add(r.student_id);
      e.assessments += 1;
      if (r.risk_level === "moderate" || r.risk_level === "severe") e.atRisk.add(r.student_id);
    });
    career.forEach((r) => {
      const e = ensure(r);
      e.participants.add(r.student_id);
      e.career.add(r.student_id);
    });
    return Array.from(map.values())
      .map((e) => ({
        name: e.name,
        ผู้เข้าร่วม: e.participants.size,
        เฝ้าระวัง: e.atRisk.size,
        วัดแววอาชีพ: e.career.size,
        assessments: e.assessments,
      }))
      .sort((a, b) => b.ผู้เข้าร่วม - a.ผู้เข้าร่วม);
  }, [mental, career]);

  // แนวโน้มตามเวลา (รายเดือน 12 เดือนล่าสุด)
  const trend = useMemo(() => {
    const map = new Map<string, { key: string; ประเมินสุขภาพจิต: number; วัดแววอาชีพ: number; เฝ้าระวัง: number }>();
    const ensure = (k: string) => {
      if (!map.has(k)) map.set(k, { key: k, ประเมินสุขภาพจิต: 0, วัดแววอาชีพ: 0, เฝ้าระวัง: 0 });
      return map.get(k)!;
    };
    mental.forEach((r) => {
      const e = ensure(monthKey(r.created_at));
      e.ประเมินสุขภาพจิต += 1;
      if (r.risk_level === "moderate" || r.risk_level === "severe") e.เฝ้าระวัง += 1;
    });
    career.forEach((r) => { ensure(monthKey(r.created_at)).วัดแววอาชีพ += 1; });
    return Array.from(map.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12)
      .map((e) => ({ ...e, month: monthLabel(e.key) }));
  }, [mental, career]);

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

  const trendChartRef = useRef<HTMLDivElement | null>(null);
  const classChartRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const scopeLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(gradeFilter === "all" ? "ทุกระดับชั้น" : gradeFilter);
    const cls = classroomOptions.find((c) => c.id === classroomFilter);
    parts.push(cls ? `ห้อง ${cls.name}` : "ทุกห้อง");
    if (isFiltered && hasHomeroom) parts.push(`(ครูประจำชั้น: ${teacherFullName})`);
    return parts.join(" · ");
  }, [gradeFilter, classroomFilter, classroomOptions, isFiltered, hasHomeroom, teacherFullName]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { generateWellbeingReportPdf } = await import("@/lib/wellbeingReportPdf");
      await generateWellbeingReportPdf({
        scopeLabel,
        stats: [
          { label: "นักเรียนที่เข้าร่วม", value: uniqueStudents },
          { label: "ประเมินสุขภาพจิต", value: mental.length },
          { label: "วัดแววอาชีพ", value: career.length },
          { label: "กลุ่มเฝ้าระวัง", value: atRisk.length },
        ],
        chartNodes: [
          { title: "แนวโน้มการประเมินรายเดือน (12 เดือนล่าสุด)", node: trendChartRef.current },
          { title: "สรุปรายชั้นเรียน", node: classChartRef.current },
        ],
        classroomRows: byClassroom.map((c) => ({
          name: c.name,
          participants: c.ผู้เข้าร่วม,
          assessments: c.assessments,
          career: c.วัดแววอาชีพ,
          atRisk: c.เฝ้าระวัง,
        })),
        riskRows: riskCounts.map((r) => ({ name: r.name, value: r.value })),
        toolRows: byTool.map((t) => ({ tool: t.tool, total: t.ทั้งหมด, watch: t.เฝ้าระวัง })),
        atRiskRows: atRisk.map((r) => ({
          name: `${r.students?.first_name ?? ""} ${r.students?.last_name ?? ""}`.trim() || "-",
          classroom: r.students?.classrooms?.name ?? "-",
          tool: r.tool,
          score: r.total_score,
          risk: RISK_META[r.risk_level as RiskLevel]?.label ?? r.risk_level,
          date: new Date(r.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }),
        })),
      });
      toast.success("สร้างรายงาน PDF เรียบร้อย");
    } catch (e) {
      console.error(e);
      toast.error("สร้างรายงาน PDF ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">กำลังโหลดข้อมูล...</div>;

  const stats = [
    { icon: Users, label: "นักเรียนที่เข้าร่วมประเมิน", value: uniqueStudents, tone: "text-primary" },
    { icon: HeartPulse, label: "แบบประเมินสุขภาพจิตทั้งหมด", value: mental.length, tone: "text-rose-500" },
    { icon: Compass, label: "แบบวัดแววอาชีพทั้งหมด", value: career.length, tone: "text-amber-500" },
    { icon: AlertTriangle, label: "รายที่ต้องเฝ้าระวัง", value: atRisk.length, tone: "text-red-500" },
  ];

  return (
    <div className="space-y-5">
      {isFiltered && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
          <div>
            {hasHomeroom
              ? <>กำลังแสดงเฉพาะนักเรียนในห้องประจำชั้นของ <b>{teacherFullName}</b></>
              : <>ยังไม่ได้ตั้งห้องประจำชั้นให้คุณ — กรุณาแจ้งผู้ดูแลระบบ</>}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 max-w-2xl">
          <div>
            <div className="text-xs text-muted-foreground mb-1">ระดับชั้น</div>
            <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setClassroomFilter("all"); }}>
              <SelectTrigger><SelectValue placeholder="ทุกระดับชั้น" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">ห้องเรียน</div>
            <Select value={classroomFilter} onValueChange={setClassroomFilter}>
              <SelectTrigger><SelectValue placeholder="ทุกห้อง" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">ทุกห้อง</SelectItem>
                {classroomOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader><CardTitle className="text-base">แนวโน้มการประเมินรายเดือน (12 เดือนล่าสุด)</CardTitle></CardHeader>
        <CardContent ref={trendChartRef} className="h-[320px]">
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลสำหรับช่วงที่เลือก</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ประเมินสุขภาพจิต" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="วัดแววอาชีพ" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="เฝ้าระวัง" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">สรุปรายชั้นเรียน</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {byClassroom.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลสำหรับช่วงที่เลือก</p>
          ) : (
            <>
              <div ref={classChartRef} style={{ height: Math.max(220, byClassroom.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byClassroom} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ผู้เข้าร่วม" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="วัดแววอาชีพ" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="เฝ้าระวัง" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">ห้องเรียน</th>
                      <th className="py-2 pr-3 text-right">ผู้เข้าร่วม</th>
                      <th className="py-2 pr-3 text-right">ครั้งที่ประเมิน</th>
                      <th className="py-2 pr-3 text-right">วัดแววอาชีพ</th>
                      <th className="py-2 text-right">เฝ้าระวัง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byClassroom.map((c) => (
                      <tr key={c.name} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{c.name}</td>
                        <td className="py-2 pr-3 text-right">{c.ผู้เข้าร่วม}</td>
                        <td className="py-2 pr-3 text-right">{c.assessments}</td>
                        <td className="py-2 pr-3 text-right">{c.วัดแววอาชีพ}</td>
                        <td className="py-2 text-right">
                          {c.เฝ้าระวัง > 0
                            ? <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">{c.เฝ้าระวัง}</Badge>
                            : <span className="text-muted-foreground">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
        <CardHeader><CardTitle className="text-base">แววอาชีพเด่นของนักเรียน (ตามกลุ่มที่เลือก)</CardTitle></CardHeader>
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
