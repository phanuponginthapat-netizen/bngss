import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, BarChart3, Users, Award, TrendingUp } from "lucide-react";
import { getResultLevel, RESULT_LEVELS } from "@/lib/paIndicators";
import { BE_OFFSET } from "@/lib/dateBE";

export default function PAReportTab() {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: agreements = [] } = useQuery({
    queryKey: ["pa_agreements_report"],
    queryFn: async () => {
      const { data } = await supabase.from("pa_agreements")
        .select("*, personnel(prefix, first_name, last_name, employee_code, position, position_level, department)")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const filtered = yearFilter === "all"
    ? agreements
    : agreements.filter((a: any) => String((a.academic_year || 0) + BE_OFFSET) === yearFilter);

  const approved = filtered.filter((a: any) => a.status === "approved");
  const avgScore = approved.length > 0
    ? approved.reduce((s: number, a: any) => s + Number(a.total_score || 0), 0) / approved.length
    : 0;

  const teacherPAs = approved.filter((a: any) => a.position_type === "teacher");
  const directorPAs = approved.filter((a: any) => a.position_type !== "teacher");

  const levelDistribution = RESULT_LEVELS.map(l => ({
    ...l,
    count: approved.filter((a: any) => {
      const score = Number(a.total_score || 0);
      return score >= l.min && score <= l.max;
    }).length,
  }));

  const years = [...new Set(agreements.map((a: any) => String((a.academic_year || 0) + BE_OFFSET)))].sort().reverse();

  const handlePrint = () => {
    const el = reportRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>รายงาน PA ผู้อำนวยการ</title>
      <style>body{font-family:'IBM Plex Sans Thai',sans-serif;padding:40px;color:#1a1a1a}
      table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
      th{background:#f5f5f5;font-weight:600}h1{font-size:20px}h2{font-size:16px;margin-top:24px;border-bottom:2px solid #3b82f6;padding-bottom:4px}
      .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}
      @media print{body{padding:20px}}</style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            รายงานสรุป PA สำหรับผู้อำนวยการ
          </h2>
          <p className="text-sm text-muted-foreground">สรุปผลการประเมินข้อตกลงในการพัฒนางาน (PA) ตาม ว PA สพฐ.</p>
        </div>
        <div className="flex gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="ปีการศึกษา" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกปี</SelectItem>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />พิมพ์</Button>
        </div>
      </div>

      <div ref={reportRef}>
        {/* Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Users className="w-8 h-8 text-primary/30" />
            <div><p className="text-xs text-muted-foreground">ส่ง PA แล้ว</p><p className="text-2xl font-bold">{filtered.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Award className="w-8 h-8 text-emerald-200" />
            <div><p className="text-xs text-muted-foreground">อนุมัติแล้ว</p><p className="text-2xl font-bold text-emerald-600">{approved.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-200" />
            <div><p className="text-xs text-muted-foreground">คะแนนเฉลี่ย</p><p className="text-2xl font-bold">{avgScore > 0 ? avgScore.toFixed(2) : "-"}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Award className="w-8 h-8 text-amber-200" />
            <div><p className="text-xs text-muted-foreground">ระดับเฉลี่ย</p>
              <p className={`text-lg font-bold ${avgScore > 0 ? getResultLevel(avgScore).color : ""}`}>
                {avgScore > 0 ? getResultLevel(avgScore).label : "-"}
              </p>
            </div>
          </CardContent></Card>
        </div>

        {/* Level Distribution */}
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">การกระจายระดับผลการประเมิน</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {levelDistribution.map(l => (
                <div key={l.label} className="text-center p-2 rounded-lg bg-muted/50">
                  <p className={`text-lg font-bold ${l.color}`}>{l.count}</p>
                  <p className="text-xs text-muted-foreground">{l.label}</p>
                  <Progress value={approved.length > 0 ? (l.count / approved.length) * 100 : 0} className="h-1.5 mt-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Teacher PA Summary */}
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">สรุปผลประเมิน PA ครู ({teacherPAs.length} คน)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">ลำดับ</th>
                    <th className="text-left p-2 font-medium">ชื่อ-สกุล</th>
                    <th className="text-left p-2 font-medium">ตำแหน่ง/วิทยฐานะ</th>
                    <th className="text-center p-2 font-medium">คะแนน</th>
                    <th className="text-center p-2 font-medium">ระดับ</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherPAs.sort((a: any, b: any) => Number(b.total_score) - Number(a.total_score)).map((a: any, i: number) => {
                    const lvl = getResultLevel(Number(a.total_score));
                    return (
                      <tr key={a.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">{a.personnel ? `${a.personnel.prefix || ""}${a.personnel.first_name} ${a.personnel.last_name}` : "-"}</td>
                        <td className="p-2 text-muted-foreground">{a.personnel?.position || "-"} {a.personnel?.position_level || ""}</td>
                        <td className="p-2 text-center font-semibold">{Number(a.total_score).toFixed(2)}</td>
                        <td className={`p-2 text-center font-semibold ${lvl.color}`}>{lvl.label}</td>
                      </tr>
                    );
                  })}
                  {teacherPAs.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Director PA Summary */}
        {directorPAs.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">สรุปผลประเมิน PA ผู้บริหาร ({directorPAs.length} คน)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">ชื่อ-สกุล</th>
                      <th className="text-left p-2 font-medium">ตำแหน่ง</th>
                      <th className="text-center p-2 font-medium">คะแนน</th>
                      <th className="text-center p-2 font-medium">ระดับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directorPAs.map((a: any) => {
                      const lvl = getResultLevel(Number(a.total_score));
                      return (
                        <tr key={a.id} className="border-b">
                          <td className="p-2">{a.personnel ? `${a.personnel.prefix || ""}${a.personnel.first_name} ${a.personnel.last_name}` : "-"}</td>
                          <td className="p-2">{a.position_type === "director" ? "ผู้อำนวยการ" : "รองผู้อำนวยการ"}</td>
                          <td className="p-2 text-center font-semibold">{Number(a.total_score).toFixed(2)}</td>
                          <td className={`p-2 text-center font-semibold ${lvl.color}`}>{lvl.label}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
