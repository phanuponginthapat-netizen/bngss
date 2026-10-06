import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Loader2 } from "lucide-react";
import { useSchoolReport } from "@/hooks/useSchoolReport";
import { BE_OFFSET } from "@/lib/dateBE";

/**
 * รายงานการประเมินตนเองของสถานศึกษา (SAR) — รวบรวมข้อมูลพื้นฐานจากระบบ
 * ตามมาตรฐานการศึกษาขั้นพื้นฐาน 3 มาตรฐาน (คุณภาพผู้เรียน / กระบวนการบริหาร / การจัดการเรียนการสอน)
 */
const GRADE_POINT: Record<string, number> = { "4": 4, "3.5": 3.5, "3": 3, "2.5": 2.5, "2": 2, "1.5": 1.5, "1": 1, "0": 0 };

const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

async function fetchAll<T = any>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase as any).from(table).select(select).range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export default function SarReportPage() {
  const { printReport } = useSchoolReport();
  const yearCE = new Date().getMonth() < 4 ? new Date().getFullYear() - 1 : new Date().getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["sar_report", yearCE],
    queryFn: async () => {
      const [students, scores, screenings, attendance, personnel] = await Promise.all([
        fetchAll("students", "id, gender, status, classrooms!students_classroom_id_fkey(grade_level)"),
        fetchAll("student_scores", "student_code, grade, academic_year"),
        fetchAll("student_screenings", "student_id, category"),
        fetchAll("attendance", "status, date").then((r: any[]) => r.filter((a) => String(a.date || "").startsWith(String(yearCE)) || String(a.date || "").startsWith(String(yearCE + 1)))),
        fetchAll("personnel", "id, status"),
      ]);
      const active = students.filter((s: any) => s.status === "active");
      const byGrade = new Map<string, { m: number; f: number }>();
      for (const s of active as any[]) {
        const g = s.classrooms?.grade_level || "ไม่ระบุชั้น";
        const row = byGrade.get(g) || { m: 0, f: 0 };
        if (/ญ|หญิง|female|f/i.test(s.gender || "")) row.f++; else row.m++;
        byGrade.set(g, row);
      }
      const yearScores = scores.filter((s: any) => [yearCE, yearCE + BE_OFFSET].includes(Number(s.academic_year)));
      const dist: Record<string, number> = {};
      let pts = 0, n = 0, good = 0;
      for (const s of yearScores as any[]) {
        const g = String(s.grade ?? "").trim();
        dist[g || "-"] = (dist[g || "-"] || 0) + 1;
        if (g in GRADE_POINT) { pts += GRADE_POINT[g]; n++; if (GRADE_POINT[g] >= 3) good++; }
      }
      const present = attendance.filter((a: any) => ["present", "late"].includes(a.status)).length;
      const scr = { normal: 0, risk: 0, problem: 0 } as Record<string, number>;
      for (const s of screenings as any[]) if (s.category in scr) scr[s.category]++;
      return {
        total: active.length,
        byGrade: [...byGrade.entries()].sort(),
        avgGrade: n ? Math.floor((pts / n) * 100) / 100 : 0,
        goodPct: n ? (good / n) * 100 : 0,
        dist,
        attendancePct: attendance.length ? (present / attendance.length) * 100 : 0,
        attendanceN: attendance.length,
        scr,
        teachers: personnel.filter((p: any) => !p.status || p.status === "active").length,
      };
    },
  });

  const yearBE = yearCE + BE_OFFSET;

  const handlePrint = () => {
    if (!data) return;
    const td = "border:1px solid #333;padding:4px 8px";
    const gradeRows = data.byGrade.map(([g, r]) => `<tr><td style="${td}">${esc(g)}</td><td style="${td};text-align:center">${r.m}</td><td style="${td};text-align:center">${r.f}</td><td style="${td};text-align:center">${r.m + r.f}</td></tr>`).join("");
    const distRows = Object.entries(data.dist).sort().map(([g, c]) => `<tr><td style="${td};text-align:center">${esc(g)}</td><td style="${td};text-align:center">${c}</td></tr>`).join("");
    const body = `
      <h3>ส่วนที่ 1 ข้อมูลพื้นฐาน</h3>
      <p>จำนวนนักเรียนทั้งหมด ${data.total} คน ครูและบุคลากร ${data.teachers} คน</p>
      <table style="border-collapse:collapse;width:100%"><tr><th style="${td}">ระดับชั้น</th><th style="${td}">ชาย</th><th style="${td}">หญิง</th><th style="${td}">รวม</th></tr>${gradeRows}</table>
      <h3>มาตรฐานที่ 1 คุณภาพของผู้เรียน</h3>
      <p>ผลการเรียนเฉลี่ย ${data.avgGrade.toFixed(2)} — ร้อยละผู้เรียนได้ระดับ 3 ขึ้นไป ${data.goodPct.toFixed(2)}</p>
      <table style="border-collapse:collapse;width:50%"><tr><th style="${td}">ระดับผลการเรียน</th><th style="${td}">จำนวน (รายวิชา-คน)</th></tr>${distRows}</table>
      <p>ร้อยละการมาเรียน ${data.attendancePct.toFixed(2)} (จาก ${data.attendanceN} รายการ)</p>
      <h3>มาตรฐานที่ 2 กระบวนการบริหารและการจัดการ</h3>
      <p>ระบบดูแลช่วยเหลือนักเรียน: คัดกรองแล้ว ปกติ ${data.scr.normal} / กลุ่มเสี่ยง ${data.scr.risk} / มีปัญหา ${data.scr.problem}</p>
      <h3>มาตรฐานที่ 3 กระบวนการจัดการเรียนการสอนที่เน้นผู้เรียนเป็นสำคัญ</h3>
      <p style="min-height:30mm">........................................................................................................</p>`;
    printReport(body, { documentTitle: `รายงานการประเมินตนเองของสถานศึกษา (SAR) ปีการศึกษา ${yearBE}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">รายงานการประเมินตนเอง (SAR)</h1>
          <p className="text-sm text-muted-foreground">ปีการศึกษา {yearBE} — ข้อมูลรวบรวมอัตโนมัติจากระบบ</p>
        </div>
        <Button onClick={handlePrint} disabled={!data}><Printer className="w-4 h-4 mr-2" />พิมพ์รายงาน SAR</Button>
      </div>
      {isLoading || !data ? (
        <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["นักเรียน", `${data.total} คน`],
              ["ผลการเรียนเฉลี่ย", data.avgGrade.toFixed(2)],
              ["ร้อยละการมาเรียน", `${data.attendancePct.toFixed(2)}%`],
              ["กลุ่มเสี่ยง/มีปัญหา", `${data.scr.risk + data.scr.problem} คน`],
            ].map(([k, v]) => (
              <Card key={k}><CardHeader className="pb-2"><CardDescription>{k}</CardDescription><CardTitle className="text-2xl">{v}</CardTitle></CardHeader></Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">จำนวนนักเรียนแยกตามชั้น</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>ชั้น</TableHead><TableHead>ชาย</TableHead><TableHead>หญิง</TableHead><TableHead>รวม</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.byGrade.map(([g, r]) => (
                    <TableRow key={g}><TableCell>{g}</TableCell><TableCell>{r.m}</TableCell><TableCell>{r.f}</TableCell><TableCell>{r.m + r.f}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
