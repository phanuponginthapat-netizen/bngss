import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type PersonnelRow,
  exportPObec,
  calculateWorkforce,
  type WorkforceSummary,
} from "@/lib/pObecExport";
import { Download, Users, GraduationCap, Briefcase } from "lucide-react";

export default function POBecExportPage() {
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WorkforceSummary | null>(null);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  async function fetchPersonnel() {
    setLoading(true);
    const { data, error } = await supabase
      .from("personnel")
      .select("*")
      .order("employee_code", { ascending: true });

    if (!error && data) {
      const rows: PersonnelRow[] = data.map((r: any) => ({
        employee_code: r.employee_code ?? "",
        prefix: r.prefix ?? "",
        first_name: r.first_name ?? "",
        last_name: r.last_name ?? "",
        position: r.position ?? "",
        academic_standing: r.academic_standing ?? "",
        education_level: r.education_level ?? "",
        subject_group: r.subject_group ?? "",
        employment_type: r.employment_type ?? "",
        start_date: r.start_date ?? "",
        birth_date: r.birth_date ?? "",
        phone: r.phone ?? "",
        google_email: r.google_email ?? "",
      }));
      setPersonnel(rows);
      setSummary(calculateWorkforce(rows));
    }
    setLoading(false);
  }

  function handleExport() {
    exportPObec(personnel);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">P-OBEC — ส่งออกข้อมูลบุคลากร</h1>
          <p className="text-sm text-muted-foreground">
            ส่งออกข้อมูลบุคลากรตามเทมเพลต สพฐ. สำหรับรายงาน P-OBEC
          </p>
        </div>
        <Button onClick={handleExport} disabled={loading || personnel.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          ส่งออก Excel
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">บุคลากรทั้งหมด</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalPositions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">จำแนกตามวิทยฐานะ</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              {Object.entries(summary.byAcademicStanding).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{k}</span>
                  <Badge variant="secondary">{v}</Badge>
                </div>
              ))}
              {Object.keys(summary.byAcademicStanding).length === 0 && (
                <p className="text-xs text-muted-foreground">ไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">จำแนกตามประเภท</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              {Object.entries(summary.byType).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{k}</span>
                  <Badge variant="secondary">{v.actual}</Badge>
                </div>
              ))}
              {Object.keys(summary.byType).length === 0 && (
                <p className="text-xs text-muted-foreground">ไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>รายชื่อบุคลากร</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : personnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">ไม่มีข้อมูลบุคลากร</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ลำดับ</TableHead>
                    <TableHead>รหัส</TableHead>
                    <TableHead>คำนำหน้า</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>นามสกุล</TableHead>
                    <TableHead>ตำแหน่ง</TableHead>
                    <TableHead>วิทยฐานะ</TableHead>
                    <TableHead>วุฒิการศึกษา</TableHead>
                    <TableHead>กลุ่มสาระ</TableHead>
                    <TableHead>ประเภท</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnel.map((p, i) => (
                    <TableRow key={p.employee_code || i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-mono">{p.employee_code}</TableCell>
                      <TableCell>{p.prefix}</TableCell>
                      <TableCell>{p.first_name}</TableCell>
                      <TableCell>{p.last_name}</TableCell>
                      <TableCell>{p.position}</TableCell>
                      <TableCell>{p.academic_standing}</TableCell>
                      <TableCell>{p.education_level}</TableCell>
                      <TableCell>{p.subject_group}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.employment_type}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
