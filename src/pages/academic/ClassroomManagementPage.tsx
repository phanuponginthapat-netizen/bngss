import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Users, UserCheck, RefreshCw, Pencil, UserPlus, X, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input as SearchInput } from "@/components/ui/input";


const gradeLevels = ["อ.1", "อ.2", "อ.3", "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6", "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6", "การศึกษาพิเศษ"];
const isSecondary = (grade: string) => grade.startsWith("ม.");

const ClassroomManagementPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [openClass, setOpenClass] = useState(false);
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [homeroomTeacher, setHomeroomTeacher] = useState("");
  const [homeroomTeacher2, setHomeroomTeacher2] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<any>(null);
  const [editTeacher, setEditTeacher] = useState("");
  const [editTeacher2, setEditTeacher2] = useState("");
  const [editRefGrade, setEditRefGrade] = useState<string>("none");

  const [manageClassroom, setManageClassroom] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [savingStudents, setSavingStudents] = useState(false);


  // Realtime sync: auto-refresh when classrooms or students change
  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, classroom_id, inclusion_classroom_id, is_special_needs, special_needs, special_needs_type").eq("status", "active").order("student_code");
      return data || [];
    },
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("*").eq("status", "active").order("first_name");
      return data || [];
    },
  });

  const handleAddClass = async () => {
    if (!className || !gradeLevel) return;
    // Pre-check duplicate (same grade + name in current active year)
    const dup = classrooms.find(
      (c: any) => c.grade_level === gradeLevel && (c.name || "").trim() === className.trim()
    );
    if (dup) {
      toast.error(lang === "th" ? `มีห้อง "${className}" อยู่แล้ว` : `Classroom "${className}" already exists`);
      return;
    }
    const { error } = await supabase.from("classrooms").insert({
      name: className.trim(),
      grade_level: gradeLevel,
      homeroom_teacher: homeroomTeacher || null,
      homeroom_teacher_2: isSecondary(gradeLevel) ? (homeroomTeacher2 || null) : null,
    } as any);
    if (error) {
      if ((error as any).code === "23505") {
        toast.error(lang === "th" ? "มีห้องนี้อยู่แล้ว" : "Classroom already exists");
      } else toast.error(error.message);
      return;
    }
    toast.success(lang === "th" ? "เพิ่มห้องเรียนสำเร็จ" : "Classroom added");
    qc.invalidateQueries({ queryKey: ["classrooms"] });
    setOpenClass(false);
    setClassName("");
    setGradeLevel("");
    setHomeroomTeacher("");
    setHomeroomTeacher2("");
  };

  // Auto-assign students to classrooms based on grade level from profiles
  const handleAutoAssign = async () => {
    setSyncing(true);
    try {
      // Get all profiles with student_code (students)
      const { data: profiles } = await supabase.from("profiles").select("student_code, department").not("student_code", "is", null);
      
      let assignedCount = 0;
      for (const student of students) {
        if (student.classroom_id) continue; // already assigned
        
        // Find the profile to get grade level (stored in department field)
        const profile = profiles?.find((p: any) => p.student_code === student.student_code);
        const studentGradeLevel = profile?.department; // grade_level is stored in department for students
        
        if (!studentGradeLevel) continue;

        // Find a matching classroom
        const matchingClassroom = classrooms.find((c: any) => 
          c.grade_level === studentGradeLevel && 
          students.filter((s: any) => s.classroom_id === c.id).length < (c.capacity || 40)
        );

        if (matchingClassroom) {
          const { error } = await supabase.from("students").update({ classroom_id: matchingClassroom.id }).eq("id", student.id);
          if (!error) assignedCount++;
        }
      }

      if (assignedCount > 0) {
        toast.success(`จัดนักเรียนเข้าห้องเรียนอัตโนมัติ ${assignedCount} คน`);
        qc.invalidateQueries({ queryKey: ["students"] });
      } else {
        toast.info("ไม่มีนักเรียนที่ต้องจัดห้องเพิ่มเติม (อาจจัดห้องแล้วทั้งหมด หรือไม่มีห้องเรียนตรงกับระดับชั้น)");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการจัดห้อง");
    }
    setSyncing(false);
  };

  const handleDeleteClassroom = async (id: string) => {
    // Unassign students first
    await supabase.from("students").update({ classroom_id: null }).eq("classroom_id", id);
    await supabase.from("classrooms").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["classrooms"] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const handleEditTeacher = async () => {
    if (!editingClassroom) return;
    const teacherValue = editTeacher === "none" ? null : (editTeacher || null);
    const teacher2Value = editTeacher2 === "none" ? null : (editTeacher2 || null);
    const isSpecial = editingClassroom.grade_level === "การศึกษาพิเศษ";
    const refGrade = isSpecial ? (editRefGrade === "none" ? null : editRefGrade) : null;
    const { error } = await supabase.from("classrooms").update({
      homeroom_teacher: teacherValue,
      homeroom_teacher_2: isSecondary(editingClassroom.grade_level) ? teacher2Value : null,
      reference_grade_level: refGrade,
    } as any).eq("id", editingClassroom.id);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "บันทึกครูประจำชั้นสำเร็จ" : "Homeroom teacher updated");
    qc.invalidateQueries({ queryKey: ["classrooms"] });
    setEditingClassroom(null);
  };


  const openManageStudents = (c: any) => {
    setManageClassroom(c);
    setStudentSearch("");
    setSelectedStudentIds([]);
    // ดึงข้อมูลล่าสุดเสมอ เผื่อมีการแก้ไขสถานะเด็กพิเศษจากหน้าอื่น
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const handleAddStudentsToClass = async () => {
    if (!manageClassroom || selectedStudentIds.length === 0) return;
    setSavingStudents(true);
    try {
      const isSpecialClass = manageClassroom.grade_level === "การศึกษาพิเศษ";
      // Move each selected student into this classroom.
      // For special-ed class: preserve current classroom_id as inclusion, set is_special_needs=true.
      for (const sid of selectedStudentIds) {
        const stu = students.find((s: any) => s.id === sid);
        if (!stu) continue;
        const update: any = { classroom_id: manageClassroom.id };
        if (isSpecialClass) {
          update.is_special_needs = true;
          // Keep prior classroom as inclusion classroom if not already this one
          if (stu.classroom_id && stu.classroom_id !== manageClassroom.id) {
            update.inclusion_classroom_id = stu.classroom_id;
          }
        }
        const { error } = await supabase.from("students").update(update).eq("id", sid);
        if (error) throw error;
      }
      toast.success(`เพิ่มนักเรียน ${selectedStudentIds.length} คน เข้าห้อง ${manageClassroom.name}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["all_students_dmc"] });
      setSelectedStudentIds([]);
    } catch (e: any) {
      toast.error(e.message || "เพิ่มนักเรียนไม่สำเร็จ");
    }
    setSavingStudents(false);
  };

  const handleRemoveStudentFromClass = async (sid: string) => {
    if (!manageClassroom) return;
    const stu = students.find((s: any) => s.id === sid);
    const isSpecialClass = manageClassroom.grade_level === "การศึกษาพิเศษ";
    const update: any = { classroom_id: null };
    if (isSpecialClass) {
      // Move back to inclusion classroom if present, and turn off special-needs flag
      update.classroom_id = stu?.inclusion_classroom_id || null;
      update.is_special_needs = false;
      update.inclusion_classroom_id = null;
    }
    const { error } = await supabase.from("students").update(update).eq("id", sid);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["all_students_dmc"] });
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoAssign} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {lang === "th" ? "จัดห้องอัตโนมัติ" : "Auto Assign"}
          </Button>
          <Dialog open={openClass} onOpenChange={setOpenClass}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "เพิ่มห้องเรียน" : "Add Classroom"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{lang === "th" ? "เพิ่มห้องเรียน" : "Add Classroom"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{lang === "th" ? "ชื่อห้อง" : "Classroom Name"}</Label>
                  <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="เช่น ม.3/1" />
                </div>
                <div>
                  <Label>{lang === "th" ? "ระดับชั้น" : "Grade Level"}</Label>
                  <Select value={gradeLevel} onValueChange={setGradeLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{gradeLevels.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{lang === "th" ? "ครูประจำชั้น คนที่ 1" : "Homeroom Teacher 1"}</Label>
                  <Select value={homeroomTeacher} onValueChange={setHomeroomTeacher}>
                    <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกครู" : "Select teacher"} /></SelectTrigger>
                    <SelectContent>
                      {personnel.map((p: any) => (
                        <SelectItem key={p.id} value={`${p.prefix}${p.first_name} ${p.last_name}`}>
                          {p.prefix}{p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isSecondary(gradeLevel) && (
                  <div>
                    <Label>{lang === "th" ? "ครูประจำชั้น คนที่ 2" : "Homeroom Teacher 2"}</Label>
                    <Select value={homeroomTeacher2} onValueChange={setHomeroomTeacher2}>
                      <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกครู" : "Select teacher"} /></SelectTrigger>
                      <SelectContent>
                        {personnel.map((p: any) => (
                          <SelectItem key={p.id} value={`${p.prefix}${p.first_name} ${p.last_name}`}>
                            {p.prefix}{p.first_name} {p.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleAddClass} className="w-full">{lang === "th" ? "บันทึก" : "Save"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">ห้องเรียนทั้งหมด</p><p className="text-2xl font-bold">{classrooms.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">นักเรียนทั้งหมด</p><p className="text-2xl font-bold">{students.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">จัดห้องแล้ว</p><p className="text-2xl font-bold text-green-600">{students.filter((s: any) => s.classroom_id).length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">ยังไม่จัดห้อง</p><p className="text-2xl font-bold text-orange-600">{students.filter((s: any) => !s.classroom_id).length}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classrooms.map((c: any) => {
          const classStudents = students.filter((s: any) => s.classroom_id === c.id);
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" title="จัดการนักเรียน" onClick={() => openManageStudents(c)}>
                      <UserPlus className="w-4 h-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingClassroom(c); setEditTeacher(c.homeroom_teacher || ""); setEditTeacher2(c.homeroom_teacher_2 || ""); setEditRefGrade(c.reference_grade_level || "none"); }}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClassroom(c.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{c.grade_level}</Badge>
                  <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{classStudents.length}/{c.capacity || 40}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {c.homeroom_teacher && (
                  <p className="text-sm text-muted-foreground mb-1">
                    <UserCheck className="w-3.5 h-3.5 inline mr-1" />
                    {lang === "th" ? "ครูประจำชั้น: " : "Homeroom: "}{c.homeroom_teacher}
                  </p>
                )}
                {c.homeroom_teacher_2 && (
                  <p className="text-sm text-muted-foreground mb-2">
                    <UserCheck className="w-3.5 h-3.5 inline mr-1" />
                    {lang === "th" ? "ครูประจำชั้น 2: " : "Homeroom 2: "}{c.homeroom_teacher_2}
                  </p>
                )}
                {classStudents.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {classStudents.map((s: any) => (
                      <div key={s.id} className="text-xs px-2 py-1 bg-muted rounded">
                        {s.student_code} - {s.prefix}{s.first_name} {s.last_name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{lang === "th" ? "ยังไม่มีนักเรียน" : "No students"}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {classrooms.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {lang === "th" ? "ยังไม่มีห้องเรียน กรุณาเพิ่มห้องเรียน" : "No classrooms yet. Please add a classroom."}
          </CardContent>
        </Card>
      )}

      {/* Edit Homeroom Teacher Dialog */}
      <Dialog open={!!editingClassroom} onOpenChange={(open) => !open && setEditingClassroom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "th" ? `แก้ไขห้อง ${editingClassroom?.name}` : `Edit ${editingClassroom?.name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{lang === "th" ? "ครูประจำชั้น คนที่ 1" : "Homeroom Teacher 1"}</Label>
              <Select value={editTeacher} onValueChange={setEditTeacher}>
                <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกครู" : "Select teacher"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{lang === "th" ? "-- ไม่ระบุ --" : "-- None --"}</SelectItem>
                  {personnel.map((p: any) => (
                    <SelectItem key={p.id} value={`${p.prefix}${p.first_name} ${p.last_name}`}>
                      {p.prefix}{p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingClassroom && isSecondary(editingClassroom.grade_level) && (
              <div>
                <Label>{lang === "th" ? "ครูประจำชั้น คนที่ 2" : "Homeroom Teacher 2"}</Label>
                <Select value={editTeacher2} onValueChange={setEditTeacher2}>
                  <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกครู" : "Select teacher"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lang === "th" ? "-- ไม่ระบุ --" : "-- None --"}</SelectItem>
                    {personnel.map((p: any) => (
                      <SelectItem key={p.id} value={`${p.prefix}${p.first_name} ${p.last_name}`}>
                        {p.prefix}{p.first_name} {p.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editingClassroom?.grade_level === "การศึกษาพิเศษ" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                <Label className="text-amber-900">
                  {lang === "th" ? "ระดับชั้นอ้างอิง (สำหรับการบันทึก/รายงาน)" : "Reference grade level (for records/reports)"}
                </Label>
                <p className="text-xs text-amber-800">
                  {lang === "th"
                    ? "เด็กในห้องเรียนพิเศษจะถูกนับรวมในระดับชั้นนี้ เช่น ม.3 เพื่อให้รายงาน/เช็คชื่อ/คะแนน ไม่แยกออกจากระดับชั้นเดิม"
                    : "Students in this special class will be aggregated under the selected grade for reports."}
                </p>
                <Select value={editRefGrade} onValueChange={setEditRefGrade}>
                  <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกระดับชั้น" : "Select grade"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lang === "th" ? "-- ไม่กำหนด (แยกออกเป็นการศึกษาพิเศษ) --" : "-- None --"}</SelectItem>
                    {gradeLevels.filter((g) => g !== "การศึกษาพิเศษ").map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleEditTeacher} className="w-full">{lang === "th" ? "บันทึก" : "Save"}</Button>

          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog open={!!manageClassroom} onOpenChange={(open) => !open && setManageClassroom(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {lang === "th" ? "จัดการนักเรียน — " : "Manage Students — "}{manageClassroom?.name}
              {manageClassroom?.grade_level === "การศึกษาพิเศษ" && (
                <Badge variant="outline" className="ml-2 text-amber-700 border-amber-400 bg-amber-50">การศึกษาพิเศษ</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {manageClassroom && (() => {
            const isSpecialClass = manageClassroom.grade_level === "การศึกษาพิเศษ";
            const inClass = students.filter((s: any) => s.classroom_id === manageClassroom.id);
            const candidates = students.filter((s: any) => {
              if (s.classroom_id === manageClassroom.id) return false;
              // ห้องการศึกษาพิเศษ → แสดงเฉพาะเด็กที่ถูกทำเครื่องหมายว่าเป็นเด็กพิเศษเท่านั้น
              if (isSpecialClass) {
                const isSpecial = s.is_special_needs || s.special_needs || s.special_needs_type;
                if (!isSpecial) return false;
              }
              const term = studentSearch.trim().toLowerCase();
              if (!term) return true;
              return (
                s.student_code?.toLowerCase().includes(term) ||
                s.first_name?.toLowerCase().includes(term) ||
                s.last_name?.toLowerCase().includes(term)
              );
            });
            return (
              <div className="space-y-4">
                {/* Current students in classroom */}
                <div>
                  <Label className="text-xs">{lang === "th" ? `นักเรียนในห้อง (${inClass.length})` : `Students in class (${inClass.length})`}</Label>
                  <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1 mt-1">
                    {inClass.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">{lang === "th" ? "ยังไม่มีนักเรียน" : "No students"}</p>
                    ) : inClass.map((s: any) => {
                      const isSpecial = s.is_special_needs || s.special_needs || s.special_needs_type;
                      return (
                      <div key={s.id} className="flex items-center justify-between text-sm px-2 py-1 bg-muted/50 rounded">
                        <span className="flex items-center gap-2">
                          {isSpecial && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                          {s.student_code} - {s.prefix}{s.first_name} {s.last_name}
                          {isSpecial && (
                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50" title={s.special_needs_type || s.special_needs || "การศึกษาพิเศษ"}>
                              พิเศษ
                            </Badge>
                          )}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveStudentFromClass(s.id)}>
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add students */}
                <div>
                  <Label className="text-xs">
                    {lang === "th" ? "เพิ่มนักเรียนเข้าห้อง" : "Add students"}
                    {isSpecialClass && <span className="ml-1 text-amber-700">— จะทำเครื่องหมายเป็นเด็กพิเศษและเก็บห้องเดิมไว้เป็นห้องเรียนรวม</span>}
                  </Label>
                  <SearchInput
                    placeholder={lang === "th" ? "ค้นหารหัส/ชื่อ/นามสกุล" : "Search code/name"}
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="mt-1"
                  />
                  <div className="border rounded-md p-2 max-h-60 overflow-y-auto space-y-1 mt-2">
                    {candidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">{lang === "th" ? "ไม่พบนักเรียน" : "No students"}</p>
                    ) : candidates.slice(0, 200).map((s: any) => {
                      const checked = selectedStudentIds.includes(s.id);
                      const isSpecial = s.is_special_needs || s.special_needs || s.special_needs_type;
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-muted rounded cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedStudentIds((prev) =>
                                v ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                              );
                            }}
                          />
                          {isSpecial && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                          <span className="flex-1">{s.student_code} - {s.prefix}{s.first_name} {s.last_name}</span>
                          {isSpecial && (
                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50" title={s.special_needs_type || s.special_needs || "การศึกษาพิเศษ"}>
                              พิเศษ
                            </Badge>
                          )}
                          {s.classroom_id && (
                            <Badge variant="outline" className="text-[10px]">
                              {classrooms.find((c: any) => c.id === s.classroom_id)?.name || "—"}
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {candidates.length > 200 && (
                    <p className="text-[11px] text-muted-foreground mt-1">แสดง 200 รายการแรก — พิมพ์เพื่อค้นหา</p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setManageClassroom(null)}>{lang === "th" ? "ปิด" : "Close"}</Button>
                  <Button onClick={handleAddStudentsToClass} disabled={selectedStudentIds.length === 0 || savingStudents}>
                    {savingStudents ? "กำลังบันทึก..." : `${lang === "th" ? "เพิ่ม" : "Add"} ${selectedStudentIds.length} ${lang === "th" ? "คน" : ""}`}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default ClassroomManagementPage;
