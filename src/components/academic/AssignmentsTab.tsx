import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, BookOpen, Users, Pencil, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";


interface AssignmentsTabProps {
  assignments: any[];
  personnel: any[];
  subjects: any[];
  classrooms: any[];
}

export const AssignmentsTab = ({ assignments, personnel, subjects, classrooms }: AssignmentsTabProps) => {
  const qc = useQueryClient();
  const { isAdmin, isDirector } = useUserRole();
  const canEdit = isAdmin || isDirector;
  const [assignOpen, setAssignOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<any | null>(null);
  const [personnelId, setPersonnelId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [semester, setSemester] = useState("1");
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear() + 543));
  const [filterGrade, setFilterGrade] = useState("all");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  // Table filters
  const [tableSearch, setTableSearch] = useState("");
  const [tableSubjectFilter, setTableSubjectFilter] = useState("all");
  const [tableClassroomFilter, setTableClassroomFilter] = useState("all");
  const [tableSemesterFilter, setTableSemesterFilter] = useState("all");
  const [tableYearFilter, setTableYearFilter] = useState("all");


  // Fetch schedules for the selected teacher to restrict subjects/classrooms to what they actually teach
  const { data: teacherSchedules = [] } = useQuery({
    queryKey: ["teacher-schedules-for-assign", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      const { data } = await supabase
        .from("schedules")
        .select("subject_id, classroom_id, semester, academic_year")
        .eq("teacher_id", personnelId);
      return data || [];
    },
    enabled: !!personnelId,
    staleTime: 60_000,
  });

  const scheduleSubjectIds = useMemo(
    () => new Set(teacherSchedules.map((s: any) => s.subject_id).filter(Boolean)),
    [teacherSchedules]
  );
  const scheduleClassroomIds = useMemo(
    () => new Set(teacherSchedules.map((s: any) => s.classroom_id).filter(Boolean)),
    [teacherSchedules]
  );

  // Only subjects present in the teacher's schedule
  const teacherSubjects = useMemo(() => {
    if (!personnelId) return [];
    return subjects.filter((s: any) => scheduleSubjectIds.has(s.id));
  }, [subjects, scheduleSubjectIds, personnelId]);

  // Only classrooms present in the teacher's schedule
  const teacherClassrooms = useMemo(() => {
    if (!personnelId) return [];
    return classrooms.filter((c: any) => scheduleClassroomIds.has(c.id));
  }, [classrooms, scheduleClassroomIds, personnelId]);

  const gradeLevels = useMemo(() => {
    const levels = new Set(teacherSubjects.map((s: any) => s.grade_level).filter(Boolean));
    return Array.from(levels).sort();
  }, [teacherSubjects]);

  const filteredSubjects = useMemo(() => {
    return teacherSubjects.filter((s: any) => {
      const gradeMatch = filterGrade === "all" || s.grade_level === filterGrade;
      const semesterMatch = !s.semester || String(s.semester) === semester;
      return gradeMatch && semesterMatch;
    });
  }, [teacherSubjects, filterGrade, semester]);

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const ids = filteredSubjects.map((s: any) => s.id);
    setSelectedSubjectIds(prev => {
      const allSelected = ids.every(id => prev.includes(id));
      if (allSelected) return prev.filter(id => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

  const resetForm = () => {
    setPersonnelId(""); setClassroomId(""); setSelectedSubjectIds([]); setFilterGrade("all");
  };

  const academicYears = useMemo(() => {
    const years = new Set(assignments.map((a: any) => a.academic_year).filter(Boolean));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    return assignments.filter((a: any) => {
      const teacherName = a.personnel ? `${a.personnel.prefix || ""}${a.personnel.first_name} ${a.personnel.last_name}`.toLowerCase() : "";
      const subjectText = a.subjects ? `${a.subjects.code} ${a.subjects.name_th}`.toLowerCase() : "";
      const searchMatch = !term || teacherName.includes(term) || subjectText.includes(term) || a.classrooms?.name?.toLowerCase().includes(term);
      const subjectMatch = tableSubjectFilter === "all" || a.subject_id === tableSubjectFilter;
      const classroomMatch = tableClassroomFilter === "all" || a.classroom_id === tableClassroomFilter;
      const semesterMatch = tableSemesterFilter === "all" || String(a.semester) === tableSemesterFilter;
      const yearMatch = tableYearFilter === "all" || String(a.academic_year) === tableYearFilter;
      return searchMatch && subjectMatch && classroomMatch && semesterMatch && yearMatch;
    });
  }, [assignments, tableSearch, tableSubjectFilter, tableClassroomFilter, tableSemesterFilter, tableYearFilter]);

  const resetTableFilters = () => {
    setTableSearch("");
    setTableSubjectFilter("all");
    setTableClassroomFilter("all");
    setTableSemesterFilter("all");
    setTableYearFilter("all");
  };


  const handleAssign = async () => {
    if (!personnelId || selectedSubjectIds.length === 0 || !classroomId) {
      toast.error("กรุณาเลือกครู, รายวิชา และห้องเรียน"); return;
    }
    const rows = selectedSubjectIds.map(subjectId => ({
      personnel_id: personnelId, subject_id: subjectId, classroom_id: classroomId,
      semester: parseInt(semester), academic_year: parseInt(academicYear),
    }));
    const { error } = await supabase.from("teacher_assignments").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`มอบหมาย ${rows.length} วิชาสำเร็จ`);
    qc.invalidateQueries({ queryKey: ["teacher_assignments"] });
    setAssignOpen(false); resetForm();
  };

  const handleEditAssignment = async () => {
    if (!editAssignment || !personnelId) return;
    const { error } = await supabase.from("teacher_assignments").update({
      personnel_id: personnelId,
      classroom_id: classroomId || editAssignment.classroom_id,
      semester: parseInt(semester),
      academic_year: parseInt(academicYear),
    }).eq("id", editAssignment.id);
    if (error) { toast.error(error.message); return; }
    toast.success("แก้ไขการมอบหมายสำเร็จ");
    qc.invalidateQueries({ queryKey: ["teacher_assignments"] });
    setEditAssignment(null); resetForm();
  };

  const handleDeleteAssignment = async (id: string) => {
    const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบการมอบหมายสำเร็จ");
    qc.invalidateQueries({ queryKey: ["teacher_assignments"] });
  };

  const openEdit = (a: any) => {
    setEditAssignment(a);
    setPersonnelId(a.personnel_id || "");
    setClassroomId(a.classroom_id || "");
    setSemester(String(a.semester || 1));
    setAcademicYear(String(a.academic_year || ""));
  };

  return (
    <div className="space-y-4">
      {canEdit && (
      <div className="flex justify-end">
        <Dialog open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> มอบหมายครูประจำวิชา</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>มอบหมายครูประจำวิชา (เลือกได้หลายวิชา)</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>ครูผู้สอน</Label>
                <Select value={personnelId} onValueChange={setPersonnelId}>
                  <SelectTrigger><SelectValue placeholder="เลือกครู" /></SelectTrigger>
                  <SelectContent>{personnel.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.prefix}{p.first_name} {p.last_name}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div><Label>ห้องเรียน {personnelId && <span className="text-xs text-muted-foreground">(เฉพาะห้องที่ครูมีตารางสอน)</span>}</Label>
                <Select value={classroomId} onValueChange={setClassroomId} disabled={!personnelId}>
                  <SelectTrigger><SelectValue placeholder={personnelId ? (teacherClassrooms.length ? "เลือกห้อง" : "ไม่พบห้องในตารางสอน") : "กรุณาเลือกครูก่อน"} /></SelectTrigger>
                  <SelectContent>{teacherClassrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>เลือกรายวิชา ({selectedSubjectIds.length} วิชา)</Label>
                <div className="flex gap-2 mt-1 mb-2">
                  <Select value={filterGrade} onValueChange={setFilterGrade}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="กรองระดับชั้น" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                      {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {filteredSubjects.every((s: any) => selectedSubjectIds.includes(s.id)) ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                  </Button>
                </div>
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  {!personnelId ? (
                    <p className="text-sm text-muted-foreground text-center py-4">กรุณาเลือกครูก่อน</p>
                  ) : filteredSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">ไม่พบรายวิชาในตารางสอนของครูท่านนี้</p>
                  ) : filteredSubjects.map((s: any) => (
                    <label key={s.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer">
                      <Checkbox checked={selectedSubjectIds.includes(s.id)} onCheckedChange={() => toggleSubject(s.id)} />
                      <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">{s.code}</span>
                      <span className="text-sm truncate">{s.name_th}</span>
                      <Badge variant="outline" className="ml-auto text-xs shrink-0">{s.grade_level}</Badge>
                    </label>
                  ))}
                </ScrollArea>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ภาคเรียน</Label>
                  <Select value={semester} onValueChange={setSemester}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>ปีการศึกษา</Label><Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} /></div>
              </div>
              <Button onClick={handleAssign} className="w-full">มอบหมาย {selectedSubjectIds.length} วิชา</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editAssignment} onOpenChange={(o) => { if (!o) { setEditAssignment(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>แก้ไขการมอบหมาย</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md text-sm">
              <strong>วิชา:</strong> {editAssignment?.subjects?.code} {editAssignment?.subjects?.name_th}
            </div>
            <div><Label>ครูผู้สอน</Label>
              <Select value={personnelId} onValueChange={setPersonnelId}>
                <SelectTrigger><SelectValue placeholder="เลือกครู" /></SelectTrigger>
                <SelectContent>{personnel.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.prefix}{p.first_name} {p.last_name}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div><Label>ห้องเรียน {personnelId && <span className="text-xs text-muted-foreground">(เฉพาะห้องที่ครูมีตารางสอน)</span>}</Label>
              <Select value={classroomId} onValueChange={setClassroomId} disabled={!personnelId}>
                <SelectTrigger><SelectValue placeholder={personnelId ? (teacherClassrooms.length ? "เลือกห้อง" : "ไม่พบห้องในตารางสอน") : "กรุณาเลือกครูก่อน"} /></SelectTrigger>
                <SelectContent>{teacherClassrooms.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ภาคเรียน</Label>
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>ปีการศึกษา</Label><Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} /></div>
            </div>
            <Button onClick={handleEditAssignment} className="w-full">บันทึกการแก้ไข</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/30">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Search className="w-4 h-4 text-primary" />
                ตัวกรองข้อมูล
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาครูผู้สอน รายวิชา หรือห้องเรียน..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={tableSubjectFilter} onValueChange={setTableSubjectFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="ทุกรายวิชา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกรายวิชา</SelectItem>
                    {subjects.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.code} {s.name_th}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tableClassroomFilter} onValueChange={setTableClassroomFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="ทุกห้องเรียน" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกห้องเรียน</SelectItem>
                    {classrooms.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.grade_level ? `(${c.grade_level})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tableSemesterFilter} onValueChange={setTableSemesterFilter}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="ทุกภาคเรียน" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกภาคเรียน</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tableYearFilter} onValueChange={setTableYearFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="ทุกปีการศึกษา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกปีการศึกษา</SelectItem>
                    {academicYears.map((y: any) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={resetTableFilters} title="ล้างตัวกรอง">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                แสดง {filteredAssignments.length} จาก {assignments.length} รายการ
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ครูผู้สอน</TableHead>
                <TableHead>รายวิชา</TableHead>
                <TableHead>ห้องเรียน</TableHead>
                <TableHead>ภาคเรียน</TableHead>
                <TableHead>ปีการศึกษา</TableHead>
                {canEdit && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8 text-muted-foreground">
                  {assignments.length === 0 ? "ยังไม่มีการมอบหมาย" : "ไม่พบข้อมูลที่ตรงกับตัวกรอง"}
                </TableCell></TableRow>
              ) : filteredAssignments.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.personnel ? `${a.personnel.prefix || ""}${a.personnel.first_name} ${a.personnel.last_name}` : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary"><BookOpen className="w-3 h-3 mr-1" />{a.subjects ? `${a.subjects.code} ${a.subjects.name_th}` : "-"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{a.classrooms ? a.classrooms.name : "-"}</Badge>
                  </TableCell>
                  <TableCell>{a.semester}</TableCell>
                  <TableCell>{a.academic_year ? (a.academic_year + 543) : "-"}</TableCell>
                  {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAssignment(a.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
};
