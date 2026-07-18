import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, BookOpen } from "lucide-react";
import { CardGridSkeleton } from "@/components/shared";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { openPrintWindow, currentThaiDate } from "@/lib/printUtils";
import { printByCode } from "@/lib/printTemplate";
import { buildHeader, buildTable, buildSignatures, buildSectionTitle, wrapA4Page } from "@/lib/obecReportBuilder";
import { BE_OFFSET } from "@/lib/dateBE";

const GRADE_LEVELS = ["อ.1","อ.2","อ.3","ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];

const Pp4Page = () => {
  const { lang } = useLanguage();
  const { currentAcademicYear } = useAcademicYear();
  const schoolInfo = useSchoolInfo();
  const [semester, setSemester] = useState("1");
  const [academicYearBE, setAcademicYearBE] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const L = (th: string, en: string) => lang === "th" ? th : en;

  // เลือกได้เฉพาะปีปัจจุบัน + ย้อนหลัง 3 ปี (สอดคล้องระบบศิษย์เก่า)
  const yearOptionsBE = useMemo(() => {
    if (!currentAcademicYear) return [];
    return [0, 1, 2, 3].map((i) => currentAcademicYear - i);
  }, [currentAcademicYear]);

  useEffect(() => {
    if (currentAcademicYear && academicYearBE == null) setAcademicYearBE(currentAcademicYear);
  }, [currentAcademicYear, academicYearBE]);

  const yearBE = academicYearBE ?? currentAcademicYear;

  useEffect(() => {
    if (!yearBE) return;
    const fetchSubjects = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .eq("semester", parseInt(semester))
        .eq("academic_year", yearBE - BE_OFFSET)
        .order("grade_level")
        .order("code");
      setSubjects(data || []);
      setLoading(false);
    };
    fetchSubjects();
  }, [semester, yearBE]);

  const byGrade = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const g of GRADE_LEVELS) map.set(g, []);
    for (const s of subjects) {
      const g = s.grade_level;
      if (!g) continue;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return map;
  }, [subjects]);

  const handlePrint = async () => {
    const sections = GRADE_LEVELS.map((g) => {
      const rows = byGrade.get(g) || [];
      if (rows.length === 0) return "";
      const tableHtml = buildTable(
        [
          { label: "ลำดับ", align: "center", width: "8%" },
          { label: "รหัสวิชา", align: "center", width: "14%" },
          { label: "ชื่อวิชา", align: "left" },
          { label: "หน่วยกิต", align: "center", width: "10%" },
          { label: "ชม./สัปดาห์", align: "center", width: "12%" },
          { label: "ครูผู้สอน", align: "left", width: "22%" },
        ],
        rows.map((s: any, i: number) => [
          String(i + 1),
          s.code || "-",
          s.name_th || s.name || "-",
          String(s.credits ?? "-"),
          String(s.hours_per_week ?? "-"),
          s.teacher_name || "-",
        ]),
      );
      return buildSectionTitle(`แผนการเรียน ${g} ภาคเรียนที่ ${semester} ปีการศึกษา ${yearBE}`) + tableHtml;
    }).join("");

    const header = buildHeader({
      schoolName: schoolInfo.school_name,
      schoolAddress: schoolInfo.school_address,
      logoUrl: schoolInfo.school_logo,
      garudaUrl: schoolInfo.garuda_emblem,
      documentTitle: "ปพ.4 แบบแสดงผลการเรียนรายวิชา",
      subtitle: `ภาคเรียนที่ ${semester} ปีการศึกษา ${yearBE}`,
    });
    const sig = buildSignatures([
      { name: schoolInfo.director_name, title: schoolInfo.director_title || "ผู้อำนวยการโรงเรียน", signatureUrl: schoolInfo.director_signature },
    ], currentThaiDate());

    const html = wrapA4Page(header + sections + sig);
    const tplData = { school: schoolInfo, semester, year: yearBE, sections_html: sections, today: new Date().toISOString() };
    await printByCode("pp4", tplData, () => openPrintWindow(html, { title: `ปพ.4 ${semester}/${yearBE}` }));
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          {L("ปพ.4 (แบบแสดงผลการเรียนรายวิชา) - ทุกระดับชั้น", "PP.4 (Course Record) - All Grades")}
        </h1>
        <div className="flex items-center gap-2">
          <Select value={String(yearBE ?? "")} onValueChange={(v) => setAcademicYearBE(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue placeholder={L("ปีการศึกษา","Year")} /></SelectTrigger>
            <SelectContent>
              {yearOptionsBE.map((y) => (
                <SelectItem key={y} value={String(y)}>{L(`ปีการศึกษา ${y}`, `Year ${y}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{L("ภาคเรียน 1", "Semester 1")}</SelectItem>
              <SelectItem value="2">{L("ภาคเรียน 2", "Semester 2")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} size="sm" variant="outline">
            <Printer className="w-4 h-4 mr-1" /> {L("พิมพ์", "Print")}
          </Button>
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : (
        GRADE_LEVELS.map((g) => {
          const rows = byGrade.get(g) || [];
          return (
            <Card key={g}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {L(`แผนการเรียน ${g} ภาคเรียนที่ ${semester} ปีการศึกษา ${yearBE}`,
                     `Course Plan ${g} Semester ${semester} Year ${yearBE}`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground text-sm">{L("ไม่พบข้อมูลรายวิชา", "No subjects found")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">{L("ลำดับ", "#")}</TableHead>
                        <TableHead>{L("รหัสวิชา", "Code")}</TableHead>
                        <TableHead>{L("ชื่อวิชา", "Subject Name")}</TableHead>
                        <TableHead className="text-center">{L("หน่วยกิต", "Credits")}</TableHead>
                        <TableHead className="text-center">{L("ชั่วโมง/สัปดาห์", "Hours/Week")}</TableHead>
                        <TableHead>{L("ครูผู้สอน", "Teacher")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((s, i) => (
                        <TableRow key={s.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-mono">{s.code}</TableCell>
                          <TableCell>{s.name_th || s.name}</TableCell>
                          <TableCell className="text-center">{s.credits || "-"}</TableCell>
                          <TableCell className="text-center">{s.hours_per_week || "-"}</TableCell>
                          <TableCell>{s.teacher_name || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default Pp4Page;
