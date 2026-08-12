import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useParentChildren } from "@/hooks/useParentChildren";
import { useStudentData } from "@/hooks/useStudentData";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { BE_OFFSET } from "@/lib/dateBE";
import QuizRunner from "@/components/wellbeing/QuizRunner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HeartPulse, Clock, ShieldCheck, Phone, History, Trophy } from "lucide-react";
import { MENTAL_TOOLS, RISK_META, maxScore, type MentalToolDef, type RiskLevel } from "@/lib/wellbeingTools";

interface Row {
  id: string;
  tool: string;
  total_score: number;
  risk_level: string;
  interpretation: string | null;
  recommendation: string | null;
  created_at: string;
  student_id: string;
}

export default function MentalHealthPage() {
  const { role } = useUserRole();
  const { user } = useAuthSession();
  const { isParent, children } = useParentChildren();
  const isStaff = role === "admin" || role === "director" || role === "teacher";
  const studentData = useStudentData();
  const { currentAcademicYear, currentSemester } = useAcademicYear();
  const qc = useQueryClient();

  const [pickedStudent, setPickedStudent] = useState("");
  const [active, setActive] = useState<MentalToolDef | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ tool: MentalToolDef; score: number; level: RiskLevel; text: string; advice: string } | null>(null);

  const { data: myStudent } = useQuery({
    queryKey: ["my-student-record", user?.id],
    enabled: !!user?.id && !isStaff && !isParent,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, prefix, first_name, last_name, student_code")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const targetId = isStaff || isParent ? pickedStudent : myStudent?.id || "";

  const { data: history = [] } = useQuery({
    queryKey: ["mental-health", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mental_health_assessments")
        .select("id, tool, total_score, risk_level, interpretation, recommendation, created_at, student_id")
        .eq("student_id", targetId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const doneTools = useMemo(() => new Set(history.map((h) => h.tool)), [history]);

  const handleFinish = async (answers: Record<string, number>) => {
    if (!active) return;
    if (!targetId) {
      toast.error("ยังไม่ได้เลือกนักเรียน");
      return;
    }
    const score = Object.values(answers).reduce((a, b) => a + b, 0);
    const res = active.interpret(score);
    setSaving(true);
    const { error } = await supabase.from("mental_health_assessments").insert({
      student_id: targetId,
      tool: active.key,
      assessor_type: isStaff ? "teacher" : isParent ? "parent" : "self",
      assessed_by: user?.id ?? null,
      answers,
      total_score: score,
      risk_level: res.level,
      interpretation: res.text,
      recommendation: res.advice,
      academic_year: currentAcademicYear ? currentAcademicYear - BE_OFFSET : null,
      semester: currentSemester || null,
    });
    setSaving(false);
    if (error) {
      toast.error(`บันทึกไม่สำเร็จ: ${error.message}`);
      return;
    }
    qc.invalidateQueries({ queryKey: ["mental-health", targetId] });
    qc.invalidateQueries({ queryKey: ["wellbeing-dashboard"] });
    setActive(null);
    setResult({ tool: active, score, ...res });
    toast.success("บันทึกผลการประเมินเรียบร้อย 🎉");
  };

  const studentOptions = isParent
    ? children.map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}` }))
    : studentData.students.map((s: any) => ({ id: s.id, label: `${s.student_code || ""} ${s.first_name} ${s.last_name}` }));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-5 border border-primary/20">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-primary" /> เช็คใจวันนี้ — ประเมินสุขภาพจิต
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          แบบประเมินมาตรฐานกรมสุขภาพจิต กระทรวงสาธารณสุข (2Q / 9Q / 8Q / ST-5) ใช้เวลาไม่ถึง 5 นาที
        </p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" /> ข้อมูลเป็นความลับ</Badge>
          <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> ใช้เวลา 1-3 นาที</Badge>
          <Badge variant="secondary" className="gap-1"><Trophy className="w-3 h-3" /> ทำครบ 4 ชุดรับตราสัญลักษณ์ใจแกร่ง</Badge>
        </div>
      </div>

      {(isStaff || isParent) && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2">เลือกนักเรียนที่ต้องการประเมิน/ดูผล</div>
            <Select value={pickedStudent} onValueChange={setPickedStudent}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {studentOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">ผลการประเมิน {result.tool.name}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-4xl">{RISK_META[result.level].emoji}</div>
            <div className="text-2xl font-bold">{result.score} / {maxScore(result.tool)} คะแนน</div>
            <Badge className={RISK_META[result.level].badge}>{RISK_META[result.level].label}</Badge>
            <p className="text-sm">{result.text}</p>
            <p className="text-sm text-muted-foreground">💡 {result.advice}</p>
            {(result.level === "moderate" || result.level === "severe") && (
              <div className="flex items-center gap-2 text-sm rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 p-3">
                <Phone className="w-4 h-4" /> สายด่วนสุขภาพจิต 1323 ตลอด 24 ชม. หรือแจ้งครูที่ปรึกษาทันที
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setResult(null)}>ปิด</Button>
          </CardContent>
        </Card>
      )}

      {active ? (
        <QuizRunner
          title={active.name}
          intro={`${active.intro} • อ้างอิง: ${active.source}`}
          questions={active.questions}
          submitting={saving}
          onCancel={() => setActive(null)}
          onFinish={handleFinish}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MENTAL_TOOLS.map((t) => (
            <Card key={t.key} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{t.short}</Badge>
                  {doneTools.has(t.key) && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">ทำแล้ว ✓</Badge>}
                </div>
                <div className="font-semibold text-sm">{t.name}</div>
                <p className="text-xs text-muted-foreground min-h-[48px]">{t.intro}</p>
                <div className="text-[11px] text-muted-foreground">⏱ ~{t.durationMin} นาที • {t.questions.length} ข้อ</div>
                <Button size="sm" className="w-full" disabled={!targetId} onClick={() => { setResult(null); setActive(t); }}>
                  เริ่มทำแบบประเมิน
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> ประวัติการประเมิน</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!targetId && <p className="text-sm text-muted-foreground">เลือกนักเรียนเพื่อดูประวัติ</p>}
          {targetId && history.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีผลการประเมิน</p>}
          {history.map((h) => {
            const meta = RISK_META[(h.risk_level as RiskLevel)] ?? RISK_META.normal;
            return (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <div className="font-medium">{h.tool} • {h.total_score} คะแนน</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleDateString("th-TH", { dateStyle: "medium" })} — {h.interpretation}
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
