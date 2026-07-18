import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, GraduationCap } from "lucide-react";

interface StudentSelectorProps {
  students: any[];
  classrooms: any[];
  studentCode: string;
  onStudentChange: (code: string) => void;
}

const StudentSelector = ({ students, classrooms, studentCode, onStudentChange }: StudentSelectorProps) => {
  const [gradeFilter, setGradeFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    classrooms.forEach((c: any) => grades.add(c.grade_level));
    return Array.from(grades).sort();
  }, [classrooms]);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (gradeFilter) {
      const classroomIds = classrooms
        .filter((c: any) => c.grade_level === gradeFilter)
        .map((c: any) => c.id);
      list = list.filter((s: any) => classroomIds.includes(s.classroom_id));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((s: any) =>
        s.student_code?.toLowerCase().includes(term) ||
        `${s.prefix || ""}${s.first_name} ${s.last_name}`.toLowerCase().includes(term)
      );
    }
    return list;
  }, [students, classrooms, gradeFilter, searchTerm]);

  return (
    <div className="flex flex-wrap gap-3 items-end print:hidden">
      <div className="w-[180px]">
        <Label className="text-xs mb-1 block flex items-center gap-1">
          <GraduationCap className="w-3 h-3" /> ระดับชั้น
        </Label>
        <Select value={gradeFilter} onValueChange={v => setGradeFilter(v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="ทั้งหมด" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกระดับชั้น</SelectItem>
            {uniqueGrades.map(g => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[220px]">
        <Label className="text-xs mb-1 block flex items-center gap-1">
          <Search className="w-3 h-3" /> ค้นหารหัส/ชื่อ
        </Label>
        <Input
          placeholder="พิมพ์รหัสหรือชื่อนักเรียน..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="w-[350px]">
        <Label className="text-xs mb-1 block">เลือกนักเรียน</Label>
        <Select value={studentCode} onValueChange={onStudentChange}>
          <SelectTrigger>
            <SelectValue placeholder="เลือกนักเรียน" />
          </SelectTrigger>
          <SelectContent>
            {filteredStudents.map((s: any) => (
              <SelectItem key={s.student_code} value={s.student_code}>
                {s.student_code} - {s.prefix}{s.first_name} {s.last_name}
                {s.classrooms ? ` (${s.classrooms.grade_level})` : ""}
              </SelectItem>
            ))}
            {filteredStudents.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">ไม่พบนักเรียน</div>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default StudentSelector;
