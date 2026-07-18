import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const SC: Record<string, string> = {
  present: "bg-success-soft text-success-soft-foreground",
  absent: "bg-danger-soft text-danger-soft-foreground",
  late: "bg-warning-soft text-warning-soft-foreground",
  sick: "bg-info-soft text-info-soft-foreground",
  leave: "bg-info-soft text-info-soft-foreground",
};
const SL: Record<string, Record<string, string>> = {
  present: { th: "มา", en: "Present" },
  absent: { th: "ขาด", en: "Absent" },
  late: { th: "สาย", en: "Late" },
  sick: { th: "ป่วย", en: "Sick" },
  leave: { th: "ลา", en: "Leave" },
};

interface Props {
  records: any[];
  students: any[];
  classrooms: any[];
  filteredClassrooms: any[];
  gradeFilter: string;
  setGradeFilter: (v: string) => void;
  classroomFilter: string;
  setClassroomFilter: (v: string) => void;
  gradeOptions: string[];
}

export function AttendanceHistoryTab({
  records, students, filteredClassrooms,
  gradeFilter, setGradeFilter, classroomFilter, setClassroomFilter,
  gradeOptions,
}: Props) {
  const { lang } = useLanguage();
  const qc = useQueryClient();

  const filteredRecords = useMemo(() => {
    let result = records;
    if (gradeFilter && gradeFilter !== "all") {
      result = result.filter((r: any) => r.students?.classrooms?.grade_level === gradeFilter);
    }
    if (classroomFilter && classroomFilter !== "all") {
      const ids = new Set(students.filter((s: any) => s.classroom_id === classroomFilter).map((s: any) => s.id));
      result = result.filter((r: any) => ids.has(r.student_id));
    }
    return result;
  }, [records, gradeFilter, classroomFilter, students]);

  const handleDelete = async (id: string) => {
    await supabase.from("attendance").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["attendance"] });
    toast.success(lang === "th" ? "ลบสำเร็จ" : "Deleted");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "th" ? "ทุกระดับชั้น" : "All"}</SelectItem>
            {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classroomFilter} onValueChange={setClassroomFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder={lang === "th" ? "ห้องเรียน" : "Room"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
            {filteredClassrooms.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "th" ? "วันที่" : "Date"}</TableHead>
                <TableHead>{lang === "th" ? "นักเรียน" : "Student"}</TableHead>
                <TableHead>{lang === "th" ? "ห้อง" : "Room"}</TableHead>
                <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                <TableHead>{lang === "th" ? "หมายเหตุ" : "Notes"}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {lang === "th" ? "ไม่มีข้อมูล" : "No data"}
                  </TableCell>
                </TableRow>
              ) : filteredRecords.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.attendance_date}</TableCell>
                  <TableCell>
                    {r.students
                      ? `${r.students.prefix || ""}${r.students.first_name} ${r.students.last_name}`
                      : r.recorded_by}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.students?.classrooms
                      ? r.students.classrooms.name
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={SC[r.status] || ""}>
                      {SL[r.status]?.[lang] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.notes}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
