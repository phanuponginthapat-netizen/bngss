import { useState, useMemo } from "react";
import { bkkDateISO, todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileSpreadsheet, TrendingUp, Users, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { BEDatePicker } from "@/components/ui/be-date-picker";

interface Props {
  students: any[];
  classrooms: any[];
  filteredClassrooms: any[];
  gradeFilter: string;
  setGradeFilter: (v: string) => void;
  classroomFilter: string;
  setClassroomFilter: (v: string) => void;
  gradeOptions: string[];
  records: any[];
}

export function AttendanceReportTab({
  students, classrooms, filteredClassrooms,
  gradeFilter, setGradeFilter, classroomFilter, setClassroomFilter,
  gradeOptions, records,
}: Props) {
  const { lang } = useLanguage();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return bkkDateISO(d);
  });
  const [endDate, setEndDate] = useState(todayBangkok());

  const classStudents = useMemo(() => {
    if (!classroomFilter || classroomFilter === "all") return [];
    return students
      .filter((s: any) => s.classroom_id === classroomFilter)
      .sort((a: any, b: any) => (a.student_code || "").localeCompare(b.student_code || ""));
  }, [students, classroomFilter]);

  // Filter records by date range and classroom
  const filteredRecords = useMemo(() => {
    const studentIds = new Set(classStudents.map((s: any) => s.id));
    return records.filter((r: any) =>
      r.student_id && studentIds.has(r.student_id) &&
      r.attendance_date >= startDate && r.attendance_date <= endDate
    );
  }, [records, classStudents, startDate, endDate]);

  // Per-student summary
  const studentSummary = useMemo(() => {
    const map: Record<string, { present: number; absent: number; late: number; sick: number; leave: number; total: number }> = {};
    classStudents.forEach((s: any) => {
      map[s.id] = { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 };
    });
    filteredRecords.forEach((r: any) => {
      if (map[r.student_id]) {
        map[r.student_id].total++;
        const st = r.status as string;
        if (st in map[r.student_id]) {
          (map[r.student_id] as any)[st]++;
        }
      }
    });
    return map;
  }, [classStudents, filteredRecords]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totals = { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 };
    Object.values(studentSummary).forEach(s => {
      totals.present += s.present;
      totals.absent += s.absent;
      totals.late += s.late;
      totals.sick += s.sick;
      totals.leave += s.leave;
      totals.total += s.total;
    });
    return totals;
  }, [studentSummary]);

  const attendanceRate = overallStats.total > 0
    ? ((overallStats.present / overallStats.total) * 100).toFixed(1) : "0";

  // Students at risk (>3 absent days)
  const atRiskStudents = useMemo(() => {
    return classStudents.filter((s: any) => {
      const summary = studentSummary[s.id];
      return summary && summary.absent >= 3;
    });
  }, [classStudents, studentSummary]);

  const exportExcel = () => {
    const rows = classStudents.map((s: any, i: number) => {
      const sm = studentSummary[s.id];
      const rate = sm.total > 0 ? ((sm.present / sm.total) * 100).toFixed(1) : "0";
      return {
        "ลำดับ": i + 1,
        "รหัสนักเรียน": s.student_code,
        "ชื่อ-สกุล": `${s.prefix || ""}${s.first_name} ${s.last_name}`,
        "มา": sm.present,
        "ขาด": sm.absent,
        "สาย": sm.late,
        "ป่วย": sm.sick,
        "ลา": sm.leave,
        "รวมวัน": sm.total,
        "อัตราเข้าเรียน(%)": rate,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานการมาเรียน");
    const classroom = classrooms.find((c: any) => c.id === classroomFilter);
    const fileName = `รายงานการมาเรียน_${classroom?.grade_level || ""}_${classroom?.name || ""}_${startDate}_${endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const classroom = classrooms.find((c: any) => c.id === classroomFilter);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label>{lang === "th" ? "ระดับชั้น" : "Grade"}</Label>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทุกระดับชั้น" : "All"}</SelectItem>
                  {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{lang === "th" ? "ห้องเรียน" : "Room"}</Label>
              <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                  {filteredClassrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{lang === "th" ? "ตั้งแต่" : "From"}</Label>
              <BEDatePicker value={startDate} onChange={(v) => setStartDate(v)} />
            </div>
            <div>
              <Label>{lang === "th" ? "ถึง" : "To"}</Label>
              <BEDatePicker value={endDate} onChange={(v) => setEndDate(v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {classroomFilter && classroomFilter !== "all" && classStudents.length > 0 && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <Users className="w-6 h-6 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{classStudents.length}</div>
                <div className="text-xs text-muted-foreground">{lang === "th" ? "จำนวนนักเรียน" : "Students"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto text-green-600 mb-1" />
                <div className="text-2xl font-bold text-green-600">{attendanceRate}%</div>
                <div className="text-xs text-muted-foreground">{lang === "th" ? "อัตราเข้าเรียน" : "Rate"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-red-600">{overallStats.absent}</div>
                <div className="text-xs text-muted-foreground">{lang === "th" ? "ขาดรวม (ครั้ง)" : "Total Absent"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <AlertTriangle className="w-6 h-6 mx-auto text-orange-500 mb-1" />
                <div className="text-2xl font-bold text-orange-500">{atRiskStudents.length}</div>
                <div className="text-xs text-muted-foreground">{lang === "th" ? "เสี่ยงขาดเรียน (≥3 วัน)" : "At Risk"}</div>
              </CardContent>
            </Card>
          </div>

          {/* At risk warning */}
          {atRiskStudents.length > 0 && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="w-4 h-4" />
                  {lang === "th" ? "นักเรียนเสี่ยงขาดเรียน (ขาด ≥ 3 วัน)" : "At Risk Students (Absent ≥ 3 days)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {atRiskStudents.map((s: any) => (
                    <Badge key={s.id} variant="outline" className="bg-background">
                      {s.prefix}{s.first_name} {s.last_name} ({studentSummary[s.id]?.absent} {lang === "th" ? "วัน" : "d"})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">
                {lang === "th"
                   ? `รายงานการมาเรียน ${classroom?.name}`
                   : `Attendance Report ${classroom?.name}`}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                {lang === "th" ? "ส่งออก Excel" : "Export"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-20">{lang === "th" ? "รหัส" : "Code"}</TableHead>
                    <TableHead>{lang === "th" ? "ชื่อ-สกุล" : "Name"}</TableHead>
                    <TableHead className="text-center w-12">{lang === "th" ? "มา" : "P"}</TableHead>
                    <TableHead className="text-center w-12">{lang === "th" ? "ขาด" : "A"}</TableHead>
                    <TableHead className="text-center w-12">{lang === "th" ? "สาย" : "L"}</TableHead>
                    <TableHead className="text-center w-12">{lang === "th" ? "ป่วย" : "S"}</TableHead>
                    <TableHead className="text-center w-12">{lang === "th" ? "ลา" : "Lv"}</TableHead>
                    <TableHead className="w-32">{lang === "th" ? "อัตรา" : "Rate"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.map((s: any, i: number) => {
                    const sm = studentSummary[s.id];
                    const rate = sm.total > 0 ? (sm.present / sm.total) * 100 : 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                        <TableCell>{s.prefix}{s.first_name} {s.last_name}</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">{sm.present}</TableCell>
                        <TableCell className="text-center text-red-600 font-medium">{sm.absent || "-"}</TableCell>
                        <TableCell className="text-center text-yellow-600 font-medium">{sm.late || "-"}</TableCell>
                        <TableCell className="text-center text-blue-600 font-medium">{sm.sick || "-"}</TableCell>
                        <TableCell className="text-center text-purple-600 font-medium">{sm.leave || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={rate} className="h-2 flex-1" />
                            <span className={`text-xs font-medium ${rate < 80 ? "text-red-600" : "text-green-600"}`}>
                              {rate.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {(!classroomFilter || classroomFilter === "all") && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {lang === "th" ? "กรุณาเลือกห้องเรียนเพื่อดูรายงาน" : "Select a classroom to view report"}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
