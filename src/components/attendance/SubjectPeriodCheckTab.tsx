import { useState, useMemo, useEffect } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScanAttendanceFlow, AttendanceStatus } from "./ScanAttendanceFlow";
import { ManualRosterCheck } from "./ManualRosterCheck";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { sortGrades } from "@/lib/gradeOrder";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListChecks, ScanLine } from "lucide-react";

const toDbAcademicYear = (year?: number) => {
  if (!year || year <= 0) return undefined;
  return year > 2400 ? year - 543 : year;
};

interface Props {
  students: any[];
  classrooms: any[];
  academicYear?: number;
  semester?: number;
}

export function SubjectPeriodCheckTab({ students, classrooms, academicYear, semester }: Props) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { userId, isAdmin, isDirector, isTeacher } = useUserRole();
  const canSeeAll = isAdmin || isDirector;

  const [checkDate, setCheckDate] = useState(todayBangkok());
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [classroomId, setClassroomId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const dbAcademicYear = toDbAcademicYear(academicYear);

  // Get current teacher's full name
  const { data: personnel } = useQuery({
    queryKey: ["my_personnel_subject", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });
  const teacherName = personnel ? `${personnel.prefix || ""}${personnel.first_name} ${personnel.last_name}` : null;

  // Schedules for this date — used to show period number if available
  const dayOfWeek = useMemo(() => {
    const js = new Date(checkDate).getDay();
    return js === 0 ? 7 : js;
  }, [checkDate]);

  const { data: mySchedules = [] } = useQuery({
    queryKey: ["my-schedules-day", dayOfWeek, academicYear, semester, personnel?.id, teacherName],
    enabled: !!checkDate && !!personnel?.id,
    queryFn: async () => {
      let q = supabase
        .from("schedules")
        .select("id, subject_id, classroom_id, period, teacher_name, teacher_id")
        .eq("day_of_week", dayOfWeek)
        .order("period");
      if (dbAcademicYear) q = q.eq("academic_year", dbAcademicYear);
      if (semester && semester > 0) q = q.eq("semester", semester);
      const orParts = [`teacher_id.eq.${personnel!.id}`];
      if (teacherName) orParts.push(`teacher_name.eq.${teacherName}`);
      orParts.push(`teacher_name.eq.ครู${personnel!.first_name}`);
      orParts.push(`teacher_name.eq.${personnel!.first_name} ${personnel!.last_name}`);
      q = q.or(orParts.join(","));
      const { data } = await q;
      return data || [];
    },
  });

  // Source of truth: teacher_assignments (วิชา/ห้องที่ครูรับมอบหมาย) — ไม่ขึ้นกับวันในสัปดาห์
  const { data: myAssignments = [] } = useQuery({
    queryKey: ["my-teacher-assignments", personnel?.id, dbAcademicYear, semester],
    enabled: !!personnel?.id,
    queryFn: async () => {
      let q = supabase
        .from("teacher_assignments")
        .select("subject_id, classroom_id, subjects(id, name_th, code, grade_level), classrooms(id, name, grade_level)")
        .eq("personnel_id", personnel!.id);
      if (dbAcademicYear) q = q.eq("academic_year", dbAcademicYear);
      if (semester && semester > 0) q = q.eq("semester", semester);
      const { data } = await q;
      return data || [];
    },
  });

  const allowedClassrooms = useMemo(() => {
    const ids = new Set(myAssignments.map((a: any) => a.classroom_id).filter(Boolean));
    return classrooms.filter((c: any) => ids.has(c.id));
  }, [myAssignments, classrooms]);

  const gradeOptions = useMemo(
    () => sortGrades([...new Set(allowedClassrooms.map((c: any) => c.grade_level as string).filter(Boolean))]),
    [allowedClassrooms]
  );

  // Auto-reset gradeFilter when it's no longer valid for the selected date
  useEffect(() => {
    if (gradeFilter && !gradeOptions.includes(gradeFilter)) {
      setGradeFilter("");
      setClassroomId("");
      setSubjectId("");
    }
  }, [gradeOptions, gradeFilter]);

  const filteredClassrooms = useMemo(
    () => gradeFilter ? allowedClassrooms.filter((c: any) => c.grade_level === gradeFilter) : allowedClassrooms,
    [allowedClassrooms, gradeFilter]
  );

  const subjectsForClass = useMemo(() => {
    if (!classroomId) return [];
    const subs = myAssignments
      .filter((a: any) => a.classroom_id === classroomId)
      .map((a: any) => a.subjects)
      .filter(Boolean);
    const seen = new Set<string>();
    return subs.filter((sub: any) => {
      if (seen.has(sub.id)) return false;
      seen.add(sub.id);
      return true;
    });
  }, [myAssignments, classroomId]);

  const periodForSelected = useMemo(() => {
    const found = mySchedules.find((s: any) => s.classroom_id === classroomId && s.subject_id === subjectId);
    return found?.period;
  }, [mySchedules, classroomId, subjectId]);

  const classStudents = useMemo(() => {
    if (!classroomId) return [];
    return students
      .filter((s: any) => s.classroom_id === classroomId)
      .sort((a: any, b: any) => (a.student_code || "").localeCompare(b.student_code || ""));
  }, [students, classroomId]);

  const classroomName = classrooms.find((c: any) => c.id === classroomId)?.name || "";
  const subjectName = subjectsForClass.find((s: any) => s.id === subjectId)?.name_th || "";

  const handleSubmit = async (
    statusMap: Record<string, AttendanceStatus>,
    notesMap?: Record<string, string>,
  ) => {
    if (!classroomId || !subjectId || classStudents.length === 0) return;
    try {
      const studentIds = classStudents.map((s: any) => s.id);
      await supabase.from("attendance").delete()
        .in("student_id", studentIds)
        .eq("attendance_date", checkDate)
        .eq("subject_id", subjectId);

      const inserts = classStudents.map((s: any) => ({
        student_id: s.id,
        subject_id: subjectId,
        attendance_date: checkDate,
        status: statusMap[s.id] || "present",
        notes: notesMap?.[s.id]?.trim() || null,
        recorded_by: `subject_teacher:${teacherName || "user"}`,
        academic_year: dbAcademicYear,
        semester: semester && semester > 0 ? semester : undefined,
      }));
      const { error } = await supabase.from("attendance").insert(inserts as any);
      if (error) throw error;
      toast.success(lang === "th" ? `บันทึกเช็คชื่อรายวิชา ${inserts.length} คน` : `Saved ${inserts.length}`);
      qc.invalidateQueries({ queryKey: ["attendance"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!personnel) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        {lang === "th" ? "ไม่พบข้อมูลบุคลากรของคุณ — กรุณาเชื่อมโยงบัญชีบุคลากรเพื่อดูตารางสอน" : "No personnel record linked"}
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label>{lang === "th" ? "วันที่" : "Date"}</Label>
              <BEDatePicker value={checkDate} onChange={(v) => {
                setCheckDate(v); setGradeFilter(""); setClassroomId(""); setSubjectId("");
              }} />
            </div>
            <div>
              <Label>{lang === "th" ? "ระดับชั้น" : "Grade"}</Label>
              <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setClassroomId(""); setSubjectId(""); }}>
                <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือก" : "Grade"} /></SelectTrigger>
                <SelectContent>
                  {gradeOptions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {lang === "th" ? "ไม่มีคาบสอนวันนี้" : "No periods today"}
                    </div>
                  )}
                  {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{lang === "th" ? "ห้องเรียน" : "Classroom"}</Label>
              <Select value={classroomId} onValueChange={(v) => { setClassroomId(v); setSubjectId(""); }} disabled={filteredClassrooms.length === 0}>
                <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกห้อง" : "Room"} /></SelectTrigger>
                <SelectContent>
                  {filteredClassrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{lang === "th" ? "วิชา" : "Subject"}</Label>
              <Select value={subjectId} onValueChange={setSubjectId} disabled={subjectsForClass.length === 0}>
                <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกวิชา" : "Subject"} /></SelectTrigger>
                <SelectContent>
                  {subjectsForClass.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name_th || s.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {classroomId && subjectId && classStudents.length > 0 ? (
        <Tabs defaultValue="manual">
          <TabsList>
            <TabsTrigger value="manual">
              <ListChecks className="w-4 h-4 mr-1" />
              {lang === "th" ? "เช็คชื่อรายบุคคล" : "Roster Check"}
            </TabsTrigger>
            <TabsTrigger value="scan">
              <ScanLine className="w-4 h-4 mr-1" />
              {lang === "th" ? "แสกน QR" : "Scan QR"}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="mt-3">
            <ManualRosterCheck
              key={`m-${classroomId}-${subjectId}-${checkDate}`}
              students={classStudents}
              contextLabel={lang === "th"
                ? `${subjectName} • ${classroomName}${periodForSelected ? ` • คาบ ${periodForSelected}` : ""} • ${checkDate} • ${classStudents.length} คน`
                : `${subjectName} • ${classroomName} • ${checkDate}`}
              onSubmit={handleSubmit}
            />
          </TabsContent>
          <TabsContent value="scan" className="mt-3">
            <ScanAttendanceFlow
              key={`s-${classroomId}-${subjectId}-${checkDate}`}
              students={classStudents}
              scanTitle={lang === "th" ? `แสกน QR — ${subjectName} • ${classroomName}` : `Scan — ${subjectName}`}
              contextLabel={lang === "th"
                ? `${subjectName} • ${classroomName}${periodForSelected ? ` • คาบ ${periodForSelected}` : ""} • ${checkDate} • ${classStudents.length} คน`
                : `${subjectName} • ${classroomName} • ${checkDate}`}
              onSubmit={handleSubmit}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {lang === "th" ? "เลือกระดับชั้น ห้อง และวิชา เพื่อเริ่มเช็คชื่อ" : "Select grade, classroom, and subject"}
        </CardContent></Card>
      )}
    </div>
  );
}
