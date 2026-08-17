import { useState, useMemo } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Search, Calendar, Users, BookOpen, ClipboardList, Eye } from "lucide-react";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { BE_OFFSET } from "@/lib/dateBE";
import { saveErrorMessage, safeInt } from "@/lib/saveError";
import { swal } from "@/lib/swal";

// หัวข้อกิจกรรมโฮมรูมตาม สพฐ (OBEC)
const OBEC_TOPICS = [
  { value: "morality", label: "คุณธรรม จริยธรรม", desc: "กิจกรรมส่งเสริมคุณธรรม จริยธรรม ค่านิยมที่ดี" },
  { value: "discipline", label: "ระเบียบวินัย", desc: "การปลูกฝังระเบียบวินัย ความรับผิดชอบ" },
  { value: "democracy", label: "ประชาธิปไตย", desc: "กิจกรรมส่งเสริมประชาธิปไตยในโรงเรียน" },
  { value: "drug_prevention", label: "ป้องกันยาเสพติด", desc: "ให้ความรู้และป้องกันยาเสพติด" },
  { value: "sex_education", label: "เพศศึกษา", desc: "ให้ความรู้เรื่องเพศศึกษาตามวัย" },
  { value: "environment", label: "สิ่งแวดล้อม", desc: "กิจกรรมอนุรักษ์สิ่งแวดล้อม" },
  { value: "safety", label: "ความปลอดภัย", desc: "ความปลอดภัยในโรงเรียนและการจราจร" },
  { value: "health", label: "สุขภาพอนามัย", desc: "สุขอนามัยส่วนบุคคลและโภชนาการ" },
  { value: "career", label: "แนะแนวอาชีพ", desc: "แนะแนวการศึกษาต่อและอาชีพ" },
  { value: "thai_identity", label: "ความเป็นไทย", desc: "อนุรักษ์วัฒนธรรมและความเป็นไทย" },
  { value: "sufficiency", label: "เศรษฐกิจพอเพียง", desc: "กิจกรรมตามหลักปรัชญาเศรษฐกิจพอเพียง" },
  { value: "student_care", label: "ระบบดูแลช่วยเหลือ", desc: "ติดตามดูแลนักเรียนรายบุคคล" },
  { value: "reading", label: "ส่งเสริมการอ่าน", desc: "กิจกรรมส่งเสริมการอ่านและนิสัยรักการอ่าน" },
  { value: "general", label: "ทั่วไป", desc: "กิจกรรมโฮมรูมทั่วไป แจ้งข่าวสาร" },
];

const topicLabelMap = Object.fromEntries(OBEC_TOPICS.map(t => [t.value, t.label]));

const HomeroomPage = () => {
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const studentData = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const [academicYear, setAcademicYear] = useState(0);
  const [semester, setSemester] = useState(0);
  if (academicYear === 0 && currentAcademicYear > 0) { setAcademicYear(currentAcademicYear); setSemester(currentSemester); }

  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<any>(null);

  // Form state
  const [classroomId, setClassroomId] = useState("");
  const [homeroomDate, setHomeroomDate] = useState(todayBangkok());
  const [topic, setTopic] = useState("general");
  const [activityDetails, setActivityDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [parentContact, setParentContact] = useState("");
  const [studentCount, setStudentCount] = useState("0");
  const [absentStudents, setAbsentStudents] = useState("");

  // Filters - delegate to studentData except topic/date
  const filterGrade = studentData.gradeFilter;
  const filterClassroom = studentData.classroomFilter;
  const [filterTopic, setFilterTopic] = useState("all");
  const [searchDate, setSearchDate] = useState("");

  const classrooms = studentData.classrooms;

  const { data: records = [] } = useQuery({
    queryKey: ["homeroom_records", academicYear, semester],
    queryFn: async () => {
      let q = supabase
        .from("homeroom_records")
        .select("*, classrooms(name, grade_level, homeroom_teacher)")
        .order("homeroom_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (academicYear > 0) q = q.eq("academic_year", academicYear - BE_OFFSET);
      if (semester > 0) q = q.eq("semester", semester);
      const { data } = await q;
      return data || [];
    },
    enabled: academicYear > 0,
    staleTime: 60_000,
  });

  const availableClassrooms = studentData.availableClassrooms;

  const gradeOptions = useMemo(() => {
    return [...new Set(availableClassrooms.map((c: any) => c.grade_level as string))].sort();
  }, [availableClassrooms]);

  const filteredClassrooms = studentData.filteredClassrooms;

  const filteredRecords = useMemo(() => {
    let result = records;
    if (filterGrade !== "all") {
      const ids = filteredClassrooms.map((c: any) => c.id);
      result = result.filter((r: any) => ids.includes(r.classroom_id));
    }
    if (filterClassroom !== "all") {
      result = result.filter((r: any) => r.classroom_id === filterClassroom);
    }
    if (filterTopic !== "all") {
      result = result.filter((r: any) => r.topic === filterTopic);
    }
    if (searchDate) {
      result = result.filter((r: any) => r.homeroom_date === searchDate);
    }
    return result;
  }, [records, filterGrade, filterClassroom, filterTopic, searchDate, filteredClassrooms]);

  // Stats
  const stats = useMemo(() => {
    const thisMonth = todayBangkok().slice(0, 7);
    const monthRecords = records.filter((r: any) => r.homeroom_date?.startsWith(thisMonth));
    const topicCounts: Record<string, number> = {};
    monthRecords.forEach((r: any) => {
      topicCounts[r.topic || "general"] = (topicCounts[r.topic || "general"] || 0) + 1;
    });
    return { total: monthRecords.length, topicCounts };
  }, [records]);

  const [savingHomeroom, setSavingHomeroom] = useState(false);
  const handleAdd = async () => {
    if (!classroomId) { toast.error("กรุณาเลือกห้องเรียน"); return; }
    if (!homeroomDate) { toast.error("กรุณาเลือกวันที่"); return; }
    if (savingHomeroom) return;
    setSavingHomeroom(true);
    const { error } = await supabase.from("homeroom_records").insert({
      classroom_id: classroomId,
      homeroom_date: homeroomDate,
      topic,
      activity_details: activityDetails,
      advisor_notes: notes,
      parent_contact: parentContact,
      student_count: safeInt(studentCount, 0),
      absent_students: absentStudents,
      academic_year: academicYear > 0 ? academicYear - BE_OFFSET : undefined,
      semester: semester > 0 ? semester : undefined,
    } as any);
    setSavingHomeroom(false);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("บันทึกกิจกรรมโฮมรูมสำเร็จ");
    qc.invalidateQueries({ queryKey: ["homeroom_records"] });
    setOpen(false);
    setActivityDetails(""); setNotes(""); setParentContact(""); setAbsentStudents("");
  };

  const handleDelete = async (id: string) => {
    const ok = await swal.confirm({ title: "ยืนยันการลบ?", text: "ต้องการลบบันทึกกิจกรรมโฮมรูมนี้หรือไม่", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("homeroom_records").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["homeroom_records"] });
    toast.success("ลบสำเร็จ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {lang === "th" ? "กิจกรรมโฮมรูม" : "Homeroom Activities"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th" ? "บันทึกกิจกรรมโฮมรูมรายวันตามหัวข้อ สพฐ." : "Daily homeroom activities per OBEC topics"}
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {academicYear > 0 && <AcademicYearFilter compact academicYear={academicYear} onAcademicYearChange={setAcademicYear} semester={semester} onSemesterChange={setSemester} academicYearOptions={academicYearOptions} allowAllSemesters />}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "บันทึกกิจกรรม" : "Record Activity"}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{lang === "th" ? "บันทึกกิจกรรมโฮมรูม" : "Record Homeroom Activity"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{lang === "th" ? "ห้องเรียน" : "Classroom"} *</Label>
                  <Select value={classroomId} onValueChange={setClassroomId}>
                    <SelectTrigger><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
                    <SelectContent>
                      {availableClassrooms.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.grade_level} - {c.name} {c.homeroom_teacher ? `(${c.homeroom_teacher})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{lang === "th" ? "วันที่" : "Date"}</Label>
                  <BEDatePicker value={homeroomDate} onChange={(v) => setHomeroomDate(v)} />
                </div>
              </div>

              <div>
                <Label>{lang === "th" ? "หัวข้อกิจกรรม (สพฐ.)" : "Topic (OBEC)"}</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBEC_TOPICS.map(t => (
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
                <Label>{lang === "th" ? "รายละเอียดกิจกรรม" : "Activity Details"}</Label>
                <Textarea
                  value={activityDetails}
                  onChange={e => setActivityDetails(e.target.value)}
                  placeholder="อธิบายกิจกรรมที่ทำในคาบโฮมรูม..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{lang === "th" ? "จำนวนนักเรียนเข้าร่วม" : "Students Present"}</Label>
                  <Input type="number" value={studentCount} onChange={e => setStudentCount(e.target.value)} />
                </div>
                <div>
                  <Label>{lang === "th" ? "นักเรียนที่ขาด" : "Absent Students"}</Label>
                  <Input
                    value={absentStudents}
                    onChange={e => setAbsentStudents(e.target.value)}
                    placeholder="ชื่อนักเรียนที่ขาด"
                  />
                </div>
              </div>

              <div>
                <Label>{lang === "th" ? "บันทึกครูที่ปรึกษา" : "Advisor Notes"}</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="บันทึกเพิ่มเติม, ปัญหาที่พบ, ข้อสังเกต..."
                  rows={2}
                />
              </div>

              <div>
                <Label>{lang === "th" ? "ติดต่อผู้ปกครอง (ถ้ามี)" : "Parent Contact"}</Label>
                <Input value={parentContact} onChange={e => setParentContact(e.target.value)} placeholder="บันทึกการติดต่อผู้ปกครอง" />
              </div>

              <Button onClick={handleAdd} className="w-full" disabled={savingHomeroom}>{savingHomeroom ? (lang === "th" ? "กำลังบันทึก..." : "Saving...") : (lang === "th" ? "บันทึก" : "Save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">บันทึกเดือนนี้</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{classrooms.length}</p>
              <p className="text-xs text-muted-foreground">ห้องเรียน</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{Object.keys(stats.topicCounts).length}</p>
              <p className="text-xs text-muted-foreground">หัวข้อที่ทำเดือนนี้</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{filteredRecords.length}</p>
              <p className="text-xs text-muted-foreground">รายการที่แสดง</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records"><ClipboardList className="w-4 h-4 mr-1" /> บันทึกกิจกรรม</TabsTrigger>
          <TabsTrigger value="topics"><BookOpen className="w-4 h-4 mr-1" /> หัวข้อ สพฐ.</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          {/* Filters */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-2">
                <Select value={filterGrade} onValueChange={v => { studentData.setGradeFilter(v); }}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                    {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterClassroom} onValueChange={studentData.setClassroomFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="ห้องเรียน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกห้อง</SelectItem>
                    {filteredClassrooms.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterTopic} onValueChange={setFilterTopic}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="หัวข้อ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกหัวข้อ</SelectItem>
                    {OBEC_TOPICS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <BEDatePicker value={searchDate} onChange={(v) => setSearchDate(v)} className="w-[160px]" />
                {searchDate && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchDate("")} className="text-xs">
                    ล้างวันที่
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Records Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ห้องเรียน</TableHead>
                    <TableHead>หัวข้อ</TableHead>
                    <TableHead>กิจกรรม</TableHead>
                    <TableHead>เข้าร่วม</TableHead>
                    <TableHead>ขาด</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-medium">{r.homeroom_date || r.visit_date || "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{r.classrooms?.grade_level} - {r.classrooms?.name}</div>
                        {r.classrooms?.homeroom_teacher && (
                          <div className="text-xs text-muted-foreground">{r.classrooms.homeroom_teacher}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {topicLabelMap[r.topic] || r.topic || "ทั่วไป"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{r.activity_details || r.advisor_notes || "—"}</TableCell>
                      <TableCell className="text-sm">{r.student_count || "—"}</TableCell>
                      <TableCell className="text-sm text-destructive">{r.absent_students || "—"}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewRecord(r)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        ไม่มีข้อมูลกิจกรรมโฮมรูม
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OBEC Topics Reference */}
        <TabsContent value="topics">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                หัวข้อกิจกรรมโฮมรูมตามแนวทาง สพฐ.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {OBEC_TOPICS.map((t, i) => {
                  const count = stats.topicCounts[t.value] || 0;
                  return (
                    <div key={t.value} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground">{t.label}</h4>
                          {count > 0 && (
                            <Badge variant="secondary" className="text-xs">{count} ครั้ง/เดือน</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Detail Dialog */}
      <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>รายละเอียดกิจกรรมโฮมรูม</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">วันที่</Label>
                  <p className="font-medium">{viewRecord.homeroom_date || viewRecord.visit_date || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">ห้องเรียน</Label>
                  <p className="font-medium">{viewRecord.classrooms?.grade_level} - {viewRecord.classrooms?.name}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">ครูประจำชั้น</Label>
                <p className="font-medium">{viewRecord.classrooms?.homeroom_teacher || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">หัวข้อ</Label>
                <Badge variant="outline">{topicLabelMap[viewRecord.topic] || viewRecord.topic || "ทั่วไป"}</Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">รายละเอียดกิจกรรม</Label>
                <p className="text-sm bg-muted/30 p-3 rounded-lg">{viewRecord.activity_details || "—"}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">จำนวนเข้าร่วม</Label>
                  <p className="font-medium">{viewRecord.student_count || 0} คน</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">นักเรียนที่ขาด</Label>
                  <p className="text-sm text-destructive">{viewRecord.absent_students || "ไม่มี"}</p>
                </div>
              </div>
              {viewRecord.advisor_notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">บันทึกครู</Label>
                  <p className="text-sm bg-muted/30 p-3 rounded-lg">{viewRecord.advisor_notes}</p>
                </div>
              )}
              {viewRecord.parent_contact && (
                <div>
                  <Label className="text-xs text-muted-foreground">ติดต่อผู้ปกครอง</Label>
                  <p className="text-sm">{viewRecord.parent_contact}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomeroomPage;
