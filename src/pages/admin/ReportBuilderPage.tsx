import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";

const DATA_SOURCES = [
  { value: "students", label: "นักเรียน", table: "students", columns: ["id", "student_code", "first_name", "last_name", "grade_level", "classroom_id", "gender", "date_of_birth"] },
  { value: "attendance", label: "การเข้าแถว", table: "student_attendance", columns: ["id", "student_id", "attendance_date", "status", "period", "note"] },
  { value: "scores", label: "ผลการเรียน", table: "student_scores", columns: ["id", "student_id", "subject", "score", "academic_year", "semester", "grade_level"] },
  { value: "personnel", label: "บุคลากร", table: "personnel", columns: ["id", "employee_code", "first_name", "last_name", "position", "department", "phone"] },
];

const GRADE_LEVELS = ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6", "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];

function toCSV(rows: Record<string, unknown>[], cols: string[]): string {
  const header = cols.join(",");
  const lines = rows.map((r) =>
    cols.map((c) => {
      const v = r[c];
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}

export default function ReportBuilderPage() {
  const [source, setSource] = useState(DATA_SOURCES[0].value);
  const [selectedCols, setSelectedCols] = useState<string[]>(DATA_SOURCES[0].columns.slice(0, 5));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [gradeLevel, setGradeLevel] = useState<string>("all");

  const currentSource = useMemo(() => DATA_SOURCES.find((s) => s.value === source)!, [source]);

  const toggleCol = (col: string) => {
    setSelectedCols((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const selectAllCols = () => setSelectedCols([...currentSource.columns]);
  const clearCols = () => setSelectedCols([]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["report-builder", source, dateFrom, dateTo, gradeLevel],
    queryFn: async () => {
      let q = supabase.from(currentSource.table).select("*").limit(500);

      if (source === "students" && gradeLevel !== "all") {
        q = q.eq("grade_level", gradeLevel);
      }
      if (source === "attendance" && dateFrom) {
        q = q.gte("attendance_date", dateFrom);
      }
      if (source === "attendance" && dateTo) {
        q = q.lte("attendance_date", dateTo);
      }
      if (source === "scores") {
        if (gradeLevel !== "all") q = q.eq("grade_level", gradeLevel);
        if (dateFrom) q = q.gte("academic_year", Number(dateFrom));
      }
      if (source === "personnel" && gradeLevel !== "all") {
        q = q.eq("department", gradeLevel);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Record<string, unknown>[];
    },
  });

  const exportCSV = () => {
    if (!rows.length || !selectedCols.length) return;
    const csv = toCSV(rows, selectedCols);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${source}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-6 w-6" />
        <h1 className="text-2xl font-bold">รายงานแบบกำหนดเอง</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>เลือกแหล่งข้อมูล</CardTitle>
          <CardDescription>เลือกตาราง คอลัมน์ และตัวกรองสำหรับรายงาน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>แหล่งข้อมูล</Label>
              <Select
                value={source}
                onValueChange={(v) => {
                  setSource(v);
                  const src = DATA_SOURCES.find((s) => s.value === v)!;
                  setSelectedCols(src.columns.slice(0, 5));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ระดับชั้น/แผนก</Label>
              <Select value={gradeLevel} onValueChange={setGradeLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {GRADE_LEVELS.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(source === "attendance" || source === "scores") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{source === "scores" ? "ปีการศึกษา" : "วันที่เริ่ม"}</Label>
                <Input
                  type={source === "scores" ? "number" : "date"}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder={source === "scores" ? "เช่น 2567" : ""}
                />
              </div>
              {source === "attendance" && (
                <div className="space-y-2">
                  <Label>วันที่สิ้นสุด</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>คอลัมน์ที่ต้องการแสดง</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllCols}>เลือกทั้งหมด</Button>
                <Button variant="ghost" size="sm" onClick={clearCols}>ล้าง</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {currentSource.columns.map((col) => (
                <label key={col} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={selectedCols.includes(col)}
                    onCheckedChange={() => toggleCol(col)}
                  />
                  {col}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>ตัวอย่างข้อมูล</CardTitle>
            <CardDescription>{rows.length} รายการ</CardDescription>
          </div>
          <Button onClick={exportCSV} disabled={!rows.length || !selectedCols.length || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            ส่งออก CSV
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">ไม่มีข้อมูล</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectedCols.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((row, i) => (
                    <TableRow key={i}>
                      {selectedCols.map((col) => (
                        <TableCell key={col}>{row[col] == null ? "-" : String(row[col])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 100 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  แสดง 100 จาก {rows.length} รายการ
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
