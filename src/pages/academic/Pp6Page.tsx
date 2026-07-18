import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Download, Trash2, FileSpreadsheet, FolderOpen, Calendar, ClipboardList, Search, User } from "lucide-react";
import { useSchoolInfo, signatureImgHtml } from "@/components/documents/DocumentHeader";
import { SignatureBlock } from "@/components/documents/SignatureBlock";
import { gradeColor } from "@/lib/gradeUtils";
import { openPrintWindow } from "@/lib/printUtils";
import { formatFullName, formatFullNameHtml } from "@/lib/nameFormat";
import { toast } from "sonner";
import PP6ImportDialog from "@/components/academic/PP6ImportDialog";
import ReportCardPage from "./ReportCardPage";
import { swal } from "@/lib/swal";
import { exportPP6Book } from "@/lib/exporters/officialPpBook";

const GRADE_LEVELS = [
  "อ.1", "อ.2", "อ.3",
  "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6",
  "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6",
  "การศึกษาพิเศษ",
];

const toBE = (y: number) => y > 2400 ? y : y + 543;

// ── Score Overview Tab ──
const ScoreOverviewTab = () => {
  const { userId, isAdmin, isDirector } = useUserRole();
  const currentYear = new Date().getFullYear();
  const [academicYear, setAcademicYear] = useState(String(currentYear));
  const [gradeLevel, setGradeLevel] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [semester, setSemester] = useState("1");
  const schoolInfo = useSchoolInfo();

  const { data: allClassroomsRaw = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });

  // Restrict to classrooms the current teacher has assignments in (admins/directors see all)
  const { data: myPersonnel } = useQuery({
    queryKey: ["pp6_personnel", userId],
    enabled: !!userId && !isAdmin && !isDirector,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: ["pp6_assignments", myPersonnel?.id],
    enabled: !!myPersonnel?.id,
    queryFn: async () => {
      const { data } = await supabase.from("teacher_assignments").select("classroom_id").eq("personnel_id", myPersonnel!.id);
      return data || [];
    },
  });

  const allowedClassroomIds = new Set(myAssignments.map((a: any) => a.classroom_id));
  const allClassrooms = (isAdmin || isDirector)
    ? allClassroomsRaw
    : allClassroomsRaw.filter((c: any) => allowedClassroomIds.has(c.id));

  const availableYears = [...new Set(allClassrooms.map((c: any) => c.academic_year))].sort((a: number, b: number) => b - a);
  const yearClassrooms = allClassrooms.filter((c: any) => String(c.academic_year) === academicYear);
  const classrooms = gradeLevel ? yearClassrooms.filter((c: any) => c.grade_level === gradeLevel) : [];

  const { data: classStudents = [] } = useQuery({
    queryKey: ["pp6_students", classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data } = await supabase.from("students").select("*").eq("classroom_id", classroomId).eq("status", "active").order("student_code");
      return data || [];
    },
    enabled: !!classroomId,
  });

  const selectedClassroom = classrooms.find((c: any) => c.id === classroomId);

  // Get subjects for this grade level
  const { data: subjects = [] } = useQuery({
    queryKey: ["pp6_subjects", selectedClassroom?.grade_level, semester],
    queryFn: async () => {
      if (!selectedClassroom) return [];
      const { data } = await supabase.from("subjects").select("*")
        .eq("grade_level", selectedClassroom.grade_level)
        .eq("semester", parseInt(semester))
        .order("code");
      return data || [];
    },
    enabled: !!selectedClassroom,
  });

  // Get scores for all students in this class
  const { data: allScores = [] } = useQuery({
    queryKey: ["pp6_all_scores", classroomId, semester],
    queryFn: async () => {
      if (!classroomId || subjects.length === 0) return [];
      const subjectIds = subjects.map((s: any) => s.id);
      const { data } = await supabase.from("student_scores").select("*")
        .in("subject_id", subjectIds)
        .eq("semester", parseInt(semester));
      return data || [];
    },
    enabled: !!classroomId && subjects.length > 0,
  });

  const mergedData = classStudents.map((s: any) => {
    const studentScores = allScores.filter((sc: any) => sc.student_code === s.student_code);
    const gradesBySubject: Record<string, { grade: string; gradePoint: number }> = {};
    studentScores.forEach((sc: any) => {
      gradesBySubject[sc.subject_id] = { grade: sc.grade || "-", gradePoint: sc.grade_point || 0 };
    });

    const validPoints = Object.values(gradesBySubject).filter(g => g.gradePoint > 0);
    const gpa = validPoints.length > 0
      ? (validPoints.reduce((sum, g) => sum + g.gradePoint, 0) / validPoints.length).toFixed(2)
      : "-";

    return {
      id: s.id,
      student_code: s.student_code,
      student_name: formatFullName(s.prefix, s.first_name, s.last_name),
      student_name_html: formatFullNameHtml(s.prefix, s.first_name, s.last_name),
      gradesBySubject,
      gpa,
    };
  });

  const handlePrint = () => {
    if (!selectedClassroom) return;

    const beYear = toBE(selectedClassroom.academic_year);
    const classLabel = selectedClassroom.name;
    const homeroomTeacher = selectedClassroom.homeroom_teacher || "";

    // Split subjects into groups for A4 portrait (max ~6 subjects per page to keep readable)
    const MAX_SUBJECTS_PER_PAGE = 6;
    const subjectGroups: any[][] = [];
    for (let i = 0; i < subjects.length; i += MAX_SUBJECTS_PER_PAGE) {
      subjectGroups.push(subjects.slice(i, i + MAX_SUBJECTS_PER_PAGE));
    }
    if (subjectGroups.length === 0) subjectGroups.push([]);

    // Paginate students: ~32 per page for compact A4
    const ROWS_PER_PAGE = 32;

    const headerHtml = (pageNum: number, totalPg: number, subjectLabel: string) => `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2pt;">
        <div style="font-size:9pt; color:#666;">ปพ.6</div>
        <div style="text-align:center; flex:1;">
          <div style="font-size:13pt; font-weight:700;">${schoolInfo.school_name || "โรงเรียน"}</div>
          ${schoolInfo.school_address ? `<div style="font-size:9pt;">${schoolInfo.school_address}</div>` : ""}
        </div>
        <div style="font-size:9pt; color:#666;">หน้า ${pageNum}/${totalPg}</div>
      </div>
      <div style="text-align:center; font-size:12pt; font-weight:700; margin-bottom:1pt;">แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)</div>
      <div style="text-align:center; font-size:9pt; margin-bottom:4pt;">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 10pt; font-size:10pt; border:1px solid #999; padding:3pt 6pt; margin-bottom:4pt; line-height:1.5;">
        <div>ระดับชั้น <strong>${classLabel}</strong></div>
        <div>ภาคเรียนที่ <strong>${semester}</strong> ปีการศึกษา <strong>${beYear}</strong></div>
        <div>ครูประจำชั้น <strong>${homeroomTeacher}</strong></div>
        <div>จำนวนนักเรียน <strong>${mergedData.length}</strong> คน ${subjectLabel ? `(${subjectLabel})` : ""}</div>
      </div>`;

    // Calculate total pages
    let totalPages = 0;
    subjectGroups.forEach(() => {
      totalPages += Math.ceil(mergedData.length / ROWS_PER_PAGE) || 1;
    });
    // Check if signature can fit on last data page
    const lastGroupPages = Math.ceil(mergedData.length / ROWS_PER_PAGE) || 1;
    const lastGroupLastPageRows = mergedData.length % ROWS_PER_PAGE || (mergedData.length > 0 ? ROWS_PER_PAGE : 0);
    const canFitSigOnLastPage = lastGroupLastPageRows <= 20; // enough room for subject list + signatures
    if (!canFitSigOnLastPage) totalPages += 1;

    let currentPage = 0;
    let allPagesHtml = "";

    const signaturesHtml = `
      <div style="font-size:11pt; font-weight:700; margin:6pt 0 3pt; border-bottom:1px solid #999; padding-bottom:2pt;">สรุปรายวิชาที่จัดการเรียนการสอน</div>
      <table class="obec-table" style="font-size:10pt;">
        <thead><tr><th style="font-size:9pt;">ลำดับ</th><th style="font-size:9pt;">รหัสวิชา</th><th style="font-size:9pt;">ชื่อวิชา</th><th class="center" style="font-size:9pt;">หน่วยกิต</th></tr></thead>
        <tbody>${subjects.map((s: any, i: number) => `<tr><td class="center">${i + 1}</td><td>${s.code}</td><td>${s.name_th}</td><td class="center">${s.credits || "-"}</td></tr>`).join("")}</tbody>
      </table>
      <div style="margin-top:16pt; page-break-inside:avoid;">
        <div class="obec-sig-grid-2">
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-name" style="font-size:11pt;">${homeroomTeacher || "(ครูประจำชั้น)"}</div><div class="obec-sig-title" style="font-size:10pt;">ครูประจำชั้น</div></div>
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-title" style="font-size:10pt;">หัวหน้างานวิชาการ</div></div>
          <div class="obec-sig-item"><div class="obec-sig-line"></div><div class="obec-sig-title" style="font-size:10pt;">หัวหน้างานวัดและประเมินผล</div></div>
          <div class="obec-sig-item">${signatureImgHtml(schoolInfo.director_signature_url, 40)}<div class="obec-sig-line"></div><div class="obec-sig-name" style="font-size:11pt;">${schoolInfo.director_name ? `(${schoolInfo.director_name})` : "(ผู้อำนวยการ)"}</div><div class="obec-sig-title" style="font-size:10pt;">${schoolInfo.director_title}</div></div>
        </div>
      </div>`;

    subjectGroups.forEach((subGroup, gi) => {
      const subLabel = subjectGroups.length > 1 ? `กลุ่มวิชา ${gi + 1}/${subjectGroups.length}` : "";
      const studentPages: any[][] = [];
      for (let i = 0; i < mergedData.length; i += ROWS_PER_PAGE) {
        studentPages.push(mergedData.slice(i, i + ROWS_PER_PAGE));
      }
      if (studentPages.length === 0) studentPages.push([]);

      const subCount = subGroup.length;
      const subColWidth = Math.max(30, Math.floor(260 / Math.max(subCount, 1)));
      const isLastGroup = gi === subjectGroups.length - 1;

      studentPages.forEach((pageData, pi) => {
        currentPage++;
        const startIdx = pi * ROWS_PER_PAGE;
        const isLastPageOfLastGroup = isLastGroup && pi === studentPages.length - 1;
        const rows = pageData.map((s: any, i: number) => {
          const subCells = subGroup.map((sub: any) => {
            const g = s.gradesBySubject[sub.id];
            return `<td class="center" style="font-size:10pt;">${g ? g.grade : "-"}</td>`;
          }).join("");
          return `<tr>
            <td class="center" style="font-size:10pt;">${startIdx + i + 1}</td>
            <td style="font-size:9pt;">${s.student_code}</td>
            <td style="font-size:10pt;">${s.student_name_html}</td>
            ${subCells}
            ${isLastGroup ? `<td class="center bold" style="font-size:10pt;">${s.gpa}</td>` : ""}
          </tr>`;
        }).join("");

        const subHeaders = subGroup.map((s: any) =>
          `<th class="center" style="font-size:8pt; width:${subColWidth}px; white-space:normal; line-height:1.1; padding:2pt;">${s.code}<br/>${s.name_th}</th>`
        ).join("");

        const appendSig = isLastPageOfLastGroup && canFitSigOnLastPage;

        allPagesHtml += `<div class="obec-a4-page" ${currentPage > 1 ? 'style="page-break-before:always;"' : ""}>
          ${headerHtml(currentPage, totalPages, subLabel)}
          <table class="obec-table" style="font-size:10pt; table-layout:fixed; width:100%;">
            <thead><tr>
              <th style="width:24px; font-size:9pt;">ลำดับ</th>
              <th style="width:50px; font-size:9pt;">รหัส</th>
              <th style="font-size:9pt;">ชื่อ-สกุล</th>
              ${subHeaders}
              ${isLastGroup ? '<th class="center" style="width:30px; font-size:9pt;">GPA</th>' : ""}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${appendSig ? signaturesHtml : ""}
        </div>`;
      });
    });

    // Separate signature page only if needed
    if (!canFitSigOnLastPage) {
      currentPage++;
      allPagesHtml += `<div class="obec-a4-page" style="page-break-before:always;">
        ${headerHtml(currentPage, totalPages, "")}
        ${signaturesHtml}
      </div>`;
    }

    openPrintWindow(allPagesHtml, { title: "ปพ.6", landscape: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-end">
        <Select value={academicYear} onValueChange={(v) => { setAcademicYear(v); setGradeLevel(""); setClassroomId(""); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="ปีการศึกษา" /></SelectTrigger>
          <SelectContent>
            {availableYears.length > 0 ? availableYears.map((y: number) => (
              <SelectItem key={y} value={String(y)}>ปีการศึกษา {toBE(y)}</SelectItem>
            )) : (
              <SelectItem value={String(currentYear)}>ปีการศึกษา {toBE(currentYear)}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setClassroomId(""); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="เลือกระดับชั้น" /></SelectTrigger>
          <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={classroomId} onValueChange={setClassroomId} disabled={!gradeLevel}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder={gradeLevel ? "เลือกห้องเรียน" : "เลือกระดับชั้นก่อน"} /></SelectTrigger>
          <SelectContent>{classrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={semester} onValueChange={setSemester}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
            <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
          </SelectContent>
        </Select>
        {classroomId && <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />พิมพ์</Button>}
        {classroomId && selectedClassroom && (
          <Button
            variant="default"
            onClick={async () => {
              try {
                const grade = selectedClassroom.grade_level || "";
                const level = grade.startsWith("ม.4") || grade.startsWith("ม.5") || grade.startsWith("ม.6")
                  ? "มัธยมศึกษาตอนปลาย"
                  : grade.startsWith("ม.") ? "มัธยมศึกษาตอนต้น" : "ประถมศึกษา";
                await exportPP6Book({
                  school: {
                    school_name: schoolInfo.school_name,
                    affiliation: schoolInfo.affiliation,
                    director_name: schoolInfo.director_name,
                    director_title: schoolInfo.director_title,
                    school_logo: schoolInfo.school_logo,
                    garuda_emblem: schoolInfo.garuda_emblem,
                  },
                  director_name: schoolInfo.director_name,
                  director_title: schoolInfo.director_title,
                  homeroom_teacher: (selectedClassroom as any).homeroom_teacher_name || "",
                  homeroom_teacher_position: "ครูประจำชั้น",
                  semester,
                  academic_year: selectedClassroom.academic_year,
                  grade_level: grade,
                  education_level: level,
                  students: (classStudents as any[]).map((s, i) => ({
                    no: i + 1,
                    student_code: s.student_code,
                    full_name: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
                  })),
                });
                toast.success("สร้างเล่ม ปพ.6 ตามเทมเพลตราชการแล้ว");
              } catch (e: any) {
                toast.error(e?.message || "ส่งออกไม่สำเร็จ");
              }
            }}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />เล่ม ปพ.6 (ตามเทมเพลตราชการ)
          </Button>
        )}
      </div>

      {classroomId && selectedClassroom && (
        <Card className="border shadow-sm">
          <CardContent className="p-8">
            <div className="text-center border-b border-b-foreground/20 pb-4 mb-4">
              <h1 className="text-xl font-bold">{schoolInfo.school_name || "โรงเรียน"}</h1>
              <h2 className="text-base font-bold mt-1">แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)</h2>
              <p className="text-sm text-muted-foreground">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm border rounded-lg p-4 bg-muted/20">
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ภาคเรียนที่</span><span className="font-semibold">{semester}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ปีการศึกษา</span><span className="font-semibold">{toBE(selectedClassroom.academic_year)}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">ระดับชั้น</span><span className="font-semibold">{selectedClassroom.grade_level} - {selectedClassroom.name}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground min-w-[100px]">จำนวนนักเรียน</span><span className="font-semibold">{mergedData.length} คน</span></div>
            </div>
            <div className="mt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10 text-center border-r">ลำดับ</TableHead>
                    <TableHead className="w-20 border-r">รหัส</TableHead>
                    <TableHead className="border-r">ชื่อ-สกุล</TableHead>
                    {subjects.map((s: any) => (
                      <TableHead key={s.id} className="text-center border-r text-xs min-w-[60px]">{s.name_th}</TableHead>
                    ))}
                    <TableHead className="text-center">GPA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mergedData.map((s: any, i: number) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-center border-r">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs border-r">{s.student_code}</TableCell>
                      <TableCell className="text-sm border-r whitespace-pre-wrap">{s.student_name}</TableCell>
                      {subjects.map((sub: any) => {
                        const g = s.gradesBySubject[sub.id];
                        return (
                          <TableCell key={sub.id} className="text-center border-r">
                            {g ? <Badge variant="outline" className={gradeColor(g.grade)}>{g.grade}</Badge> : "-"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold">{s.gpa}</TableCell>
                    </TableRow>
                  ))}
                  {mergedData.length === 0 && (
                    <TableRow><TableCell colSpan={3 + subjects.length + 1} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล - กรุณาเลือกห้องเรียน</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {mergedData.length > 0 && (
              <div className="mt-12 pt-8">
                <div className="grid grid-cols-2 gap-y-10 gap-x-4">
                  <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">ครูประจำชั้น</p></div>
                  <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">หัวหน้างานวิชาการ</p></div>
                  <div className="text-center"><div className="w-44 border-b border-foreground/60 mb-1 mx-auto" /><p className="text-xs text-muted-foreground">หัวหน้างานวัดและประเมินผล</p></div>
                  <SignatureBlock size="sm" fallbackPosition={schoolInfo.director_title} />
                </div>
              </div>
            )}
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

  const { data: pp6Files = [], isLoading } = useQuery({
    queryKey: ["pp6_files"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pp6_files").select("*").order("academic_year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const years = [...new Set(pp6Files.map((f: any) => f.academic_year))].sort((a: number, b: number) => b - a);

  let filtered = pp6Files as any[];
  if (selectedYear !== "all") filtered = filtered.filter((f: any) => String(f.academic_year) === selectedYear);
  if (selectedGrade !== "all") filtered = filtered.filter((f: any) => f.grade_level === selectedGrade);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((f: any) =>
      (f.classroom_name || "").toLowerCase().includes(q) ||
      (f.teacher_name || "").toLowerCase().includes(q) ||
      (f.file_name || "").toLowerCase().includes(q) ||
      (f.grade_level || "").toLowerCase().includes(q)
    );
  }

  const grouped = GRADE_LEVELS.reduce((acc, grade) => {
    const files = filtered.filter((f: any) => f.grade_level === grade);
    if (files.length > 0) acc[grade] = files;
    return acc;
  }, {} as Record<string, any[]>);

  const handleDownload = (fileUrl: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = fileUrl; a.download = fileName; a.target = "_blank"; a.click();
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!(await swal.confirm({ title: "ต้องการลบไฟล์นี้หรือไม่?", danger: true }))) return;
    await supabase.storage.from("pp6-files").remove([filePath]);
    const { error } = await supabase.from("pp6_files").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบไฟล์สำเร็จ");
    qc.invalidateQueries({ queryKey: ["pp6_files"] });
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
              {years.map((y: any) => <SelectItem key={y} value={String(y)}>{toBE(y)}</SelectItem>)}
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
            placeholder="ค้นหาห้อง, ครู..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <PP6ImportDialog onImportSuccess={() => qc.invalidateQueries({ queryKey: ["pp6_files"] })} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{filtered.length}</p><p className="text-xs text-muted-foreground">ไฟล์ทั้งหมด</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{Object.keys(grouped).length}</p><p className="text-xs text-muted-foreground">ระดับชั้น</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{new Set(filtered.map((f: any) => f.teacher_name)).size}</p><p className="text-xs text-muted-foreground">ครูประจำชั้น</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{years.length}</p><p className="text-xs text-muted-foreground">ปีการศึกษา</p></CardContent></Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">กำลังโหลด...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">ยังไม่มีไฟล์ ปพ.6 ในระบบ</p>
            <p className="text-sm text-muted-foreground">กดปุ่ม "นำเข้า ปพ.6" เพื่ออัพโหลดไฟล์</p>
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
                      <span>{grouped[grade].length} ไฟล์</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>ห้องเรียน</TableHead>
                          <TableHead className="w-16 text-center">เทอม</TableHead>
                          <TableHead className="w-20 text-center">ปีการศึกษา</TableHead>
                          <TableHead>ครูประจำชั้น</TableHead>
                          <TableHead className="w-40">ไฟล์</TableHead>
                          <TableHead className="w-24 text-center">ดาวน์โหลด</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {grouped[grade].map((f: any) => (
                            <TableRow key={f.id}>
                              <TableCell className="font-medium">{f.classroom_name || f.grade_level}</TableCell>
                              <TableCell className="text-center">{f.semester}</TableCell>
                              <TableCell className="text-center">{toBE(f.academic_year)}</TableCell>
                              <TableCell className="text-sm">{f.teacher_name || "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{f.file_name}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => handleDownload(f.file_url, f.file_name)} title="ดาวน์โหลด">
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
    </div>
  );
};

// ── Main Page ──
const Pp6Page = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">รายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)</h1>
        <p className="text-sm text-muted-foreground">แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            ดูผลการเรียน
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-2">
            <User className="w-4 h-4" />
            รายงานผลรายบุคคล
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            จัดการไฟล์ ปพ.6
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><ScoreOverviewTab /></TabsContent>
        <TabsContent value="individual"><ReportCardPage embedded /></TabsContent>
        <TabsContent value="files"><FileTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Pp6Page;
