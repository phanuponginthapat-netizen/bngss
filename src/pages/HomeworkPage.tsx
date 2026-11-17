import { swal } from "@/lib/swal";
import { useState, useMemo } from "react";
import { useParentChildren } from "@/hooks/useParentChildren";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Loader2, Trash2, Pencil, Paperclip, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import AttachmentUploader from "@/components/homework/AttachmentUploader";
import AttachmentList from "@/components/homework/AttachmentList";
import HomeworkRichDesignerDialog from "@/components/homework/HomeworkRichDesignerDialog";
import HomeworkAnswerDialog from "@/components/homework/HomeworkAnswerDialog";
import HomeworkSubmissionsDialog from "@/components/homework/HomeworkSubmissionsDialog";
import HomeworkToolsBar from "@/components/homework/HomeworkToolsBar";
import { Sparkles, FileEdit, ClipboardList } from "lucide-react";

import { StudentSubmissionPanel, TeacherGradingPanel, type SubmissionsMap } from "@/components/homework/HomeworkSubmission";
import { type Attachment } from "@/lib/homeworkStorage";
import { saveErrorMessage } from "@/lib/saveError";

function TeacherAttachmentsList({ items }: { items: Attachment[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
        <Paperclip className="w-3.5 h-3.5" /> ไฟล์แนบ ({items.length})
      </div>
      <AttachmentList attachments={items} dense />
    </div>
  );
}

const HomeworkPage = () => {
  const { role, userId, isTeacher, isStudent, isParent, isAdmin, isDirector } = useUserRole();
  const qc = useQueryClient();
  const canCreate = isTeacher || isAdmin || isDirector;
  const isStudentLike = isStudent || isParent; // parent views child's homework

  // Resolve current name (for replies attribution)
  const { data: me } = useQuery({
    queryKey: ["hw-me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name,last_name,student_code,employee_code")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
  });

  // Parent: resolve linked children (returns student rows with classroom_id)
  const { children: parentChildren } = useParentChildren();

  // Student: resolve student record by auth_user_id (primary) → student_code (fallback)
  const { data: studentRow } = useQuery({
    queryKey: ["hw-student-row", userId, me?.student_code, isParent, parentChildren?.[0]?.id],
    enabled: isStudentLike && !!userId,
    queryFn: async () => {
      // Parent: pick the first linked child (homework currently shows a single context)
      if (isParent) {
        return parentChildren?.[0] ? { id: parentChildren[0].id, classroom_id: parentChildren[0].classroom_id } : null;
      }
      // Student: try auth_user_id first
      const { data: byAuth } = await supabase
        .from("students")
        .select("id,classroom_id")
        .eq("auth_user_id", userId!)
        .maybeSingle();
      if (byAuth) return byAuth;
      // Fallback: by student_code
      if (me?.student_code) {
        const { data } = await supabase
          .from("students")
          .select("id,classroom_id")
          .eq("student_code", me.student_code)
          .maybeSingle();
        return data;
      }
      return null;
    },
  });

  // Teacher: resolve personnel.id then their subjects/classrooms via teacher_assignments
  const { data: personnelRow } = useQuery({
    queryKey: ["hw-personnel", userId, me?.employee_code],
    enabled: canCreate && !!userId,
    queryFn: async () => {
      const { data: byUser } = await supabase.from("personnel").select("id,prefix,first_name,last_name").eq("user_id", userId!).maybeSingle();
      if (byUser) return byUser;

      if (me?.employee_code) {
        const { data: byCode } = await supabase
          .from("personnel")
          .select("id,prefix,first_name,last_name")
          .eq("employee_code", me.employee_code)
          .maybeSingle();
        if (byCode) return byCode;
      }

      return null;
    },
  });
  const { data: teacherAssign = [] } = useQuery({
    queryKey: ["hw-teacher-assign", personnelRow?.id, userId, role],
    enabled: canCreate && !!userId,
    queryFn: async () => {
      const map = new Map<string, any>();
      const push = (row: any) => {
        if (!row?.subject_id || !row?.classroom_id) return;
        const k = `${row.subject_id}|${row.classroom_id}`;
        if (!map.has(k)) map.set(k, row);
      };
      // 1) teacher_assignments (by personnel)
      if (personnelRow?.id) {
        const { data } = await supabase
          .from("teacher_assignments")
          .select("subject_id,classroom_id,subjects(name_th,code),classrooms(name)")
          .eq("personnel_id", personnelRow.id);
        (data || []).forEach(push);
      }
      // 2) schedules (teacher_id stores personnel.id in this project)
      if (personnelRow?.id) {
        const { data: sch } = await supabase
          .from("schedules")
          .select("subject_id,classroom_id,subjects(name_th,code),classrooms(name)")
          .eq("teacher_id", personnelRow.id);
        (sch || []).forEach(push);
      }
      // 3) fallback by teacher_name for older/imported schedule rows
      const teacherName = personnelRow
        ? `${personnelRow.prefix || ""}${personnelRow.first_name || ""} ${personnelRow.last_name || ""}`.trim()
        : [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim();
      if (teacherName) {
        const { data: byName } = await supabase
          .from("schedules")
          .select("subject_id,classroom_id,subjects(name_th,code),classrooms(name)")
          .eq("teacher_name", teacherName);
        (byName || []).forEach(push);
      }
      // 4a) Homeroom classrooms — allow homeroom teacher to assign homework
      //     for their advisory class even without teacher_assignments rows.
      if (personnelRow?.id) {
        const { data: hrRooms } = await supabase
          .from("classrooms")
          .select("id,name,grade_level,homeroom_teacher_id,homeroom_teacher_2_id,homeroom_teachers")
          .or(
            `homeroom_teacher_id.eq.${personnelRow.id},homeroom_teacher_2_id.eq.${personnelRow.id},homeroom_teachers.cs.{${personnelRow.id}}`,
          );
        if (hrRooms && hrRooms.length > 0) {
          const grades = Array.from(new Set(hrRooms.map((r: any) => r.grade_level).filter(Boolean)));
          const { data: subs } = grades.length
            ? await supabase.from("subjects").select("id,name_th,code,grade_level").in("grade_level", grades)
            : { data: [] as any[] };
          hrRooms.forEach((r: any) => {
            (subs || [])
              .filter((s: any) => !s.grade_level || s.grade_level === r.grade_level)
              .forEach((s: any) => push({
                subject_id: s.id,
                classroom_id: r.id,
                subjects: { name_th: s.name_th, code: s.code },
                classrooms: { name: r.name },
              }));
          });
        }
      }
      // 4b) Admin/Director fallback: allow selecting any subject/classroom.
      //     Capped to prevent an accidental 90k-row cartesian product.
      if (map.size === 0 && (role === "admin" || role === "director")) {
        const [{ data: subs }, { data: rooms }] = await Promise.all([
          supabase.from("subjects").select("id,name_th,code").order("code").limit(50),
          supabase.from("classrooms").select("id,name").order("name").limit(50),
        ]);
        (subs || []).forEach((s: any) => {
          (rooms || []).forEach((r: any) => {
            push({
              subject_id: s.id,
              classroom_id: r.id,
              subjects: { name_th: s.name_th, code: s.code },
              classrooms: { name: r.name },
            });
          });
        });
      }
      return Array.from(map.values());
    },
  });

  // ===== Rich homework (TipTap editor) =====
  const [richOpen, setRichOpen] = useState(false);
  const [richEditingId, setRichEditingId] = useState<string | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answerAssignmentId, setAnswerAssignmentId] = useState<string | null>(null);
  const [subsOpen, setSubsOpen] = useState(false);
  const [subsAssignmentId, setSubsAssignmentId] = useState<string | null>(null);

  const { data: richList = [], error: richError, refetch: retryRich } = useQuery({
    queryKey: ["hw-assignments", role, userId, studentRow?.classroom_id],
    enabled: !!role && !!userId && (!isStudentLike || !!studentRow?.classroom_id),
    queryFn: async () => {
      let q = supabase.from("homework_assignments").select("*").order("created_at", { ascending: false });
      if (isStudentLike && studentRow?.classroom_id) q = q.eq("classroom_id", studentRow.classroom_id);
      else if (isTeacher && !isAdmin && !isDirector) q = q.eq("created_by", userId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).filter((a: any) => !!a.content_html || !!a.pdf_path);
    },
  });


  // Homework list
  const { data: list = [], isLoading, error: listError, refetch: retryList } = useQuery({
    queryKey: ["homework-list", role, userId, studentRow?.classroom_id],
    enabled: !!role && !!userId,
    queryFn: async () => {
      let q = supabase
        .from("task_assignments")
        .select("id,title,description,due_date,assigned_date,subject_id,classroom_id,assigned_by,replies,attachments,submissions,status,max_score,subjects(name_th,code),classrooms(name)")
        .eq("task_type", "homework")
        .order("assigned_date", { ascending: false })
        .limit(100);
      if (isStudentLike) {
        if (!studentRow?.classroom_id) return [];
        q = q.eq("classroom_id", studentRow.classroom_id);
      } else if (isTeacher) {
        q = q.eq("assigned_by", userId!);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Create dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", assignment_key: "", max_score: "10" });
  const [createAttachments, setCreateAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const a = teacherAssign.find((x: any) => `${x.subject_id}|${x.classroom_id}` === form.assignment_key);
    if (!form.title.trim() || !a) {
      toast.error("กรอกหัวข้อและเลือกวิชา/ห้อง");
      return;
    }
    const parsedMax = form.max_score.trim() === "" ? null : Number(form.max_score);
    if (parsedMax !== null && (Number.isNaN(parsedMax) || parsedMax <= 0)) {
      toast.error("คะแนนเต็มต้องเป็นตัวเลขมากกว่า 0");
      return;
    }
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    const { data: inserted, error } = await supabase.from("task_assignments").insert({
      task_type: "homework",
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date || null,
      subject_id: a.subject_id,
      classroom_id: a.classroom_id,
      assigned_by: userId,
      replies: [],
      attachments: createAttachments as any,
      max_score: parsedMax,
    }).select("id").maybeSingle();
    toast.dismiss(__tid_save_1);
    setSaving(false);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("สร้างการบ้านแล้ว");

    // Notify all students in the classroom (in-app + push + LINE)
    try {
      const { data: studs } = await supabase
        .from("students")
        .select("auth_user_id")
        .eq("classroom_id", a.classroom_id)
        .eq("status", "active")
        .not("auth_user_id", "is", null);
      const uids = (studs ?? []).map((s: any) => s.auth_user_id).filter(Boolean);
      if (uids.length > 0) {
        const subj = a.subjects?.name_th || a.subjects?.code || "วิชา";
        await notify({
          user_ids: uids,
          title: `📚 การบ้านใหม่: ${form.title.trim()}`,
          body: `${subj}${form.due_date ? ` · กำหนดส่ง ${form.due_date}` : ""}`,
          type: "homework",
          severity: "info",
          reference_id: inserted?.id,
          reference_type: "task_assignments",
          url: "/dashboard/homework",
          channels: ["in_app", "push", "line"],
        });
      }
    } catch (e) { console.warn("homework notify failed", e); }

    setOpen(false);
    setForm({ title: "", description: "", due_date: "", assignment_key: "", max_score: "10" });
    setCreateAttachments([]);
    await qc.invalidateQueries({ queryKey: ["homework-list"] });
    await qc.refetchQueries({ queryKey: ["homework-list"] });
  };

  // ครู/ผู้ดูแลระบบ: รวมการบ้าน + ใบงาน (Liveworksheet) เป็นรายการเดียว เรียงงานรอตรวจขึ้นก่อน
  const teacherRows = useMemo<HomeworkRow[]>(() => {
    if (isStudentLike) return [];
    const rows: HomeworkRow[] = [];
    (list || []).forEach((hw: any) => {
      const subs = (hw.submissions as SubmissionsMap) || {};
      const values = Object.values(subs);
      const due = hw.due_date ? String(hw.due_date).slice(0, 10) : null;
      rows.push({
        key: `t-${hw.id}`, kind: "task", id: hw.id, title: hw.title || "(ไม่มีชื่อ)",
        subjectLabel: hw.subjects?.name_th || hw.subjects?.code || "",
        classLabel: hw.classrooms?.name || "", due,
        total: values.length,
        pending: values.filter((s: any) => s.status === "submitted").length,
        graded: values.filter((s: any) => s.status === "graded").length,
        overdue: !!due && new Date(due) < new Date(),
        raw: hw,
        canEdit: isAdmin || isDirector || hw.assigned_by === userId,
      });
    });
    (richList || []).forEach((a: any) => {
      const due = a.due_date ? String(a.due_date).slice(0, 10) : null;
      rows.push({
        key: `r-${a.id}`, kind: "rich", id: a.id, title: a.title || "(ไม่มีชื่อ)",
        subjectLabel: "", classLabel: "", due,
        total: 0, pending: 0, graded: 0,
        overdue: !!due && new Date(due) < new Date(),
        raw: a,
        canEdit: isAdmin || isDirector || a.created_by === userId,
      });
    });
    rows.sort((a, b) =>
      (b.pending - a.pending)
      || (Number(b.overdue) - Number(a.overdue))
      || (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31"));
    return rows;
  }, [list, richList, isStudentLike, isAdmin, isDirector, userId]);

  const teacherTotals = useMemo(() => ({
    pending: teacherRows.reduce((n, r) => n + r.pending, 0),
    submitted: teacherRows.reduce((n, r) => n + r.total, 0),
    overdue: teacherRows.filter((r) => r.overdue).length,
  }), [teacherRows]);

  const fullName = useMemo(() => [me?.first_name, me?.last_name].filter(Boolean).join(" ") || "ไม่ระบุ", [me]);

  const handleDelete = async (hw: any) => {
    if (!(await swal.confirm({ title: `ลบการบ้าน "${hw.title}" ?` }))) return;
    const tid = toast.loading("กำลังลบ...");
    const { error } = await supabase.from("task_assignments").delete().eq("id", hw.id);
    toast.dismiss(tid);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบแล้ว");
    await qc.invalidateQueries({ queryKey: ["homework-list"] });
    await qc.refetchQueries({ queryKey: ["homework-list"] });
  };

  const [rowFilter, setRowFilter] = useState<"all" | "pending" | "overdue">("all");
  const [toolsOpen, setToolsOpen] = useState(false);


  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-elevated">
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              การบ้าน
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isParent ? "การบ้านของลูก" : isStudent ? "การบ้านของห้องคุณ" : teacherRows.length ? `รอตรวจ ${teacherTotals.pending} · ส่งแล้ว ${teacherTotals.submitted} · เลยกำหนด ${teacherTotals.overdue}` : "ยังไม่มีการบ้าน"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        {canCreate && (
          <Button variant="outline" onClick={() => { setRichEditingId(null); setRichOpen(true); }}>
            <Sparkles className="w-4 h-4 mr-1" /> สร้างใบงาน / Liveworksheet
          </Button>
        )}
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> สั่งการบ้าน</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader><DialogTitle>สั่งการบ้านใหม่</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>วิชา / ห้อง</Label>
                  <Select value={form.assignment_key} onValueChange={(v) => setForm({ ...form, assignment_key: v })}>
                    <SelectTrigger><SelectValue placeholder="เลือกวิชา/ห้อง" /></SelectTrigger>
                    <SelectContent>
                      {teacherAssign.map((a: any) => (
                        <SelectItem key={`${a.subject_id}|${a.classroom_id}`} value={`${a.subject_id}|${a.classroom_id}`}>
                          {a.subjects?.name_th || a.subjects?.code || "-"} · {a.classrooms?.name || "-"}
                        </SelectItem>
                      ))}
                      {teacherAssign.length === 0 && <div className="p-2 text-xs text-muted-foreground">ยังไม่มีการมอบหมายวิชา/ห้อง</div>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>หัวข้อ</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น แบบฝึกหัดบทที่ 3" />
                </div>
                <div className="space-y-1.5">
                  <Label>รายละเอียด</Label>
                  <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>กำหนดส่ง</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>คะแนนเต็ม <span className="text-xs text-muted-foreground font-normal">(เว้นว่างถ้าไม่ให้คะแนน)</span></Label>
                  <Input
                    type="number"
                    min={1}
                    step="0.5"
                    value={form.max_score}
                    onChange={(e) => setForm({ ...form, max_score: e.target.value })}
                    placeholder="เช่น 10, 20, 100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ไฟล์การบ้าน / ใบงาน (นักเรียนสามารถแก้ไขในเว็บได้ทันที)</Label>
                  <AttachmentUploader
                    folder="tasks"
                    value={createAttachments}
                    onChange={setCreateAttachments}
                    maxFiles={5}
                  />
                </div>
                <Button onClick={submit} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  สั่งการบ้าน
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>


      {isLoading && <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> กำลังโหลด...</div>}

      {!isLoading && (() => {
        if (isStudentLike && !studentRow?.classroom_id) {
          return (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              {isParent
                ? "ยังไม่ได้เชื่อมบัญชีกับนักเรียน — โปรดเชื่อมในเมนูโปรไฟล์"
                : "บัญชีนี้ยังไม่ผูกกับห้องเรียน โปรดติดต่อผู้ดูแลระบบ"}
            </CardContent></Card>
          );
        }

        // For students: hide rows already submitted/graded (keep needs_revision & not-yet-submitted)
        const filtered = isStudentLike && studentRow?.id
          ? list.filter((hw: any) => {
              const sub = (hw.submissions as SubmissionsMap | null)?.[studentRow.id];
              return !sub || sub.status === "needs_revision";
            })
          : list;

        if (filtered.length === 0) {
          return (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              {isStudentLike
                ? (list.length === 0 ? "ยังไม่มีการบ้านสำหรับห้องของคุณ" : "ส่งงานครบทุกชิ้นแล้ว 🎉")
                : (isTeacher ? "คุณยังไม่ได้สั่งการบ้าน — กด \"สั่งการบ้าน\" เพื่อเริ่ม" : "ยังไม่มีการบ้าน")}
            </CardContent></Card>
          );
        }

        // Group by subject+classroom — one dashboard tile per subject-class combo
        type Group = { key: string; subjectLabel: string; classLabel: string; items: any[] };
        const groupsMap = new Map<string, Group>();
        filtered.forEach((hw: any) => {
          const subjKey = hw.subject_id || "_none";
          const classKey = hw.classroom_id || "_none";
          const key = isStudentLike ? subjKey : `${subjKey}|${classKey}`;
          const subjectLabel = hw.subjects?.name_th || hw.subjects?.code || "อื่นๆ";
          const classLabel = hw.classrooms?.name || "";
          if (!groupsMap.has(key)) groupsMap.set(key, { key, subjectLabel, classLabel, items: [] });
          groupsMap.get(key)!.items.push(hw);
        });
        const groups = Array.from(groupsMap.values()).sort((a, b) => a.subjectLabel.localeCompare(b.subjectLabel, "th"));

        const renderCard = (hw: any) => (
          <HomeworkDetailCard
            key={hw.id}
            hw={hw}
            isStudentLike={isStudentLike}
            isParent={isParent}
            isAdmin={isAdmin}
            isDirector={isDirector}
            isTeacher={isTeacher}
            userId={userId}
            studentRow={studentRow}
            fullName={fullName}
            onDelete={handleDelete}
          />
        );

        // Student/Parent — grouped list with heading
        if (isStudentLike) {
          return (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.key} className="space-y-2">
                  <h2 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> {g.subjectLabel}
                    <Badge variant="outline" className="ml-1">{g.items.length}</Badge>
                  </h2>
                  <div className="space-y-3">{g.items.map(renderCard)}</div>
                </div>
              ))}
            </div>
          );
        }

        // ครู / ผู้ดูแลระบบ — รายการเดียว เรียงงานที่ต้องตรวจขึ้นก่อน
        const counts = {
          all: teacherRows.length,
          pending: teacherRows.filter((r) => r.pending > 0).length,
          overdue: teacherRows.filter((r) => r.overdue).length,
        };
        const visible = teacherRows.filter((r) =>
          rowFilter === "pending" ? r.pending > 0 : rowFilter === "overdue" ? r.overdue : true,
        );
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                <FilterChip label="ทั้งหมด" value={counts.all} active={rowFilter === "all"} onClick={() => setRowFilter("all")} />
                <FilterChip label="รอตรวจ" value={counts.pending} active={rowFilter === "pending"} onClick={() => setRowFilter("pending")} />
                <FilterChip label="เลยกำหนด" value={counts.overdue} active={rowFilter === "overdue"} onClick={() => setRowFilter("overdue")} />
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setToolsOpen((v) => !v)}>
                {toolsOpen ? "ซ่อนเครื่องมือในระบบ" : "เครื่องมือในระบบ"}
              </Button>
            </div>

            {toolsOpen && (
              <Card className="border-border/60"><CardContent className="p-3"><HomeworkToolsBar title="เครื่องมือในระบบ" /></CardContent></Card>
            )}

            {visible.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                {rowFilter === "pending" ? "ไม่มีงานรอตรวจ 🎉" : rowFilter === "overdue" ? "ไม่มีงานเลยกำหนด" : "ยังไม่มีการบ้าน — กด \"ส่งการบ้าน\" เพื่อเริ่ม"}
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {visible.map((row) => (
                  <HomeworkRowCard
                    key={row.key}
                    row={row}
                    onCheckRich={(id) => { setSubsAssignmentId(id); setSubsOpen(true); }}
                    onEditRich={(id) => { setRichEditingId(id); setRichOpen(true); }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== Rich homework section ===== */}
      {(richError || listError) && <div className="border-t pt-4 space-y-2"><p className="text-destructive">อ่านรายการการบ้านไม่สำเร็จ</p><Button variant="outline" onClick={() => { retryRich(); retryList(); }}>ลองใหม่</Button></div>}
      {richList.length > 0 && isStudentLike && (
        <section className="space-y-2 border-t pt-5">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> ใบงาน / Liveworksheet ({richList.length})
            </h2>
          <div className="space-y-2">
            {richList.map((a: any) => (
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b py-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm break-words">{a.title}</div>
                  {a.due_date && <div className="text-xs text-muted-foreground">กำหนดส่ง: {new Date(a.due_date).toLocaleDateString("th-TH")}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {isStudent && !isParent && studentRow?.id && (
                    <Button size="sm" onClick={() => { setAnswerAssignmentId(a.id); setAnswerOpen(true); }}>
                      <FileEdit className="w-3.5 h-3.5 mr-1" /> ทำใบงาน
                    </Button>
                  )}
                  {(isTeacher || isAdmin || isDirector) && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setSubsAssignmentId(a.id); setSubsOpen(true); }}>
                        <ClipboardList className="w-3.5 h-3.5 mr-1" /> ตรวจ
                      </Button>
                      {(isAdmin || isDirector || a.created_by === userId) && (
                        <Button size="sm" variant="ghost" title="แก้ไขใบงาน" aria-label="แก้ไขใบงาน" onClick={() => { setRichEditingId(a.id); setRichOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <HomeworkRichDesignerDialog open={richOpen} onOpenChange={setRichOpen} editingId={richEditingId} />
      <HomeworkAnswerDialog open={answerOpen} onOpenChange={setAnswerOpen} assignmentId={answerAssignmentId} studentId={studentRow?.id || null} />
      <HomeworkSubmissionsDialog open={subsOpen} onOpenChange={setSubsOpen} assignmentId={subsAssignmentId} />
    </div>
  );
};

// ================= Sub-components =================

function HomeworkDetailCard({
  hw, isStudentLike, isParent, isAdmin, isDirector, isTeacher, userId, studentRow, fullName, onDelete,
}: {
  hw: any; isStudentLike: boolean; isParent: boolean; isAdmin: boolean; isDirector: boolean; isTeacher: boolean;
  userId: string | null; studentRow: any; fullName: string; onDelete: (hw: any) => void;
}) {
  const subs = (hw.submissions as SubmissionsMap) || {};
  const total = Object.keys(subs).length;
  const pending = Object.values(subs).filter((s: any) => s.status === "submitted").length;
  const due = hw.due_date ? new Date(hw.due_date) : null;
  const overdue = due && due < new Date();
  const graded = Object.values(subs).filter((s: any) => s.status === "graded").length;
  const needsRevision = Object.values(subs).filter((s: any) => s.status === "needs_revision").length;
  
  return (
    <Card data-notif-id={hw.id} className="border-border/60 hover:shadow-elevated transition-all overflow-hidden group scroll-mt-24">
      {/* Status bar on top */}
      <div className={`h-1 w-full ${
        overdue ? "bg-destructive/70"
        : pending > 0 ? "bg-warning/70"
        : graded > 0 && graded === total ? "bg-success/70"
        : "bg-primary/40"
      }`} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{hw.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap mt-2">
              {hw.classrooms?.name && (
                <Badge variant="outline" className="font-semibold rounded-full">{hw.classrooms.name}</Badge>
              )}
              {due && (
                <span className={`text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                  overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                }`}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  กำหนดส่ง {due.toLocaleDateString("th-TH")}
                  {overdue && " · เลยกำหนด"}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(isAdmin || isDirector || hw.assigned_by === userId) && <EditHomeworkButton hw={hw} />}
            {(isAdmin || isDirector || hw.assigned_by === userId) && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(hw)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-1" /> ลบ
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hw.description && (
          <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{hw.description}</p>
        )}

        {!isStudentLike && <TeacherAttachmentsList items={(hw.attachments as Attachment[]) || []} />}

        {/* Teacher: submission summary stripe */}
        {!isStudentLike && total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2">
              <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">ส่งแล้ว</div>
              <div className="text-xl font-bold text-sky-700 tabular-nums leading-tight">{total}</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">รอตรวจ</div>
              <div className="text-xl font-bold text-amber-700 tabular-nums leading-tight">{pending}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ตรวจแล้ว</div>
              <div className="text-xl font-bold text-emerald-700 tabular-nums leading-tight">{graded}</div>
            </div>
            {needsRevision > 0 && (
              <div className="col-span-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700">ให้แก้ไข {needsRevision} คน</span>
              </div>
            )}
          </div>
        )}

        {isStudentLike && studentRow?.id ? (
          <StudentSubmissionPanel
            taskId={hw.id}
            studentId={studentRow.id}
            studentName={fullName}
            submissions={subs}
            teacherAttachments={(hw.attachments as Attachment[]) || []}
            invalidateKeys={[["homework-list"]]}
            readOnly={isParent}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}


type HomeworkRow = {
  key: string; kind: "task" | "rich"; id: string; title: string;
  subjectLabel: string; classLabel: string; due: string | null;
  total: number; pending: number; graded: number; overdue: boolean;
  raw: any; canEdit: boolean;
};

function FilterChip({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="sm" className="h-8 text-xs gap-1.5" onClick={onClick}>
      {label}
      <span className="tabular-nums rounded-full bg-muted px-1.5 text-[11px] font-semibold">{value}</span>
    </Button>
  );
}

function HomeworkRowCard({ row, onCheckRich, onEditRich, onDelete }: {
  row: HomeworkRow; onCheckRich: (id: string) => void; onEditRich: (id: string) => void; onDelete: (hw: any) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2.5 flex items-center gap-3 flex-wrap sm:flex-nowrap hover:shadow-elevated transition-shadow">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${row.kind === "rich" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        {row.kind === "rich" ? <Sparkles className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{row.title}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
          {row.subjectLabel && <span>{row.subjectLabel}</span>}
          {row.classLabel && <span>· ห้อง {row.classLabel}</span>}
          {row.due && (
            <span className={row.overdue ? "text-destructive font-medium" : ""}>
              · กำหนดส่ง {new Date(row.due).toLocaleDateString("th-TH")}{row.overdue ? " · เลยกำหนด" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        {row.kind === "task" && row.pending > 0 && (
          <Badge variant="outline" className="border-warning/40 text-warning">รอตรวจ {row.pending}</Badge>
        )}
        {row.kind === "task" && row.graded > 0 && (
          <Badge variant="outline" className="border-success/40 text-success">ตรวจแล้ว {row.graded}</Badge>
        )}
        {row.kind === "task" && row.total === 0 && (
          <Badge variant="outline" className="text-muted-foreground">ยังไม่มีคนส่ง</Badge>
        )}
        {row.kind === "task" ? (
          <GradeTaskDialog hw={row.raw} />
        ) : (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onCheckRich(row.id)}>
            <ClipboardList className="w-4 h-4" /> ตรวจ
          </Button>
        )}
        {row.canEdit && row.kind === "task" && <EditHomeworkButton hw={row.raw} />}
        {row.canEdit && row.kind === "rich" && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="แก้ไขใบงาน" aria-label="แก้ไขใบงาน" onClick={() => onEditRich(row.id)}>
            <Pencil className="w-4 h-4" />
          </Button>
        )}
        {row.canEdit && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="ลบ" aria-label="ลบ" onClick={() => onDelete(row.raw)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function GradeTaskDialog({ hw }: { hw: any }) {
  const [open, setOpen] = useState(false);
  const subs = (hw.submissions as SubmissionsMap) || {};
  const total = Object.keys(subs).length;
  const pending = Object.values(subs).filter((s: any) => s.status === "submitted").length;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <ClipboardList className="w-4 h-4" /> ตรวจ
          {pending > 0 && <span className="tabular-nums">({pending})</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[100dvw] h-[100dvh] max-w-none rounded-none sm:rounded-lg sm:max-w-[1440px] sm:w-[96vw] sm:h-[92dvh] sm:max-h-[92dvh] p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-card shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-lg font-bold">ตรวจการบ้าน — {hw.title}</span>
              <span className="text-[11px] text-muted-foreground font-normal">รอตรวจ {pending} · ส่งแล้ว {total}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <TeacherGradingPanel
          taskId={hw.id}
          classroomId={hw.classroom_id}
          submissions={subs}
          teacherAttachments={(hw.attachments as any[]) || []}
          invalidateKeys={[["homework-list"]]}
          assignmentTitle={hw.title}
          assignmentDescription={hw.description}
          assignmentDueDate={hw.due_date}
          assignmentMaxScore={hw.max_score != null ? Number(hw.max_score) : null}
        />
      </DialogContent>
    </Dialog>
  );
}


function EditHomeworkButton({ hw }: { hw: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(hw.title || "");
  const [description, setDescription] = useState(hw.description || "");
  const [dueDate, setDueDate] = useState(hw.due_date ? String(hw.due_date).slice(0, 10) : "");
  const [maxScore, setMaxScore] = useState<string>(hw.max_score != null ? String(hw.max_score) : "");
  const [attachments, setAttachments] = useState<Attachment[]>((hw.attachments as Attachment[]) || []);

  const save = async () => {
    if (!title.trim()) { toast.error("กรอกหัวข้อ"); return; }
    setSaving(true);
    const tid = toast.loading("กำลังบันทึก...");
    const { error } = await supabase
      .from("task_assignments")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        max_score: maxScore.trim() === "" ? null : Number(maxScore),
        attachments: attachments as any,
      })
      .eq("id", hw.id);
    toast.dismiss(tid);
    setSaving(false);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("บันทึกแล้ว");
    setOpen(false);
    await qc.invalidateQueries({ queryKey: ["homework-list"] });
    await qc.refetchQueries({ queryKey: ["homework-list"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="แก้ไขการบ้าน" aria-label="แก้ไขการบ้าน">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg sm:max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>แก้ไขการบ้าน</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>หัวข้อ</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>รายละเอียด</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>กำหนดส่ง</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>คะแนนเต็ม <span className="text-xs text-muted-foreground font-normal">(เว้นว่างถ้าไม่ให้คะแนน)</span></Label>
            <Input type="number" min={1} step="0.5" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="เช่น 10, 20, 100" />
          </div>
          <div className="space-y-1.5">
            <Label>ไฟล์แนบ / ใบงาน</Label>
            <AttachmentUploader folder="tasks" value={attachments} onChange={setAttachments} maxFiles={10} />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
            บันทึก
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HomeworkPage;
