import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText } from "lucide-react";
import { formatFullName } from "@/lib/nameFormat";
import { ExportMenu } from "@/components/academic/ExportMenu";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { exportPP3Dmc, exportPP3SchoolMis, exportPP3Sgs, printPP3, type PP3Graduate } from "@/lib/exporters/pp3GraduationReport";


const Pp3Page = () => {
  const { lang } = useLanguage();
  const info = useSchoolInfo();
  const [graduationLevel, setGraduationLevel] = useState("ป.6");
  const [graduates, setGraduates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const L = (th: string, en: string) => lang === "th" ? th : en;

  const gradeLevels = ["ป.6", "ม.3", "ม.6"];

  const mapped: PP3Graduate[] = graduates.map((g) => ({
    student_code: g.student_code,
    prefix: g.prefix,
    first_name: g.first_name,
    last_name: g.last_name,
    national_id: g.national_id,
    birth_date: g.birth_date,
    graduation_year: g.graduation_year,
    graduation_level: g.graduation_level,
    graduation_gpa: g.graduation_gpa,
  }));


  useEffect(() => {
    const fetchGraduates = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("status", "graduated")
        .eq("graduation_level", graduationLevel)
        .order("student_code");
      setGraduates(data || []);
      setLoading(false);
    };
    fetchGraduates();
  }, [graduationLevel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {L("ปพ.3 (แบบรายงานผู้สำเร็จการศึกษา)", "PP.3 (Graduation Report)")}
        </h1>
        <div className="flex items-center gap-2">
          <Select value={graduationLevel} onValueChange={setGraduationLevel}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => printPP3(info, graduationLevel, mapped)} size="sm" variant="outline">
            <Printer className="w-4 h-4 mr-1" /> {L("พิมพ์/PDF", "Print/PDF")}
          </Button>
          <ExportMenu
            label={L("ส่งออก", "Export")}
            templateCode="pp3"
            templateTitle="ปพ.3 — แบบรายงานผู้สำเร็จการศึกษา"
            actions={[
              { key: "sgs", icon: "xlsx", label: "Excel (SGS / สพม.)", onClick: () => exportPP3Sgs(info, graduationLevel, mapped) },
              { key: "smis", icon: "xlsx", label: "Excel (SchoolMIS / สพฐ.)", onClick: () => exportPP3SchoolMis(info, graduationLevel, mapped) },
              { key: "dmc", icon: "xml", label: "DMC XML (ส่งเขต)", onClick: () => exportPP3Dmc(info, graduationLevel, mapped) },
            ]}
          />

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
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
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
