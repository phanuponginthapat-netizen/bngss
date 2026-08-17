import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Search, ScanLine } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { ScanSearchButton } from "@/components/student/ScanSearchButton";
import { useStudentData } from "@/hooks/useStudentData";
import { useUserRole } from "@/hooks/useUserRole";
import { useParentChildren } from "@/hooks/useParentChildren";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";
import { notify } from "@/lib/notify";
import { notifyStudentEvent } from "@/lib/notifyStudentEvent";
import { saveErrorMessage } from "@/lib/saveError";

// หัวข้อพฤติกรรมตามมาตรฐาน สพฐ.
const OBEC_BEHAVIOR_TOPICS = [
  { value: "discipline", label: "ระเบียบวินัย", positive: "ปฏิบัติตามกฎ มาเรียนตรงเวลา", negative: "ไม่ปฏิบัติตามกฎ มาสาย หนีเรียน" },
  { value: "morality", label: "คุณธรรม จริยธรรม", positive: "ซื่อสัตย์ มีน้ำใจ กตัญญู", negative: "ทุจริต ลักขโมย โกหก" },
  { value: "politeness", label: "มารยาท สัมมาคารวะ", positive: "ไหว้ สุภาพ เคารพผู้ใหญ่", negative: "ก้าวร้าว ไม่สุภาพ" },
  { value: "responsibility", label: "ความรับผิดชอบ", positive: "ทำงานที่ได้รับมอบหมาย รักษาความสะอาด", negative: "ไม่ส่งงาน ไม่รับผิดชอบหน้าที่" },
  { value: "unity", label: "ความสามัคคี", positive: "ช่วยเหลือเพื่อน ทำงานกลุ่มดี", negative: "ทะเลาะวิวาท กลั่นแกล้งเพื่อน" },
  { value: "drug_free", label: "ยาเสพติด/สิ่งเสพติด", positive: "ร่วมกิจกรรมต่อต้านยาเสพติด", negative: "สูบบุหรี่ ดื่มสุรา ยาเสพติด" },
  { value: "dress_code", label: "การแต่งกาย", positive: "แต่งกายถูกระเบียบ สะอาดเรียบร้อย", negative: "แต่งกายไม่ถูกระเบียบ" },
  { value: "public_mind", label: "จิตสาธารณะ", positive: "บำเพ็ญประโยชน์ ช่วยเหลือสังคม", negative: "ทำลายทรัพย์สินส่วนรวม" },
  { value: "other", label: "อื่นๆ", positive: "พฤติกรรมเชิงบวกอื่นๆ", negative: "พฤติกรรมเชิงลบอื่นๆ" },
];

const topicLabelMap = Object.fromEntries(OBEC_BEHAVIOR_TOPICS.map(t => [t.value, t.label]));

const BehaviorPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const studentData = useStudentData();
  const { isParent } = useUserRole();
  const { childIds } = useParentChildren();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const [academicYear, setAcademicYear] = useState(0);
  const [semester, setSemester] = useState(0);
  useEffect(() => {
    if (academicYear === 0 && currentAcademicYear > 0) {
      setAcademicYear(currentAcademicYear);
      setSemester(currentSemester);
    }
  }, [academicYear, currentAcademicYear, currentSemester]);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState("positive");
  const [topic, setTopic] = useState("discipline");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState("0");
  const [filterTopic, setFilterTopic] = useState("all");
  const [scanOpen, setScanOpen] = useState(false);

  // Scope: parent → only their children; teachers → homeroom students; admin/director → all
  const scopedStudentIds = useMemo(() => {
    if (isParent) return childIds;
    if (!studentData.homeroomClassroomIds) return null;
    return studentData.students
      .filter((s: any) => studentData.homeroomClassroomIds!.includes(s.classroom_id))
      .map((s: any) => s.id);
  }, [isParent, childIds, studentData.homeroomClassroomIds, studentData.students]);

  const { data: records = [] } = useQuery({
    queryKey: ["behavior_records", academicYear, scopedStudentIds?.join(",") || "all"],
    enabled: scopedStudentIds === null || scopedStudentIds.length >= 0,
    queryFn: async () => {
      let q = supabase.from("behavior_records").select("*, students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level))").order("created_at", { ascending: false }).limit(500);
      if (scopedStudentIds) {
        if (scopedStudentIds.length === 0) return [];
        q = q.in("student_id", scopedStudentIds);
      }
      const { data } = await q;
      return data || [];
    },
  });

  // Roster view: one row per filtered student + their behavior records
  const rosterRows = useMemo(() => {
    return (studentData.filteredStudents as any[]).map((s: any) => {
      let studentRecs = (records as any[]).filter((r) => r.student_id === s.id);
      if (filterTopic !== "all") {
        studentRecs = studentRecs.filter((r) => r.description?.includes(topicLabelMap[filterTopic] || filterTopic));
      }
      const pos = studentRecs.filter((r) => r.behavior_type === "positive").length;
      const neg = studentRecs.filter((r) => r.behavior_type === "negative").length;
      const net = studentRecs.reduce((sum, r) => sum + (r.behavior_type === "positive" ? (r.points || 0) : -(r.points || 0)), 0);
      return { student: s, latest: studentRecs[0] || null, count: studentRecs.length, pos, neg, net };
    });
  }, [records, studentData.filteredStudents, filterTopic]);

  // Stats (aggregate across all records in scope)
  const stats = useMemo(() => {
    const positive = records.filter((r: any) => r.behavior_type === "positive").length;
    const negative = records.filter((r: any) => r.behavior_type === "negative").length;
    const totalPoints = records.reduce((sum: number, r: any) => sum + (r.behavior_type === "positive" ? (r.points || 0) : -(r.points || 0)), 0);
    return { total: records.length, positive, negative, totalPoints };
  }, [records]);

  const selectedTopicInfo = OBEC_BEHAVIOR_TOPICS.find(t => t.value === topic);

  const handleAdd = async () => {
    if (!studentId || !desc) return;
    const topicLabel = topicLabelMap[topic] || topic;
    const fullDesc = `[${topicLabel}] ${desc}`;
    const { data: inserted, error } = await supabase.from("behavior_records").insert({
      student_id: studentId, behavior_type: type, description: fullDesc, points: parseInt(points),
    } as any).select("id").single();
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success(lang === "th" ? "บันทึกสำเร็จ" : "Saved");
    qc.invalidateQueries({ queryKey: ["behavior_records"] });

    // Spider-web: แจ้งนักเรียน + ผู้ปกครอง (เชิงลบแจ้ง homeroom ด้วย)
    const isPositive = type === "positive";
    notifyStudentEvent({
      student_id: studentId,
      title: isPositive ? "⭐ พฤติกรรมเชิงบวก" : "⚠️ บันทึกพฤติกรรม",
      body: `${topicLabel}: ${desc} (${isPositive ? "+" : "-"}${points} คะแนน)`,
      type: "behavior",
      severity: isPositive ? "success" : "warning",
      reference_id: inserted?.id,
      reference_type: "behavior_records",
      url: "/dashboard/student/behavior",
      audience: { student: true, parents: true, homeroom: !isPositive },
    });

    setOpen(false); setDesc(""); setPoints("0"); setStudentId(""); setTopic("discipline");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("behavior_records").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["behavior_records"] });
  };

  const handleScan = async (code: string) => {
    const cleaned = code.trim();
    if (!cleaned) return;
    // ลอง match รหัสตรงๆ ก่อน (บาร์โค้ด CODE_128)
    let found = studentData.students.find((s: any) => s.student_code === cleaned);
    if (!found) {
      // QR บัตรที่พิมพ์เป็น URL → resolve เป็น student id แล้วเทียบใน roster
      const { resolveScannedStudent } = await import("@/lib/resolveScannedStudent");
      const r = await resolveScannedStudent(cleaned);
      if (r) found = studentData.students.find((s: any) => s.id === r.id);
    }
    if (!found) { toast.error(`ไม่พบนักเรียนจาก QR (${cleaned.slice(0, 40)})`); return; }
    setStudentId(found.id);
    setOpen(true);
    toast.success(`เลือก: ${found.first_name} ${found.last_name}`);
  };


  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-responsive-title font-bold text-foreground">{lang === "th" ? "ระบบความประพฤตินักเรียน" : "Behavior Records"}</h1>
          <p className="text-responsive-subtitle text-muted-foreground">{lang === "th" ? "บันทึกพฤติกรรมนักเรียนตามหัวข้อ สพฐ." : "Track student behavior per OBEC topics"}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {academicYear > 0 && <AcademicYearFilter compact academicYear={academicYear} onAcademicYearChange={setAcademicYear} semester={semester} onSemesterChange={setSemester} academicYearOptions={academicYearOptions} allowAllSemesters />}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {!isParent && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "บันทึกพฤติกรรม" : "Record"}</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{lang === "th" ? "บันทึกพฤติกรรมนักเรียน" : "Record Behavior"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Student search */}
              <div>
                <Label>{lang === "th" ? "ค้นหานักเรียน (รหัส/ชื่อ)" : "Search Student"}</Label>
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
                  </SelectContent>
                </Select>
              </div>

              {/* Topic per OBEC */}
              <div>
                <Label>{lang === "th" ? "หัวข้อพฤติกรรม (สพฐ.)" : "Behavior Topic (OBEC)"}</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBEC_BEHAVIOR_TOPICS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTopicInfo && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {type === "positive" ? `✅ ${selectedTopicInfo.positive}` : `⚠️ ${selectedTopicInfo.negative}`}
                  </p>
                )}
              </div>

              <div>
                <Label>{lang === "th" ? "ประเภท" : "Type"}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">{lang === "th" ? "🟢 เชิงบวก (เพิ่มคะแนน)" : "🟢 Positive"}</SelectItem>
                    <SelectItem value="negative">{lang === "th" ? "🔴 เชิงลบ (หักคะแนน)" : "🔴 Negative"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{lang === "th" ? "รายละเอียด" : "Description"}</Label>
                <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder={lang === "th" ? "รายละเอียดพฤติกรรม..." : "Behavior details..."} />
              </div>
              <div>
                <Label>{lang === "th" ? "คะแนน" : "Points"}</Label>
                <Input type="number" value={points} onChange={e => setPoints(e.target.value)} />
              </div>
              <Button onClick={handleAdd} className="w-full">{lang === "th" ? "บันทึก" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
        <Button variant="outline" onClick={() => setScanOpen(true)} className="gap-1">
          <ScanLine className="w-4 h-4" />
          {lang === "th" ? "สแกน QR นักเรียน" : "Scan QR"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "บันทึกทั้งหมด" : "Total"}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "เชิงบวก" : "Positive"}</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.positive}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "เชิงลบ" : "Negative"}</p>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{stats.negative}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "คะแนนรวม" : "Net Points"}</p>
          <p className={`text-xl sm:text-2xl font-bold ${stats.totalPoints >= 0 ? "text-green-600" : "text-destructive"}`}>{stats.totalPoints >= 0 ? "+" : ""}{stats.totalPoints}</p>
        </CardContent></Card>
      </div>

      {/* Filter */}
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
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{lang === "th" ? "นักเรียน" : "Student"}</TableHead>
            <TableHead className="text-center">{lang === "th" ? "บวก" : "+"}</TableHead>
            <TableHead className="text-center">{lang === "th" ? "ลบ" : "-"}</TableHead>
            <TableHead className="text-center">{lang === "th" ? "คะแนนรวม" : "Net"}</TableHead>
            <TableHead className="hidden sm:table-cell">{lang === "th" ? "ล่าสุด" : "Latest"}</TableHead>
            <TableHead>{lang === "th" ? "จำนวน" : "Count"}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rosterRows.map(({ student: s, latest: r, count, pos, neg, net }) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <div>{s.student_code} {s.prefix || ""}{s.first_name} {s.last_name}</div>
                  {s?.classrooms?.name && <span className="text-xs text-muted-foreground">{s.classrooms.name}</span>}
                </TableCell>
                <TableCell className="text-center text-green-600 font-semibold">{pos || "—"}</TableCell>
                <TableCell className="text-center text-destructive font-semibold">{neg || "—"}</TableCell>
                <TableCell className={`text-center font-bold ${net >= 0 ? "text-green-600" : "text-destructive"}`}>{count > 0 ? (net >= 0 ? `+${net}` : net) : "—"}</TableCell>
                <TableCell className="hidden sm:table-cell max-w-[200px] truncate text-sm text-muted-foreground">
                  {r ? r.description : (lang === "th" ? "ยังไม่มีบันทึก" : "No records")}
                </TableCell>
                <TableCell className="text-center">{count}</TableCell>
                <TableCell>{r && <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}</TableCell>
              </TableRow>
            ))}
            {rosterRows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{lang === "th" ? "ไม่มีข้อมูล" : "No data"}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
        title={lang === "th" ? "สแกน QR บัตรนักเรียน" : "Scan Student QR"}
      />
    </div>
  );
};

export default BehaviorPage;
