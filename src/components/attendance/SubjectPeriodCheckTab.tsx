import { useState, useMemo, useEffect } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useViewMode } from "@/hooks/useViewMode";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScanAttendanceFlow, AttendanceStatus } from "./ScanAttendanceFlow";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { sortGrades } from "@/lib/gradeOrder";
import { BE_OFFSET } from "@/lib/dateBE";
import { lessonStatusMap } from "@/lib/lessonAttendance";
import { saveErrorMessage } from "@/lib/saveError";

const toDbAcademicYear = (year?: number) => {
  if (!year || year <= 0) return undefined;
  return year > 2400 ? year - BE_OFFSET : year;
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
  const { viewMode } = useViewMode();
  // ★ ถ้าอยู่ฝั่ง admin (viewMode = admin) → เห็นทุกวิชา
  //   ถ้าสลับมาเป็นครู (viewMode = teacher) → เห็นเฉพาะวิชาที่ตนสอน
  const canSeeAll = (isAdmin || isDirector) && viewMode === "admin";

  const [checkDate, setCheckDate] = useState(todayBangkok());
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [classroomId, setClassroomId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState(0);
  const dbAcademicYear = toDbAcademicYear(academicYear);

  // Get current teacher's full name
  const { data: personnel } = useQuery({
    queryKey: ["my_personnel_subject", userId],
    enabled: isTeacher && !!userId,
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
  const firstName = personnel?.first_name?.trim() || "";
  const lastName = personnel?.last_name?.trim() || "";

  // Fetch teacher's schedules for this date — used to derive subject + classroom options
  const dayOfWeek = useMemo(() => {
    const js = new Date(checkDate).getDay();
    return js === 0 ? 7 : js;
  }, [checkDate]);

  const { data: mySchedules = [] } = useQuery({
    queryKey: ["my-schedules-day", dayOfWeek, academicYear, semester, personnel?.id, firstName, lastName, canSeeAll],
    enabled: !!checkDate && (canSeeAll || !!personnel?.id || !!firstName),
    queryFn: async () => {
      // ★ ใช้ teacher_id (FK → personnel.id) เป็นหลัก
      //   fallback: teacher_name substring match สำหรับแถวเก่าที่ยังไม่มี teacher_id
      let q = supabase
        .from("schedules")
        .select("id, subject_id, classroom_id, period, teacher_id, teacher_name, subjects(id, name_th, code, grade_level), classrooms(id, name, grade_level)")
        .eq("day_of_week", dayOfWeek)
        .order("period");
      if (dbAcademicYear) q = q.eq("academic_year", dbAcademicYear);
      if (semester && semester > 0) q = q.eq("semester", semester);
      const { data } = await q;
      const rows = data || [];
      if (canSeeAll) return rows;
      const pid = personnel?.id;
      return rows.filter((r: any) => {
        if (pid && r.teacher_id === pid) return true;
        if (r.teacher_id) return false; // มี teacher_id แต่ไม่ตรง → ข้าม
        // fallback สำหรับแถวเก่าที่ teacher_id = null
        const t = String(r.teacher_name || "");
        if (!firstName || !t.includes(firstName)) return false;
        if (lastName && t.length > firstName.length + 3) {
          const hasSpace = t.trim().includes(" ");
          if (hasSpace && !t.includes(lastName)) return false;
        }
        return true;
      });
    },
  });

  // Derive grade options & subject/classroom options from schedules (role-scoped)
  const allowedClassrooms = useMemo(() => {
    const ids = new Set(mySchedules.map((s: any) => s.classroom_id).filter(Boolean));
    return classrooms.filter((c: any) => ids.has(c.id));
  }, [mySchedules, classrooms]);

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
    const subs = mySchedules
      .filter((s: any) => s.classroom_id === classroomId)
      .map((s: any) => s.subjects)
      .filter(Boolean);
    const seen = new Set<string>();
    return subs.filter((sub: any) => {
      if (seen.has(sub.id)) return false;
      seen.add(sub.id);
      return true;
    });
  }, [mySchedules, classroomId]);

  const availablePeriods = useMemo(() => [...new Set(mySchedules.filter((s: any) => s.classroom_id === classroomId && s.subject_id === subjectId).map((s: any) => Number(s.period)).filter(p => p > 0))].sort((a, b) => a - b), [mySchedules, classroomId, subjectId]);
  useEffect(() => { setSelectedPeriod(availablePeriods[0] || 0); }, [availablePeriods]);
  const periodForSelected = selectedPeriod;

  const classStudents = useMemo(() => {
    if (!classroomId) return [];
    return students
      .filter((s: any) => s.classroom_id === classroomId)
      .sort((a: any, b: any) => (a.student_code || "").localeCompare(b.student_code || ""));
  }, [students, classroomId]);

  const classroomName = classrooms.find((c: any) => c.id === classroomId)?.name || "";
  const subjectName = subjectsForClass.find((s: any) => s.id === subjectId)?.name_th || "";

  // Only the exact lesson's saved records seed this lesson; gate scans are unrelated.
  const classIdsKey = classStudents.map((s: any) => s.id).join(",");
  const { data: prescanned, isSuccess: prescannedReady, isError: prescannedError } = useQuery({
    queryKey: ["attendance", "lesson-saved", checkDate, subjectId, selectedPeriod, dbAcademicYear, semester, classIdsKey],
    enabled: !!subjectId && selectedPeriod > 0 && !!dbAcademicYear && !!semester && classStudents.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance")
        .select("student_id, subject_id, period, status")
        .eq("attendance_date", checkDate).eq("subject_id", subjectId).eq("period", selectedPeriod)
        .eq("academic_year", dbAcademicYear ?? 0).eq("semester", semester ?? 0)
        .in("student_id", classStudents.map((s: any) => s.id));
      if (error) throw error;
      return lessonStatusMap(data ?? [], subjectId, selectedPeriod);
    },
  });

  const handleSubmit = async (statusMap: Record<string, AttendanceStatus>) => {
    if (!classroomId || !subjectId || !selectedPeriod || !dbAcademicYear || !semester || classStudents.length === 0) throw new Error("กรุณาเลือกปี ภาคเรียน และคาบก่อนบันทึก");
    try {
      const inserts = classStudents.map((s: any) => ({
        student_id: s.id,
        subject_id: subjectId,
        period: selectedPeriod,
        attendance_date: checkDate,
        status: statusMap[s.id] || "absent",
        notes: null,
        recorded_by: `subject_teacher:${teacherName || "user"}`,
        academic_year: dbAcademicYear,
        semester: semester && semester > 0 ? semester : undefined,
      }));
      const { error } = await supabase.from("attendance").upsert(inserts as any, { onConflict: "student_id,attendance_date,subject_id,period" });
      if (error) throw error;
      toast.success(lang === "th" ? `บันทึกเช็คชื่อรายวิชา ${inserts.length} คน` : `Saved ${inserts.length}`);
      qc.invalidateQueries({ queryKey: ["attendance"] });
    } catch (err: any) {
      toast.error(saveErrorMessage(err));
      throw err;
    }
  };

  if (isTeacher && !canSeeAll && !teacherName) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        {lang === "th" ? "ไม่พบข้อมูลบุคลากรของคุณ — กรุณาเชื่อมโยงบัญชี" : "No personnel record linked"}
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
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
            <div>
              <Label>{lang === "th" ? "คาบ" : "Period"}</Label>
              <Select value={selectedPeriod ? String(selectedPeriod) : ""} onValueChange={v => setSelectedPeriod(Number(v))} disabled={!availablePeriods.length}>
                <SelectTrigger><SelectValue placeholder="เลือกคาบ" /></SelectTrigger>
                <SelectContent>{availablePeriods.map(p => <SelectItem key={p} value={String(p)}>คาบ {p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {classroomId && subjectId && classStudents.length > 0 && prescannedError ? (
        <Card><CardContent className="py-8 text-center text-destructive">
          {lang === "th" ? "โหลดผลเช็คชื่อคาบนี้ไม่สำเร็จ กรุณาลองใหม่ก่อนบันทึก" : "Could not load this lesson's attendance."}
        </CardContent></Card>
      ) : classroomId && subjectId && classStudents.length > 0 && !prescannedReady ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          {lang === "th" ? "กำลังโหลดผลเช็คชื่อคาบนี้…" : "Loading lesson records…"}
        </CardContent></Card>
      ) : classroomId && subjectId && classStudents.length > 0 ? (
        <ScanAttendanceFlow
          key={`${classroomId}-${subjectId}-${selectedPeriod}-${checkDate}`}
          students={classStudents}
          prescanned={prescanned}
          scanTitle={lang === "th" ? `แสกน QR — ${subjectName} • ${classroomName}` : `Scan — ${subjectName}`}
          contextLabel={lang === "th"
            ? `${subjectName} • ${classroomName}${periodForSelected ? ` • คาบ ${periodForSelected}` : ""} • ${checkDate} • ${classStudents.length} คน`
            : `${subjectName} • ${classroomName} • ${checkDate}`}
          onSubmit={handleSubmit}
        />
      ) : (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {lang === "th" ? "เลือกระดับชั้น ห้อง และวิชา เพื่อเริ่มเช็คชื่อ" : "Select grade, classroom, and subject"}
        </CardContent></Card>
      )}
    </div>
  );
}
