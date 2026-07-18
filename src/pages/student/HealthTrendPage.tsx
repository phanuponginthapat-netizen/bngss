import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import HealthTrendChart from "@/components/student/HealthTrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Search, Info, ScanLine } from "lucide-react";
import { useHomeroomClassrooms } from "@/hooks/useHomeroomClassrooms";
import { useParentChildren } from "@/hooks/useParentChildren";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { toast } from "sonner";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string | null;
  classroom_id: string | null;
  gender: string | null;
  date_of_birth: string | null;
  classrooms?: { name: string; grade_level: string | null } | null;
}

interface Classroom {
  id: string;
  name: string;
  grade_level: string | null;
}

export default function HealthTrendPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [q, setQ] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [classroomFilter, setClassroomFilter] = useState<string>("all");
  const [scannerOpen, setScannerOpen] = useState(false);
  const { homeroomClassroomIds, isFiltered, hasHomeroom, teacherFullName } = useHomeroomClassrooms();
  const { isParent, childIds } = useParentChildren();

  // โหลดรายการห้องเรียนสำหรับตัวกรอง
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("classrooms")
        .select("id, name, grade_level")
        .order("grade_level")
        .order("name");
      setClassrooms((data as any) ?? []);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      let query = supabase
        .from("students")
        .select("id,first_name,last_name,student_code,classroom_id,gender,date_of_birth,classrooms!students_classroom_id_fkey(name,grade_level)")
        .eq("status", "active");

      const term = q.trim();
      if (term) {
        query = query.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,student_code.ilike.%${term}%`,
        );
      }

      const { data, error } = await query.order("first_name").limit(500);
      if (cancelled) return;
      if (error) console.error("[HealthTrend] students fetch", error);
      setStudents((data as any) ?? []);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const scoped = useMemo(() => {
    if (isParent) return students.filter((s) => childIds.includes(s.id));
    if (!isFiltered || !homeroomClassroomIds) return students;
    return students.filter((s) => s.classroom_id && homeroomClassroomIds.includes(s.classroom_id));
  }, [students, isFiltered, homeroomClassroomIds, isParent, childIds]);

  const filtered = useMemo(() => {
    return scoped.filter((s) => {
      if (gradeFilter !== "all" && s.classrooms?.grade_level !== gradeFilter) return false;
      if (classroomFilter !== "all" && s.classroom_id !== classroomFilter) return false;
      return true;
    });
  }, [scoped, gradeFilter, classroomFilter]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    classrooms.forEach((c) => c.grade_level && set.add(c.grade_level));
    return Array.from(set).sort();
  }, [classrooms]);

  const classroomOptions = useMemo(() => {
    if (gradeFilter === "all") return classrooms;
    return classrooms.filter((c) => c.grade_level === gradeFilter);
  }, [classrooms, gradeFilter]);

  const handleScan = async (code: string) => {
    setScannerOpen(false);
    const clean = code.trim();
    if (!clean) return;
    // ค้นหานักเรียนจากรหัสที่สแกน (ลองทั้งใน list ปัจจุบัน และค้นจาก DB)
    const found = students.find(
      (s) => s.student_code === clean || s.id === clean,
    );
    if (found) {
      setSelected(found);
      toast.success(`เลือก: ${found.first_name} ${found.last_name}`);
      return;
    }
    const { data } = await supabase
      .from("students")
      .select("id,first_name,last_name,student_code,classroom_id,gender,date_of_birth,classrooms!students_classroom_id_fkey(name,grade_level)")
      .or(`student_code.eq.${clean},id.eq.${clean}`)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (data) {
      setSelected(data as any);
      toast.success(`เลือก: ${(data as any).first_name} ${(data as any).last_name}`);
    } else {
      toast.error(`ไม่พบนักเรียนรหัส ${clean}`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Activity className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">แนวโน้มสุขภาพนักเรียน</h1>
          <p className="text-sm text-muted-foreground">น้ำหนัก / ส่วนสูง / BMI เทียบเกณฑ์กรมอนามัย</p>
        </div>
      </div>

      {isFiltered && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
          <div>
            {hasHomeroom ? (
              <>กำลังแสดงเฉพาะนักเรียนในห้องประจำชั้นของ <b>{teacherFullName}</b> ({scoped.length} คน)</>
            ) : (
              <>ยังไม่ได้ตั้งห้องประจำชั้นให้คุณ — กรุณาแจ้งผู้ดูแลระบบ</>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>เลือกนักเรียน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute top-3 left-2 text-muted-foreground" />
                <Input className="pl-8" placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)} title="สแกน QR / บาร์โค้ด">
                <ScanLine className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setClassroomFilter("all"); }}>
                <SelectTrigger><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                  {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                <SelectTrigger><SelectValue placeholder="ห้องเรียน" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกห้อง</SelectItem>
                  {classroomOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">พบ {filtered.length} คน</div>

            <div className="border rounded divide-y max-h-[500px] overflow-y-auto">
              {filtered.slice(0, 200).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selected?.id === s.id ? "bg-muted font-medium" : ""}`}
                >
                  <div>{s.first_name} {s.last_name}</div>
                  <div className="text-xs text-muted-foreground">{s.student_code} • {s.classrooms?.name ?? "-"}</div>
                </button>
              ))}
              {filtered.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">ไม่พบนักเรียน</div>}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {selected ? (
            <HealthTrendChart studentId={selected.id} student={selected} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                เลือกนักเรียนจากรายการด้านซ้าย หรือสแกน QR เพื่อดูกราฟแนวโน้มสุขภาพ
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="สแกน QR / บาร์โค้ดนักเรียน"
      />
    </div>
  );
}
