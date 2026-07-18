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
import { Textarea } from "@/components/ui/textarea";
import { Printer, Download, Trash2, FileSpreadsheet, FolderOpen, Calendar, ClipboardList, Search, Plus, Save, BarChart3, BookOpen, Calculator, Settings, ListChecks, Star, PenLine, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSchoolInfo, signatureImgHtml } from "@/components/documents/DocumentHeader";
import { SignatureBlock } from "@/components/documents/SignatureBlock";
import { calculateGrade, gradeColor } from "@/lib/gradeUtils";
import { openPrintWindow } from "@/lib/printUtils";
import { toast } from "sonner";
import PP5ImportDialog from "@/components/academic/PP5ImportDialog";
import { ScoreCell } from "@/components/academic/ScoreCell";
import { printPP5 } from "@/lib/exporters/pp5GradeBook";
import { exportPP5Book, exportPP6Book } from "@/lib/exporters/officialPpBook";
import { exportPP5FullBook } from "@/lib/exporters/pp5FullBook";

import Pp5AttendancePrintPage from "@/pages/academic/Pp5AttendancePrintPage";


import StudentScoreDashboard from "@/components/academic/StudentScoreDashboard";
import { swal } from "@/lib/swal";
import * as XLSX from "xlsx";

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

// ── Score Entry Tab (from GradesPage - บันทึกคะแนนและตัดเกรด) ──
const ScoreEntryTab = () => {
  const { userId, isAdmin, isDirector } = useUserRole();
  const qc = useQueryClient();
  const schoolInfo = useSchoolInfo();
  const [gradeLevel, setGradeLevel] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [indicatorOpen, setIndicatorOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [indicatorForm, setIndicatorForm] = useState({ title: "", description: "" });
  const [columnForm, setColumnForm] = useState({ column_name: "", column_type: "assignment", max_score: "10" });

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

  const { data: students = [] } = useQuery({
    queryKey: ["students_for_grading", currentAssignment?.classroom_id],
    queryFn: async () => {
      if (!currentAssignment?.classroom_id) return [];
      const { data } = await supabase.from("students").select("*").eq("classroom_id", currentAssignment.classroom_id).eq("status", "active").order("student_code");
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

  // ── ค่าตั้งสัดส่วนคะแนน 100% (ระหว่างเรียน:ปลายภาค) ──
  const { data: gradingConfig } = useQuery({
    queryKey: ["subject_grading_config", currentAssignment?.subject_id],
    queryFn: async () => {
      if (!currentAssignment?.subject_id) return null;
      const { data } = await supabase
        .from("subject_grading_config")
        .select("*")
        .eq("subject_id", currentAssignment.subject_id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentAssignment?.subject_id,
  });
  const weightDuring = Number(gradingConfig?.weight_during ?? 70);
  const weightFinal = Number(gradingConfig?.weight_final ?? 30);
  const [weightForm, setWeightForm] = useState<{ during: string; final: string }>({ during: "70", final: "30" });
  useEffect(() => {
    if (gradingConfig) {
      setWeightForm({ during: String(gradingConfig.weight_during), final: String(gradingConfig.weight_final) });
    } else {
      setWeightForm({ during: "70", final: "30" });
    }
  }, [gradingConfig?.subject_id, gradingConfig?.weight_during, gradingConfig?.weight_final]);

  const handleSaveWeights = async () => {
    if (!currentAssignment) return;
    const d = parseFloat(weightForm.during);
    const f = parseFloat(weightForm.final);
    if (isNaN(d) || isNaN(f) || d < 0 || f < 0) { toast.error("น้ำหนักต้องเป็นตัวเลข ≥ 0"); return; }
    if (Math.round(d + f) !== 100) { toast.error("ผลรวมต้องเท่ากับ 100"); return; }
    const { error } = await supabase.from("subject_grading_config").upsert({
      subject_id: currentAssignment.subject_id,
      weight_during: d,
      weight_final: f,
      updated_by: userId,
    }, { onConflict: "subject_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกสัดส่วนคะแนนแล้ว");
    qc.invalidateQueries({ queryKey: ["subject_grading_config"] });
  };

  const handleToggleColumnEnabled = async (id: string, next: boolean) => {
    const { error } = await supabase.from("subject_score_columns").update({ is_enabled: next }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
  };

  const handleAddIndicator = async () => {
    if (!indicatorForm.title || !currentAssignment) return;
    const { error } = await supabase.from("subject_indicators").insert({
      subject_id: currentAssignment.subject_id,
      personnel_id: currentAssignment.personnel_id,
      title: indicatorForm.title,
      description: indicatorForm.description || null,
      sort_order: indicators.length,
    });
    if (error) { toast.error(error.message); return; }
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
      max_score: parseFloat(columnForm.max_score),
      sort_order: scoreColumns.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("เพิ่มช่องคะแนนสำเร็จ");
    setColumnOpen(false);
    setColumnForm({ column_name: "", column_type: "assignment", max_score: "10" });
    qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
  };

  const handleDeleteColumn = async (id: string) => {
    await supabase.from("subject_score_columns").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
  };

  const handleEditColumn = async (col: any) => {
    const Swal = (await import("sweetalert2")).default;
    const { value: formValues } = await Swal.fire({
      title: "แก้ไขช่องคะแนน",
      html:
        `<input id="swal-name" class="swal2-input" placeholder="ชื่อช่องคะแนน" value="${(col.column_name || "").replace(/"/g, "&quot;")}">` +
        `<select id="swal-type" class="swal2-select">` +
        `<option value="assignment" ${col.column_type === "assignment" ? "selected" : ""}>เก็บคะแนน</option>` +
        `<option value="midterm" ${col.column_type === "midterm" ? "selected" : ""}>กลางภาค</option>` +
        `<option value="final" ${col.column_type === "final" ? "selected" : ""}>ปลายภาค</option>` +
        `</select>` +
        `<input id="swal-max" type="number" min="0" step="0.5" class="swal2-input" placeholder="คะแนนเต็ม" value="${col.max_score ?? ""}">`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      preConfirm: () => {
        const name = (document.getElementById("swal-name") as HTMLInputElement)?.value?.trim();
        const type = (document.getElementById("swal-type") as HTMLSelectElement)?.value;
        const max = parseFloat((document.getElementById("swal-max") as HTMLInputElement)?.value);
        if (!name) { Swal.showValidationMessage("กรุณากรอกชื่อช่อง"); return false; }
        if (!isFinite(max) || max <= 0) { Swal.showValidationMessage("คะแนนเต็มต้องมากกว่า 0"); return false; }
        return { column_name: name, column_type: type, max_score: max };
      },
    });
    if (!formValues) return;
    const { error } = await supabase.from("subject_score_columns")
      .update(formValues as any)
      .eq("id", col.id);
    if (error) { swal.error("ผิดพลาด", error.message); return; }
    qc.invalidateQueries({ queryKey: ["subject_score_columns"] });
    swal.toast.success("บันทึกแล้ว");
  };



  const getScore = (studentId: string, columnId: string) => {
    const found = columnScores.find((s: any) => s.student_id === studentId && s.column_id === columnId);
    return found?.score ?? "";
  };

  // ── helpers สำหรับ "คะแนน 100%" แบบ SGS ──
  // ระหว่างเรียน = assignment + midterm (เฉพาะช่องที่เปิดใช้)
  // ปลายภาค = final (เฉพาะช่องที่เปิดใช้)
  const assignmentColumns = scoreColumns.filter((c: any) => c.column_type === "assignment");
  const midtermColumns = scoreColumns.filter((c: any) => c.column_type === "midterm");
  const finalColumns = scoreColumns.filter((c: any) => c.column_type === "final");
  const duringColumnsEnabled = [...assignmentColumns, ...midtermColumns].filter((c: any) => c.is_enabled !== false);
  const finalColumnsEnabled = finalColumns.filter((c: any) => c.is_enabled !== false);
  // จัดเรียงคอลัมน์คะแนนเป็นกลุ่ม: เก็บคะแนน → กลางภาค → ปลายภาค (ใช้กับตารางและ export)
  const sortedScoreColumns = [...assignmentColumns, ...midtermColumns, ...finalColumns];
  const columnGroups = [
    { key: "assignment", label: "คะแนนเก็บ", cols: assignmentColumns, headerCls: "bg-info-soft dark:bg-info/40 text-info dark:text-info", cellCls: "bg-info/40 dark:bg-info/10" },
    { key: "midterm", label: "สอบกลางภาค", cols: midtermColumns, headerCls: "bg-warning-soft dark:bg-warning/40 text-warning dark:text-warning", cellCls: "bg-warning/40 dark:bg-warning/10" },
    { key: "final", label: "สอบปลายภาค", cols: finalColumns, headerCls: "bg-danger-soft dark:bg-danger/40 text-danger dark:text-danger", cellCls: "bg-danger/40 dark:bg-danger/10" },
  ].filter(g => g.cols.length > 0);

  const sumRaw = (studentId: string, cols: any[]) =>
    cols.reduce((sum, col) => {
      const sc = columnScores.find((cs: any) => cs.student_id === studentId && cs.column_id === col.id);
      return sum + (Number(sc?.score) || 0);
    }, 0);
  const sumMax = (cols: any[]) => cols.reduce((sum, col) => sum + (Number(col.max_score) || 0), 0);

  // normalize raw → ตามสัดส่วน
  const normalize = (raw: number, maxRaw: number, weight: number) => {
    if (!maxRaw) return 0;
    return Math.round((raw / maxRaw) * weight * 100) / 100;
  };

  const getStudentDuring = (studentId: string) =>
    normalize(sumRaw(studentId, duringColumnsEnabled), sumMax(duringColumnsEnabled), weightDuring);
  const getStudentFinal = (studentId: string) =>
    normalize(sumRaw(studentId, finalColumnsEnabled), sumMax(finalColumnsEnabled), weightFinal);
  const getStudentTotal = (studentId: string) =>
    Math.round((getStudentDuring(studentId) + getStudentFinal(studentId)) * 100) / 100;
  const getMaxTotal = () => 100; // เกณฑ์ ปพ.5 รวม 100

  // Recompute totals + grade for a single student and upsert to student_scores
  const syncStudentScore = async (studentId: string) => {
    if (!currentAssignment) return;
    const s: any = students.find((x: any) => x.id === studentId);
    if (!s) return;
    const duringScore = getStudentDuring(studentId);
    const finalScore = getStudentFinal(studentId);
    const total = Math.round((duringScore + finalScore) * 100) / 100;
    const { grade, gradePoint } = calculateGrade(total, 100);
    const subj: any = currentAssignment.subjects || {};
    const studentName = `${s.prefix || ""}${s.first_name} ${s.last_name}`;
    await supabase.from("student_scores").upsert({
      student_name: studentName,
      student_code: s.student_code,
      subject_id: currentAssignment.subject_id,
      assignment_score: duringScore,
      midterm_score: 0,
      final_score: finalScore,
      total_score: total,
      grade,
      grade_point: gradePoint,
      semester: subj.semester || 1,
      academic_year: subj.academic_year || new Date().getFullYear(),
    }, { onConflict: "student_code,subject_id" });
    qc.invalidateQueries({ queryKey: ["pp5_scores"] });
    qc.invalidateQueries({ queryKey: ["dash_scores"] });
    qc.invalidateQueries({ queryKey: ["pp5_manual_score_subjects"] });
  };

  const handleScoreChange = async (studentId: string, columnId: string, score: number) => {
    const col = scoreColumns.find((c: any) => c.id === columnId);
    if (col?.is_enabled === false) {
      toast.error("ช่องคะแนนนี้ถูกปิดใช้งาน — ติ๊กเปิดก่อนกรอก");
      return;
    }
    const max = Number(col?.max_score ?? 100);
    if (score > max) {
      toast.warning(`คะแนนเกินกำหนด — ปรับเป็นสูงสุด ${max} คะแนน`);
      score = max;
    }
    if (score < 0) score = 0;
    const { error } = await supabase.from("student_column_scores").upsert({
      student_id: studentId,
      column_id: columnId,
      score,
    }, { onConflict: "student_id,column_id" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["student_column_scores"] });
    // Auto-sync this student's aggregated score to student_scores
    await syncStudentScore(studentId);
  };


  const handleAutoGrade = async () => {
    if (students.length === 0 || scoreColumns.length === 0) return;
    let count = 0;
    for (const s of students) {
      await syncStudentScore((s as any).id);
      count++;
    }
    toast.success(`ตัดเกรด & ซิงค์ข้อมูลสำเร็จ ${count} คน`);
  };

  const handleDownloadTemplate = () => {
    if (!currentAssignment) return;
    const studentList = students.length > 0 ? students : [];
    const ROWS = Math.max(studentList.length + 5, 40);
    const wb = XLSX.utils.book_new();
    const setCell = (ws: XLSX.WorkSheet, r: number, c: number, v: any) => {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
      ws[addr] = { v, t: typeof v === "number" ? "n" : "s" };
    };
    const ensureRef = (ws: XLSX.WorkSheet, rows: number, cols: number) => {
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows - 1, c: cols - 1 } });
    };

    const subj: any = currentAssignment.subjects || {};
    const cls: any = currentAssignment.classrooms || {};
    const per: any = currentAssignment.personnel || {};
    const teacherName = `${per.prefix || ""}${per.first_name || ""} ${per.last_name || ""}`.trim();
    const yearBE = new Date().getFullYear() + 543;
    const gradeLabelMap: Record<string, string> = {
      "ป.1": "ประถมศึกษาปีที่ 1", "ป.2": "ประถมศึกษาปีที่ 2", "ป.3": "ประถมศึกษาปีที่ 3",
      "ป.4": "ประถมศึกษาปีที่ 4", "ป.5": "ประถมศึกษาปีที่ 5", "ป.6": "ประถมศึกษาปีที่ 6",
      "ม.1": "มัธยมศึกษาปีที่ 1", "ม.2": "มัธยมศึกษาปีที่ 2", "ม.3": "มัธยมศึกษาปีที่ 3",
      "ม.4": "มัธยมศึกษาปีที่ 4", "ม.5": "มัธยมศึกษาปีที่ 5", "ม.6": "มัธยมศึกษาปีที่ 6",
    };
    const gradeLabel = gradeLabelMap[cls.grade_level] || cls.grade_level || "";

    // Home sheet
    const home: XLSX.WorkSheet = {};
    setCell(home, 2, 2, "ชื่อโรงเรียน");
    setCell(home, 3, 2, "โรงเรียน:");
    setCell(home, 3, 3, schoolInfo.school_name || "");
    setCell(home, 4, 5, "ภาคเรียน:");
    setCell(home, 4, 6, 1);
    setCell(home, 5, 5, "ปีการศึกษา:");
    setCell(home, 5, 6, yearBE);
    setCell(home, 9, 2, "ระดับชั้น:");
    setCell(home, 9, 3, gradeLabel);
    setCell(home, 11, 2, "ชื่อรายวิชา:");
    setCell(home, 11, 3, subj.name_th || "");
    setCell(home, 12, 2, "รหัสวิชา:");
    setCell(home, 12, 3, subj.code || "");
    setCell(home, 15, 2, "ครูผู้สอน:");
    setCell(home, 15, 3, teacherName);
    ensureRef(home, 18, 8);
    XLSX.utils.book_append_sheet(wb, home, "Home");

    // helper to print roster into an assessment sheet
    const writeRoster = (ws: XLSX.WorkSheet, startRow: number) => {
      studentList.forEach((s: any, i: number) => {
        setCell(ws, startRow + i, 2, i + 1);
        setCell(ws, startRow + i, 3, s.student_code || "");
        setCell(ws, startRow + i, 4, `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim());
      });
      // pad remaining rows with sequence
      for (let i = studentList.length; i < ROWS; i++) {
        setCell(ws, startRow + i, 2, i + 1);
      }
    };

    // สรุปตัดสินผลการเรียน
    const summary: XLSX.WorkSheet = {};
    setCell(summary, 6, 5, "เวลาเรียน 80 ชั่วโมง");
    const sumHeaders = ["ที่", "รหัสนักเรียน", "ชื่อ-สกุล", "เวลาเรียน(ชม.)", "ร้อยละ", "ผ่าน/ไม่ผ่าน", "", "", "", "ระหว่างเรียน", "ปลายภาค", "รวม", "ระดับผล", "อ่านฯ", "คุณลักษณะ", "สมรรถนะ", "ผลการเรียน"];
    sumHeaders.forEach((h, i) => setCell(summary, 7, 2 + i, h));
    studentList.forEach((s: any, i: number) => {
      setCell(summary, 8 + i, 2, i + 1);
      setCell(summary, 8 + i, 3, s.student_code || "");
      setCell(summary, 8 + i, 4, `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim());
    });
    for (let i = studentList.length; i < ROWS; i++) setCell(summary, 8 + i, 2, i + 1);
    ensureRef(summary, 8 + ROWS, 20);
    XLSX.utils.book_append_sheet(wb, summary, "สรุปตัดสินผลการเรียน");

    // คุณลักษณะ
    const character: XLSX.WorkSheet = {};
    setCell(character, 5, 3, "รหัสนักเรียน");
    setCell(character, 5, 4, "ชื่อ-สกุล");
    setCell(character, 5, 28, "คะแนนรวม");
    setCell(character, 5, 29, "สรุปผล");
    writeRoster(character, 6);
    ensureRef(character, 6 + ROWS, 30);
    XLSX.utils.book_append_sheet(wb, character, "คุณลักษณะ");

    // สมรรถนะ
    const competency: XLSX.WorkSheet = {};
    setCell(competency, 5, 3, "รหัสนักเรียน");
    setCell(competency, 5, 4, "ชื่อ-สกุล");
    setCell(competency, 5, 22, "คะแนนรวม");
    setCell(competency, 5, 23, "สรุปผล");
    setCell(competency, 5, 24, "ระดับ");
    writeRoster(competency, 6);
    ensureRef(competency, 6 + ROWS, 25);
    XLSX.utils.book_append_sheet(wb, competency, "สมรรถนะ");

    // คิดวิเคราะห์
    const reading: XLSX.WorkSheet = {};
    setCell(reading, 6, 3, "รหัสนักเรียน");
    setCell(reading, 6, 4, "ชื่อ-สกุล");
    setCell(reading, 6, 26, "คะแนนรวม");
    setCell(reading, 6, 27, "สรุปผล");
    setCell(reading, 6, 28, "ระดับ");
    writeRoster(reading, 7);
    ensureRef(reading, 7 + ROWS, 29);
    XLSX.utils.book_append_sheet(wb, reading, "คิดวิเคราะห์");

    // ── บันทึกคะแนน sheet (ตามช่องคะแนนที่ครูสร้างไว้) ──
    if (scoreColumns.length > 0) {
      const scoreSheet: XLSX.WorkSheet = {};
      setCell(scoreSheet, 1, 1, `บันทึกคะแนน — ${subj.code || ""} ${subj.name_th || ""} / ${cls.name || ""}`);
      setCell(scoreSheet, 3, 1, "ที่");
      setCell(scoreSheet, 3, 2, "รหัสนักเรียน");
      setCell(scoreSheet, 3, 3, "ชื่อ-สกุล");
      // header รวมประเภท + ชื่อช่อง + คะแนนเต็ม (เรียงเป็นกลุ่ม)
      const typeLabel: Record<string, string> = { assignment: "งานเก็บ", midterm: "กลางภาค", final: "ปลายภาค" };
      sortedScoreColumns.forEach((col: any, i: number) => {
        const c = 4 + i;
        setCell(scoreSheet, 2, c, typeLabel[col.column_type] || col.column_type);
        setCell(scoreSheet, 3, c, `${col.column_name} (เต็ม ${col.max_score})`);
      });
      const totalCol = 4 + sortedScoreColumns.length;
      setCell(scoreSheet, 3, totalCol, `รวม (${getMaxTotal()})`);
      setCell(scoreSheet, 3, totalCol + 1, "เกรด");

      studentList.forEach((s: any, i: number) => {
        const r = 4 + i;
        setCell(scoreSheet, r, 1, i + 1);
        setCell(scoreSheet, r, 2, s.student_code || "");
        setCell(scoreSheet, r, 3, `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim());
      });

      // กำหนด data validation ไม่ให้กรอกเกินคะแนนเต็ม
      const dv: any[] = [];
      sortedScoreColumns.forEach((col: any, i: number) => {
        const colLetter = XLSX.utils.encode_col(3 + i);
        const lastRow = 3 + studentList.length;
        dv.push({
          sqref: `${colLetter}4:${colLetter}${lastRow}`,
          type: "decimal",
          operator: "between",
          formula1: 0,
          formula2: col.max_score,
          showErrorMessage: true,
          errorTitle: "คะแนนไม่ถูกต้อง",
          error: `กรอกคะแนนได้ระหว่าง 0 ถึง ${col.max_score}`,
        });
      });
      (scoreSheet as any)["!dataValidation"] = dv;

      ensureRef(scoreSheet, 4 + ROWS, totalCol + 2);
      XLSX.utils.book_append_sheet(wb, scoreSheet, "บันทึกคะแนน");
    }

    // ── ตัวชี้วัด sheet ──
    if (indicators.length > 0) {
      const indSheet: XLSX.WorkSheet = {};
      setCell(indSheet, 1, 1, `ตัวชี้วัด — ${subj.code || ""} ${subj.name_th || ""}`);
      setCell(indSheet, 3, 1, "ลำดับ");
      setCell(indSheet, 3, 2, "ตัวชี้วัด");
      setCell(indSheet, 3, 3, "รายละเอียด");
      indicators.forEach((ind: any, i: number) => {
        setCell(indSheet, 4 + i, 1, i + 1);
        setCell(indSheet, 4 + i, 2, ind.title || "");
        setCell(indSheet, 4 + i, 3, ind.description || "");
      });
      ensureRef(indSheet, 4 + indicators.length, 4);
      XLSX.utils.book_append_sheet(wb, indSheet, "ตัวชี้วัด");
    }


    const fname = `PP5_${subj.code || "subject"}_${cls.name || cls.grade_level || "class"}_${yearBE}.xlsx`.replace(/\s+/g, "_");
    XLSX.writeFile(wb, fname);
    toast.success(`ดาวน์โหลดเทมเพลตสำเร็จ (${studentList.length} คน)`);
  };

  // ── Export ปพ.5 ที่กรอกคะแนนแล้ว เป็น Excel (รูปแบบ สพฐ./สพม.) ──
  const handleExportFilledPp5 = () => {
    if (!currentAssignment) { toast.error("เลือกรายวิชาก่อน"); return; }
    if (scoreColumns.length === 0) { toast.error("ยังไม่มีช่องคะแนน"); return; }
    const subj: any = currentAssignment.subjects || {};
    const cls: any = currentAssignment.classrooms || {};
    const per: any = currentAssignment.personnel || {};
    const teacherName = `${per.prefix || ""}${per.first_name || ""} ${per.last_name || ""}`.trim();
    const yearBE = (subj.academic_year || new Date().getFullYear()) + 543;
    const semester = subj.semester || 1;
    const typeLabel: Record<string, string> = { assignment: "ระหว่างเรียน", midterm: "กลางภาค", final: "ปลายภาค" };

    // Header rows (AOA)
    const aoa: any[][] = [];
    aoa.push([`แบบบันทึกผลการเรียนประจำรายวิชา (ปพ.5)`]);
    aoa.push([`โรงเรียน ${schoolInfo.school_name || ""}`]);
    aoa.push([`รหัสวิชา ${subj.code || ""}  รายวิชา ${subj.name_th || ""}  ห้อง ${cls.name || cls.grade_level || ""}  ภาคเรียนที่ ${semester}/${yearBE}`]);
    aoa.push([`ครูผู้สอน ${teacherName}    สัดส่วน ระหว่างเรียน ${weightDuring}% : ปลายภาค ${weightFinal}%`]);
    aoa.push([]);

    // แถบกลุ่มคะแนน (band row) — จัดเรียงเหมือนในระบบ
    const groupsForExport = [
      { label: "คะแนนเก็บ", cols: assignmentColumns },
      { label: "สอบกลางภาค", cols: midtermColumns },
      { label: "สอบปลายภาค", cols: finalColumns },
    ].filter(g => g.cols.length > 0);
    const bandRow: any[] = ["", "", ""];
    const bandRowIdx = aoa.length;
    const bandMerges: any[] = [];
    let bandPos = 3;
    groupsForExport.forEach(g => {
      bandRow.push(g.label);
      for (let i = 1; i < g.cols.length; i++) bandRow.push("");
      if (g.cols.length > 1) bandMerges.push({ s: { r: bandRowIdx, c: bandPos }, e: { r: bandRowIdx, c: bandPos + g.cols.length - 1 } });
      bandPos += g.cols.length;
    });
    bandRow.push("", "", "", "");
    aoa.push(bandRow);

    // Column header (เรียงเป็นกลุ่ม)
    const head1: any[] = ["ที่", "รหัสนักเรียน", "ชื่อ-สกุล"];
    const head2: any[] = ["", "", ""];
    sortedScoreColumns.forEach((c: any) => {
      head1.push(`${c.column_name}${c.is_enabled === false ? " (ปิด)" : ""}`);
      head2.push(`เต็ม ${c.max_score}`);
    });
    head1.push(`ระหว่างเรียน`, `ปลายภาค`, `รวม`, `เกรด`);
    head2.push(`/${weightDuring}`, `/${weightFinal}`, `/100`, "");
    aoa.push(head1);
    aoa.push(head2);

    // Student rows
    students.forEach((s: any, i: number) => {
      const row: any[] = [i + 1, s.student_code || "", `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim()];
      sortedScoreColumns.forEach((c: any) => {
        const sc = columnScores.find((cs: any) => cs.student_id === s.id && cs.column_id === c.id);
        row.push(sc?.score ?? "");
      });
      const d = getStudentDuring(s.id);
      const f = getStudentFinal(s.id);
      const t = getStudentTotal(s.id);
      const { grade } = calculateGrade(t, 100);
      row.push(d, f, t, grade);
      aoa.push(row);
    });

    // Grade distribution summary
    aoa.push([]);
    aoa.push(["สรุปการกระจายเกรด"]);
    const distHead = ["เกรด", "4", "3.5", "3", "2.5", "2", "1.5", "1", "0", "ร", "มส", "รวม"];
    aoa.push(distHead);
    const dist: Record<string, number> = {};
    students.forEach((s: any) => {
      const g = calculateGrade(getStudentTotal(s.id), 100).grade;
      dist[g] = (dist[g] || 0) + 1;
    });
    const distRow: any[] = ["จำนวน(คน)"];
    ["4", "3.5", "3", "2.5", "2", "1.5", "1", "0", "ร", "มส"].forEach(g => distRow.push(dist[g] || 0));
    distRow.push(students.length);
    aoa.push(distRow);
    aoa.push([]);
    aoa.push([`เกณฑ์การประเมิน (สพฐ./สพม.):`]);
    GRADE_CRITERIA.forEach(c => aoa.push([`${c.min}-${c.max}`, `เกรด ${c.grade}`, c.label]));
    aoa.push([]);
    aoa.push(["ลงชื่อ ........................................... ครูผู้สอน", "", "ลงชื่อ ........................................... หัวหน้ากลุ่มสาระ", "", "ลงชื่อ ........................................... ผู้บริหาร"]);
    aoa.push([`(${teacherName})`, "", "(........................................)", "", "(........................................)"]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // column widths
    ws["!cols"] = [
      { wch: 5 }, { wch: 14 }, { wch: 28 },
      ...sortedScoreColumns.map(() => ({ wch: 12 })),
      { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    ];
    // merge title rows + band group cells
    const totalCols = head1.length;
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } },
      ...bandMerges,
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ปพ.5");
    const fname = `PP5_filled_${subj.code || "subject"}_${cls.name || cls.grade_level || "class"}_${semester}-${yearBE}.xlsx`.replace(/\s+/g, "_");
    XLSX.writeFile(wb, fname);
    toast.success(`ส่งออก ปพ.5 (${students.length} คน) สำเร็จ`);
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
              <div className="flex gap-2 mt-5 flex-wrap">
                <Button
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={async () => {
                    try {
                      toast.loading("กำลังเตรียมเล่ม ปพ.5 ฉบับสมบูรณ์...", { id: "pp5-fullbook" });
                      await exportPP5FullBook({
                        assignment: currentAssignment,
                        schoolInfo,
                        students,
                        scoreColumns,
                        columnScores,
                        indicators,
                        gradingConfig,
                      });
                      toast.success("เปิดหน้าพิมพ์เล่ม ปพ.5 แล้ว — กด Ctrl+P เพื่อพิมพ์", { id: "pp5-fullbook" });
                    } catch (e: any) {
                      console.error(e);
                      toast.error(`สร้างเล่มไม่สำเร็จ: ${e?.message || e}`, { id: "pp5-fullbook" });
                    }
                  }}
                >
                  <BookOpen className="w-4 h-4 mr-1" /> พิมพ์เล่ม ปพ.5 (ฉบับสมบูรณ์)
                </Button>
                <Button variant="default" onClick={handleExportFilledPp5}>
                  <FileSpreadsheet className="w-4 h-4 mr-1" /> ส่งออก ปพ.5 (Excel)
                </Button>
                <Button
                  variant="default"
                  className="bg-primary"
                  onClick={async () => {
                    try {
                      const subj: any = currentAssignment.subjects || {};
                      const cls: any = currentAssignment.classrooms || {};
                      const per: any = currentAssignment.personnel || {};
                      const grade = cls.grade_level || "";
                      // แสดงชื่อห้องแบบ "ป.4/1" — ถ้า name ไม่มี "/" อยู่แล้ว
                      const sectionLabel = cls.name
                        ? (String(cls.name).includes("/") ? cls.name : `${grade}/${cls.name}`)
                        : grade;
                      const level = grade.startsWith("ม.4") || grade.startsWith("ม.5") || grade.startsWith("ม.6")
                        ? "มัธยมศึกษาตอนปลาย"
                        : grade.startsWith("ม.") ? "มัธยมศึกษาตอนต้น" : "ประถมศึกษา";

                      // ครูประจำชั้น (จาก classrooms.homeroom_teacher_id)
                      let homeroomName = "";
                      if (cls.homeroom_teacher_id) {
                        const { data: hr } = await supabase.from("personnel")
                          .select("prefix, first_name, last_name, position")
                          .eq("id", cls.homeroom_teacher_id).maybeSingle();
                        if (hr) homeroomName = `${hr.prefix || ""}${hr.first_name || ""} ${hr.last_name || ""}`.trim();
                      }
                      if (!homeroomName) homeroomName = cls.homeroom_teacher || "";

                      // หัวหน้ากลุ่มสาระฯ (จาก subject_group_heads → profiles)
                      let subjectHeadName = "";
                      let subjectHeadTitle = "หัวหน้ากลุ่มสาระการเรียนรู้";
                      const sg = subj.subject_group || subj.department || "";
                      if (sg) {
                        const { data: gh } = await supabase.from("subject_group_heads")
                          .select("user_id").eq("subject_group", sg).maybeSingle();
                        if (gh?.user_id) {
                          const { data: prof } = await supabase.from("personnel")
                            .select("prefix, first_name, last_name, position")
                            .eq("user_id", gh.user_id).maybeSingle();
                          if (prof) {
                            subjectHeadName = `${prof.prefix || ""}${prof.first_name || ""} ${prof.last_name || ""}`.trim();
                            if (prof.position) subjectHeadTitle = prof.position;
                          }
                        }
                      }


                      // หัวหน้างานวัดผลฯ / หัวหน้างานวิชาการ (จาก cms_settings)
                      const { data: cms } = await (supabase.from("cms_settings") as any)
                        .select("setting_key, setting_value")
                        .in("setting_key", ["measurement_head_name", "measurement_head_title", "academic_head_name", "academic_head_title"]);

                      const cmsMap: Record<string, string> = {};
                      (cms || []).forEach((r: any) => { cmsMap[r.setting_key] = r.setting_value || ""; });

                      await exportPP5Book({
                        school: {
                          school_name: schoolInfo.school_name,
                          affiliation: schoolInfo.affiliation,
                          director_name: schoolInfo.director_name,
                          director_title: schoolInfo.director_title || "ผู้อำนวยการโรงเรียน",
                          academic_head_name: cmsMap.academic_head_name || "",
                          academic_head_title: cmsMap.academic_head_title || "หัวหน้างานวิชาการ",
                          school_logo: schoolInfo.school_logo,
                          garuda_emblem: schoolInfo.garuda_emblem,
                        },
                        level,
                        semester: currentAssignment.semester,
                        academic_year: currentAssignment.academic_year,
                        grade_level: sectionLabel,
                        subject_group: sg,
                        subject_name: subj.name_th || "",
                        subject_code: subj.code || "",
                        hours_per_week: subj.hours_per_week ?? "",
                        homeroom_teacher: homeroomName,
                        teacher_name: `${per.prefix || ""}${per.first_name || ""} ${per.last_name || ""}`.trim(),
                        teacher_title: per.position || "ครู",
                        subject_head_name: subjectHeadName,
                        subject_head_title: subjectHeadTitle,
                        measurement_head: cmsMap.measurement_head_name || "",
                        measurement_head_title: cmsMap.measurement_head_title || "หัวหน้างานวัดผลและประเมินผล",
                        students: (students as any[]).map((s, i) => ({
                          no: i + 1,
                          student_code: s.student_code,
                          citizen_id: s.citizen_id || "",
                          full_name: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
                        })),
                        score_columns: (scoreColumns as any[]).map((c) => ({
                          column_name: c.column_name,
                          max_score: c.max_score,
                          column_type: c.column_type,
                        })),
                        student_scores: Object.fromEntries(
                          (students as any[]).map((s) => {
                            const values = (scoreColumns as any[]).map((c) => getScore(s.id, c.id));
                            const during = getStudentDuring(s.id);
                            const final = getStudentFinal(s.id);
                            const total = getStudentTotal(s.id);
                            const { grade } = calculateGrade(total, 100);
                            return [s.student_code, { values, during, final, total, grade }];
                          })
                        ),
                        attendance: await (async () => {
                          try {
                            const studentIds = (students as any[]).map((s) => s.id);
                            if (!studentIds.length) return undefined;
                            let q = supabase.from("attendance")
                              .select("student_id, attendance_date, status, subject_id")
                              .in("student_id", studentIds);
                            if (currentAssignment.subject_id) {
                              // รวมทั้งบันทึกของรายวิชานี้ และบันทึกแบบโฮมรูม (subject_id เป็น null)
                              q = q.or(`subject_id.eq.${currentAssignment.subject_id},subject_id.is.null`);
                            }
                            if (currentAssignment.semester) q = q.eq("semester", currentAssignment.semester);
                            if (currentAssignment.academic_year) q = q.eq("academic_year", currentAssignment.academic_year);
                            const { data: arows } = await q;
                            const rows = arows || [];
                            if (!rows.length) return undefined;
                            const dates = Array.from(new Set(rows.map((r: any) => r.attendance_date))).sort();
                            const dateIdx = new Map(dates.map((d, i) => [d, i]));
                            const statusMap: Record<string, string> = { present: "/", late: "/", leave: "ล", sick: "ป", absent: "ข" };
                            const idToCode = new Map((students as any[]).map((s) => [s.id, s.student_code]));
                            const marks: Record<string, string[]> = {};
                            (students as any[]).forEach((s) => { marks[s.student_code] = Array(dates.length).fill(""); });
                            rows.forEach((r: any) => {
                              const code = idToCode.get(r.student_id);
                              const ci = dateIdx.get(r.attendance_date);
                              if (!code || ci === undefined) return;
                              marks[code][ci] = statusMap[r.status] || "";
                            });
                            return { dates, marks };
                          } catch { return undefined; }
                        })(),
                      });

                      toast.success("สร้างเล่ม ปพ.5 ตามเทมเพลตราชการแล้ว");
                    } catch (e: any) {
                      toast.error(e?.message || "ส่งออกไม่สำเร็จ");
                    }
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1" /> เล่ม ปพ.5 (ตามเทมเพลตราชการ)
                </Button>

                <Button variant="outline" onClick={() => {
                  const subj: any = currentAssignment.subjects || {};
                  const cls: any = currentAssignment.classrooms || {};
                  const per: any = currentAssignment.personnel || {};
                  const rows = (students as any[]).map((s) => {
                    const scores: Record<string, number | string> = {};
                    scoreColumns.forEach((c: any) => { scores[c.id] = getScore(s.id, c.id); });
                    const total = getStudentTotal(s.id);
                    const { grade } = calculateGrade(total, 100);
                    return {
                      student_code: s.student_code,
                      full_name: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
                      scores,
                      during: getStudentDuring(s.id),
                      final: getStudentFinal(s.id),
                      total,
                      grade,
                    };
                  });
                  printPP5(schoolInfo, {
                    subject_code: subj.code, subject_name: subj.name_th,
                    classroom: cls.grade_level, teacher: `${per.prefix || ""}${per.first_name || ""} ${per.last_name || ""}`.trim(),
                    semester: currentAssignment.semester, academic_year: currentAssignment.academic_year,
                  }, scoreColumns as any, rows);
                }}>
                  <Printer className="w-4 h-4 mr-1" /> พิมพ์ ปพ.5 (PDF)
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
           <TabsList>
            <TabsTrigger value="scores" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" /> บันทึกคะแนน (SGS)</TabsTrigger>
            <TabsTrigger value="setup" className="gap-1.5"><Settings className="w-3.5 h-3.5" /> ตัวชี้วัด/สัดส่วนน้ำหนัก</TabsTrigger>
            <TabsTrigger value="attendance" className="gap-1.5"><Calculator className="w-3.5 h-3.5" /> เวลาเรียน</TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> สรุปผล</TabsTrigger>
          </TabsList>

          {/* Setup tab */}
          <TabsContent value="setup" className="space-y-4">
            {/* ── สัดส่วนคะแนน 100% (SGS) ── */}
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> สัดส่วนคะแนน (รวม 100%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-32">
                    <Label className="text-xs">ระหว่างเรียน (%)</Label>
                    <Input
                      type="number" min={0} max={100}
                      value={weightForm.during}
                      onChange={e => {
                        const v = e.target.value;
                        const n = parseFloat(v);
                        setWeightForm({
                          during: v,
                          final: isNaN(n) ? weightForm.final : String(Math.max(0, 100 - n)),
                        });
                      }}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">งานเก็บ + กลางภาค</p>
                  </div>
                  <div className="text-xl font-bold text-muted-foreground pb-2">:</div>
                  <div className="w-32">
                    <Label className="text-xs">ปลายภาค (%)</Label>
                    <Input
                      type="number" min={0} max={100}
                      value={weightForm.final}
                      onChange={e => {
                        const v = e.target.value;
                        const n = parseFloat(v);
                        setWeightForm({
                          final: v,
                          during: isNaN(n) ? weightForm.during : String(Math.max(0, 100 - n)),
                        });
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-xs text-muted-foreground">
                      ผลรวม: <span className={`font-bold ${Math.round(parseFloat(weightForm.during || "0") + parseFloat(weightForm.final || "0")) === 100 ? "text-success" : "text-destructive"}`}>
                        {(parseFloat(weightForm.during || "0") + parseFloat(weightForm.final || "0")).toFixed(0)}%
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">ปกติ 70:30 หรือ 80:20 (เปลี่ยนได้ตามที่ครูกำหนด)</p>
                  </div>
                  <Button size="sm" onClick={handleSaveWeights}>
                    <Save className="w-4 h-4 mr-1" /> บันทึกสัดส่วน
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><ListChecks className="w-4 h-4" /> ตัวชี้วัด</CardTitle>
                  <Dialog open={indicatorOpen} onOpenChange={setIndicatorOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่มตัวชี้วัด</Button></DialogTrigger>
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
              </CardHeader>
              <CardContent>
                {indicators.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">ยังไม่ได้กำหนดตัวชี้วัด</p>
                ) : (
                  <div className="space-y-2">
                    {indicators.map((ind: any, i: number) => (
                      <div key={ind.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{i + 1}. {ind.title}</p>
                          {ind.description && <p className="text-xs text-muted-foreground">{ind.description}</p>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteIndicator(ind.id)}>
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> ช่องคะแนน</CardTitle>
                  <Dialog open={columnOpen} onOpenChange={setColumnOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่มช่องคะแนน</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>เพิ่มช่องคะแนน</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>ชื่อช่องคะแนน</Label><Input placeholder="เช่น งานเก็บ 1, สอบกลางภาค" value={columnForm.column_name} onChange={e => setColumnForm({...columnForm, column_name: e.target.value})} /></div>
                        <div><Label>ประเภท</Label>
                          <Select value={columnForm.column_type} onValueChange={v => setColumnForm({...columnForm, column_type: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="assignment">งานเก็บ</SelectItem>
                              <SelectItem value="midterm">สอบกลางภาค</SelectItem>
                              <SelectItem value="final">สอบปลายภาค</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>คะแนนเต็ม</Label><Input type="number" value={columnForm.max_score} onChange={e => setColumnForm({...columnForm, max_score: e.target.value})} /></div>
                        <Button onClick={handleAddColumn} className="w-full">บันทึก</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {scoreColumns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">ยังไม่ได้กำหนดช่องคะแนน</p>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: "งานเก็บ (ระหว่างเรียน)", cols: assignmentColumns },
                      { label: "สอบกลางภาค (ระหว่างเรียน)", cols: midtermColumns },
                      { label: "สอบปลายภาค", cols: finalColumns },
                    ].filter(g => g.cols.length > 0).map(group => (
                      <div key={group.label}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.cols.map((col: any) => {
                            const enabled = col.is_enabled !== false;
                            return (
                              <div key={col.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${enabled ? "bg-secondary" : "bg-muted/30 opacity-60"}`}>
                                <Checkbox
                                  checked={enabled}
                                  onCheckedChange={(v) => handleToggleColumnEnabled(col.id, !!v)}
                                  aria-label={`เปิด/ปิด ${col.column_name}`}
                                />
                                <span className="text-sm">{col.column_name}</span>
                                <span className="text-xs text-muted-foreground">({col.max_score})</span>
                                <button onClick={() => handleDeleteColumn(col.id)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                      <p>เปิดใช้ระหว่างเรียน: {duringColumnsEnabled.length} ช่อง · เต็มดิบ {sumMax(duringColumnsEnabled)} → ถ่วงเหลือ {weightDuring}%</p>
                      <p>เปิดใช้ปลายภาค: {finalColumnsEnabled.length} ช่อง · เต็มดิบ {sumMax(finalColumnsEnabled)} → ถ่วงเหลือ {weightFinal}%</p>
                      <p className="font-semibold text-foreground">รวมหลังถ่วงน้ำหนัก = 100 คะแนน</p>
                    </div>
                  </div>

                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Score entry tab */}
          <TabsContent value="scores" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-x-4">
                    <span>ระหว่างเรียน <b className="text-foreground">{weightDuring}%</b> · ปลายภาค <b className="text-foreground">{weightFinal}%</b> · รวม <b className="text-foreground">100</b></span>
                    <span>ติ๊กหัวคอลัมน์เพื่อเปิด/ปิด — กรอกคะแนนได้ทันทีแบบ SGS</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setColumnOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มคอลัมน์
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      {/* แถบกลุ่มคะแนน */}
                      {columnGroups.length > 0 && (
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background" />
                          <TableHead className="sticky left-10 bg-background" />
                          {columnGroups.map(g => (
                            <TableHead
                              key={g.key}
                              colSpan={g.cols.length}
                              className={`text-center text-xs font-semibold border-x border-border ${g.headerCls}`}
                            >
                              {g.label} <span className="opacity-70 font-normal">({g.cols.length})</span>
                            </TableHead>
                          ))}
                          <TableHead />
                          <TableHead colSpan={4} className="bg-muted/20" />
                        </TableRow>
                      )}
                      <TableRow>
                        <TableHead className="w-10 sticky left-0 bg-background">#</TableHead>
                        <TableHead className="sticky left-10 bg-background min-w-[150px]">ชื่อนักเรียน</TableHead>
                        {columnGroups.flatMap((g, gi) => g.cols.map((col: any, ci: number) => {
                          const enabled = col.is_enabled !== false;
                          const typeLabel = g.label.replace("สอบ", "");
                          const isLastInGroup = ci === g.cols.length - 1;
                          return (
                            <TableHead
                              key={col.id}
                              className={`text-center min-w-[90px] ${enabled ? "" : "opacity-50"} ${g.cellCls} ${isLastInGroup ? "border-r-2 border-border" : ""}`}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <Checkbox
                                  checked={enabled}
                                  onCheckedChange={(v) => handleToggleColumnEnabled(col.id, !!v)}
                                  aria-label={`เปิด/ปิด ${col.column_name}`}
                                />
                                <div className="text-xs font-medium leading-tight">{col.column_name}</div>
                                <button
                                  onClick={() => handleEditColumn(col)}
                                  className="opacity-40 hover:opacity-100 hover:text-primary"
                                  aria-label={`แก้ไข ${col.column_name}`}
                                  title="แก้ไขช่องคะแนน"
                                >
                                  <PenLine className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteColumn(col.id)}
                                  className="opacity-40 hover:opacity-100 hover:text-destructive"
                                  aria-label={`ลบ ${col.column_name}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="text-[10px] text-muted-foreground">{typeLabel} · เต็ม {col.max_score}</div>
                            </TableHead>
                          );
                        }))}
                        <TableHead className="text-center w-12 bg-muted/20 sticky-add">
                          <button
                            onClick={() => setColumnOpen(true)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-primary hover:text-primary hover:bg-primary/5 transition"
                            aria-label="เพิ่มคอลัมน์คะแนน"
                            title="เพิ่มคอลัมน์คะแนน (ตั้งชื่อ + ตัวชี้วัด + คะแนนเต็ม)"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </TableHead>
                        <TableHead className="text-center min-w-[70px] bg-secondary/30">ระหว่างเรียน<br/><span className="text-[10px] text-muted-foreground">/{weightDuring}</span></TableHead>
                        <TableHead className="text-center min-w-[70px] bg-secondary/30">ปลายภาค<br/><span className="text-[10px] text-muted-foreground">/{weightFinal}</span></TableHead>
                        <TableHead className="text-center min-w-[70px] bg-primary/10 font-bold">รวม<br/><span className="text-[10px] text-muted-foreground">/100</span></TableHead>
                        <TableHead className="text-center min-w-[60px]">เกรด</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.length === 0 ? (
                        <TableRow><TableCell colSpan={7 + scoreColumns.length} className="text-center py-8 text-muted-foreground">ไม่มีนักเรียนในห้องนี้</TableCell></TableRow>
                      ) : students.map((s: any, idx: number) => {
                        const duringScore = getStudentDuring(s.id);
                        const finalScore = getStudentFinal(s.id);
                        const total = getStudentTotal(s.id);
                        const { grade } = calculateGrade(total, 100);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="sticky left-0 bg-background">{idx + 1}</TableCell>
                            <TableCell className="sticky left-10 bg-background font-medium text-sm">{s.prefix}{s.first_name} {s.last_name}</TableCell>
                            {columnGroups.flatMap(g => g.cols.map((col: any, ci: number) => {
                              const enabled = col.is_enabled !== false;
                              const isLastInGroup = ci === g.cols.length - 1;
                              return (
                                <TableCell key={col.id} className={`p-1 ${g.cellCls} ${isLastInGroup ? "border-r-2 border-border" : ""}`}>
                                  <ScoreCell
                                    initialValue={getScore(s.id, col.id)}
                                    max={Number(col.max_score) || 100}
                                    disabled={!enabled}
                                    onCommit={(n) => handleScoreChange(s.id, col.id, n)}
                                  />
                                </TableCell>
                              );
                            }))}
                            <TableCell className="bg-muted/10" />
                            <TableCell className="text-center text-sm bg-secondary/20">{duringScore.toFixed(2)}</TableCell>
                            <TableCell className="text-center text-sm bg-secondary/20">{finalScore.toFixed(2)}</TableCell>
                            <TableCell className="text-center font-bold bg-primary/5">{total.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={gradeColor(grade)}>{grade}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {scoreColumns.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground border-t">
                      ยังไม่มีคอลัมน์คะแนน — กดปุ่ม <Plus className="inline w-3 h-3 mx-1" /> ในหัวตารางเพื่อเพิ่มช่องและกำหนดตัวชี้วัด
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
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
                    const maxTotal = getMaxTotal();
                    const count = students.filter((s: any) => {
                      const total = getStudentTotal(s.id);
                      return calculateGrade(total, maxTotal).grade === g;
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
          <TabsContent value="attendance" className="space-y-4">
            <Pp5AttendancePrintPage assignmentId={currentAssignment?.id} />
          </TabsContent>
        </Tabs>
      )}

      {/* Top-level dialog mirror — keeps "+ เพิ่มคอลัมน์" working from any tab (Radix TabsContent unmounts inactive tabs) */}
      <Dialog open={columnOpen} onOpenChange={setColumnOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่มช่องคะแนน</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ชื่อช่องคะแนน / ตัวชี้วัด</Label><Input placeholder="เช่น งานเก็บ 1, สอบกลางภาค" value={columnForm.column_name} onChange={e => setColumnForm({ ...columnForm, column_name: e.target.value })} /></div>
            <div><Label>ประเภท</Label>
              <Select value={columnForm.column_type} onValueChange={v => setColumnForm({ ...columnForm, column_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assignment">งานเก็บ (ระหว่างเรียน)</SelectItem>
                  <SelectItem value="midterm">สอบกลางภาค (ระหว่างเรียน)</SelectItem>
                  <SelectItem value="final">สอบปลายภาค</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>คะแนนเต็ม</Label><Input type="number" value={columnForm.max_score} onChange={e => setColumnForm({ ...columnForm, max_score: e.target.value })} /></div>
            <Button onClick={handleAddColumn} className="w-full">บันทึก</Button>
          </div>
        </DialogContent>
      </Dialog>
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
      const { data } = await supabase.from("students").select("*").eq("classroom_id", classroomId).eq("status", "active").order("student_code");
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

  const handlePrint = () => {
    if (!selectedSubject) return;

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
    const beYear = selectedSubject.academic_year ? selectedSubject.academic_year + 543 : new Date().getFullYear() + 543;
    const classLabel = selectedClassroom ? `${selectedClassroom.name}` : "";

    const headerHtml = (pageNum: number) => `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2pt;">
        <div style="font-size:9pt; color:#666;">ปพ.5</div>
        <div style="text-align:center; flex:1;">
          <div style="font-size:13pt; font-weight:700;">${schoolInfo.school_name || "โรงเรียน"}</div>
          ${schoolInfo.school_address ? `<div style="font-size:9pt;">${schoolInfo.school_address}</div>` : ""}
        </div>
        <div style="font-size:9pt; color:#666;">หน้า ${pageNum}/${totalPages}</div>
      </div>
      <div style="text-align:center; font-size:12pt; font-weight:700; margin-bottom:1pt;">แบบบันทึกผลการเรียนประจำรายวิชา (ปพ.5)</div>
      <div style="text-align:center; font-size:9pt; margin-bottom:4pt;">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 10pt; font-size:10pt; border:1px solid #999; padding:3pt 6pt; margin-bottom:4pt; line-height:1.5;">
        <div>รายวิชา <strong>${selectedSubject.name_th}</strong> (${selectedSubject.code})</div>
        <div>ภาคเรียนที่ <strong>${semester}</strong> ปีการศึกษา <strong>${beYear}</strong></div>
        <div>ระดับชั้น <strong>${classLabel}</strong></div>
        <div>หน่วยกิต <strong>${selectedSubject.credits || "-"}</strong> ${teacherName ? `ครูผู้สอน <strong>${teacherName}</strong>` : ""}</div>
        <div>ประเภท <strong>${selectedSubject.subject_type === "required" ? "วิชาพื้นฐาน" : "วิชาเพิ่มเติม"}</strong></div>
        <div>จำนวนนักเรียน <strong>${displayData.length}</strong> คน</div>
      </div>
      <div style="font-size:8pt; display:flex; gap:12pt; margin-bottom:3pt; color:#444;">
        <span>สัดส่วนคะแนน: ระหว่างเรียน <strong>${SCORE_PROPORTIONS.duringTerm}</strong></span>
        <span>กลางภาค <strong>${SCORE_PROPORTIONS.midterm}</strong></span>
        <span>ปลายภาค <strong>${SCORE_PROPORTIONS.final}</strong></span>
        <span>รวม <strong>${SCORE_PROPORTIONS.total}</strong></span>
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
          <div class="obec-sig-item">${signatureImgHtml(schoolInfo.director_signature_url, 40)}<div class="obec-sig-line"></div><div class="obec-sig-name" style="font-size:11pt;">${schoolInfo.director_name ? `(${schoolInfo.director_name})` : "(ผู้อำนวยการ)"}</div><div class="obec-sig-title" style="font-size:10pt;">${schoolInfo.director_title}</div></div>
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

    openPrintWindow(studentPagesHtml + separateSummaryPage, { title: "ปพ.5", landscape: false });
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
      </div>

      {subjectId && selectedSubject && (
        <Card className="border shadow-sm">
          <CardContent className="p-8">
            <div className="text-center border-b border-b-foreground/20 pb-4 mb-4">
              <h1 className="text-xl font-bold">{schoolInfo.school_name || "โรงเรียน"}</h1>
              <h2 className="text-base font-bold mt-1">แบบบันทึกผลการเรียนประจำรายวิชา (ปพ.5)</h2>
              <p className="text-sm text-muted-foreground">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm border rounded-lg p-4 bg-muted/20">
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ภาคเรียนที่</span><span className="font-semibold">{semester}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ปีการศึกษา</span><span className="font-semibold">{selectedSubject.academic_year ? selectedSubject.academic_year + 543 : new Date().getFullYear() + 543}</span></div>
              {selectedClassroom && <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ระดับชั้น</span><span className="font-semibold">{selectedClassroom.grade_level} - {selectedClassroom.name}</span></div>}
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">กลุ่มสาระ</span><span className="font-semibold">{selectedSubject.subject_type === 'required' ? 'วิชาพื้นฐาน' : 'วิชาเพิ่มเติม'}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">รายวิชา</span><span className="font-semibold">{selectedSubject.name_th}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">รหัสวิชา</span><span className="font-semibold">{selectedSubject.code}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">หน่วยกิต</span><span className="font-semibold">{selectedSubject.credits}</span></div>
              {teacherName && <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ครูผู้สอน</span><span className="font-semibold">{teacherName}</span></div>}
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">จำนวนนักเรียน</span><span className="font-semibold">{displayData.length} คน</span></div>
            </div>
            <div className="mt-6 overflow-x-auto">
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
              <div className="grid grid-cols-2 gap-y-10 gap-x-4">
                <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">{teacherName || "ครูผู้สอน"}</p></div>
                <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">หัวหน้ากลุ่มสาระการเรียนรู้</p></div>
                <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">หัวหน้างานวัดและประเมินผล</p></div>
                <SignatureBlock size="sm" fallbackPosition={schoolInfo.director_title} />
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

  // รายการคะแนนที่กรอกแบบปกติ (ไม่มีไฟล์อัพโหลด) — group by subject
  const { data: manualScoreSubjects = [] } = useQuery({
    queryKey: ["pp5_manual_subjects"],
    queryFn: async () => {
      const { data: scores } = await supabase
        .from("student_scores")
        .select("subject_id, semester, academic_year, updated_at")
        .not("subject_id", "is", null)
        .order("updated_at", { ascending: false });
      const map = new Map<string, any>();
      (scores || []).forEach((s: any) => {
        if (!s.subject_id) return;
        const cur = map.get(s.subject_id);
        if (!cur) map.set(s.subject_id, { ...s, _count: 1 });
        else cur._count++;
      });
      const ids = Array.from(map.keys());
      if (ids.length === 0) return [];
      const { data: subs } = await supabase.from("subjects")
        .select("id, code, name_th, grade_level").in("id", ids);
      const subMap = new Map((subs || []).map((s: any) => [s.id, s]));
      return Array.from(map.values()).map((m: any) => ({ ...m, subject: subMap.get(m.subject_id) }));
    },
  });


  const years = [...new Set(pp5Files.map((f: any) => f.academic_year))].sort((a, b) => b - a);
  
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

  const UNKNOWN_GROUP = "ไม่ระบุระดับชั้น";
  const grouped = filtered.reduce((acc, f: any) => {
    const key = GRADE_LEVELS.includes(f.grade_level) ? f.grade_level : UNKNOWN_GROUP;
    (acc[key] = acc[key] || []).push(f);
    return acc;
  }, {} as Record<string, any[]>);

  const handleDownload = async (fileUrlOrPath: string, fileName: string, filePath?: string) => {
    let href = fileUrlOrPath;
    const path = filePath || (fileUrlOrPath?.match(/\/pp5-files\/(.+?)(\?|$)/)?.[1] ?? "");
    if (path) {
      const { data } = await supabase.storage.from("pp5-files").createSignedUrl(path, 300);
      if (data?.signedUrl) href = data.signedUrl;
    }
    const a = document.createElement("a");
    a.href = href; a.download = fileName; a.target = "_blank"; a.rel = "noreferrer"; a.click();
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!(await swal.confirm({ title: "ต้องการลบไฟล์นี้หรือไม่?", danger: true }))) return;
    if (filePath) await supabase.storage.from("pp5-files").remove([filePath]);
    const { error } = await supabase.from("pp5_files").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบไฟล์สำเร็จ");
    qc.invalidateQueries({ queryKey: ["pp5_files"] });
  };

  const gradeGroups = [
    { label: "อนุบาล", grades: ["อ.1", "อ.2", "อ.3"] },
    { label: "ประถมศึกษา", grades: ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"] },
    { label: "ม.ต้น", grades: ["ม.1", "ม.2", "ม.3"] },
    { label: "ม.ปลาย", grades: ["ม.4", "ม.5", "ม.6"] },
    { label: "อื่นๆ", grades: [UNKNOWN_GROUP] },
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
        <PP5ImportDialog onImportSuccess={() => qc.invalidateQueries({ queryKey: ["pp5_files"] })} />
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
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>รายวิชา</TableHead>
                          <TableHead className="w-24">รหัสวิชา</TableHead>
                          <TableHead className="w-16 text-center">เทอม</TableHead>
                          <TableHead className="w-20 text-center">ปีการศึกษา</TableHead>
                          <TableHead>ครูผู้สอน</TableHead>
                          <TableHead className="w-40">ไฟล์</TableHead>
                          <TableHead className="w-24 text-center">ดาวน์โหลด</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {grouped[grade].map((f: any) => (
                            <TableRow key={f.id}>
                              <TableCell className="font-medium">{f.subject_name || "-"}</TableCell>
                              <TableCell className="font-mono text-xs">{f.subject_code || "-"}</TableCell>
                              <TableCell className="text-center">{f.semester}</TableCell>
                              <TableCell className="text-center">{f.academic_year ? (f.academic_year + 543) : "-"}</TableCell>
                              <TableCell className="text-sm">{f.teacher_name || "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{f.file_name}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => handleDownload(f.file_url, f.file_name, f.file_path)} title="ดาวน์โหลด">
                                    <Download className="w-4 h-4 text-primary" />
                                  </Button>
                                  {(isAdmin || isDirector) && (
                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(f.id, f.file_path)} title="ลบ">
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

      {manualScoreSubjects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              การกรอกคะแนนในระบบ (ไม่ได้อัพโหลดไฟล์)
              <Badge variant="secondary">{manualScoreSubjects.length} วิชา</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>รายวิชา</TableHead>
                  <TableHead className="w-24">รหัสวิชา</TableHead>
                  <TableHead className="w-20 text-center">ระดับชั้น</TableHead>
                  <TableHead className="w-16 text-center">เทอม</TableHead>
                  <TableHead className="w-20 text-center">ปีการศึกษา</TableHead>
                  <TableHead className="w-24 text-center">จำนวนแถวคะแนน</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {manualScoreSubjects.map((m: any) => (
                    <TableRow key={m.subject_id}>
                      <TableCell className="font-medium">{m.subject?.name_th || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{m.subject?.code || "-"}</TableCell>
                      <TableCell className="text-center">{m.subject?.grade_level || "-"}</TableCell>
                      <TableCell className="text-center">{m.semester ?? "-"}</TableCell>
                      <TableCell className="text-center">{m.academic_year ? (m.academic_year + 543) : "-"}</TableCell>
                      <TableCell className="text-center">{m._count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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

// ระดับคุณภาพตามแนว สพฐ. (3 = ดีเยี่ยม, 2 = ดี, 1 = ผ่าน)
const ASSESSMENT_SCORE_OPTIONS = [3, 2, 1];
const ASSESSMENT_SCORE_LABEL: Record<number, string> = { 3: "3 ดีเยี่ยม", 2: "2 ดี", 1: "1 ผ่าน" };

const AssessmentTab = () => {
  const { isAdmin, isDirector, userId } = useUserRole();
  const qc = useQueryClient();

  const [gradeLevel, setGradeLevel] = useState("");
  const [criteriaOpen, setCriteriaOpen] = useState(false);
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
      const { data } = await supabase.from("students").select("*").eq("classroom_id", currentAssignment.classroom_id).eq("status", "active").order("student_code");
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
    if (error) { toast.error(error.message); return; }
    toast.success("เพิ่มหัวข้อประเมินสำเร็จ");
    setCriteriaOpen(false);
    setCriteriaForm({ title: "", description: "", category: selectedCategory });
    qc.invalidateQueries({ queryKey: ["assessment_criteria"] });
  };

  const handleDeleteCriteria = async (id: string) => {
    const { error } = await supabase.from("assessment_criteria").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
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
    if (error) toast.error(error.message);
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
    if (error) { toast.error(error.message); return; }
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
    if (score >= 3) return "bg-success/15 text-success";
    if (score >= 2) return "bg-info/15 text-info";
    if (score >= 1) return "bg-warning/15 text-warning";
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
          <TabsList>
            {ASSESSMENT_CATEGORIES.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="gap-1.5">
                <cat.icon className="w-3.5 h-3.5" /> {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {ASSESSMENT_CATEGORIES.map(cat => (
            <TabsContent key={cat.value} value={cat.value} className="space-y-4">
              {(isAdmin || isDirector) && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="w-4 h-4" /> หัวข้อการประเมิน ({cat.label})
                      </CardTitle>
                      <Dialog open={criteriaOpen} onOpenChange={setCriteriaOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" onClick={() => setCriteriaForm({ ...criteriaForm, category: cat.value })}>
                            <Plus className="w-4 h-4 mr-1" /> เพิ่มหัวข้อ
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
                  </CardHeader>
                  <CardContent>
                    {filteredCriteria.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีหัวข้อประเมิน</p>
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
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" /> ประเมินรายนักเรียน (ระดับคุณภาพ 1-3 ตาม สพฐ.)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredCriteria.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีหัวข้อประเมิน (ให้แอดมินเพิ่มหัวข้อก่อน)</p>
                  ) : students.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">ไม่มีนักเรียนในห้องเรียนนี้</p>
                  ) : (
                    <div className="overflow-x-auto">
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
                                        {ASSESSMENT_SCORE_OPTIONS.map(s => (<SelectItem key={s} value={s.toString()}>{ASSESSMENT_SCORE_LABEL[s]}</SelectItem>))}
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
                                        {ASSESSMENT_SCORE_OPTIONS.map(sc => (<SelectItem key={sc} value={sc.toString()}>{ASSESSMENT_SCORE_LABEL[sc]}</SelectItem>))}
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
        <TabsList>
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
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            แดชบอร์ดรายบุคคล
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            จัดการไฟล์ ปพ.5
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entry"><ScoreEntryTab /></TabsContent>
        <TabsContent value="assessment"><AssessmentTab /></TabsContent>
        <TabsContent value="scores"><ScoreViewTab /></TabsContent>
        <TabsContent value="dashboard"><StudentScoreDashboard /></TabsContent>
        <TabsContent value="files"><FileTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Pp5Page;
