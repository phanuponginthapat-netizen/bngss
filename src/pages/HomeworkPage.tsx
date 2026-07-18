import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, BookOpen, Loader2, Trash2, MessageSquare, Pencil } from "lucide-react";
import { toast } from "sonner";
import AttachmentUploader from "@/components/homework/AttachmentUploader";

import { StudentSubmissionPanel, TeacherGradingPanel, type SubmissionsMap } from "@/components/homework/HomeworkSubmission";
import type { Attachment } from "@/lib/homeworkStorage";
import { confirmDelete } from "@/lib/confirmAction";
import { DateInput } from "@/components/ui/date-input";

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
      // 4) Admin/Director fallback: allow any subject+classroom via schedules pool (limited)
      if ((role === "admin" || role === "director") && map.size === 0) {
        const { data: any1 } = await supabase
          .from("schedules")
          .select("subject_id,classroom_id,subjects(name_th,code),classrooms(name)")
          .limit(500);
        (any1 || []).forEach(push);
      }
      return Array.from(map.values());
    },
  });

  // Homework list
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["homework-list", role, userId, studentRow?.classroom_id],
    enabled: !!role && !!userId,
    queryFn: async () => {
      let q = supabase
        .from("task_assignments")
        .select("id,title,description,due_date,assigned_date,subject_id,classroom_id,assigned_by,replies,attachments,submissions,status,worksheet_id,subjects(name_th,code),classrooms(name)")
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

  // Teacher worksheets (for liveworksheet integration)
  const { data: myWorksheets = [] } = useQuery({
    queryKey: ["hw-my-worksheets", userId],
    enabled: canCreate && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("worksheets")
        .select("id,title,grade_level")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Create dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", assignment_key: "", worksheet_id: "" });
  const [createAttachments, setCreateAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const a = teacherAssign.find((x: any) => `${x.subject_id}|${x.classroom_id}` === form.assignment_key);
    if (!form.title.trim() || !a) {
      toast.error("กรอกหัวข้อและเลือกวิชา/ห้อง");
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
      worksheet_id: form.worksheet_id || null,
    } as any).select("id").maybeSingle();
    toast.dismiss(__tid_save_1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
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
    setForm({ title: "", description: "", due_date: "", assignment_key: "", worksheet_id: "" });
    setCreateAttachments([]);
    await qc.invalidateQueries({ queryKey: ["homework-list"] });
    await qc.refetchQueries({ queryKey: ["homework-list"] });
  };

  const fullName = useMemo(() => [me?.first_name, me?.last_name].filter(Boolean).join(" ") || "ไม่ระบุ", [me]);

  const handleDelete = async (hw: any) => {
    if (!(await confirmDelete(`ลบการบ้าน "${hw.title}" ?`))) return;
    const tid = toast.loading("กำลังลบ...");
    const { error } = await supabase.from("task_assignments").delete().eq("id", hw.id);
    toast.dismiss(tid);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบแล้ว");
    await qc.invalidateQueries({ queryKey: ["homework-list"] });
    await qc.refetchQueries({ queryKey: ["homework-list"] });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-primary" /> การบ้าน</h1>
          <p className="text-sm text-muted-foreground">
            {isParent ? "การบ้านของลูก" : isStudent ? "การบ้านของห้องคุณ" : isTeacher ? "การบ้านที่คุณสั่ง" : "การบ้านทั้งหมด"}
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> สั่งการบ้าน</Button>
            </DialogTrigger>
            <DialogContent>
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
                  <DateInput value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
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
                <div className="space-y-1.5">
                  <Label>ใบงานอินเทอร์แอกทีฟ (Liveworksheet) — ไม่บังคับ</Label>
                  <Select value={form.worksheet_id || "__none"} onValueChange={(v) => setForm({ ...form, worksheet_id: v === "__none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="ไม่ใช้ใบงาน" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— ไม่ใช้ —</SelectItem>
                      {myWorksheets.map((w: any) => (
                        <SelectItem key={w.id} value={w.id}>{w.title}{w.grade_level ? ` · ${w.grade_level}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">สร้าง/แก้ไขใบงานได้ที่ เมนู → ใบงาน (Worksheets)</p>
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

      {isLoading && <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> กำลังโหลด...</div>}

      {!isLoading && (() => {
        // For students: hide rows already submitted/graded (keep needs_revision & not-yet-submitted)
        const filtered = isStudentLike && studentRow?.id
          ? list.filter((hw: any) => {
              const sub = (hw.submissions as SubmissionsMap | null)?.[studentRow.id];
              return !sub || sub.status === "needs_revision";
            })
          : list;

        if (filtered.length === 0) {
          return (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              {isStudentLike ? "ส่งงานครบทุกชิ้นแล้ว 🎉" : "ยังไม่มีการบ้าน"}
            </CardContent></Card>
          );
        }

        // Group by subject for student view
        const groups = new Map<string, { label: string; items: any[] }>();
        filtered.forEach((hw: any) => {
          const key = hw.subject_id || "_none";
          const label = hw.subjects?.name_th || hw.subjects?.code || "อื่นๆ";
          if (!groups.has(key)) groups.set(key, { label, items: [] });
          groups.get(key)!.items.push(hw);
        });

        const renderCard = (hw: any) => (
          <Card key={hw.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">{hw.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 flex-wrap mt-1">
                    {(hw.subjects?.name_th || hw.subjects?.code) && <Badge variant="outline">{hw.subjects?.name_th || hw.subjects?.code}</Badge>}
                    {hw.classrooms?.name && <Badge variant="outline">{hw.classrooms.name}</Badge>}
                    {hw.due_date && <span className="text-xs">กำหนดส่ง: {new Date(hw.due_date).toLocaleDateString("th-TH")}</span>}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  {(isAdmin || isDirector || hw.assigned_by === userId) && (
                    <EditHomeworkButton hw={hw} />
                  )}
                  {(isAdmin || isDirector || hw.assigned_by === userId) && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(hw)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-1" /> ลบ
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {hw.description && <p className="text-sm whitespace-pre-wrap">{hw.description}</p>}

              {isStudentLike && studentRow?.id ? (
                <StudentSubmissionPanel
                  taskId={hw.id}
                  studentId={studentRow.id}
                  studentName={fullName}
                  submissions={(hw.submissions as SubmissionsMap) || {}}
                  teacherAttachments={(hw.attachments as Attachment[]) || []}
                  worksheetId={(hw as any).worksheet_id || null}
                  invalidateKeys={[["homework-list"]]}
                  readOnly={isParent}
                />
              ) : (
                (isTeacher || isAdmin || isDirector) && (
                  <TeacherRepliesButton hw={hw} />
                )
              )}
            </CardContent>
          </Card>
        );

        if (isStudentLike) {
          return (
            <div className="space-y-5">
              {[...groups.values()].map((g) => (
                <div key={g.label} className="space-y-2">
                  <h2 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> {g.label}
                    <Badge variant="outline" className="ml-1">{g.items.length}</Badge>
                  </h2>
                  <div className="space-y-3">{g.items.map(renderCard)}</div>
                </div>
              ))}
            </div>
          );
        }

        return <div className="space-y-3">{filtered.map(renderCard)}</div>;
      })()}
    </div>
  );
};

function TeacherRepliesButton({ hw }: { hw: any }) {
  const navigate = useNavigate();
  const subs = (hw.submissions as SubmissionsMap) || {};
  const total = Object.keys(subs).length;
  const pending = Object.values(subs).filter((s) => s.status === "submitted").length;
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1"
      onClick={() => navigate(`/dashboard/homework/${hw.id}/grading`)}
    >
      <MessageSquare className="w-4 h-4" />
      ตรวจงาน / ดูคะแนน
      <Badge variant="secondary" className="ml-1">{total}</Badge>
      {pending > 0 && <Badge className="ml-1 bg-info-soft text-info">รอตรวจ {pending}</Badge>}
    </Button>
  );
}



function EditHomeworkButton({ hw }: { hw: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(hw.title || "");
  const [description, setDescription] = useState(hw.description || "");
  const [dueDate, setDueDate] = useState(hw.due_date ? String(hw.due_date).slice(0, 10) : "");
  const [attachments, setAttachments] = useState<Attachment[]>((hw.attachments as Attachment[]) || []);
  const [worksheetId, setWorksheetId] = useState<string>(hw.worksheet_id || "");

  const { data: myWorksheets = [] } = useQuery({
    queryKey: ["hw-my-worksheets-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("worksheets").select("id,title,grade_level").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

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
        attachments: attachments as any,
        worksheet_id: worksheetId || null,
      } as any)
      .eq("id", hw.id);
    toast.dismiss(tid);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกแล้ว");
    setOpen(false);
    await qc.invalidateQueries({ queryKey: ["homework-list"] });
    await qc.refetchQueries({ queryKey: ["homework-list"] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="w-4 h-4 mr-1" /> แก้ไข
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
            <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ไฟล์แนบ / ใบงาน</Label>
            <AttachmentUploader folder="tasks" value={attachments} onChange={setAttachments} maxFiles={10} />
          </div>
          <div className="space-y-1.5">
            <Label>ใบงานอินเทอร์แอกทีฟ (Liveworksheet)</Label>
            <Select value={worksheetId || "__none"} onValueChange={(v) => setWorksheetId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="ไม่ใช้ใบงาน" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— ไม่ใช้ —</SelectItem>
                {myWorksheets.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.title}{w.grade_level ? ` · ${w.grade_level}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
