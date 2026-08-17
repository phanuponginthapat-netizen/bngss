import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Undo2, CheckCircle2, RotateCcw, History, Paperclip, MessageSquare, Pencil, FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AttachmentUploader from "./AttachmentUploader";
import AttachmentList from "./AttachmentList";
import { uploadHomeworkFile, type Attachment } from "@/lib/homeworkStorage";
import { notify } from "@/lib/notify";
import { saveErrorMessage } from "@/lib/saveError";

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
  submitted:    { label: "ส่งงาน",          icon: Send,        color: "bg-sky-100 text-sky-700 border-sky-200" },
  resubmitted:  { label: "ส่งใหม่ (แก้ไข)", icon: RotateCcw,   color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  graded:       { label: "ครูให้คะแนน",     icon: CheckCircle2,color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  returned:     { label: "ครูส่งกลับให้แก้",icon: Undo2,       color: "bg-amber-100 text-amber-700 border-amber-200" },
  annotated:    { label: "ครูแก้ไข/เขียนในไฟล์", icon: Pencil, color: "bg-purple-100 text-purple-700 border-purple-200" },
  commented:    { label: "คอมเมนต์",        icon: MessageSquare, color: "bg-slate-100 text-slate-700 border-slate-200" },
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
                {typeof h.grade === "number" && <Badge className="bg-emerald-100 text-emerald-700">คะแนน {h.grade}</Badge>}
              </div>
              {h.text && <p className="text-xs mt-1 whitespace-pre-wrap bg-background/60 rounded px-2 py-1 border">{h.text}</p>}
              {h.feedback && (
                <p className="text-xs mt-1 whitespace-pre-wrap bg-background/60 rounded px-2 py-1 border border-amber-200">
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
  invalidateKeys?: any[][];
  readOnly?: boolean;
}

export function StudentSubmissionPanel({
  taskId, studentId, studentName, submissions, teacherAttachments = [], invalidateKeys = [], readOnly,
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
    if (error) { toast.error(saveErrorMessage(error)); return; }
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
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="w-3 h-3 mr-1" /> ได้คะแนนแล้ว: {mine.grade ?? "-"}
            </Badge>
          ) : (
            <Badge className="bg-sky-100 text-sky-700 border-sky-200">
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
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs space-y-1">
          <div className="flex items-center gap-1 font-semibold text-amber-800">
            <RotateCcw className="w-3.5 h-3.5" /> ครูส่งกลับให้แก้ไข
          </div>
          {mine.feedback && <p className="text-amber-900">ครู: {mine.feedback}</p>}
        </div>
      )}

      {teacherAttachments.length > 0 && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">ไฟล์การบ้าน (กดแก้ไขเพื่อพิมพ์/เขียนลงในไฟล์)</div>
          <AttachmentList attachments={teacherAttachments} canEdit onEditedSave={handleEditedSave} dense />
        </div>
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
  teacherAttachments?: Attachment[];
  assignmentTitle?: string;
  assignmentDescription?: string | null;
  assignmentDueDate?: string | null;
  assignmentMaxScore?: number | null;
}

export function TeacherGradingPanel({
  taskId,
  classroomId,
  submissions,
  invalidateKeys = [],
  teacherAttachments = [],
  assignmentTitle,
  assignmentDescription,
  assignmentDueDate,
  assignmentMaxScore,
}: TeacherProps) {
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
    if (error) { toast.error(saveErrorMessage(error)); return; }
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

  const [tab, setTab] = useState<"submitted" | "notSubmitted">("submitted");

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-muted/30 min-h-0 overscroll-contain">
      {/* Left rail — student roster */}
      <aside className="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r bg-card flex flex-col max-h-[30dvh] lg:max-h-none">
        <div className="p-3 shrink-0">
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            <button
              type="button"
              onClick={() => setTab("submitted")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === "submitted" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ส่งแล้ว {submitted.length}/{students.length}
            </button>
            <button
              type="button"
              onClick={() => setTab("notSubmitted")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === "notSubmitted" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ยังไม่ส่ง {notSubmitted.length}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">
          {tab === "submitted" && submitted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">ยังไม่มีนักเรียนส่งงาน</p>
          )}
          {tab === "submitted" && submitted.map((s: any) => {
            const sub = submissions![s.id];
            const active = s.id === selectedId;
            const statusBadge =
              sub.status === "graded" ? { cls: "bg-emerald-100 text-emerald-700 ring-emerald-200", label: `คะแนน ${sub.grade ?? "-"}` }
              : sub.status === "needs_revision" ? { cls: "bg-amber-100 text-amber-700 ring-amber-200", label: "ให้แก้" }
              : { cls: "bg-sky-100 text-sky-700 ring-sky-200", label: "รอตรวจ" };
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left p-3 rounded-xl transition-all relative ${
                  active
                    ? "bg-primary/5 border-2 border-primary shadow-sm"
                    : "border border-transparent hover:bg-muted/60 hover:border-border"
                }`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r" />}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className={`text-sm font-semibold truncate ${active ? "text-primary" : "text-foreground"}`}>
                    {s.prefix || ""}{s.first_name} {s.last_name}
                  </span>
                  <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full ring-1 ${statusBadge.cls}`}>
                    {statusBadge.label}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">รหัส {s.student_code}</span>
              </button>
            );
          })}
          {tab === "notSubmitted" && notSubmitted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">ส่งครบทุกคนแล้ว 🎉</p>
          )}
          {tab === "notSubmitted" && notSubmitted.map((s: any) => (
            <div key={s.id} className="p-3 rounded-xl border border-dashed border-border text-sm">
              <div className="font-medium text-muted-foreground truncate">{s.prefix || ""}{s.first_name} {s.last_name}</div>
              <div className="text-[11px] text-muted-foreground/70">รหัส {s.student_code}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main + right sidebar handled inside StudentSubmissionRow */}
      <div className="flex-none lg:flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden min-h-0">
        {selectedStudent && selectedSub ? (
          <StudentSubmissionRow
            student={selectedStudent}
            submission={selectedSub}
            teacherAttachments={teacherAttachments}
            onGrade={(grade, feedback) => updateSubmission(selectedStudent.id, { status: "graded", grade, feedback, graded_at: new Date().toISOString() })}
            onReturn={(feedback) => updateSubmission(selectedStudent.id, { status: "needs_revision", feedback, returned_at: new Date().toISOString() })}
            onAnnotate={(blob, filename) => handleAnnotationSave(selectedStudent.id, blob, filename)}
            onComment={(comment) => updateSubmission(selectedStudent.id, { feedback: comment }, "commented")}
            assignmentTitle={assignmentTitle}
            assignmentDescription={assignmentDescription}
            assignmentDueDate={assignmentDueDate}
            assignmentMaxScore={assignmentMaxScore}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground p-6 text-center text-sm">
            เลือกนักเรียนด้านบนเพื่อเริ่มตรวจงาน
          </div>
        )}
      </div>
    </div>
  );
}

function StudentSubmissionRow({
  student, submission, onGrade, onReturn, onAnnotate, onComment, teacherAttachments = [], assignmentTitle, assignmentDescription, assignmentDueDate, assignmentMaxScore,
}: {
  student: any;
  submission: Submission;
  onGrade: (grade: number, feedback?: string) => Promise<void>;
  onReturn: (feedback: string) => Promise<void>;
  onAnnotate?: (blob: Blob, filename: string) => Promise<void>;
  onComment?: (comment: string) => Promise<void>;
  teacherAttachments?: Attachment[];
  assignmentTitle?: string;
  assignmentDescription?: string | null;
  assignmentDueDate?: string | null;
  assignmentMaxScore?: number | null;
}) {
  const [grade, setGrade] = useState<string>(submission.grade?.toString() || "");
  const [feedback, setFeedback] = useState<string>(submission.feedback || "");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      {/* Center — submission preview */}
      <main className="flex-none lg:flex-1 overflow-visible lg:overflow-y-auto bg-background min-h-[42dvh] lg:min-h-0">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
          <header className="flex items-end justify-between gap-4 pb-4 border-b">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  {student.prefix || ""}{student.first_name} {student.last_name}
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                  รหัส {student.student_code}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {submission.status === "graded" && (
                  <>ตรวจแล้ว · คะแนน <span className="font-bold text-emerald-600">{submission.grade ?? "-"}{assignmentMaxScore != null && assignmentMaxScore > 0 ? ` / ${assignmentMaxScore}` : ""}</span></>
                )}
                {submission.status === "submitted" && "รอตรวจ"}
                {submission.status === "needs_revision" && "ส่งกลับให้แก้ไขแล้ว"}
                {submission.submitted_at && ` · ส่งเมื่อ ${new Date(submission.submitted_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {submission.status === "graded" && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">ตรวจแล้ว</Badge>}
              {submission.status === "submitted" && <Badge className="bg-sky-100 text-sky-700 border-sky-200">รอตรวจ</Badge>}
              {submission.status === "needs_revision" && <Badge className="bg-amber-100 text-amber-700 border-amber-200">ให้แก้ไข</Badge>}
            </div>
          </header>

          {(assignmentTitle || assignmentDescription || assignmentDueDate) && (
            <section className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">รายละเอียดงานที่ครูสั่ง</div>
              {assignmentTitle && <h3 className="text-base font-bold text-foreground leading-snug">{assignmentTitle}</h3>}
              {assignmentDescription && <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{assignmentDescription}</p>}
              {assignmentDueDate && (
                <div className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  กำหนดส่ง {new Date(assignmentDueDate).toLocaleDateString("th-TH")}
                </div>
              )}
            </section>
          )}

          {submission.text && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">ข้อความจากนักเรียน</div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{submission.text}</p>
            </div>
          )}

          {submission.attachments && submission.attachments.length > 0 && (

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  ไฟล์ที่นักเรียนส่ง ({submission.attachments.length})
                </h3>
                <span className="text-[11px] text-muted-foreground">กดที่ไฟล์เพื่อแก้ไข/เขียนลงในไฟล์</span>
              </div>
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <AttachmentList
                  attachments={submission.attachments}
                  canEdit={!!onAnnotate}
                  onEditedSave={async (blob, filename, src) => {
                    if (onAnnotate) await onAnnotate(blob, `ตรวจ-${filename || src.name}`);
                  }}
                />
              </div>
            </section>
          )}

          {!submission.text && (!submission.attachments || submission.attachments.length === 0) && (
            <section className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              ยังไม่พบข้อความหรือไฟล์งานที่นักเรียนส่งในรายการนี้
            </section>
          )}

          {teacherAttachments.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" /> ใบงาน/ไฟล์ที่ครูให้ ({teacherAttachments.length})
              </h3>
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <AttachmentList attachments={teacherAttachments} />
              </div>
            </section>
          )}

          {submission.teacher_annotations && submission.teacher_annotations.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <Pencil className="w-4 h-4" /> ไฟล์ที่ครูตรวจแล้ว ({submission.teacher_annotations.length})
              </h3>
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
                <AttachmentList
                  attachments={submission.teacher_annotations}
                  canEdit={!!onAnnotate}
                  onEditedSave={async (blob, filename, src) => {
                    if (onAnnotate) await onAnnotate(blob, filename || src.name);
                  }}
                />
              </div>
            </section>
          )}

          {submission.history && submission.history.length > 0 && (
            <section className="pt-2">
              <SubmissionTimeline history={submission.history} />
            </section>
          )}
        </div>
      </main>

      {/* Right — grading sidebar */}
      <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l bg-card flex flex-col lg:overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 flex-1">
          {(() => {
            const maxScore = assignmentMaxScore != null && assignmentMaxScore > 0 ? assignmentMaxScore : null;
            const gNum = grade === "" ? NaN : Number(grade);
            const overMax = maxScore != null && !Number.isNaN(gNum) && gNum > maxScore;
            const negative = !Number.isNaN(gNum) && gNum < 0;
            return (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">การให้คะแนน</label>
                  <div className={`rounded-2xl border bg-background p-5 shadow-sm ${overMax || negative ? "border-red-400 ring-2 ring-red-200" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-foreground">คะแนน</span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {maxScore != null ? `เต็ม ${maxScore}` : "ไม่กำหนดคะแนนเต็ม"}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={maxScore ?? undefined}
                      step="0.5"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="0"
                      className={`w-full text-5xl font-black outline-none border-none p-0 bg-transparent focus:ring-0 ${overMax || negative ? "text-red-600" : "text-primary"} placeholder:text-muted/40`}
                    />
                    {overMax && (
                      <div className="mt-2 text-xs font-semibold text-red-600">
                        ⚠️ ห้ามให้คะแนนเกิน {maxScore} คะแนน (ตอนนี้ {gNum})
                      </div>
                    )}
                    {negative && (
                      <div className="mt-2 text-xs font-semibold text-red-600">คะแนนต้องไม่ต่ำกว่า 0</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">คำติชมจากครู</label>
                  <Textarea
                    rows={6}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="เขียนคำแนะนำเพื่อพัฒนา..."
                    className="resize-none rounded-2xl text-sm leading-relaxed"
                  />
                </div>
              </>
            );
          })()}
        </div>

        <div className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3 border-t bg-card lg:sticky lg:bottom-0">
          <Button
            size="lg"
            disabled={busy}
            className="w-full h-14 text-base font-bold rounded-2xl shadow-lg gap-2"
            onClick={async () => {
              const g = Number(grade);
              if (Number.isNaN(g) || grade === "") { toast.error("กรอกคะแนนเป็นตัวเลข"); return; }
              if (g < 0) { toast.error("คะแนนต้องไม่ต่ำกว่า 0"); return; }
              const maxScore = assignmentMaxScore != null && assignmentMaxScore > 0 ? assignmentMaxScore : null;
              if (maxScore != null && g > maxScore) {
                toast.error(`ห้ามให้คะแนนเกินคะแนนเต็ม (${maxScore})`);
                return;
              }
              setBusy(true); await onGrade(g, feedback.trim() || undefined); setBusy(false);
              toast.success("บันทึกคะแนนแล้ว");
            }}
          >
            <CheckCircle2 className="w-5 h-5" /> ให้คะแนน
          </Button>

          <Button
            size="lg"
            variant="outline"
            disabled={busy}
            className="w-full h-11 font-bold rounded-2xl border-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 gap-2"
            onClick={async () => {
              if (!feedback.trim()) { toast.error("ใส่เหตุผลสั้นๆ ก่อนส่งกลับให้แก้"); return; }
              setBusy(true); await onReturn(feedback.trim()); setBusy(false);
              toast.success("ส่งกลับให้นักเรียนแก้ไขแล้ว");
            }}
          >
            <Undo2 className="w-4 h-4" /> ส่งกลับให้แก้ไข
          </Button>

          {onComment && (
            <div className="pt-3 border-t space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">คอมเมนต์เพิ่มเติม</label>
              <div className="flex gap-2">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="พิมพ์คอมเมนต์..."
                  className="flex-1 rounded-xl"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  disabled={busy || !comment.trim()}
                  className="rounded-xl shrink-0"
                  onClick={async () => {
                    setBusy(true); await onComment!(comment.trim()); setBusy(false); setComment("");
                    toast.success("ส่งคอมเมนต์แล้ว");
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
