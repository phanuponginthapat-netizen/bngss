import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Sparkles, Loader2, Save } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";

const REFS = [
  { id: "onet", label: "O-NET" },
  { id: "nt", label: "NT" },
  { id: "pisa", label: "PISA" },
];

const CHOICE_FORMATS: Record<string, string[]> = {
  abcd: ["A", "B", "C", "D"],
  "1234": ["1", "2", "3", "4"],
  thai: ["ก", "ข", "ค", "ง"],
};

export default function ExamNewPage() {
  const nav = useNavigate();
  const { user } = useAuthSession();
  const [form, setForm] = useState({
    title: "", assignment_id: "", topic: "",
    level: "medium", question_count: 10, references: ["onet"] as string[],
    choice_format: "abcd" as keyof typeof CHOICE_FORMATS,
  });
  const [questions, setQuestions] = useState<any[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ดึง personnel.id ของครูที่ login
  const { data: personnel } = useQuery({
    queryKey: ["my-personnel", user?.id],
    enabled: !!user?.id,
    queryFn: async () => (await supabase.from("personnel").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });

  // ดึงรายการ "วิชา-ห้อง" ที่ครูได้รับมอบหมาย
  const { data: assignments = [] } = useQuery({
    queryKey: ["my-teacher-assignments", personnel?.id],
    enabled: !!personnel?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("teacher_assignments")
        .select("id, subject_id, classroom_id, academic_year, semester, subjects(id,name_th,code), classrooms(id,name,grade_level)")
        .eq("personnel_id", personnel!.id)
        .order("academic_year", { ascending: false });
      return data || [];
    },
  });

  const selected = useMemo(
    () => (assignments as any[]).find((a) => a.id === form.assignment_id),
    [assignments, form.assignment_id],
  );
  const subjName = selected?.subjects?.name_th || "";
  const clsName = selected?.classrooms?.name || selected?.classrooms?.grade_level || "";
  const labels = CHOICE_FORMATS[form.choice_format];

  // ดึงตัวชี้วัดของวิชาที่เลือก (หลักสูตรโรงเรียน + อ้างอิงแกนกลาง สพฐ.)
  const { data: indicators = [] } = useQuery({
    queryKey: ["subject-indicators", selected?.subject_id],
    enabled: !!selected?.subject_id,
    queryFn: async () => (await supabase
      .from("subject_indicators")
      .select("id,title,description,sort_order")
      .eq("subject_id", selected!.subject_id)
      .order("sort_order", { ascending: true })).data || [],
  });

  async function generate() {
    if (!form.assignment_id) return toast.error("กรุณาเลือกวิชา/ห้องเรียน");
    if (!form.topic) return toast.error("กรุณากรอกหัวข้อ");
    setGenLoading(true);
    try {
      const indicatorPayload = (indicators as any[]).map((it) => {
        const m = it.title?.match(/^(\S+\s?\S*)\s+(.*)$/);
        return {
          code: m ? m[1].trim() : (it.title || "").split(" ").slice(0, 2).join(" "),
          title: m ? m[2].trim() : it.title,
          description: it.description || "",
        };
      });
      const { data, error } = await supabase.functions.invoke("exam-generate", {
        body: {
          subject: subjName, topic: form.topic, level: form.level,
          count: form.question_count, references: form.references, grade_level: clsName,
          indicators: indicatorPayload,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setQuestions(data.questions || []);
      toast.success(`สร้างข้อสอบ ${data.questions?.length || 0} ข้อแล้ว`);
    } catch (e: any) {
      toast.error(saveErrorMessage(e, "สร้างข้อสอบไม่สำเร็จ"));
    } finally { setGenLoading(false); }
  }

  async function save() {
    if (saving) return;
    if (!user) return toast.error("กรุณาเข้าสู่ระบบ");
    if (!form.title) return toast.error("กรุณาตั้งชื่อข้อสอบ");
    if (!selected) return toast.error("กรุณาเลือกวิชา/ห้องเรียน");
    if (questions.length === 0) return toast.error("ยังไม่มีข้อสอบ — กดสร้างก่อน");
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    try {
      const { data: exam, error } = await supabase.from("exams").insert({
        teacher_id: user.id,
        title: form.title,
        topic: form.topic,
        subject_id: selected.subject_id || null,
        classroom_id: selected.classroom_id || null,
        level: form.level,
        question_count: questions.length,
        reference_sources: form.references,
        status: "draft",
      }).select().single();
      if (error) throw error;

      const rows = questions.map((q, i) => ({
        exam_id: exam.id,
        question_no: q.question_no || i + 1,
        question_text: q.question_text,
        choices: q.choices || [],
        correct_answer: q.correct_answer || "A",
        explanation: q.explanation || "",
        bloom_level: q.bloom_level || null,
        reference: q.reference || null,
        indicator_code: q.indicator_code || null,
        indicator_description: q.indicator_description || null,
      }));
      const { error: qErr } = await supabase.from("exam_questions").insert(rows as any);
      if (qErr) throw qErr;

      const { error: sErr } = await supabase.from("exam_sheets").insert({
        exam_id: exam.id,
        layout_config: { format: "A4", bubbles_per_question: 4, choice_format: form.choice_format },
        student_code_digits: 5,
      });
      if (sErr) throw sErr;

      toast.success("บันทึกข้อสอบสำเร็จ");
      nav(`/dashboard/exam/${exam.id}`);
    } catch (e: any) {
      toast.error(saveErrorMessage(e, "บันทึกไม่สำเร็จ"));
    } finally { toast.dismiss(__tid_save_1);
      setSaving(false); }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold">สร้างข้อสอบด้วย AI</h1>

      <Card className="p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>ชื่อข้อสอบ *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น สอบกลางภาค คณิต ป.5" />
          </div>
          <div className="md:col-span-2">
            <Label>วิชา / ห้องเรียน (จากตารางสอนของฉัน) *</Label>
            <Select value={form.assignment_id} onValueChange={(v) => setForm({ ...form, assignment_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder={assignments.length ? "เลือกวิชา-ห้อง" : "ไม่มีวิชาที่ได้รับมอบหมาย"} />
              </SelectTrigger>
              <SelectContent>
                {(assignments as any[]).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.subjects?.name_th || "-"} • {a.classrooms?.name || a.classrooms?.grade_level || "-"}
                    {a.academic_year ? ` (${a.academic_year}/${a.semester || 1})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!assignments.length && personnel && (
              <p className="text-xs text-muted-foreground mt-1">ยังไม่มีวิชาในตารางสอน กรุณาให้ฝ่ายวิชาการมอบหมายก่อน</p>
            )}
          </div>
          <div>
            <Label>หัวข้อ / เนื้อหา *</Label>
            <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="เช่น เศษส่วน, การคูณ, ระบบสุริยะ" />
          </div>
          <div>
            <Label>ระดับความยาก</Label>
            <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">ง่าย</SelectItem>
                <SelectItem value="medium">ปานกลาง</SelectItem>
                <SelectItem value="hard">ยาก</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>จำนวนข้อ</Label>
            <Input type="number" min={1} max={60} value={form.question_count}
              onChange={(e) => setForm({ ...form, question_count: Math.min(200, Math.max(1, safeInt(e.target.value, 10))) })} />
          </div>
          <div>
            <Label>รูปแบบตัวเลือก</Label>
            <RadioGroup
              value={form.choice_format}
              onValueChange={(v) => setForm({ ...form, choice_format: v as any })}
              className="flex gap-4 mt-2"
            >
              {[
                { v: "abcd", l: "A B C D" },
                { v: "1234", l: "1 2 3 4" },
                { v: "thai", l: "ก ข ค ง" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} />
                  <span>{o.l}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div>
          <Label>อ้างอิงแนวข้อสอบ</Label>
          <div className="flex gap-4 mt-2">
            {REFS.map((r) => (
              <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.references.includes(r.id)}
                  onCheckedChange={(c) => setForm({
                    ...form,
                    references: c ? [...form.references, r.id] : form.references.filter(x => x !== r.id),
                  })}
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Button onClick={generate} disabled={genLoading} className="w-full md:w-auto">
          {genLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          สร้างข้อสอบด้วย AI
        </Button>
      </Card>

      {questions.length > 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">ข้อสอบที่สร้าง ({questions.length} ข้อ)</h2>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              บันทึกข้อสอบ
            </Button>
          </div>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {questions.map((q, i) => (
              <Card key={i} className="p-4 bg-muted/30">
                <div className="flex items-start gap-2 mb-2">
                  <span className="font-bold">{q.question_no || i + 1}.</span>
                  <Textarea value={q.question_text} className="flex-1"
                    onChange={(e) => { const c = [...questions]; c[i] = { ...c[i], question_text: e.target.value }; setQuestions(c); }} />
                </div>
                <div className="grid grid-cols-2 gap-2 ml-6">
                  {(q.choices || []).map((ch: string, ci: number) => (
                    <div key={ci} className="flex items-center gap-2">
                      <span className="font-mono text-sm w-5">{labels[ci] || String.fromCharCode(65 + ci)}.</span>
                      <Input value={ch}
                        onChange={(e) => { const c = [...questions]; const nc = [...c[i].choices]; nc[ci] = e.target.value; c[i] = { ...c[i], choices: nc }; setQuestions(c); }} />
                    </div>
                  ))}
                </div>
                <div className="ml-6 mt-2 flex items-center gap-3 flex-wrap">
                  <Label className="text-xs">เฉลย:</Label>
                  <Select value={q.correct_answer} onValueChange={(v) => { const c = [...questions]; c[i] = { ...c[i], correct_answer: v }; setQuestions(c); }}>
                    <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["A","B","C","D"].map((x, idx) => <SelectItem key={x} value={x}>{labels[idx]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {q.reference && <span className="text-xs text-muted-foreground">[{q.reference}]</span>}
                  {q.indicator_code && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      ตัวชี้วัด: {q.indicator_code}
                    </span>
                  )}
                </div>
                {q.indicator_description && (
                  <div className="ml-6 mt-2 text-xs bg-primary/5 p-2 rounded border border-primary/10">
                    <strong>อธิบายตัวชี้วัด:</strong> {q.indicator_description}
                  </div>
                )}
                {q.explanation && (
                  <div className="ml-6 mt-2 text-xs text-muted-foreground bg-background p-2 rounded border">
                    <strong>เฉลย:</strong> {q.explanation}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
