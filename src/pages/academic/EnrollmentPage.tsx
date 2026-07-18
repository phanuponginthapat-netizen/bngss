import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Plus, Users, UserPlus, BookOpen, Trash2, School, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { BE_OFFSET } from "@/lib/dateBE";

interface Classroom { id: string; name: string; grade_level: string; academic_year: number; homeroom_teacher: string | null; capacity: number | null; }
interface Student { id: string; student_code: string; prefix: string | null; first_name: string; last_name: string; classroom_id: string | null; status: string; }
interface Subject { id: string; code: string; name_th: string; credits: number; grade_level: string | null; semester?: number | null; }
interface Enrollment { id: string; student_id: string; subject_id: string; classroom_id: string | null; semester: number | null; academic_year: number; enrollment_type: string; status: string; enrolled_at: string; }

const GRADE_LEVELS = ["อ.1", "อ.2", "อ.3", "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6", "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6", "การศึกษาพิเศษ"];

const EnrollmentPage = () => {
  const { lang } = useLanguage();
  const { isAdmin, isDirector } = useUserRole();
  const canEdit = isAdmin || isDirector;
  const [allClassrooms, setAllClassrooms] = useState<Classroom[]>([]);
  const [gradeLevel, setGradeLevel] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [search, setSearch] = useState("");

  const classrooms = useMemo(() => gradeLevel ? allClassrooms.filter(c => c.grade_level === gradeLevel) : [], [allClassrooms, gradeLevel]);

  // Dialogs
  const [classroomDialog, setClassroomDialog] = useState(false);
  const [studentDialog, setStudentDialog] = useState(false);
  const [enrollDialog, setEnrollDialog] = useState(false);

  // Forms
  const [classroomForm, setClassroomForm] = useState({ name: "", grade_level: "", homeroom_teacher: "", capacity: "40" });
  const [studentForm, setStudentForm] = useState({ student_code: "", prefix: "ด.ช.", first_name: "", last_name: "", classroom_id: "" });
  const [enrollSemester, setEnrollSemester] = useState("1");
  const [enrollYear, setEnrollYear] = useState(String(new Date().getFullYear() + BE_OFFSET));
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Filter subjects by selected semester and classroom's grade level
  const selectedClassroomData = useMemo(() => classrooms.find(c => c.id === selectedClassroom), [classrooms, selectedClassroom]);
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const semesterMatch = !s.semester || String(s.semester) === enrollSemester;
      const gradeMatch = !selectedClassroomData || !s.grade_level || s.grade_level === selectedClassroomData.grade_level;
      return semesterMatch && gradeMatch;
    });
  }, [subjects, enrollSemester, selectedClassroomData]);

  useEffect(() => {
    fetchClassrooms();
    fetchSubjects();
  }, []);

  // Realtime sync — re-bind when selection changes so closures capture current ids
  useEffect(() => {
    const channel = supabase
      .channel(`enrollment-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "classrooms" }, () => fetchClassrooms())
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "subjects" }, () => fetchSubjects())
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "students" }, () => { if (selectedClassroom) fetchStudentsByClassroom(selectedClassroom); })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "enrollments" }, () => { if (selectedSubject) fetchEnrollmentsBySubject(selectedSubject); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedClassroom, selectedSubject]);

  useEffect(() => {
    if (selectedClassroom) fetchStudentsByClassroom(selectedClassroom);
  }, [selectedClassroom]);

  useEffect(() => {
    if (selectedSubject) fetchEnrollmentsBySubject(selectedSubject);
  }, [selectedSubject]);

  const fetchClassrooms = async () => {
    const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
    setAllClassrooms(data || []);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from("subjects").select("*").order("code");
    setSubjects(data || []);
  };

  const fetchStudentsByClassroom = async (classroomId: string) => {
    const { data } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, classroom_id, status").eq("classroom_id", classroomId).order("student_code");
    setStudents(data || []);
  };

  const fetchAllStudents = async () => {
    const { data } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, classroom_id, status").eq("status", "active").order("student_code");
    return data || [];
  };

  const fetchEnrollmentsBySubject = async (subjectId: string) => {
    const { data } = await supabase.from("enrollments").select("*").eq("subject_id", subjectId).order("enrolled_at");
    setEnrollments(data || []);
  };

  // Add classroom
  const handleAddClassroom = async () => {
    if (!classroomForm.name || !classroomForm.grade_level) { toast.error("กรุณากรอกชื่อห้องและระดับชั้น"); return; }
    const { error } = await supabase.from("classrooms").insert({
      name: classroomForm.name,
      grade_level: classroomForm.grade_level,
      homeroom_teacher: classroomForm.homeroom_teacher || null,
      capacity: parseInt(classroomForm.capacity) || 40,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("เพิ่มห้องเรียนสำเร็จ");
    setClassroomDialog(false);
    setClassroomForm({ name: "", grade_level: "", homeroom_teacher: "", capacity: "40" });
    fetchClassrooms();
  };

  // Add student
  const handleAddStudent = async () => {
    if (!studentForm.student_code || !studentForm.first_name || !studentForm.last_name) {
      toast.error("กรุณากรอกข้อมูลให้ครบ"); return;
    }
    const { error } = await supabase.from("students").insert({
      student_code: studentForm.student_code,
      prefix: studentForm.prefix,
      first_name: studentForm.first_name,
      last_name: studentForm.last_name,
      classroom_id: studentForm.classroom_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("เพิ่มนักเรียนสำเร็จ");
    setStudentDialog(false);
    setStudentForm({ student_code: "", prefix: "ด.ช.", first_name: "", last_name: "", classroom_id: "" });
    if (selectedClassroom) fetchStudentsByClassroom(selectedClassroom);
  };

  // Enroll entire classroom
  const handleEnrollClassroom = async () => {
    if (!selectedClassroom || !selectedSubject) { toast.error("กรุณาเลือกห้องเรียนและรายวิชา"); return; }
    const classStudents = students;
    if (classStudents.length === 0) { toast.error("ไม่มีนักเรียนในห้องเรียนนี้"); return; }

    const enrollData = classStudents.map((s) => ({
      student_id: s.id,
      subject_id: selectedSubject,
      classroom_id: selectedClassroom,
      semester: parseInt(enrollSemester),
      academic_year: parseInt(enrollYear) - BE_OFFSET,
      enrollment_type: "classroom" as const,
    }));

    const { error } = await supabase.from("enrollments").upsert(enrollData, { onConflict: "student_id,subject_id,semester,academic_year" });
    if (error) { toast.error(error.message); return; }
    toast.success(`ลงทะเบียนรายห้อง ${classStudents.length} คนสำเร็จ`);
    fetchEnrollmentsBySubject(selectedSubject);
  };

  // Enroll selected individuals
  const handleEnrollIndividual = async () => {
    if (selectedStudentIds.length === 0 || !selectedSubject) { toast.error("กรุณาเลือกนักเรียนและรายวิชา"); return; }

    const enrollData = selectedStudentIds.map((sid) => ({
      student_id: sid,
      subject_id: selectedSubject,
      classroom_id: selectedClassroom || null,
      semester: parseInt(enrollSemester),
      academic_year: parseInt(enrollYear) - BE_OFFSET,
      enrollment_type: "individual" as const,
    }));

    const { error } = await supabase.from("enrollments").upsert(enrollData, { onConflict: "student_id,subject_id,semester,academic_year" });
    if (error) { toast.error(error.message); return; }
    toast.success(`ลงทะเบียนรายบุคคล ${selectedStudentIds.length} คนสำเร็จ`);
    setSelectedStudentIds([]);
    fetchEnrollmentsBySubject(selectedSubject);
  };

  // Remove enrollment
  const handleRemoveEnrollment = async (id: string) => {
    const { error } = await supabase.from("enrollments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ถอนการลงทะเบียนสำเร็จ");
    fetchEnrollmentsBySubject(selectedSubject);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  };

  // Get student name from enrollment
  const getStudentInfo = (studentId: string) => {
    const s = students.find((st) => st.id === studentId);
    return s ? `${s.prefix || ""}${s.first_name} ${s.last_name}` : studentId.slice(0, 8);
  };

  const filteredStudents = students.filter((s) =>
    s.student_code.includes(search) || s.first_name.includes(search) || s.last_name.includes(search)
  );

  return (
    <div className="space-y-6">
      {canEdit && (
      <div className="flex items-center justify-end flex-wrap gap-3">
        <div className="flex gap-2">
          <Dialog open={classroomDialog} onOpenChange={setClassroomDialog}>
            <DialogTrigger asChild>
              <Button variant="outline"><School className="w-4 h-4 mr-1" /> {lang === "th" ? "เพิ่มห้องเรียน" : "Add Classroom"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{lang === "th" ? "เพิ่มห้องเรียนใหม่" : "Add New Classroom"}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{lang === "th" ? "ชื่อห้อง" : "Classroom"}</Label>
                    <Input placeholder="ม.1/1" value={classroomForm.name} onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{lang === "th" ? "ระดับชั้น" : "Grade Level"}</Label>
                    <Input placeholder="ม.1" value={classroomForm.grade_level} onChange={(e) => setClassroomForm({ ...classroomForm, grade_level: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{lang === "th" ? "ครูประจำชั้น" : "Homeroom Teacher"}</Label>
                    <Input value={classroomForm.homeroom_teacher} onChange={(e) => setClassroomForm({ ...classroomForm, homeroom_teacher: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{lang === "th" ? "ความจุ" : "Capacity"}</Label>
                    <Input type="number" value={classroomForm.capacity} onChange={(e) => setClassroomForm({ ...classroomForm, capacity: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setClassroomDialog(false)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
                  <Button onClick={handleAddClassroom} className="gradient-primary text-primary-foreground">{lang === "th" ? "บันทึก" : "Save"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={studentDialog} onOpenChange={setStudentDialog}>
            <DialogTrigger asChild>
              <Button variant="outline"><UserPlus className="w-4 h-4 mr-1" /> {lang === "th" ? "เพิ่มนักเรียน" : "Add Student"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{lang === "th" ? "เพิ่มนักเรียนใหม่" : "Add New Student"}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{lang === "th" ? "รหัสนักเรียน" : "Student Code"}</Label>
                    <Input placeholder="65001" value={studentForm.student_code} onChange={(e) => setStudentForm({ ...studentForm, student_code: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{lang === "th" ? "คำนำหน้า" : "Prefix"}</Label>
                    <Select value={studentForm.prefix} onValueChange={(v) => setStudentForm({ ...studentForm, prefix: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ด.ช.">ด.ช.</SelectItem>
                        <SelectItem value="ด.ญ.">ด.ญ.</SelectItem>
                        <SelectItem value="นาย">นาย</SelectItem>
                        <SelectItem value="น.ส.">น.ส.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{lang === "th" ? "ชื่อจริง" : "First Name"}</Label>
                    <Input value={studentForm.first_name} onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{lang === "th" ? "นามสกุล" : "Last Name"}</Label>
                    <Input value={studentForm.last_name} onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{lang === "th" ? "ห้องเรียน" : "Classroom"}</Label>
                  <Select value={studentForm.classroom_id} onValueChange={(v) => setStudentForm({ ...studentForm, classroom_id: v })}>
                    <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกห้อง" : "Select classroom"} /></SelectTrigger>
                    <SelectContent>
                      {classrooms.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setStudentDialog(false)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
                  <Button onClick={handleAddStudent} className="gradient-primary text-primary-foreground">{lang === "th" ? "บันทึก" : "Save"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      )}

      <Tabs defaultValue={canEdit ? "classroom" : "view"} className="space-y-4">
        <TabsList>
          {canEdit && <TabsTrigger value="classroom" className="gap-1.5"><Users className="w-3.5 h-3.5" /> {lang === "th" ? "ลงทะเบียนรายห้อง" : "By Classroom"}</TabsTrigger>}
          {canEdit && <TabsTrigger value="individual" className="gap-1.5"><UserPlus className="w-3.5 h-3.5" /> {lang === "th" ? "ลงทะเบียนรายบุคคล" : "Individual"}</TabsTrigger>}
          <TabsTrigger value="view" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {lang === "th" ? "ดูรายชื่อ" : "View Enrolled"}</TabsTrigger>
        </TabsList>

        {/* Classroom enrollment */}
        <TabsContent value="classroom" className="space-y-4">
          <Card className="shadow-card border-0">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "ระดับชั้น" : "Grade Level"}</Label>
                  <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setSelectedClassroom(""); setSelectedSubject(""); }}>
                    <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกระดับชั้น" : "Select Grade"} /></SelectTrigger>
                    <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "เลือกห้องเรียน" : "Classroom"}</Label>
                  <Select value={selectedClassroom} onValueChange={setSelectedClassroom} disabled={!gradeLevel}>
                    <SelectTrigger><SelectValue placeholder={gradeLevel ? (lang === "th" ? "เลือกห้อง" : "Select") : (lang === "th" ? "เลือกระดับชั้นก่อน" : "Select grade first")} /></SelectTrigger>
                    <SelectContent>
                      {classrooms.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "เลือกรายวิชา" : "Subject"}</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกวิชา" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {filteredSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.code} - {s.name_th}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "ภาคเรียน" : "Semester"}</Label>
                  <Select value={enrollSemester} onValueChange={setEnrollSemester}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "ปีการศึกษา" : "Year"}</Label>
                  <Input value={enrollYear} onChange={(e) => setEnrollYear(e.target.value)} />
                </div>
              </div>

              {selectedClassroom && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    {lang === "th" ? `นักเรียนในห้อง: ${students.length} คน` : `Students in class: ${students.length}`}
                  </p>
                  <Button onClick={handleEnrollClassroom} className="gradient-primary text-primary-foreground" disabled={!selectedSubject}>
                    <Users className="w-4 h-4 mr-1" /> {lang === "th" ? "ลงทะเบียนทั้งห้อง" : "Enroll Entire Class"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student list in selected classroom */}
          {selectedClassroom && students.length > 0 && (
            <Card className="shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{lang === "th" ? "รายชื่อนักเรียนในห้อง" : "Students in Classroom"}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>{lang === "th" ? "รหัส" : "Code"}</TableHead>
                      <TableHead>{lang === "th" ? "ชื่อ-สกุล" : "Name"}</TableHead>
                      <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                        <TableCell className="font-medium">{s.prefix}{s.first_name} {s.last_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={s.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                            {s.status === "active" ? (lang === "th" ? "ปกติ" : "Active") : s.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Individual enrollment */}
        <TabsContent value="individual" className="space-y-4">
          <Card className="shadow-card border-0">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "ระดับชั้น" : "Grade Level"}</Label>
                  <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setSelectedClassroom(""); setSelectedSubject(""); }}>
                    <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกระดับชั้น" : "Select Grade"} /></SelectTrigger>
                    <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "เลือกห้องเรียน" : "Classroom"}</Label>
                  <Select value={selectedClassroom} onValueChange={setSelectedClassroom} disabled={!gradeLevel}>
                    <SelectTrigger><SelectValue placeholder={gradeLevel ? (lang === "th" ? "เลือกห้อง" : "Select") : (lang === "th" ? "เลือกระดับชั้นก่อน" : "Select grade first")} /></SelectTrigger>
                    <SelectContent>
                      {classrooms.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "เลือกรายวิชา" : "Subject"}</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกวิชา" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {filteredSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.code} - {s.name_th}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "ภาคเรียน" : "Semester"}</Label>
                  <Select value={enrollSemester} onValueChange={setEnrollSemester}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "ปีการศึกษา" : "Year"}</Label>
                  <Input value={enrollYear} onChange={(e) => setEnrollYear(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedClassroom && (
            <Card className="shadow-card border-0">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {lang === "th" ? "เลือกนักเรียน" : "Select Students"} ({selectedStudentIds.length}/{students.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <div className="relative w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input placeholder={lang === "th" ? "ค้นหา..." : "Search..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                    </div>
                    <Button size="sm" variant="outline" onClick={toggleAll}>
                      {selectedStudentIds.length === students.length ? (lang === "th" ? "ยกเลิกทั้งหมด" : "Deselect All") : (lang === "th" ? "เลือกทั้งหมด" : "Select All")}
                    </Button>
                    <Button size="sm" onClick={handleEnrollIndividual} className="gradient-primary text-primary-foreground" disabled={selectedStudentIds.length === 0 || !selectedSubject}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> {lang === "th" ? "ลงทะเบียน" : "Enroll"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>{lang === "th" ? "รหัส" : "Code"}</TableHead>
                      <TableHead>{lang === "th" ? "ชื่อ-สกุล" : "Name"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((s, i) => (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => toggleStudent(s.id)}>
                        <TableCell>
                          <Checkbox checked={selectedStudentIds.includes(s.id)} onCheckedChange={() => toggleStudent(s.id)} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                        <TableCell className="font-medium">{s.prefix}{s.first_name} {s.last_name}</TableCell>
                      </TableRow>
                    ))}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {lang === "th" ? "ไม่มีนักเรียนในห้อง กรุณาเพิ่มนักเรียนก่อน" : "No students in classroom"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* View enrolled students */}
        <TabsContent value="view" className="space-y-4">
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "ระดับชั้น" : "Grade Level"}</Label>
                  <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setSelectedSubject(""); }}>
                    <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกระดับชั้น" : "Select Grade"} /></SelectTrigger>
                    <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{lang === "th" ? "เลือกรายวิชา" : "Subject"}</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!gradeLevel}>
                    <SelectTrigger><SelectValue placeholder={gradeLevel ? (lang === "th" ? "เลือกวิชา" : "Select") : (lang === "th" ? "เลือกระดับชั้นก่อน" : "Select grade first")} /></SelectTrigger>
                    <SelectContent>
                      {filteredSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.code} - {s.name_th}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <p className="text-sm text-muted-foreground">
                    {lang === "th" ? `จำนวนผู้ลงทะเบียน: ${enrollments.length} คน` : `Enrolled: ${enrollments.length} students`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedSubject && (
            <Card className="shadow-card border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>{lang === "th" ? "รหัสนักเรียน" : "Student ID"}</TableHead>
                      <TableHead>{lang === "th" ? "ประเภท" : "Type"}</TableHead>
                      <TableHead>{lang === "th" ? "ภาคเรียน" : "Semester"}</TableHead>
                      <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {lang === "th" ? "ยังไม่มีผู้ลงทะเบียน" : "No enrollments yet"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      enrollments.map((e, i) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{e.student_id.slice(0, 8)}...</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={e.enrollment_type === "classroom" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}>
                              {e.enrollment_type === "classroom" ? (lang === "th" ? "รายห้อง" : "Classroom") : (lang === "th" ? "รายบุคคล" : "Individual")}
                            </Badge>
                          </TableCell>
                          <TableCell>{e.semester}/{(e.academic_year || 0) + BE_OFFSET}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-success/10 text-success">
                              {e.status === "active" ? (lang === "th" ? "ปกติ" : "Active") : e.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveEnrollment(e.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnrollmentPage;
