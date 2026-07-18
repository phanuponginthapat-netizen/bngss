import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useStudentData } from "@/hooks/useStudentData";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, History } from "lucide-react";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";
import { AttendanceReportTab } from "@/components/attendance/AttendanceReportTab";
import { AttendanceHistoryTab } from "@/components/attendance/AttendanceHistoryTab";
import { useUserRole } from "@/hooks/useUserRole";
import { useParentChildren } from "@/hooks/useParentChildren";

const toDbAcademicYear = (year: number) => {
  if (!year || year <= 0) return undefined;
  return year > 2400 ? year - 543 : year;
};

const AttendancePage = () => {
  const { lang } = useLanguage();
  const sd = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const { isParent } = useUserRole();
  const { childIds } = useParentChildren();

  const [activeTab, setActiveTab] = useState<string>("report");
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

  // ใช้เฉพาะข้อมูลแสกนเข้าโรงเรียน (face_scan_logs) เท่านั้น
  const { data: records = [] } = useQuery({
    queryKey: ["attendance-scan", academicYear, semester, scopedStudentIds?.join(",") || "all"],
    queryFn: async () => {
      // เกณฑ์เวลาสาย
      const thresholdRes = await supabase
        .from("school_settings").select("setting_key,setting_value")
        .in("setting_key", ["face_scan_late_threshold", "clock_late_threshold"]);
      const rows = thresholdRes.data || [];
      const lateThreshold =
        (rows.find((r: any) => r.setting_key === "face_scan_late_threshold")?.setting_value as string) ||
        (rows.find((r: any) => r.setting_key === "clock_late_threshold")?.setting_value as string) ||
        "08:30";

      let q = supabase
        .from("face_scan_logs")
        .select("id, student_id, scan_date, scan_time, students(id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level))")
        .order("scan_time", { ascending: true })
        .limit(20000);

      if (scopedStudentIds) {
        if (scopedStudentIds.length === 0) return [];
        q = q.in("student_id", scopedStudentIds);
      }

      const { data } = await q;
      const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(d);

      // ยุบเป็น 1 record ต่อ (นักเรียน, วัน) ใช้เวลาแสกนแรก
      const byKey = new Map<string, any>();
      (data || []).forEach((r: any) => {
        const key = `${r.student_id}__${r.scan_date}`;
        if (byKey.has(key)) return;
        const status = fmt(new Date(r.scan_time)) > lateThreshold ? "late" : "present";
        byKey.set(key, {
          id: r.id,
          student_id: r.student_id,
          attendance_date: r.scan_date,
          status,
          scan_time: r.scan_time,
          students: r.students,
        });
      });
      return Array.from(byKey.values());
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
            {lang === "th" ? "รายงานการมาเรียน" : "Attendance Report"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "รายงานคำนวณจากการแสกนเข้าโรงเรียน (face scan) เท่านั้น — เกินเวลาที่กำหนด = สาย, ไม่มีแสกนในวันที่เปิดเรียน = ขาด"
              : "Reports are computed from school-entry face scans only — past threshold = Late, no scan on a school day = Absent"}
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
          <TabsTrigger value="report">
            <BarChart3 className="w-4 h-4 mr-1" />
            {lang === "th" ? "รายงาน" : "Report"}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-1" />
            {lang === "th" ? "ประวัติ" : "History"}
          </TabsTrigger>
        </TabsList>


        <TabsContent value="report">
          <AttendanceReportTab {...sharedProps} records={records} />
        </TabsContent>

        <TabsContent value="history">
          <AttendanceHistoryTab {...sharedProps} records={records} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendancePage;
