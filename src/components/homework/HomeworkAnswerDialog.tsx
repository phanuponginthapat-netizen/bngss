import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Save, Paperclip, Trash2, Maximize, Minimize } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { useQueryClient } from "@tanstack/react-query";
import type { EFormField } from "@/lib/eformTemplate";
import { EFORM_PAGE_STYLE } from "@/lib/eformLayout";
import PdfWorksheetPlayer from "@/components/homework/PdfWorksheetPlayer";
import { gradeField, isWorksheetGradable, type WorksheetField } from "@/lib/pdfWorksheet";
import DOMPurify from "dompurify";
import { uploadHomeworkFile, type Attachment } from "@/lib/homeworkStorage";
import AttachmentList from "./AttachmentList";
import MediaCaptureButtons from "./MediaCaptureButtons";
import { saveErrorMessage } from "@/lib/saveError";
import { hasWorksheetAnswer } from "@/lib/worksheetGrading";
import { worksheetNotice } from "@/lib/worksheetNotifications";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignmentId: string | null;
  studentId: string | null;
  viewOnly?: boolean;
}

type AttachmentItem = Attachment;

export function HomeworkAnswerDialog({ open, onOpenChange, assignmentId, studentId, viewOnly }: Props) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assignment, setAssignment] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryLoad, setRetryLoad] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [fullWindow, setFullWindow] = useState(true);

  useEffect(() => { if (open) setFullWindow(true); }, [open]);

  const fields: EFormField[] = useMemo(() => (assignment?.answer_fields || []) as EFormField[], [assignment]);
  const worksheetFields: WorksheetField[] = useMemo(() => (assignment?.worksheet_fields || []) as WorksheetField[], [assignment]);
  const isPdfMode = !!assignment?.pdf_path;
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setLoadError(null); setAssignment(null); setPdfSignedUrl(null);
    setAnswers({}); setAttachments([]); setSubmissionId(null); setStatus("draft");
    (async () => {
      try {
        if (!assignmentId || !studentId) throw new Error("ไม่พบบัญชีนักเรียนหรือใบงาน");
        const { data: a, error: assignmentError } = await supabase.from("homework_assignments").select("*").eq("id", assignmentId).single();
        if (assignmentError) throw assignmentError;
        const { data: s, error: submissionError } = await supabase.from("homework_submissions" as any).select("*").eq("assignment_id", assignmentId).eq("student_id", studentId).maybeSingle();
        if (submissionError) throw submissionError;
        let url: string | null = null;
        if (a.pdf_path) {
          const { data: signed, error } = await supabase.storage.from("homework-files").createSignedUrl(a.pdf_path, 3600);
          if (error || !signed?.signedUrl) throw error || new Error("เปิด PDF ไม่สำเร็จ");
          url = signed.signedUrl;
        }
        if (!active) return;
        setAssignment(a); setPdfSignedUrl(url);
        setSubmissionId((s as any)?.id || null); setAnswers((s as any)?.answers || {});
        setAttachments((s as any)?.attachments || []); setStatus((s as any)?.status || "draft");
      } catch (error: any) { if (active) setLoadError(saveErrorMessage(error)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [open, assignmentId, studentId, retryLoad]);

  const upsert = async (nextStatus: "draft" | "submitted") => {
    if (viewOnly || !assignmentId || !studentId || loading || loadError || !assignment) throw new Error("ยังอ่านใบงานไม่สำเร็จหรือไม่มีสิทธิ์ส่งงาน");
    const { data: student, error: studentError } = await supabase.from("students").select("school_id").eq("id", studentId).single();
    if (studentError) throw studentError;
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
        if (!isWorksheetGradable(f)) continue;
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
      const { error } = await supabase.from("homework_submissions" as any).update(payload).eq("id", submissionId).select("id").single();
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
    if (isPdfMode) {
      const missing = worksheetFields.find(f => f.required && !hasWorksheetAnswer(f, answers[f.id]));
      if (missing) { toast.error(`กรอก "${missing.label || "ช่องคำตอบ"}" ก่อนส่ง`); return; }
    }
    if (!isPdfMode) {
      for (const f of fields) {
        if (f.required && (answers[f.key] === undefined || answers[f.key] === null || answers[f.key] === false || String(answers[f.key]).trim() === "")) { toast.error(`กรอก "${f.label}" ก่อนส่ง`); return; }
      }
    }
    setSubmitting(true);
    try {
      await upsert("submitted");
      setStatus("submitted");
      // notify teacher
      if (assignment?.created_by) {
        await notify(worksheetNotice("submitted", assignmentId || assignment.id, assignment.title, [assignment.created_by], `มีนักเรียนส่งใบงานใหม่`));
      }
      toast.success("ส่งงานสำเร็จ");
      qc.invalidateQueries({ queryKey: ["hw-submissions"] });
      onOpenChange(false);
    } catch (e: any) { toast.error(saveErrorMessage(e)); } finally { setSubmitting(false); }
  };

  const uploadFile = async (file: File) => {
    if (!studentId) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("ไฟล์ต้องไม่เกิน 10MB"); return; }
    setUploading(true);
    try {
      const att = await uploadHomeworkFile(file, `rich-submissions/${assignmentId || "assignment"}`);
      setAttachments((prev) => [...prev, att]);
    } catch (e: any) {
      toast.error(e?.message || "อัปโหลดไฟล์ไม่สำเร็จ");
    } finally { setUploading(false); }
  };

  const removeAttachment = async (i: number) => {
    // Detach locally; a previously saved draft may still reference this file until the next confirmed save.
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const readOnly = viewOnly || status === "submitted" || status === "graded";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className={`w-full max-w-none overflow-hidden flex flex-col gap-0 p-0 sm:p-0 sm:pt-0 sm:pb-0 ${fullWindow ? "h-[100dvh] sm:h-[100dvh] sm:max-h-[100dvh] rounded-none sm:rounded-none" : "h-[100dvh] sm:h-[92dvh] sm:max-h-[92dvh] sm:w-[92vw] sm:max-w-5xl"}`}>
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-3 pr-14 shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <DialogTitle className="min-w-0 text-left leading-snug line-clamp-2">{assignment?.title || "ทำใบงาน"}</DialogTitle>
          <Button type="button" variant="ghost" size="icon" className="shrink-0 hidden sm:inline-flex" title={fullWindow ? "ย่อหน้าต่างใบงาน" : "เต็มจอ"} aria-label={fullWindow ? "ย่อหน้าต่างใบงาน" : "เต็มจอ"} onClick={() => setFullWindow(v => !v)}>
            {fullWindow ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : loadError ? (
          <div className="py-6 space-y-2"><p className="text-destructive">{loadError}</p><Button variant="outline" onClick={() => setRetryLoad(v => v + 1)}>ลองใหม่</Button></div>
        ) : (
          <div className={`flex-1 min-h-0 ${isPdfMode ? "flex flex-col overflow-hidden" : "overflow-auto space-y-4 p-4"}`}>
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
                  workspace
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
                          <Textarea disabled={readOnly} value={answers[f.key] ?? ""} onChange={(e) => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} rows={3} />
                        ) : f.type === "date" ? (
                          <Input type="date" disabled={readOnly} value={answers[f.key] ?? ""} onChange={(e) => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} />
                        ) : f.type === "number" ? (
                          <Input type="number" disabled={readOnly} value={answers[f.key] ?? ""} onChange={(e) => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} />
                        ) : f.type === "select" ? (
                          <Select value={answers[f.key] ?? ""} onValueChange={(v) => setAnswers(a => ({ ...a, [f.key]: v }))} disabled={readOnly}>
                            <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                            <SelectContent>
                              {(f.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : f.type === "radio" ? (
                          <RadioGroup value={answers[f.key] ?? ""} onValueChange={(v) => setAnswers(a => ({ ...a, [f.key]: v }))} disabled={readOnly}>
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
                          <Input disabled={readOnly} value={answers[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setAnswers(a => ({ ...a, [f.key]: e.target.value }))} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* File attachments */}
            <details className="border-t shrink-0 bg-background">
              <summary className="cursor-pointer px-4 py-2 text-sm font-medium">ไฟล์แนบ{attachments.length > 0 ? ` (${attachments.length})` : ""}</summary>
            <div className="space-y-2 px-4 pb-3 max-h-[25dvh] overflow-auto">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-semibold flex items-center gap-1"><Paperclip className="w-4 h-4" /> ไฟล์แนบ</Label>
                {!readOnly && (
                  <label className="text-xs px-2 py-1 border rounded cursor-pointer hover:bg-muted">
                    เลือกไฟล์
                    <input type="file" disabled={saving || submitting || uploading} className="hidden" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              {!readOnly && <MediaCaptureButtons disabled={loading || !!loadError || saving || submitting || uploading} maxSizeMB={10} onCaptured={async file => {
                setUploading(true);
                try {
                  const att = await uploadHomeworkFile(file, `rich-submissions/${assignmentId || "assignment"}`);
                  setAttachments(prev => [...prev, att]);
                } finally { setUploading(false); }
              }} />}
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
            </details>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 bg-background">
          {readOnly ? (
            <span className="text-sm text-muted-foreground self-center">{viewOnly ? "ดูใบงานของลูก" : status === "graded" ? "ตรวจแล้ว" : "ส่งแล้ว — รอตรวจ"}</span>
          ) : (
            <>
              <Button variant="outline" onClick={saveDraft} disabled={loading || !!loadError || saving || submitting || uploading}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} บันทึกร่าง
              </Button>
              <Button onClick={submit} disabled={loading || !!loadError || submitting || saving || uploading}>
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
