import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Books, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { openPrintWindow } from "@/lib/printUtils";
import { loadClassBookletData, buildTranscriptBooklet, buildReportCardBooklet, type BookletSchoolInfo } from "@/lib/ppBooklet";
import { BE_OFFSET } from "@/lib/dateBE";

interface Props {
  kind: "pp1" | "pp6";
  school: BookletSchoolInfo;
  /** ค่าเริ่มต้นภาคเรียน (ใช้กับ ปพ.6) */
  defaultSemester?: string;
}

export default function ClassBookletDialog({ kind, school, defaultSemester = "1" }: Props) {
  const [open, setOpen] = useState(false);
  const [gradeLevel, setGradeLevel] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [semester, setSemester] = useState(defaultSemester);
  const [busy, setBusy] = useState(false);

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms_for_selector"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
    enabled: open,
  });

  const grades = Array.from(new Set(classrooms.map((c: any) => c.grade_level).filter(Boolean))).sort();
  const classOptions = gradeLevel ? classrooms.filter((c: any) => c.grade_level === gradeLevel) : classrooms;

  const handlePrint = async () => {
    if (!classroomId) return;
    setBusy(true);
    try {
      const sem = kind === "pp6" ? parseInt(semester, 10) : undefined;
      const data = await loadClassBookletData(classroomId, { semester: sem });
      if (!data.students.length) {
        toast.error("ห้องเรียนนี้ยังไม่มีนักเรียนที่กำลังศึกษาอยู่");
        return;
      }
      const html =
        kind === "pp1"
          ? buildTranscriptBooklet(data, school)
          : buildReportCardBooklet(data, school, {
              semester: sem || 1,
              academicYearBE: String((data.classroom?.academic_year || new Date().getFullYear()) + (Number(data.classroom?.academic_year) > 2400 ? 0 : BE_OFFSET)),
            });
      const label = data.classroom ? `${data.classroom.grade_level}-${data.classroom.name}` : "";
      openPrintWindow(html, { title: `${kind === "pp1" ? "ปพ.1" : "ปพ.6"} รวมเล่ม ${label}` });
      toast.success(`เตรียมเล่มเรียบร้อย (${data.students.length} คน)`);
      setOpen(false);
    } catch (e: any) {
      toast.error(`สร้างเล่มไม่สำเร็จ: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Books className="w-4 h-4 mr-2" />
          พิมพ์ทั้งห้อง (รวมเล่ม)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>พิมพ์ {kind === "pp1" ? "ปพ.1" : "ปพ.6"} รวมเล่มทั้งห้อง</DialogTitle>
          <DialogDescription>ระบบจะจัดหน้าปก สารบัญ เอกสารรายบุคคล เลขหน้าต่อเนื่อง และหน้ารับรองท้ายเล่มให้อัตโนมัติ</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">ระดับชั้น</Label>
            <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setClassroomId(""); }}>
              <SelectTrigger><SelectValue placeholder="เลือกระดับชั้น" /></SelectTrigger>
              <SelectContent>
                {grades.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">ห้องเรียน</Label>
            <Select value={classroomId} onValueChange={setClassroomId}>
              <SelectTrigger><SelectValue placeholder="เลือกห้องเรียน" /></SelectTrigger>
              <SelectContent>
                {classOptions.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "pp6" && (
            <div>
              <Label className="text-xs">ภาคเรียน</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
                  <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button className="w-full" disabled={!classroomId || busy} onClick={handlePrint}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            {busy ? "กำลังรวบรวมข้อมูล..." : "สร้างและพิมพ์เล่ม"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
