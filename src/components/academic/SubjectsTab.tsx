import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Pencil, Search, Link2, UserCog, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SubjectEditDialog } from "./SubjectEditDialog";
import { ProxySubjectMapDialog } from "./ProxySubjectMapDialog";
import { TeacherScheduleImportDialog } from "./TeacherScheduleImportDialog";
import { CopySubjectsDialog } from "./CopySubjectsDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { BE_OFFSET } from "@/lib/dateBE";

interface SubjectsTabProps {
  subjects: any[];
  onUploadOpen: () => void;
}

export const SubjectsTab = ({ subjects, onUploadOpen }: SubjectsTabProps) => {
  const qc = useQueryClient();
  const { isAdmin, isDirector } = useUserRole();
  const canEdit = isAdmin || isDirector;
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<any | null>(null);
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [proxyMapOpen, setProxyMapOpen] = useState(false);
  const [teacherImportOpen, setTeacherImportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);


  const proxyCount = useMemo(
    () => subjects.filter((s: any) => typeof s.code === "string" && s.code.startsWith("T-")).length,
    [subjects]
  );

  const [subjectForm, setSubjectForm] = useState({
    code: "", name_th: "", name_en: "", credits: "1.0", hours_per_week: "1",
    grade_level: "", semester: "0", academic_year: String(new Date().getFullYear() + BE_OFFSET), subject_type: "required"
  });

  const gradeLevels = useMemo(() => {
    const levels = new Set(subjects.map((s: any) => s.grade_level).filter(Boolean));
    return Array.from(levels).sort();
  }, [subjects]);

  const filtered = useMemo(() => {
    return subjects.filter((s: any) => {
      if (filterGrade !== "all" && s.grade_level !== filterGrade) return false;
      if (filterSemester !== "all" && String(s.semester) !== filterSemester) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!s.code?.toLowerCase().includes(q) && !s.name_th?.toLowerCase().includes(q) && !s.name_en?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [subjects, filterGrade, filterSemester, searchText]);

  const handleAddSubject = async () => {
    if (!subjectForm.code || !subjectForm.name_th) {
      toast.error("กรุณากรอกรหัสวิชาและชื่อวิชา"); return;
    }
    const { error } = await supabase.from("subjects").insert({
      code: subjectForm.code, name_th: subjectForm.name_th, name_en: subjectForm.name_en || null,
      credits: parseFloat(subjectForm.credits), hours_per_week: parseInt(subjectForm.hours_per_week) || 1,
      grade_level: subjectForm.grade_level || null, semester: parseInt(subjectForm.semester),
      academic_year: parseInt(subjectForm.academic_year) - BE_OFFSET, subject_type: subjectForm.subject_type,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("เพิ่มรายวิชาสำเร็จ");
    setSubjectOpen(false);
    setSubjectForm({ code: "", name_th: "", name_en: "", credits: "1.0", hours_per_week: "1", grade_level: "", semester: "0", academic_year: String(new Date().getFullYear() + BE_OFFSET), subject_type: "required" });
    qc.invalidateQueries({ queryKey: ["subjects"] });
  };

  const handleDeleteSubject = async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบรายวิชาสำเร็จ");
    qc.invalidateQueries({ queryKey: ["subjects"] });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="ค้นหารหัสหรือชื่อวิชา..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="w-[150px]">
          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับชั้น</SelectItem>
              {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[130px]">
          <Select value={filterSemester} onValueChange={setFilterSemester}>
            <SelectTrigger><SelectValue placeholder="ภาคเรียน" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกภาคเรียน</SelectItem>
              <SelectItem value="0">ทั้งปี</SelectItem>
              <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
              <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canEdit && proxyCount > 0 && (
          <Button variant="default" onClick={() => setProxyMapOpen(true)}>
            <Link2 className="w-4 h-4 mr-2" /> เชื่อมโยงวิชา Proxy ({proxyCount})
          </Button>
        )}
        {canEdit && <Button variant="outline" onClick={onUploadOpen}><Upload className="w-4 h-4 mr-2" /> อัปโหลดหลักสูตร</Button>}
        {canEdit && (
          <Button variant="outline" onClick={() => setTeacherImportOpen(true)}>
            <UserCog className="w-4 h-4 mr-2" /> อัปโหลดตารางสอนรายครู
          </Button>
        )}
        {canEdit && (
        <Dialog open={subjectOpen} onOpenChange={setSubjectOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> เพิ่มรายวิชา</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>เพิ่มรายวิชาใหม่</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>รหัสวิชา</Label><Input placeholder="ค21101" value={subjectForm.code} onChange={e => setSubjectForm({...subjectForm, code: e.target.value})} /></div>
                <div><Label>หน่วยกิต</Label><Input type="number" step="0.5" value={subjectForm.credits} onChange={e => setSubjectForm({...subjectForm, credits: e.target.value})} /></div>
              </div>
              <div><Label>ชื่อวิชา (ไทย)</Label><Input value={subjectForm.name_th} onChange={e => setSubjectForm({...subjectForm, name_th: e.target.value})} /></div>
              <div><Label>ชื่อวิชา (อังกฤษ)</Label><Input value={subjectForm.name_en} onChange={e => setSubjectForm({...subjectForm, name_en: e.target.value})} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>ชั่วโมง/สัปดาห์</Label><Input type="number" min="1" value={subjectForm.hours_per_week} onChange={e => setSubjectForm({...subjectForm, hours_per_week: e.target.value})} /></div>
                <div><Label>ระดับชั้น</Label><Input placeholder="ม.1" value={subjectForm.grade_level} onChange={e => setSubjectForm({...subjectForm, grade_level: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>ภาคเรียน</Label>
                  <Select value={subjectForm.semester} onValueChange={v => setSubjectForm({...subjectForm, semester: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="0">ทั้งปี</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>ปีการศึกษา</Label><Input value={subjectForm.academic_year} onChange={e => setSubjectForm({...subjectForm, academic_year: e.target.value})} /></div>
              </div>
              <div><Label>ประเภทวิชา</Label>
                <Select value={subjectForm.subject_type} onValueChange={v => setSubjectForm({...subjectForm, subject_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">วิชาพื้นฐาน</SelectItem>
                    <SelectItem value="elective">วิชาเพิ่มเติม</SelectItem>
                    <SelectItem value="activity">กิจกรรมพัฒนาผู้เรียน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddSubject} className="w-full">บันทึก</Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="text-sm text-muted-foreground">แสดง {filtered.length} จาก {subjects.length} รายวิชา</div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อวิชา</TableHead>
                <TableHead>หน่วยกิต</TableHead>
                <TableHead>ชม./สัปดาห์</TableHead>
                <TableHead>ระดับชั้น</TableHead>
                <TableHead>ภาคเรียน</TableHead>
                <TableHead>ประเภท</TableHead>
                {canEdit && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">ไม่พบรายวิชา</TableCell></TableRow>
              ) : filtered.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="font-medium">{s.name_th}{s.name_en ? ` (${s.name_en})` : ""}</TableCell>
                  <TableCell>{s.credits}</TableCell>
                  <TableCell>{s.hours_per_week || 1}</TableCell>
                  <TableCell>{s.grade_level || "-"}</TableCell>
                  <TableCell>{s.semester === 0 ? "ทั้งปี" : s.semester || "-"}</TableCell>
                  <TableCell><Badge variant="secondary">{s.subject_type === "required" ? "พื้นฐาน" : s.subject_type === "elective" ? "เพิ่มเติม" : "กิจกรรม"}</Badge></TableCell>
                  {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditSubject(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSubject(s.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SubjectEditDialog open={!!editSubject} onOpenChange={(o) => { if (!o) setEditSubject(null); }} subject={editSubject} />
      <ProxySubjectMapDialog open={proxyMapOpen} onOpenChange={setProxyMapOpen} subjects={subjects} />
      <TeacherScheduleImportDialog open={teacherImportOpen} onOpenChange={setTeacherImportOpen} />
    </div>
  );
};
