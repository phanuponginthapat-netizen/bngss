import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText } from "lucide-react";
import { formatFullName } from "@/lib/nameFormat";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { openPrintWindow, currentThaiDate, formatThaiDate } from "@/lib/printUtils";
import { printByCode } from "@/lib/printTemplate";
import { buildHeader, buildTable, buildSignatures, wrapA4Page } from "@/lib/obecReportBuilder";

const Pp3Page = () => {
  const { lang } = useLanguage();
  const { currentAcademicYear } = useAcademicYear();
  const schoolInfo = useSchoolInfo();
  const [graduationLevel, setGraduationLevel] = useState("ป.6");
  const [graduationYear, setGraduationYear] = useState<string>("all");
  const [graduates, setGraduates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const L = (th: string, en: string) => lang === "th" ? th : en;

  const gradeLevels = ["อ.3", "ป.6", "ม.3", "ม.6"];

  // ย้อนหลังได้แค่ 3 ปี (สอดคล้องระบบศิษย์เก่า)
  const yearOptionsBE = useMemo(() => {
    if (!currentAcademicYear) return [];
    return [0, 1, 2, 3].map((i) => currentAcademicYear - i);
  }, [currentAcademicYear]);

  useEffect(() => {
    const fetchGraduates = async () => {
      setLoading(true);
      let q = supabase
        .from("students")
        .select("*")
        .eq("status", "graduated")
        .eq("graduation_level", graduationLevel);
      if (graduationYear !== "all") q = q.eq("graduation_year", parseInt(graduationYear));
      const { data } = await q.order("student_code");
      setGraduates(data || []);
      setLoading(false);
    };
    fetchGraduates();
  }, [graduationLevel, graduationYear]);

  const handlePrint = async () => {
    const genderTh = (g?: string) => g === "male" || g === "ชาย" ? "ชาย" : g === "female" || g === "หญิง" ? "หญิง" : "-";
    const formatNationalId = (n?: string) => n ? n.replace(/(\d)(\d{4})(\d{5})(\d{2})(\d)/, "$1-$2-$3-$4-$5") : "-";
    const rows = graduates.map((s: any, i: number) => [
      String(i + 1),
      formatNationalId(s.national_id),
      s.student_code || "-",
      formatFullName(s.prefix, s.first_name, s.last_name),
      s.date_of_birth ? formatThaiDate(s.date_of_birth) : "-",
      genderTh(s.gender),
      s.graduation_date ? formatThaiDate(s.graduation_date) : (s.graduation_year ? `${s.graduation_year}` : "-"),
      s.graduation_gpa ? Number(s.graduation_gpa).toFixed(2) : "-",
      "",
    ]);
    const tableHtml = buildTable(
      [
        { label: "ลำดับ\nที่", align: "center", width: "5%" },
        { label: "เลขประจำตัว\nประชาชน", align: "center", width: "14%" },
        { label: "เลขประจำตัว\nนักเรียน", align: "center", width: "10%" },
        { label: "ชื่อ-สกุล", align: "left", width: "22%" },
        { label: "วัน เดือน ปีเกิด", align: "center", width: "12%" },
        { label: "เพศ", align: "center", width: "6%" },
        { label: "วันที่อนุมัติจบ", align: "center", width: "12%" },
        { label: "ผลการเรียน\nเฉลี่ย", align: "center", width: "9%" },
        { label: "หมายเหตุ", align: "left", width: "10%" },
      ],
      rows,
    );
    const header = buildHeader({
      schoolName: schoolInfo.school_name,
      schoolAddress: schoolInfo.school_address,
      garudaUrl: schoolInfo.garuda_emblem,
      sealUrl: schoolInfo.school_seal,
      logoUrl: schoolInfo.school_logo,
      documentTitle: "แบบรายงานผู้สำเร็จการศึกษา (ปพ.๓)",
      subtitle: `ระดับชั้น ${graduationLevel}${graduationYear !== "all" ? ` ปีการศึกษา ${graduationYear}` : ""}`,
      docRef: "ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑",
    });
    const sig = buildSignatures(
      [
        { title: "นายทะเบียน" },
        { name: schoolInfo.director_name, title: schoolInfo.director_title || "ผู้อำนวยการโรงเรียน", signatureUrl: schoolInfo.director_signature },
      ],
      currentThaiDate(),
    );
    const summary = `<div class="obec-body" style="margin:8pt 0">จำนวนผู้สำเร็จการศึกษาทั้งสิ้น <strong>${graduates.length}</strong> คน</div>`;
    const html = wrapA4Page(header + summary + tableHtml + sig);
    const tplData = { school: schoolInfo, level: graduationLevel, year: graduationYear, graduates };
    await printByCode("pp3", tplData, () => openPrintWindow(html, { title: `ปพ.3 ${graduationLevel}`, landscape: true }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {L("ปพ.3 (แบบรายงานผู้สำเร็จการศึกษา)", "PP.3 (Graduation Report)")}
        </h1>
        <div className="flex items-center gap-2">
          <Select value={graduationYear} onValueChange={setGraduationYear}>
            <SelectTrigger className="w-44"><SelectValue placeholder={L("ปีการศึกษา","Year")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("ทุกปีการศึกษา","All years")}</SelectItem>
              {yearOptionsBE.map((y) => (
                <SelectItem key={y} value={String(y)}>{L(`ปีการศึกษา ${y}`, `Year ${y}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={graduationLevel} onValueChange={setGraduationLevel}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} size="sm" variant="outline">
            <Printer className="w-4 h-4 mr-1" /> {L("พิมพ์", "Print")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {L(`รายชื่อผู้สำเร็จการศึกษา ระดับชั้น ${graduationLevel}`, `Graduates - Grade ${graduationLevel}`)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : graduates.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{L("ไม่พบข้อมูลผู้จบการศึกษา", "No graduates found")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{L("ลำดับ", "#")}</TableHead>
                  <TableHead>{L("รหัสนักเรียน", "Student Code")}</TableHead>
                  <TableHead>{L("ชื่อ-นามสกุล", "Full Name")}</TableHead>
                  <TableHead>{L("ปีที่จบ", "Year")}</TableHead>
                  <TableHead>{L("GPA", "GPA")}</TableHead>
                  <TableHead>{L("สถานะ", "Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {graduates.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{s.student_code}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{formatFullName(s.prefix, s.first_name, s.last_name)}</TableCell>
                    <TableCell>{s.graduation_year || "-"}</TableCell>
                    <TableCell>{s.graduation_gpa || "-"}</TableCell>
                    <TableCell><Badge variant="default">{L("จบแล้ว", "Graduated")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Pp3Page;
