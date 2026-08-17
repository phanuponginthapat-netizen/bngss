import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Save, Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { useQueryClient } from "@tanstack/react-query";
import type { EFormField } from "@/lib/eformTemplate";
import { EFORM_PAGE_STYLE } from "@/lib/eformLayout";
import PdfWorksheetPlayer from "@/components/homework/PdfWorksheetPlayer";
import { gradeField, type WorksheetField } from "@/lib/pdfWorksheet";
import DOMPurify from "dompurify";
import { uploadHomeworkFile, type Attachment } from "@/lib/homeworkStorage";
import AttachmentList from "./AttachmentList";
import { saveErrorMessage } from "@/lib/saveError";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignmentId: string | null;
  studentId: string | null;
}

type AttachmentItem = Attachment;

export function HomeworkAnswerDialog({ open, onOpenChange, assignmentId, studentId }: Props) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assignment, setAssignment] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");

  const fields: EFormField[] = useMemo(() => (assignment?.answer_fields || []) as EFormField[], [assignment]);
  const worksheetFields: WorksheetField[] = useMemo(() => (assignment?.worksheet_fields || []) as WorksheetField[], [assignment]);
  const isPdfMode = !!assignment?.pdf_path;
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isPdfMode) { setPdfSignedUrl(null); return; }
    (async () => {
      const { data } = await supabase.storage.from("homework-files").createSignedUrl(assignment.pdf_path, 3600);
      if (data?.signedUrl) setPdfSignedUrl(data.signedUrl);
    })();
  }, [isPdfMode, assignment?.pdf_path]);

  useEffect(() => {
    if (!open || !assignmentId || !studentId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: a } = await supabase.from("homework_assignments").select("*").eq("id", assignmentId).maybeSingle();
      if (cancelled) return;
      setAssignment(a);
      const { data: s } = await supabase
        .from("homework_submissions" as any)
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (cancelled) return;
      if (s) {
        setSubmissionId((s as any).id);
        setAnswers(((s as any).answers || {}) as any);
        setAttachments(((s as any).attachments || []) as AttachmentItem[]);
        setStatus((s as any).status || "draft");
      } else {
        setSubmissionId(null);
        setAnswers({});
        setAttachments([]);
        setStatus("draft");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, assignmentId, studentId]);

  const upsert = async (nextStatus: "draft" | "submitted") => {
    if (!assignmentId || !studentId) return null;
    const { data: student } = await supabase.from("students").select("school_id").eq("id", studentId).maybeSingle();
    const payload: any = {
      assignment_id: assignmentId,
      student_id: studentId,
      school_id: student?.school_id || null,
      answers,
      attachments,
      status: nextStatus,
      submitted_at: nextStatus === "submitted" ? new Date().toISOString() : null,
    };
    if (isPdfMode && nextStatus === "submitted" && worksheetFields.length > 0) {
      const results: Record<string, { correct: boolean; score: number }> = {};
      let total = 0;
      let hasGradable = false;
      for (const f of worksheetFields) {
        if (f.correct === undefined || f.correct === null || f.correct === "") continue;
        hasGradable = true;
        const r = gradeField(f, answers[f.id]);
        results[f.id] = r;
        total += r.score;
      }
      payload.field_results = results;
      // เก็บ auto_score ไว้ให้ครูตรวจ — ไม่ตั้ง final_score ฝั่งนักเรียน
      // เพื่อกัน trigger sync_homework_submission_to_pp5 ลงคะแนนใน ปพ.5 ทันที
      if (hasGradable) payload.auto_score = total;
    }

    if (submissionId) {
      const { error } = await supabase.from("homework_submissions" as any).update(payload).eq("id", submissionId);
      if (error) throw error;
      return submissionId;
    }
    const { data, error } = await supabase.from("homework_submissions" as any).insert(payload).select("id").single();
    if (error) throw error;
    setSubmissionId((data as any).id);
    return (data as any).id as string;
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      await upsert("draft");
      toast.success("บันทึกร่างแล้ว");
      qc.invalidateQueries({ queryKey: ["hw-submissions"] });
    } catch (e: any) { toast.error(saveErrorMessage(e)); } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!isPdfMode) {
      for (const f of fields) {
        if (f.required && !answers[f.key]) { toast.error(`กรอก "${f.label}" ก่อนส่ง`); return; }
      }
    }
    setSubmitting(true);
    try {
      await upsert("submitted");
      setStatus("submitted");
      // notify teacher
      if (assignment?.created_by) {
        await notify({
          user_ids: [assignment.created_by],
          title: "นักเรียนส่งการบ้าน",
          body: `ใบงาน "${assignment.title}" มีผู้ส่งใหม่`,
          url: "/dashboard/homework",
        }).catch(() => {});
      }
      toast.success("ส่งงานสำเร็จ");
      qc.invalidateQueries({ queryKey: ["hw-submissions"] });
      onOpenChange(false);
    } catch (e: any) { toast.error(saveErrorMessage(e)); } finally { setSubmitting(false); }
  };

  const uploadFile = async (file: File) => {
    if (!studentId) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("ไฟล์ต้องไม่เกิน 10MB"); return; }
    try {
      const att = await uploadHomeworkFile(file, `rich-submissions/${assignmentId || "assignment"}`);
      setAttachments((prev) => [...prev, att]);
    } catch (e: any) {
      toast.error(e?.message || "อัปโหลดไฟล์ไม่สำเร็จ");
    }
  };

  const removeAttachment = async (i: number) => {
    const a = attachments[i];
    await supabase.storage.from("homework-files").remove([a.path]).catch(() => {});
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const readOnly = status === "submitted" || status === "graded";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[100dvw] h-[100dvh] max-w-none rounded-none sm:w-auto sm:h-auto sm:max-w-4xl sm:max-h-[92vh] overflow-hidden flex flex-col p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>{assignment?.title || "ทำใบงาน"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-auto space-y-4 px-1">
            {isPdfMode ? (
              pdfSignedUrl ? (
                <PdfWorksheetPlayer
                  pdfUrl={pdfSignedUrl}
                  fields={worksheetFields}
                  answers={answers}
                  onAnswersChange={setAnswers}
                  readOnly={readOnly}
                  showResults={status === "graded" || status === "submitted"}
                  studentId={studentId}
                />
              ) : (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
              )
            ) : (
              <>
                {/* Document preview */}
                <div className="bg-slate-100 p-3 rounded overflow-x-auto">
                  <div
                    className="eform-preview-page mx-auto bg-white shadow border max-w-none"
                    style={EFORM_PAGE_STYLE}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(assignment?.content_html || "") }}
                  />
                </div>

                {/* Answer form */}
                {fields.length > 0 && (
                  <div className="space-y-3 border-t pt-3">
                    <h3 className="font-semibold text-sm">ช่องตอบ</h3>
                    {fields.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <Label className="text-sm">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                        {f.type === "textarea" ? (
                          <Textarea disabled={readOnly} value={answers[f.key] || ""} onChange={(e) => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} rows={3} />
                        ) : f.type === "date" ? (
                          <Input type="date" disabled={readOnly} value={answers[f.key] || ""} onChange={(e) => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} />
                        ) : f.type === "number" ? (
                          <Input type="number" disabled={readOnly} value={answers[f.key] || ""} onChange={(e) => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} />
                        ) : f.type === "select" ? (
                          <Select value={answers[f.key] || ""} onValueChange={(v) => setAnswers(a => ({ ...a, [f.key]: v }))} disabled={readOnly}>
                            <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                            <SelectContent>
                              {(f.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : f.type === "radio" ? (
                          <RadioGroup value={answers[f.key] || ""} onValueChange={(v) => setAnswers(a => ({ ...a, [f.key]: v }))} disabled={readOnly}>
                            {(f.options || []).map(o => (
                              <div key={o} className="flex items-center gap-2">
                                <RadioGroupItem value={o} id={`${f.key}-${o}`} />
                                <Label htmlFor={`${f.key}-${o}`} className="text-sm font-normal">{o}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        ) : f.type === "checkbox" ? (
                          <div className="flex items-center gap-2">
                            <Checkbox checked={!!answers[f.key]} disabled={readOnly} onCheckedChange={(c) => setAnswers(a => ({ ...a, [f.key]: !!c }))} />
                            <span className="text-sm">{f.placeholder || "เลือก"}</span>
                          </div>
                        ) : (
                          <Input disabled={readOnly} value={answers[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* File attachments */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1"><Paperclip className="w-4 h-4" /> ไฟล์แนบ (รูป/PDF)</Label>
                {!readOnly && (
                  <label className="text-xs px-2 py-1 border rounded cursor-pointer hover:bg-muted">
                    เลือกไฟล์
                    <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              {attachments.length === 0 && <p className="text-xs text-muted-foreground">ยังไม่มีไฟล์</p>}
              {attachments.length > 0 && <AttachmentList attachments={attachments} dense />}
              {!readOnly && attachments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {attachments.map((a, i) => (
                    <Button key={a.id || a.path} size="sm" variant="ghost" className="h-7 text-xs" onClick={() => removeAttachment(i)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> ลบ {a.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-3 shrink-0">
          {readOnly ? (
            <span className="text-sm text-muted-foreground self-center">{status === "graded" ? "ตรวจแล้ว" : "ส่งแล้ว — รอตรวจ"}</span>
          ) : (
            <>
              <Button variant="outline" onClick={saveDraft} disabled={saving || submitting}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} บันทึกร่าง
              </Button>
              <Button onClick={submit} disabled={submitting || saving}>
                {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} ส่งงาน
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HomeworkAnswerDialog;
