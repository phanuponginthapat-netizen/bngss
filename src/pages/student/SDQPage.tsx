import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCmsValue } from "@/hooks/useCmsSettings";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useStudentData } from "@/hooks/useStudentData";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Trash2, Power, BarChart3, Users, User, Eye } from "lucide-react";
import { BE_OFFSET } from "@/lib/dateBE";
import { notifyStudentEvent } from "@/lib/notifyStudentEvent";

const SDQPage = () => {
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const { user: authUser } = useAuthSession();
  const studentData = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const [academicYear, setAcademicYear] = useState(0);
  const [semester, setSemester] = useState(0);
  if (academicYear === 0 && currentAcademicYear > 0) { setAcademicYear(currentAcademicYear); setSemester(currentSemester); }

  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<string | null>(null);

  // Use studentData for filters
  const filterGrade = studentData.gradeFilter;
  const setFilterGrade = studentData.setGradeFilter;
  const filterClassroom = studentData.classroomFilter;
  const setFilterClassroom = studentData.setClassroomFilter;
  const [filterType, setFilterType] = useState("all");

  // Form
  const [formClassroom, setFormClassroom] = useState("");
  const [studentId, setStudentId] = useState("");
  const [assessor, setAssessor] = useState("");
  const [assessmentType, setAssessmentType] = useState("teacher");
  const [emotional, setEmotional] = useState("0");
  const [conduct, setConduct] = useState("0");
  const [hyper, setHyper] = useState("0");
  const [peer, setPeer] = useState("0");
  const [prosocial, setProsocial] = useState("0");

  // SDQ enabled toggle — read via bulk cache
  const sdqEnabledRaw = useCmsValue("sdq_enabled");
  const sdqEnabled = sdqEnabledRaw === "true";

  const toggleSDQ = async () => {
    const newVal = sdqEnabled ? "false" : "true";
    const { data: existing } = await supabase.from("cms_settings").select("id").eq("key", "sdq_enabled").maybeSingle();
    if (existing) {
      await supabase.from("cms_settings").update({ value: newVal } as any).eq("key", "sdq_enabled");
    } else {
      await supabase.from("cms_settings").insert({ key: "sdq_enabled", value: newVal } as any);
    }
    qc.invalidateQueries({ queryKey: ["cms_settings_bulk"] });
    toast.success(newVal === "true" ? "เปิดระบบประเมิน SDQ สำหรับผู้ปกครอง" : "ปิดระบบประเมิน SDQ สำหรับผู้ปกครอง");
  };

  const { data: profile } = useQuery({
    queryKey: ["my-profile", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
      return data;
    },
  });

  const classrooms = studentData.classrooms;
  const allStudents = studentData.students;

  // Students for the form (filtered by selected classroom)
  const students = useMemo(() => {
    if (!formClassroom) return allStudents;
    return allStudents.filter((s: any) => s.classroom_id === formClassroom);
  }, [allStudents, formClassroom]);

  // Scope: teachers only see SDQ of students in their homeroom
  const scopedStudentIds = useMemo(() => {
    if (!studentData.homeroomClassroomIds) return null;
    return studentData.students
      .filter((s: any) => studentData.homeroomClassroomIds!.includes(s.classroom_id))
      .map((s: any) => s.id);
  }, [studentData.homeroomClassroomIds, studentData.students]);

  const { data: records = [] } = useQuery({
    queryKey: ["sdq_records", filterClassroom, filterType, academicYear, scopedStudentIds?.join(",") || "all"],
    queryFn: async () => {
      let q = supabase.from("sdq_records").select("*, students(student_code, prefix, first_name, last_name, classroom_id, classrooms!students_classroom_id_fkey(name, grade_level))").order("created_at", { ascending: false });
      if (filterType && filterType !== "all") {
        q = q.eq("assessment_type", filterType);
      }
      if (academicYear > 0) {
        q = q.eq("academic_year", academicYear - BE_OFFSET);
      }
      // Apply homeroom scope first
      if (scopedStudentIds) {
        if (scopedStudentIds.length === 0) return [];
        q = q.in("student_id", scopedStudentIds);
      }
      if (filterClassroom && filterClassroom !== "all") {
        let sids = allStudents.filter((s: any) => s.classroom_id === filterClassroom).map((s: any) => s.id);
        if (scopedStudentIds) sids = sids.filter((id: string) => scopedStudentIds.includes(id));
        if (sids.length > 0) {
          q = q.in("student_id", sids);
        } else {
          return [];
        }
      }
      const { data } = await q;
      return data || [];
    },
    enabled: academicYear > 0,
  });

  useEffect(() => {
    if (profile) {
      setAssessor(`${profile.first_name || ""} ${profile.last_name || ""}`.trim());
    }
  }, [profile]);

  const availableClassrooms = studentData.availableClassrooms;
  const gradeLevels = [...new Set(availableClassrooms.map((c: any) => c.grade_level))].sort();
  const filteredClassrooms = studentData.filteredClassrooms;

  // Summary stats
  const summary = useMemo(() => {
    const normal = records.filter((r: any) => r.total_difficulty <= 13).length;
    const borderline = records.filter((r: any) => r.total_difficulty > 13 && r.total_difficulty <= 16).length;
    const abnormal = records.filter((r: any) => r.total_difficulty > 16).length;
    const total = records.length;
    const teacherRecords = records.filter((r: any) => r.assessment_type === "teacher");
    const parentRecords = records.filter((r: any) => r.assessment_type === "parent");
    return { normal, borderline, abnormal, total, teacherRecords: teacherRecords.length, parentRecords: parentRecords.length };
  }, [records]);

  // Roster per-student — start from filtered students so "ยังไม่ประเมิน" ก็ขึ้น
  const rosterStudents = useMemo(() => {
    let list = studentData.students as any[];
    if (studentData.homeroomClassroomIds) {
      list = list.filter((s: any) => studentData.homeroomClassroomIds!.includes(s.classroom_id));
    }
    if (filterGrade !== "all") {
      const ids = new Set(filteredClassrooms.map((c: any) => c.id));
      list = list.filter((s: any) => ids.has(s.classroom_id));
    }
    if (filterClassroom && filterClassroom !== "all") {
      list = list.filter((s: any) => s.classroom_id === filterClassroom);
    }
    return list;
  }, [studentData.students, studentData.homeroomClassroomIds, filterGrade, filterClassroom, filteredClassrooms]);

  const studentSummary = useMemo(() => {
    const map = new Map<string, { student: any; teacher: any[]; parent: any[] }>();
    rosterStudents.forEach((s: any) => {
      map.set(s.id, { student: s, teacher: [], parent: [] });
    });
    records.forEach((r: any) => {
      let entry = map.get(r.student_id);
      if (!entry) {
        entry = { student: r.students, teacher: [], parent: [] };
        map.set(r.student_id, entry);
      }
      if (r.assessment_type === "parent") entry.parent.push(r);
      else entry.teacher.push(r);
    });
    return Array.from(map.values());
  }, [records, rosterStudents]);

  // Individual student records for detail view
  const viewStudentRecords = useMemo(() => {
    if (!viewStudent) return { teacher: [], parent: [], student: null as any };
    const teacher = records.filter((r: any) => r.student_id === viewStudent && r.assessment_type !== "parent");
    const parent = records.filter((r: any) => r.student_id === viewStudent && r.assessment_type === "parent");
    const student = records.find((r: any) => r.student_id === viewStudent)?.students;
    return { teacher, parent, student };
  }, [records, viewStudent]);

  const resetForm = () => {
    setStudentId(""); setFormClassroom(""); setEmotional("0"); setConduct("0");
    setHyper("0"); setPeer("0"); setProsocial("0"); setAssessmentType("teacher");
  };

  const handleAdd = async () => {
    if (!studentId) { toast.error("กรุณาเลือกนักเรียน"); return; }
    const total = [emotional, conduct, hyper, peer].reduce((a, b) => a + parseInt(b || "0"), 0);
    const { data: inserted, error } = await supabase.from("sdq_records").insert({
      student_id: studentId,
      emotional_score: parseInt(emotional || "0"),
      conduct_score: parseInt(conduct || "0"),
      hyperactivity_score: parseInt(hyper || "0"),
      peer_score: parseInt(peer || "0"),
      prosocial_score: parseInt(prosocial || "0"),
      total_difficulty: total,
      assessment_by: assessor,
      assessment_type: assessmentType,
      academic_year: academicYear > 0 ? academicYear - BE_OFFSET : undefined,
    } as any).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกสำเร็จ");
    qc.invalidateQueries({ queryKey: ["sdq_records"] });

    // Spider-web: notify parents + homeroom teacher, especially if score is in risk zone (17+)
    const isRisk = total >= 17;
    notifyStudentEvent({
      student_id: studentId,
      title: isRisk ? "⚠️ ผล SDQ มีความเสี่ยง" : "บันทึกผล SDQ ใหม่",
      body: `คะแนนรวม ${total}/40${isRisk ? " (อยู่ในเกณฑ์เสี่ยง)" : ""}`,
      type: "sdq",
      severity: isRisk ? "warning" : "info",
      reference_id: inserted?.id,
      reference_type: "sdq_records",
      url: "/dashboard/student/sdq",
      audience: { student: false, parents: true, homeroom: true },
    });

    setOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("sdq_records").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["sdq_records"] });
  };

  // เกณฑ์ SDQ ตามกรมสุขภาพจิต (Parent/Teacher: ปกติ 0-13, เสี่ยง 14-16, มีปัญหา 17+)
  const getLevel = (total: number) => {
    if (total <= 13) return { label: "ปกติ", variant: "outline" as const };
    if (total <= 16) return { label: "เสี่ยง", variant: "secondary" as const };
    return { label: "มีปัญหา", variant: "destructive" as const };
  };

  const getStudentName = (r: any) => {
    if (r.students) return `${r.students.prefix || ""}${r.students.first_name} ${r.students.last_name}`;
    return "-";
  };

  const getStudentCode = (r: any) => r.students?.student_code || "-";
  const getClassroomLabel = (s: any) => s?.classrooms ? s.classrooms.name : "-";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">แบบประเมิน SDQ</h1>
          <p className="text-sm text-muted-foreground">Strengths and Difficulties Questionnaire</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {academicYear > 0 && <AcademicYearFilter compact academicYear={academicYear} onAcademicYearChange={setAcademicYear} semester={semester} onSemesterChange={setSemester} academicYearOptions={academicYearOptions} allowAllSemesters />}
          {(role === "admin" || role === "director") && (
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
              <Power className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">เปิดให้ผู้ปกครอง</span>
              <Switch checked={sdqEnabled || false} onCheckedChange={toggleSDQ} />
            </div>
          )}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />ประเมิน</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>บันทึกแบบประเมิน SDQ</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Card><CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>ระดับชั้น/ห้อง</Label>
                      <Select value={formClassroom} onValueChange={(v) => { setFormClassroom(v); setStudentId(""); }}>
                        <SelectTrigger><SelectValue placeholder="เลือกห้องเรียน" /></SelectTrigger>
                        <SelectContent>{classrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div><Label>นักเรียน</Label>
                      <Select value={studentId} onValueChange={setStudentId}>
                        <SelectTrigger><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger>
                        <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.student_code} - {s.prefix}{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                      </Select></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>ผู้ประเมิน</Label>
                      <Input value={assessor} onChange={(e) => setAssessor(e.target.value)} /></div>
                    <div><Label>ประเภท</Label>
                      <Select value={assessmentType} onValueChange={setAssessmentType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="teacher">ครู</SelectItem>
                          <SelectItem value="parent">ผู้ปกครอง</SelectItem>
                          <SelectItem value="self">ตนเอง</SelectItem>
                        </SelectContent></Select></div>
                  </div>
                </CardContent></Card>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>อารมณ์ (0-10)</Label><Input type="number" min="0" max="10" value={emotional} onChange={(e) => setEmotional(e.target.value)} /></div>
                  <div><Label>ความประพฤติ (0-10)</Label><Input type="number" min="0" max="10" value={conduct} onChange={(e) => setConduct(e.target.value)} /></div>
                  <div><Label>สมาธิ/ไฮเปอร์ (0-10)</Label><Input type="number" min="0" max="10" value={hyper} onChange={(e) => setHyper(e.target.value)} /></div>
                  <div><Label>เพื่อน (0-10)</Label><Input type="number" min="0" max="10" value={peer} onChange={(e) => setPeer(e.target.value)} /></div>
                  <div><Label>สังคม (0-10)</Label><Input type="number" min="0" max="10" value={prosocial} onChange={(e) => setProsocial(e.target.value)} /></div>
                  <div className="flex items-end"><Badge variant={getLevel([emotional, conduct, hyper, peer].reduce((a, b) => a + parseInt(b || "0"), 0)).variant} className="text-lg px-4 py-2">
                    รวม: {[emotional, conduct, hyper, peer].reduce((a, b) => a + parseInt(b || "0"), 0)}
                  </Badge></div>
                </div>
                <Button onClick={handleAdd} className="w-full">บันทึก</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-40"><Label className="text-xs">ระดับชั้น</Label>
            <Select value={filterGrade} onValueChange={(v) => { setFilterGrade(v); setFilterClassroom(""); }}>
              <SelectTrigger><SelectValue placeholder="ทุกระดับชั้น" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                {gradeLevels.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent></Select></div>
          <div className="w-48"><Label className="text-xs">ห้องเรียน</Label>
            <Select value={filterClassroom} onValueChange={setFilterClassroom}>
              <SelectTrigger><SelectValue placeholder="ทุกห้อง" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกห้อง</SelectItem>
                {filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.homeroom_teacher ? `(${c.homeroom_teacher})` : ""}</SelectItem>)}
              </SelectContent></Select></div>
          <div className="w-40"><Label className="text-xs">ประเภทผู้ประเมิน</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="teacher">ครูประเมิน</SelectItem>
                <SelectItem value="parent">ผู้ปกครองประเมิน</SelectItem>
                <SelectItem value="self">ตนเองประเมิน</SelectItem>
              </SelectContent></Select></div>
        </div>
      </CardContent></Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary"><BarChart3 className="w-4 h-4 mr-1" /> สรุปรายห้อง</TabsTrigger>
          <TabsTrigger value="individual"><Users className="w-4 h-4 mr-1" /> สรุปรายบุคคล</TabsTrigger>
          <TabsTrigger value="records"><User className="w-4 h-4 mr-1" /> ข้อมูลทั้งหมด</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-foreground">{summary.total}</p>
              <p className="text-xs text-muted-foreground">ประเมินทั้งหมด</p>
            </CardContent></Card>
            <Card className="border-green-200"><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-green-600">{summary.normal}</p>
              <p className="text-xs text-muted-foreground">ปกติ</p>
              {summary.total > 0 && <Progress value={(summary.normal / summary.total) * 100} className="mt-2 h-1.5" />}
            </CardContent></Card>
            <Card className="border-yellow-200"><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{summary.borderline}</p>
              <p className="text-xs text-muted-foreground">เสี่ยง</p>
              {summary.total > 0 && <Progress value={(summary.borderline / summary.total) * 100} className="mt-2 h-1.5" />}
            </CardContent></Card>
            <Card className="border-red-200"><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-destructive">{summary.abnormal}</p>
              <p className="text-xs text-muted-foreground">ผิดปกติ</p>
              {summary.total > 0 && <Progress value={(summary.abnormal / summary.total) * 100} className="mt-2 h-1.5" />}
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> ครูประเมิน ({summary.teacherRecords} รายการ)
            </CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const tr = records.filter((r: any) => r.assessment_type === "teacher");
                  const n = tr.filter((r: any) => r.total_difficulty <= 13).length;
                  const b = tr.filter((r: any) => r.total_difficulty > 13 && r.total_difficulty <= 15).length;
                  const a = tr.filter((r: any) => r.total_difficulty > 15).length;
                  const t = tr.length || 1;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><span className="text-xs w-16">ปกติ</span><Progress value={(n / t) * 100} className="h-2 flex-1" /><span className="text-xs w-8 text-right">{n}</span></div>
                      <div className="flex items-center gap-2"><span className="text-xs w-16">เสี่ยง</span><Progress value={(b / t) * 100} className="h-2 flex-1" /><span className="text-xs w-8 text-right">{b}</span></div>
                      <div className="flex items-center gap-2"><span className="text-xs w-16">ผิดปกติ</span><Progress value={(a / t) * 100} className="h-2 flex-1" /><span className="text-xs w-8 text-right">{a}</span></div>
                    </div>
                  );
                })()}
              </CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4" /> ผู้ปกครองประเมิน ({summary.parentRecords} รายการ)
            </CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const pr = records.filter((r: any) => r.assessment_type === "parent");
                  const n = pr.filter((r: any) => r.total_difficulty <= 13).length;
                  const b = pr.filter((r: any) => r.total_difficulty > 13 && r.total_difficulty <= 15).length;
                  const a = pr.filter((r: any) => r.total_difficulty > 15).length;
                  const t = pr.length || 1;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><span className="text-xs w-16">ปกติ</span><Progress value={(n / t) * 100} className="h-2 flex-1" /><span className="text-xs w-8 text-right">{n}</span></div>
                      <div className="flex items-center gap-2"><span className="text-xs w-16">เสี่ยง</span><Progress value={(b / t) * 100} className="h-2 flex-1" /><span className="text-xs w-8 text-right">{b}</span></div>
                      <div className="flex items-center gap-2"><span className="text-xs w-16">ผิดปกติ</span><Progress value={(a / t) * 100} className="h-2 flex-1" /><span className="text-xs w-8 text-right">{a}</span></div>
                    </div>
                  );
                })()}
              </CardContent></Card>
          </div>
        </TabsContent>

        {/* Individual Summary Tab */}
        <TabsContent value="individual">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อนักเรียน</TableHead>
                <TableHead>ห้อง</TableHead>
                <TableHead className="text-center">ครูประเมิน</TableHead>
                <TableHead className="text-center">ผู้ปกครองประเมิน</TableHead>
                <TableHead className="text-center">ระดับ (ครู)</TableHead>
                <TableHead className="text-center">ระดับ (ผู้ปกครอง)</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {studentSummary.map((item) => {
                  const latestTeacher = item.teacher[0];
                  const latestParent = item.parent[0];
                  const tLevel = latestTeacher ? getLevel(latestTeacher.total_difficulty) : null;
                  const pLevel = latestParent ? getLevel(latestParent.total_difficulty) : null;
                  return (
                    <TableRow key={item.student?.student_code || Math.random()}>
                      <TableCell className="font-mono text-xs">{item.student?.student_code || "-"}</TableCell>
                      <TableCell>{item.student ? `${item.student.prefix || ""}${item.student.first_name} ${item.student.last_name}` : "-"}</TableCell>
                      <TableCell>{getClassroomLabel(item.student)}</TableCell>
                      <TableCell className="text-center">{item.teacher.length || "-"}</TableCell>
                      <TableCell className="text-center">{item.parent.length || "-"}</TableCell>
                      <TableCell className="text-center">{tLevel ? <Badge variant={tLevel.variant}>{tLevel.label} ({latestTeacher.total_difficulty})</Badge> : "-"}</TableCell>
                      <TableCell className="text-center">{pLevel ? <Badge variant={pLevel.variant}>{pLevel.label} ({latestParent.total_difficulty})</Badge> : "-"}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => setViewStudent(item.teacher[0]?.student_id || item.parent[0]?.student_id)}><Eye className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  );
                })}
                {studentSummary.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* All Records Tab */}
        <TabsContent value="records">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อนักเรียน</TableHead>
                <TableHead>ปี</TableHead>
                <TableHead>ผู้ประเมิน</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>อารมณ์</TableHead>
                <TableHead>ประพฤติ</TableHead>
                <TableHead>สมาธิ</TableHead>
                <TableHead>เพื่อน</TableHead>
                <TableHead>สังคม</TableHead>
                <TableHead>รวม</TableHead>
                <TableHead>ระดับ</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {records.map((r: any) => {
                  const lv = getLevel(r.total_difficulty);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{getStudentCode(r)}</TableCell>
                      <TableCell>{getStudentName(r)}</TableCell>
                      <TableCell>{(r.academic_year || 0) + BE_OFFSET}</TableCell>
                      <TableCell>{r.assessment_by || "-"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.assessment_type === "parent" ? "ผู้ปกครอง" : r.assessment_type === "self" ? "ตนเอง" : "ครู"}</Badge></TableCell>
                      <TableCell>{r.emotional_score}</TableCell>
                      <TableCell>{r.conduct_score}</TableCell>
                      <TableCell>{r.hyperactivity_score}</TableCell>
                      <TableCell>{r.peer_score}</TableCell>
                      <TableCell>{r.prosocial_score}</TableCell>
                      <TableCell className="font-bold">{r.total_difficulty}</TableCell>
                      <TableCell><Badge variant={lv.variant}>{lv.label}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  );
                })}
                {records.length === 0 && <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Individual Student Detail Dialog */}
      <Dialog open={!!viewStudent} onOpenChange={(v) => !v && setViewStudent(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              ผลประเมิน SDQ - {viewStudentRecords.student ? `${viewStudentRecords.student.prefix || ""}${viewStudentRecords.student.first_name} ${viewStudentRecords.student.last_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Teacher assessments */}
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">ครูประเมิน ({viewStudentRecords.teacher.length} ครั้ง)</CardTitle></CardHeader>
              <CardContent className="p-0">
                {viewStudentRecords.teacher.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>ผู้ประเมิน</TableHead>
                      <TableHead>อารมณ์</TableHead>
                      <TableHead>ประพฤติ</TableHead>
                      <TableHead>สมาธิ</TableHead>
                      <TableHead>เพื่อน</TableHead>
                      <TableHead>สังคม</TableHead>
                      <TableHead>รวม</TableHead>
                      <TableHead>ระดับ</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {viewStudentRecords.teacher.map((r: any) => {
                        const lv = getLevel(r.total_difficulty);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("th-TH")}</TableCell>
                            <TableCell className="text-xs">{r.assessment_by || "-"}</TableCell>
                            <TableCell>{r.emotional_score}</TableCell>
                            <TableCell>{r.conduct_score}</TableCell>
                            <TableCell>{r.hyperactivity_score}</TableCell>
                            <TableCell>{r.peer_score}</TableCell>
                            <TableCell>{r.prosocial_score}</TableCell>
                            <TableCell className="font-bold">{r.total_difficulty}</TableCell>
                            <TableCell><Badge variant={lv.variant}>{lv.label}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground p-4">ยังไม่มีข้อมูล</p>}
              </CardContent></Card>

            {/* Parent assessments */}
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">ผู้ปกครองประเมิน ({viewStudentRecords.parent.length} ครั้ง)</CardTitle></CardHeader>
              <CardContent className="p-0">
                {viewStudentRecords.parent.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>ผู้ประเมิน</TableHead>
                      <TableHead>อารมณ์</TableHead>
                      <TableHead>ประพฤติ</TableHead>
                      <TableHead>สมาธิ</TableHead>
                      <TableHead>เพื่อน</TableHead>
                      <TableHead>สังคม</TableHead>
                      <TableHead>รวม</TableHead>
                      <TableHead>ระดับ</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {viewStudentRecords.parent.map((r: any) => {
                        const lv = getLevel(r.total_difficulty);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("th-TH")}</TableCell>
                            <TableCell className="text-xs">{r.assessment_by || "-"}</TableCell>
                            <TableCell>{r.emotional_score}</TableCell>
                            <TableCell>{r.conduct_score}</TableCell>
                            <TableCell>{r.hyperactivity_score}</TableCell>
                            <TableCell>{r.peer_score}</TableCell>
                            <TableCell>{r.prosocial_score}</TableCell>
                            <TableCell className="font-bold">{r.total_difficulty}</TableCell>
                            <TableCell><Badge variant={lv.variant}>{lv.label}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground p-4">ยังไม่มีข้อมูล</p>}
              </CardContent></Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SDQPage;
