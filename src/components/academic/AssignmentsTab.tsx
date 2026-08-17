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
import { Plus, Trash2, BookOpen, Users, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { BE_OFFSET } from "@/lib/dateBE";
import { saveErrorMessage, safeInt } from "@/lib/saveError";

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
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear() + BE_OFFSET));
  const [filterGrade, setFilterGrade] = useState("all");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const gradeLevels = useMemo(() => {
    const levels = new Set(subjects.map((s: any) => s.grade_level).filter(Boolean));
    return Array.from(levels).sort();
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s: any) => {
      const gradeMatch = filterGrade === "all" || s.grade_level === filterGrade;
      const semesterMatch = !s.semester || String(s.semester) === semester;
      return gradeMatch && semesterMatch;
    });
  }, [subjects, filterGrade, semester]);

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

  const handleAssign = async () => {
    if (savingAssign) return;
    if (!personnelId || selectedSubjectIds.length === 0 || !classroomId) {
      toast.error("กรุณาเลือกครู, รายวิชา และห้องเรียน"); return;
    }
    setSavingAssign(true);
    try {
      const rows = selectedSubjectIds.map(subjectId => ({
        personnel_id: personnelId, subject_id: subjectId, classroom_id: classroomId,
        semester: safeInt(semester, 1), academic_year: safeInt(academicYear, new Date().getFullYear()),
      }));
      const { error } = await supabase.from("teacher_assignments").insert(rows);
      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success(`มอบหมาย ${rows.length} วิชาสำเร็จ`);
      qc.invalidateQueries({ queryKey: ["teacher_assignments"] });
      setAssignOpen(false); resetForm();
    } finally {
      setSavingAssign(false);
    }
  };

  const handleEditAssignment = async () => {
    if (savingEdit) return;
    if (!editAssignment || !personnelId) { toast.error("กรุณาเลือกครูผู้สอน"); return; }
    setSavingEdit(true);
    try {
      const { error } = await supabase.from("teacher_assignments").update({
        personnel_id: personnelId,
        classroom_id: classroomId || editAssignment.classroom_id,
        semester: safeInt(semester, 1),
        academic_year: safeInt(academicYear, new Date().getFullYear()),
      }).eq("id", editAssignment.id);
      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success("แก้ไขการมอบหมายสำเร็จ");
      qc.invalidateQueries({ queryKey: ["teacher_assignments"] });
      setEditAssignment(null); resetForm();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
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
          <DialogContent className="sm:max-w-lg">
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
              <div><Label>ห้องเรียน</Label>
                <Select value={classroomId} onValueChange={setClassroomId}>
                  <SelectTrigger><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
                  <SelectContent>{classrooms.map((c: any) => (
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
                  {filteredSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">ไม่พบรายวิชา</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>ภาคเรียน</Label>
                  <Select value={semester} onValueChange={setSemester}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>ปีการศึกษา</Label><Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} /></div>
              </div>
              <Button onClick={handleAssign} className="w-full" disabled={savingAssign}>{savingAssign ? "กำลังบันทึก..." : `มอบหมาย ${selectedSubjectIds.length} วิชา`}</Button>
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
            <div><Label>ห้องเรียน</Label>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
                <SelectContent>{classrooms.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.grade_level})</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>ภาคเรียน</Label>
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>ปีการศึกษา</Label><Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} /></div>
            </div>
            <Button onClick={handleEditAssignment} className="w-full" disabled={savingEdit}>{savingEdit ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
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
              {assignments.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8 text-muted-foreground">ยังไม่มีการมอบหมาย</TableCell></TableRow>
              ) : assignments.map((a: any) => (
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
                  <TableCell>{a.academic_year || "-"}</TableCell>
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
