import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, GraduationCap, FileText, Users, Download } from "lucide-react";
import { ScanSearchButton } from "@/components/student/ScanSearchButton";
import { toBE } from "@/lib/utils";

const TERMINAL_GRADES = ["ป.6", "ม.3", "ม.6"];

const AlumniPage = () => {
  const { lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const { data: alumni = [] } = useQuery({
    queryKey: ["alumni"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*, classrooms!students_classroom_id_fkey(*)")
        .eq("status", "graduated")
        .order("graduation_year", { ascending: false, nullsFirst: false })
        .order("student_code");
      return data || [];
    },
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["alumni_scores", selectedStudent?.student_code],
    queryFn: async () => {
      if (!selectedStudent?.student_code) return [];
      const { data } = await supabase
        .from("student_scores")
        .select("*, subjects(*)")
        .eq("student_code", selectedStudent.student_code)
        .order("academic_year")
        .order("semester");
      return data || [];
    },
    enabled: !!selectedStudent?.student_code,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects_for_alumni"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("*");
      return data || [];
    },
  });

  const graduationYears = [...new Set(alumni.map((a: any) => a.graduation_year).filter(Boolean))].sort((a, b) => b - a);
  const graduationLevels = [...new Set(alumni.map((a: any) => a.graduation_level).filter(Boolean))];

  const filtered = alumni.filter((s: any) => {
    const matchSearch = !search || 
      s.first_name?.includes(search) || 
      s.last_name?.includes(search) || 
      s.student_code?.includes(search);
    const matchLevel = filterLevel === "all" || s.graduation_level === filterLevel;
    const matchYear = filterYear === "all" || String(s.graduation_year) === filterYear;
    return matchSearch && matchLevel && matchYear;
  });

  const getSubject = (sid: string) => subjects.find((s: any) => s.id === sid);

  const groupedScores: Record<string, any[]> = {};
  scores.forEach((s: any) => {
    const key = `${toBE(s.academic_year)}/${s.semester}`;
    if (!groupedScores[key]) groupedScores[key] = [];
    groupedScores[key].push(s);
  });

  const handleExportCSV = () => {
    const headers = ["รหัสนักเรียน", "คำนำหน้า", "ชื่อ", "นามสกุล", "ระดับชั้นที่จบ", "ปีที่จบ (พ.ศ.)", "GPA", "อีเมล (บัญชีเดิม)"];
    const rows = filtered.map((s: any) => [
      s.student_code, s.prefix || "", s.first_name, s.last_name,
      s.graduation_level || "", s.graduation_year ? toBE(s.graduation_year) : "", s.graduation_gpa || "",
      s.auth_email || ""
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alumni_list.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6" />
            ศิษย์เก่า / นักเรียนที่จบการศึกษา
          </h1>
          <p className="text-sm text-muted-foreground">ข้อมูลนักเรียนที่จบการศึกษาแล้ว พร้อมประวัติผลการเรียนย้อนหลัง</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-2" />ส่งออก CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{alumni.length}</div>
            <div className="text-xs text-muted-foreground">ศิษย์เก่าทั้งหมด</div>
          </CardContent>
        </Card>
        {TERMINAL_GRADES.map(g => {
          const count = alumni.filter((a: any) => a.graduation_level === g).length;
          if (count === 0) return null;
          return (
            <Card key={g}>
              <CardContent className="p-4 text-center">
                <GraduationCap className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">จบ {g}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ค้นหาชื่อ/รหัสนักเรียน..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <ScanSearchButton onScan={setSearch} />
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="ระดับชั้นที่จบ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                {graduationLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="ปีที่จบ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกปี</SelectItem>
                {graduationYears.map(y => <SelectItem key={y} value={String(y)}>พ.ศ. {toBE(y)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายชื่อศิษย์เก่า ({filtered.length} คน)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>รหัสนักเรียน</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead>อีเมล (บัญชีเดิม)</TableHead>
                <TableHead className="text-center">ระดับชั้นที่จบ</TableHead>
                <TableHead className="text-center">ปีที่จบ (พ.ศ.)</TableHead>
                <TableHead className="text-center">GPA</TableHead>
                <TableHead className="text-center">ดูผลการเรียน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลศิษย์เก่า</TableCell></TableRow>
              ) : filtered.map((s: any, i: number) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                  <TableCell>{s.prefix}{s.first_name} {s.last_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.auth_email || "-"}</TableCell>
                  <TableCell className="text-center"><Badge variant="secondary">{s.graduation_level || "-"}</Badge></TableCell>
                  <TableCell className="text-center">{s.graduation_year ? toBE(s.graduation_year) : "-"}</TableCell>
                  <TableCell className="text-center font-bold text-primary">{s.graduation_gpa ? Number(s.graduation_gpa).toFixed(2) : "-"}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(s)}>
                      <FileText className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GPA Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={open => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ประวัติผลการเรียน — {selectedStudent?.prefix}{selectedStudent?.first_name} {selectedStudent?.last_name}</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">รหัสนักเรียน: </span>{selectedStudent.student_code}</div>
                <div><span className="text-muted-foreground">ระดับที่จบ: </span>{selectedStudent.graduation_level || "-"}</div>
                <div><span className="text-muted-foreground">ปีที่จบ: </span>{selectedStudent.graduation_year ? `พ.ศ. ${toBE(selectedStudent.graduation_year)}` : "-"}</div>
                <div><span className="text-muted-foreground">GPA สะสม: </span><span className="font-bold text-primary">{selectedStudent.graduation_gpa ? Number(selectedStudent.graduation_gpa).toFixed(2) : "-"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">อีเมล (บัญชีเดิม): </span>{selectedStudent.auth_email || "-"}</div>
              </div>

              {Object.keys(groupedScores).length === 0 ? (
                <p className="text-center py-6 text-muted-foreground">ไม่มีข้อมูลผลการเรียนย้อนหลัง</p>
              ) : Object.entries(groupedScores).map(([key, semScores]) => {
                const semCredits = semScores.reduce((a: number, s: any) => {
                  const sub = getSubject(s.subject_id);
                  return a + (sub?.credits || 0);
                }, 0);
                const semGP = semScores.reduce((a: number, s: any) => {
                  const sub = getSubject(s.subject_id);
                  return a + (s.grade_point || 0) * (sub?.credits || 0);
                }, 0);
                const semGPA = semCredits > 0 ? (semGP / semCredits).toFixed(2) : "0.00";

                return (
                  <div key={key}>
                    <h4 className="font-semibold text-sm text-primary mb-1">ปีการศึกษา {key.replace("/", " ภาคเรียนที่ ")}</h4>
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>รหัสวิชา</TableHead>
                          <TableHead>ชื่อวิชา</TableHead>
                          <TableHead className="text-center">หน่วยกิต</TableHead>
                          <TableHead className="text-center">เกรด</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {semScores.map((s: any) => {
                          const sub = getSubject(s.subject_id);
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono">{sub?.code || ""}</TableCell>
                              <TableCell>{sub?.name_th || ""}</TableCell>
                              <TableCell className="text-center">{sub?.credits || ""}</TableCell>
                              <TableCell className="text-center"><Badge variant="outline">{s.grade || "-"}</Badge></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-right text-muted-foreground mt-1">หน่วยกิต: {semCredits} | GPA: {semGPA}</p>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlumniPage;
