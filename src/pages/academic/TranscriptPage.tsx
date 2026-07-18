import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer } from "lucide-react";
import StudentSelector from "@/components/documents/StudentSelector";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { openPrintWindow, currentThaiDate } from "@/lib/printUtils";
import { formatFullNameHtml, formatFullName, formatFullNamePlain } from "@/lib/nameFormat";
import { BE_OFFSET } from "@/lib/dateBE";
import { useStudentsWithClass } from "@/hooks/useStudentsWithClass";

const TranscriptPage = () => {
  const { lang } = useLanguage();
  const [studentCode, setStudentCode] = useState("");
  const schoolInfo = useSchoolInfo();

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms_for_selector"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });
  const { data: students = [] } = useStudentsWithClass();
  const { data: scores = [] } = useQuery({
    queryKey: ["transcript_scores", studentCode],
    queryFn: async () => {
      if (!studentCode) return [];
      const { data } = await supabase.from("student_scores").select("*").eq("student_code", studentCode).order("academic_year").order("semester");
      return data || [];
    },
    enabled: !!studentCode,
  });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => { const { data } = await supabase.from("subjects").select("*"); return data || []; } });

  const student = students.find((s: any) => s.student_code === studentCode);
  const { data: assessmentScores = [] } = useQuery({
    queryKey: ["transcript_assessments", student?.id],
    queryFn: async () => {
      if (!student) return [];
      const { data } = await supabase.from("student_assessment_scores")
        .select("*, assessment_criteria(*)")
        .eq("student_id", student.id)
        .order("semester");
      return data || [];
    },
    enabled: !!student,
  });

  const getSubject = (sid: string) => subjects.find((s: any) => s.id === sid);
  const totalCredits = scores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (sub?.credits || 0); }, 0);
  const totalGradePoints = scores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (s.grade_point || 0) * (sub?.credits || 0); }, 0);
  const gpa = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : "0.00";

  const groupedScores: Record<string, any[]> = {};
  scores.forEach((s: any) => {
    const key = `${(s.academic_year || 0) + BE_OFFSET}/${s.semester}`;
    if (!groupedScores[key]) groupedScores[key] = [];
    groupedScores[key].push(s);
  });

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

    let semesterTablesHtml = "";
    Object.entries(groupedScores).forEach(([key, semScores]) => {
      const semCredits = semScores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (sub?.credits || 0); }, 0);
      const semGP = semScores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (s.grade_point || 0) * (sub?.credits || 0); }, 0);
      const semGPA = semCredits > 0 ? (semGP / semCredits).toFixed(2) : "0.00";

      semesterTablesHtml += `
        <div class="obec-subsection-title">ปีการศึกษา ${key.replace("/", " ภาคเรียนที่ ")}</div>
        <table class="obec-table">
          <thead>
            <tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th class="center">ประเภท</th><th class="center">หน่วยกิต</th><th class="center">ผลการเรียน</th></tr>
          </thead>
          <tbody>
            ${semScores.map((s: any) => {
              const sub = getSubject(s.subject_id);
              return `<tr>
                <td class="mono">${sub?.code || ""}</td>
                <td>${sub?.name_th || ""}${sub?.name_en ? ` (${sub.name_en})` : ""}</td>
                <td class="center">${sub?.subject_type === "required" ? "พื้นฐาน" : "เพิ่มเติม"}</td>
                <td class="center">${sub?.credits || ""}</td>
                <td class="center"><span class="obec-grade">${s.grade || "-"}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr><td colspan="3" class="right">รวม</td><td class="center bold">${semCredits}</td><td class="center bold">GPA: ${semGPA}</td></tr>
          </tfoot>
        </table>
      `;
    });

    let assessmentHtml = "";
    if (assessmentScores.length > 0) {
      assessmentHtml = `
        <div class="obec-section-title">ผลการประเมินคุณลักษณะและสมรรถนะ</div>
        <table class="obec-table">
          <thead><tr><th>รายการ</th><th class="center">หมวด</th><th class="center">ภาคเรียน</th><th class="center">ระดับ</th></tr></thead>
          <tbody>
            ${assessmentScores.map((a: any) => `
              <tr>
                <td>${a.assessment_criteria?.title || ""}</td>
                <td class="center">${a.assessment_criteria?.category === "competency" ? "สมรรถนะ" : a.assessment_criteria?.category === "desirable" ? "คุณลักษณะ" : "อ่าน/คิด/เขียน"}</td>
                <td class="center">${a.semester || ""}</td>
                <td class="center"><span class="obec-grade">${levelLabel(a.level)}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    const html = `
      <div class="obec-header">
        <div class="header-emblem">
          ${schoolInfo.garuda_emblem ? `<img src="${schoolInfo.garuda_emblem}" alt="ตราครุฑ" />` : ""}
          ${schoolInfo.school_logo ? `<img src="${schoolInfo.school_logo}" alt="Logo" />` : ""}
        </div>
        <div class="school-name">${schoolInfo.school_name}</div>
        ${schoolInfo.school_address ? `<div class="school-address">${schoolInfo.school_address}</div>` : ""}
        <div class="doc-title">ระเบียนแสดงผลการเรียน (ปพ.1)</div>
        <div class="doc-subtitle">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</div>
      </div>

      <div class="obec-info-box">
        <div class="obec-info-grid">
          <div><span class="info-label">ชื่อ-สกุล: </span><span class="info-value">${formatFullNameHtml(student.prefix, student.first_name, student.last_name)}</span></div>
          <div><span class="info-label">เลขประจำตัว: </span><span class="info-value">${student.student_code}</span></div>
          ${cls ? `<div><span class="info-label">ชั้น/ห้อง: </span><span class="info-value">${cls.grade_level} - ${cls.name}</span></div>` : ""}
        </div>
      </div>

      ${semesterTablesHtml}

      ${scores.length === 0 ? '<p style="text-align:center; padding:24px; color:#999;">ไม่มีข้อมูลผลการเรียน</p>' : ""}

      ${assessmentHtml}

      <div class="obec-summary-box">
        <div><span class="summary-label">หน่วยกิตรวมตลอดหลักสูตร: </span><span class="summary-value">${totalCredits}</span></div>
        <div><span class="summary-label">ผลการเรียนเฉลี่ยสะสม (GPA): </span><span class="summary-value">${gpa}</span></div>
      </div>

      <div class="obec-signatures">
        <div class="obec-sig-row">
          <div class="obec-sig-item">
            <div class="obec-sig-line"></div>
            <div class="obec-sig-title">(นายทะเบียน)</div>
          </div>
          <div class="obec-sig-item">
            <div class="obec-sig-line"></div>
            <div class="obec-sig-name">${schoolInfo.director_name ? `(${schoolInfo.director_name})` : "(ลงชื่อ)"}</div>
            <div class="obec-sig-title">${schoolInfo.director_title}</div>
          </div>
        </div>
        <div class="obec-date">วันที่ ${currentThaiDate()}</div>
      </div>
    `;
    const tplData = { school: schoolInfo, student, class: (student as any).classrooms, groupedScores, today: new Date().toISOString() };
    const used = await printByCode("pp1", tplData);
    if (!used) openPrintWindow(html, { title: `ปพ.1 - ${formatFullNamePlain(undefined, student.first_name, student.last_name)}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ระเบียนแสดงผลการเรียน (ปพ.1)</h1>
          <p className="text-sm text-muted-foreground">แบบแสดงผลการเรียนตลอดหลักสูตร ครบทุกระดับชั้น</p>
        </div>
        {studentCode && <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />พิมพ์เอกสาร</Button>}
      </div>

      <StudentSelector students={students} classrooms={classrooms} studentCode={studentCode} onStudentChange={setStudentCode} />

      {studentCode && student && (
        <Card className="border shadow-sm">
          <CardContent className="p-8">
            <div className="text-center border-b border-b-foreground/20 pb-4 mb-4">
              <h1 className="text-xl font-bold">ระเบียนแสดงผลการเรียน (ปพ.1)</h1>
              <p className="text-sm text-muted-foreground">หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช 2551</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">ชื่อ-สกุล: </span><span className="font-medium whitespace-pre-wrap">{formatFullName(student.prefix, student.first_name, student.last_name)}</span></div>
              <div><span className="text-muted-foreground">เลขประจำตัว: </span><span className="font-mono font-medium">{student.student_code}</span></div>
              {(student as any).classrooms && (
                <div><span className="text-muted-foreground">ชั้น/ห้อง: </span><span className="font-medium">{(student as any).classrooms.grade_level} - {(student as any).classrooms.name}</span></div>
              )}
            </div>

            {Object.entries(groupedScores).map(([key, semScores]) => {
              const semCredits = semScores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (sub?.credits || 0); }, 0);
              const semGP = semScores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (s.grade_point || 0) * (sub?.credits || 0); }, 0);
              const semGPA = semCredits > 0 ? (semGP / semCredits).toFixed(2) : "0.00";
              return (
                <div key={key} className="mt-6">
                  <h3 className="font-bold text-sm mb-2 text-primary">ปีการศึกษา {key.replace("/", " ภาคเรียนที่ ")}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-24">รหัสวิชา</TableHead>
                        <TableHead>ชื่อวิชา</TableHead>
                        <TableHead className="text-center w-16">ประเภท</TableHead>
                        <TableHead className="text-center w-16">หน่วยกิต</TableHead>
                        <TableHead className="text-center w-16">ผลการเรียน</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {semScores.map((s: any) => { const sub = getSubject(s.subject_id); return (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{sub?.code}</TableCell>
                          <TableCell className="text-sm">{sub?.name_th}{sub?.name_en ? ` (${sub.name_en})` : ''}</TableCell>
                          <TableCell className="text-center text-xs">{sub?.subject_type === 'required' ? 'พื้นฐาน' : 'เพิ่มเติม'}</TableCell>
                          <TableCell className="text-center">{sub?.credits}</TableCell>
                          <TableCell className="text-center"><Badge variant="outline">{s.grade || "-"}</Badge></TableCell>
                        </TableRow>
                      ); })}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-1 text-right">หน่วยกิตรวม: {semCredits} | GPA: {semGPA}</p>
                </div>
              );
            })}

            {scores.length === 0 && <p className="text-center py-8 text-muted-foreground mt-6">ไม่มีข้อมูลผลการเรียน</p>}

            {assessmentScores.length > 0 && (
              <div className="mt-8">
                <h3 className="font-bold text-sm mb-3">ผลการประเมินคุณลักษณะและสมรรถนะ</h3>
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>รายการ</TableHead>
                      <TableHead>หมวด</TableHead>
                      <TableHead className="text-center">ภาคเรียน</TableHead>
                      <TableHead className="text-center">ระดับ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessmentScores.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.assessment_criteria?.title}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.assessment_criteria?.category === "competency" ? "สมรรถนะ" : a.assessment_criteria?.category === "desirable" ? "คุณลักษณะ" : "อ่าน/คิด/เขียน"}</Badge></TableCell>
                        <TableCell className="text-center">{a.semester}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{levelLabel(a.level)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="mt-6 p-4 bg-muted/30 rounded-lg flex gap-8 items-center">
              <div><span className="text-sm text-muted-foreground">หน่วยกิตรวมตลอดหลักสูตร: </span><span className="font-bold text-lg">{totalCredits}</span></div>
              <div><span className="text-sm text-muted-foreground">ผลการเรียนเฉลี่ยสะสม (GPA): </span><span className="font-bold text-primary text-xl">{gpa}</span></div>
            </div>

            <div className="mt-12 pt-8 flex justify-around">
              <div className="text-center">
                <div className="w-36 border-b border-foreground/60 mb-2 mx-auto" />
                <p className="text-xs text-muted-foreground">(นายทะเบียน)</p>
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

export default TranscriptPage;
