import { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Compass, Sparkles, History, Briefcase } from "lucide-react";
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { APTITUDE_AREAS, APTITUDE_QUESTIONS, APTITUDE_SCALE, areaMeta, scoreAptitude } from "@/lib/wellbeingTools";

interface Row {
  id: string;
  scores: Record<string, number>;
  top_areas: string[];
  suggested_careers: string[];
  created_at: string;
}

export default function CareerAptitudePage() {
  const { role } = useUserRole();
  const { user } = useAuthSession();
  const { isParent, children } = useParentChildren();
  const isStaff = role === "admin" || role === "director" || role === "teacher";
  const studentData = useStudentData();
  const { currentAcademicYear, currentSemester } = useAcademicYear();
  const qc = useQueryClient();

  const [pickedStudent, setPickedStudent] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: myStudent } = useQuery({
    queryKey: ["my-student-record", user?.id],
    enabled: !!user?.id && !isStaff && !isParent,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const targetId = isStaff || isParent ? pickedStudent : myStudent?.id || "";

  const { data: history = [] } = useQuery({
    queryKey: ["career-aptitude", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("career_aptitude_assessments")
        .select("id, scores, top_areas, suggested_careers, created_at")
        .eq("student_id", targetId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  const latest = history[0];

  const questions = APTITUDE_QUESTIONS.map((q) => ({
    id: q.id,
    text: `${areaMeta(q.area)?.emoji ?? ""} ${q.text}`,
    options: APTITUDE_SCALE.map((s) => ({ label: s.label, value: s.value, emoji: s.emoji })),
  }));

  const handleFinish = async (answers: Record<string, number>) => {
    if (!targetId) { toast.error("ยังไม่ได้เลือกนักเรียน"); return; }
    const { scores, topAreas, suggestedCareers } = scoreAptitude(answers);
    setSaving(true);
    const { error } = await supabase.from("career_aptitude_assessments").insert({
      student_id: targetId,
      assessor_type: isStaff ? "teacher" : isParent ? "parent" : "self",
      assessed_by: user?.id ?? null,
      answers,
      scores,
      top_areas: topAreas,
      suggested_careers: suggestedCareers,
      academic_year: currentAcademicYear ? currentAcademicYear - BE_OFFSET : null,
      semester: currentSemester || null,
    });
    setSaving(false);
    if (error) { toast.error(`บันทึกไม่สำเร็จ: ${error.message}`); return; }
    qc.invalidateQueries({ queryKey: ["career-aptitude", targetId] });
    qc.invalidateQueries({ queryKey: ["wellbeing-dashboard"] });
    setRunning(false);
    toast.success("ค้นพบแววของคุณแล้ว! 🎉");
  };

  const studentOptions = isParent
    ? children.map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}` }))
    : studentData.students.map((s: any) => ({ id: s.id, label: `${s.student_code || ""} ${s.first_name} ${s.last_name}` }));

  const radarData = latest
    ? APTITUDE_AREAS.map((a) => ({ area: a.name.replace("ด้าน", ""), score: latest.scores?.[a.key] ?? 0 }))
    : [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/10 to-transparent p-5 border border-amber-500/20">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Compass className="w-5 h-5 text-amber-600" /> ค้นหาแววอาชีพของฉัน
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          แบบวัดแววความสามารถพหุปัญญา 8 ด้าน ตามแนวทางกระทรวงศึกษาธิการ (สพฐ.) — 32 ข้อ ~5 นาที รู้ผลทันที
        </p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <Badge variant="secondary">🎯 รู้จุดเด่นของตัวเอง</Badge>
          <Badge variant="secondary">💼 แนะนำอาชีพที่ใช่</Badge>
          <Badge variant="secondary">📊 กราฟเรดาร์สวย ๆ เก็บไว้ในแฟ้มสะสมงาน</Badge>
        </div>
      </div>

      {(isStaff || isParent) && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-2">เลือกนักเรียน</div>
            <Select value={pickedStudent} onValueChange={setPickedStudent}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {studentOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {running ? (
        <QuizRunner
          title="แบบวัดแววความสามารถ 8 ด้าน"
          intro="ตอบตามความเป็นจริงของตัวเอง ไม่มีคำตอบถูกหรือผิด"
          questions={questions}
          submitting={saving}
          onCancel={() => setRunning(false)}
          onFinish={handleFinish}
        />
      ) : (
        <Button size="lg" className="gap-2" disabled={!targetId} onClick={() => setRunning(true)}>
          <Sparkles className="w-4 h-4" /> {latest ? "ทำแบบวัดอีกครั้ง" : "เริ่มค้นหาแววอาชีพ"}
        </Button>
      )}

      {latest && !running && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">โปรไฟล์ความสามารถ 8 ด้าน</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="area" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.45} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">3 ด้านเด่นของคุณ</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {latest.top_areas?.map((k, i) => {
                  const a = areaMeta(k);
                  if (!a) return null;
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{i + 1}. {a.emoji} {a.name}</span>
                        <span className="text-muted-foreground">{latest.scores?.[k] ?? 0}%</span>
                      </div>
                      <Progress value={latest.scores?.[k] ?? 0} className="h-2" />
                      <p className="text-xs text-muted-foreground">{a.desc}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4" /> อาชีพที่น่าสนใจสำหรับคุณ</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {latest.suggested_careers?.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> ประวัติการวัดแวว</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!targetId && <p className="text-sm text-muted-foreground">เลือกนักเรียนเพื่อดูประวัติ</p>}
          {targetId && history.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีผลการวัดแวว</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>{new Date(h.created_at).toLocaleDateString("th-TH", { dateStyle: "medium" })}</span>
              <span className="text-muted-foreground text-xs">
                {h.top_areas?.map((k) => areaMeta(k)?.name).filter(Boolean).join(" • ")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
