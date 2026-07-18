import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Printer, Search, User, BookOpen, BarChart3, GraduationCap } from "lucide-react";
import { calculateGPA, gradeColor } from "@/lib/gradeUtils";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const GRADE_LEVELS = [
  "ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6",
];
const thaiYear = (y?: number | null) => (y ? y + 543 : "-");

type PrintMode = "compact" | "full";

const StudentScoreDashboard = () => {
  const { userId, isAdmin, isDirector, isTeacher, isStudent } = useUserRole();
  const schoolInfo = useSchoolInfo();

  const [gradeLevel, setGradeLevel] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [academicYear, setAcademicYear] = useState<string>("");
  const [semester, setSemester] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [printMode, setPrintMode] = useState<PrintMode>("full");

  // Resolve current user → student (if isStudent) or personnel (if teacher)
  const { data: myStudent } = useQuery({
    queryKey: ["dash_my_student", userId],
    enabled: !!userId && isStudent,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, classroom_id, classrooms(grade_level)")
        .eq("auth_user_id", userId!)
        .maybeSingle();
      if (!data) return null;
      return { ...data, grade_level: (data as any).classrooms?.grade_level || "" };
    },
  });

  useEffect(() => {
    if (isStudent && myStudent) {
      setStudentId((myStudent as any).id);
      setClassroomId((myStudent as any).classroom_id || "");
      setGradeLevel((myStudent as any).grade_level || "");
    }
  }, [isStudent, myStudent]);

  const { data: myPersonnel } = useQuery({
    queryKey: ["dash_my_personnel", userId],
    enabled: !!userId && isTeacher && !isAdmin && !isDirector,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  // Classrooms — restricted for teachers (homeroom + teacher_assignments)
  const { data: allClassrooms = [] } = useQuery({
    queryKey: ["dash_classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
    enabled: !isStudent,
  });

  const { data: teacherAssigns = [] } = useQuery({
    queryKey: ["dash_teacher_assigns", myPersonnel?.id],
    enabled: !!myPersonnel?.id,
    queryFn: async () => {
      const { data } = await supabase.from("teacher_assignments").select("classroom_id").eq("personnel_id", myPersonnel!.id);
      return data || [];
    },
  });

  const { data: homeroomClassrooms = [] } = useQuery({
    queryKey: ["dash_homeroom", myPersonnel?.id],
    enabled: !!myPersonnel?.id,
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("id").eq("homeroom_teacher_id", myPersonnel!.id);
      return data || [];
    },
  });

  const restrictTeacher = isTeacher && !isAdmin && !isDirector;
  const allowedClassroomIds = useMemo(() => {
    const s = new Set<string>();
    teacherAssigns.forEach((t: any) => t.classroom_id && s.add(t.classroom_id));
    homeroomClassrooms.forEach((h: any) => s.add(h.id));
    return s;
  }, [teacherAssigns, homeroomClassrooms]);

  const classrooms = useMemo(() => {
    if (isStudent) return [];
    if (restrictTeacher) return allClassrooms.filter((c: any) => allowedClassroomIds.has(c.id));
    return allClassrooms;
  }, [allClassrooms, restrictTeacher, allowedClassroomIds, isStudent]);

  const filteredClassrooms = gradeLevel ? classrooms.filter((c: any) => c.grade_level === gradeLevel) : [];

  // Students of selected classroom
  const { data: classStudents = [] } = useQuery({
    queryKey: ["dash_students", classroomId],
    enabled: !!classroomId && !isStudent,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, classroom_id, classrooms(grade_level)")
        .eq("classroom_id", classroomId).eq("status", "active").order("student_code");
      return (data || []).map((s: any) => ({ ...s, grade_level: s.classrooms?.grade_level || "" }));
    },
  });

  const studentList = useMemo(() => {
    if (isStudent && myStudent) return [myStudent];
    const q = search.trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter((s: any) =>
      (s.student_code || "").toLowerCase().includes(q) ||
      `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase().includes(q)
    );
  }, [classStudents, search, isStudent, myStudent]);

  const selectedStudent: any = useMemo(
    () => studentList.find((s: any) => s.id === studentId) || (isStudent ? myStudent : null),
    [studentList, studentId, isStudent, myStudent]
  );

  // Scores across ALL subjects for the selected student
  const { data: scores = [] } = useQuery({
    queryKey: ["dash_scores", selectedStudent?.student_code, academicYear, semester],
    enabled: !!selectedStudent?.student_code,
    queryFn: async () => {
      let q = supabase.from("student_scores").select("*").eq("student_code", selectedStudent.student_code);
      if (academicYear) q = q.eq("academic_year", parseInt(academicYear));
      if (semester !== "all") q = q.eq("semester", parseInt(semester));
      const { data } = await q;
      return data || [];
    },
  });

  const subjectIds = useMemo(() => Array.from(new Set(scores.map((s: any) => s.subject_id).filter(Boolean))), [scores]);

  const { data: subjects = [] } = useQuery({
    queryKey: ["dash_subjects", subjectIds.join(",")],
    enabled: subjectIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, code, name_th, credits, grade_level").in("id", subjectIds);
      return data || [];
    },
  });

  // Build rows
  const rows = useMemo(() => {
    return scores.map((sc: any) => {
      const subj = subjects.find((s: any) => s.id === sc.subject_id);
      return {
        id: sc.id,
        code: subj?.code || "-",
        name: subj?.name_th || "(ไม่พบรายวิชา)",
        credits: Number(subj?.credits || 1),
        semester: sc.semester,
        academic_year: sc.academic_year,
        assignment: Number(sc.assignment_score || 0),
        midterm: Number(sc.midterm_score || 0),
        final: Number(sc.final_score || 0),
        attendance: Number(sc.attendance_score || 0),
        total: Number(sc.total_score || 0),
        grade: sc.grade || "-",
        grade_point: Number(sc.grade_point || 0),
      };
    }).sort((a, b) => (a.academic_year - b.academic_year) || (a.semester - b.semester) || a.code.localeCompare(b.code));
  }, [scores, subjects]);

  // KPI
  const gpa = useMemo(() => {
    const valid = rows.filter(r => !["ร", "มส", "-"].includes(r.grade));
    return calculateGPA(valid.map(r => ({ gradePoint: r.grade_point, credits: r.credits })));
  }, [rows]);

  const counts = useMemo(() => {
    const passed = rows.filter(r => r.grade_point >= 1).length;
    const failed = rows.filter(r => r.grade === "0").length;
    const incomplete = rows.filter(r => ["ร", "มส"].includes(r.grade)).length;
    const ungraded = rows.filter(r => r.grade === "-" || !r.grade).length;
    return { total: rows.length, passed, failed, incomplete, ungraded };
  }, [rows]);

  // Available year list from data
  const availableYears = useMemo(() => {
    const ys = Array.from(new Set(scores.map((s: any) => s.academic_year).filter(Boolean))).sort((a: any, b: any) => b - a);
    return ys as number[];
  }, [scores]);

  // Charts
  const barData = useMemo(
    () => rows.map(r => ({ name: r.code, grade: r.grade_point, total: r.total })),
    [rows]
  );

  const trendData = useMemo(() => {
    const map = new Map<string, { key: string; gpa: number; n: number }>();
    rows.forEach(r => {
      const k = `${(r.academic_year || 0) + 543}/${r.semester}`;
      const cur = map.get(k) || { key: k, gpa: 0, n: 0 };
      cur.gpa += r.grade_point * r.credits;
      cur.n += r.credits;
      map.set(k, cur);
    });
    return Array.from(map.values())
      .map(d => ({ key: d.key, gpa: d.n > 0 ? Math.round((d.gpa / d.n) * 100) / 100 : 0 }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  const handlePrint = () => {
    document.body.dataset.printMode = printMode;
    setTimeout(() => {
      window.print();
      setTimeout(() => { delete document.body.dataset.printMode; }, 500);
    }, 60);
  };

  const studentFullName = selectedStudent
    ? `${selectedStudent.prefix || ""}${selectedStudent.first_name || ""} ${selectedStudent.last_name || ""}`.trim()
    : "";

  return (
    <div className="space-y-4">
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #ssd-print, #ssd-print * { visibility: visible !important; }
          #ssd-print { position: absolute; left: 0; top: 0; width: 100%; padding: 16mm; background: white; color: black; }
          .ssd-no-print { display: none !important; }
          .ssd-page-break { page-break-after: always; }
          @page { size: A4; margin: 0; }
          body[data-print-mode="compact"] .ssd-charts { display: none !important; }
          body[data-print-mode="full"]    .ssd-charts { display: block !important; }
        }
        .ssd-charts { display: block; }
      `}</style>

      {/* Filters (not printed) */}
      <Card className="ssd-no-print">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" /> ค้นหานักเรียน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {!isStudent && (
              <>
                <div>
                  <Label className="text-xs">ระดับชั้น</Label>
                  <Select value={gradeLevel} onValueChange={v => { setGradeLevel(v); setClassroomId(""); setStudentId(""); }}>
                    <SelectTrigger><SelectValue placeholder="เลือกระดับชั้น" /></SelectTrigger>
                    <SelectContent>
                      {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">ห้องเรียน</Label>
                  <Select value={classroomId} onValueChange={v => { setClassroomId(v); setStudentId(""); }} disabled={!gradeLevel}>
                    <SelectTrigger><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
                    <SelectContent>
                      {filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">นักเรียน</Label>
                  <div className="flex gap-2">
                    <Input placeholder="ค้นชื่อ/รหัส" value={search} onChange={e => setSearch(e.target.value)} className="w-32" />
                    <Select value={studentId} onValueChange={setStudentId} disabled={!classroomId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger>
                      <SelectContent>
                        {studentList.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.student_code} — {s.first_name} {s.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">ปีการศึกษา</Label>
              <Select value={academicYear || "all"} onValueChange={v => setAcademicYear(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกปีการศึกษา</SelectItem>
                  {availableYears.map(y => <SelectItem key={y} value={String(y)}>{thaiYear(y)} ({y})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div>
              <Label className="text-xs">เทอม</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="1">เทอม 1</SelectItem>
                  <SelectItem value="2">เทอม 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">รูปแบบพิมพ์</Label>
              <RadioGroup value={printMode} onValueChange={(v: PrintMode) => setPrintMode(v)} className="flex gap-3 mt-1">
                <Label className="flex items-center gap-1 text-sm cursor-pointer">
                  <RadioGroupItem value="compact" /> แบบกระชับ (ไม่มีกราฟ)
                </Label>
                <Label className="flex items-center gap-1 text-sm cursor-pointer">
                  <RadioGroupItem value="full" /> แบบเต็ม (มีกราฟ)
                </Label>
              </RadioGroup>
            </div>
            <div className="ml-auto">
              <Button onClick={handlePrint} disabled={!selectedStudent} className="gap-2">
                <Printer className="w-4 h-4" /> พิมพ์รายงาน
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedStudent ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          {isStudent ? "กำลังโหลดข้อมูล…" : "กรุณาเลือกนักเรียนเพื่อดูแดชบอร์ดผลการเรียน"}
        </CardContent></Card>
      ) : (
        <div id="ssd-print" className="space-y-4">
          {/* Header */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{schoolInfo.school_name || "โรงเรียน"}</p>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" /> รายงานสรุปผลการเรียนรายบุคคล
                  </h2>
                  <div className="mt-2 text-sm space-y-0.5">
                    <p><span className="text-muted-foreground">นักเรียน:</span> <b>{studentFullName}</b></p>
                    <p><span className="text-muted-foreground">รหัสนักเรียน:</span> {selectedStudent.student_code} · <span className="text-muted-foreground">ระดับชั้น:</span> {selectedStudent.grade_level || "-"}</p>
                    <p className="text-xs text-muted-foreground">
                      {academicYear ? `ปีการศึกษา ${thaiYear(parseInt(academicYear))}` : "ทุกปีการศึกษา"}
                      {semester !== "all" ? ` · เทอม ${semester}` : ""}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 min-w-[260px]">
                  <div className="rounded-lg bg-primary/10 p-3 text-center">
                    <div className="text-xs text-muted-foreground">GPA สะสม</div>
                    <div className="text-2xl font-bold text-primary">{gpa.toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <div className="text-xs text-muted-foreground">รายวิชาทั้งหมด</div>
                    <div className="text-2xl font-bold">{counts.total}</div>
                  </div>
                  <div className="rounded-lg bg-success/10 p-3 text-center">
                    <div className="text-xs text-muted-foreground">ผ่าน</div>
                    <div className="text-xl font-bold text-success">{counts.passed}</div>
                  </div>
                  <div className="rounded-lg bg-destructive/10 p-3 text-center">
                    <div className="text-xs text-muted-foreground">ตก/ไม่ผ่าน</div>
                    <div className="text-xl font-bold text-destructive">{counts.failed + counts.incomplete}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {rows.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">ยังไม่มีข้อมูลคะแนนสำหรับนักเรียนนี้</CardContent></Card>
          ) : (
            <>
              {/* Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> ผลการเรียนรายวิชา
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>รหัสวิชา</TableHead>
                        <TableHead>รายวิชา</TableHead>
                        <TableHead className="text-center">นก.</TableHead>
                        <TableHead className="text-center">ปี/เทอม</TableHead>
                        <TableHead className="text-right">เก็บ</TableHead>
                        <TableHead className="text-right">กลางภาค</TableHead>
                        <TableHead className="text-right">ปลายภาค</TableHead>
                        <TableHead className="text-right">รวม</TableHead>
                        <TableHead className="text-center">เกรด</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={r.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{r.code}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell className="text-center">{r.credits}</TableCell>
                          <TableCell className="text-center text-xs">{thaiYear(r.academic_year)}/{r.semester}</TableCell>
                          <TableCell className="text-right">{r.assignment || "-"}</TableCell>
                          <TableCell className="text-right">{r.midterm || "-"}</TableCell>
                          <TableCell className="text-right">{r.final || "-"}</TableCell>
                          <TableCell className="text-right font-semibold">{r.total || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={gradeColor(r.grade)}>{r.grade}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Charts (only in full mode) */}
              <div className="ssd-charts grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> เกรดต่อรายวิชา
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                        <YAxis domain={[0, 4]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="grade" name="เกรด">
                          {barData.map((d, i) => (
                            <Cell key={i} fill={d.grade >= 3 ? "#16a34a" : d.grade >= 2 ? "#2563eb" : d.grade >= 1 ? "#f59e0b" : "#dc2626"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> แนวโน้ม GPA ต่อภาคเรียน
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 4]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="gpa" name="GPA" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Signatures (print only) */}
              <div className="hidden print:flex justify-around pt-12 text-sm">
                <div className="text-center">
                  <div className="border-b border-black w-44 mb-1" />
                  <div>ครูประจำชั้น</div>
                </div>
                <div className="text-center">
                  <div className="border-b border-black w-44 mb-1" />
                  <div>{schoolInfo.director_name || "ผู้อำนวยการ"}</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentScoreDashboard;
