import { useMemo } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { ScanAttendanceFlow, AttendanceStatus } from "./ScanAttendanceFlow";
import { BEDatePicker } from "@/components/ui/be-date-picker";

const toDbAcademicYear = (year?: number) => {
  if (!year || year <= 0) return undefined;
  return year > 2400 ? year - 543 : year;
};

interface Props {
  students: any[];
  classrooms: any[];
  filteredClassrooms: any[];
  gradeFilter: string;
  setGradeFilter: (v: string) => void;
  classroomFilter: string;
  setClassroomFilter: (v: string) => void;
  gradeOptions: string[];
  existingRecords: any[];
  academicYear?: number;
  semester?: number;
}

export function DailyCheckTab({
  students, classrooms, filteredClassrooms,
  gradeFilter, setGradeFilter, classroomFilter, setClassroomFilter,
  gradeOptions, academicYear, semester,
}: Props) {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [checkDate, setCheckDate] = useState(todayBangkok());
  const dbAcademicYear = toDbAcademicYear(academicYear);

  const classStudents = useMemo(() => {
    if (!classroomFilter) return [];
    if (classroomFilter === "all") {
      const classroomIds = filteredClassrooms.map((c: any) => c.id);
      return students
        .filter((s: any) => classroomIds.includes(s.classroom_id))
        .sort((a: any, b: any) => {
          const roomA = a.classrooms?.name || "";
          const roomB = b.classrooms?.name || "";
          return roomA.localeCompare(roomB, "th") || (a.student_code || "").localeCompare(b.student_code || "");
        });
    }
    return students
      .filter((s: any) => s.classroom_id === classroomFilter)
      .sort((a: any, b: any) => (a.student_code || "").localeCompare(b.student_code || ""));
  }, [students, classroomFilter, gradeFilter, filteredClassrooms]);

  const classroomName = classroomFilter === "all" && gradeFilter !== "all"
    ? `${gradeFilter} ${lang === "th" ? "ทุกห้อง" : "All rooms"}`
    : classrooms.find((c: any) => c.id === classroomFilter)?.name || "";

  const handleSubmit = async (statusMap: Record<string, AttendanceStatus>) => {
    if (classStudents.length === 0) return;
    try {
      const studentIds = classStudents.map((s: any) => s.id);
      await supabase.from("attendance").delete()
        .in("student_id", studentIds)
        .eq("attendance_date", checkDate)
        .is("subject_id", null);

      const inserts = classStudents.map((s: any) => ({
        student_id: s.id,
        subject_id: null,
        attendance_date: checkDate,
        status: statusMap[s.id] || "absent",
        notes: null,
        recorded_by: "homeroom_assembly",
        academic_year: dbAcademicYear,
        semester: semester && semester > 0 ? semester : undefined,
      }));
      const { error } = await supabase.from("attendance").insert(inserts as any);
      if (error) throw error;
      toast.success(lang === "th" ? `บันทึกเช็คชื่อหน้าเสาธง ${inserts.length} คน` : `Saved ${inserts.length}`);
      qc.invalidateQueries({ queryKey: ["attendance"] });

      // Fan-out: notify students marked absent/late (in-app + LINE)
      try {
        const { notify } = await import("@/lib/notify");
        const absentees = classStudents.filter((s: any) => {
          const st = statusMap[s.id] || "absent";
          return (st === "absent" || st === "late") && s.auth_user_id;
        });
        if (absentees.length > 0) {
          await notify({
            user_ids: absentees.map((s: any) => s.auth_user_id),
            title: "📋 บันทึกการเข้าเรียน",
            body: `วันที่ ${checkDate} — สถานะ: ${
              absentees.length === 1
                ? ((statusMap[absentees[0].id] === "late") ? "มาสาย" : "ขาดเรียน")
                : "ขาด/สาย"
            } กรุณาติดต่อครูที่ปรึกษาหากมีข้อสงสัย`,
            type: "attendance_absent",
            severity: "warning",
            reference_type: "attendance",
            url: "/dashboard/student/attendance",
            dedup_key: `att-absent-${checkDate}-${absentees.map((s: any) => s.id).join(",")}`,
          });
        }
      } catch {/* non-blocking */}
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>{lang === "th" ? "วันที่เช็คชื่อ" : "Date"}</Label>
              <BEDatePicker value={checkDate} onChange={(v) => setCheckDate(v)} />
            </div>
            <div>
              <Label>{lang === "th" ? "ระดับชั้น" : "Grade"}</Label>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือก" : "Grade"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทุกระดับชั้น" : "All"}</SelectItem>
                  {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{lang === "th" ? "ห้องเรียน" : "Classroom"}</Label>
              <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือก" : "Room"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                  {filteredClassrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {classStudents.length > 0 ? (
        <ScanAttendanceFlow
          key={`${classroomFilter}-${checkDate}`}
          students={classStudents}
          scanTitle={lang === "th" ? `แสกน QR หน้าเสาธง — ${classroomName}` : `Assembly Scan — ${classroomName}`}
          contextLabel={lang === "th"
            ? `หน้าเสาธง • ${classroomName} • ${checkDate} • ${classStudents.length} คน`
            : `Assembly • ${classroomName} • ${checkDate}`}
          onSubmit={handleSubmit}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {lang === "th" ? "ไม่พบนักเรียนในระดับชั้นหรือห้องเรียนที่เลือก" : "No students found for the selected grade or classroom"}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
