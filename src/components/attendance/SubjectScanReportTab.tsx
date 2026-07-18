import { useState, useMemo, useEffect } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { sortGrades } from "@/lib/gradeOrder";
import { FileSpreadsheet, FileText, Users, BookOpen, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerThaiFont } from "@/lib/jspdfThai";
import { toast } from "sonner";

const toDbAcademicYear = (year?: number) => {
  if (!year || year <= 0) return undefined;
  return year > 2400 ? year - 543 : year;
};

const STATUS_LABEL: Record<string, { th: string; cls: string }> = {
  present: { th: "มา", cls: "bg-success-soft text-success-soft-foreground" },
  absent: { th: "ขาด", cls: "bg-danger-soft text-danger-soft-foreground" },
  late: { th: "สาย", cls: "bg-warning-soft text-warning-soft-foreground" },
  sick: { th: "ป่วย", cls: "bg-info-soft text-info-soft-foreground" },
  leave: { th: "ลา", cls: "bg-info-soft text-info-soft-foreground" },
};

interface Props {
  students: any[];
  classrooms: any[];
  academicYear?: number;
  semester?: number;
}

export function SubjectScanReportTab({ students, classrooms, academicYear, semester }: Props) {
  const { lang } = useLanguage();
  const { userId, isAdmin, isDirector, isTeacher } = useUserRole();
  const canSeeAll = isAdmin || isDirector;
  const dbAcademicYear = toDbAcademicYear(academicYear);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(todayBangkok());
  const [view, setView] = useState<"classroom" | "subject" | "student" | "detail">("classroom");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [classroomFilter, setClassroomFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Teacher's personnel record
  const { data: personnel } = useQuery({
    queryKey: ["my_personnel_report", userId],
    enabled: !!userId && isTeacher,
    queryFn: async () => {
      const { data } = await supabase.from("personnel")
        .select("id, prefix, first_name, last_name").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });
  const teacherName = personnel ? `${personnel.prefix || ""}${personnel.first_name} ${personnel.last_name}` : null;

  // Allowed subjects (teacher) — derived from schedules
  const { data: mySchedules = [] } = useQuery({
    queryKey: ["my-schedules-report", academicYear, semester, teacherName, canSeeAll],
    queryFn: async () => {
      let q = supabase.from("schedules")
        .select("subject_id, classroom_id, teacher_name, subjects(id, name_th, code, grade_level, credits), classrooms(id, name, grade_level)");
      if (dbAcademicYear) q = q.eq("academic_year", dbAcademicYear);
      if (semester && semester > 0) q = q.eq("semester", semester);
      if (!canSeeAll && teacherName) q = q.eq("teacher_name", teacherName);
      const { data } = await q;
      return data || [];
    },
  });

  const allowedSubjects = useMemo(() => {
    const m = new Map<string, any>();
    mySchedules.forEach((s: any) => { if (s.subjects) m.set(s.subjects.id, s.subjects); });
    return Array.from(m.values());
  }, [mySchedules]);

  const allowedSubjectIds = useMemo(() => new Set(allowedSubjects.map((s: any) => s.id)), [allowedSubjects]);

  const allowedClassrooms = useMemo(() => {
    const ids = new Set(mySchedules.map((s: any) => s.classroom_id).filter(Boolean));
    return classrooms.filter((c: any) => ids.has(c.id));
  }, [mySchedules, classrooms]);

  const gradeOptions = useMemo(
    () => sortGrades([...new Set(allowedClassrooms.map((c: any) => c.grade_level as string).filter(Boolean))]),
    [allowedClassrooms]
  );

  const filteredClassroomOptions = useMemo(
    () => gradeFilter === "all" ? allowedClassrooms : allowedClassrooms.filter((c: any) => c.grade_level === gradeFilter),
    [allowedClassrooms, gradeFilter]
  );

  // Fetch attendance records (only subject-period: subject_id NOT NULL) within date range
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["subject-scan-report", startDate, endDate, dbAcademicYear, semester],
    queryFn: async () => {
      let q = supabase.from("attendance")
        .select("id, student_id, subject_id, attendance_date, status, recorded_by")
        .not("subject_id", "is", null)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);
      if (dbAcademicYear) q = q.eq("academic_year", dbAcademicYear);
      if (semester && semester > 0) q = q.eq("semester", semester);
      const { data, error } = await q.limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  const studentById = useMemo(() => Object.fromEntries(students.map((s: any) => [s.id, s])), [students]);
  const classroomById = useMemo(() => Object.fromEntries(classrooms.map((c: any) => [c.id, c])), [classrooms]);
  const subjectById = useMemo(() => {
    const m: Record<string, any> = {};
    allowedSubjects.forEach((s: any) => { m[s.id] = s; });
    return m;
  }, [allowedSubjects]);

  // Filter records by role + filters
  const filteredRecords = useMemo(() => {
    return records.filter((r: any) => {
      if (!canSeeAll && !allowedSubjectIds.has(r.subject_id)) return false;
      const st = studentById[r.student_id];
      if (!st) return false;
      if (gradeFilter !== "all" && classroomById[st.classroom_id]?.grade_level !== gradeFilter) return false;
      if (classroomFilter !== "all" && st.classroom_id !== classroomFilter) return false;
      if (subjectFilter !== "all" && r.subject_id !== subjectFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const subj = subjectById[r.subject_id];
        const haystack = `${st.student_code || ""} ${st.first_name || ""} ${st.last_name || ""} ${subj?.name_th || ""} ${classroomById[st.classroom_id]?.name || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, canSeeAll, allowedSubjectIds, studentById, classroomById, subjectById, gradeFilter, classroomFilter, subjectFilter, search]);

  // % การมาเรียน = (present + late) / denom × 100
  const computeAttendanceRate = (present: number, late: number, denom: number) => {
    if (denom <= 0) return 0;
    return Math.round(((present + late) / denom) * 1000) / 10;
  };
  // Keep for backward compat naming
  const attendClass = (rate: number) =>
    rate >= 90 ? "bg-success-soft text-success-soft-foreground" : rate >= 80 ? "bg-warning-soft text-warning-soft-foreground" : "bg-danger-soft text-danger-soft-foreground";

  // Aggregate — ฐาน (denominator) = จำนวนคาบ (distinct subject+date) ที่ครูเช็ค
  const totals = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 };
    const periodSet = new Set<string>();
    filteredRecords.forEach((r: any) => {
      periodSet.add(`${r.subject_id}|${r.attendance_date}`);
      if ((c as any)[r.status] !== undefined) (c as any)[r.status]++;
    });
    c.total = periodSet.size;
    return c;
  }, [filteredRecords]);

  // global attendance rate = (present+late rows) / (periods × distinct students)
  const attendanceRate = useMemo(() => {
    const periodSet = new Set<string>();
    const stuSet = new Set<string>();
    filteredRecords.forEach((r: any) => {
      periodSet.add(`${r.subject_id}|${r.attendance_date}`);
      stuSet.add(r.student_id);
    });
    return computeAttendanceRate(totals.present, totals.late, periodSet.size * stuSet.size);
  }, [filteredRecords, totals]);

  // Group by classroom
  const byClassroom = useMemo(() => {
    const groups: Record<string, { classroom: any; rows: Record<string, any> }> = {};
    filteredRecords.forEach((r: any) => {
      const st = studentById[r.student_id];
      const cls = classroomById[st?.classroom_id];
      if (!cls) return;
      if (!groups[cls.id]) groups[cls.id] = { classroom: cls, rows: {} };
      if (!groups[cls.id].rows[r.subject_id]) {
        const subj = subjectById[r.subject_id];
        groups[cls.id].rows[r.subject_id] = { subject: subj, present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0, _dates: new Set<string>(), _students: new Set<string>() };
      }
      const row = groups[cls.id].rows[r.subject_id];
      row._dates.add(r.attendance_date);
      row._students.add(r.student_id);
      if (row[r.status] !== undefined) row[r.status]++;
    });
    // finalize: total = distinct periods (dates), denom = periods × students
    Object.values(groups).forEach((g: any) => {
      Object.values(g.rows).forEach((row: any) => {
        row.total = row._dates.size;
        row._denom = row._dates.size * row._students.size;
      });
    });
    return Object.values(groups).sort((a, b) => (a.classroom.name || "").localeCompare(b.classroom.name || ""));
  }, [filteredRecords, studentById, classroomById, subjectById]);

  // Group by subject
  const bySubject = useMemo(() => {
    const groups: Record<string, { subject: any; rows: Record<string, any> }> = {};
    filteredRecords.forEach((r: any) => {
      const subj = subjectById[r.subject_id];
      if (!subj) return;
      const st = studentById[r.student_id];
      const cls = classroomById[st?.classroom_id];
      if (!cls) return;
      if (!groups[subj.id]) groups[subj.id] = { subject: subj, rows: {} };
      if (!groups[subj.id].rows[cls.id]) {
        groups[subj.id].rows[cls.id] = { classroom: cls, present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0, _dates: new Set<string>(), _students: new Set<string>() };
      }
      const row = groups[subj.id].rows[cls.id];
      row._dates.add(r.attendance_date);
      row._students.add(r.student_id);
      if (row[r.status] !== undefined) row[r.status]++;
    });
    Object.values(groups).forEach((g: any) => {
      Object.values(g.rows).forEach((row: any) => {
        row.total = row._dates.size;
        row._denom = row._dates.size * row._students.size;
      });
    });
    return Object.values(groups).sort((a, b) => (a.subject.name_th || "").localeCompare(b.subject.name_th || ""));
  }, [filteredRecords, studentById, classroomById, subjectById]);

  // Per-student aggregate — ฐาน = จำนวนคาบที่นักเรียนถูกเช็ค (distinct subject+date)
  const byStudent = useMemo(() => {
    const map: Record<string, any> = {};
    filteredRecords.forEach((r: any) => {
      const st = studentById[r.student_id];
      if (!st) return;
      if (!map[st.id]) {
        map[st.id] = {
          student: st,
          classroom: classroomById[st.classroom_id],
          present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0,
          _periods: new Set<string>(),
        };
      }
      const row = map[st.id];
      row._periods.add(`${r.subject_id}|${r.attendance_date}`);
      if (row[r.status] !== undefined) row[r.status]++;
    });
    return Object.values(map)
      .map((r: any) => {
        const total = r._periods.size;
        return { ...r, total, rate: computeAttendanceRate(r.present, r.late, total) };
      })
      .sort((a: any, b: any) => (a.classroom?.name || "").localeCompare(b.classroom?.name || "") || (a.student.student_code || "").localeCompare(b.student.student_code || ""));
  }, [filteredRecords, studentById, classroomById]);

  // Detailed rows (for export)
  const detailRows = useMemo(() => {
    return filteredRecords.map((r: any) => {
      const st = studentById[r.student_id];
      const cls = classroomById[st?.classroom_id];
      const subj = subjectById[r.subject_id];
      return {
        date: r.attendance_date,
        code: st?.student_code || "",
        name: `${st?.prefix || ""}${st?.first_name || ""} ${st?.last_name || ""}`.trim(),
        classroom: cls?.name || "",
        subject: subj?.name_th || subj?.code || "",
        status: STATUS_LABEL[r.status]?.th || r.status,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRecords, studentById, classroomById, subjectById]);

  // Per-session rows (1 ครั้ง = 1 วัน × 1 วิชา × 1 ห้อง) — สำหรับ export
  const sessionRows = useMemo(() => {
    const map: Record<string, any> = {};
    filteredRecords.forEach((r: any) => {
      const st = studentById[r.student_id];
      const cls = classroomById[st?.classroom_id];
      const subj = subjectById[r.subject_id];
      if (!cls || !subj) return;
      const key = `${r.attendance_date}|${r.subject_id}|${cls.id}`;
      if (!map[key]) {
        map[key] = {
          date: r.attendance_date,
          subject: subj.name_th || subj.code || "",
          classroom: cls.name || "",
          present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0,
        };
      }
      const row = map[key];
      row.total++;
      if (row[r.status] !== undefined) row[r.status]++;
    });
    return Object.values(map).sort((a: any, b: any) =>
      b.date.localeCompare(a.date) ||
      (a.classroom || "").localeCompare(b.classroom || "") ||
      (a.subject || "").localeCompare(b.subject || "")
    );
  }, [filteredRecords, studentById, classroomById, subjectById]);


  const exportExcel = () => {
    if (filteredRecords.length === 0) {
      toast.error(lang === "th" ? "ไม่มีข้อมูลให้ส่งออก" : "No data");
      return;
    }
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summary = [
      ["รายงานการแสกนเช็คชื่อรายวิชา"],
      [`ช่วงวันที่: ${startDate} ถึง ${endDate}`],
      [],
      ["ประเภท", "จำนวน"],
      ["มา", totals.present],
      ["สาย", totals.late],
      ["ขาด", totals.absent],
      ["ป่วย", totals.sick],
      ["ลา", totals.leave],
      ["รวม", totals.total],
      ["% การมาเรียน (มา+สาย / คาบ × นักเรียน)", attendanceRate],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "สรุป");

    const rate = (present: number, late: number, denom: number) =>
      denom > 0 ? Math.round(((present + late) / denom) * 1000) / 10 : 0;

    // Sheet 2: By Classroom
    const byClassRows: any[] = [["ห้องเรียน", "วิชา", "มา", "สาย", "ขาด", "ป่วย", "ลา", "คาบที่เช็ค", "% มาเรียน"]];
    byClassroom.forEach((g: any) => {
      Object.values(g.rows).forEach((row: any) => {
        byClassRows.push([
          g.classroom.name, row.subject?.name_th || row.subject?.code || "",
          row.present, row.late, row.absent, row.sick, row.leave, row.total,
          rate(row.present, row.late, row._denom),
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byClassRows), "รายห้อง");

    // Sheet 3: By Subject
    const bySubRows: any[] = [["วิชา", "ห้องเรียน", "มา", "สาย", "ขาด", "ป่วย", "ลา", "คาบที่เช็ค", "% มาเรียน"]];
    bySubject.forEach((g: any) => {
      Object.values(g.rows).forEach((row: any) => {
        bySubRows.push([
          g.subject.name_th || g.subject.code, row.classroom.name,
          row.present, row.late, row.absent, row.sick, row.leave, row.total,
          rate(row.present, row.late, row._denom),
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bySubRows), "รายวิชา");

    // Sheet 4: By Student (% มาเรียน คิดจากจำนวนครั้งที่ครูเช็ค)
    const byStuRows: any[] = [["ห้องเรียน", "รหัส", "ชื่อ-สกุล", "มา", "สาย", "ขาด", "ป่วย", "ลา", "คาบที่เช็ค", "% มาเรียน"]];
    byStudent.forEach((r: any) => {
      byStuRows.push([
        r.classroom?.name || "", r.student.student_code || "",
        `${r.student.prefix || ""}${r.student.first_name || ""} ${r.student.last_name || ""}`.trim(),
        r.present, r.late, r.absent, r.sick, r.leave, r.total, r.rate,
      ]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byStuRows), "รายนักเรียน");

    // Sheet 5: Per-session (1 ครั้ง = 1 วัน × 1 วิชา × 1 ห้อง)
    const sessionHeader = [["วันที่", "ห้องเรียน", "วิชา", "จำนวนที่เช็ค", "มา", "สาย", "ขาด", "ป่วย", "ลา"]];
    const sessionData = sessionRows.map((r: any) => [r.date, r.classroom, r.subject, r.total, r.present, r.late, r.absent, r.sick, r.leave]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...sessionHeader, ...sessionData]), "รายครั้ง");

    // Sheet 6: Detail
    const detailHeader = [["วันที่", "รหัส", "ชื่อ-สกุล", "ห้องเรียน", "วิชา", "สถานะ"]];
    const detailData = detailRows.map(r => [r.date, r.code, r.name, r.classroom, r.subject, r.status]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...detailHeader, ...detailData]), "รายละเอียด");

    XLSX.writeFile(wb, `subject-scan-report-${startDate}-to-${endDate}.xlsx`);
    toast.success(lang === "th" ? "ส่งออก Excel แล้ว" : "Excel exported");
  };

  const exportPDF = async () => {
    if (filteredRecords.length === 0) {
      toast.error(lang === "th" ? "ไม่มีข้อมูลให้ส่งออก" : "No data");
      return;
    }
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    await registerThaiFont(doc);
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(18);
    doc.text("รายงานการแสกนเช็คชื่อรายวิชา", 148, 15, { align: "center" });
    doc.setFont("THSarabunNew", "normal");
    doc.setFontSize(14);
    doc.text(`ช่วงวันที่: ${startDate} ถึง ${endDate}`, 148, 22, { align: "center" });
    doc.text(
      `มา ${totals.present} • สาย ${totals.late} • ขาด ${totals.absent} • ป่วย ${totals.sick} • ลา ${totals.leave} • คาบที่เช็ค ${totals.total} • % มาเรียน ${attendanceRate}%`,
      148, 29, { align: "center" }
    );

    const rate = (present: number, late: number, denom: number) =>
      denom > 0 ? Math.round(((present + late) / denom) * 1000) / 10 + "%" : "-";
    const isClassView = view === "classroom";
    const isStudentView = view === "student";
    let head: any[][];
    const body: any[] = [];
    if (isStudentView) {
      head = [["ห้องเรียน", "รหัส", "ชื่อ-สกุล", "มา", "สาย", "ขาด", "ป่วย", "ลา", "คาบที่เช็ค", "% มาเรียน"]];
      byStudent.forEach((r: any) => {
        body.push([
          r.classroom?.name || "", r.student.student_code || "",
          `${r.student.prefix || ""}${r.student.first_name || ""} ${r.student.last_name || ""}`.trim(),
          r.present, r.late, r.absent, r.sick, r.leave, r.total, r.rate + "%",
        ]);
      });
    } else if (isClassView) {
      head = [["ห้องเรียน", "วิชา", "มา", "สาย", "ขาด", "ป่วย", "ลา", "คาบที่เช็ค", "% มาเรียน"]];
      byClassroom.forEach((g: any) => {
        Object.values(g.rows).forEach((row: any) => {
          body.push([g.classroom.name, row.subject?.name_th || row.subject?.code || "",
            row.present, row.late, row.absent, row.sick, row.leave, row.total, rate(row.present, row.late, row._denom)]);
        });
      });
    } else {
      head = [["วิชา", "ห้องเรียน", "มา", "สาย", "ขาด", "ป่วย", "ลา", "คาบที่เช็ค", "% มาเรียน"]];
      bySubject.forEach((g: any) => {
        Object.values(g.rows).forEach((row: any) => {
          body.push([g.subject.name_th || g.subject.code, row.classroom.name,
            row.present, row.late, row.absent, row.sick, row.leave, row.total, rate(row.present, row.late, row._denom)]);
        });
      });
    }

    autoTable(doc, {
      head, body, startY: 35,
      styles: { font: "THSarabunNew", fontSize: 12, cellPadding: 1.5 },
      headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [241, 145, 30] },
    });

    doc.save(`subject-scan-report-${startDate}-to-${endDate}.pdf`);
    toast.success(lang === "th" ? "ส่งออก PDF แล้ว" : "PDF exported");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">{lang === "th" ? "ตั้งแต่" : "From"}</Label>
              <BEDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ถึง" : "To"}</Label>
              <BEDatePicker value={endDate} onChange={setEndDate} />
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ระดับชั้น" : "Grade"}</Label>
              <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setClassroomFilter("all"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ห้องเรียน" : "Classroom"}</Label>
              <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {filteredClassroomOptions.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "วิชา" : "Subject"}</Label>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                  {allowedSubjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name_th || s.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{lang === "th" ? "ค้นหา" : "Search"}</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={lang === "th" ? "ชื่อ/รหัส/วิชา" : "Name/Code"} className="pl-8" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportExcel} variant="secondary" size="sm">
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button onClick={exportPDF} variant="secondary" size="sm">
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard icon={<Users className="w-5 h-5" />} label={lang === "th" ? "บันทึกทั้งหมด" : "Records"} value={totals.total} color="from-warning/20 to-warning/20" />
        <KpiCard icon={<CheckCircle2 className="w-5 h-5" />} label={lang === "th" ? "มา (ตรงเวลา)" : "On time"} value={totals.present} color="from-success/20 to-success/20" />
        <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label={lang === "th" ? "สาย" : "Late"} value={totals.late} color="from-warning/20 to-warning/20" />
        <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label={lang === "th" ? "ขาด" : "Absent"} value={totals.absent} color="from-danger/20 to-danger/20" />
        <KpiCard icon={<BookOpen className="w-5 h-5" />} label={lang === "th" ? "วิชาที่บันทึก" : "Subjects"} value={bySubject.length} color="from-info/20 to-info/20" />
        <Card className="bg-gradient-to-br from-info/10 to-danger/10">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{lang === "th" ? "% มาเรียน (รวมสาย)" : "Attendance %"}</p>
            <p className="text-2xl font-bold">{attendanceRate}%</p>
            <Progress value={Math.min(100, attendanceRate)} className="mt-2 h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1">{lang === "th" ? `มา ${totals.present} + สาย ${totals.late} / ${totals.total}` : `Checks ${totals.total}`}</p>
          </CardContent>
        </Card>
      </div>

      {/* Views */}
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="classroom">{lang === "th" ? "รายชั้น" : "By Classroom"}</TabsTrigger>
          <TabsTrigger value="subject">{lang === "th" ? "รายวิชา" : "By Subject"}</TabsTrigger>
          <TabsTrigger value="student">{lang === "th" ? "รายนักเรียน" : "By Student"}</TabsTrigger>
          <TabsTrigger value="detail">{lang === "th" ? "รายละเอียด" : "Detail"}</TabsTrigger>
        </TabsList>

        <TabsContent value="student" className="space-y-3">
          {!isLoading && byStudent.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{lang === "th" ? "ไม่พบข้อมูล" : "No data"}</CardContent></Card>
          )}
          {byStudent.length > 0 && (
            <Card>
              <CardContent className="pt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === "th" ? "ห้องเรียน" : "Classroom"}</TableHead>
                      <TableHead>{lang === "th" ? "รหัส" : "Code"}</TableHead>
                      <TableHead>{lang === "th" ? "ชื่อ-สกุล" : "Name"}</TableHead>
                      <TableHead className="text-right">{lang === "th" ? "คาบที่เช็ค" : "Checks"}</TableHead>
                      <TableHead className="text-right">มา</TableHead>
                      <TableHead className="text-right">สาย</TableHead>
                      <TableHead className="text-right">ขาด</TableHead>
                      <TableHead className="text-right">ป่วย</TableHead>
                      <TableHead className="text-right">ลา</TableHead>
                      <TableHead className="text-right">% มาเรียน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byStudent.map((r: any) => (
                      <TableRow key={r.student.id}>
                        <TableCell>{r.classroom?.name || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.student.student_code}</TableCell>
                        <TableCell>{`${r.student.prefix || ""}${r.student.first_name || ""} ${r.student.last_name || ""}`.trim()}</TableCell>
                        <TableCell className="text-right font-semibold">{r.total}</TableCell>
                        <TableCell className="text-right text-success">{r.present}</TableCell>
                        <TableCell className="text-right text-warning">{r.late}</TableCell>
                        <TableCell className="text-right text-danger">{r.absent}</TableCell>
                        <TableCell className="text-right text-info">{r.sick}</TableCell>
                        <TableCell className="text-right text-info">{r.leave}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={attendClass(r.rate)}>{r.rate}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="classroom" className="space-y-3">
          {isLoading && <Card><CardContent className="py-8 text-center text-muted-foreground">กำลังโหลด...</CardContent></Card>}
          {!isLoading && byClassroom.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{lang === "th" ? "ไม่พบข้อมูล" : "No data"}</CardContent></Card>
          )}
          {byClassroom.map((g: any) => (
            <Card key={g.classroom.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{g.classroom.name}</CardTitle></CardHeader>
              <CardContent>
                <SummaryTable rows={Object.values(g.rows)} firstKey="subject" firstLabel={lang === "th" ? "วิชา" : "Subject"} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="subject" className="space-y-3">
          {!isLoading && bySubject.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{lang === "th" ? "ไม่พบข้อมูล" : "No data"}</CardContent></Card>
          )}
          {bySubject.map((g: any) => (
            <Card key={g.subject.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{g.subject.name_th || g.subject.code}</CardTitle></CardHeader>
              <CardContent>
                <SummaryTable rows={Object.values(g.rows)} firstKey="classroom" firstLabel={lang === "th" ? "ห้องเรียน" : "Classroom"} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="detail">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "th" ? "วันที่" : "Date"}</TableHead>
                    <TableHead>{lang === "th" ? "รหัส" : "Code"}</TableHead>
                    <TableHead>{lang === "th" ? "ชื่อ-สกุล" : "Name"}</TableHead>
                    <TableHead>{lang === "th" ? "ห้องเรียน" : "Classroom"}</TableHead>
                    <TableHead>{lang === "th" ? "วิชา" : "Subject"}</TableHead>
                    <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.slice(0, 500).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.date}</TableCell>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.classroom}</TableCell>
                      <TableCell>{r.subject}</TableCell>
                      <TableCell>{r.status}</TableCell>
                    </TableRow>
                  ))}
                  {detailRows.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{lang === "th" ? "ไม่พบข้อมูล" : "No data"}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {detailRows.length > 500 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {lang === "th" ? `แสดง 500 จาก ${detailRows.length} แถว — ส่งออก Excel เพื่อดูทั้งหมด` : `Showing 500 of ${detailRows.length}`}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className={`bg-gradient-to-br ${color}`}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function SummaryTable({ rows, firstKey, firstLabel }: { rows: any[]; firstKey: "subject" | "classroom"; firstLabel: string }) {
  const sorted = [...rows].sort((a, b) => {
    const an = firstKey === "subject" ? (a.subject?.name_th || "") : (a.classroom?.name || "");
    const bn = firstKey === "subject" ? (b.subject?.name_th || "") : (b.classroom?.name || "");
    return an.localeCompare(bn);
  });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{firstLabel}</TableHead>
          <TableHead className="text-right">คาบที่เช็ค</TableHead>
          <TableHead className="text-right">มา</TableHead>
          <TableHead className="text-right">สาย</TableHead>
          <TableHead className="text-right">ขาด</TableHead>
          <TableHead className="text-right">ป่วย</TableHead>
          <TableHead className="text-right">ลา</TableHead>
          <TableHead className="text-right">% มาเรียน</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => {
          const total = r.total || 0;
          const denom = r._denom || 0;
          const rate = denom > 0 ? Math.round(((r.present + r.late) / denom) * 1000) / 10 : 0;
          const cls = rate >= 90 ? "bg-success-soft text-success-soft-foreground" : rate >= 80 ? "bg-warning-soft text-warning-soft-foreground" : "bg-danger-soft text-danger-soft-foreground";
          const name = firstKey === "subject" ? (r.subject?.name_th || r.subject?.code || "-") : (r.classroom?.name || "-");
          return (
            <TableRow key={i}>
              <TableCell>{name}</TableCell>
              <TableCell className="text-right font-semibold">{total || "-"}</TableCell>
              <TableCell className="text-right text-success">{r.present}</TableCell>
              <TableCell className="text-right text-warning">{r.late}</TableCell>
              <TableCell className="text-right text-danger">{r.absent}</TableCell>
              <TableCell className="text-right text-info">{r.sick}</TableCell>
              <TableCell className="text-right text-info">{r.leave}</TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className={cls}>{rate}%</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
