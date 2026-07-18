import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer } from "lucide-react";
import { useSchoolInfo, signatureImgHtml } from "@/components/documents/DocumentHeader";
import { SignatureBlock } from "@/components/documents/SignatureBlock";
import StudentSelector from "@/components/documents/StudentSelector";
import { openPrintWindow, currentThaiDate } from "@/lib/printUtils";
import { ExportMenu } from "@/components/academic/ExportMenu";
import { exportPP7Sgs, exportPP7SchoolMis } from "@/lib/exporters/pp7Certificate";

const Pp7Page = () => {
  const [studentCode, setStudentCode] = useState("");
  const [purpose, setPurpose] = useState("สมัครเรียนต่อ");
  const schoolInfo = useSchoolInfo();

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms_for_selector"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });
  const { data: students = [] } = useQuery({ queryKey: ["students_with_class"], queryFn: async () => { const { data } = await supabase.from("students").select("*, classrooms!students_classroom_id_fkey(*)").eq("status", "active").order("student_code"); return data || []; } });
  const { data: scores = [] } = useQuery({
    queryKey: ["pp7_scores", studentCode],
    queryFn: async () => {
      if (!studentCode) return [];
      const { data } = await supabase.from("student_scores").select("*").eq("student_code", studentCode);
      return data || [];
    },
    enabled: !!studentCode,
  });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => { const { data } = await supabase.from("subjects").select("*"); return data || []; } });

  const student = students.find((s: any) => s.student_code === studentCode);
  const getSubject = (sid: string) => subjects.find((s: any) => s.id === sid);
  const totalCredits = scores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (sub?.credits || 0); }, 0);
  const totalGP = scores.reduce((a: number, s: any) => { const sub = getSubject(s.subject_id); return a + (s.grade_point || 0) * (sub?.credits || 0); }, 0);
  const gpa = totalCredits > 0 ? (totalGP / totalCredits).toFixed(2) : "0.00";

  const { data: assessmentScores = [] } = useQuery({
    queryKey: ["pp7_assessments", student?.id],
    queryFn: async () => {
      if (!student) return [];
      const { data } = await supabase.from("student_assessment_scores")
        .select("*, assessment_criteria(*)")
        .eq("student_id", student.id);
      return data || [];
    },
    enabled: !!student,
  });

  const assessmentPassed = assessmentScores.length > 0 && assessmentScores.every((a: any) => a.level !== "needs_improvement");

  const handlePrint = () => {
    if (!student) return;
    const cls = (student as any).classrooms;

    const html = `
      <div class="obec-header">
        <div class="header-emblem">
          ${schoolInfo.garuda_emblem ? `<img src="${schoolInfo.garuda_emblem}" alt="ตราครุฑ" />` : ""}
        </div>
        <div class="school-name">${schoolInfo.school_name}</div>
        ${schoolInfo.school_address ? `<div class="school-address">${schoolInfo.school_address}</div>` : ""}
        <div class="doc-title">ใบรับรองผลการศึกษา (ปพ.7)</div>
      </div>

      <div class="obec-body" style="margin-top:24px;">
        <p class="obec-indent">หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า</p>
        
        <div class="obec-info-box" style="margin:16px 0 16px 32px;">
          <div class="obec-info-single">
            <p><span class="info-label">ชื่อ-สกุล: </span><strong>${student.prefix || ""}${student.first_name} ${student.last_name}</strong></p>
            <p><span class="info-label">เลขประจำตัว: </span><strong>${student.student_code}</strong></p>
            ${cls ? `<p><span class="info-label">ชั้น: </span><strong>${cls.grade_level} - ${cls.name}</strong></p>` : ""}
            <p><span class="info-label">สถานะ: </span><strong>${student.status === "active" ? "กำลังศึกษาอยู่" : "สำเร็จการศึกษา"}</strong></p>
          </div>
        </div>

        <p class="obec-indent">เป็นนักเรียนของ${schoolInfo.school_name} ${schoolInfo.school_address ? `ตั้งอยู่ ${schoolInfo.school_address}` : ""}</p>

        ${scores.length > 0 ? `
          <p class="obec-indent" style="margin-top:10px;">มีผลการเรียนเฉลี่ยสะสม (GPA) เท่ากับ <strong style="font-size:18px;">${gpa}</strong> จากหน่วยกิตรวม <strong>${totalCredits}</strong> หน่วยกิต</p>
        ` : ""}

        ${assessmentScores.length > 0 ? `
          <p class="obec-indent" style="margin-top:10px;">ผลการประเมินคุณลักษณะและสมรรถนะ:</p>
          <div style="margin-left:64px; margin-top:8px; line-height:2;">
            <p>• สมรรถนะสำคัญของผู้เรียน: <span class="obec-grade">${assessmentPassed ? "ผ่าน" : "ไม่ผ่าน"}</span></p>
            <p>• คุณลักษณะอันพึงประสงค์: <span class="obec-grade">${assessmentPassed ? "ผ่าน" : "ไม่ผ่าน"}</span></p>
            <p>• การอ่าน คิดวิเคราะห์ และเขียน: <span class="obec-grade">${assessmentPassed ? "ผ่าน" : "ไม่ผ่าน"}</span></p>
          </div>
        ` : ""}

        <p class="obec-indent" style="margin-top:16px;">ออกใบรับรองฉบับนี้ให้เพื่อประกอบการ${purpose}</p>
      </div>

      <div class="obec-signatures">
        <div class="obec-sig-row">
          <div class="obec-sig-item">
            <div class="obec-sig-line"></div>
            <div class="obec-sig-title">(นายทะเบียน)</div>
          </div>
          <div class="obec-sig-item">
            ${signatureImgHtml(schoolInfo.director_signature_url, 44)}
            <div class="obec-sig-line"></div>
            <div class="obec-sig-name">${schoolInfo.director_name ? `(${schoolInfo.director_name})` : "(ลงชื่อ)"}</div>
            <div class="obec-sig-title">${schoolInfo.director_title}</div>
          </div>
        </div>
        <div class="obec-date">วันที่ ${currentThaiDate()}</div>
      </div>
    `;
    openPrintWindow(html, { title: `ปพ.7 - ${student.first_name} ${student.last_name}` });
  };

  const pp7Row = student ? [{
    student_code: student.student_code,
    prefix: student.prefix, first_name: student.first_name, last_name: student.last_name,
    classroom: (student as any).classrooms ? `${(student as any).classrooms.grade_level} ${(student as any).classrooms.name}` : "",
    status: student.status === "active" ? "กำลังศึกษาอยู่" : "สำเร็จการศึกษา",
    gpa, total_credits: totalCredits, purpose, national_id: student.national_id,
  }] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ใบรับรองผลการศึกษา (ปพ.7)</h1>
          <p className="text-sm text-muted-foreground">ใบรับรองผลการศึกษาสำหรับใช้ประกอบการสมัครเรียนต่อหรืออื่นๆ</p>
        </div>
        {studentCode && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />พิมพ์เอกสาร</Button>
            <ExportMenu
              templateCode="pp7"
              templateTitle="ปพ.7 — ใบรับรองผลการเรียน"
              actions={[
                { key: "sgs", label: "Excel (SGS)", icon: "xlsx", onClick: () => exportPP7Sgs(schoolInfo as any, pp7Row) },
                { key: "smis", label: "Excel (SchoolMIS)", icon: "xlsx", onClick: () => exportPP7SchoolMis(schoolInfo as any, pp7Row) },
              ]}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 items-end">
        <StudentSelector students={students} classrooms={classrooms} studentCode={studentCode} onStudentChange={setStudentCode} />
        <div className="w-[250px]">
          <Label className="text-xs mb-1 block">วัตถุประสงค์</Label>
          <Input value={purpose} onChange={e => setPurpose(e.target.value)} />
        </div>
      </div>

      {studentCode && student && (
        <Card className="max-w-2xl mx-auto border shadow-sm">
          <CardContent className="p-8">
            <div className="text-center border-b border-b-foreground/20 pb-4 mb-6">
              <h1 className="text-xl font-bold">{schoolInfo.school_name}</h1>
              {schoolInfo.school_address && <p className="text-xs text-muted-foreground">{schoolInfo.school_address}</p>}
              <h2 className="text-lg font-bold mt-3">ใบรับรองผลการศึกษา (ปพ.7)</h2>
            </div>

            <div className="mt-8 text-sm leading-relaxed space-y-4 text-foreground">
              <p className="indent-8">หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า</p>
              <div className="pl-8 space-y-1">
                <p><span className="text-muted-foreground">ชื่อ-สกุล: </span><span className="font-bold">{student.prefix}{student.first_name} {student.last_name}</span></p>
                <p><span className="text-muted-foreground">เลขประจำตัว: </span><span className="font-mono">{student.student_code}</span></p>
                {(student as any).classrooms && (
                  <p><span className="text-muted-foreground">ชั้น: </span><span>{(student as any).classrooms.grade_level} - {(student as any).classrooms.name}</span></p>
                )}
                <p><span className="text-muted-foreground">สถานะ: </span><span>{student.status === 'active' ? 'กำลังศึกษาอยู่' : 'สำเร็จการศึกษา'}</span></p>
              </div>
              <p className="indent-8">เป็นนักเรียนของ{schoolInfo.school_name} {schoolInfo.school_address ? `ตั้งอยู่ ${schoolInfo.school_address}` : ''}</p>
              {scores.length > 0 && (
                <p className="indent-8">มีผลการเรียนเฉลี่ยสะสม (GPA) เท่ากับ <span className="font-bold text-primary">{gpa}</span> จากหน่วยกิตรวม {totalCredits} หน่วยกิต</p>
              )}
              {assessmentScores.length > 0 && (
                <div className="indent-8 space-y-2">
                  <p>ผลการประเมินคุณลักษณะและสมรรถนะ:</p>
                  <div className="pl-4 space-y-1">
                    <p>• สมรรถนะสำคัญของผู้เรียน: <Badge variant="outline">{assessmentPassed ? "ผ่าน" : "ไม่ผ่าน"}</Badge></p>
                    <p>• คุณลักษณะอันพึงประสงค์: <Badge variant="outline">{assessmentPassed ? "ผ่าน" : "ไม่ผ่าน"}</Badge></p>
                    <p>• การอ่าน คิดวิเคราะห์ และเขียน: <Badge variant="outline">{assessmentPassed ? "ผ่าน" : "ไม่ผ่าน"}</Badge></p>
                  </div>
                </div>
              )}
              <p className="indent-8">ออกใบรับรองฉบับนี้ให้เพื่อประกอบการ{purpose}</p>
            </div>

            <div className="mt-12 pt-8 flex justify-around">
              <div className="text-center">
                <div className="w-36 border-b border-foreground/60 mb-2 mx-auto" />
                <p className="text-xs text-muted-foreground">(นายทะเบียน)</p>
              </div>
              <SignatureBlock size="md" fallbackPosition={schoolInfo.director_title} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Pp7Page;
