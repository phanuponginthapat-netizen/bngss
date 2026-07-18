import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Search, BarChart3, Users } from "lucide-react";
import { ScanSearchButton } from "@/components/student/ScanSearchButton";
import { useStudentData } from "@/hooks/useStudentData";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";


// หัวข้อคัดกรองตามมาตรฐาน สพฐ. (OBEC Screening Categories)
const OBEC_SCREENING_TYPES = [
  { value: "academic", label: "ด้านการเรียน", desc: "ผลการเรียน ความสามารถในการอ่านเขียน" },
  { value: "behavior", label: "ด้านพฤติกรรม", desc: "พฤติกรรมเบี่ยงเบน ก้าวร้าว ติดเกม" },
  { value: "economic", label: "ด้านเศรษฐกิจ", desc: "ฐานะยากจน ขาดแคลนทุนทรัพย์" },
  { value: "protection", label: "ด้านการคุ้มครอง", desc: "ถูกทำร้าย ถูกทอดทิ้ง ขาดผู้ปกครอง" },
  { value: "health", label: "ด้านสุขภาพ", desc: "โรคประจำตัว สุขภาพจิต ความพิการ" },
  { value: "drug", label: "ด้านยาเสพติด", desc: "เสี่ยงต่อยาเสพติด สารเสพติด" },
  { value: "sexual", label: "ด้านเพศ", desc: "ตั้งครรภ์ก่อนวัย ถูกล่วงละเมิดทางเพศ" },
  { value: "social", label: "ด้านสังคม", desc: "ครอบครัวแตกแยก ถูกกลั่นแกล้ง" },
  { value: "general", label: "ทั่วไป", desc: "การคัดกรองเบื้องต้นทั่วไป" },
];

const screeningTypeLabelMap = Object.fromEntries(OBEC_SCREENING_TYPES.map(t => [t.value, t.label]));

const ScreeningPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const studentData = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const [academicYear, setAcademicYear] = useState(0);
  const [semester, setSemester] = useState(0);
  if (academicYear === 0 && currentAcademicYear > 0) { setAcademicYear(currentAcademicYear); setSemester(currentSemester); }
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [screeningType, setScreeningType] = useState("general");
  const [category, setCategory] = useState("normal");
  const [economicStatus, setEconomicStatus] = useState("");
  const [protectionStatus, setProtectionStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Scope: teachers only see screenings of students in their homeroom
  const scopedStudentIds = useMemo(() => {
    if (!studentData.homeroomClassroomIds) return null;
    return studentData.students
      .filter((s: any) => studentData.homeroomClassroomIds!.includes(s.classroom_id))
      .map((s: any) => s.id);
  }, [studentData.homeroomClassroomIds, studentData.students]);

  const { data: records = [] } = useQuery({
    queryKey: ["student_screenings", scopedStudentIds?.join(",") || "all"],
    queryFn: async () => {
      let q = supabase.from("student_screenings").select("*, students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level))").order("created_at", { ascending: false });
      if (scopedStudentIds) {
        if (scopedStudentIds.length === 0) return [];
        q = q.in("student_id", scopedStudentIds);
      }
      const { data } = await q;
      return data || [];
    },
  });

  const filteredRecords = useMemo(() => {
    let result = records;
    const studentIds = new Set(studentData.filteredStudents.map((s: any) => s.id));
    if (studentData.search || studentData.gradeFilter !== "all" || studentData.classroomFilter !== "all") {
      result = result.filter((r: any) => studentIds.has(r.student_id));
    }
    if (filterType !== "all") {
      result = result.filter((r: any) => r.screening_type === filterType);
    }
    return result;
  }, [records, studentData.filteredStudents, studentData.search, studentData.gradeFilter, studentData.classroomFilter, filterType]);

  // Stats
  const stats = useMemo(() => {
    const total = records.length;
    const normal = records.filter((r: any) => r.category === "normal").length;
    const risk = records.filter((r: any) => r.category === "risk").length;
    const problem = records.filter((r: any) => r.category === "problem").length;
    return { total, normal, risk, problem };
  }, [records]);

  const handleAdd = async () => {
    if (!studentId) return;
    const { error } = await supabase.from("student_screenings").insert({
      student_id: studentId,
      screening_type: screeningType,
      category,
      notes,
      economic_status: economicStatus || null,
      protection_status: protectionStatus || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "บันทึกสำเร็จ" : "Saved");
    qc.invalidateQueries({ queryKey: ["student_screenings"] });
    setOpen(false); setNotes(""); setStudentId(""); setEconomicStatus(""); setProtectionStatus(""); setScreeningType("general");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("student_screenings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "ลบสำเร็จ" : "Deleted");
    qc.invalidateQueries({ queryKey: ["student_screenings"] });
  };

  const catColors: Record<string, string> = { normal: "bg-success-soft text-success", risk: "bg-warning-soft text-warning", problem: "bg-danger-soft text-danger" };
  const catLabels: Record<string, any> = { normal: { th: "ปกติ", en: "Normal" }, risk: { th: "กลุ่มเสี่ยง", en: "At Risk" }, problem: { th: "มีปัญหา", en: "Problem" } };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-responsive-title font-bold text-foreground">{lang === "th" ? "ระบบคัดกรองนักเรียน" : "Student Screening"}</h1>
          <p className="text-responsive-subtitle text-muted-foreground">{lang === "th" ? "คัดกรองและจัดกลุ่มนักเรียนตามมาตรฐาน สพฐ." : "Screen and classify students per OBEC standards"}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {academicYear > 0 && <AcademicYearFilter compact academicYear={academicYear} onAcademicYearChange={setAcademicYear} semester={semester} onSemesterChange={setSemester} academicYearOptions={academicYearOptions} allowAllSemesters />}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "เพิ่มการคัดกรอง" : "Add Screening"}</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{lang === "th" ? "บันทึกการคัดกรองนักเรียน" : "Screen Student"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Student search in dialog */}
              <div>
                <Label>{lang === "th" ? "ค้นหานักเรียน (รหัส/ชื่อ)" : "Search Student (Code/Name)"}</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder={lang === "th" ? "พิมพ์รหัสหรือชื่อนักเรียน..." : "Type code or name..."}
                    value={studentData.search}
                    onChange={e => {
                      studentData.setSearch(e.target.value);
                      const v = e.target.value.trim();
                      const exact = studentData.students.find((s: any) => s.student_code === v);
                      if (exact) setStudentId(exact.id);
                    }}
                  />
                  <ScanSearchButton onScan={(code) => {
                    studentData.setSearch(code);
                    const exact = studentData.filteredStudents.find((s: any) => s.student_code === code);
                    if (exact) setStudentId(exact.id);
                  }} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <Select value={studentData.gradeFilter} onValueChange={v => { studentData.setGradeFilter(v); studentData.setClassroomFilter("all"); }}>
                    <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "th" ? "ทุกชั้น" : "All"}</SelectItem>
                      {studentData.gradeOptions.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={studentData.classroomFilter} onValueChange={studentData.setClassroomFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={lang === "th" ? "ห้อง" : "Room"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                      {studentData.filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกนักเรียน" : "Select student"} /></SelectTrigger>
                  <SelectContent>
                    {studentData.filteredStudents.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.student_code} - {s.prefix || ""}{s.first_name} {s.last_name}
                        {s.classrooms && <span className="text-muted-foreground"> ({s.classrooms.name})</span>}
                      </SelectItem>
                    ))}
                    {studentData.filteredStudents.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">{lang === "th" ? "ไม่พบนักเรียน" : "No students found"}</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Screening type per OBEC */}
              <div>
                <Label>{lang === "th" ? "หัวข้อคัดกรอง (สพฐ.)" : "Screening Type (OBEC)"}</Label>
                <Select value={screeningType} onValueChange={setScreeningType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBEC_SCREENING_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex flex-col">
                          <span>{t.label}</span>
                          <span className="text-xs text-muted-foreground">{t.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{lang === "th" ? "ผลการคัดกรอง" : "Result"}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{lang === "th" ? "🟢 ปกติ" : "🟢 Normal"}</SelectItem>
                    <SelectItem value="risk">{lang === "th" ? "🟡 กลุ่มเสี่ยง" : "🟡 At Risk"}</SelectItem>
                    <SelectItem value="problem">{lang === "th" ? "🔴 มีปัญหา" : "🔴 Problem"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{lang === "th" ? "สถานะเศรษฐกิจ" : "Economic"}</Label>
                  <Select value={economicStatus} onValueChange={setEconomicStatus}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ยากจนพิเศษ">{lang === "th" ? "ยากจนพิเศษ" : "Extremely Poor"}</SelectItem>
                      <SelectItem value="ยากจน">{lang === "th" ? "ยากจน" : "Poor"}</SelectItem>
                      <SelectItem value="ปานกลาง">{lang === "th" ? "ปานกลาง" : "Medium"}</SelectItem>
                      <SelectItem value="ดี">{lang === "th" ? "ดี" : "Good"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{lang === "th" ? "สถานะการคุ้มครอง" : "Protection"}</Label>
                  <Select value={protectionStatus} onValueChange={setProtectionStatus}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ได้รับการดูแลดี">{lang === "th" ? "ได้รับการดูแลดี" : "Well Protected"}</SelectItem>
                      <SelectItem value="ได้รับการดูแล">{lang === "th" ? "ได้รับการดูแล" : "Protected"}</SelectItem>
                      <SelectItem value="ขาดผู้ดูแล">{lang === "th" ? "ขาดผู้ดูแล" : "Unprotected"}</SelectItem>
                      <SelectItem value="ถูกทอดทิ้ง">{lang === "th" ? "ถูกทอดทิ้ง" : "Abandoned"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>{lang === "th" ? "รายละเอียด/หมายเหตุ" : "Details/Notes"}</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={lang === "th" ? "รายละเอียดเพิ่มเติม..." : "Additional details..."} />
              </div>
              <Button onClick={handleAdd} className="w-full">{lang === "th" ? "บันทึกการคัดกรอง" : "Save Screening"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "ทั้งหมด" : "Total"}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "ปกติ" : "Normal"}</p>
          <p className="text-xl sm:text-2xl font-bold text-success">{stats.normal}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "กลุ่มเสี่ยง" : "At Risk"}</p>
          <p className="text-xl sm:text-2xl font-bold text-warning">{stats.risk}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "มีปัญหา" : "Problem"}</p>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{stats.problem}</p>
        </CardContent></Card>
      </div>

      {/* Search & Filter for records */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={lang === "th" ? "ค้นหาจากรหัสหรือชื่อ..." : "Search..."} value={studentData.search} onChange={e => studentData.setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={studentData.gradeFilter} onValueChange={v => { studentData.setGradeFilter(v); studentData.setClassroomFilter("all"); }}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "th" ? "ทุกระดับชั้น" : "All"}</SelectItem>
                {studentData.gradeOptions.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={studentData.classroomFilter} onValueChange={studentData.setClassroomFilter}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder={lang === "th" ? "ห้องเรียน" : "Classroom"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                {studentData.filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder={lang === "th" ? "หัวข้อคัดกรอง" : "Type"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "th" ? "ทุกหัวข้อ" : "All Types"}</SelectItem>
                {OBEC_SCREENING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{lang === "th" ? "นักเรียน" : "Student"}</TableHead>
            <TableHead>{lang === "th" ? "หัวข้อ" : "Type"}</TableHead>
            <TableHead>{lang === "th" ? "ผลคัดกรอง" : "Result"}</TableHead>
            <TableHead className="hidden sm:table-cell">{lang === "th" ? "เศรษฐกิจ" : "Economic"}</TableHead>
            <TableHead className="hidden md:table-cell">{lang === "th" ? "หมายเหตุ" : "Notes"}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredRecords.map((r: any) => {
              const s = r.students;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div>{s ? `${s.student_code} ${s.prefix || ""}${s.first_name} ${s.last_name}` : "—"}</div>
                    {s?.classrooms?.name && <span className="text-xs text-muted-foreground">{s.classrooms.name}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{screeningTypeLabelMap[r.screening_type] || r.screening_type}</Badge>
                  </TableCell>
                  <TableCell><Badge className={catColors[r.category] || ""}>{catLabels[r.category]?.[lang] || r.category}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{r.economic_status || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[150px] truncate text-sm">{r.notes || "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                </TableRow>
              );
            })}
            {filteredRecords.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{lang === "th" ? "ไม่มีข้อมูล" : "No data"}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default ScreeningPage;
