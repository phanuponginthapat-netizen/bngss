import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useStudentData } from "@/hooks/useStudentData";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ScanLine, BarChart3, Loader2 } from "lucide-react";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";
import { SubjectPeriodCheckTab } from "@/components/attendance/SubjectPeriodCheckTab";
import { SubjectScanReportTab } from "@/components/attendance/SubjectScanReportTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const SubjectScanPage = () => {
  const { lang } = useLanguage();
  const sd = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const { isAdmin, isDirector, isTeacher, loading } = useUserRole();
  const canSeeAll = isAdmin || isDirector;
  const canScan = canSeeAll || isTeacher;

  const [academicYear, setAcademicYear] = useState<number>(0);
  const [semester, setSemester] = useState<number>(0);
  useEffect(() => {
    if (academicYear === 0 && currentAcademicYear > 0) {
      setAcademicYear(currentAcademicYear);
      setSemester(currentSemester);
    }
  }, [academicYear, currentAcademicYear, currentSemester]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-warning/10 via-warning/5 to-warning/10 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-warning/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-warning/30 to-warning/30 border border-warning/40 shadow-lg">
              <ScanLine className="w-7 h-7 text-warning" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {lang === "th" ? "แสกนเช็คชื่อรายวิชา" : "Subject Period Scan"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {lang === "th"
                  ? "แสกน QR หรือป้อนรหัสนักเรียนเพื่อเช็คชื่อเข้าเรียนรายคาบวิชา"
                  : "Scan QR or enter student code to check attendance for each subject period"}
              </p>
            </div>
          </div>
          {academicYear > 0 && (
            <AcademicYearFilter
              academicYear={academicYear}
              onAcademicYearChange={setAcademicYear}
              semester={semester}
              onSemesterChange={setSemester}
              academicYearOptions={academicYearOptions}
              allowAllSemesters
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[240px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : canScan ? (
        <Tabs defaultValue="scan">
          <TabsList>
            <TabsTrigger value="scan"><ScanLine className="w-4 h-4 mr-1" />{lang === "th" ? "แสกนเช็คชื่อ" : "Scan"}</TabsTrigger>
            <TabsTrigger value="report"><BarChart3 className="w-4 h-4 mr-1" />{lang === "th" ? "รายงาน / แดชบอร์ด" : "Report"}</TabsTrigger>
          </TabsList>
          <TabsContent value="scan" className="mt-4">
            <SubjectPeriodCheckTab
              students={sd.students}
              classrooms={sd.classrooms}
              academicYear={academicYear}
              semester={semester}
            />
          </TabsContent>
          <TabsContent value="report" className="mt-4">
            <SubjectScanReportTab
              students={sd.students}
              classrooms={sd.classrooms}
              academicYear={academicYear}
              semester={semester}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {lang === "th"
              ? "เฉพาะครู / ผู้ดูแลระบบเท่านั้นที่สามารถแสกนเช็คชื่อรายวิชาได้"
              : "Only teachers and admins can use subject period scanning"}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubjectScanPage;
