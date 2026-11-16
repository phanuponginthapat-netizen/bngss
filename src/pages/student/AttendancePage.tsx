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
import { Button } from '@/components/ui/button';
import FamilySchoolAttendance from '@/components/attendance/FamilySchoolAttendance';

const toDbAcademicYear = (year: number) => {
  if (!year || year <= 0) return undefined;
  return year > 2400 ? year - BE_OFFSET : year;
};

const AttendancePage = () => {
  const { lang } = useLanguage();
  const sd = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const { isAdmin, isDirector, isTeacher, isParent, isStudent, userId } = useUserRole();
  const isFamily = isParent || isStudent;
  const { childIds, children, error: childrenError, isLoading: childrenLoading } = useParentChildren();
  useEffect(() => {
    if (isParent && children[0]?.classroom_id && sd.classroomFilter === 'all') sd.setClassroomFilter(children[0].classroom_id);
  }, [isParent, children, sd.classroomFilter]);
  const canSeeAll = isAdmin || isDirector;
  const canCheckSubject = !isFamily && (canSeeAll || isTeacher);
  const defaultTab = isFamily ? "school" : (canCheckSubject ? "subject" : "dashboard");

  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCheckSubject, isFamily]);

  const [academicYear, setAcademicYear] = useState<number>(0);
  const [semester, setSemester] = useState<number>(0);

  useEffect(() => {
    if (academicYear === 0 && currentAcademicYear > 0) {
      setAcademicYear(currentAcademicYear);
      setSemester(currentSemester);
    }
  }, [academicYear, currentAcademicYear, currentSemester]);

  const { data: selfStudent } = useQuery({
    queryKey: ["attendance-self-student", userId],
    enabled: isStudent && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, classroom_id").eq("auth_user_id", userId ?? "").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const scopedStudentIds = useMemo(() => {
    if (isParent) return childIds;
    if (isStudent) return selfStudent ? [selfStudent.id] : [];
    if (!sd.homeroomClassroomIds) return null;
    return sd.students
      .filter((s: any) => sd.homeroomClassroomIds!.includes(s.classroom_id))
      .map((s: any) => s.id);
  }, [isParent, isStudent, selfStudent, childIds, sd.homeroomClassroomIds, sd.students]);

  const { data: records = [], error: recordsError, refetch } = useQuery({
    queryKey: ["attendance", academicYear, semester, scopedStudentIds?.join(",") || "all"],
    queryFn: async () => {
      const dbAcademicYear = toDbAcademicYear(academicYear);
      if (scopedStudentIds && scopedStudentIds.length === 0) return [];

      // ดึงทั้งหมดแบบแบ่งหน้า เพื่อให้การนับ ขาด/ลา ครบจริง (ไม่ตัดที่ 2000 แถว)
      const PAGE = 1000;
      const all: any[] = [];
      for (let from = 0; from < 50_000; from += PAGE) {
        let query = supabase
          .from("attendance")
          .select("*, students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level)), subjects(id, name_th, code)")
          .order("created_at", { ascending: false })
          // หน้านี้คือเช็คชื่อรายคาบวิชาเท่านั้น — ไม่รวมการสแกนหน้าเข้าโรงเรียน (ไม่มีวิชา)
          .not("subject_id", "is", null)
          .range(from, from + PAGE - 1);

        if (dbAcademicYear) query = query.eq("academic_year", dbAcademicYear);
        if (semester > 0) query = query.eq("semester", semester);
        if (scopedStudentIds) query = query.in("student_id", scopedStudentIds);

        const { data, error } = await query;
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      return all;
    },
    enabled: academicYear > 0 && (!isParent || !childrenLoading) && (!isStudent || !!selfStudent),
  });

  const sharedProps = {
    students: isParent ? sd.students.filter(s => childIds.includes(s.id)) : isStudent ? sd.students.filter(s => s.id === selfStudent?.id) : sd.students,
    classrooms: isParent ? sd.classrooms.filter(c => children.some(k => k.classroom_id === c.id)) : isStudent ? sd.classrooms.filter(c => c.id === selfStudent?.classroom_id) : sd.classrooms,
    filteredClassrooms: isParent ? sd.filteredClassrooms.filter(c => children.some(k => k.classroom_id === c.id)) : isStudent ? sd.filteredClassrooms.filter(c => c.id === selfStudent?.classroom_id) : sd.filteredClassrooms,
    gradeFilter: sd.gradeFilter,
    setGradeFilter: sd.setGradeFilter,
    classroomFilter: sd.classroomFilter,
    setClassroomFilter: sd.setClassroomFilter,
    gradeOptions: sd.gradeOptions,
  };

  return (
    <div className="space-y-6">
      {(recordsError || childrenError) && <div role="alert" className="text-destructive">อ่านข้อมูลการเข้าเรียนไม่สำเร็จ <Button variant="outline" onClick={() => void refetch()}>ลองใหม่</Button></div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isParent ? 'การมาเรียนของลูก' : isStudent ? 'การมาเรียนของฉัน' : lang === "th" ? "เช็คชื่อนักเรียน (รายคาบวิชา)" : "Student Attendance (Per Period)"}
          </h1>
          {!isFamily && <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "ครูประจำวิชาเช็คชื่อรายคาบ — แสกน QR หรือติ๊กสถานะด้วยตนเอง"
              : "Subject teachers check per-period — scan QR or tick status manually"}
          </p>}
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
        <TabsList className="flex h-auto flex-wrap justify-start">
          {isFamily && <TabsTrigger value="school">มาโรงเรียน</TabsTrigger>}
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
            {isFamily ? 'รายงานรายคาบ' : lang === "th" ? "รายงาน" : "Report"}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-1" />
            {isFamily ? 'ประวัติรายคาบ' : lang === "th" ? "ประวัติ" : "History"}
          </TabsTrigger>
        </TabsList>
        {isFamily && <TabsContent value="school"><FamilySchoolAttendance academicYear={academicYear} semester={semester} /></TabsContent>}

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
          <AttendanceReportTab {...sharedProps} records={records} hideFilters={isFamily} />
        </TabsContent>

        <TabsContent value="history">
          <AttendanceHistoryTab {...sharedProps} records={records} readOnly={isFamily} />
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
