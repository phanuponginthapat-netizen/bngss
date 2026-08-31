import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer } from "lucide-react";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import StudentSelector from "@/components/documents/StudentSelector";
import { openPrintWindow, currentThaiDate } from "@/lib/printUtils";
import { formatFullNameHtml, formatFullName, formatFullNamePlain } from "@/lib/nameFormat";
import { BE_OFFSET } from "@/lib/dateBE";
import { useStudentsWithClass } from "@/hooks/useStudentsWithClass";
import ClassBookletDialog from "@/components/academic/ClassBookletDialog";


const ReportCardPage = ({ embedded = false }: { embedded?: boolean }) => {
  const [studentCode, setStudentCode] = useState("");
  const [semester, setSemester] = useState("1");
  const [academicYear] = useState(String(new Date().getFullYear() + BE_OFFSET));
  const schoolInfo = useSchoolInfo();

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms_for_selector"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });
  const { data: students = [] } = useStudentsWithClass();
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => { const { data } = await supabase.from("subjects").select("*"); return data || []; } });
  const { data: scores = [] } = useQuery({
    queryKey: ["report_scores", studentCode, semester],
    queryFn: async () => {
      if (!studentCode) return [];
      let q = supabase.from("student_scores").select("*").eq("student_code", studentCode);
      if (semester) q = q.eq("semester", parseInt(semester));
      const { data } = await q;
      return data || [];
    },
    enabled: !!studentCode,
  });

  const student = students.find((s: any) => s.student_code === studentCode);

  const { data: assessmentScores = [] } = useQuery({
    queryKey: ["report_assessments", studentCode, semester],
    queryFn: async () => {
      if (!studentCode || !student) return [];
      const { data } = await supabase.from("student_assessment_scores")
        .select("*, assessment_criteria(*)")
        .eq("student_id", student.id)
        .eq("semester", parseInt(semester));
      return data || [];
    },
    enabled: !!studentCode && !!student,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["report_attendance", studentCode, semester],
    queryFn: async () => {
      if (!studentCode || !student) return [];
      const { data } = await supabase.from("attendance").select("*").eq("student_id", student.id).eq("semester", parseInt(semester));
      return data || [];
    },
    enabled: !!studentCode && !!student,
  });

  const getSubject = (sid: string) => subjects.find((s: any) => s.id === sid);
  const totalCredits = scores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (sub?.credits || 0); }, 0);
  const totalGP = scores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (s.grade_point || 0) * (sub?.credits || 0); }, 0);
  const gpa = totalCredits > 0 ? (totalGP / totalCredits).toFixed(2) : "0.00";

  const presentDays = attendance.filter((a: any) => a.status === "present").length;
  const totalDays = attendance.length;

  const competencyScores = assessmentScores.filter((a: any) => a.assessment_criteria?.category === "competency");
  const desirableScores = assessmentScores.filter((a: any) => a.assessment_criteria?.category === "desirable");
  const readingScores = assessmentScores.filter((a: any) => a.assessment_criteria?.category === "reading");

  const levelLabel = (level: string) => {
    switch (level) {
      case "excellent": return "ดีเยี่ยม";
      case "good": return "ดี";
      case "moderate": return "ผ่าน";
      case "needs_improvement": return "ไม่ผ่าน";
      default: return level || "-";
    }
  };

  const handlePrint = async () => {
    if (!student) return;
    const { printByCode } = await import("@/lib/printTemplate");
    const cls = (student as any).classrooms;

    const buildAssessmentTable = (title: string, data: any[]) => {
      if (data.length === 0) return "";
      return `
        <div class="obec-subsection-title">${title}</div>
        <table class="obec-table">
          <thead><tr><th>รายการประเมิน</th><th class="center" style="width:100px;">ระดับ</th></tr></thead>
          <tbody>
            ${data.map((a: any) => `
              <tr><td>${a.assessment_criteria?.title || ""}</td><td class="center"><span class="obec-grade">${levelLabel(a.level)}</span></td></tr>
            `).join("")}
          </tbody>
        </table>
      `;
    };

    const html = `
      <div class="obec-header">
        <div class="header-emblem">
          ${schoolInfo.school_logo ? `<img src="${schoolInfo.school_logo}" alt="Logo" />` : ""}
        </div>
        <div class="school-name">${schoolInfo.school_name}</div>
        ${schoolInfo.school_address ? `<div class="school-address">${schoolInfo.school_address}</div>` : ""}
        <div class="doc-title">สมุดรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)</div>
        <div class="doc-subtitle">ภาคเรียนที่ ${semester} ปีการศึกษา ${academicYear}</div>
      </div>

      <div class="obec-info-box">
        <div class="obec-info-grid">
          <div><span class="info-label">ชื่อ-สกุล: </span><span class="info-value">${formatFullNameHtml(student.prefix, student.first_name, student.last_name)}</span></div>
          <div><span class="info-label">เลขประจำตัว: </span><span class="info-value">${student.student_code}</span></div>
          ${cls ? `<div><span class="info-label">ชั้น: </span><span class="info-value">${cls.grade_level} - ${cls.name}</span></div>` : ""}
          ${cls?.homeroom_teacher ? `<div><span class="info-label">ครูประจำชั้น: </span><span class="info-value">${cls.homeroom_teacher}</span></div>` : ""}
        </div>
      </div>

      ${totalDays > 0 ? `
        <div class="obec-att-box">
          <strong>สรุปเวลาเรียน:</strong> มาเรียน ${presentDays}/${totalDays} วัน (${((presentDays / totalDays) * 100).toFixed(1)}%)
        </div>
      ` : ""}

      <div class="obec-section-title">ส่วนที่ 1: ผลการเรียน</div>
      <table class="obec-table">
        <thead>
          <tr><th>รหัสวิชา</th><th>รายวิชา</th><th class="center">หน่วยกิต</th><th class="center">กลางภาค</th><th class="center">ปลายภาค</th><th class="center">รวม</th><th class="center">เกรด</th></tr>
        </thead>
        <tbody>
          ${scores.length > 0 ? scores.map((s: any) => {
            const sub = getSubject(s.subject_id);
            return `<tr>
              <td class="mono">${sub?.code || ""}</td>
              <td>${sub?.name_th || ""}</td>
              <td class="center">${sub?.credits || ""}</td>
              <td class="center">${s.midterm_score ?? ""}</td>
              <td class="center">${s.final_score ?? ""}</td>
              <td class="center bold">${s.total_score ?? ""}</td>
              <td class="center"><span class="obec-grade">${s.grade || "-"}</span></td>
            </tr>`;
          }).join("") : '<tr><td colspan="7" class="center" style="padding:16px; color:#999;">ไม่มีข้อมูลผลการเรียน</td></tr>'}
        </tbody>
      </table>

      <div class="obec-summary-box">
        <div><span class="summary-label">หน่วยกิตรวม: </span><span class="summary-value">${totalCredits}</span></div>
        <div><span class="summary-label">GPA ภาคเรียนนี้: </span><span class="summary-value">${gpa}</span></div>
      </div>

      ${buildAssessmentTable("ส่วนที่ 2: สมรรถนะสำคัญของผู้เรียน", competencyScores)}
      ${buildAssessmentTable("ส่วนที่ 3: คุณลักษณะอันพึงประสงค์", desirableScores)}
      ${buildAssessmentTable("ส่วนที่ 4: การอ่าน คิดวิเคราะห์ และเขียน", readingScores)}

      <div class="obec-section-title">ความเห็นครูที่ปรึกษา</div>
      <div class="obec-comment-box">
        .........................................................................................................................
      </div>

      <div class="obec-signatures">
        <div class="obec-sig-grid-3">
          <div class="obec-sig-item">
            <div class="obec-sig-line"></div>
            <div class="obec-sig-title">(ครูที่ปรึกษา)</div>
          </div>
          <div class="obec-sig-item">
            <div class="obec-sig-line"></div>
            <div class="obec-sig-title">(ผู้ปกครอง)</div>
          </div>
          <div class="obec-sig-item">
            <div class="obec-sig-line"></div>
            <div class="obec-sig-name">${schoolInfo.director_name ? `(${schoolInfo.director_name})` : "(ลงชื่อ)"}</div>
            <div class="obec-sig-title">${schoolInfo.director_title}</div>
          </div>
        </div>
      </div>
    `;
    const tplData = { school: schoolInfo, student, class: (student as any).classrooms, today: new Date().toISOString() };
    const used = await printByCode("report_card", tplData);
    if (!used) openPrintWindow(html, { title: `ปพ.6 - ${formatFullNamePlain(undefined, student.first_name, student.last_name)}` });
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">สมุดรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)</h1>
            <p className="text-sm text-muted-foreground">รายงานผลการเรียน คุณลักษณะ และสมรรถนะ รายภาคเรียน</p>
          </div>
          <div className="flex items-center gap-2">
            {studentCode && <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />พิมพ์เอกสาร</Button>}
            <ClassBookletDialog kind="pp6" school={schoolInfo} defaultSemester={semester} />
          </div>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end gap-2">
          {studentCode && <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />พิมพ์เอกสาร</Button>}
          <ClassBookletDialog kind="pp6" school={schoolInfo} defaultSemester={semester} />
        </div>
      )}


      <div className="flex flex-wrap gap-3 items-end">
        <StudentSelector students={students} classrooms={classrooms} studentCode={studentCode} onStudentChange={setStudentCode} />
        <div className="w-[150px]">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
              <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {studentCode && student && (
        <Card className="border shadow-sm">
          <CardContent className="p-8">
            <div className="text-center border-b border-b-foreground/20 pb-4 mb-4">
              <h1 className="text-xl font-bold">สมุดรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.6)</h1>
              <p className="text-sm text-muted-foreground">ภาคเรียนที่ {semester} ปีการศึกษา {academicYear}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">ชื่อ-สกุล: </span><span className="font-medium whitespace-pre-wrap">{formatFullName(student.prefix, student.first_name, student.last_name)}</span></div>
              <div><span className="text-muted-foreground">เลขประจำตัว: </span><span className="font-mono font-medium">{student.student_code}</span></div>
              {(student as any).classrooms && (
                <>
                  <div><span className="text-muted-foreground">ชั้น: </span><span className="font-medium">{(student as any).classrooms.grade_level} - {(student as any).classrooms.name}</span></div>
                  {(student as any).classrooms.homeroom_teacher && (
                    <div><span className="text-muted-foreground">ครูประจำชั้น: </span><span className="font-medium">{(student as any).classrooms.homeroom_teacher}</span></div>
                  )}
                </>
              )}
            </div>

            {totalDays > 0 && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
                <span className="text-muted-foreground">สรุปเวลาเรียน: </span>
                <span className="font-medium">มาเรียน {presentDays}/{totalDays} วัน ({((presentDays / totalDays) * 100).toFixed(1)}%)</span>
              </div>
            )}

            <h3 className="font-bold text-foreground mt-6 mb-3">ส่วนที่ 1: ผลการเรียน</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-20">รหัสวิชา</TableHead>
                  <TableHead>รายวิชา</TableHead>
                  <TableHead className="text-center w-16">หน่วยกิต</TableHead>
                  <TableHead className="text-center w-16">กลางภาค</TableHead>
                  <TableHead className="text-center w-16">ปลายภาค</TableHead>
                  <TableHead className="text-center w-16">รวม</TableHead>
                  <TableHead className="text-center w-16">เกรด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((s: any) => { const sub = getSubject(s.subject_id); return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{sub?.code}</TableCell>
                    <TableCell>{sub?.name_th}</TableCell>
                    <TableCell className="text-center">{sub?.credits}</TableCell>
                    <TableCell className="text-center">{s.midterm_score}</TableCell>
                    <TableCell className="text-center">{s.final_score}</TableCell>
                    <TableCell className="text-center font-bold">{s.total_score}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline">{s.grade || "-"}</Badge></TableCell>
                  </TableRow>
                ); })}
                {scores.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground">ไม่มีข้อมูลผลการเรียน</TableCell></TableRow>}
              </TableBody>
            </Table>

            <div className="mt-4 p-4 bg-muted/30 rounded-lg flex gap-8">
              <div><span className="text-sm text-muted-foreground">หน่วยกิตรวม: </span><span className="font-bold">{totalCredits}</span></div>
              <div><span className="text-sm text-muted-foreground">GPA ภาคเรียนนี้: </span><span className="font-bold text-primary text-lg">{gpa}</span></div>
            </div>

            {[
              { title: "ส่วนที่ 2: สมรรถนะสำคัญของผู้เรียน", data: competencyScores },
              { title: "ส่วนที่ 3: คุณลักษณะอันพึงประสงค์", data: desirableScores },
              { title: "ส่วนที่ 4: การอ่าน คิดวิเคราะห์ และเขียน", data: readingScores },
            ].map(section => (
              <div key={section.title}>
                <h3 className="font-bold text-foreground mt-8 mb-3">{section.title}</h3>
                {section.data.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow className="bg-muted/50"><TableHead>รายการประเมิน</TableHead><TableHead className="text-center w-24">ระดับ</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {section.data.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{a.assessment_criteria?.title}</TableCell>
                          <TableCell className="text-center"><Badge variant="outline">{levelLabel(a.level)}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลการประเมิน</p>}
              </div>
            ))}

            <h3 className="font-bold text-foreground mt-8 mb-3">ความเห็นครูที่ปรึกษา</h3>
            <div className="border border-border rounded-lg p-4 min-h-[80px] text-sm text-muted-foreground">
              .........................................................................................................................
            </div>

            <div className="mt-12 pt-8 flex justify-around">
              <div className="text-center">
                <div className="w-36 border-b border-foreground/60 mb-2 mx-auto" />
                <p className="text-xs text-muted-foreground">(ครูที่ปรึกษา)</p>
              </div>
              <div className="text-center">
                <div className="w-36 border-b border-foreground/60 mb-2 mx-auto" />
                <p className="text-xs text-muted-foreground">(ผู้ปกครอง)</p>
              </div>
              <div className="text-center">
                <div className="w-40 border-b border-foreground/60 mb-2 mx-auto" />
                <p className="text-xs text-muted-foreground">({schoolInfo.director_title || "ผู้อำนวยการโรงเรียน"})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportCardPage;
