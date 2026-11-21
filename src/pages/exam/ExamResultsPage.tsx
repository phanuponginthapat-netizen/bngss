import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, RefreshCw, Send, Printer, BarChart3 } from "lucide-react";
import { resolveStorageUrl } from "@/lib/storageUrl";
import {
  CANONICAL_CHOICES, gradeAnswers, answerKeyProblem, cleanStudentCode, reviewReasons,
  analyzeExam, evanaText, scaleScore,
} from "@/lib/examGrading";
import { upsertStudentScoresForTerm } from "@/lib/pp5ApplyToSystem";

const TH = ["ก", "ข", "ค", "ง"];
const showChoice = (c: string | null | undefined) => { const i = CANONICAL_CHOICES.indexOf(String(c || "").toUpperCase() as any); return i >= 0 ? TH[i] : "-"; };
const download = (name: string, text: string, type = "text/plain;charset=utf-8") => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF" + text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export default function ExamResultsPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any>(null);
  const [ratio, setRatio] = useState(0.27);
  const [busy, setBusy] = useState(false);

  const examQ = useQuery({
    queryKey: ["exam", id, "results"], enabled: !!id,
    queryFn: async () => { const r = await supabase.from("exams").select("id,title,question_count,subject_id,academic_year,semester,subjects(name_th)").eq("id", id!).maybeSingle(); if (r.error) throw r.error; return r.data as any; },
  });
  const keyQ = useQuery({
    queryKey: ["exam-questions", id], enabled: !!id,
    queryFn: async () => { const r = await supabase.from("exam_questions").select("*").eq("exam_id", id!).order("question_no"); if (r.error) throw r.error; return r.data || []; },
  });
  const subsQ = useQuery({
    queryKey: ["exam-subs", id], enabled: !!id,
    queryFn: async () => { const r = await supabase.from("exam_submissions").select("*").eq("exam_id", id!).order("graded_at", { ascending: false }); if (r.error) throw r.error; return r.data || []; },
  });
  const sheetQ = useQuery({
    queryKey: ["exam-sheet", id], enabled: !!id,
    queryFn: async () => { const r = await supabase.from("exam_sheets").select("student_code_digits").eq("exam_id", id!).maybeSingle(); if (r.error) throw r.error; return r.data; },
  });
  const exam = examQ.data, key = (keyQ.data || []) as any[], subs = (subsQ.data || []) as any[];
  const digits = sheetQ.data?.student_code_digits || 5;
  const readError = examQ.error || keyQ.error || subsQ.error || sheetQ.error;
  const refresh = () => qc.invalidateQueries({ queryKey: ["exam-subs", id] });

  const review = subs.filter((s) => s.review_status === "review");
  const done = subs.filter((s) => s.review_status !== "review");
  const analysis = useMemo(() => analyzeExam(key, done.map((s) => ({ answers: s.answers || {} })), ratio), [key, done, ratio]);
  const keyProblem = answerKeyProblem(key, Number(exam?.question_count) || 0);

  async function regradeAll() {
    if (keyProblem) return toast.error(keyProblem);
    setBusy(true);
    try {
      let n = 0;
      for (const s of subs) {
        const g = gradeAnswers(key, s.answers || {});
        const { data, error } = await supabase.from("exam_submissions").update({ score: g.score, total: g.total, percentage: g.percentage, correct_map: g.correctMap }).eq("id", s.id).select("id");
        if (error) throw error;
        if (data?.length) n++;
      }
      toast.success(`ตรวจใหม่ตามเฉลยล่าสุด ${n}/${subs.length} แผ่น`);
    } catch (e: any) { toast.error(e?.message || "ตรวจใหม่ไม่สำเร็จ"); }
    finally { setBusy(false); refresh(); }
  }

  if (readError) return (
    <div className="p-6 space-y-3"><p className="text-destructive">โหลดผลคะแนนไม่สำเร็จ: {(readError as any).message}</p>
      <Button onClick={() => { examQ.refetch(); keyQ.refetch(); subsQ.refetch(); sheetQ.refetch(); }}>ลองใหม่</Button></div>
  );
  if (!exam || keyQ.isLoading || subsQ.isLoading) return <p className="p-6 text-muted-foreground">กำลังโหลด...</p>;

  const Table = ({ rows, isReview }: { rows: any[]; isReview?: boolean }) => (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">รหัส</th><th className="text-left p-3">ชื่อ</th>
              <th className="text-center p-3">คะแนน</th><th className="text-center p-3">%</th>
              {isReview && <th className="text-left p-3">ต้องตรวจทาน</th>}
              <th className="text-center p-3">สมุดคะแนน</th><th className="text-center p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3 font-mono">{s.student_code_detected || "-"}</td>
                <td className="p-3">{s.student_name_snapshot || <span className="text-muted-foreground">(ไม่พบในระบบ)</span>}</td>
                <td className="p-3 text-center font-semibold">{s.score}/{s.total}</td>
                <td className="p-3 text-center"><Badge variant={s.percentage >= 50 ? "default" : "destructive"}>{Number(s.percentage).toFixed(1)}%</Badge></td>
                {isReview && <td className="p-3"><div className="flex flex-wrap gap-1">{(s.review_reasons || []).map((r: string) => <Badge key={r} variant="outline" className="border-destructive/40 text-destructive">{r}</Badge>)}</div></td>}
                <td className="p-3 text-center text-xs">{s.gradebook_pushed_at ? <span className="text-primary">ส่งแล้ว</span> : "-"}</td>
                <td className="p-3 text-center"><Button size="sm" variant={isReview ? "default" : "outline"} onClick={() => setEdit(s)}>{isReview ? "ตรวจทาน" : "ดู/แก้ไข"}</Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">{isReview ? "ไม่มีแผ่นที่ต้องตรวจทาน" : "ยังไม่มีผลการตรวจ"}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">ผลคะแนนและวิเคราะห์ข้อสอบ</h1>
          <p className="text-sm text-muted-foreground">{exam.title} · {subs.length} แผ่น</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={regradeAll} disabled={busy || !subs.length}><RefreshCw className="w-4 h-4 mr-1" />ตรวจใหม่ทั้งหมด</Button>
          <PushToGradebook exam={exam} rows={done} digitsOk onDone={refresh} />
        </div>
      </div>

      <Tabs defaultValue={review.length ? "review" : "done"}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="done"><CheckCircle2 className="w-4 h-4 mr-1" />ตรวจสมบูรณ์ ({done.length})</TabsTrigger>
          <TabsTrigger value="review"><AlertTriangle className="w-4 h-4 mr-1" />รอตรวจทาน ({review.length})</TabsTrigger>
          <TabsTrigger value="analysis"><BarChart3 className="w-4 h-4 mr-1" />วิเคราะห์ข้อสอบ</TabsTrigger>
        </TabsList>
        <TabsContent value="done"><Table rows={done} /></TabsContent>
        <TabsContent value="review"><Table rows={review} isReview /></TabsContent>
        <TabsContent value="analysis" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="text-sm">แบ่งกลุ่มสูง-ต่ำ:</span>
            <Button size="sm" variant={ratio === 0.27 ? "default" : "outline"} onClick={() => setRatio(0.27)}>27%</Button>
            <Button size="sm" variant={ratio === 0.25 ? "default" : "outline"} onClick={() => setRatio(0.25)}>25%</Button>
            <div className="ml-auto flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => download(`evana-${exam.title}.txt`, evanaText(key, done.map((s) => ({ code: s.student_code_detected, answers: s.answers || {} }))))}><Download className="w-4 h-4 mr-1" />ไฟล์ EVANA</Button>
              <Button size="sm" variant="outline" onClick={() => download(`analysis-${exam.title}.csv`, analysisCsv(analysis), "text/csv;charset=utf-8")}><Download className="w-4 h-4 mr-1" />CSV</Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />พิมพ์รายงาน</Button>
            </div>
          </div>
          {analysis.n < 2 ? <Card className="p-6 text-muted-foreground">ต้องมีผลตรวจสมบูรณ์อย่างน้อย 2 แผ่นจึงจะวิเคราะห์ได้</Card> : <>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {[["จำนวน", analysis.n], ["เฉลี่ย", analysis.mean], ["S.D.", analysis.sd], ["มัธยฐาน", analysis.median], ["สูงสุด", analysis.max], ["ต่ำสุด", analysis.min], ["KR-20", analysis.kr20 ?? "-"]].map(([l, v]) => (
                <Card key={String(l)} className="p-3 text-center"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">กลุ่มละ {analysis.groupSize} คน · ความยาก (p) เหมาะสม 0.20–0.80 · อำนาจจำแนก (r) ตั้งแต่ 0.20 ขึ้นไป · ตัวลวงที่ดีควรมีคนเลือก และกลุ่มต่ำเลือกมากกว่ากลุ่มสูง</p>
            <Card className="p-0 overflow-hidden"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr>
                  <th className="p-2">ข้อ</th><th className="p-2">เฉลย</th><th className="p-2">p</th><th className="p-2">r</th>
                  {TH.map((t) => <th key={t} className="p-2">{t} (สูง/ต่ำ)</th>)}<th className="p-2">ไม่ตอบ</th><th className="p-2 text-left">ผล</th>
                </tr></thead>
                <tbody>{analysis.items.map((it) => (
                  <tr key={it.question_no} className="border-t text-center">
                    <td className="p-2 font-semibold">{it.question_no}</td><td className="p-2">{showChoice(it.correct)}</td>
                    <td className="p-2">{it.p ?? "-"}</td><td className="p-2">{it.r ?? "-"}</td>
                    {CANONICAL_CHOICES.map((c) => (
                      <td key={c} className={`p-2 ${c === it.correct ? "font-bold text-primary" : ""}`}>{it.choiceCounts[c].high}/{it.choiceCounts[c].low}</td>
                    ))}
                    <td className="p-2">{it.blank}</td>
                    <td className="p-2 text-left">
                      <Badge variant={it.verdict === "ใช้ได้" ? "default" : "outline"}>{it.verdict}</Badge>
                      {it.distractorWarnings.length > 0 && <p className="text-[11px] text-muted-foreground mt-1">{it.distractorWarnings.join(" · ")}</p>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div></Card>
          </>}
        </TabsContent>
      </Tabs>

      {edit && <ReviewDialog sub={edit} keyRows={key} digits={digits} examId={exam.id} subs={subs} onClose={() => { setEdit(null); refresh(); }} />}
    </div>
  );
}

function analysisCsv(a: ReturnType<typeof analyzeExam>) {
  const lines = [["ข้อ", "เฉลย", "p", "r", ...TH.flatMap((t) => [`${t}_สูง`, `${t}_ต่ำ`, `${t}_ทั้งหมด`]), "ไม่ตอบ", "ผล"].join(",")];
  for (const it of a.items) lines.push([it.question_no, showChoice(it.correct), it.p ?? "", it.r ?? "", ...CANONICAL_CHOICES.flatMap((c) => [it.choiceCounts[c].high, it.choiceCounts[c].low, it.choiceCounts[c].all]), it.blank, it.verdict].join(","));
  lines.push("", `N,${a.n}`, `Mean,${a.mean}`, `SD,${a.sd}`, `Median,${a.median}`, `Max,${a.max}`, `Min,${a.min}`, `KR20,${a.kr20 ?? ""}`);
  return lines.join("\n");
}

function ReviewDialog({ sub, keyRows, digits, examId, subs, onClose }: { sub: any; keyRows: any[]; digits: number; examId: string; subs: any[]; onClose: () => void }) {
  const [code, setCode] = useState(sub.student_code_detected || "");
  const [answers, setAnswers] = useState<Record<string, string | null>>({ ...(sub.answers || {}) });
  const [img, setImg] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { const p = sub.graded_image_url || sub.scan_image_url; if (p) resolveStorageUrl("exam-scans", p).then(setImg).catch(() => setImg("")); }, [sub]);
  const g = gradeAnswers(keyRows, answers);

  async function save() {
    const clean = cleanStudentCode(code, digits);
    if (!clean) return toast.error(`รหัสนักเรียนต้องเป็นตัวเลข ${digits} หลัก`);
    if (subs.some((s) => s.id !== sub.id && s.student_code_detected === clean)) return toast.error(`รหัส ${clean} มีผลตรวจในข้อสอบนี้แล้ว — ลบหรือแก้แผ่นนั้นก่อน`);
    setSaving(true);
    try {
      const { data: stu, error: se } = await supabase.from("students").select("id,prefix,first_name,last_name").eq("student_code", clean).limit(2);
      if (se) throw se;
      const found = stu?.length === 1 ? stu[0] : null;
      const reasons = reviewReasons({ studentCode: clean, studentFound: !!found, duplicate: false, blank: g.blank, total: g.total }).filter((r) => !r.startsWith("ไม่ได้ฝน"));
      const { data, error } = await supabase.from("exam_submissions").update({
        student_code_detected: clean, student_id: found?.id ?? null,
        student_name_snapshot: found ? `${found.prefix || ""}${found.first_name} ${found.last_name}` : "",
        answers, correct_map: g.correctMap, score: g.score, total: g.total, percentage: g.percentage,
        review_status: reasons.length ? "review" : "ok", review_reasons: reasons, gradebook_pushed_at: null,
      } as any).eq("id", sub.id).eq("exam_id", examId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("บันทึกไม่สำเร็จ (ไม่มีสิทธิ์แก้ไข)");
      toast.success(reasons.length ? `บันทึกแล้ว แต่ยังต้องตรวจทาน: ${reasons.join(", ")}` : `ยืนยันผล ${g.score}/${g.total} ของ ${found ? found.first_name : clean} แล้ว`);
      onClose();
    } catch (e: any) { toast.error(e?.message || "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  async function remove() {
    const { data, error } = await supabase.from("exam_submissions").delete().eq("id", sub.id).select("id");
    if (error || !data?.length) return toast.error(error?.message || "ลบไม่สำเร็จ");
    toast.success("ลบแผ่นนี้แล้ว"); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ตรวจทานกระดาษคำตอบ</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border bg-muted/30 min-h-40 flex items-center justify-center">{img ? <img src={img} alt="ภาพสแกน" className="w-full" /> : <span className="text-sm text-muted-foreground">ไม่มีภาพ</span>}</div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">{(sub.review_reasons || []).map((r: string) => <Badge key={r} variant="outline" className="border-destructive/40 text-destructive">{r}</Badge>)}</div>
            <label className="text-sm font-medium block">รหัสนักเรียน ({digits} หลัก)
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={digits} className="font-mono mt-1" />
            </label>
            <p className="text-sm">คะแนนใหม่: <b>{g.score}/{g.total}</b> ({g.percentage}%)</p>
            <div className="grid grid-cols-2 gap-1 max-h-[45vh] overflow-y-auto pr-1">
              {keyRows.map((q) => {
                const k = String(q.question_no), a = answers[k];
                const ok = g.correctMap[k];
                return (
                  <div key={k} className={`flex items-center gap-1 rounded border p-1 ${q.scoring_mode === "excluded" ? "opacity-50" : ok ? "border-primary/40" : "border-destructive/40"}`}>
                    <span className="w-6 text-right text-xs font-semibold">{k}.</span>
                    {CANONICAL_CHOICES.map((c, i) => (
                      <button key={c} type="button" onClick={() => setAnswers((x) => ({ ...x, [k]: x[k] === c ? null : c }))}
                        className={`h-6 w-6 rounded-full border text-[11px] ${a === c ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"} ${q.correct_answer === c ? "ring-1 ring-primary/50" : ""}`}>{TH[i]}</button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="text-destructive mr-auto" onClick={remove} disabled={saving}>ลบแผ่นนี้</Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>ปิด</Button>
          <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก…" : "ยืนยันและบันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const COLUMNS = [
  { v: "assignment_score", l: "คะแนนเก็บ" },
  { v: "midterm_score", l: "กลางภาค" },
  { v: "final_score", l: "ปลายภาค" },
] as const;

function PushToGradebook({ exam, rows, onDone }: { exam: any; rows: any[]; digitsOk?: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [col, setCol] = useState<(typeof COLUMNS)[number]["v"]>("midterm_score");
  const [full, setFull] = useState(20);
  const [saving, setSaving] = useState(false);
  const eligible = rows.filter((s) => s.student_id && s.student_code_detected);
  const termOk = !!exam.subject_id && [1, 2, 3].includes(Number(exam.semester)) && !!exam.academic_year;

  async function push() {
    if (!termOk) return toast.error("ข้อสอบนี้ยังไม่ระบุวิชา ภาคเรียน หรือปีการศึกษา จึงส่งเข้าสมุดคะแนนไม่ได้");
    if (!(full > 0)) return toast.error("ระบุคะแนนเต็มของช่องให้ถูกต้อง");
    setSaving(true);
    try {
      const payload = eligible.map((s) => ({
        student_code: s.student_code_detected, student_name: s.student_name_snapshot || s.student_code_detected,
        subject_id: exam.subject_id, [col]: scaleScore(Number(s.score), Number(s.total), full),
      }));
      const err = await upsertStudentScoresForTerm(payload, Number(exam.semester), Number(exam.academic_year));
      if (err) throw err;
      const { error } = await supabase.from("exam_submissions").update({ gradebook_pushed_at: new Date().toISOString() } as any).in("id", eligible.map((s) => s.id));
      if (error) throw error;
      toast.success(`ส่งคะแนน${COLUMNS.find((c) => c.v === col)?.l} (เต็ม ${full}) ของ ${eligible.length} คนเข้าสมุดคะแนนแล้ว`);
      setOpen(false); onDone();
    } catch (e: any) { toast.error(e?.message || "ส่งคะแนนไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!eligible.length}><Send className="w-4 h-4 mr-1" />ส่งเข้าสมุดคะแนน</Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>ส่งผลสอบเข้าสมุดคะแนน</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>วิชา {exam.subjects?.name_th || "-"} · ภาคเรียน {exam.semester || "-"}/{exam.academic_year ? Number(exam.academic_year) + (Number(exam.academic_year) < 2400 ? 543 : 0) : "-"}</p>
            <div className="flex gap-2">{COLUMNS.map((c) => <Button key={c.v} size="sm" variant={col === c.v ? "default" : "outline"} onClick={() => setCol(c.v)}>{c.l}</Button>)}</div>
            <label className="block">คะแนนเต็มของช่องนี้<Input type="number" min={1} value={full} onChange={(e) => setFull(Number(e.target.value))} className="mt-1" /></label>
            <p className="text-muted-foreground">ส่ง {eligible.length} คนที่ตรวจสมบูรณ์และพบในระบบ · ตัวอย่าง: ได้ 30/40 → {scaleScore(30, 40, full)} คะแนน · แผ่นที่รอตรวจทานจะไม่ถูกส่ง</p>
            {!termOk && <p className="text-destructive">ข้อสอบนี้ยังไม่ระบุวิชา/ภาคเรียน/ปีการศึกษา</p>}
          </div>
          <DialogFooter><Button onClick={push} disabled={saving || !termOk}>{saving ? "กำลังส่ง…" : "ยืนยันส่งคะแนน"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
