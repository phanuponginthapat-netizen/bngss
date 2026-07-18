import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, BookOpen } from "lucide-react";
import { useAcademicYear } from "@/hooks/useAcademicYear";

const GRADE_LEVELS = ["ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];

const Pp4Page = () => {
  const { lang } = useLanguage();
  const { currentAcademicYear } = useAcademicYear();
  const [semester, setSemester] = useState("1");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const L = (th: string, en: string) => lang === "th" ? th : en;

  useEffect(() => {
    const fetchSubjects = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .eq("semester", parseInt(semester))
        .eq("academic_year", currentAcademicYear - 543)
        .order("grade_level")
        .order("code");
      setSubjects(data || []);
      setLoading(false);
    };
    fetchSubjects();
  }, [semester, currentAcademicYear]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          {L("ปพ.4 (แบบแสดงผลการเรียนรายวิชา) - ทุกระดับชั้น", "PP.4 (Course Record) - All Grades")}
        </h1>
        <div className="flex items-center gap-2">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{L("ภาคเรียน 1", "Semester 1")}</SelectItem>
              <SelectItem value="2">{L("ภาคเรียน 2", "Semester 2")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()} size="sm" variant="outline">
            <Printer className="w-4 h-4 mr-1" /> {L("พิมพ์", "Print")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : (
        GRADE_LEVELS.map((g) => {
          const rows = byGrade.get(g) || [];
          return (
            <Card key={g}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {L(`แผนการเรียน ${g} ภาคเรียนที่ ${semester} ปีการศึกษา ${currentAcademicYear}`,
                     `Course Plan ${g} Semester ${semester} Year ${currentAcademicYear}`)}
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
