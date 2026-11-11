import { fetchAllRows } from "@/lib/fetchAllRows";
import { weightedChartAverage } from "@/lib/chartMetrics";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Trophy, AlertTriangle, BarChart3 } from "lucide-react";
import { SUBJECT_GROUPS, type SubjectGroup } from "@/lib/obecStandards";
import { useUserRole } from "@/hooks/useUserRole";
import { BE_OFFSET } from "@/lib/dateBE";

/**
 * MyRadarWidget — กราฟใยแมงมุมคะแนนของ "นักเรียน/ลูก" คนนี้ แยกตาม 8 กลุ่มสาระ
 * เปรียบเทียบปีปัจจุบัน vs ปีก่อน
 */

function classifyGroup(subjectName: string): SubjectGroup["key"] | null {
  const n = (subjectName || "").toLowerCase();
  if (/ภาษาไทย|ไทย$|^ไทย/.test(n)) return "thai";
  if (/คณิต|math/.test(n)) return "math";
  if (/วิทย|maker|วิทยาการคำนวณ|คอมพิว|computer|เทคโนโลยี/.test(n)) return "science";
  if (/สังคม|ประวัติศาสตร์|ศาสนา|หน้าที่พลเมือง|เศรษฐ|ภูมิ/.test(n)) return "social";
  if (/สุข|พล(ะ|ศึกษา)|พ\.ศ\.|health|pe/.test(n)) return "health";
  if (/ศิลป|ดนตรี|นาฏ|art|music/.test(n)) return "art";
  if (/การงาน|อาชีพ|งานบ้าน|เกษตร|career/.test(n)) return "career";
  if (/อังกฤษ|english|จีน|chinese|ญี่ปุ่น|japanese|ภาษาต่างประเทศ|foreign/.test(n)) return "foreign";
  return null;
}



interface Props {
  /** ถ้าระบุ จะใช้ student_code นี้ตรง ๆ (เช่นกรณีผู้ปกครองเลือกลูก) */
  studentCode?: string;
}

export default function MyRadarWidget({ studentCode: propStudentCode }: Props) {
  const { currentAcademicYear: yearBE, currentSemester, isReady, error: calendarError } = useAcademicYear();
  const currentAcademicYear = yearBE - BE_OFFSET;
  const { userId } = useUserRole();

  const { data: resolvedStudentCode, error: identityError } = useQuery({
    queryKey: ["my-radar-student-code", userId],
    enabled: !propStudentCode && !!userId,
    queryFn: async () => {
      if (!userId) return undefined;
      const { data, error } = await supabase
        .from("students")
        .select("student_code")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.student_code as string | undefined;
    },
  });
  const studentCode = propStudentCode || resolvedStudentCode;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my_radar_scores", studentCode, currentAcademicYear, currentSemester],
    enabled: !!studentCode && isReady,
    queryFn: async () => {
      if (!studentCode) return [];
      const prevYear = currentAcademicYear - 1;
      const [scores, subjects] = await Promise.all([
        fetchAllRows((from, to) => supabase.from("student_scores")
          .select("subject_id,total_score,academic_year")
          .eq("student_code", studentCode)
          .in("academic_year", [currentAcademicYear, prevYear])
          .eq("semester", currentSemester)
          .not("total_score", "is", null).order("id").range(from,to)),
        fetchAllRows((from,to) => supabase.from("subjects").select("id,name_th").order("id").range(from,to)),
      ]);

      const subjectMap = new Map<string, SubjectGroup["key"]>();
      subjects.forEach((s) => {
        const g = classifyGroup(s.name_th || "");
        if (g) subjectMap.set(s.id, g);
      });

      const acc = new Map<SubjectGroup["key"], { cs: number; cn: number; ps: number; pn: number }>();
      SUBJECT_GROUPS.forEach((g) => acc.set(g.key, { cs: 0, cn: 0, ps: 0, pn: 0 }));

      scores.forEach((r) => {
        const key = subjectMap.get(r.subject_id);
        if (!key) return;
        const slot = acc.get(key);
        if (!slot) return;
        const v = Number(r.total_score) || 0;
        if (r.academic_year === currentAcademicYear) { slot.cs += v; slot.cn += 1; }
        else if (r.academic_year === prevYear) { slot.ps += v; slot.pn += 1; }
      });

      return SUBJECT_GROUPS.map((g) => {
        const s = acc.get(g.key) ?? {cs:0,cn:0,ps:0,pn:0};
        return {
          key: g.key,
          metric: g.name.length > 12 ? g.name.slice(0, 10) + "…" : g.name,
          current: s.cn ? Math.round((s.cs / s.cn) * 10) / 10 : null,
          previous: s.pn ? Math.round((s.ps / s.pn) * 10) / 10 : null,
          currentCount: s.cn, previousCount: s.pn,
        };
      });
    },
    staleTime: 5 * 60_000,
  });

  const readError = error || calendarError || identityError;
  const rows = readError || !isReady ? [] : data ?? [];
  const hasData = rows.some(r => r.currentCount > 0 || r.previousCount > 0);
  const withScores = rows.filter((r): r is typeof r & {current:number} => r.current !== null);
  const top = [...withScores].sort((a,b)=>b.current-a.current)[0];
  const low = [...withScores].sort((a,b)=>a.current-b.current)[0];
  const overallCurrent = weightedChartAverage(rows.map(r=>({value:r.current,count:r.currentCount})));
  const overallPrev = weightedChartAverage(rows.map(r=>({value:r.previous,count:r.previousCount})));
  const delta = overallCurrent !== null && overallPrev !== null ? Math.round((overallCurrent-overallPrev)*10)/10 : 0;

  return (
    <Card className="glass-card border border-border/50 shadow-elevated rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            คะแนนของฉันตามกลุ่มสาระ · เทอม {currentSemester}
          </CardTitle>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm bg-primary" />
              <span className="text-muted-foreground">ปี {currentAcademicYear + BE_OFFSET}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm bg-primary/25" />
              <span className="text-muted-foreground">ปี {currentAcademicYear + 542}</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[240px]">
          {readError ? (<div role="alert" className="text-destructive text-sm">อ่านข้อมูลคะแนนไม่สำเร็จ <Button variant="outline" onClick={() => void refetch()}>ลองใหม่</Button></div>) : isLoading || !isReady ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">กำลังโหลด...</div>
          ) : !hasData ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-1">
              <BarChart3 className="w-8 h-8 opacity-50" />
              <span>ยังไม่มีคะแนนปีนี้</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--foreground))", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                <Radar name={`ปี ${currentAcademicYear + 542}`} dataKey="previous"
                  stroke="hsl(var(--primary))" strokeOpacity={0.35} strokeDasharray="4 3"
                  fill="hsl(var(--primary))" fillOpacity={0.12} />
                <Radar name={`ปี ${currentAcademicYear + BE_OFFSET}`} dataKey="current"
                  stroke="hsl(var(--primary))" strokeWidth={2}
                  fill="hsl(var(--primary))" fillOpacity={0.45} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, name: any) => [`${v} / 100`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {hasData && (
          <div className="border-t pt-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted/40 p-2">
                <div className="text-muted-foreground">เฉลี่ยรวม</div>
                <div className="text-base font-semibold">{overallCurrent ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <div className="text-muted-foreground">เทียบปีก่อน</div>
                <div className={`text-base font-semibold flex items-center justify-center gap-1 ${
                  delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-muted-foreground"
                }`}>
                  {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                  {delta > 0 ? "+" : ""}{delta || "—"}
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <div className="text-muted-foreground">กลุ่มที่มีคะแนน</div>
                <div className="text-base font-semibold">{withScores.length}/8</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {top && (
                <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-2">
                  <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                    <Trophy className="w-3.5 h-3.5" />จุดแข็ง
                  </div>
                  <div className="truncate">{SUBJECT_GROUPS.find((g) => g.key === top.key)?.name}</div>
                  <div className="text-muted-foreground">เฉลี่ย {top.current}</div>
                </div>
              )}
              {low && (
                <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 p-2">
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />ควรพัฒนา
                  </div>
                  <div className="truncate">{SUBJECT_GROUPS.find((g) => g.key === low.key)?.name}</div>
                  <div className="text-muted-foreground">เฉลี่ย {low.current}</div>
                </div>
              )}
            </div>

            <div className="space-y-1 pt-1">
              {rows.map((r) => {
                const groupInfo = SUBJECT_GROUPS.find((g) => g.key === r.key);
                if (!groupInfo) return null;
                const diff = r.previous !== null && r.current !== null ? Math.round((r.current - r.previous) * 10) / 10 : null;
                return (
                  <div key={r.key} className="flex items-center justify-between text-xs gap-2 py-0.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge variant="secondary" className={`${groupInfo.color} text-[10px] px-1.5 py-0 font-normal shrink-0`}>
                        {groupInfo.code}
                      </Badge>
                      <span className="truncate">{groupInfo.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground tabular-nums">{r.current ?? "—"}</span>
                      {diff !== null && diff !== 0 && (
                        <span className={`tabular-nums text-[10px] ${diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {diff > 0 ? "+" : ""}{diff}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
