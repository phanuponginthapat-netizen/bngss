import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useStudentData } from "@/hooks/useStudentData";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, History, BookOpen, LayoutDashboard } from "lucide-react";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";
import { AttendanceReportTab } from "@/components/attendance/AttendanceReportTab";
import { AttendanceHistoryTab } from "@/components/attendance/AttendanceHistoryTab";
import { SubjectPeriodCheckTab } from "@/components/attendance/SubjectPeriodCheckTab";
import { SubjectScanDashboardTab } from "@/components/attendance/SubjectScanDashboardTab";
import { useUserRole } from "@/hooks/useUserRole";
import { useParentChildren } from "@/hooks/useParentChildren";
import { Card, CardContent } from "@/components/ui/card";
import { BE_OFFSET } from "@/lib/dateBE";

const toDbAcademicYear = (year: number) => {
  if (!year || year <= 0) return undefined;
  return year > 2400 ? year - BE_OFFSET : year;
};

const AttendancePage = () => {
  const { lang } = useLanguage();
  const sd = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const { isAdmin, isDirector, isTeacher, isParent } = useUserRole();
  const { childIds } = useParentChildren();
  const canSeeAll = isAdmin || isDirector;
  const canCheckSubject = !isParent && (canSeeAll || isTeacher);
  const defaultTab = isParent ? "report" : (canCheckSubject ? "subject" : "dashboard");

  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCheckSubject, isParent]);

  const [academicYear, setAcademicYear] = useState<number>(0);
  const [semester, setSemester] = useState<number>(0);

  useEffect(() => {
    if (academicYear === 0 && currentAcademicYear > 0) {
      setAcademicYear(currentAcademicYear);
      setSemester(currentSemester);
    }
  }, [academicYear, currentAcademicYear, currentSemester]);

  const scopedStudentIds = useMemo(() => {
    if (isParent) return childIds;
    if (!sd.homeroomClassroomIds) return null;
    return sd.students
      .filter((s: any) => sd.homeroomClassroomIds!.includes(s.classroom_id))
      .map((s: any) => s.id);
  }, [isParent, childIds, sd.homeroomClassroomIds, sd.students]);

  const { data: records = [] } = useQuery({
    queryKey: ["attendance", academicYear, semester, scopedStudentIds?.join(",") || "all"],
    queryFn: async () => {
      let query = supabase
        .from("attendance")
        .select("*, students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level)), subjects(id, name_th, code)")
        .order("created_at", { ascending: false })
        .limit(2000);

      const dbAcademicYear = toDbAcademicYear(academicYear);
      if (dbAcademicYear) query = query.eq("academic_year", dbAcademicYear);
      if (semester > 0) query = query.eq("semester", semester);
      if (scopedStudentIds) {
        if (scopedStudentIds.length === 0) return [];
        query = query.in("student_id", scopedStudentIds);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: academicYear > 0,
  });

  const sharedProps = {
    students: sd.students,
    classrooms: sd.classrooms,
    filteredClassrooms: sd.filteredClassrooms,
    gradeFilter: sd.gradeFilter,
    setGradeFilter: sd.setGradeFilter,
    classroomFilter: sd.classroomFilter,
    setClassroomFilter: sd.setClassroomFilter,
    gradeOptions: sd.gradeOptions,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {lang === "th" ? "เช็คชื่อนักเรียน (รายคาบวิชา)" : "Student Attendance (Per Period)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "ครูประจำวิชาเช็คชื่อรายคาบ — แสกน QR หรือติ๊กสถานะด้วยตนเอง"
              : "Subject teachers check per-period — scan QR or tick status manually"}
          </p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {canCheckSubject && (
            <TabsTrigger value="subject">
              <BookOpen className="w-4 h-4 mr-1" />
              {lang === "th" ? "เช็คชื่อรายคาบ" : "Per Period"}
            </TabsTrigger>
          )}
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="w-4 h-4 mr-1" />
            {lang === "th" ? "แดชบอร์ด" : "Dashboard"}
          </TabsTrigger>
          <TabsTrigger value="report">
            <BarChart3 className="w-4 h-4 mr-1" />
            {lang === "th" ? "รายงาน" : "Report"}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-1" />
            {lang === "th" ? "ประวัติ" : "History"}
          </TabsTrigger>
        </TabsList>

        {canCheckSubject && (
          <TabsContent value="subject">
            <SubjectPeriodCheckTab
              students={sd.students}
              classrooms={sd.classrooms}
              academicYear={academicYear}
              semester={semester}
            />
          </TabsContent>
        )}

        <TabsContent value="dashboard">
          <SubjectScanDashboardTab records={records} students={sd.students} />
        </TabsContent>

        <TabsContent value="report">
          <AttendanceReportTab {...sharedProps} records={records} />
        </TabsContent>

        <TabsContent value="history">
          <AttendanceHistoryTab {...sharedProps} records={records} />
        </TabsContent>
      </Tabs>

      {!canCheckSubject && isTeacher && (
        <Card><CardContent className="py-4 text-sm text-muted-foreground">
          {lang === "th"
            ? "ℹ️ คุณยังไม่ได้รับมอบหมายเป็นครูประจำวิชาในตารางสอน — สามารถดูแดชบอร์ด รายงาน และประวัติได้"
            : "ℹ️ You are not assigned as a subject teacher yet — view-only access."}
        </CardContent></Card>
      )}
    </div>
  );
};

export default AttendancePage;
