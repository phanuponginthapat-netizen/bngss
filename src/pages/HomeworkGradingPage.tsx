import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, ListChecks, AlertTriangle } from "lucide-react";
import {
  StudentSubmissionRow,
  type SubmissionsMap,
  type Submission,
  type HistoryEntry,
} from "@/components/homework/HomeworkSubmission";
import { uploadHomeworkFile } from "@/lib/homeworkStorage";
import { toast } from "sonner";
import { notify } from "@/lib/notify";

export default function HomeworkGradingPage() {
  const { taskId = "" } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: hw, isLoading } = useQuery({
    queryKey: ["hw-task", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("id,title,description,due_date,assigned_date,classroom_id,submissions,subjects(name_th,code),classrooms(name)")
        .eq("id", taskId)
        .maybeSingle();
      return data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["hw-classroom-students", hw?.classroom_id],
    enabled: !!hw?.classroom_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id,prefix,first_name,last_name,student_code,auth_user_id")
        .eq("classroom_id", hw!.classroom_id!)
        .eq("status", "active")
        .order("student_code", { ascending: true });
      return data || [];
    },
  });

  const submissions: SubmissionsMap = (hw?.submissions as SubmissionsMap) || {};
  const submitted = useMemo(() => students.filter((s: any) => submissions[s.id]), [students, submissions]);
  const notSubmitted = useMemo(() => students.filter((s: any) => !submissions[s.id]), [students, submissions]);
  const graded = submitted.filter((s: any) => submissions[s.id]?.status === "graded");
  const pending = submitted.filter((s: any) => submissions[s.id]?.status === "submitted");
  const needsRev = submitted.filter((s: any) => submissions[s.id]?.status === "needs_revision");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && submitted[0]) setSelectedId(submitted[0].id);
  }, [submitted, selectedId]);

  const selectedIdx = submitted.findIndex((s: any) => s.id === selectedId);
  const goPrev = () => { if (selectedIdx > 0) setSelectedId(submitted[selectedIdx - 1].id); };
  const goNext = () => { if (selectedIdx >= 0 && selectedIdx < submitted.length - 1) setSelectedId(submitted[selectedIdx + 1].id); };

  const selectedStudent = submitted.find((s: any) => s.id === selectedId) || null;
  const selectedSub = selectedStudent ? submissions[selectedStudent.id] : null;

  const updateSubmission = async (studentId: string, patch: Partial<Submission>, historyAction?: HistoryEntry["action"]) => {
    const cur = submissions[studentId];
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
    const next: SubmissionsMap = { ...submissions, [studentId]: merged };
    const { error } = await supabase.from("task_assignments").update({ submissions: next as any }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["hw-task", taskId] });
    qc.invalidateQueries({ queryKey: ["homework-list"] });

    try {
      const student = students.find((s: any) => s.id === studentId);
      const studentUid = student?.auth_user_id;
      const subj = (hw as any)?.subjects?.name_th || (hw as any)?.subjects?.code || "วิชา";
      const title = hw?.title || "การบ้าน";
      let pushTitle = "", pushBody = "", type = "homework_update", dedup = "";
      if (patch.status === "graded") {
        pushTitle = `✅ ครูตรวจการบ้าน: ${title}`;
        pushBody = `${subj} · คะแนน ${patch.grade ?? "-"}${patch.feedback ? ` — ${patch.feedback}` : ""}`;
        type = "homework_graded"; dedup = `hw-grade-${taskId}-${studentId}`;
      } else if (patch.status === "needs_revision") {
        pushTitle = `↩️ การบ้านให้แก้ไข: ${title}`;
        pushBody = `${subj}${patch.feedback ? ` — ${patch.feedback}` : ""}`;
        type = "homework_returned"; dedup = `hw-return-${taskId}-${studentId}-${Date.now()}`;
      } else if (historyAction === "commented" && patch.feedback) {
        pushTitle = `💬 ครูคอมเมนต์การบ้าน: ${title}`;
        pushBody = `${subj} — ${patch.feedback}`;
        type = "homework_commented"; dedup = `hw-cmt-${taskId}-${studentId}-${Date.now()}`;
      } else if (patch.teacher_annotations) {
        pushTitle = `📝 ครูตรวจ/เขียนในใบงาน: ${title}`;
        pushBody = `${subj} — เปิดดูในระบบ`;
        type = "homework_annotated"; dedup = `hw-ann-${taskId}-${studentId}-${(patch.teacher_annotations || []).length}`;
      }
      if (pushTitle && studentUid) {
        await notify({
          user_ids: [studentUid], title: pushTitle, body: pushBody, type, severity: "info",
          reference_id: taskId, reference_type: "task_assignments",
          url: "/dashboard/homework", channels: ["in_app", "push", "line"], dedup_key: dedup,
        });
      }
    } catch (e) { console.warn("grade notify failed", e); }
  };

  const handleAnnotationSave = async (studentId: string, blob: Blob, filename: string) => {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      const att = await uploadHomeworkFile(file, `annotations/${taskId}/${studentId}`);
      const cur = submissions[studentId];
      if (!cur) return;
      const ann = [...(cur.teacher_annotations || []), { ...att, name: filename }];
      await updateSubmission(studentId, { teacher_annotations: ann });
      toast.success("บันทึกไฟล์ที่ตรวจแล้ว — นักเรียนจะเห็นทันที");
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    }
  };

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (!hw) return (
    <div className="space-y-3">
      <Button variant="ghost" onClick={() => navigate("/dashboard/homework")}><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Button>
      <Card><CardContent className="p-6 text-center text-muted-foreground">ไม่พบการบ้าน</CardContent></Card>
    </div>
  );

  const subjName = (hw as any).subjects?.name_th || (hw as any).subjects?.code || "วิชา";
  const className = (hw as any).classrooms?.name || "ห้อง";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/homework")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> กลับ
        </Button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /> {hw.title}</h1>
          <p className="text-sm text-muted-foreground">
            {subjName} · {className}
            {hw.due_date && ` · กำหนดส่ง ${new Date(hw.due_date).toLocaleDateString("th-TH")}`}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">ทั้งหมด</div><div className="text-2xl font-bold">{students.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">ส่งแล้ว</div><div className="text-2xl font-bold text-info">{submitted.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">ตรวจแล้ว</div><div className="text-2xl font-bold text-success">{graded.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">ยังไม่ส่ง</div><div className="text-2xl font-bold text-danger">{notSubmitted.length}</div></CardContent></Card>
      </div>

      {/* Full-page grading area */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2"><ListChecks className="w-4 h-4" /> ตรวจงานทีละคน</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={goPrev} disabled={selectedIdx <= 0}><ChevronLeft className="w-4 h-4" /></Button>
              <Select value={selectedId || ""} onValueChange={setSelectedId}>
                <SelectTrigger className="w-[280px] h-9"><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger>
                <SelectContent>
                  {submitted.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">ยังไม่มีนักเรียนส่งงาน</div>}
                  {submitted.map((s: any, i: number) => {
                    const sub = submissions[s.id];
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                        {s.prefix || ""}{s.first_name} {s.last_name}
                        {sub?.status === "graded" && <span className="ml-2 text-success">· {sub.grade ?? "-"}</span>}
                        {sub?.status === "submitted" && <span className="ml-2 text-info">· รอตรวจ</span>}
                        {sub?.status === "needs_revision" && <span className="ml-2 text-warning">· ให้แก้</span>}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={goNext} disabled={selectedIdx < 0 || selectedIdx >= submitted.length - 1}><ChevronRight className="w-4 h-4" /></Button>
              <span className="text-xs text-muted-foreground">{submitted.length > 0 && selectedIdx >= 0 ? `${selectedIdx + 1} / ${submitted.length}` : ""}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedStudent && selectedSub ? (
            <div className="text-sm">
              <StudentSubmissionRow
                student={selectedStudent}
                submission={selectedSub}
                onGrade={(g, fb) => updateSubmission(selectedStudent.id, { status: "graded", grade: g, feedback: fb, graded_at: new Date().toISOString() })}
                onReturn={(fb) => updateSubmission(selectedStudent.id, { status: "needs_revision", feedback: fb, returned_at: new Date().toISOString() })}
                onAnnotate={(blob, fn) => handleAnnotationSave(selectedStudent.id, blob, fn)}
                onComment={(c) => updateSubmission(selectedStudent.id, { feedback: c }, "commented")}
              />
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-10">
              {submitted.length === 0 ? "ยังไม่มีนักเรียนส่งงาน" : "เลือกนักเรียนจากเมนูด้านบน"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Scoreboard */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ListChecks className="w-4 h-4" /> ตารางคะแนนทั้งห้อง</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ-สกุล</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">คะแนน</TableHead>
                  <TableHead>คำติชม</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s: any, i: number) => {
                  const sub = submissions[s.id];
                  return (
                    <TableRow key={s.id} className={!sub ? "bg-danger/40" : ""}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                      <TableCell>{s.prefix || ""}{s.first_name} {s.last_name}</TableCell>
                      <TableCell>
                        {!sub && <Badge variant="outline" className="bg-danger-soft text-danger border-danger/30">ยังไม่ส่ง</Badge>}
                        {sub?.status === "submitted" && <Badge className="bg-info-soft text-info">รอตรวจ</Badge>}
                        {sub?.status === "graded" && <Badge className="bg-success-soft text-success">ตรวจแล้ว</Badge>}
                        {sub?.status === "needs_revision" && <Badge className="bg-warning-soft text-warning">ให้แก้</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{sub?.grade ?? "-"}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">{sub?.feedback || "-"}</TableCell>
                      <TableCell className="text-right">
                        {sub && (
                          <Button size="sm" variant="ghost" onClick={() => setSelectedId(s.id)}>เปิดตรวจ</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {students.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">ไม่มีนักเรียนในห้องนี้</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {notSubmitted.length > 0 && (
        <Card className="border-danger/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-danger"><AlertTriangle className="w-4 h-4" /> ยังไม่ส่ง ({notSubmitted.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {notSubmitted.map((s: any) => (
                <Badge key={s.id} variant="outline" className="bg-danger-soft">
                  {s.prefix || ""}{s.first_name} {s.last_name} <span className="ml-1 text-muted-foreground">({s.student_code})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
