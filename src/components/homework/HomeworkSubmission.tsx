import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Undo2, CheckCircle2, RotateCcw, History, Paperclip, MessageSquare, Pencil, FileCheck2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AttachmentUploader from "./AttachmentUploader";
import AttachmentList from "./AttachmentList";
import { uploadHomeworkFile, type Attachment } from "@/lib/homeworkStorage";
import { notify } from "@/lib/notify";
import WorksheetPlayer from "@/components/worksheets/WorksheetPlayer";

export type HistoryEntry = {
  at: string;
  by: "student" | "teacher";
  action: "submitted" | "resubmitted" | "graded" | "returned" | "annotated" | "commented";
  text?: string;
  attachments?: Attachment[];
  feedback?: string;
  grade?: number | null;
};

const actionMeta: Record<HistoryEntry["action"], { label: string; icon: any; color: string }> = {
  submitted:    { label: "ส่งงาน",          icon: Send,        color: "bg-info-soft text-info border-info/30" },
  resubmitted:  { label: "ส่งใหม่ (แก้ไข)", icon: RotateCcw,   color: "bg-info-soft text-info border-info/30" },
  graded:       { label: "ครูให้คะแนน",     icon: CheckCircle2,color: "bg-success-soft text-success border-success/30" },
  returned:     { label: "ครูส่งกลับให้แก้",icon: Undo2,       color: "bg-warning-soft text-warning border-warning/30" },
  annotated:    { label: "ครูแก้ไข/เขียนในไฟล์", icon: Pencil, color: "bg-info-soft text-info border-info/30" },
  commented:    { label: "คอมเมนต์",        icon: MessageSquare, color: "bg-neutral-soft text-neutral border-neutral/30" },
};

function SubmissionTimeline({ history }: { history?: HistoryEntry[] }) {
  if (!history || history.length === 0) return null;
  const sorted = [...history].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <div className="border rounded-md p-2 bg-muted/20 space-y-2">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
        <History className="w-3.5 h-3.5" /> ประวัติการส่ง/แก้ไข/คอมเมนต์ ({history.length})
      </div>
      <ol className="relative border-l-2 border-border ml-2 space-y-2">
        {sorted.map((h, i) => {
          const meta = actionMeta[h.action];
          const Icon = meta?.icon || FileCheck2;
          return (
            <li key={i} className="ml-3 pl-2">
              <span className="absolute -left-[7px] mt-1 w-3 h-3 rounded-full bg-background border-2 border-primary" />
              <div className="flex items-center gap-1 flex-wrap text-[11px]">
                <Badge variant="outline" className={meta?.color || ""}><Icon className="w-3 h-3 mr-1" />{meta?.label || h.action}</Badge>
                <span className="text-muted-foreground">
                  · {h.by === "teacher" ? "ครู" : "นักเรียน"}
                  · {new Date(h.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </span>
                {typeof h.grade === "number" && <Badge className="bg-success-soft text-success">คะแนน {h.grade}</Badge>}
              </div>
              {h.text && <p className="text-xs mt-1 whitespace-pre-wrap bg-background/60 rounded px-2 py-1 border">{h.text}</p>}
              {h.feedback && (
                <p className="text-xs mt-1 whitespace-pre-wrap bg-background/60 rounded px-2 py-1 border border-warning/30">
                  <MessageSquare className="w-3 h-3 inline mr-1" />{h.feedback}
                </p>
              )}
              {h.attachments && h.attachments.length > 0 && (
                <div className="mt-1">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Paperclip className="w-3 h-3" />ไฟล์แนบ ({h.attachments.length})</div>
                  <AttachmentList attachments={h.attachments} dense />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export type Submission = {
  status: "submitted" | "needs_revision" | "graded";
  submitted_at: string;
  text?: string;
  attachments?: Attachment[];
  grade?: number | null;
  feedback?: string;
  graded_at?: string;
  returned_at?: string;
  teacher_annotations?: Attachment[]; // files the teacher edited/annotated on top of student's work
  history?: HistoryEntry[];
};

export type SubmissionsMap = Record<string, Submission>;

interface StudentProps {
  taskId: string;
  studentId: string;
  studentName: string;
  submissions: SubmissionsMap;
  teacherAttachments?: Attachment[];
  worksheetId?: string | null;
  invalidateKeys?: any[][];
  readOnly?: boolean;
}

export function StudentSubmissionPanel({
  taskId, studentId, studentName, submissions, teacherAttachments = [], worksheetId, invalidateKeys = [], readOnly,
}: StudentProps) {
  const qc = useQueryClient();
  const mine = submissions?.[studentId];
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (extraAttachments: Attachment[] = []) => {
    const merged = [...pending, ...extraAttachments];
    if (!text.trim() && merged.length === 0) {
      toast.error("พิมพ์ข้อความหรือแนบไฟล์อย่างน้อย 1 อย่าง");
      return;
    }
    setBusy(true);
    const isResubmit = !!mine;
    const now = new Date().toISOString();
    const prevHistory = mine?.history || [];
    const entry: HistoryEntry = {
      at: now,
      by: "student",
      action: isResubmit ? "resubmitted" : "submitted",
      text: text.trim() || undefined,
      attachments: merged.length ? merged : undefined,
    };
    const next: SubmissionsMap = {
      ...(submissions || {}),
      [studentId]: {
        status: "submitted",
        submitted_at: now,
        text: text.trim() || undefined,
        attachments: merged,
        grade: mine?.grade ?? null,
        feedback: mine?.feedback,
        teacher_annotations: mine?.teacher_annotations,
        history: [...prevHistory, entry],
      },
    };
    const { error } = await supabase.from("task_assignments").update({ submissions: next as any }).eq("id", taskId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setText(""); setPending([]);
    toast.success("ส่งงานเรียบร้อย");
    invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));

    // Notify the teacher who assigned this homework — realtime in-app + push + LINE
    try {
      const { data: task } = await supabase
        .from("task_assignments")
        .select("title, assigned_by, subjects(name_th,code), classrooms(name)")
        .eq("id", taskId)
        .maybeSingle();
      const teacherId = (task as any)?.assigned_by;
      if (teacherId) {
        const subj = (task as any)?.subjects?.name_th || (task as any)?.subjects?.code || "วิชา";
        const room = (task as any)?.classrooms?.name || "";
        await notify({
          user_ids: [teacherId],
          title: `📥 นักเรียนส่งการบ้าน: ${task?.title || ""}`.trim(),
          body: `${studentName} (${room}) · ${subj}`,
          type: "homework_submitted",
          severity: "info",
          reference_id: taskId,
          reference_type: "task_assignments",
          url: "/dashboard/homework",
          channels: ["in_app", "push", "line"],
          dedup_key: `hw-sub-${taskId}-${studentId}`,
        });
      }
    } catch (e) { console.warn("submit notify failed", e); }
  };

  const handleEditedSave = async (blob: Blob, filename: string) => {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      const att = await uploadHomeworkFile(file, `submissions/${taskId}`);
      toast.success("กำลังแนบไฟล์ที่แก้ไข...");
      await submit([{ ...att, name: filename }]);
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    }
  };

  // Submitted (and not asked to revise) → show only summary
  if (mine?.status === "submitted" || mine?.status === "graded") {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {mine.status === "graded" ? (
            <Badge className="bg-success-soft text-success border-success/30">
              <CheckCircle2 className="w-3 h-3 mr-1" /> ได้คะแนนแล้ว: {mine.grade ?? "-"}
            </Badge>
          ) : (
            <Badge className="bg-info-soft text-info border-info/30">
              <CheckCircle2 className="w-3 h-3 mr-1" /> ส่งแล้ว
            </Badge>
          )}
          <span className="text-muted-foreground">
            {new Date(mine.submitted_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
        {mine.feedback && <p className="bg-muted/40 p-2 rounded text-foreground">ครู: {mine.feedback}</p>}
        {mine.attachments && mine.attachments.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">งานที่ส่ง</div>
            <AttachmentList attachments={mine.attachments} dense />
          </div>
        )}
        {mine.teacher_annotations && mine.teacher_annotations.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-primary">📝 ครูตรวจ / แก้ไขให้</div>
            <AttachmentList attachments={mine.teacher_annotations} dense />
          </div>
        )}
        <SubmissionTimeline history={mine.history} />
      </div>
    );
  }

  // Needs revision OR not yet submitted → show submit form (or read-only for parents)
  if (readOnly) {
    return (
      <div className="text-xs text-muted-foreground space-y-1">
        {mine?.status === "needs_revision" ? (
          <p>⚠️ ครูส่งกลับให้บุตรหลานแก้ไข{mine.feedback ? ` — ${mine.feedback}` : ""}</p>
        ) : (
          <p>ยังไม่ส่งงาน</p>
        )}
        {teacherAttachments.length > 0 && <AttachmentList attachments={teacherAttachments} dense />}
        <SubmissionTimeline history={mine?.history} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mine?.status === "needs_revision" && (
        <div className="rounded-md border border-warning/30 bg-warning-soft p-2 text-xs space-y-1">
          <div className="flex items-center gap-1 font-semibold text-warning">
            <RotateCcw className="w-3.5 h-3.5" /> ครูส่งกลับให้แก้ไข
          </div>
          {mine.feedback && <p className="text-warning">ครู: {mine.feedback}</p>}
        </div>
      )}

      {teacherAttachments.length > 0 && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">ไฟล์การบ้าน (กดแก้ไขเพื่อพิมพ์/เขียนลงในไฟล์)</div>
          <AttachmentList attachments={teacherAttachments} canEdit onEditedSave={handleEditedSave} dense />
        </div>
      )}

      {worksheetId && (
        <WorksheetRunnerButton
          worksheetId={worksheetId}
          onComplete={async ({ score, total, answers }) => {
            const now = new Date().toISOString();
            const entry: HistoryEntry = {
              at: now, by: "student", action: mine ? "resubmitted" : "submitted",
              text: `ทำใบงานออนไลน์ — ${score}/${total}`, grade: score,
            };
            const next: SubmissionsMap = {
              ...(submissions || {}),
              [studentId]: {
                status: "graded",
                submitted_at: now,
                grade: score,
                feedback: `ทำใบงานอัตโนมัติ — ${score}/${total}`,
                text: JSON.stringify({ kind: "worksheet", score, total, answers }),
                attachments: [],
                history: [...(mine?.history || []), entry,
                  { at: now, by: "teacher", action: "graded", grade: score, feedback: "ตรวจอัตโนมัติจากใบงาน" }],
              },
            };
            const { error } = await supabase.from("task_assignments").update({ submissions: next as any }).eq("id", taskId);
            if (error) { toast.error(error.message); return; }
            invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
          }}
        />
      )}

      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์คำตอบ หรือบันทึกถึงครู..." className="text-sm" />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <AttachmentUploader folder={`submissions/${taskId}`} value={pending} onChange={setPending} maxFiles={5} label="แนบไฟล์งาน" />
        <Button size="sm" onClick={() => submit()} disabled={busy}>
          <Send className="w-3.5 h-3.5 mr-1" /> ส่งงาน
        </Button>
      </div>
      <SubmissionTimeline history={mine?.history} />
    </div>
  );
}

interface TeacherProps {
  taskId: string;
  classroomId: string | null;
  submissions: SubmissionsMap;
  invalidateKeys?: any[][];
}

export function TeacherGradingPanel({ taskId, classroomId, submissions, invalidateKeys = [] }: TeacherProps) {
  const qc = useQueryClient();
  const { data: students = [] } = useQuery({
    queryKey: ["hw-classroom-students", classroomId],
    enabled: !!classroomId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id,prefix,first_name,last_name,student_code,auth_user_id")
        .eq("classroom_id", classroomId!)
        .eq("status", "active")
        .order("student_code", { ascending: true });
      return data || [];
    },
  });

  const updateSubmission = async (studentId: string, patch: Partial<Submission>, historyAction?: HistoryEntry["action"]) => {
    const cur = submissions?.[studentId];
    if (!cur) { toast.error("นักเรียนยังไม่ได้ส่งงาน"); return; }
    const prevHistory = cur.history || [];
    const action: HistoryEntry["action"] | undefined = historyAction
      || (patch.status === "graded" ? "graded"
        : patch.status === "needs_revision" ? "returned"
        : patch.teacher_annotations ? "annotated"
        : undefined);
    const entry: HistoryEntry | null = action ? {
      at: new Date().toISOString(),
      by: "teacher",
      action,
      feedback: patch.feedback,
      grade: patch.grade ?? undefined,
      attachments: action === "annotated" ? patch.teacher_annotations : undefined,
    } : null;
    const merged: Submission = { ...cur, ...patch, history: entry ? [...prevHistory, entry] : prevHistory };
    const next: SubmissionsMap = { ...(submissions || {}), [studentId]: merged };
    const { error } = await supabase.from("task_assignments").update({ submissions: next as any }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));

    // Notify the student (and parent) — realtime
    try {
      const student = students.find((s: any) => s.id === studentId);
      const studentUid = student?.auth_user_id;
      const { data: task } = await supabase
        .from("task_assignments")
        .select("title, subjects(name_th,code)")
        .eq("id", taskId)
        .maybeSingle();
      const subj = (task as any)?.subjects?.name_th || (task as any)?.subjects?.code || "วิชา";
      const title = (task as any)?.title || "การบ้าน";

      let pushTitle = "", pushBody = "", type = "homework_update", dedup = "";
      if (patch.status === "graded") {
        pushTitle = `✅ ครูตรวจการบ้าน: ${title}`;
        pushBody = `${subj} · คะแนน ${patch.grade ?? "-"}${patch.feedback ? ` — ${patch.feedback}` : ""}`;
        type = "homework_graded";
        dedup = `hw-grade-${taskId}-${studentId}`;
      } else if (patch.status === "needs_revision") {
        pushTitle = `↩️ การบ้านให้แก้ไข: ${title}`;
        pushBody = `${subj}${patch.feedback ? ` — ${patch.feedback}` : ""}`;
        type = "homework_returned";
        dedup = `hw-return-${taskId}-${studentId}-${Date.now()}`;
      } else if (patch.teacher_annotations) {
        pushTitle = `📝 ครูตรวจ/เขียนในใบงาน: ${title}`;
        pushBody = `${subj} — เปิดดูในระบบ`;
        type = "homework_annotated";
        dedup = `hw-ann-${taskId}-${studentId}-${(patch.teacher_annotations || []).length}`;
      } else if (historyAction === "commented" && patch.feedback) {
        pushTitle = `💬 ครูคอมเมนต์การบ้าน: ${title}`;
        pushBody = `${subj} — ${patch.feedback}`;
        type = "homework_commented";
        dedup = `hw-cmt-${taskId}-${studentId}-${Date.now()}`;
      }

      if (pushTitle && studentUid) {
        await notify({
          user_ids: [studentUid],
          title: pushTitle,
          body: pushBody,
          type,
          severity: "info",
          reference_id: taskId,
          reference_type: "task_assignments",
          url: "/dashboard/homework",
          channels: ["in_app", "push", "line"],
          dedup_key: dedup,
        });
      }
    } catch (e) { console.warn("grade notify failed", e); }
  };

  const submitted = students.filter((s: any) => submissions?.[s.id]);
  const notSubmitted = students.filter((s: any) => !submissions?.[s.id]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Auto-select the first submitted student when list becomes available
  if (!selectedId && submitted[0]) {
    // safe: this triggers only when submitted.length flips to >=1
    queueMicrotask(() => setSelectedId(submitted[0].id));
  }
  const selectedStudent = submitted.find((s: any) => s.id === selectedId) || null;
  const selectedSub = selectedStudent ? submissions![selectedStudent.id] : null;

  const handleAnnotationSave = async (studentId: string, blob: Blob, filename: string) => {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      const att = await uploadHomeworkFile(file, `annotations/${taskId}/${studentId}`);
      const cur = submissions?.[studentId];
      if (!cur) return;
      const ann = [...(cur.teacher_annotations || []), { ...att, name: filename }];
      await updateSubmission(studentId, { teacher_annotations: ann });
      toast.success("บันทึกไฟล์ที่ตรวจแล้ว — นักเรียนจะเห็นทันที");
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Badge variant="outline">ส่งแล้ว {submitted.length}/{students.length}</Badge>
        <Badge variant="outline">ยังไม่ส่ง {notSubmitted.length}</Badge>
      </div>

      {submitted.length === 0 && <p className="text-muted-foreground py-4 text-center">ยังไม่มีนักเรียนส่งงาน</p>}

      {submitted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
          {/* Left: student list */}
          <div className="border rounded-md divide-y max-h-[60vh] overflow-auto">
            {submitted.map((s: any) => {
              const sub = submissions![s.id];
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left px-2 py-1.5 hover:bg-muted/50 ${active ? "bg-primary/10" : ""}`}
                >
                  <div className="font-medium truncate">{s.prefix || ""}{s.first_name} {s.last_name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{s.student_code}</span>
                    {sub.status === "graded" && <Badge className="bg-success-soft text-success h-4 text-[10px]">{sub.grade ?? "-"}</Badge>}
                    {sub.status === "submitted" && <Badge className="bg-info-soft text-info h-4 text-[10px]">รอตรวจ</Badge>}
                    {sub.status === "needs_revision" && <Badge className="bg-warning-soft text-warning h-4 text-[10px]">ให้แก้</Badge>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: detail / grading */}
          <div>
            {selectedStudent && selectedSub ? (
              <StudentSubmissionRow
                student={selectedStudent}
                submission={selectedSub}
                onGrade={(grade, feedback) => updateSubmission(selectedStudent.id, { status: "graded", grade, feedback, graded_at: new Date().toISOString() })}
                onReturn={(feedback) => updateSubmission(selectedStudent.id, { status: "needs_revision", feedback, returned_at: new Date().toISOString() })}
                onAnnotate={(blob, filename) => handleAnnotationSave(selectedStudent.id, blob, filename)}
                onComment={(comment) => updateSubmission(selectedStudent.id, { feedback: comment }, "commented")}
              />
            ) : (
              <p className="text-muted-foreground p-4 text-center">เลือกนักเรียนเพื่อตรวจงาน</p>
            )}
          </div>
        </div>
      )}

      {notSubmitted.length > 0 && (
        <details className="border rounded-md p-2">
          <summary className="cursor-pointer text-muted-foreground">ยังไม่ส่ง ({notSubmitted.length})</summary>
          <ul className="mt-2 space-y-0.5">
            {notSubmitted.map((s: any) => (
              <li key={s.id}>• {s.prefix || ""}{s.first_name} {s.last_name} <span className="text-muted-foreground">({s.student_code})</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function StudentSubmissionRow({
  student, submission, onGrade, onReturn, onAnnotate, onComment,
}: {
  student: any;
  submission: Submission;
  onGrade: (grade: number, feedback?: string) => Promise<void>;
  onReturn: (feedback: string) => Promise<void>;
  onAnnotate?: (blob: Blob, filename: string) => Promise<void>;
  onComment?: (comment: string) => Promise<void>;
}) {
  const [grade, setGrade] = useState<string>(submission.grade?.toString() || "");
  const [feedback, setFeedback] = useState<string>(submission.feedback || "");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="border border-border rounded-md p-2 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-medium">{student.prefix || ""}{student.first_name} {student.last_name}
          <span className="ml-2 text-[10px] text-muted-foreground">{student.student_code}</span>
        </div>
        <div className="flex items-center gap-1">
          {submission.status === "graded" && <Badge className="bg-success-soft text-success">ตรวจแล้ว {submission.grade ?? "-"}</Badge>}
          {submission.status === "submitted" && <Badge className="bg-info-soft text-info">รอตรวจ</Badge>}
          {submission.status === "needs_revision" && <Badge className="bg-warning-soft text-warning">ให้แก้ไข</Badge>}
        </div>
      </div>
      {submission.text && <p className="bg-muted/40 rounded p-1.5 text-foreground whitespace-pre-wrap">{submission.text}</p>}
      {submission.attachments && submission.attachments.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">ไฟล์ที่นักเรียนส่ง (กดแก้ไขเพื่อตรวจ/เขียนลงในไฟล์)</div>
          <AttachmentList
            attachments={submission.attachments}
            dense
            canEdit={!!onAnnotate}
            onEditedSave={async (blob, filename, src) => {
              if (onAnnotate) await onAnnotate(blob, `ตรวจ-${filename || src.name}`);
            }}
          />
        </div>
      )}
      {submission.teacher_annotations && submission.teacher_annotations.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-primary">ไฟล์ที่ครูตรวจแล้ว</div>
          <AttachmentList
            attachments={submission.teacher_annotations}
            dense
            canEdit={!!onAnnotate}
            onEditedSave={async (blob, filename, src) => {
              if (onAnnotate) await onAnnotate(blob, filename || src.name);
            }}
          />
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="คะแนน" className="h-8 w-24" />
        <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="คำติชม (ถ้ามี)" className="h-8 flex-1 min-w-[160px]" />
        <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
          if (!feedback.trim()) { toast.error("ใส่เหตุผลสั้นๆ ก่อนส่งกลับให้แก้"); return; }
          setBusy(true); await onReturn(feedback.trim()); setBusy(false);
          toast.success("ส่งกลับให้นักเรียนแก้ไขแล้ว");
        }}>
          <Undo2 className="w-3.5 h-3.5 mr-1" /> ส่งกลับให้แก้
        </Button>
        <Button size="sm" disabled={busy} onClick={async () => {
          const g = Number(grade);
          if (Number.isNaN(g)) { toast.error("กรอกคะแนนเป็นตัวเลข"); return; }
          setBusy(true); await onGrade(g, feedback.trim() || undefined); setBusy(false);
          toast.success("บันทึกคะแนนแล้ว");
        }}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> ให้คะแนน
        </Button>
      </div>

      {onComment && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="เพิ่มคอมเมนต์ถึงนักเรียน..." className="h-8 flex-1" />
          <Button size="sm" variant="secondary" disabled={busy || !comment.trim()} onClick={async () => {
            setBusy(true); await onComment(comment.trim()); setBusy(false); setComment("");
            toast.success("ส่งคอมเมนต์แล้ว");
          }}>
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> ส่งคอมเมนต์
          </Button>
        </div>
      )}

      <SubmissionTimeline history={submission.history} />
    </div>
  );
}

function WorksheetRunnerButton({
  worksheetId,
  onComplete,
}: {
  worksheetId: string;
  onComplete: (r: { score: number; total: number; answers: Record<string, string> }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [ws, setWs] = useState<any>(null);
  useEffect(() => {
    if (!open || ws) return;
    (async () => {
      const { data } = await supabase
        .from("worksheets")
        .select("id,title,description,grade_level,questions,source_url,source_type")
        .eq("id", worksheetId)
        .maybeSingle();
      setWs(data);
    })();
  }, [open, worksheetId, ws]);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1">
        <FileSpreadsheet className="w-3.5 h-3.5" /> ทำใบงานออนไลน์
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ws?.title || "ใบงาน"}</DialogTitle></DialogHeader>
          {ws ? (
            <WorksheetPlayer
              worksheet={ws}
              hideStudentInfo
              onSubmitted={async (r) => {
                await onComplete(r);
                setTimeout(() => setOpen(false), 1500);
              }}
            />
          ) : (
            <div className="py-10 text-center text-muted-foreground">กำลังโหลด...</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
