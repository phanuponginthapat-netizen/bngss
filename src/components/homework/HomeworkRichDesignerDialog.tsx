import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import EFormTemplateDesigner from "@/components/eform/EFormTemplateDesigner";
import PdfWorksheetDesigner from "@/components/homework/PdfWorksheetDesigner";
import type { WorksheetField } from "@/lib/pdfWorksheet";
import type { EFormField } from "@/lib/eformTemplate";

const EMPTY = `<h2 style="text-align:center;">ใบงาน</h2><p>คำสั่ง: ...</p>`;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingId?: string | null;
}

export function HomeworkRichDesignerDialog({ open, onOpenChange, editingId }: Props) {
  const qc = useQueryClient();
  const [fullscreen, setFullscreen] = useState(true);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [classroomId, setClassroomId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [html, setHtml] = useState(EMPTY);
  const [fields, setFields] = useState<EFormField[]>([]);
  const [mode, setMode] = useState<"html" | "pdf">("html");
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [worksheetFields, setWorksheetFields] = useState<WorksheetField[]>([]);
  const [saving, setSaving] = useState(false);

  // มือถือ = fullscreen เสมอ กัน dialog เล็กจนใช้ไม่ได้; desktop ให้ผู้ใช้เลือก
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const useFullscreen = open && (fullscreen || isMobile);
  useBodyScrollLock(useFullscreen);

  // Load only classrooms / subjects assigned to the current teacher.
  // Keep this in sync with the regular homework form, but do not fall back to
  // all classrooms/subjects because teachers should only see their assignments.
  const { data: assignments = [] } = useQuery({
    queryKey: ["hw-rich-assignments"],
    enabled: open,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_code,first_name,last_name")
        .eq("id", user.id)
        .maybeSingle();

      let personnelId: string | null = null;
      const { data: byUser } = await supabase
        .from("personnel")
        .select("id,prefix,first_name,last_name")
        .eq("user_id", user.id)
        .maybeSingle();

      let teacherName = byUser
        ? `${byUser.prefix || ""}${byUser.first_name || ""} ${byUser.last_name || ""}`.trim()
        : [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();

      if (byUser?.id) personnelId = byUser.id;
      if (!personnelId && profile?.employee_code) {
        const { data: byCode } = await supabase
          .from("personnel")
          .select("id,prefix,first_name,last_name")
          .eq("employee_code", profile.employee_code)
          .maybeSingle();
        if (byCode?.id) {
          personnelId = byCode.id;
          teacherName = `${byCode.prefix || ""}${byCode.first_name || ""} ${byCode.last_name || ""}`.trim();
        }
      }

      const map = new Map<string, any>();
      const addRows = (rows: any[] | null | undefined) => {
        (rows || []).forEach((row) => {
          if (!row?.classroom_id || !row?.subject_id) return;
          const classroom = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms;
          const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
          if (!classroom?.id || !subject?.id) return;
          map.set(`${row.classroom_id}|${row.subject_id}`, {
            classroom_id: row.classroom_id,
            subject_id: row.subject_id,
            classrooms: classroom,
            subjects: subject,
          });
        });
      };

      if (personnelId) {
        const [{ data: assigned, error: assignedError }, { data: scheduled, error: scheduledError }] = await Promise.all([
          supabase
            .from("teacher_assignments")
            .select("classroom_id, subject_id, classrooms(id,name), subjects(id,name_th,code)")
            .eq("personnel_id", personnelId),
          supabase
            .from("schedules")
            .select("classroom_id, subject_id, classrooms(id,name), subjects(id,name_th,code)")
            .eq("teacher_id", personnelId),
        ]);

        if (assignedError) throw assignedError;
        if (scheduledError) throw scheduledError;
        addRows(assigned);
        addRows(scheduled);
      }

      if (teacherName) {
        const { data: byName, error } = await supabase
          .from("schedules")
          .select("classroom_id, subject_id, classrooms(id,name), subjects(id,name_th,code)")
          .eq("teacher_name", teacherName);
        if (error) throw error;
        addRows(byName);
      }

      if (map.size === 0) {
        const [{ data: subs }, { data: rooms }] = await Promise.all([
          supabase.from("subjects").select("id,name_th,code").limit(300),
          supabase.from("classrooms").select("id,name").order("name").limit(300),
        ]);
        (subs || []).forEach((subject: any) => {
          (rooms || []).forEach((classroom: any) => {
            map.set(`${classroom.id}|${subject.id}`, {
              classroom_id: classroom.id,
              subject_id: subject.id,
              classrooms: classroom,
              subjects: subject,
            });
          });
        });
      }

      return Array.from(map.values());
    },
  });
  const classrooms = useMemo(() => Array.from(
    new Map(
      assignments
        .filter((a: any) => a.classrooms?.id)
        .map((a: any) => [a.classrooms.id as string, a.classrooms as { id: string; name: string }])
    ).values()
  ), [assignments]);
  const subjects = useMemo(() => Array.from(
    new Map(
      assignments
        .filter((a: any) => (!classroomId || a.classroom_id === classroomId) && a.subjects?.id)
        .map((a: any) => [a.subjects.id as string, a.subjects as { id: string; name_th: string; code?: string | null }])
    ).values()
  ), [assignments, classroomId]);

  useEffect(() => {
    if (!subjectId) return;
    if (subjects.length > 0 && !subjects.some((s: any) => s.id === subjectId)) setSubjectId("");
  }, [classroomId, subjectId, subjects]);

  useEffect(() => {
    if (!open) return;
    if (!editingId) {
      setTitle(""); setSubjectId(""); setClassroomId(""); setDueDate("");
      setHtml(EMPTY); setFields([]);
      setMode("html"); setPdfPath(null); setPdfSignedUrl(null); setPendingPdfFile(null); setWorksheetFields([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("homework_assignments")
        .select("*")
        .eq("id", editingId)
        .maybeSingle();
      if (!data) return;
      setTitle(data.title || "");
      setSubjectId(data.subject_id || "");
      setClassroomId(data.classroom_id || "");
      setDueDate(data.due_date || "");
      setHtml((data as any).content_html || EMPTY);
      setFields(((data as any).answer_fields || []) as EFormField[]);
      const pPath = (data as any).pdf_path as string | null;
      const wFields = ((data as any).worksheet_fields || []) as WorksheetField[];
      setPdfPath(pPath);
      setWorksheetFields(wFields);
      if (pPath) {
        setMode("pdf");
        const { data: signed } = await supabase.storage.from("homework-files").createSignedUrl(pPath, 3600);
        if (signed?.signedUrl) setPdfSignedUrl(signed.signedUrl);
      } else {
        setMode("html");
      }
    })();
  }, [open, editingId]);

  const save = async () => {
    if (!title.trim()) { toast.error("กรอกชื่อใบงาน"); return; }
    if (!classroomId) { toast.error("เลือกห้องเรียน"); return; }
    if (mode === "pdf" && !pdfPath && !pendingPdfFile) { toast.error("กรุณาอัปโหลด PDF ต้นแบบ"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("first_name,last_name,school_id").eq("id", user!.id).maybeSingle();
      const assigned_by = `${prof?.first_name || ""} ${prof?.last_name || ""}`.trim() || "ครู";

      let finalPdfPath = pdfPath;
      if (mode === "pdf" && pendingPdfFile) {
        // ลบไฟล์ PDF เก่าทิ้งก่อนอัปโหลดใหม่ กันค้างใน storage
        if (pdfPath) {
          try { await supabase.storage.from("homework-files").remove([pdfPath]); } catch { /* ignore */ }
        }
        const path = `worksheet-pdf/${user!.id}/${Date.now()}_${pendingPdfFile.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("homework-files").upload(path, pendingPdfFile, {
          contentType: "application/pdf", upsert: false,
        });
        if (upErr) throw upErr;
        finalPdfPath = path;
      }

      // นับเฉพาะ field ที่ auto-grade ได้ (มี correct) — กัน audio/draw ทำให้ % เพี้ยน
      const totalScore = mode === "pdf"
        ? worksheetFields.reduce((s, f) => {
            const gradable = f.correct !== undefined && f.correct !== null && f.correct !== "";
            return gradable ? s + (f.score ?? 0) : s;
          }, 0)
        : null;


      const payload: any = {
        title,
        subject_id: subjectId || null,
        classroom_id: classroomId,
        due_date: dueDate || null,
        content_html: mode === "html" ? html : null,
        answer_fields: mode === "html" ? fields : [],
        pdf_path: mode === "pdf" ? finalPdfPath : null,
        worksheet_fields: mode === "pdf" ? worksheetFields : [],
        total_score: totalScore,
        assigned_by,
        status: "active",
        school_id: prof?.school_id || null,
        created_by: user!.id,
      };
      if (editingId) {
        const { error } = await supabase.from("homework_assignments").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("บันทึกใบงานแล้ว");
      } else {
        const { error } = await supabase.from("homework_assignments").insert(payload);
        if (error) throw error;
        toast.success("สร้างใบงานใหม่แล้ว");
      }
      qc.invalidateQueries({ queryKey: ["hw-assignments"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const metaPanel = (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">ชื่อใบงาน *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" placeholder="เช่น ใบงานคณิตศาสตร์..." />
      </div>
      <div>
        <Label className="text-xs">ห้องเรียน *</Label>
        <Select value={classroomId} onValueChange={(value) => { setClassroomId(value); setSubjectId(""); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
          <SelectContent>
            {classrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">วิชา</Label>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือกวิชา" /></SelectTrigger>
          <SelectContent>
            {subjects.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name_th}{s.code ? ` (${s.code})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">กำหนดส่ง</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-sm" />
      </div>
    </div>
  );

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <h2 className="text-base sm:text-lg font-semibold">{editingId ? "แก้ไขใบงาน" : "สร้างใบงาน Rich"}</h2>
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex rounded border overflow-hidden mr-1 sm:mr-2">
            <button type="button" onClick={() => setMode("html")}
              className={`px-2 sm:px-3 py-1 text-xs ${mode === "html" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
              HTML
            </button>
            <button type="button" onClick={() => setMode("pdf")}
              className={`px-2 sm:px-3 py-1 text-xs ${mode === "pdf" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
              PDF Worksheet
            </button>
          </div>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setFullscreen(f => !f)}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>ปิด</Button>
          {useFullscreen && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} บันทึก
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [touch-action:pan-y] md:overflow-hidden">
        {mode === "html" ? (
          <EFormTemplateDesigner
            initialHtml={html}
            initialFields={fields}
            onChange={(h, f) => { setHtml(h); setFields(f); }}
            headerExtra={metaPanel}
          />
        ) : (
          <div className="flex flex-col md:flex-row gap-3 h-full min-h-0">
            <div className="w-full md:w-64 md:shrink-0 overflow-visible md:overflow-auto border rounded p-3">{metaPanel}</div>
            <div className="flex-1 min-w-0 min-h-0">
              <PdfWorksheetDesigner
                initialPdfUrl={pdfSignedUrl}
                initialFields={worksheetFields}
                onPdfChange={(file) => { setPendingPdfFile(file); setPdfPath(null); }}
                onFieldsChange={setWorksheetFields}
              />
            </div>
          </div>
        )}
      </div>


      {!useFullscreen && (
        <div className="flex justify-end gap-2 shrink-0 pb-[env(safe-area-inset-bottom)]">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} บันทึก
          </Button>
        </div>
      )}
    </>
  );

  if (!open) return null;
  if (useFullscreen) {
    return createPortal(
      <div
        className="fixed inset-0 z-[90] bg-background p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 overflow-hidden overscroll-contain"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {body}
      </div>,
      document.body,
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] sm:w-[95vw] sm:max-h-[95vh] flex flex-col gap-3 p-4">
        {body}
      </DialogContent>
    </Dialog>
  );
}

export default HomeworkRichDesignerDialog;
