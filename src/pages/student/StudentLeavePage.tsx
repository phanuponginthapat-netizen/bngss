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
import { toast } from "sonner";
import { Plus, Trash2, Check, Search, FileText, CalendarDays, Paperclip, Eye } from "lucide-react";
import { ScanSearchButton } from "@/components/student/ScanSearchButton";
import { useStudentData } from "@/hooks/useStudentData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { uploadLeaveAttachment, openLeaveAttachment } from "@/lib/leaveAttachment";
import { notify } from "@/lib/notify";


const typeLabels: Record<string, any> = {
  sick: { th: "ป่วย", en: "Sick" },
  personal: { th: "กิจส่วนตัว", en: "Personal" },
  family: { th: "กิจครอบครัว", en: "Family" },
};
const statusLabels: Record<string, any> = {
  pending: { th: "รอดำเนินการ", en: "Pending" },
  approved: { th: "อนุมัติแล้ว", en: "Approved" },
  rejected: { th: "ไม่อนุมัติ", en: "Rejected" },
};
const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

/* ─── Student-only Leave Form View ─── */
const StudentLeaveForm = () => {
  const { lang } = useLanguage();
  const { userId } = useUserRole();
  const qc = useQueryClient();
  const [leaveType, setLeaveType] = useState("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Find the student record linked to this user via students.auth_user_id (primary FK).
  // Fall back to profiles.student_code only if the FK is not yet set (legacy unlinked rows).
  const { data: myStudent } = useQuery({
    queryKey: ["my_student_record", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: byFk } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level)")
        .eq("auth_user_id", userId!)
        .maybeSingle();
      if (byFk) return byFk;
      const { data: profile } = await supabase
        .from("profiles")
        .select("student_code")
        .eq("id", userId!)
        .maybeSingle();
      if (!profile?.student_code) return null;
      const { data: student } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level)")
        .eq("student_code", profile.student_code)
        .maybeSingle();
      return student;
    },
  });

  const studentId = myStudent?.id;

  const { data: myLeaves = [] } = useQuery({
    queryKey: ["my_student_leaves", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_leaves")
        .select("*")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleSubmit = async () => {
    if (!studentId || !startDate || !endDate) {
      toast.error(lang === "th" ? "กรุณากรอกข้อมูลให้ครบ" : "Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      let attachmentPath: string | null = null;
      if (attachment) {
        attachmentPath = await uploadLeaveAttachment(attachment, studentId);
      }
      const { data: inserted, error } = await supabase.from("student_leaves").insert({
        student_id: studentId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
        attachment_url: attachmentPath,
      } as any).select("id").single();
      if (error) throw error;

      toast.success(lang === "th" ? "ส่งใบลาเรียบร้อย" : "Leave request submitted");
      qc.invalidateQueries({ queryKey: ["my_student_leaves"] });
      setStartDate(""); setEndDate(""); setReason(""); setLeaveType("sick"); setAttachment(null);
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          {lang === "th" ? "แบบฟอร์มใบลา" : "Leave Request Form"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "th" ? "กรอกข้อมูลเพื่อยื่นใบลา" : "Fill the form to submit a leave request"}
        </p>
        {myStudent && (
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "th" ? "นักเรียน:" : "Student:"} {myStudent.prefix}{myStudent.first_name} {myStudent.last_name} ({myStudent.student_code})
          </p>
        )}
      </div>

      {!myStudent ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {lang === "th" ? "ไม่พบข้อมูลนักเรียนที่เชื่อมโยงกับบัญชีนี้" : "No student record linked to this account"}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Leave Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{lang === "th" ? "ยื่นใบลาใหม่" : "New Leave Request"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{lang === "th" ? "ประเภทการลา" : "Leave Type"}</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sick">{lang === "th" ? "ลาป่วย" : "Sick Leave"}</SelectItem>
                    <SelectItem value="personal">{lang === "th" ? "ลากิจส่วนตัว" : "Personal Leave"}</SelectItem>
                    <SelectItem value="family">{lang === "th" ? "ลากิจครอบครัว" : "Family Leave"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{lang === "th" ? "วันที่เริ่มลา" : "Start Date"}</Label>
                  <BEDatePicker value={startDate} onChange={(v) => setStartDate(v)} />
                </div>
                <div>
                  <Label>{lang === "th" ? "วันที่สิ้นสุด" : "End Date"}</Label>
                  <BEDatePicker value={endDate} onChange={(v) => setEndDate(v)} />
                </div>
              </div>
              <div>
                <Label>{lang === "th" ? "เหตุผล / รายละเอียด" : "Reason / Details"}</Label>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={lang === "th" ? "ระบุเหตุผลการลา..." : "Describe the reason..."}
                  rows={3}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />{lang === "th" ? "ไฟล์/รูปแนบ (ถ้ามี)" : "Attachment (optional)"}</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                />
                {attachment && <p className="text-xs text-muted-foreground mt-1">{attachment.name}</p>}
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                <CalendarDays className="w-4 h-4 mr-2" />
                {submitting
                  ? (lang === "th" ? "กำลังส่ง..." : "Submitting...")
                  : (lang === "th" ? "ส่งใบลา" : "Submit Leave Request")}
              </Button>
            </CardContent>
          </Card>

          {/* My Leave History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{lang === "th" ? "ประวัติการลาของฉัน" : "My Leave History"}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "th" ? "วันที่" : "Dates"}</TableHead>
                    <TableHead>{lang === "th" ? "ประเภท" : "Type"}</TableHead>
                    <TableHead>{lang === "th" ? "เหตุผล" : "Reason"}</TableHead>
                    <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLeaves.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.start_date} ~ {r.end_date}</TableCell>
                      <TableCell>{typeLabels[r.leave_type]?.[lang] || r.leave_type}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate">{r.reason || "—"}</div>
                        {r.attachment_url && (
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={() => openLeaveAttachment(r.attachment_url).catch(e => toast.error(e.message))}>
                            <Paperclip className="w-3 h-3" />{lang === "th" ? "ดูไฟล์แนบ" : "View attachment"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[r.status] || ""}>
                          {statusLabels[r.status]?.[lang] || r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {myLeaves.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {lang === "th" ? "ยังไม่มีประวัติการลา" : "No leave history"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

/* ─── Admin / Teacher / Director View ─── */
const AdminLeaveView = () => {
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const qc = useQueryClient();
  const studentData = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const [academicYear, setAcademicYear] = useState(0);
  const [semester, setSemester] = useState(0);
  if (academicYear === 0 && currentAcademicYear > 0) { setAcademicYear(currentAcademicYear); setSemester(currentSemester); }

  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [leaveType, setLeaveType] = useState("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [viewLeave, setViewLeave] = useState<any | null>(null);
  // Scope: teachers only see leaves of students in their homeroom.
  // - admin/director: isFiltered=false → null (no filter)
  // - teacher with homeroom: filter to homeroom students
  // - teacher without homeroom (or personnel not yet resolved): empty list — never leak other classes
  const scopedStudentIds = useMemo(() => {
    if (!studentData.isFiltered) return null; // admin/director
    if (!studentData.homeroomClassroomIds || studentData.homeroomClassroomIds.length === 0) return [];
    return studentData.students
      .filter((s: any) => studentData.homeroomClassroomIds!.includes(s.classroom_id))
      .map((s: any) => s.id);
  }, [studentData.isFiltered, studentData.homeroomClassroomIds, studentData.students]);

  const { data: records = [] } = useQuery({
    queryKey: ["student_leaves", scopedStudentIds?.join(",") || "all"],
    queryFn: async () => {
      let q = supabase.from("student_leaves").select("*, students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name))").order("created_at", { ascending: false });
      if (scopedStudentIds) {
        if (scopedStudentIds.length === 0) return [];
        q = q.in("student_id", scopedStudentIds);
      }
      const { data } = await q;
      return data || [];
    },
  });

  const filteredRecords = useMemo(() => {
    const studentIds = new Set(studentData.filteredStudents.map((s: any) => s.id));
    if (studentData.search || studentData.gradeFilter !== "all" || studentData.classroomFilter !== "all") {
      return records.filter((r: any) => studentIds.has(r.student_id));
    }
    return records;
  }, [records, studentData.filteredStudents, studentData.search, studentData.gradeFilter, studentData.classroomFilter]);

  const handleAdd = async () => {
    if (!studentId || !startDate || !endDate) return;
    const { error } = await supabase.from("student_leaves").insert({ student_id: studentId, leave_type: leaveType, start_date: startDate, end_date: endDate, reason } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "บันทึกสำเร็จ" : "Saved");
    qc.invalidateQueries({ queryKey: ["student_leaves"] });
    setOpen(false); setReason(""); setStudentId("");
  };

  const notifyStudentOfDecision = async (id: string, decision: "approved" | "rejected") => {
    try {
      const rec = (records as any[]).find((r: any) => r.id === id);
      if (!rec) return;
      const { data: stu } = await supabase.from("students").select("id, auth_user_id, prefix, first_name, last_name").eq("id", rec.student_id).maybeSingle();
      if (!stu?.auth_user_id) return;
      const isOk = decision === "approved";
      await notify({
        user_ids: [stu.auth_user_id],
        title: isOk ? "✅ ใบลาได้รับการอนุมัติ" : "❌ ใบลาไม่ได้รับอนุมัติ",
        body: `${typeLabels[rec.leave_type]?.th || rec.leave_type} • ${rec.start_date} ถึง ${rec.end_date}`,
        type: "student_leave_decision",
        severity: isOk ? "success" : "warning",
        reference_id: id,
        reference_type: "student_leaves",
        url: "/dashboard/student/leave",
      });
    } catch {/* non-blocking */}
  };

  const handleApprove = async (id: string) => {
    const { data: upd, error } = await supabase
      .from("student_leaves")
      .update({ status: "approved", approved_by: role || "staff" } as any)
      .eq("id", id)
      .select("id");
    if (error) { toast.error(error.message); return; }
    if (!upd || upd.length === 0) { toast.error(lang === "th" ? "ไม่มีสิทธิ์อนุมัติใบลานี้" : "Not allowed to approve"); return; }
    qc.invalidateQueries({ queryKey: ["student_leaves"] });
    toast.success(lang === "th" ? "อนุมัติแล้ว" : "Approved");
    await notifyStudentOfDecision(id, "approved");
    setViewLeave(null);
  };

  const handleReject = async (id: string) => {
    const { data: upd, error } = await supabase
      .from("student_leaves")
      .update({ status: "rejected", approved_by: role || "staff" } as any)
      .eq("id", id)
      .select("id");
    if (error) { toast.error(error.message); return; }
    if (!upd || upd.length === 0) { toast.error(lang === "th" ? "ไม่มีสิทธิ์ดำเนินการใบลานี้" : "Not allowed"); return; }
    qc.invalidateQueries({ queryKey: ["student_leaves"] });
    toast.success(lang === "th" ? "ไม่อนุมัติ" : "Rejected");
    await notifyStudentOfDecision(id, "rejected");
    setViewLeave(null);
  };

  const handleDelete = async (id: string) => {
    const { error: delErr } = await supabase.from("student_leaves").delete().eq("id", id);
    if (delErr) { toast.error(delErr.message); return; }
    qc.invalidateQueries({ queryKey: ["student_leaves"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{lang === "th" ? "ระบบการลา (นักเรียน)" : "Student Leave"}</h1>
          <p className="text-sm text-muted-foreground">{lang === "th" ? "บันทึกและอนุมัติการลา" : "Record and approve leave requests"}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {academicYear > 0 && <AcademicYearFilter compact academicYear={academicYear} onAcademicYearChange={setAcademicYear} semester={semester} onSemesterChange={setSemester} academicYearOptions={academicYearOptions} allowAllSemesters />}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "บันทึกการลา" : "New Leave"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{lang === "th" ? "บันทึกการลา" : "Record Leave"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{lang === "th" ? "นักเรียน" : "Student"}</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกนักเรียน" : "Select"} /></SelectTrigger>
                  <SelectContent>
                    {studentData.filteredStudents.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.student_code} - {s.prefix || ""}{s.first_name} {s.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{lang === "th" ? "ประเภท" : "Type"}</Label>
                <Select value={leaveType} onValueChange={setLeaveType}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sick">{lang === "th" ? "ป่วย" : "Sick"}</SelectItem>
                    <SelectItem value="personal">{lang === "th" ? "กิจส่วนตัว" : "Personal"}</SelectItem>
                    <SelectItem value="family">{lang === "th" ? "กิจครอบครัว" : "Family"}</SelectItem>
                  </SelectContent></Select></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><Label>{lang === "th" ? "จาก" : "From"}</Label><BEDatePicker value={startDate} onChange={(v) => setStartDate(v)} /></div>
                <div><Label>{lang === "th" ? "ถึง" : "To"}</Label><BEDatePicker value={endDate} onChange={(v) => setEndDate(v)} /></div>
              </div>
              <div><Label>{lang === "th" ? "เหตุผล" : "Reason"}</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
              <Button onClick={handleAdd} className="w-full">{lang === "th" ? "บันทึก" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={lang === "th" ? "ค้นหาจากรหัสหรือชื่อ..." : "Search by code or name..."} value={studentData.search} onChange={e => studentData.setSearch(e.target.value)} className="pl-9" />
            </div>
            <ScanSearchButton onScan={(code) => {
              studentData.setSearch(code);
              const exact = studentData.filteredStudents.find((s: any) => s.student_code === code);
              if (exact) setStudentId(exact.id);
            }} />
            <Select value={studentData.gradeFilter} onValueChange={v => { studentData.setGradeFilter(v); studentData.setClassroomFilter("all"); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "th" ? "ทุกระดับชั้น" : "All Grades"}</SelectItem>
                {studentData.gradeOptions.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={studentData.classroomFilter} onValueChange={studentData.setClassroomFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder={lang === "th" ? "ห้องเรียน" : "Classroom"} /></SelectTrigger>
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
            <TableHead>{lang === "th" ? "วันที่" : "Dates"}</TableHead>
            <TableHead>{lang === "th" ? "ประเภท" : "Type"}</TableHead>
            <TableHead>{lang === "th" ? "เหตุผล" : "Reason"}</TableHead>
            <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredRecords.map((r: any) => {
              const s = r.students;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {s ? `${s.student_code} ${s.prefix || ""}${s.first_name} ${s.last_name}` : "—"}
                    {s?.classrooms?.name && <span className="text-xs text-muted-foreground ml-1">({s.classrooms.name})</span>}
                  </TableCell>
                  <TableCell className="text-sm">{r.start_date} ~ {r.end_date}</TableCell>
                  <TableCell>{typeLabels[r.leave_type]?.[lang] || r.leave_type}</TableCell>
                  <TableCell className="max-w-[180px]">
                    <div className="truncate">{r.reason}</div>
                    {r.attachment_url && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={() => openLeaveAttachment(r.attachment_url).catch(e => toast.error(e.message))}>
                        <Paperclip className="w-3 h-3" />{lang === "th" ? "ดูไฟล์แนบ" : "View"}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell><Badge className={statusColors[r.status] || ""}>{statusLabels[r.status]?.[lang] || r.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewLeave(r)} title={lang === "th" ? "ดูรายละเอียด" : "View details"}><Eye className="w-4 h-4 text-primary" /></Button>
                    {r.status === "pending" && <Button variant="ghost" size="sm" onClick={() => handleApprove(r.id)} title={lang === "th" ? "อนุมัติ" : "Approve"}><Check className="w-4 h-4 text-green-600" /></Button>}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} title={lang === "th" ? "ลบ" : "Delete"}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredRecords.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{lang === "th" ? "ไม่มีข้อมูล" : "No data"}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Leave detail dialog */}
      <Dialog open={!!viewLeave} onOpenChange={(v) => !v && setViewLeave(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {lang === "th" ? "รายละเอียดการลา" : "Leave Details"}
            </DialogTitle>
          </DialogHeader>
          {viewLeave && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="col-span-3 p-3 rounded-lg bg-muted/40">
                  <div className="text-xs text-muted-foreground mb-1">{lang === "th" ? "นักเรียน" : "Student"}</div>
                  <div className="font-medium">
                    {viewLeave.students ? `${viewLeave.students.student_code} ${viewLeave.students.prefix || ""}${viewLeave.students.first_name} ${viewLeave.students.last_name}` : "—"}
                    {viewLeave.students?.classrooms?.name && <span className="text-xs text-muted-foreground ml-2">({viewLeave.students.classrooms.name})</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{lang === "th" ? "ประเภท" : "Type"}</div>
                  <div className="font-medium">{typeLabels[viewLeave.leave_type]?.[lang] || viewLeave.leave_type}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{lang === "th" ? "เริ่ม" : "Start"}</div>
                  <div className="font-medium">{viewLeave.start_date}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{lang === "th" ? "สิ้นสุด" : "End"}</div>
                  <div className="font-medium">{viewLeave.end_date}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">{lang === "th" ? "เหตุผล / รายละเอียด" : "Reason"}</div>
                <div className="p-3 rounded-lg bg-muted/40 whitespace-pre-wrap min-h-[60px]">{viewLeave.reason || "—"}</div>
              </div>
              {viewLeave.attachment_url && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{lang === "th" ? "ไฟล์แนบ" : "Attachment"}</div>
                  <Button variant="outline" size="sm" onClick={() => openLeaveAttachment(viewLeave.attachment_url).catch(e => toast.error(e.message))}>
                    <Paperclip className="w-4 h-4 mr-1" />{lang === "th" ? "เปิดไฟล์แนบ" : "Open attachment"}
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <Badge className={statusColors[viewLeave.status] || ""}>{statusLabels[viewLeave.status]?.[lang] || viewLeave.status}</Badge>
                {viewLeave.status === "pending" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleReject(viewLeave.id)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                      {lang === "th" ? "ไม่อนุมัติ" : "Reject"}
                    </Button>
                    <Button size="sm" onClick={() => handleApprove(viewLeave.id)} className="bg-success text-success-foreground hover:bg-success/90">
                      <Check className="w-4 h-4 mr-1" />{lang === "th" ? "อนุมัติ" : "Approve"}
                    </Button>
                  </div>
                )}
              </div>
              {viewLeave.created_at && (
                <div className="text-xs text-muted-foreground">
                  {lang === "th" ? "บันทึกเมื่อ" : "Created"}: {new Date(viewLeave.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Main Component: route by role ─── */
const StudentLeavePage = () => {
  const { isStudent, isParent, loading } = useUserRole();

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;

  // Parents use the same form as students (looks up child via shared student_code on profile).
  return (isStudent || isParent) ? <StudentLeaveForm /> : <AdminLeaveView />;
};

export default StudentLeavePage;
