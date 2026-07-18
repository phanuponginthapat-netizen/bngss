import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Send, Printer, RotateCcw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PdfBoxesView from "./PdfBoxesView";
import type { WSQuestion } from "./WorksheetBuilder";

interface Props {
  worksheet: {
    id: string;
    title: string;
    description?: string | null;
    grade_level?: string | null;
    questions: WSQuestion[];
    source_url?: string | null;
    source_type?: string | null;
  };
  preview?: boolean;
  hideStudentInfo?: boolean;
  onSubmitted?: (result: { score: number; total: number; answers: Record<string, string> }) => Promise<void> | void;
}

export default function WorksheetPlayer({ worksheet, preview = false, hideStudentInfo = false, onSubmitted }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [classroom, setClassroom] = useState("");
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => worksheet.questions.reduce((s, q) => s + (q.points || 1), 0), [worksheet]);

  const grade = () => {
    let score = 0;
    const results: Record<string, boolean> = {};
    for (const q of worksheet.questions) {
      const a = (answers[q.id] || "").trim();
      const pts = q.points || 1;
      const expected = (q.answer || "").trim();
      let ok = false;
      if (!expected) {
        // no answer key — count as correct if non-empty (manual grade later)
        ok = a.length > 0;
      } else {
        ok = a.toLowerCase() === expected.toLowerCase();
      }
      if (ok) score += pts;
      results[q.id] = ok;
    }
    return { score, results };
  };

  const submit = async () => {
    if (!preview && !onSubmitted && !hideStudentInfo && !studentName.trim()) { toast.error("กรุณากรอกชื่อนักเรียน"); return; }
    const { score } = grade();
    setSubmitted(true);
    if (preview) return;
    setSaving(true);
    try {
      if (onSubmitted) {
        await onSubmitted({ score, total, answers });
        toast.success(`ส่งคำตอบเรียบร้อย — คะแนน ${score}/${total}`);
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("worksheet_submissions").insert({
          worksheet_id: worksheet.id,
          student_id: u.user?.id || null,
          student_name: studentName,
          classroom,
          answers: answers as any,
          score, total,
        } as any);
        if (error) throw error;
        toast.success(`ส่งคำตอบเรียบร้อย — คะแนน ${score}/${total}`);
      }
    } catch (e: any) {
      toast.error("ส่งไม่สำเร็จ: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setAnswers({}); setSubmitted(false); };
  const { score, results } = submitted ? grade() : { score: 0, results: {} as Record<string, boolean> };

  if (!worksheet.source_url) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        ใบงานนี้ยังไม่มีต้นแบบ — ครูยังไม่ได้อัปโหลดไฟล์
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Card className="p-4 bg-gradient-to-br from-info to-white border-info/30 print:hidden">
        <h1 className="text-xl font-bold text-info">{worksheet.title}</h1>
        {worksheet.grade_level && <div className="text-xs text-muted-foreground">ระดับชั้น: {worksheet.grade_level}</div>}
        {worksheet.description && <p className="text-sm mt-2">{worksheet.description}</p>}
        {!preview && !hideStudentInfo && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Input placeholder="ชื่อ-สกุล" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            <Input placeholder="ชั้น/เลขที่" value={classroom} onChange={(e) => setClassroom(e.target.value)} />
          </div>
        )}
      </Card>

      <div className="bg-muted/20 p-2 border rounded">
        <PdfBoxesView
          fileUrl={worksheet.source_url}
          fileType={worksheet.source_type || "pdf"}
          boxes={worksheet.questions.map((q) => q.box)}
          renderBox={(b) => {
            const q = worksheet.questions.find((x) => x.id === b.id);
            if (!q) return null;
            const ok = results[q.id];
            const showResult = submitted;
            const setA = (v: string) => setAnswers({ ...answers, [q.id]: v });
            const borderCls = showResult ? (ok ? "border-success/30" : "border-danger/30") : "border-success/30";
            return (
              <div className="absolute inset-0">
                {q.type === "box" && (
                  <input
                    className={`w-full h-full px-1 text-sm bg-white/95 border-2 outline-none ${borderCls} focus:border-warning/30`}
                    placeholder={q.prompt || ""} disabled={submitted}
                    value={answers[q.id] || ""} onChange={(e) => setA(e.target.value)}
                  />
                )}
                {q.type === "tick" && (
                  <div className={`w-full h-full flex items-center justify-around gap-1 px-1 bg-white/95 border-2 ${borderCls} text-xs`}>
                    {[["true", "✓"], ["false", "✗"]].map(([v, lab]) => (
                      <label key={v} className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={q.id} disabled={submitted}
                          checked={answers[q.id] === v} onChange={() => setA(v)} />
                        <span>{lab}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === "choice" && (
                  <div className={`w-full h-full overflow-auto px-1 py-0.5 bg-white/95 border-2 ${borderCls} text-xs space-y-0.5`}>
                    {(q.options || []).map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={q.id} disabled={submitted}
                          checked={answers[q.id] === String(oi)} onChange={() => setA(String(oi))} />
                        <span className="truncate">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {showResult && (
                  <div className="absolute -right-5 top-1/2 -translate-y-1/2">
                    {ok ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-danger" />}
                  </div>
                )}
                {showResult && !ok && q.answer && (
                  <div className="absolute left-0 -bottom-4 text-[10px] text-success bg-white/90 px-1 rounded whitespace-nowrap">
                    เฉลย: {q.type === "choice" ? (q.options?.[Number(q.answer)] || q.answer) : q.type === "tick" ? (q.answer === "true" ? "ถูก" : "ผิด") : q.answer}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-4 px-4 py-3 flex items-center justify-between gap-2 print:hidden">
        {submitted ? (
          <>
            <div className="text-lg font-bold">คะแนน: <span className="text-primary">{score}</span> / {total}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" />ทำใหม่</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />พิมพ์</Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">ทั้งหมด {worksheet.questions.length} ช่อง · {total} คะแนน</div>
            <Button onClick={submit} disabled={saving || worksheet.questions.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {preview ? "ตรวจคำตอบ" : "ส่งคำตอบ"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
