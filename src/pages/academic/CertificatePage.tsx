import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Printer, FileDown } from "lucide-react";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import StudentSelector from "@/components/documents/StudentSelector";
import { openPrintWindow, formatThaiDate, currentThaiDate } from "@/lib/printUtils";
import { formatFullNameHtml, formatFullName, formatFullNamePlain } from "@/lib/nameFormat";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { useStudentsWithClass } from "@/hooks/useStudentsWithClass";

const CertificatePage = () => {
  const [studentCode, setStudentCode] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [gradeLevel, setGradeLevel] = useState("มัธยมศึกษาปีที่ 6");
  const schoolInfo = useSchoolInfo();

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms_for_selector"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });
  const { data: students = [] } = useStudentsWithClass();
  const student = students.find((s: any) => s.student_code === studentCode);

  const handlePrint = async () => {
    if (!student) return;
    const html = `
      <div class="obec-header">
        <div class="header-emblem">
          ${schoolInfo.garuda_emblem ? `<img src="${schoolInfo.garuda_emblem}" alt="ตราครุฑ" />` : ""}
          ${schoolInfo.school_seal ? `<img src="${schoolInfo.school_seal}" alt="ตราโรงเรียน" />` : ""}
        </div>
        <div class="school-name">${schoolInfo.school_name}</div>
        ${schoolInfo.school_address ? `<div class="school-address">${schoolInfo.school_address}</div>` : ""}
        <div class="doc-title">ประกาศนียบัตร</div>
        <div class="doc-subtitle">หลักฐานแสดงวุฒิการศึกษา (ปพ.2)</div>
        <div class="doc-ref">ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑</div>
      </div>

      <div class="obec-body" style="margin-top:40px; text-align:center;">
        <p style="font-size:16pt;">ประกาศนียบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</p>
        
        <div style="margin:30px 0; padding:16px 0; border-top:1px solid #999; border-bottom:1px solid #999;">
          <p style="font-size:18pt; font-weight:700;">${formatFullNameHtml(student.prefix, student.first_name, student.last_name)}</p>
          <p style="font-size:16pt; margin-top:4pt;">เลขประจำตัว ${student.student_code}</p>
        </div>

        <div style="font-size:16pt; line-height:1.5;">
          <p>ได้สำเร็จการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน</p>
          <p>พุทธศักราช ๒๕๕๑</p>
          <p style="font-weight:700; font-size:18pt;">ระดับชั้น${gradeLevel}</p>
          <p>จาก${schoolInfo.school_name}</p>
          ${completionDate ? `<p style="margin-top:8pt;">เมื่อวันที่ ${formatThaiDate(completionDate)}</p>` : ""}
        </div>

        ${schoolInfo.school_seal ? `
          <div class="obec-seal" style="margin:30px auto;">
            <img src="${schoolInfo.school_seal}" alt="ตราโรงเรียน" />
          </div>
        ` : `<div style="height:40px;"></div>`}
      </div>

      <div class="obec-signatures">
        <div class="obec-sig-row">
          <div class="obec-sig-item">
            <div class="obec-sig-line"></div>
            <div class="obec-sig-name">${schoolInfo.director_name ? `(${schoolInfo.director_name})` : "(ลงชื่อ)"}</div>
            <div class="obec-sig-title">${schoolInfo.director_title}</div>
          </div>
        </div>
        <div class="obec-date" style="margin-top:24px;">
          วันที่ ${currentThaiDate()}
        </div>
      </div>
    `;
    openPrintWindow(html, { title: `ปพ.2 - ${formatFullNamePlain(undefined, student.first_name, student.last_name)}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ประกาศนียบัตร (ปพ.2)</h1>
          <p className="text-sm text-muted-foreground">หลักฐานแสดงวุฒิการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน</p>
        </div>
        {studentCode && (
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />พิมพ์เอกสาร
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <StudentSelector students={students} classrooms={classrooms} studentCode={studentCode} onStudentChange={setStudentCode} />
        <div className="w-[200px]">
          <Label className="text-xs mb-1 block">ระดับที่สำเร็จ</Label>
          <Select value={gradeLevel} onValueChange={setGradeLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ประถมศึกษาปีที่ 6">ประถมศึกษาปีที่ 6</SelectItem>
              <SelectItem value="มัธยมศึกษาปีที่ 3">มัธยมศึกษาปีที่ 3</SelectItem>
              <SelectItem value="มัธยมศึกษาปีที่ 6">มัธยมศึกษาปีที่ 6</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Label className="text-xs mb-1 block">วันที่สำเร็จ</Label>
          <BEDatePicker value={completionDate} onChange={(v) => setCompletionDate(v)} />
        </div>
      </div>

      {studentCode && student && (
        <Card className="max-w-2xl mx-auto border shadow-sm">
          <CardContent className="p-10">
            <div className="text-center space-y-2 pb-4 border-b-2 border-foreground/20 mb-6">
              {schoolInfo.garuda_emblem && <img src={schoolInfo.garuda_emblem} alt="ตราครุฑ" className="object-contain mx-auto" style={{ width: '3cm', height: '3cm' }} />}
              <h1 className="text-xl font-bold">{schoolInfo.school_name}</h1>
              {schoolInfo.school_address && <p className="text-xs text-muted-foreground">{schoolInfo.school_address}</p>}
              <h2 className="text-lg font-bold pt-2">ประกาศนียบัตร</h2>
              <p className="text-sm text-muted-foreground">หลักฐานแสดงวุฒิการศึกษา (ปพ.2)</p>
            </div>

            <div className="mt-10 text-center space-y-6">
              <p className="text-sm text-muted-foreground">ประกาศนียบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</p>
              <div className="py-4 border-y border-border/50">
                <p className="text-2xl font-bold text-foreground whitespace-pre-wrap">{formatFullName(student.prefix, student.first_name, student.last_name)}</p>
                <p className="text-sm text-muted-foreground mt-1">เลขประจำตัว {student.student_code}</p>
              </div>
              <div className="space-y-2 text-sm text-foreground leading-relaxed">
                <p>ได้สำเร็จการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน</p>
                <p>พุทธศักราช 2551</p>
                <p className="font-semibold text-base">ระดับชั้น{gradeLevel}</p>
                <p>จาก{schoolInfo.school_name}</p>
                {completionDate && (
                  <p className="mt-2">เมื่อวันที่ {formatThaiDate(completionDate)}</p>
                )}
              </div>
            </div>

            <div className="mt-12 pt-8 text-center">
              <div className="w-40 border-b border-foreground/60 mb-2 mx-auto" />
              <p className="text-sm font-medium text-foreground">{schoolInfo.director_name ? `(${schoolInfo.director_name})` : "(ลงชื่อ)"}</p>
              <p className="text-xs text-muted-foreground">{schoolInfo.director_title}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CertificatePage;
