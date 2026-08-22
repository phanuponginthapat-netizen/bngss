import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Lock, Unlock, Megaphone, AlertTriangle, CheckCircle2, Users, Calendar, GraduationCap, Eye, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { BE_OFFSET } from "@/lib/dateBE";
import {
  GRADE_LOCK_THRESHOLD,
  canAnnounceGrades,
  evaluateClassroomAttendance,
  calculateRatesFromAttendanceRows,
  buildTermString,
  getGradeLock,
  lockGrades,
  unlockGrades,
  type GradeLock,
  type StudentAttendanceRate,
} from "@/lib/gradeLock";

const toBE = (y: number) => (y > 2400 ? y : y + BE_OFFSET);

export default function AcademicGradeLockPage() {
  const qc = useQueryClient();
  const currentYearCE = new Date().getFullYear();
  const [academicYear, setAcademicYear] = useState<string>(String(currentYearCE));
  const [semester, setSemester] = useState<string>("1");
  const [classroomId, setClassroomId] = useState<string>("");
  const [warningOpen, setWarningOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [announceType, setAnnounceType] = useState<"pp5" | "pp6" | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [pendingAtRisk, setPendingAtRisk] = useState<StudentAttendanceRate[]>([]);

  const term = buildTermString(parseInt(academicYear, 10), parseInt(semester, 10));

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const { data: classrooms = [] } = useQuery({
    queryKey: ["grade_lock_classrooms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classrooms").select("id, name, grade_level, academic_year, homeroom_teacher").order("grade_level").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const availableYears = useMemo(() => {
    const years = [...new Set(classrooms.map((c: any) => c.academic_year).filter(Boolean))] as number[];
    if (years.length === 0) return [currentYearCE];
    return years.sort((a, b) => b - a);
  }, [classrooms, currentYearCE]);

  const filteredClassrooms = useMemo(() => {
    return classrooms.filter((c: any) => String(c.academic_year) === academicYear);
  }, [classrooms, academicYear]);

  const selectedClassroom = filteredClassrooms.find((c: any) => c.id === classroomId);

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["grade_lock_students", classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, status")
        .eq("classroom_id", classroomId)
        .eq("status", "active")
        .order("student_code");
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
  });

  const studentIds = useMemo(() => students.map((s: any) => s.id), [students]);

  const { data: attendanceRows = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["grade_lock_attendance", classroomId, academicYear, semester, studentIds.join(",")],
    queryFn: async () => {
      if (!classroomId || studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, attendance_date, status")
        .in("student_id", studentIds)
        .eq("academic_year", parseInt(academicYear, 10))
        .eq("semester", parseInt(semester, 10));
      if (error) throw error;
      return (data || []) as { student_id: string; attendance_date: string; status: string }[];
    },
    enabled: !!classroomId && studentIds.length > 0,
  });

  const { data: gradeLock, isLoading: lockLoading } = useQuery({
    queryKey: ["grade_lock_status", classroomId, term],
    queryFn: async () => {
      if (!classroomId) return null;
      try {
        const lock = await getGradeLock(classroomId, term);
        return lock as GradeLock | null;
      } catch {
        return null;
      }
    },
    enabled: !!classroomId,
  });

  // PP5 / PP6 files for this classroom/term (to announce)
  const { data: pp5Files = [] } = useQuery({
    queryKey: ["grade_lock_pp5_files", classroomId, academicYear, semester],
    queryFn: async () => {
      if (!classroomId || !selectedClassroom) return [];
      const { data, error } = await supabase
        .from("pp5_files")
        .select("id, file_name, subject_name, subject_code, grade_level, semester, academic_year, announced_at, parsed_data")
        .eq("academic_year", parseInt(academicYear, 10))
        .eq("semester", parseInt(semester, 10))
        .limit(20);
      if (error) return [];
      // filter by grade_level if possible
      return (data || []).filter((f: any) => !selectedClassroom.grade_level || f.grade_level === selectedClassroom.grade_level);
    },
    enabled: !!classroomId && !!selectedClassroom,
  });

  const { data: pp6Files = [] } = useQuery({
    queryKey: ["grade_lock_pp6_files", classroomId, academicYear, semester],
    queryFn: async () => {
      if (!classroomId || !selectedClassroom) return [];
      const { data, error } = await supabase
        .from("pp6_files")
        .select("id, file_name, classroom_name, grade_level, semester, academic_year, announced_at, parsed_data")
        .eq("academic_year", parseInt(academicYear, 10))
        .eq("semester", parseInt(semester, 10))
        .limit(20);
      if (error) return [];
      return (data || []).filter((f: any) => !selectedClassroom.grade_level || f.grade_level === selectedClassroom.grade_level);
    },
    enabled: !!classroomId && !!selectedClassroom,
  });

  // ---------------------------------------------------------------------------
  // Attendance rates
  // ---------------------------------------------------------------------------
  const rates: StudentAttendanceRate[] = useMemo(() => {
    if (!students.length) return [];
    return calculateRatesFromAttendanceRows(
      students.map((s: any) => ({ id: s.id, student_code: s.student_code })),
      attendanceRows
    );
  }, [students, attendanceRows]);

  const rateByStudentId = useMemo(() => {
    const m = new Map<string, StudentAttendanceRate>();
    rates.forEach((r) => m.set(r.studentId, r));
    return m;
  }, [rates]);

  const check = useMemo(() => evaluateClassroomAttendance(rates, GRADE_LOCK_THRESHOLD), [rates]);

  const isLocked = gradeLock?.status === "locked";
  const canAnnounceAll = check.canAnnounce && !isLocked;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleLock = async () => {
    if (!classroomId) return;
    if (!check.canAnnounce) {
      setPendingAtRisk(check.atRisk);
      setWarningOpen(true);
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      await lockGrades(classroomId, term, {
        lockedBy: userData?.user?.id ?? null,
        academicYear: parseInt(academicYear, 10),
        semester: parseInt(semester, 10),
        status: "locked",
        attendanceRates: rates,
      });
      toast.success("ล็อกผลการเรียนสำเร็จ — พร้อมประกาศ ปพ.5/ปพ.6");
      qc.invalidateQueries({ queryKey: ["grade_lock_status"] });
      qc.invalidateQueries({ queryKey: ["grade_lock_classrooms"] });
    } catch (e: any) {
      toast.error(e?.message || "ล็อกไม่สำเร็จ");
    }
  };

  const handleForceLock = async () => {
    if (!classroomId) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      await lockGrades(classroomId, term, {
        lockedBy: userData?.user?.id ?? null,
        academicYear: parseInt(academicYear, 10),
        semester: parseInt(semester, 10),
        status: "locked",
        force: true,
      });
      toast.success("ล็อกผลการเรียนสำเร็จ (บังคับล็อก)");
      setWarningOpen(false);
      qc.invalidateQueries({ queryKey: ["grade_lock_status"] });
    } catch (e: any) {
      toast.error(e?.message || "ล็อกไม่สำเร็จ");
    }
  };

  const handleUnlock = async () => {
    if (!classroomId) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      await unlockGrades(classroomId, term, { unlockedBy: userData?.user?.id ?? null });
      toast.success("ปลดล็อกผลการเรียนแล้ว");
      qc.invalidateQueries({ queryKey: ["grade_lock_status"] });
    } catch (e: any) {
      toast.error(e?.message || "ปลดล็อกไม่สำเร็จ");
    }
  };

  const handleAnnounce = async (type: "pp5" | "pp6", fileId: string) => {
    // Guard: check attendance first
    if (!check.canAnnounce) {
      setPendingAtRisk(check.atRisk);
      setAnnounceType(type);
      setSelectedFileId(fileId);
      setWarningOpen(true);
      return;
    }
    // If locked, prevent? or allow announce only when locked? We define locked = ready to announce, so allow.
    // If not locked, suggest lock first but allow.
    const fn = type === "pp5" ? "announce-pp5-scores" : "announce-pp6-scores";
    const t = toast.loading(`กำลังประกาศผล ${type.toUpperCase()}...`);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: { file_id: fileId } });
      toast.dismiss(t);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      toast.success(`ประกาศสำเร็จ — แจ้งเตือน ${d?.notified_students ?? d?.notified ?? 0} คน (ผู้ปกครอง ${d?.notified_parents ?? 0}) จาก ${d?.total ?? 0} คน`);
      qc.invalidateQueries({ queryKey: ["grade_lock_pp5_files"] });
      qc.invalidateQueries({ queryKey: ["grade_lock_pp6_files"] });
      // Auto lock after successful announce if not locked
      if (!isLocked) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          await lockGrades(classroomId, term, {
            lockedBy: userData?.user?.id ?? null,
            academicYear: parseInt(academicYear, 10),
            semester: parseInt(semester, 10),
            status: "locked",
            attendanceRates: rates,
          });
          qc.invalidateQueries({ queryKey: ["grade_lock_status"] });
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "ประกาศไม่สำเร็จ");
    }
  };

  const handleConfirmWarningAnnounce = async () => {
    if (!announceType || !selectedFileId) {
      // force lock case
      await handleForceLock();
      return;
    }
    const fn = announceType === "pp5" ? "announce-pp5-scores" : "announce-pp6-scores";
    const t = toast.loading(`กำลังประกาศผล ${announceType.toUpperCase()} (บังคับ)...`);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: { file_id: selectedFileId } });
      toast.dismiss(t);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("ประกาศสำเร็จ (บังคับ) — ควรติดตามนักเรียนที่เวลาเรียนต่ำกว่า 80%");
      setWarningOpen(false);
      setAnnounceType(null);
      setSelectedFileId(null);
      qc.invalidateQueries({ queryKey: ["grade_lock_pp5_files"] });
      qc.invalidateQueries({ queryKey: ["grade_lock_pp6_files"] });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "ประกาศไม่สำเร็จ");
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderRateBadge = (rate: number) => {
    const pass = canAnnounceGrades("", rate);
    return (
      <Badge variant={pass ? "outline" : "destructive"} className={pass ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30" : ""}>
        {rate.toFixed(2)}%
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500">
              <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl flex items-center gap-2">
                ตัวล็อกผลการเรียน — เกณฑ์เวลาเรียน {GRADE_LOCK_THRESHOLD}%
                {isLocked && <Badge className="bg-emerald-600 ml-2">ล็อกแล้ว</Badge>}
                {gradeLock?.status === "pending" && <Badge variant="secondary">รอตรวจสอบ</Badge>}
              </CardTitle>
              <CardDescription>
                ตรวจสอบเวลาเรียนรายบุคคลก่อนประกาศผล ปพ.5 / ปพ.6 — ระบบจะปิดปุ่ม <span className="font-semibold">ประกาศผล</span> หากมีนักเรียนต่ำกว่า 80% และแสดงคำเตือน
              </CardDescription>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              เทอม {term} {selectedClassroom ? `• ${selectedClassroom.grade_level} - ${selectedClassroom.name}` : ""}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px]">
              <div className="text-xs text-muted-foreground mb-1">ปีการศึกษา</div>
              <Select value={academicYear} onValueChange={(v) => { setAcademicYear(v); setClassroomId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>ปี {toBE(y)} ({y})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <div className="text-xs text-muted-foreground mb-1">ภาคเรียน</div>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
                  <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <div className="text-xs text-muted-foreground mb-1">ห้องเรียน</div>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger><SelectValue placeholder={filteredClassrooms.length ? "เลือกห้องเรียน" : "ไม่มีห้องในปีนี้"} /></SelectTrigger>
                <SelectContent>
                  {filteredClassrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.grade_level} - {c.name} {c.homeroom_teacher ? `(${c.homeroom_teacher})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 ml-auto">
              {classroomId && (
                <>
                  {!isLocked ? (
                    <Button onClick={handleLock} disabled={attendanceLoading || studentsLoading} className="gap-2">
                      <Lock className="w-4 h-4" /> ล็อกผลการเรียน
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleUnlock} className="gap-2">
                      <Unlock className="w-4 h-4" /> ปลดล็อก
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setDetailOpen(true)} title="ดูรายละเอียด">
                    <Eye className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {classroomId && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <Card className="bg-muted/30"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">นักเรียนทั้งหมด</p><p className="text-2xl font-bold flex items-center justify-center gap-1"><Users className="w-5 h-5" />{students.length}</p></CardContent></Card>
              <Card className="bg-emerald-50 dark:bg-emerald-950/20"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">ผ่านเกณฑ์ (≥80%)</p><p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{check.passed.length}</p></CardContent></Card>
              <Card className="bg-destructive/10"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">ต่ำกว่า 80%</p><p className="text-2xl font-bold text-destructive">{check.failedCount}</p></CardContent></Card>
              <Card className={isLocked ? "bg-emerald-600 text-white" : "bg-amber-50 dark:bg-amber-950/20"}>
                <CardContent className="p-3 text-center">
                  <p className={`text-xs ${isLocked ? "text-white/80" : "text-muted-foreground"}`}>สถานะล็อก</p>
                  <p className="text-sm font-bold flex items-center justify-center gap-1">
                    {lockLoading ? "..." : isLocked ? <><Lock className="w-4 h-4" /> ล็อกแล้ว</> : <><Unlock className="w-4 h-4" /> ยังไม่ล็อก</>}
                  </p>
                  {gradeLock?.locked_at && <p className="text-[10px] opacity-70">{new Date(gradeLock.locked_at).toLocaleString("th-TH")}</p>}
                </CardContent>
              </Card>
            </div>
          )}

          {classroomId && !check.canAnnounce && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">มีนักเรียน {check.failedCount} คนที่เวลาเรียนต่ำกว่า {GRADE_LOCK_THRESHOLD}% — ไม่สามารถประกาศผลได้</p>
                <p className="text-xs mt-1">ระบบจะปิดปุ่ม “ประกาศผล” อัตโนมัติ หากต้องการประกาศต่อ กรุณากดปุ่มแล้วระบบจะแสดงคำเตือนให้ยืนยันบังคับประกาศ</p>
              </div>
            </div>
          )}

          {classroomId && check.canAnnounce && !isLocked && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200 text-sm">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">นักเรียนทุกคนผ่านเกณฑ์เวลาเรียน — พร้อมล็อกและประกาศผล</p>
                <p className="text-xs mt-1">กด “ล็อกผลการเรียน” เพื่อยืนยันก่อนประกาศ ปพ.5/ปพ.6</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student table */}
      {classroomId ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> เวลาเรียนรายบุคคล — เทอม {term}
            </CardTitle>
            <CardDescription>
              แสดงอัตราเข้าเรียนต่อนักเรียน ถ้า &lt; {GRADE_LOCK_THRESHOLD}% จะถูกไฮไลท์และปิดการประกาศรายบุคคล
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">เลขที่</TableHead>
                    <TableHead className="w-28">รหัส</TableHead>
                    <TableHead>ชื่อ-สกุล</TableHead>
                    <TableHead className="text-center">มาเรียน</TableHead>
                    <TableHead className="text-center">ขาด</TableHead>
                    <TableHead className="text-center">ลา</TableHead>
                    <TableHead className="text-center">รวมวัน</TableHead>
                    <TableHead className="text-center min-w-[140px]">อัตราเข้าเรียน</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-center">ประกาศรายบุคคล</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsLoading || attendanceLoading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                  ) : students.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">ไม่มีนักเรียนในห้องนี้</TableCell></TableRow>
                  ) : (
                    students.map((s: any, idx: number) => {
                      const r = rateByStudentId.get(s.id);
                      const rate = r?.attendanceRate ?? 100;
                      const pass = canAnnounceGrades(s.id, rate);
                      const present = r?.present ?? 0;
                      const absent = r?.absent ?? 0;
                      const leave = r?.leave ?? 0;
                      const total = r?.total ?? 0;
                      return (
                        <TableRow key={s.id} className={!pass ? "bg-destructive/5" : ""}>
                          <TableCell className="text-center">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                          <TableCell className="text-sm">{s.prefix}{s.first_name} {s.last_name}</TableCell>
                          <TableCell className="text-center font-medium text-emerald-700 dark:text-emerald-300">{present}</TableCell>
                          <TableCell className="text-center font-medium text-destructive">{absent}</TableCell>
                          <TableCell className="text-center font-medium text-amber-600">{leave}</TableCell>
                          <TableCell className="text-center">{total || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[140px]">
                              <Progress value={Math.min(100, rate)} className="h-2 flex-1" />
                              {renderRateBadge(rate)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {pass ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30"><CheckCircle2 className="w-3 h-3 mr-1" />ผ่าน</Badge>
                              : <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />ไม่ผ่าน</Badge>}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant={pass ? "default" : "secondary"}
                              disabled={!pass}
                              title={pass ? "ผ่านเกณฑ์ — ประกาศได้" : `ต่ำกว่า ${GRADE_LOCK_THRESHOLD}% — ปิดการประกาศ`}
                              onClick={() => toast.info("การประกาศรายบุคคล — ใช้ปุ่มประกาศไฟล์ ปพ.5/ปพ.6 ด้านล่าง (ตรวจเกณฑ์รวมทั้งห้องก่อน)")}
                              className="h-7 gap-1 text-xs"
                            >
                              <Megaphone className="w-3 h-3" /> ประกาศผล
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="p-8 text-center text-muted-foreground">กรุณาเลือกห้องเรียนเพื่อดูเวลาเรียนรายบุคคล</CardContent></Card>
      )}

      {/* PP5 / PP6 files to announce */}
      {classroomId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ไฟล์ ปพ.5 — ประกาศผลรายวิชา</CardTitle>
              <CardDescription>ปุ่มจะถูกปิดหากมีนักเรียนต่ำกว่า 80% — ต้องล็อกหรือยืนยันคำเตือนก่อน</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pp5Files.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ไม่มีไฟล์ ปพ.5 สำหรับเทอมนี้</p>
              ) : (
                pp5Files.map((f: any) => {
                  const disabled = !canAnnounceAll;
                  const announced = !!f.announced_at;
                  return (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.subject_name || f.file_name} <span className="text-xs text-muted-foreground">({f.subject_code || "-"})</span></p>
                        <p className="text-xs text-muted-foreground truncate">{f.file_name} • {f.grade_level} เทอม {f.semester}/{toBE(f.academic_year)}</p>
                        {f.parsed_data ? <Badge variant="secondary" className="text-[10px] mt-1">อ่านอัตโนมัติแล้ว</Badge> : <Badge variant="outline" className="text-[10px] mt-1">ยังไม่อ่าน</Badge>}
                        {announced && <Badge className="ml-1 bg-emerald-600 text-[10px]">ประกาศแล้ว</Badge>}
                      </div>
                      <Button
                        size="sm"
                        disabled={disabled || !f.parsed_data}
                        variant={announced ? "outline" : "default"}
                        onClick={() => handleAnnounce("pp5", f.id)}
                        className="shrink-0 gap-1"
                        title={disabled ? `มีนักเรียน ${check.failedCount} คนต่ำกว่า ${GRADE_LOCK_THRESHOLD}% — คลิกเพื่อดูคำเตือน` : f.parsed_data ? "ประกาศผล ปพ.5" : "ต้องอ่านไฟล์ก่อน"}
                      >
                        {announced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Megaphone className="w-3.5 h-3.5" />}
                        {announced ? "ประกาศซ้ำ" : "ประกาศผล"}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ไฟล์ ปพ.6 — ประกาศผลรายห้อง</CardTitle>
              <CardDescription>เกณฑ์เดียวกัน 80% — บูรณาการกับ edge function announce-pp6-scores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pp6Files.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ไม่มีไฟล์ ปพ.6 สำหรับเทอมนี้</p>
              ) : (
                pp6Files.map((f: any) => {
                  const disabled = !canAnnounceAll;
                  const announced = !!f.announced_at;
                  return (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.classroom_name || f.grade_level} <span className="text-xs text-muted-foreground">— {f.file_name}</span></p>
                        <p className="text-xs text-muted-foreground">เทอม {f.semester}/{toBE(f.academic_year)}</p>
                        {f.parsed_data ? <Badge variant="secondary" className="text-[10px] mt-1">อ่านอัตโนมัติแล้ว</Badge> : <Badge variant="outline" className="text-[10px] mt-1">ยังไม่อ่าน</Badge>}
                        {announced && <Badge className="ml-1 bg-emerald-600 text-[10px]">ประกาศแล้ว</Badge>}
                      </div>
                      <Button
                        size="sm"
                        disabled={disabled || !f.parsed_data}
                        variant={announced ? "outline" : "default"}
                        onClick={() => handleAnnounce("pp6", f.id)}
                        className="shrink-0 gap-1"
                        title={disabled ? `มีนักเรียน ${check.failedCount} คนต่ำกว่า ${GRADE_LOCK_THRESHOLD}%` : f.parsed_data ? "ประกาศผล ปพ.6" : "ต้องอ่านไฟล์ก่อน"}
                      >
                        {announced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Megaphone className="w-3.5 h-3.5" />}
                        {announced ? "ประกาศซ้ำ" : "ประกาศผล"}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Warning dialog — shown when trying to announce/lock while <80% */}
      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="w-5 h-5" /> คำเตือน: มีนักเรียนเวลาเรียนต่ำกว่า {GRADE_LOCK_THRESHOLD}%
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  พบนักเรียน <span className="font-bold text-destructive">{pendingAtRisk.length || check.failedCount} คน</span> ที่มีอัตราเข้าเรียนต่ำกว่าเกณฑ์ สพฐ. 80% — ตามระเบียบไม่สามารถประกาศผล ปพ.5/ปพ.6 ได้จนกว่าจะดำเนินการแก้ไข
                </p>
                <div className="max-h-[200px] overflow-y-auto rounded border bg-muted/30 p-2 text-xs">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-7">รหัส</TableHead>
                        <TableHead className="h-7">อัตรา</TableHead>
                        <TableHead className="h-7">ขาด/ลา</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(pendingAtRisk.length ? pendingAtRisk : check.atRisk).slice(0, 20).map((r) => {
                        const stu = students.find((s: any) => s.id === r.studentId) as any;
                        return (
                          <TableRow key={r.studentId}>
                            <TableCell className="py-1 font-mono">{stu?.student_code || r.studentCode || r.studentId.slice(0, 8)}</TableCell>
                            <TableCell className="py-1"><Badge variant="destructive" className="text-xs">{r.attendanceRate.toFixed(2)}%</Badge></TableCell>
                            <TableCell className="py-1">{r.absent} ขาด / {r.leave} ลา</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {(pendingAtRisk.length || check.failedCount) > 20 && (
                    <p className="text-center text-muted-foreground mt-2">และอีก {(pendingAtRisk.length || check.failedCount) - 20} คน...</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  ตัวเลือก: <span className="font-semibold">ยกเลิก</span> เพื่อกลับไปแก้ไขเวลาเรียน, หรือ <span className="font-semibold">บังคับประกาศ</span> หากได้รับอนุมัติจากผู้บริหาร (ระบบจะบันทึกการบังคับไว้ใน grade_lock)
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAnnounceType(null); setSelectedFileId(null); }}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleConfirmWarningAnnounce}
            >
              บังคับ{announceType ? "ประกาศ" : "ล็อก"} (ยืนยัน)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดล็อกผลการเรียน</DialogTitle>
            <DialogDescription>
              ห้อง {selectedClassroom?.grade_level} - {selectedClassroom?.name} • เทอม {term}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">สถานะ: </span>{isLocked ? <Badge className="bg-emerald-600">ล็อกแล้ว</Badge> : <Badge variant="secondary">ยังไม่ล็อก</Badge>}</div>
              <div><span className="text-muted-foreground">เกณฑ์: </span><Badge variant="outline">{GRADE_LOCK_THRESHOLD}%</Badge></div>
              <div><span className="text-muted-foreground">ล็อกเมื่อ: </span>{gradeLock?.locked_at ? new Date(gradeLock.locked_at).toLocaleString("th-TH") : "-"}</div>
              <div><span className="text-muted-foreground">โดย: </span>{gradeLock?.locked_by || "-"}</div>
            </div>
            <div className="rounded-lg border p-3 bg-muted/20">
              <p className="font-semibold mb-2">สรุปเวลาเรียน</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-2xl font-bold">{students.length}</p><p className="text-xs text-muted-foreground">ทั้งหมด</p></div>
                <div><p className="text-2xl font-bold text-emerald-600">{check.passed.length}</p><p className="text-xs text-muted-foreground">ผ่าน</p></div>
                <div><p className="text-2xl font-bold text-destructive">{check.failedCount}</p><p className="text-xs text-muted-foreground">ไม่ผ่าน</p></div>
              </div>
            </div>
            {check.atRisk.length > 0 && (
              <div>
                <p className="font-semibold mb-2 text-destructive">รายชื่อไม่ผ่านเกณฑ์ ({check.failedCount} คน)</p>
                <div className="max-h-[240px] overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>รหัส</TableHead>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead className="text-center">อัตรา</TableHead>
                        <TableHead className="text-center">ขาด/ลา</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {check.atRisk.map((r) => {
                        const stu = students.find((s: any) => s.id === r.studentId) as any;
                        return (
                          <TableRow key={r.studentId}>
                            <TableCell className="font-mono text-xs">{stu?.student_code || "-"}</TableCell>
                            <TableCell className="text-xs">{stu ? `${stu.prefix}${stu.first_name} ${stu.last_name}` : r.studentId.slice(0, 8)}</TableCell>
                            <TableCell className="text-center"><Badge variant="destructive">{r.attendanceRate.toFixed(2)}%</Badge></TableCell>
                            <TableCell className="text-center text-xs">{r.absent}/{r.leave}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
