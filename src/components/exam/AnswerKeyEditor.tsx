import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KeyRound, Save, FlaskConical, Wand2 } from "lucide-react";
import { CANONICAL_CHOICES, gradeAnswers, parseAnswerKeyText, answerKeyProblem, type ScoringMode } from "@/lib/examGrading";

interface Q { id: string; question_no: number; correct_answer: string | null; scoring_mode?: string | null }
const LABELS = ["ก", "ข", "ค", "ง"];
const MODES: { v: ScoringMode; l: string }[] = [{ v: "normal", l: "ปกติ" }, { v: "free", l: "ข้อฟรี" }, { v: "excluded", l: "ตัดออก" }];

export default function AnswerKeyEditor({ examId, questions, expectedCount }: { examId: string; questions: Q[]; expectedCount: number }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<{ id: string; no: number; ans: string | null; mode: ScoringMode }[]>([]);
  const [bulk, setBulk] = useState("");
  const [testText, setTestText] = useState("");
  const [saving, setSaving] = useState(false);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setRows(questions.map((q) => ({ id: q.id, no: q.question_no, ans: q.correct_answer || null, mode: (q.scoring_mode as ScoringMode) || "normal" })));
  }, [questions]);

  const dirty = useMemo(() => rows.some((r) => {
    const q = questions.find((x) => x.id === r.id);
    return !q || (q.correct_answer || null) !== r.ans || ((q.scoring_mode as string) || "normal") !== r.mode;
  }), [rows, questions]);

  const key = rows.map((r) => ({ question_no: r.no, correct_answer: r.ans, scoring_mode: r.mode }));
  const problem = answerKeyProblem(key, expectedCount);

  const applyBulk = () => {
    const parsed = parseAnswerKeyText(bulk);
    if (!parsed.length) return toast.error("ไม่พบคำตอบในข้อความ (ใช้ ก-ง, 1-4 หรือ A-D)");
    setRows((rs) => rs.map((r, i) => (i < parsed.length ? { ...r, ans: parsed[i] } : r)));
    toast.success(`ใส่เฉลย ${Math.min(parsed.length, rows.length)} ข้อ${parsed.length > rows.length ? ` (เกิน ${parsed.length - rows.length} ตัวถูกข้าม)` : ""}`);
  };

  const onKey = (i: number, e: React.KeyboardEvent) => {
    const m = parseAnswerKeyText(e.key);
    if (m.length === 1 || e.key === "Backspace") {
      e.preventDefault();
      const v = e.key === "Backspace" ? null : m[0];
      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ans: v } : r)));
      refs.current[e.key === "Backspace" ? Math.max(0, i - 1) : Math.min(rows.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); refs.current[i + 1]?.focus(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); refs.current[i - 1]?.focus(); }
  };

  async function save() {
    setSaving(true);
    try {
      const changed = rows.filter((r) => {
        const q = questions.find((x) => x.id === r.id)!;
        return (q.correct_answer || null) !== r.ans || ((q.scoring_mode as string) || "normal") !== r.mode;
      });
      for (const r of changed) {
        const { data, error } = await supabase.from("exam_questions").update({ correct_answer: r.ans, scoring_mode: r.mode } as any).eq("id", r.id).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error(`บันทึกข้อ ${r.no} ไม่สำเร็จ (ไม่มีสิทธิ์แก้ไข)`);
      }
      await qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
      toast.success(`บันทึกเฉลย ${changed.length} ข้อแล้ว — ผลที่ตรวจไปแล้วสามารถกด "ตรวจใหม่ทั้งหมด" ในหน้าผลคะแนน`);
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally { setSaving(false); }
  }

  const testParsed = parseAnswerKeyText(testText);
  const testResult = testText.trim() && !problem
    ? gradeAnswers(key, Object.fromEntries(rows.map((r, i) => [String(r.no), testParsed[i] ?? null])))
    : null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> เฉลยและการให้คะแนน</h2>
        <div className="flex items-center gap-2">
          {problem ? <Badge variant="destructive">{problem}</Badge> : <Badge>เฉลยพร้อมตรวจ</Badge>}
          <Button size="sm" onClick={save} disabled={!dirty || saving}><Save className="w-4 h-4 mr-1" />{saving ? "กำลังบันทึก…" : "บันทึกเฉลย"}</Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto] items-end">
        <div>
          <p className="text-sm font-medium mb-1">วางเฉลยทั้งชุดในครั้งเดียว</p>
          <Textarea rows={2} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="เช่น กขคงกข… หรือ 1234… หรือ 1.ก 2.ข … (ใช้ - แทนข้อที่ยังไม่มีเฉลย)" />
        </div>
        <Button variant="outline" onClick={applyBulk}><Wand2 className="w-4 h-4 mr-1" />ใส่เฉลย</Button>
      </div>

      <p className="text-xs text-muted-foreground">คลิกข้อแล้วพิมพ์ ก-ง / 1-4 / A-D ต่อเนื่องได้เลย ระบบเลื่อนไปข้อถัดไปเอง · Backspace ลบ</p>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[50vh] overflow-y-auto pr-1">
        {rows.map((r, i) => (
          <div key={r.id} ref={(el) => (refs.current[i] = el)} tabIndex={0} onKeyDown={(e) => onKey(i, e)}
            className="flex items-center gap-1.5 rounded-lg border p-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-card">
            <span className="w-7 text-right text-sm font-semibold">{r.no}.</span>
            {CANONICAL_CHOICES.map((c, ci) => (
              <button key={c} type="button" disabled={r.mode !== "normal"}
                onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ans: x.ans === c ? null : c } : x)))}
                className={`h-7 w-7 rounded-full border text-xs font-semibold transition-colors disabled:opacity-40 ${r.ans === c ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>
                {LABELS[ci]}
              </button>
            ))}
            <select value={r.mode} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, mode: e.target.value as ScoringMode } : x)))}
              className="ml-auto h-7 rounded border bg-background px-1 text-xs" aria-label={`การให้คะแนนข้อ ${r.no}`}>
              {MODES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/30">
        <p className="text-sm font-medium flex items-center gap-2"><FlaskConical className="w-4 h-4" />ทดลองตรวจก่อนสแกนจริง</p>
        <Input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="พิมพ์คำตอบจำลองของนักเรียน 1 คน เช่น กขคง-ก…" />
        {problem && testText.trim() && <p className="text-xs text-destructive">ยังทดลองไม่ได้: {problem}</p>}
        {testResult && (
          <div className="space-y-1">
            <p className="text-sm">ได้ <b>{testResult.score}/{testResult.total}</b> ({testResult.percentage}%) · ไม่ตอบ {testResult.blank} ข้อ</p>
            <div className="flex flex-wrap gap-1">
              {rows.filter((r) => r.mode !== "excluded").map((r) => (
                <span key={r.no} className={`text-[11px] px-1.5 py-0.5 rounded border ${testResult.correctMap[String(r.no)] ? "bg-primary/10 border-primary/30 text-primary" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>{r.no}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
