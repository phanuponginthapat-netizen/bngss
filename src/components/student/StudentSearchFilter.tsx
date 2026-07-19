import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface StudentSearchFilterProps {
  students: any[];
  classrooms: any[];
  onStudentSelect?: (studentId: string) => void;
  selectedStudentId?: string;
  showClassroomFilter?: boolean;
  /** Returns filtered students for table display */
  onFilteredStudents?: (students: any[]) => void;
}

const StudentSearchFilter = ({
  students,
  classrooms,
  onStudentSelect,
  selectedStudentId,
  showClassroomFilter = true,
}: StudentSearchFilterProps) => {
  const { lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [scanOpen, setScanOpen] = useState(false);
  const [pendingScan, setPendingScan] = useState<string | null>(null);

  const gradeOptions = useMemo(() => {
    const grades = [...new Set(classrooms.map((c: any) => c.grade_level))].sort();
    return grades;
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    if (gradeFilter === "all") return classrooms;
    return classrooms.filter((c: any) => c.grade_level === gradeFilter);
  }, [classrooms, gradeFilter]);

  const filteredStudents = useMemo(() => {
    let result = students;
    
    if (gradeFilter !== "all") {
      const classroomIds = filteredClassrooms.map((c: any) => c.id);
      result = result.filter((s: any) => classroomIds.includes(s.classroom_id));
    }
    
    if (classroomFilter !== "all") {
      result = result.filter((s: any) => s.classroom_id === classroomFilter);
    }
    
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s: any) =>
        s.student_code?.toLowerCase().includes(q) ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [students, gradeFilter, classroomFilter, search, filteredClassrooms]);

  // Auto-select when a scan resolves to exactly one student
  useEffect(() => {
    if (!pendingScan || !onStudentSelect) return;
    (async () => {
      // ลอง match ตรงๆ ใน list ก่อน (บาร์โค้ด CODE_128 = student_code)
      let exact = students.find((s: any) => s.student_code === pendingScan);
      if (!exact) {
        const { resolveScannedStudent } = await import("@/lib/resolveScannedStudent");
        const r = await resolveScannedStudent(pendingScan);
        if (r) exact = students.find((s: any) => s.id === r.id);
      }
      if (exact) {
        onStudentSelect(exact.id);
        toast.success(`เลือกแล้ว: ${exact.first_name ?? ""} ${exact.last_name ?? ""}`.trim());
      } else {
        toast.error(`ไม่พบนักเรียนจาก QR (${pendingScan.slice(0, 40)})`);
      }
      setPendingScan(null);
    })();
  }, [pendingScan, students, onStudentSelect]);


  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search by code or name */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={lang === "th" ? "ค้นหาจากรหัสหรือชื่อนักเรียน..." : "Search by code or name..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Scan ID card / barcode */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setScanOpen(true)}
          title={lang === "th" ? "สแกนบัตรนักเรียน" : "Scan student card"}
          className="shrink-0"
        >
          <ScanLine className="w-4 h-4" />
        </Button>

        {/* Grade filter */}
        <Select value={gradeFilter} onValueChange={v => { setGradeFilter(v); setClassroomFilter("all"); }}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "th" ? "ทุกระดับชั้น" : "All Grades"}</SelectItem>
            {gradeOptions.map((g: string) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Classroom filter */}
        {showClassroomFilter && (
          <Select value={classroomFilter} onValueChange={setClassroomFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={lang === "th" ? "ห้องเรียน" : "Classroom"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All Rooms"}</SelectItem>
              {filteredClassrooms.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Student selector (for dialogs) */}
      {onStudentSelect && (
        <Select value={selectedStudentId} onValueChange={onStudentSelect}>
          <SelectTrigger>
            <SelectValue placeholder={lang === "th" ? "เลือกนักเรียน" : "Select student"} />
          </SelectTrigger>
          <SelectContent>
            {filteredStudents.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>
                {s.student_code} - {s.prefix || ""}{s.first_name} {s.last_name}
              </SelectItem>
            ))}
            {filteredStudents.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {lang === "th" ? "ไม่พบนักเรียน" : "No students found"}
              </div>
            )}
          </SelectContent>
        </Select>
      )}

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(code) => {
          const c = (code || "").trim();
          if (!c) return;
          setSearch(c);
          setPendingScan(c);
        }}
        title={lang === "th" ? "สแกนบัตรนักเรียน" : "Scan student card"}
      />
    </div>
  );
};

// Hook for pages to use the filter logic externally
export const useStudentFilter = (students: any[], classrooms: any[], initialClassroomId?: string | null) => {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [classroomFilter, setClassroomFilter] = useState(initialClassroomId || "all");

  const gradeOptions = useMemo(() => {
    const grades = [...new Set(classrooms.map((c: any) => c.grade_level as string))].sort();
    return grades;
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    if (gradeFilter === "all") return classrooms;
    return classrooms.filter((c: any) => c.grade_level === gradeFilter);
  }, [classrooms, gradeFilter]);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (gradeFilter !== "all") {
      const classroomIds = filteredClassrooms.map((c: any) => c.id);
      result = result.filter((s: any) => classroomIds.includes(s.classroom_id));
    }
    if (classroomFilter !== "all") {
      result = result.filter((s: any) => s.classroom_id === classroomFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s: any) =>
        s.student_code?.toLowerCase().includes(q) ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [students, gradeFilter, classroomFilter, search, filteredClassrooms]);

  return {
    search, setSearch,
    gradeFilter, setGradeFilter,
    classroomFilter, setClassroomFilter,
    gradeOptions, filteredClassrooms, filteredStudents,
  };
};

export default StudentSearchFilter;
