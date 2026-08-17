import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Printer, Download, Trash2, FileSpreadsheet, FolderOpen, Calendar, ClipboardList, Search, Plus, Save, BarChart3, BookOpen, Calculator, Settings, ListChecks, Star, PenLine, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { calculateGrade, gradeColor } from "@/lib/gradeUtils";
import { openPrintWindow, toThaiDigits } from "@/lib/printUtils";
import { toast } from "sonner";
import PP5AutoImportDialog from "@/components/academic/PP5AutoImportDialog";
import { Megaphone, CheckCircle2 } from "lucide-react";
import PP5AttendanceMatrix from "@/components/academic/PP5AttendanceMatrix";
import { swal } from "@/lib/swal";
import { CalendarClock, Sparkles } from "lucide-react";
import { KEY_COMPETENCIES, DESIRABLE_CHARACTERISTICS, READ_THINK_WRITE_STANDARDS } from "@/lib/obecStandards";
import { BE_OFFSET } from "@/lib/dateBE";
import { applyPp5FileToSystem } from "@/lib/pp5ApplyToSystem";
import { saveErrorMessage } from "@/lib/saveError";

const OBEC_PRESETS: Record<string, { title: string; description?: string }[]> = {
  competency: KEY_COMPETENCIES.map(c => ({ title: `${c.no}. ${c.name}`, description: "สมรรถนะสำคัญ สพฐ." })),
  desirable: DESIRABLE_CHARACTERISTICS.map(c => ({ title: `${c.no}. ${c.name}`, description: "คุณลักษณะอันพึงประสงค์ สพฐ." })),
  reading_writing: READ_THINK_WRITE_STANDARDS.map((t, i) => ({ title: `${i + 1}. ${t}`, description: "อ่าน คิดวิเคราะห์ และเขียน สพฐ." })),
};

const GRADE_CRITERIA = [
  { min: 80, max: 100, label: "ดีเยี่ยม", grade: "4" },
  { min: 75, max: 79, label: "ดีมาก", grade: "3.5" },
  { min: 70, max: 74, label: "ดี", grade: "3" },
  { min: 65, max: 69, label: "ค่อนข้างดี", grade: "2.5" },
  { min: 60, max: 64, label: "ปานกลาง", grade: "2" },
  { min: 55, max: 59, label: "พอใช้", grade: "1.5" },
  { min: 50, max: 54, label: "ผ่านเกณฑ์ขั้นต่ำ", grade: "1" },
  { min: 0, max: 49, label: "ต่ำกว่าเกณฑ์", grade: "0" },
];

const SCORE_PROPORTIONS = { duringTerm: 70, midterm: 10, final: 20, total: 100 };

const GRADE_LEVELS = [
  "อ.1", "อ.2", "อ.3",
  "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6",
  "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6",
  "การศึกษาพิเศษ",
];

// Inline popover trigger inside the score table header to add a new column
// without leaving the entry view. The table re-renders automatically when
// the underlying query refetches (realtime invalidation).
const InlineAddColumn = ({
  value,
  onChange,
  onAdd,
  weights,
}: {
  value: { column_name: string; column_type: string; max_score: string; half: string };
  onChange: (v: any) => void;
  onAdd: () => void | Promise<void>;
  nextOrder: number;
  weights?: { assignment: number; midterm: number; final: number; attendance: number };
}) => {
  const [open, setOpen] = useState(false);
  const w = weights ?? { assignment: 70, midterm: 10, final: 20, attendance: 0 };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="เพิ่มช่องคะแนน">
          <Plus className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="end">
        <div className="text-xs font-semibold">เพิ่มช่องคะแนนใหม่</div>
        <Input
          placeholder="ชื่อช่อง เช่น งาน 1"
          value={value.column_name}
          onChange={e => onChange({ ...value, column_name: e.target.value })}
          autoFocus
        />
        <div className="flex gap-2">
          <Select value={value.column_type} onValueChange={v => onChange({ ...value, column_type: v })}>
            <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="assignment">งานเก็บ ({w.assignment}%)</SelectItem>
              <SelectItem value="midterm">กลางภาค ({w.midterm}%)</SelectItem>
              <SelectItem value="final">ปลายภาค ({w.final}%)</SelectItem>
              <SelectItem value="attendance">จิตพิสัย ({w.attendance}%)</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="เต็ม"
            className="w-20"
            value={value.max_score}
            onChange={e => onChange({ ...value, max_score: e.target.value })}
          />
        </div>
        {value.column_type === "assignment" && (
          <Select value={value.half} onValueChange={v => onChange({ ...value, half: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pre">ก่อนกลางภาค</SelectItem>
              <SelectItem value="post">หลังกลางภาค</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          className="w-full"
          onClick={async () => {
            await onAdd();
            setOpen(false);
          }}
        >
          เพิ่ม
        </Button>
      </PopoverContent>
    </Popover>
  );
};

// Per-subject weight editor. ครูประจำวิชาแก้สัดส่วน 4 กลุ่มได้ ระบบจะเตือนถ้าไม่ครบ 100
const WeightsCard = ({
  initial,
  onSave,
}: {
  initial: { assignment: number; midterm: number; final: number; attendance: number };
  onSave: (w: { assignment: number; midterm: number; final: number; attendance: number }) => void | Promise<void>;
}) => {
  const [w, setW] = useState(initial);
  const total = (w.assignment || 0) + (w.midterm || 0) + (w.final || 0) + (w.attendance || 0);
  const ok = Math.round(total) === 100;
  const upd = (k: keyof typeof w) => (e: any) => setW({ ...w, [k]: Number(e.target.value) || 0 });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="w-4 h-4" /> ค่าถ่วงน้ำหนัก (รวม 100%)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><Label className="text-xs">งานเก็บ</Label><Input type="number" value={w.assignment} onChange={upd("assignment")} /></div>
          <div><Label className="text-xs">กลางภาค</Label><Input type="number" value={w.midterm} onChange={upd("midterm")} /></div>
          <div><Label className="text-xs">ปลายภาค</Label><Input type="number" value={w.final} onChange={upd("final")} /></div>
          <div><Label className="text-xs">จิตพิสัย</Label><Input type="number" value={w.attendance} onChange={upd("attendance")} /></div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className={`text-xs ${ok ? "text-muted-foreground" : "text-destructive font-medium"}`}>
            รวม: {total}% {ok ? "✓" : "(ต้องรวมเป็น 100)"}
          </p>
          <Button size="sm" onClick={() => onSave(w)} disabled={!ok}>
            <Save className="w-3.5 h-3.5 mr-1" /> บันทึก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Bulk table-structure generator. ครูระบุจำนวนช่อง+คะแนนเต็มของแต่ละกลุ่ม
// แล้วระบบจะสร้างช่องคะแนนทั้งตารางในคลิกเดียว (แทนที่ของเดิม)
const BulkStructureDialog = ({
  onGenerate,
}: {
  onGenerate: (cfg: { preCount: number; preMax: number; postCount: number; postMax: number; midMax: number; finMax: number }) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState({ preCount: 4, preMax: 10, postCount: 4, postMax: 10, midMax: 20, finMax: 30 });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full"><BarChart3 className="w-4 h-4 mr-1" /> กำหนดโครงสร้างตาราง (สร้างทุกช่องในคลิกเดียว)</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>กำหนดโครงสร้างตารางคะแนน</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">ระบุจำนวนช่อง + คะแนนเต็มของแต่ละกลุ่ม การกดบันทึกจะแทนที่ช่องคะแนนเดิม (งานเก็บ/กลางภาค/ปลายภาค)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>งานก่อนกลางภาค (จำนวนช่อง)</Label><Input type="number" min={0} value={cfg.preCount} onChange={e => setCfg({ ...cfg, preCount: Number(e.target.value) })} /></div>
            <div><Label>คะแนนเต็ม/ช่อง</Label><Input type="number" min={0} value={cfg.preMax} onChange={e => setCfg({ ...cfg, preMax: Number(e.target.value) })} /></div>
            <div><Label>งานหลังกลางภาค (จำนวนช่อง)</Label><Input type="number" min={0} value={cfg.postCount} onChange={e => setCfg({ ...cfg, postCount: Number(e.target.value) })} /></div>
            <div><Label>คะแนนเต็ม/ช่อง</Label><Input type="number" min={0} value={cfg.postMax} onChange={e => setCfg({ ...cfg, postMax: Number(e.target.value) })} /></div>
            <div><Label>คะแนนเต็มสอบกลางภาค</Label><Input type="number" min={0} value={cfg.midMax} onChange={e => setCfg({ ...cfg, midMax: Number(e.target.value) })} /></div>
            <div><Label>คะแนนเต็มสอบปลายภาค</Label><Input type="number" min={0} value={cfg.finMax} onChange={e => setCfg({ ...cfg, finMax: Number(e.target.value) })} /></div>
          </div>
          <div className="rounded bg-muted/40 p-2 text-xs">
            จะสร้างทั้งหมด {cfg.preCount + cfg.postCount + (cfg.midMax > 0 ? 1 : 0) + (cfg.finMax > 0 ? 1 : 0)} ช่อง
            (คะแนนเต็ม {cfg.preCount * cfg.preMax + cfg.postCount * cfg.postMax + cfg.midMax + cfg.finMax})
          </div>
          <Button className="w-full" onClick={async () => { await onGenerate(cfg); setOpen(false); }}>สร้างตาราง</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Score Entry Tab (from GradesPage - บันทึกคะแนนและตัดเกรด) ──

const ScoreEntryTab = () => {
  const { userId, isAdmin, isDirector } = useUserRole();
  const qc = useQueryClient();
  const [gradeLevel, setGradeLevel] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [indicatorOpen, setIndicatorOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [indicatorForm, setIndicatorForm] = useState({ title: "", description: "" });
  const [columnForm, setColumnForm] = useState({ column_name: "", column_type: "assignment", max_score: "10", half: "pre" });

  const { data: myProfile } = useQuery({
    queryKey: ["my_profile_for_grades", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("first_name, last_name, employee_code").eq("id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: myPersonnel } = useQuery({
    queryKey: ["my_personnel_match", userId, myProfile?.first_name, myProfile?.last_name],
    enabled: !!userId && !isAdmin && !isDirector,
    queryFn: async () => {
      // Primary: lookup by user_id (unambiguous)
      const { data: byUser } = await supabase.from("personnel").select("id").eq("user_id", userId!).maybeSingle();
      if (byUser) return byUser;
      // Fallback: name match (legacy)
      if (myProfile?.first_name && myProfile?.last_name) {
        const { data: byName } = await supabase
          .from("personnel").select("id")
          .eq("first_name", myProfile.first_name).eq("last_name", myProfile.last_name)
          .maybeSingle();
        return byName;
      }
      return null;
    },
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: ["my_teacher_assignments", myPersonnel?.id, isAdmin, isDirector],
    queryFn: async () => {
      let query = supabase.from("teacher_assignments").select("*, personnel(*), subjects(*), classrooms(*)").order("created_at", { ascending: false });
      if (!isAdmin && !isDirector && myPersonnel?.id) {
        query = query.eq("personnel_id", myPersonnel.id);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: isAdmin || isDirector || !!myPersonnel?.id,
  });

  const filteredAssignments = gradeLevel
    ? myAssignments.filter((a: any) => a.classrooms?.grade_level === gradeLevel)
    : myAssignments;
  const currentAssignment = filteredAssignments.find((a: any) => a.id === selectedAssignment);

  const { data: indicators = [] } = useQuery({
    queryKey: ["subject_indicators", currentAssignment?.subject_id],
    queryFn: async () => {
      if (!currentAssignment?.subject_id) return [];
      const { data } = await supabase.from("subject_indicators").select("*").eq("subject_id", currentAssignment.subject_id).order("sort_order");
      return data || [];
    },
    enabled: !!currentAssignment?.subject_id,
  });

  const { data: scoreColumns = [] } = useQuery({
    queryKey: ["subject_score_columns", currentAssignment?.subject_id],
    queryFn: async () => {
      if (!currentAssignment?.subject_id) return [];
      const { data } = await supabase.from("subject_score_columns").select("*").eq("subject_id", currentAssignment.subject_id).order("sort_order");
      return data || [];
    },
    enabled: !!currentAssignment?.subject_id,
  });

  const { data: subject } = useQuery({
    queryKey: ["subject_weights", currentAssignment?.subject_id],
    queryFn: async () => {
      if (!currentAssignment?.subject_id) return null;
      const { data } = await supabase.from("subjects")
        .select("id, weight_assignment, weight_midterm, weight_final, weight_attendance, hours_per_week, weeks_per_semester, pp5_period_dates, semester, academic_year")
        .eq("id", currentAssignment.subject_id).maybeSingle();
      return data;
    },
    enabled: !!currentAssignment?.subject_id,
  });

  const saveWeights = async (w: { assignment: number; midterm: number; final: number; attendance: number }) => {
    if (!currentAssignment?.subject_id) return;
    const { error } = await supabase.from("subjects").update({
      weight_assignment: w.assignment,
      weight_midterm: w.midterm,
      weight_final: w.final,
      weight_attendance: w.attendance,
    }).eq("id", currentAssignment.subject_id);
    if (error) toast.error(saveErrorMessage(error));
    else {
      toast.success("บันทึกค่าถ่วงน้ำหนักแล้ว");
      qc.invalidateQueries({ queryKey: ["subject_weights"] });
    }
  };


  const { data: students = [] } = useQuery({
    queryKey: ["students_for_grading", currentAssignment?.classroom_id],
    queryFn: async () => {
      if (!currentAssignment?.classroom_id) return [];
      const { data } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, gender").eq("classroom_id", currentAssignment.classroom_id).eq("status", "active").order("student_code");
      return data || [];
    },
    enabled: !!currentAssignment?.classroom_id,
  });

  const { data: columnScores = [] } = useQuery({
    queryKey: ["student_column_scores", scoreColumns.map((c: any) => c.id)],
    queryFn: async () => {
      if (scoreColumns.length === 0) return [];
      const colIds = scoreColumns.map((c: any) => c.id);
      const { data } = await supabase.from("student_column_scores").select("*").in("column_id", colIds);
      return data || [];
    },
    enabled: scoreColumns.length > 0,
  });

  const handleAddIndicator = async () => {
    if (!indicatorForm.title || !currentAssignment) return;
    const { error } = await supabase.from("subject_indicators").insert({
      subject_id: currentAssignment.subject_id,
      personnel_id: currentAssignment.personnel_id,
      title: indicatorForm.title,
      description: indicatorForm.description || null,
      sort_order: indicators.length,
    });
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("เพิ่มตัวชี้วัดสำเร็จ");
    setIndicatorOpen(false);
    setIndicatorForm({ title: "", description: "" });
    qc.invalidateQueries({ queryKey: ["subject_indicators"] });
  };

  const handleDeleteIndicator = async (id: string) => {
    await supabase.from("subject_indicators").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["subject_indicators"] });
  };

  const handleAddColumn = async () => {
    if (!columnForm.column_name || !currentAssignment) return;
    const { error } = await supabase.from("subject_score_columns").insert({
      subject_id: currentAssignment.subject_id,
      personnel_id: currentAssignment.personnel_id,
      column_name: columnForm.column_name,
      column_type: columnForm.column_type,
      half: columnForm.column_type === "assignment" ? columnForm.half : "pre",
      max_score: parseFloat(columnForm.max_score),
      sort_order: scoreColumns.length,
    } as any);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("เพิ่มช่องคะแนนสำเร็จ");
    setColumnOpen(false);
    setColumnForm({ column_name: "", column_type: "assignment", max_score: "10", half: "pre" });
    qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
  };

  const handleDeleteColumn = async (id: string) => {
    await supabase.from("subject_score_columns").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
  };

  const getScoreRow = (studentId: string, columnId: string) => {
    return columnScores.find((s: any) => s.student_id === studentId && s.column_id === columnId);
  };

  const getScore = (studentId: string, columnId: string) => {
    const row: any = getScoreRow(studentId, columnId);
    if (!row) return "";
    if (row.status === "pending") return "ร";
    if (row.status === "overdue") return "0";
    return row.score ?? "";
  };

  const handleScoreChange = async (studentId: string, columnId: string, value: string) => {
    const trimmed = (value || "").trim();
    // ว่าง = ไม่ทำอะไร (กันเผลอเคลียร์แล้วบันทึก 0 ทับสถานะ pending)
    if (trimmed === "") return;
    // allow teacher to type "ร" to keep pending status
    if (trimmed === "ร" || trimmed === "ร.") {
      const { error } = await supabase.from("student_column_scores").upsert({
        student_id: studentId, column_id: columnId, score: 0, status: "pending",
      } as any, { onConflict: "student_id,column_id" });
      if (error) toast.error(saveErrorMessage(error));
      else qc.invalidateQueries({ queryKey: ["student_column_scores"] });
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!Number.isFinite(parsed)) return;
    const { error } = await supabase.from("student_column_scores").upsert({
      student_id: studentId,
      column_id: columnId,
      score: parsed,
      status: "graded",
    } as any, { onConflict: "student_id,column_id" });
    if (error) toast.error(saveErrorMessage(error));
    else qc.invalidateQueries({ queryKey: ["student_column_scores"] });
  };


  const assignmentColumns = scoreColumns.filter((c: any) => c.column_type === "assignment");
  const midtermColumns = scoreColumns.filter((c: any) => c.column_type === "midterm");
  const finalColumns = scoreColumns.filter((c: any) => c.column_type === "final");
  const attendanceColumns = scoreColumns.filter((c: any) => c.column_type === "attendance");
  const activityColumns = scoreColumns.filter((c: any) => c.column_type === "activity");
  const isActivitySubject = currentAssignment?.subjects?.subject_type === "activity";

  // Mark overdue homework columns (pending -> 0) — throttle: เรียกได้ทุก 5 นาทีต่อเบราว์เซอร์
  useEffect(() => {
    try {
      const LAST = "pp5_mark_overdue_at";
      const last = parseInt(localStorage.getItem(LAST) || "0", 10);
      if (Date.now() - last < 5 * 60_000) return;
      localStorage.setItem(LAST, String(Date.now()));
    } catch { /* ignore */ }
    (supabase as any).rpc("mark_overdue_homework_columns").then(() => {
      qc.invalidateQueries({ queryKey: ["student_column_scores"] });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync: activity subjects use indicators directly as pass/fail columns
  useEffect(() => {
    if (!isActivitySubject || !currentAssignment?.subject_id || indicators.length === 0) return;
    const existing = new Set(activityColumns.map((c: any) => c.column_name));
    const missing = indicators.filter((ind: any) => !existing.has(ind.title));
    if (missing.length === 0) return;
    (async () => {
      const rows = missing.map((ind: any, i: number) => ({
        subject_id: currentAssignment.subject_id,
        personnel_id: currentAssignment.personnel_id,
        column_name: ind.title,
        column_type: "activity",
        half: "pre",
        max_score: 1,
        sort_order: activityColumns.length + i,
      }));
      await supabase.from("subject_score_columns").insert(rows as any);
      qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActivitySubject, currentAssignment?.subject_id, indicators.length, activityColumns.length]);

  const togglePassFail = async (studentId: string, columnId: string) => {
    const current = Number(getScore(studentId, columnId)) || 0;
    const next = current === 1 ? 0 : 1;
    await handleScoreChange(studentId, columnId, String(next));
  };

  // Bulk-generate score columns from a single form.
  // ครูกำหนดจำนวนช่อง+คะแนนเต็มของแต่ละกลุ่ม → ระบบสร้างช่องให้ทันทีในตาราง
  const handleBulkGenerate = async (cfg: {
    preCount: number; preMax: number;
    postCount: number; postMax: number;
    midMax: number; finMax: number;
  }) => {
    if (!currentAssignment) return;
    await supabase.from("subject_score_columns")
      .delete()
      .eq("subject_id", currentAssignment.subject_id)
      .in("column_type", ["assignment", "midterm", "final"]);
    const rows: any[] = [];
    let order = 0;
    for (let i = 0; i < cfg.preCount; i++) {
      rows.push({ subject_id: currentAssignment.subject_id, personnel_id: currentAssignment.personnel_id,
        column_name: `ก่อนกลาง ${i + 1}`, column_type: "assignment", half: "pre", max_score: cfg.preMax, sort_order: order++ });
    }
    for (let i = 0; i < cfg.postCount; i++) {
      rows.push({ subject_id: currentAssignment.subject_id, personnel_id: currentAssignment.personnel_id,
        column_name: `หลังกลาง ${i + 1}`, column_type: "assignment", half: "post", max_score: cfg.postMax, sort_order: order++ });
    }
    if (cfg.midMax > 0) rows.push({ subject_id: currentAssignment.subject_id, personnel_id: currentAssignment.personnel_id,
      column_name: "กลางภาค", column_type: "midterm", half: "pre", max_score: cfg.midMax, sort_order: order++ });
    if (cfg.finMax > 0) rows.push({ subject_id: currentAssignment.subject_id, personnel_id: currentAssignment.personnel_id,
      column_name: "ปลายภาค", column_type: "final", half: "pre", max_score: cfg.finMax, sort_order: order++ });
    if (rows.length > 0) {
      const { error } = await supabase.from("subject_score_columns").insert(rows);
      if (error) { toast.error(saveErrorMessage(error)); return; }
    }
    toast.success("สร้างตารางคะแนนสำเร็จ");
    qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
  };

  const setColumnIndicator = async (columnId: string, indicatorId: string | null) => {
    const { error } = await supabase.from("subject_score_columns")
      .update({ indicator_id: indicatorId })
      .eq("id", columnId);
    if (error) toast.error(saveErrorMessage(error));
    else qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
  };



  // SchoolMIS-style weighted grading.
  // ครูสร้างช่องคะแนนกี่ช่องก็ได้ในแต่ละกลุ่ม ระบบจะ scale แต่ละกลุ่มให้เป็นสัดส่วน
  //   งานเก็บ 70 / กลางภาค 10 / ปลายภาค 20  (+ จิตพิสัย ถ้ามี รวมเป็น 100)
  // กลุ่มที่ไม่มีช่องคะแนนเลย จะถูกข้ามและสัดส่วนถูกกระจายให้กลุ่มอื่นโดยอัตโนมัติ
  const WEIGHTS = {
    assignment: Number(subject?.weight_assignment ?? 70),
    midterm: Number(subject?.weight_midterm ?? 10),
    final: Number(subject?.weight_final ?? 20),
    attendance: Number(subject?.weight_attendance ?? 0),
  };

  const sumGroup = (studentId: string, cols: any[]) =>
    cols.reduce((sum, col) => {
      const sc = columnScores.find((s: any) => s.student_id === studentId && s.column_id === col.id);
      return sum + (Number(sc?.score) || 0);
    }, 0);
  const maxGroup = (cols: any[]) => cols.reduce((s, c) => s + (Number(c.max_score) || 0), 0);

  const getWeightedPercent = (studentId: string) => {
    const groups = [
      { cols: assignmentColumns, w: WEIGHTS.assignment },
      { cols: midtermColumns, w: WEIGHTS.midterm },
      { cols: finalColumns, w: WEIGHTS.final },
      { cols: attendanceColumns, w: WEIGHTS.attendance },
    ];
    const activeWeight = groups.reduce((s, g) => s + (g.cols.length > 0 ? g.w : 0), 0) || 1;
    let pct = 0;
    for (const g of groups) {
      if (g.cols.length === 0) continue;
      const max = maxGroup(g.cols);
      if (max <= 0) continue;
      // กระจายน้ำหนักของกลุ่มที่ไม่มีคะแนนให้กลุ่มที่มี
      const weight = (g.w / activeWeight) * 100;
      pct += (sumGroup(studentId, g.cols) / max) * weight;
    }
    return Math.round(pct * 100) / 100;
  };

  // คงรูปเดิมไว้สำหรับแสดงผลรวมดิบในตาราง
  const getStudentTotal = (studentId: string) =>
    scoreColumns.reduce((sum, col: any) => {
      const sc = columnScores.find((s: any) => s.student_id === studentId && s.column_id === col.id);
      return sum + (Number(sc?.score) || 0);
    }, 0);
  const getMaxTotal = () => scoreColumns.reduce((s, c: any) => s + (Number(c.max_score) || 0), 0);

  const handleAutoGrade = async () => {
    if (students.length === 0 || scoreColumns.length === 0) return;
    let count = 0;
    for (const s of students) {
      const pct = getWeightedPercent(s.id);
      const { grade, gradePoint } = calculateGrade(pct, 100);
      const studentName = `${(s as any).prefix || ""}${(s as any).first_name} ${(s as any).last_name}`;
      const assignmentTotal = sumGroup(s.id, assignmentColumns);
      const midtermTotal = sumGroup(s.id, midtermColumns);
      const finalTotal = sumGroup(s.id, finalColumns);
      const attendanceTotal = sumGroup(s.id, attendanceColumns);
      await supabase.from("student_scores").upsert({
        student_name: studentName,
        student_code: (s as any).student_code,
        subject_id: currentAssignment!.subject_id,
        assignment_score: assignmentTotal,
        midterm_score: midtermTotal,
        final_score: finalTotal,
        attendance_score: attendanceTotal,
        total_score: pct,
        grade,
        grade_point: gradePoint,
      }, { onConflict: "student_code,subject_id" });
      count++;
    }
    toast.success(`ตัดเกรดอัตโนมัติสำเร็จ ${count} คน (ถ่วงน้ำหนัก ${WEIGHTS.assignment}/${WEIGHTS.midterm}/${WEIGHTS.final}${attendanceColumns.length ? "+จิตพิสัย" : ""})`);
    qc.invalidateQueries({ queryKey: ["pp5_scores"] });
  };



  return (
    <div className="space-y-6">
      {/* Assignment selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-[150px]">
              <Label className="text-xs text-muted-foreground mb-1 block">ระดับชั้น</Label>
              <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setSelectedAssignment(""); }}>
                <SelectTrigger><SelectValue placeholder="เลือกระดับชั้น" /></SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[250px]">
              <Label className="text-xs text-muted-foreground mb-1 block">เลือกรายวิชาที่สอน</Label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment} disabled={!gradeLevel}>
                <SelectTrigger><SelectValue placeholder={gradeLevel ? "เลือกรายวิชา/ห้องเรียน" : "กรุณาเลือกระดับชั้นก่อน"} /></SelectTrigger>
                <SelectContent>
                  {filteredAssignments.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.subjects?.code} {a.subjects?.name_th} - {a.classrooms?.name} ({a.personnel?.first_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currentAssignment && (
              <div className="flex gap-2 mt-5">
                <Button variant="outline" onClick={handleAutoGrade}>
                  <Calculator className="w-4 h-4 mr-1" /> ตัดเกรดอัตโนมัติ
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedAssignment ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{gradeLevel ? "กรุณาเลือกรายวิชาที่จะบันทึกคะแนน" : "กรุณาเลือกระดับชั้นก่อน"}</CardContent></Card>
      ) : (
        <Tabs defaultValue="scores" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap whitespace-nowrap max-w-full">
            <TabsTrigger value="scores" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" /> บันทึกคะแนน</TabsTrigger>
            <TabsTrigger value="attendance" className="gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> เวลาเรียน</TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> สรุปผล</TabsTrigger>
          </TabsList>

          {/* Score entry tab — รวมการตั้งค่าทั้งหมดไว้หน้าเดียวกัน */}
          <TabsContent value="scores" className="space-y-4">
            {/* Collapsible setup panel: indicators + structure + weights */}
            <details className="rounded-lg border bg-card" {...(scoreColumns.length === 0 ? { open: true } : {})}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4" /> ตั้งค่าตาราง / ตัวชี้วัด / สัดส่วนคะแนน
              </summary>
              <div className="p-4 pt-0 space-y-4">
                {/* Bulk structure generator */}
                <BulkStructureDialog onGenerate={handleBulkGenerate} />

                {/* Indicators inline manager */}
                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4" /> ตัวชี้วัด (แสดงเหนือช่องคะแนน)</div>
                    <Dialog open={indicatorOpen} onOpenChange={setIndicatorOpen}>
                      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" /> เพิ่มตัวชี้วัด</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>เพิ่มตัวชี้วัด</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>ตัวชี้วัด</Label><Input value={indicatorForm.title} onChange={e => setIndicatorForm({...indicatorForm, title: e.target.value})} /></div>
                          <div><Label>รายละเอียด</Label><Textarea value={indicatorForm.description} onChange={e => setIndicatorForm({...indicatorForm, description: e.target.value})} /></div>
                          <Button onClick={handleAddIndicator} className="w-full">บันทึก</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {indicators.length === 0 ? (
                    <p className="text-xs text-muted-foreground">ยังไม่มีตัวชี้วัด</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {indicators.map((ind: any, i: number) => (
                        <Badge key={ind.id} variant="secondary" className="gap-2">
                          {i + 1}. {ind.title}
                          <button onClick={() => handleDeleteIndicator(ind.id)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weights editor */}
                {!isActivitySubject && (
                  <WeightsCard
                    key={currentAssignment?.subject_id}
                    initial={WEIGHTS}
                    onSave={saveWeights}
                  />
                )}
              </div>
            </details>

            {scoreColumns.length === 0 && !isActivitySubject ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">
                ยังไม่มีช่องคะแนน — กดปุ่ม "กำหนดโครงสร้างตาราง" ในแผงตั้งค่าด้านบนเพื่อสร้างทั้งตารางในคลิกเดียว
              </CardContent></Card>
            ) : null}
            {(() => {
              if (isActivitySubject) {
                if (indicators.length === 0) {
                  return <Card><CardContent className="p-8 text-center text-muted-foreground">วิชากิจกรรม: กรุณาเพิ่ม "ตัวชี้วัด" ในแผงตั้งค่าด้านบนก่อน — แต่ละตัวชี้วัดจะกลายเป็นคอลัมน์ ผ่าน/ไม่ผ่าน อัตโนมัติ</CardContent></Card>;
                }
                const cols = activityColumns;
                return (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto scrollbar-thin">
                        <Table className="border">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10 text-center border align-middle">เลขที่</TableHead>
                              <TableHead className="text-center border align-middle">รหัสนักเรียน</TableHead>
                              <TableHead className="text-center border align-middle min-w-[180px]">ชื่อ - สกุล</TableHead>
                              {cols.map((col: any) => (
                                <TableHead key={col.id} className="text-center p-1 align-bottom border" style={{ minWidth: 48 }}>
                                  <div className="mx-auto" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 110, whiteSpace: "nowrap" }}>
                                    {col.column_name}
                                  </div>
                                </TableHead>
                              ))}
                              <TableHead className="text-center border align-middle">ผลการประเมิน</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {students.length === 0 ? (
                              <TableRow><TableCell colSpan={4 + cols.length} className="text-center py-8 text-muted-foreground">ไม่มีนักเรียนในห้องนี้</TableCell></TableRow>
                            ) : students.map((s: any, idx: number) => {
                              const scores = cols.map((c: any) => Number(getScore(s.id, c.id)) || 0);
                              const allPass = scores.length > 0 && scores.every(v => v === 1);
                              return (
                                <TableRow key={s.id}>
                                  <TableCell className="text-center border">{idx + 1}</TableCell>
                                  <TableCell className="text-center border text-xs">{s.student_code}</TableCell>
                                  <TableCell className="border text-sm">{s.prefix}{s.first_name} {s.last_name}</TableCell>
                                  {cols.map((c: any) => {
                                    const v = Number(getScore(s.id, c.id)) || 0;
                                    return (
                                      <TableCell key={c.id} className="text-center border p-1">
                                        <Button
                                          size="sm"
                                          variant={v === 1 ? "default" : "outline"}
                                          className={`h-8 w-12 text-xs ${v === 1 ? "bg-green-600 hover:bg-green-700" : "text-muted-foreground"}`}
                                          onClick={() => togglePassFail(s.id, c.id)}
                                        >
                                          {v === 1 ? "ผ" : "มผ"}
                                        </Button>
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="text-center border">
                                    <Badge className={allPass ? "bg-green-600" : "bg-destructive"}>{allPass ? "ผ่าน" : "ไม่ผ่าน"}</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return null;
            })()}
            {!isActivitySubject && (() => {
              const preCols = assignmentColumns.filter((c: any) => (c.half ?? "pre") === "pre");
              const postCols = assignmentColumns.filter((c: any) => c.half === "post");
              const midCols = midtermColumns;
              const finCols = finalColumns;
              const sumMax = (cs: any[]) => cs.reduce((s, c) => s + Number(c.max_score || 0), 0);
              const sumScore = (sid: string, cs: any[]) =>
                cs.reduce((s, c) => {
                  const v = columnScores.find((x: any) => x.student_id === sid && x.column_id === c.id);
                  return s + (Number(v?.score) || 0);
                }, 0);

              const headerCell = (col: any) => (
                <TableHead key={col.id} className="text-center p-0.5 align-bottom border" style={{ minWidth: 28 }}>
                  <div className="mx-auto" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 84, whiteSpace: "nowrap", fontSize: 11 }}>
                    {col.column_name}
                  </div>
                  <button onClick={() => handleDeleteColumn(col.id)} className="opacity-30 hover:opacity-100 block mx-auto mt-0.5" title="ลบ">
                    <Trash2 className="w-2.5 h-2.5 text-destructive" />
                  </button>
                </TableHead>
              );
              const maxRow = (cs: any[]) => cs.map((c: any) => (
                <TableCell key={c.id} className="text-center text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 p-0.5 border border-border">{c.max_score}</TableCell>
              ));
              const inputRow = (sid: string, cs: any[]) => cs.map((c: any) => {
                const row: any = getScoreRow(sid, c.id);
                const pending = row?.status === "pending";
                const overdue = row?.status === "overdue";
                return (
                  <TableCell key={c.id} className="p-0 border border-border bg-background">
                    <Input
                      type="text"
                      inputMode="decimal"
                      title={c.homework_assignment_id ? (pending ? "ยังไม่ส่ง (ร)" : overdue ? "เลยกำหนดส่ง (0)" : "จากการบ้าน") : undefined}
                      className={`h-7 text-center text-xs font-medium w-12 mx-auto px-0.5 border-0 rounded-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-primary/5 ${pending ? "text-amber-600 font-bold" : overdue ? "text-rose-600 font-bold" : ""}`}
                      value={getScore(sid, c.id)}
                      onChange={e => handleScoreChange(sid, c.id, e.target.value)}
                    />
                  </TableCell>
                );
              });

              return (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto scrollbar-thin">
                      <Table className="border-2 border-border [&_td]:py-0.5 [&_th]:py-1 [&_th]:border [&_th]:border-border text-xs [&_tbody_tr:hover]:bg-primary/10 [&_tbody_tr:nth-child(even)]:bg-muted/10">
                        <TableHeader>
                          {/* Row 0: indicator picker per column (รวมตัวชี้วัดด้านบน) */}
                          {indicators.length > 0 && (
                            <TableRow>
                              <TableHead colSpan={3} rowSpan={1} className="text-center border bg-muted/20 text-xs">ตัวชี้วัด ↓</TableHead>
                              {[...preCols, null, ...postCols, null,
                                ...(midCols.length > 0 ? midCols : [null]),
                                ...(finCols.length > 0 ? finCols : [null])].map((col: any, i: number) => {
                                if (!col) return <TableHead key={`gap-${i}`} className="border bg-muted/10" />;
                                const ind = indicators.find((x: any) => x.id === col.indicator_id);
                                return (
                                  <TableHead key={`ind-${col.id}`} className="text-center p-0.5 border bg-muted/10">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px] font-normal w-full truncate" title={ind?.title || "เลือกตัวชี้วัด"}>
                                          {ind ? `ตชว.${indicators.findIndex((x: any) => x.id === ind.id) + 1}` : "—"}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-64 p-2 space-y-1" align="start">
                                        <div className="text-xs font-semibold mb-1">เลือกตัวชี้วัด</div>
                                        <button className="w-full text-left text-xs p-1.5 rounded hover:bg-muted" onClick={() => setColumnIndicator(col.id, null)}>— ไม่กำหนด —</button>
                                        {indicators.map((x: any, idx: number) => (
                                          <button key={x.id} className={`w-full text-left text-xs p-1.5 rounded hover:bg-muted ${x.id === col.indicator_id ? "bg-primary/10 font-semibold" : ""}`} onClick={() => setColumnIndicator(col.id, x.id)}>
                                            {idx + 1}. {x.title}
                                          </button>
                                        ))}
                                      </PopoverContent>
                                    </Popover>
                                  </TableHead>
                                );
                              })}
                              <TableHead colSpan={3} className="border bg-muted/10" />
                            </TableRow>
                          )}
                          {/* Row A: top groups */}
                          <TableRow>
                            <TableHead rowSpan={3} className="w-10 text-center border align-middle">เลขที่</TableHead>
                            <TableHead rowSpan={3} className="text-center border align-middle">รหัสนักเรียน</TableHead>
                            <TableHead rowSpan={3} className="text-center border align-middle min-w-[180px]">ชื่อ - สกุล</TableHead>
                            <TableHead colSpan={preCols.length + 1} className="text-center border bg-muted/30">ก่อนกลางภาค</TableHead>
                            <TableHead colSpan={postCols.length + 1} className="text-center border bg-muted/30">หลังกลางภาค</TableHead>
                            <TableHead colSpan={Math.max(midCols.length, 1)} className="text-center border bg-muted/30">กลางภาค</TableHead>
                            <TableHead colSpan={Math.max(finCols.length, 1)} className="text-center border bg-muted/30">ปลายภาค</TableHead>
                            <TableHead rowSpan={3} className="text-center border align-middle">รวม<br/>(100)</TableHead>
                            <TableHead rowSpan={3} className="text-center border align-middle">ผลการประเมิน<br/>(0-4)</TableHead>
                            <TableHead rowSpan={3} className="text-center border align-middle p-1">
                              <InlineAddColumn value={columnForm} onChange={setColumnForm} onAdd={handleAddColumn} nextOrder={scoreColumns.length} weights={WEIGHTS} />
                            </TableHead>
                          </TableRow>
                          {/* Row B: column names (rotated) + subtotal headers */}
                          <TableRow>
                            {preCols.map(headerCell)}
                            <TableHead className="text-center border bg-muted/20 align-bottom">
                              <div className="mx-auto" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 60 }}>รวม</div>
                            </TableHead>
                            {postCols.map(headerCell)}
                            <TableHead className="text-center border bg-muted/20 align-bottom">
                              <div className="mx-auto" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 60 }}>รวม</div>
                            </TableHead>
                            {midCols.length > 0 ? midCols.map(headerCell) : <TableHead className="border" />}
                            {finCols.length > 0 ? finCols.map(headerCell) : <TableHead className="border" />}
                          </TableRow>
                          {/* Row C: max scores */}
                          <TableRow>
                            {maxRow(preCols)}
                            <TableCell className="text-center text-xs font-bold bg-blue-100 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-border">{sumMax(preCols)}</TableCell>
                            {maxRow(postCols)}
                            <TableCell className="text-center text-xs font-bold bg-blue-100 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-border">{sumMax(postCols)}</TableCell>
                            {midCols.length > 0 ? maxRow(midCols) : <TableCell className="text-center text-xs bg-amber-50 dark:bg-amber-950/30 border border-border">-</TableCell>}
                            {finCols.length > 0 ? maxRow(finCols) : <TableCell className="text-center text-xs bg-amber-50 dark:bg-amber-950/30 border border-border">-</TableCell>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.length === 0 ? (
                            <TableRow><TableCell colSpan={6 + preCols.length + postCols.length + Math.max(midCols.length, 1) + Math.max(finCols.length, 1) + 2}
                              className="text-center py-8 text-muted-foreground">ไม่มีนักเรียนในห้องนี้</TableCell></TableRow>
                          ) : students.map((s: any, idx: number) => {
                            const preSum = sumScore(s.id, preCols);
                            const postSum = sumScore(s.id, postCols);
                            const pct = getWeightedPercent(s.id);
                            const { grade } = calculateGrade(pct, 100);
                            return (
                              <TableRow key={s.id}>
                                <TableCell className="text-center border">{idx + 1}</TableCell>
                                <TableCell className="text-center border text-xs">{s.student_code}</TableCell>
                                <TableCell className="border text-sm">{s.prefix}{s.first_name} {s.last_name}</TableCell>
                                {inputRow(s.id, preCols)}
                                <TableCell className="text-center font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border border-border">{preSum}</TableCell>
                                {inputRow(s.id, postCols)}
                                <TableCell className="text-center font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border border-border">{postSum}</TableCell>
                                {midCols.length > 0 ? inputRow(s.id, midCols) : <TableCell className="border border-border" />}
                                {finCols.length > 0 ? inputRow(s.id, finCols) : <TableCell className="border border-border" />}
                                <TableCell className="text-center font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border border-border">{pct}</TableCell>
                                <TableCell className="text-center border border-border"><Badge className={gradeColor(grade)}>{grade}</Badge></TableCell>
                                <TableCell className="border border-border" />
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>


          {/* Attendance / เวลาเรียน tab */}
          <TabsContent value="attendance" className="space-y-4">
            {currentAssignment && subject ? (
              <PP5AttendanceMatrix
                subjectId={currentAssignment.subject_id}
                classroomId={currentAssignment.classroom_id}
                students={students}
                hoursPerWeek={(subject as any).hours_per_week || 1}
                weeksPerSemester={(subject as any).weeks_per_semester || 20}
                periodDates={((subject as any).pp5_period_dates || []) as string[]}
                semester={(subject as any).semester || 1}
                academicYear={(subject as any).academic_year || new Date().getFullYear()}
                canEdit={isAdmin || isDirector || currentAssignment.personnel_id === myPersonnel?.id}
              />
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground">กรุณาเลือกรายวิชา</CardContent></Card>
            )}
          </TabsContent>

          {/* Summary tab */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card><CardContent className="p-5 text-center"><p className="text-xs text-muted-foreground">จำนวนนักเรียน</p><p className="text-3xl font-bold">{students.length}</p></CardContent></Card>
              <Card><CardContent className="p-5 text-center"><p className="text-xs text-muted-foreground">คะแนนเต็ม</p><p className="text-3xl font-bold">{getMaxTotal()}</p></CardContent></Card>
              <Card><CardContent className="p-5 text-center"><p className="text-xs text-muted-foreground">ช่องคะแนน</p><p className="text-3xl font-bold">{scoreColumns.length}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">การกระจายเกรด</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {["4", "3.5", "3", "2.5", "2", "1.5", "1", "0"].map(g => {
                    const count = students.filter((s: any) => {
                      return calculateGrade(getWeightedPercent(s.id), 100).grade === g;
                    }).length;
                    return (
                      <div key={g} className="text-center">
                        <div className={`rounded-xl py-3 px-2 ${gradeColor(g)} font-bold text-lg`}>{g}</div>
                        <p className="text-sm font-semibold mt-1.5">{count}</p>
                        <p className="text-xs text-muted-foreground">คน</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

// ── Score View Tab (ดูผลการเรียน / พิมพ์ ปพ.5) ──
const ScoreViewTab = () => {
  const { userId, isAdmin, isDirector } = useUserRole();
  const [gradeLevel, setGradeLevel] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [semester, setSemester] = useState("1");
  const schoolInfo = useSchoolInfo();

  const { data: allClassrooms = [] } = useQuery({ queryKey: ["classrooms"], queryFn: async () => { const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name"); return data || []; } });
  const { data: allSubjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => { const { data } = await supabase.from("subjects").select("*").order("code"); return data || []; } });

  // Get current user's personnel row, then their teacher_assignments (only their assigned subject+classroom pairs)
  const { data: myPersonnel } = useQuery({
    queryKey: ["pp5_view_personnel", userId],
    enabled: !!userId && !isAdmin && !isDirector,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: ["pp5_view_assignments", myPersonnel?.id, isAdmin, isDirector],
    enabled: isAdmin || isDirector || !!myPersonnel?.id,
    queryFn: async () => {
      let q = supabase.from("teacher_assignments").select("subject_id, classroom_id");
      if (!isAdmin && !isDirector && myPersonnel?.id) q = q.eq("personnel_id", myPersonnel.id);
      const { data } = await q;
      return data || [];
    },
  });

  const restrictByAssignment = !isAdmin && !isDirector;
  const allowedClassroomIds = new Set(myAssignments.map((a: any) => a.classroom_id));
  const allowedSubjectIds = new Set(
    myAssignments.filter((a: any) => !classroomId || a.classroom_id === classroomId).map((a: any) => a.subject_id),
  );

  const classrooms = restrictByAssignment ? allClassrooms.filter((c: any) => allowedClassroomIds.has(c.id)) : allClassrooms;
  const subjects = restrictByAssignment ? allSubjects.filter((s: any) => allowedSubjectIds.has(s.id)) : allSubjects;

  const filteredClassrooms = gradeLevel ? classrooms.filter((c: any) => c.grade_level === gradeLevel) : [];
  const filteredSubjects = gradeLevel ? subjects.filter((s: any) => s.grade_level === gradeLevel) : [];

  const { data: classStudents = [] } = useQuery({
    queryKey: ["pp5_students", classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, gender").eq("classroom_id", classroomId).eq("status", "active").order("student_code");
      return data || [];
    },
    enabled: !!classroomId,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["pp5_scores", subjectId, semester],
    queryFn: async () => {
      if (!subjectId) return [];
      let q = supabase.from("student_scores").select("*").eq("subject_id", subjectId);
      if (semester) q = q.eq("semester", parseInt(semester));
      const { data } = await q.order("student_name");
      return data || [];
    },
    enabled: !!subjectId,
  });

  const mergedData = classStudents.map((s: any) => {
    const score = scores.find((sc: any) => sc.student_code === s.student_code);
    return {
      id: s.id, student_code: s.student_code,
      student_name: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
      assignment_score: score?.assignment_score || 0, midterm_score: score?.midterm_score || 0,
      final_score: score?.final_score || 0, attendance_score: score?.attendance_score || 0,
      total_score: score?.total_score || 0, grade: score?.grade || "-", grade_point: score?.grade_point || 0,
    };
  });

  const displayData = classroomId ? mergedData : scores;
  const selectedSubject = subjects.find((s: any) => s.id === subjectId);
  const selectedClassroom = classrooms.find((c: any) => c.id === classroomId);

  const gradeDist: Record<string, number> = {};
  const gradeOrder = ["4", "3.5", "3", "2.5", "2", "1.5", "1", "0", "ร", "มส"];
  displayData.forEach((s: any) => { const g = s.grade || "0"; gradeDist[g] = (gradeDist[g] || 0) + 1; });

  const { data: teacherAssignment } = useQuery({
    queryKey: ["pp5_teacher", subjectId, classroomId],
    queryFn: async () => {
      if (!subjectId || !classroomId) return null;
      const { data } = await supabase.from("teacher_assignments").select("*, personnel(*)").eq("subject_id", subjectId).eq("classroom_id", classroomId).maybeSingle();
      return data;
    },
    enabled: !!subjectId && !!classroomId,
  });

  const teacherName = teacherAssignment?.personnel
    ? `${teacherAssignment.personnel.prefix || ""}${teacherAssignment.personnel.first_name} ${teacherAssignment.personnel.last_name}` : "";

  const handlePrint = async () => {
    if (!selectedSubject) return;
    const { printByCode } = await import("@/lib/printTemplate");



    // Paginate: ~32 students per page for A4 portrait with compact layout
    const ROWS_PER_PAGE = 32;
    const pages: any[][] = [];
    for (let i = 0; i < displayData.length; i += ROWS_PER_PAGE) {
      pages.push(displayData.slice(i, i + ROWS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);

    // Summary + signatures are compact now (no criteria table), so fits if <=26 rows
    const lastPageRows = pages[pages.length - 1].length;
    const canFitSummaryOnLastPage = lastPageRows <= 26;

    const totalPages = canFitSummaryOnLastPage ? pages.length : pages.length + 1;
    const beYear = selectedSubject.academic_year ? selectedSubject.academic_year + BE_OFFSET : new Date().getFullYear() + BE_OFFSET;
    const classLabel = selectedClassroom ? `${selectedClassroom.name}` : "";

    const headerHtml = (pageNum: number) => `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2pt;">
        <div style="font-size:10pt; color:#444;">ปพ.๕</div>
        <div style="text-align:center; flex:1;">
          <div style="font-size:14pt; font-weight:700;">${schoolInfo.school_name || "โรงเรียน"}</div>
          ${schoolInfo.school_address ? `<div style="font-size:10pt;">${schoolInfo.school_address}</div>` : ""}
        </div>
        <div style="font-size:10pt; color:#444;">หน้า ${toThaiDigits(pageNum)}/${toThaiDigits(totalPages)}</div>
      </div>
      <div style="text-align:center; font-size:13pt; font-weight:700; margin-bottom:1pt;">แบบบันทึกผลการเรียนประจำรายวิชา (ปพ.๕)</div>
      <div style="text-align:center; font-size:10pt; margin-bottom:4pt;">ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 10pt; font-size:11pt; border:1px solid #999; padding:3pt 6pt; margin-bottom:4pt; line-height:1.5;">
        <div>รายวิชา <strong>${selectedSubject.name_th}</strong> (${selectedSubject.code})</div>
        <div>ภาคเรียนที่ <strong>${toThaiDigits(semester)}</strong> ปีการศึกษา <strong>${toThaiDigits(beYear)}</strong></div>
        <div>ระดับชั้น <strong>${classLabel}</strong></div>
        <div>หน่วยกิต <strong>${toThaiDigits(selectedSubject.credits || "-")}</strong> ${teacherName ? `ครูผู้สอน <strong>${teacherName}</strong>` : ""}</div>
        <div>ประเภท <strong>${selectedSubject.subject_type === "required" ? "วิชาพื้นฐาน" : "วิชาเพิ่มเติม"}</strong></div>
        <div>จำนวนนักเรียน <strong>${toThaiDigits(displayData.length)}</strong> คน</div>
      </div>
      <div style="font-size:9pt; display:flex; gap:12pt; margin-bottom:3pt; color:#444;">
        <span>สัดส่วนคะแนน: ระหว่างเรียน <strong>${toThaiDigits(SCORE_PROPORTIONS.duringTerm)}</strong></span>
        <span>กลางภาค <strong>${toThaiDigits(SCORE_PROPORTIONS.midterm)}</strong></span>
        <span>ปลายภาค <strong>${toThaiDigits(SCORE_PROPORTIONS.final)}</strong></span>
        <span>รวม <strong>${toThaiDigits(SCORE_PROPORTIONS.total)}</strong></span>
      </div>`;

    const tableHead = `<table class="obec-table" style="font-size:10pt;">
      <thead><tr>
        <th style="width:24px; font-size:9pt;">ลำดับ</th>
        <th style="width:50px; font-size:9pt;">รหัส</th>
        <th style="font-size:9pt;">ชื่อ-สกุล</th>
        <th class="center" style="width:40px; font-size:9pt;">ระหว่าง<br/>เรียน</th>
        <th class="center" style="width:34px; font-size:9pt;">กลาง<br/>ภาค</th>
        <th class="center" style="width:34px; font-size:9pt;">ปลาย<br/>ภาค</th>
        <th class="center" style="width:34px; font-size:9pt;">เวลา<br/>เรียน</th>
        <th class="center" style="width:30px; font-size:9pt;">รวม</th>
        <th class="center" style="width:30px; font-size:9pt;">ผล</th>
      </tr></thead>`;

    // Only summary row (no criteria table) + signatures
    const summaryHtml = `
      <div style="font-size:11pt; font-weight:700; margin:6pt 0 3pt; border-bottom:1px solid #999; padding-bottom:2pt;">สรุปผลการประเมิน</div>
      <table class="obec-table" style="font-size:10pt; width:auto; min-width:50%;">
        <thead><tr><th style="font-size:9pt;">จำนวน นร.</th>${gradeOrder.map(g => `<th class="center" style="font-size:9pt;">${g}</th>`).join("")}</tr></thead>
        <tbody><tr><td class="center bold">${displayData.length}</td>${gradeOrder.map(g => `<td class="center">${gradeDist[g] || "-"}</td>`).join("")}</tr></tbody>
      </table>`;

    const signaturesHtml = `
      <div style="margin-top:14pt; page-break-inside:avoid;">
        <div class="obec-sig-grid-2">
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-name" style="font-size:11pt;">${teacherName || "(ครูผู้สอน)"}</div><div class="obec-sig-title" style="font-size:10pt;">ครูผู้สอน</div></div>
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-title" style="font-size:10pt;">หัวหน้ากลุ่มสาระการเรียนรู้</div></div>
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-title" style="font-size:10pt;">หัวหน้างานวัดและประเมินผล</div></div>
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-name" style="font-size:11pt;">${schoolInfo.director_name || "(ผู้อำนวยการ)"}</div><div class="obec-sig-title" style="font-size:10pt;">${schoolInfo.director_title}</div></div>
        </div>
      </div>`;

    const studentPagesHtml = pages.map((pageData, pi) => {
      const startIdx = pi * ROWS_PER_PAGE;
      const isLastPage = pi === pages.length - 1;
      const rows = pageData.map((s: any, i: number) => `<tr>
        <td class="center" style="font-size:10pt;">${startIdx + i + 1}</td>
        <td style="font-size:9pt;">${s.student_code}</td>
        <td style="font-size:10pt;">${s.student_name}</td>
        <td class="center">${s.assignment_score}</td>
        <td class="center">${s.midterm_score}</td>
        <td class="center">${s.final_score}</td>
        <td class="center">${s.attendance_score}</td>
        <td class="center bold">${s.total_score}</td>
        <td class="center bold">${s.grade}</td>
      </tr>`).join("");

      const appendSummary = isLastPage && canFitSummaryOnLastPage;

      return `<div class="obec-a4-page" ${pi > 0 ? 'style="page-break-before:always;"' : ""}>
        ${headerHtml(pi + 1)}
        ${tableHead}<tbody>${rows}</tbody></table>
        ${appendSummary ? summaryHtml + signaturesHtml : ""}
      </div>`;
    }).join("");

    const separateSummaryPage = canFitSummaryOnLastPage ? "" : `<div class="obec-a4-page" style="page-break-before:always;">
      ${headerHtml(totalPages)}
      ${summaryHtml}
      ${signaturesHtml}
    </div>`;

    const tplData = { school: schoolInfo, subject: selectedSubject, students: displayData, teacher: teacherName, today: new Date().toISOString() };
    const used = await printByCode("pp5", tplData);
    if (!used) openPrintWindow(studentPagesHtml + separateSummaryPage, { title: "ปพ.5", landscape: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-end">
        <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setClassroomId(""); setSubjectId(""); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
          <SelectContent>
            {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classroomId} onValueChange={setClassroomId} disabled={!gradeLevel}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder={gradeLevel ? "เลือกห้องเรียน" : "เลือกระดับชั้นก่อน"} /></SelectTrigger>
          <SelectContent>{filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subjectId} onValueChange={setSubjectId} disabled={!gradeLevel}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder={gradeLevel ? "เลือกรายวิชา" : "เลือกระดับชั้นก่อน"} /></SelectTrigger>
          <SelectContent>{filteredSubjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.code} - {s.name_th}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={semester} onValueChange={setSemester}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
            <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
          </SelectContent>
        </Select>
        {subjectId && <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />พิมพ์</Button>}
        {subjectId && selectedSubject && (
          <Button variant="outline" onClick={async () => {
            const { printByCode } = await import("@/lib/printTemplate");
            await printByCode("pp5_cover", {
              school: { name: schoolInfo.school_name, address: schoolInfo.school_address, logo: schoolInfo.school_logo },
              class: { label: (selectedSubject as any).classroom_label || (selectedSubject as any).grade_level || "" },
              semester: (selectedSubject as any).semester,
              year: (selectedSubject as any).academic_year,
              homeroom_teacher: teacherName,
            });
          }}><Printer className="w-4 h-4 mr-2" />พิมพ์ปก</Button>
        )}
      </div>

      {subjectId && selectedSubject && (
        <Card className="border shadow-sm">
          <CardContent className="p-8">
            <div className="text-center border-b border-b-foreground/20 pb-4 mb-4">
              <h1 className="text-xl font-bold">{schoolInfo.school_name || "โรงเรียน"}</h1>
              <h2 className="text-base font-bold mt-1">แบบบันทึกผลการเรียนประจำรายวิชา (ปพ.5)</h2>
              <p className="text-sm text-muted-foreground">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm border rounded-lg p-4 bg-muted/20">
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ภาคเรียนที่</span><span className="font-semibold">{semester}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ปีการศึกษา</span><span className="font-semibold">{selectedSubject.academic_year ? selectedSubject.academic_year + BE_OFFSET : new Date().getFullYear() + BE_OFFSET}</span></div>
              {selectedClassroom && <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ระดับชั้น</span><span className="font-semibold">{selectedClassroom.grade_level} - {selectedClassroom.name}</span></div>}
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">กลุ่มสาระ</span><span className="font-semibold">{selectedSubject.subject_type === 'required' ? 'วิชาพื้นฐาน' : 'วิชาเพิ่มเติม'}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">รายวิชา</span><span className="font-semibold">{selectedSubject.name_th}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">รหัสวิชา</span><span className="font-semibold">{selectedSubject.code}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">หน่วยกิต</span><span className="font-semibold">{selectedSubject.credits}</span></div>
              {teacherName && <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ครูผู้สอน</span><span className="font-semibold">{teacherName}</span></div>}
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">จำนวนนักเรียน</span><span className="font-semibold">{displayData.length} คน</span></div>
            </div>
            <div className="mt-6 overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10 text-center border-r">ลำดับ</TableHead>
                    <TableHead className="w-20 border-r">รหัส</TableHead>
                    <TableHead className="border-r">ชื่อ-สกุล</TableHead>
                    <TableHead className="text-center border-r">ระหว่างเรียน</TableHead>
                    <TableHead className="text-center border-r">กลางภาค</TableHead>
                    <TableHead className="text-center border-r">ปลายภาค</TableHead>
                    <TableHead className="text-center border-r">เวลาเรียน</TableHead>
                    <TableHead className="text-center border-r">รวม</TableHead>
                    <TableHead className="text-center">ระดับผลการเรียน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.map((s: any, i: number) => (
                    <TableRow key={s.id || i}>
                      <TableCell className="text-center border-r">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs border-r">{s.student_code}</TableCell>
                      <TableCell className="text-sm border-r">{s.student_name}</TableCell>
                      <TableCell className="text-center border-r">{s.assignment_score}</TableCell>
                      <TableCell className="text-center border-r">{s.midterm_score}</TableCell>
                      <TableCell className="text-center border-r">{s.final_score}</TableCell>
                      <TableCell className="text-center border-r">{s.attendance_score}</TableCell>
                      <TableCell className="text-center font-bold border-r">{s.total_score}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={gradeColor(s.grade)}>{s.grade}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {displayData.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล - กรุณาเลือกห้องเรียนและรายวิชา</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {displayData.length > 0 && (
              <div className="mt-8 space-y-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-bold text-sm mb-3">สรุปผลการประเมิน</h4>
                  <Table className="text-xs">
                    <TableHeader><TableRow>
                      <TableHead className="text-center py-1">จำนวน นร.</TableHead>
                      {gradeOrder.map(g => <TableHead key={g} className="text-center py-1">{g}</TableHead>)}
                    </TableRow></TableHeader>
                    <TableBody><TableRow>
                      <TableCell className="text-center font-bold">{displayData.length}</TableCell>
                      {gradeOrder.map(g => <TableCell key={g} className="text-center">{gradeDist[g] || "-"}</TableCell>)}
                    </TableRow></TableBody>
                  </Table>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-bold text-sm mb-3">เกณฑ์ระดับผลการเรียน</h4>
                  <Table className="text-xs">
                    <TableHeader><TableRow>
                      <TableHead className="py-1">ช่วงคะแนน (%)</TableHead>
                      <TableHead className="py-1">ความหมาย</TableHead>
                      <TableHead className="text-center py-1">ระดับ</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {GRADE_CRITERIA.map(c => (
                        <TableRow key={c.grade}>
                          <TableCell className="py-0.5">{c.min} - {c.max}</TableCell>
                          <TableCell className="py-0.5">{c.label}</TableCell>
                          <TableCell className="text-center py-0.5 font-bold">{c.grade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <div className="mt-12 pt-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-10 gap-x-4">
                <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">{teacherName || "ครูผู้สอน"}</p></div>
                <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">หัวหน้ากลุ่มสาระการเรียนรู้</p></div>
                <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">หัวหน้างานวัดและประเมินผล</p></div>
                <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">{schoolInfo.director_name || "ผู้อำนวยการ"}</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── File Management Tab ──
const FileTab = () => {
  const { isAdmin, isDirector } = useUserRole();
  const qc = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: pp5Files = [], isLoading } = useQuery({
    queryKey: ["pp5_files"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pp5_files").select("*").order("academic_year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // จำกัดย้อนหลังได้แค่ 3 ปีการศึกษา (current + 3)
  const years = [...new Set(pp5Files.map((f: any) => f.academic_year))]
    .sort((a, b) => b - a)
    .slice(0, 4);
  
  let filtered = pp5Files as any[];
  if (selectedYear !== "all") filtered = filtered.filter((f: any) => String(f.academic_year) === selectedYear);
  if (selectedGrade !== "all") filtered = filtered.filter((f: any) => f.grade_level === selectedGrade);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((f: any) =>
      (f.subject_name || "").toLowerCase().includes(q) ||
      (f.subject_code || "").toLowerCase().includes(q) ||
      (f.teacher_name || "").toLowerCase().includes(q) ||
      (f.file_name || "").toLowerCase().includes(q)
    );
  }

  const grouped = GRADE_LEVELS.reduce((acc, grade) => {
    const files = filtered.filter((f: any) => f.grade_level === grade);
    if (files.length > 0) acc[grade] = files;
    return acc;
  }, {} as Record<string, any[]>);

  const handleDownload = async (fileUrlOrPath: string, fileName: string, filePath?: string, inline = false) => {
    let href = fileUrlOrPath;
    const path = filePath || (fileUrlOrPath?.match(/\/pp5-files\/(.+?)(\?|$)/)?.[1] ?? "");
    if (path) {
      const { data } = await supabase.storage.from("pp5-files").createSignedUrl(path, 300);
      if (data?.signedUrl) href = data.signedUrl;
    }
    if (inline) { window.open(href, "_blank", "noopener,noreferrer"); return; }
    const a = document.createElement("a");
    a.href = href; a.download = fileName; a.target = "_blank"; a.rel = "noreferrer"; a.click();
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!(await swal.confirm({ title: "ต้องการลบไฟล์นี้หรือไม่?", danger: true }))) return;
    await supabase.storage.from("pp5-files").remove([filePath]);
    const { error } = await supabase.from("pp5_files").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบไฟล์สำเร็จ");
    qc.invalidateQueries({ queryKey: ["pp5_files"] });
  };

  const handleAnnounce = async (file: any) => {
    if (!file?.parsed_data) {
      toast.error("ไฟล์นี้ยังไม่ได้อ่านข้อมูล กรุณาอัพโหลดใหม่ผ่านปุ่ม 'อ่านอัตโนมัติ'");
      return;
    }
    if (file.announced_at && !(await swal.confirm({ title: "ประกาศซ้ำอีกครั้ง?", text: "ระบบจะส่งการแจ้งเตือนใหม่ให้นักเรียนทุกคน" }))) return;
    const { data, error } = await supabase.functions.invoke("announce-pp5-scores", { body: { file_id: file.id } });
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success(`ประกาศสำเร็จ — แจ้งเตือน ${data?.notified || 0}/${data?.total || 0} คน`);
    qc.invalidateQueries({ queryKey: ["pp5_files"] });
  };

  const handleApplyToSystem = async (file: any) => {
    if (!(await swal.confirm({
      title: "บันทึกคะแนนจากไฟล์ลงระบบ?",
      text: `ระบบจะสร้าง/ใช้ช่องคะแนน "รวม (นำเข้าจากไฟล์ ปพ.5)" ในวิชา "${file.subject_name || "-"}" แล้ว upsert คะแนนรวมของนักเรียนทุกคนในไฟล์นี้`,
    }))) return;
    const t = toast.loading("กำลังบันทึกคะแนนลงระบบ...");
    try {
      const res = await applyPp5FileToSystem(file);
      toast.dismiss(t);
      toast.success(`บันทึกสำเร็จ — ${res.applied} คน (ข้าม ${res.skipped} คน)${res.unmatched.length ? ` · ไม่พบรหัส: ${res.unmatched.slice(0, 5).join(", ")}${res.unmatched.length > 5 ? "..." : ""}` : ""}`);
      qc.invalidateQueries({ queryKey: ["student_column_scores"] });
      qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "บันทึกคะแนนไม่สำเร็จ");
    }
  };

  const gradeGroups = [
    { label: "อนุบาล", grades: ["อ.1", "อ.2", "อ.3"] },
    { label: "ประถมศึกษา", grades: ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"] },
    { label: "ม.ต้น", grades: ["ม.1", "ม.2", "ม.3"] },
    { label: "ม.ปลาย", grades: ["ม.4", "ม.5", "ม.6"] },
  ];
  const activeGroups = gradeGroups.filter(g => g.grades.some(gr => grouped[gr]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="ปีการศึกษา" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกปีการศึกษา</SelectItem>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกระดับชั้น</SelectItem>
            {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาวิชา, รหัส, ครู..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <PP5AutoImportDialog onImportSuccess={() => qc.invalidateQueries({ queryKey: ["pp5_files"] })} />
        
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{filtered.length}</p><p className="text-xs text-muted-foreground">ไฟล์ทั้งหมด</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{Object.keys(grouped).length}</p><p className="text-xs text-muted-foreground">ระดับชั้น</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{new Set(filtered.map((f: any) => f.subject_name)).size}</p><p className="text-xs text-muted-foreground">รายวิชา</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{years.length}</p><p className="text-xs text-muted-foreground">ปีการศึกษา</p></CardContent></Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">กำลังโหลด...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">ยังไม่มีไฟล์ ปพ.5 ในระบบ</p>
            <p className="text-sm text-muted-foreground">กดปุ่ม "นำเข้า ปพ.5" เพื่ออัพโหลดไฟล์</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={activeGroups[0]?.label || ""}>
          <TabsList className="flex-wrap h-auto gap-1">
            {activeGroups.map(g => <TabsTrigger key={g.label} value={g.label} className="text-xs">{g.label}</TabsTrigger>)}
          </TabsList>
          {activeGroups.map(group => (
            <TabsContent key={group.label} value={group.label} className="space-y-4">
              {group.grades.filter(gr => grouped[gr]).map(grade => (
                <Card key={grade}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm">{grade}</Badge>
                      <span>{grouped[grade].length} วิชา</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-x-auto scrollbar-thin">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>รายวิชา</TableHead>
                          <TableHead className="w-24">รหัสวิชา</TableHead>
                          <TableHead className="w-16 text-center">เทอม</TableHead>
                          <TableHead className="w-20 text-center">ปีการศึกษา</TableHead>
                          <TableHead>ครูผู้สอน</TableHead>
                          <TableHead className="w-40">ไฟล์</TableHead>
                          <TableHead className="w-32 text-center">ประกาศ</TableHead>
                          <TableHead className="w-28 text-center">การจัดการ</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {grouped[grade].map((f: any) => (
                            <TableRow key={f.id}>
                              <TableCell className="font-medium">{f.subject_name || "-"}</TableCell>
                              <TableCell className="font-mono text-xs">{f.subject_code || "-"}</TableCell>
                              <TableCell className="text-center">{f.semester}</TableCell>
                              <TableCell className="text-center">{f.academic_year}</TableCell>
                              <TableCell className="text-sm">{f.teacher_name || "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                                {f.file_name}
                                {f.parsed_data && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Sparkles className="w-3 h-3 text-primary" />
                                    <span className="text-[10px] text-primary">อ่านอัตโนมัติแล้ว</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {f.parsed_data ? (
                                  <Button
                                    size="sm"
                                    variant={f.announced_at ? "outline" : "default"}
                                    onClick={() => handleAnnounce(f)}
                                    className="gap-1"
                                  >
                                    {f.announced_at ? <CheckCircle2 className="w-3 h-3" /> : <Megaphone className="w-3 h-3" />}
                                    <span className="text-xs">{f.announced_at ? "ประกาศซ้ำ" : "ประกาศ"}</span>
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => handleDownload(f.file_url, f.file_name, f.file_path, true)} title="ดูไฟล์">
                                    <FolderOpen className="w-4 h-4 text-blue-600" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDownload(f.file_url, f.file_name, f.file_path)} title="ดาวน์โหลด">
                                    <Download className="w-4 h-4 text-primary" />
                                  </Button>
                                  {f.parsed_data && (
                                    <Button size="icon" variant="ghost" onClick={() => handleApplyToSystem(f)} title="บันทึกคะแนนลงระบบ (สร้างช่อง 'รวม (นำเข้าจากไฟล์)')">
                                      <Save className="w-4 h-4 text-emerald-600" />
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(f.id, f.file_path)} title="ลบ (แอดมินเท่านั้น)">
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

// ── Assessment Tab (ประเมินผลผู้เรียน) ──
const ASSESSMENT_CATEGORIES = [
  { value: "competency", label: "สมรรถนะสำคัญของผู้เรียน", icon: Star },
  { value: "desirable", label: "คุณลักษณะอันพึงประสงค์", icon: Star },
  { value: "reading_writing", label: "การอ่าน คิดวิเคราะห์และเขียน", icon: PenLine },
] as const;

const ASSESSMENT_SCORE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

const AssessmentTab = () => {
  const { isAdmin, isDirector, userId } = useUserRole();
  const qc = useQueryClient();

  const [gradeLevel, setGradeLevel] = useState("");
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetSelections, setPresetSelections] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("competency");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [criteriaForm, setCriteriaForm] = useState({ title: "", description: "", category: "competency" });
  const [bulkScores, setBulkScores] = useState<Record<string, number>>({});
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const { data: myProfile } = useQuery({
    queryKey: ["my_profile_for_assessment", userId],
    enabled: !!userId && !isAdmin && !isDirector,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("first_name, last_name").eq("id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: myPersonnel } = useQuery({
    queryKey: ["my_personnel_assessment", myProfile?.first_name],
    enabled: !!myProfile?.first_name && !isAdmin && !isDirector,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id").eq("first_name", myProfile!.first_name!).eq("last_name", myProfile!.last_name!).maybeSingle();
      return data;
    },
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: ["assessment_teacher_assignments", myPersonnel?.id, isAdmin, isDirector],
    queryFn: async () => {
      let query = supabase.from("teacher_assignments").select("*, personnel(*), subjects(*), classrooms(*)").order("created_at", { ascending: false });
      if (!isAdmin && !isDirector && myPersonnel?.id) {
        query = query.eq("personnel_id", myPersonnel.id);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: isAdmin || isDirector || !!myPersonnel?.id,
  });

  const filteredAssignments = gradeLevel
    ? myAssignments.filter((a: any) => a.classrooms?.grade_level === gradeLevel)
    : myAssignments;
  const currentAssignment = filteredAssignments.find((a: any) => a.id === selectedAssignment);

  const { data: criteria = [] } = useQuery({
    queryKey: ["assessment_criteria"],
    queryFn: async () => {
      const { data } = await supabase.from("assessment_criteria").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const filteredCriteria = criteria.filter((c: any) => c.category === selectedCategory);

  const { data: students = [] } = useQuery({
    queryKey: ["students_for_assessment", currentAssignment?.classroom_id],
    queryFn: async () => {
      if (!currentAssignment?.classroom_id) return [];
      const { data } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, gender").eq("classroom_id", currentAssignment.classroom_id).eq("status", "active").order("student_code");
      return data || [];
    },
    enabled: !!currentAssignment?.classroom_id,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["assessment_scores", selectedCategory, currentAssignment?.classroom_id],
    queryFn: async () => {
      if (!currentAssignment?.classroom_id) return [];
      const studentIds = students.map((s: any) => s.id);
      if (studentIds.length === 0) return [];
      const criteriaIds = filteredCriteria.map((c: any) => c.id);
      if (criteriaIds.length === 0) return [];
      const { data } = await supabase.from("student_assessment_scores").select("*").in("student_id", studentIds).in("criteria_id", criteriaIds);
      return data || [];
    },
    enabled: !!currentAssignment?.classroom_id && students.length > 0 && filteredCriteria.length > 0,
  });

  const getStudentScore = (studentId: string, criteriaId: string) => {
    return scores.find((s: any) => s.student_id === studentId && s.criteria_id === criteriaId);
  };

  const handleAddCriteria = async () => {
    if (!criteriaForm.title) { toast.error("กรุณากรอกหัวข้อ"); return; }
    const { error } = await supabase.from("assessment_criteria").insert({
      title: criteriaForm.title,
      description: criteriaForm.description || null,
      category: criteriaForm.category,
      sort_order: filteredCriteria.length,
    });
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("เพิ่มหัวข้อประเมินสำเร็จ");
    setCriteriaOpen(false);
    setCriteriaForm({ title: "", description: "", category: selectedCategory });
    qc.invalidateQueries({ queryKey: ["assessment_criteria"] });
  };

  const handleAddPresets = async () => {
    const picks = OBEC_PRESETS[selectedCategory].filter(p => presetSelections[p.title]);
    if (picks.length === 0) { toast.error("กรุณาเลือกอย่างน้อย 1 หัวข้อ"); return; }
    const existingTitles = new Set(filteredCriteria.map((c: any) => c.title));
    const rows = picks
      .filter(p => !existingTitles.has(p.title))
      .map((p, i) => ({ title: p.title, description: p.description ?? null, category: selectedCategory, sort_order: filteredCriteria.length + i }));
    if (rows.length === 0) { toast.error("หัวข้อที่เลือกถูกเพิ่มไปแล้วทั้งหมด"); return; }
    const { error } = await supabase.from("assessment_criteria").insert(rows);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success(`เพิ่ม ${rows.length} หัวข้อสำเร็จ`);
    setPresetOpen(false);
    setPresetSelections({});
    qc.invalidateQueries({ queryKey: ["assessment_criteria"] });
  };

  const handleDeleteCriteria = async (id: string) => {
    const { error } = await supabase.from("assessment_criteria").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบหัวข้อสำเร็จ");
    qc.invalidateQueries({ queryKey: ["assessment_criteria"] });
  };

  const handleSingleScore = async (studentId: string, criteriaId: string, score: number) => {
    const level = score >= 9 ? "excellent" : score >= 7 ? "good" : score >= 5 ? "moderate" : "needs_improvement";
    const { error } = await supabase.from("student_assessment_scores").upsert({
      student_id: studentId,
      criteria_id: criteriaId,
      score,
      level,
    }, { onConflict: "student_id,criteria_id,semester,academic_year" });
    if (error) toast.error(saveErrorMessage(error));
    else qc.invalidateQueries({ queryKey: ["assessment_scores"] });
  };

  const handleBulkApply = async (criteriaId: string) => {
    const score = bulkScores[criteriaId];
    if (!score || selectedStudents.length === 0) {
      toast.error("กรุณาเลือกนักเรียนและคะแนน");
      return;
    }
    const level = score >= 9 ? "excellent" : score >= 7 ? "good" : score >= 5 ? "moderate" : "needs_improvement";
    const records = selectedStudents.map(sid => ({
      student_id: sid,
      criteria_id: criteriaId,
      score,
      level,
    }));
    const { error } = await supabase.from("student_assessment_scores").upsert(records, { onConflict: "student_id,criteria_id,semester,academic_year" });
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success(`บันทึก ${selectedStudents.length} คน สำเร็จ`);
    qc.invalidateQueries({ queryKey: ["assessment_scores"] });
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleAllStudents = () => {
    if (selectedStudents.length === students.length) setSelectedStudents([]);
    else setSelectedStudents(students.map((s: any) => s.id));
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 9) return "bg-success/15 text-success";
    if (score >= 7) return "bg-info/15 text-info";
    if (score >= 5) return "bg-warning/15 text-warning";
    return "bg-destructive/15 text-destructive";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">ระดับชั้น</Label>
              <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setSelectedAssignment(""); setSelectedStudents([]); }}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="เลือกระดับชั้น" /></SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[250px]">
              <Label className="text-xs text-muted-foreground mb-1 block">เลือกวิชา / ห้องเรียน</Label>
              <Select value={selectedAssignment} onValueChange={(v) => { setSelectedAssignment(v); setSelectedStudents([]); }} disabled={!gradeLevel}>
                <SelectTrigger className="w-full sm:w-[400px]">
                  <SelectValue placeholder={gradeLevel ? "เลือกวิชาที่สอน" : "กรุณาเลือกระดับชั้นก่อน"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredAssignments.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.subjects?.code} {a.subjects?.name_th} — {a.classrooms?.name}
                      {(isAdmin || isDirector) && a.personnel ? ` [${a.personnel.first_name} ${a.personnel.last_name}]` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currentAssignment && (
              <Badge variant="outline" className="text-xs whitespace-nowrap mt-5">
                <Users className="w-3 h-3 mr-1" /> {students.length} คน
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedAssignment ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{gradeLevel ? "กรุณาเลือกวิชาและห้องเรียนเพื่อเริ่มประเมิน" : "กรุณาเลือกระดับชั้นก่อน"}</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap whitespace-nowrap max-w-full">
            {ASSESSMENT_CATEGORIES.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="gap-1.5">
                <cat.icon className="w-3.5 h-3.5" /> {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {ASSESSMENT_CATEGORIES.map(cat => (
            <TabsContent key={cat.value} value={cat.value} className="space-y-4">
              <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="w-4 h-4" /> หัวข้อการประเมิน ({cat.label})
                      </CardTitle>
                      <div className="flex gap-2">
                        <Dialog open={presetOpen} onOpenChange={(v) => { setPresetOpen(v); if (v) setPresetSelections({}); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Sparkles className="w-4 h-4 mr-1" /> เลือกจาก สพฐ.
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>เลือกหัวข้อจากมาตรฐาน สพฐ. — {cat.label}</DialogTitle></DialogHeader>
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                              {OBEC_PRESETS[cat.value]?.map(p => {
                                const exists = filteredCriteria.some((c: any) => c.title === p.title);
                                return (
                                  <label key={p.title} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${exists ? "opacity-50" : "hover:bg-muted/50"}`}>
                                    <Checkbox
                                      checked={!!presetSelections[p.title]}
                                      disabled={exists}
                                      onCheckedChange={(v) => setPresetSelections(prev => ({ ...prev, [p.title]: !!v }))}
                                    />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{p.title}</p>
                                      {exists && <p className="text-xs text-muted-foreground">มีอยู่แล้ว</p>}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            <Button onClick={handleAddPresets} className="w-full">เพิ่มหัวข้อที่เลือก</Button>
                          </DialogContent>
                        </Dialog>
                        <Dialog open={criteriaOpen} onOpenChange={setCriteriaOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => setCriteriaForm({ ...criteriaForm, category: cat.value })}>
                              <Plus className="w-4 h-4 mr-1" /> เพิ่มเอง
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>เพิ่มหัวข้อประเมิน</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div><Label>หัวข้อ</Label><Input value={criteriaForm.title} onChange={e => setCriteriaForm({ ...criteriaForm, title: e.target.value })} /></div>
                              <div><Label>รายละเอียด</Label><Textarea value={criteriaForm.description} onChange={e => setCriteriaForm({ ...criteriaForm, description: e.target.value })} /></div>
                              <Button onClick={handleAddCriteria} className="w-full">บันทึก</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredCriteria.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีหัวข้อประเมิน — กด "เลือกจาก สพฐ." เพื่อดึงรายการมาตรฐาน</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredCriteria.map((c: any, i: number) => (
                          <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium text-sm">{i + 1}. {c.title}</p>
                              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCriteria(c.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" /> ประเมินรายนักเรียน (คะแนน 1-10)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredCriteria.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีหัวข้อประเมิน (ให้แอดมินเพิ่มหัวข้อก่อน)</p>
                  ) : students.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">ไม่มีนักเรียนในห้องเรียนนี้</p>
                  ) : (
                    <div className="overflow-x-auto scrollbar-thin">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox checked={selectedStudents.length === students.length && students.length > 0} onCheckedChange={toggleAllStudents} />
                            </TableHead>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>ชื่อนักเรียน</TableHead>
                            {filteredCriteria.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[130px]">
                                <div className="space-y-1.5">
                                  <p className="text-xs font-medium leading-tight">{c.title}</p>
                                  <div className="flex items-center gap-1 justify-center">
                                    <Select value={bulkScores[c.id]?.toString() || ""} onValueChange={(v) => setBulkScores(prev => ({ ...prev, [c.id]: parseInt(v) }))}>
                                      <SelectTrigger className="h-7 text-xs w-[60px]"><SelectValue placeholder="—" /></SelectTrigger>
                                      <SelectContent>
                                        {ASSESSMENT_SCORE_OPTIONS.map(s => (<SelectItem key={s} value={s.toString()}>{s}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkApply(c.id)} title="ให้คะแนนที่เลือกกับนักเรียนที่ติ๊ก">
                                      <Save className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((s: any, idx: number) => (
                            <TableRow key={s.id} className={selectedStudents.includes(s.id) ? "bg-primary/5" : ""}>
                              <TableCell><Checkbox checked={selectedStudents.includes(s.id)} onCheckedChange={() => toggleStudent(s.id)} /></TableCell>
                              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                              <TableCell className="font-medium text-sm whitespace-nowrap">{s.prefix}{s.first_name} {s.last_name}</TableCell>
                              {filteredCriteria.map((c: any) => {
                                const existing = getStudentScore(s.id, c.id);
                                return (
                                  <TableCell key={c.id} className="text-center">
                                    <Select value={existing?.score?.toString() || ""} onValueChange={(v) => handleSingleScore(s.id, c.id, parseInt(v))}>
                                      <SelectTrigger className={`h-8 text-xs w-[65px] mx-auto ${existing?.score ? getScoreBadgeColor(existing.score) : ""}`}>
                                        <SelectValue placeholder="—" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ASSESSMENT_SCORE_OPTIONS.map(sc => (<SelectItem key={sc} value={sc.toString()}>{sc}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

// ── Main Page ──
const Pp5Page = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ผลพัฒนาคุณภาพผู้เรียน (ปพ.5)</h1>
        <p className="text-sm text-muted-foreground">บันทึกคะแนน ตัดเกรด ประเมินผล และจัดการผลการเรียนประจำรายวิชา</p>
      </div>

      <Tabs defaultValue="entry">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap whitespace-nowrap max-w-full">
          <TabsTrigger value="entry" className="gap-2">
            <BookOpen className="w-4 h-4" />
            บันทึกคะแนน
          </TabsTrigger>
          <TabsTrigger value="assessment" className="gap-2">
            <Star className="w-4 h-4" />
            ประเมินผลผู้เรียน
          </TabsTrigger>
          <TabsTrigger value="scores" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            ดูผลการเรียน / พิมพ์
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            จัดการไฟล์ ปพ.5
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entry"><ScoreEntryTab /></TabsContent>
        <TabsContent value="assessment"><AssessmentTab /></TabsContent>
        <TabsContent value="scores"><ScoreViewTab /></TabsContent>
        <TabsContent value="files"><FileTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Pp5Page;
