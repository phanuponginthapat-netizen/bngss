import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BarChart3, Download, Clock, Users, CalendarRange, Trophy, Trash2 } from "lucide-react";
import { todayBangkok, bkkDateISO } from "@/lib/dateBE";

const HOURS_PER_PERIOD = 1; // 1 คาบ = 1 ชั่วโมงสอนแทน

function ymToRange(ym: string) {
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const fmt = (d: Date) => bkkDateISO(d);
  return { start: fmt(start), end: fmt(end) };
}

function thisMonthYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SubstituteReport() {
  const { lang } = useLanguage();
  const { isAdmin, isDirector } = useUserRole();
  const canDelete = isAdmin || isDirector;
  const qc = useQueryClient();
  const [month, setMonth] = useState(thisMonthYm());
  const { start, end } = useMemo(() => ymToRange(month), [month]);

  const { data: rows = [] } = useQuery({
    queryKey: ["substitute_teaching_report", start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from("substitute_teaching")
        .select("*, subjects(name_th, name_en, code), classrooms(name, grade_level)")
        .gte("teaching_date", start)
        .lte("teaching_date", end)
        .order("teaching_date", { ascending: false });
      return data || [];
    },
  });

  const byTeacher = useMemo(() => {
    const map = new Map<string, { name: string; periods: number; days: Set<string>; withProof: number }>();
    rows.forEach((r: any) => {
      const key = r.substitute_teacher || "-";
      if (!map.has(key)) map.set(key, { name: key, periods: 0, days: new Set(), withProof: 0 });
      const x = map.get(key)!;
      x.periods += 1;
      x.days.add(r.teaching_date);
      if (r.proof_photo_url) x.withProof += 1;
    });
    return Array.from(map.values())
      .map((x) => ({
        name: x.name,
        periods: x.periods,
        hours: x.periods * HOURS_PER_PERIOD,
        days: x.days.size,
        withProof: x.withProof,
        proofPct: x.periods ? Math.round((x.withProof / x.periods) * 100) : 0,
      }))
      .sort((a, b) => b.periods - a.periods);
  }, [rows]);

  const totalPeriods = byTeacher.reduce((a, b) => a + b.periods, 0);
  const totalHours = totalPeriods * HOURS_PER_PERIOD;
  const uniqueTeachers = byTeacher.length;
  const uniqueDates = new Set(rows.map((r: any) => r.teaching_date)).size;

  const exportCsv = () => {
    const header = ["ชื่อผู้สอนแทน", "จำนวนคาบ", "ชั่วโมงสอนแทน", "จำนวนวัน", "มีหลักฐาน", "%หลักฐาน"];
    const lines = [header.join(",")].concat(
      byTeacher.map((t) => [t.name, t.periods, t.hours, t.days, t.withProof, `${t.proofPct}%`].join(","))
    );
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `substitute-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("substitute_teaching").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lang === "th" ? "ลบประวัติแล้ว" : "Record deleted");
    qc.invalidateQueries({ queryKey: ["substitute_teaching_report"] });
    qc.invalidateQueries({ queryKey: ["substitute_teaching"] });
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {lang === "th" ? "รายงานชั่วโมงสอนแทน (ผอ./ผู้ดูแล)" : "Substitute hours report (Director/Admin)"}
          </CardTitle>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <Label className="text-[11px] text-muted-foreground">{lang === "th" ? "เดือน" : "Month"}</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-[160px]" />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} className="h-9">
              <Download className="w-4 h-4 mr-1.5" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={<Clock className="w-4 h-4" />} label={lang === "th" ? "ชั่วโมงสอนแทนรวม" : "Total hours"} value={totalHours} accent="text-primary" />
          <Kpi icon={<CalendarRange className="w-4 h-4" />} label={lang === "th" ? "จำนวนคาบ" : "Periods"} value={totalPeriods} />
          <Kpi icon={<Users className="w-4 h-4" />} label={lang === "th" ? "ครูที่สอนแทน" : "Teachers"} value={uniqueTeachers} />
          <Kpi icon={<CalendarRange className="w-4 h-4" />} label={lang === "th" ? "วันที่มีสอนแทน" : "Days"} value={uniqueDates} />
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{lang === "th" ? "ครูผู้สอนแทน" : "Substitute teacher"}</TableHead>
                <TableHead className="text-right">{lang === "th" ? "คาบ" : "Periods"}</TableHead>
                <TableHead className="text-right">{lang === "th" ? "ชั่วโมง" : "Hours"}</TableHead>
                <TableHead className="text-right">{lang === "th" ? "วัน" : "Days"}</TableHead>
                <TableHead className="text-right">{lang === "th" ? "หลักฐาน" : "Proof"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTeacher.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    {lang === "th" ? "ยังไม่มีข้อมูลสอนแทนในเดือนนี้" : "No substitute records this month"}
                  </TableCell>
                </TableRow>
              ) : (
                byTeacher.map((t, idx) => (
                  <TableRow key={t.name}>
                    <TableCell className="text-muted-foreground">
                      {idx === 0 ? <Trophy className="w-4 h-4 text-amber-500" /> : idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.periods}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-primary">{t.hours}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.days}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="tabular-nums">
                        {t.withProof}/{t.periods} · {t.proofPct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <details className="rounded-lg border bg-muted/20">
          <summary className="cursor-pointer p-3 text-sm font-medium">
            {lang === "th" ? `ประวัติทั้งหมดในเดือนนี้ (${rows.length} รายการ)` : `All records this month (${rows.length})`}
          </summary>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{lang === "th" ? "วันที่" : "Date"}</TableHead>
                  <TableHead>{lang === "th" ? "คาบ" : "Period"}</TableHead>
                  <TableHead>{lang === "th" ? "ครูที่ลา" : "Absent teacher"}</TableHead>
                  <TableHead>{lang === "th" ? "ผู้สอนแทน" : "Substitute"}</TableHead>
                  <TableHead>{lang === "th" ? "วิชา" : "Subject"}</TableHead>
                  <TableHead>{lang === "th" ? "ห้อง" : "Class"}</TableHead>
                  <TableHead>{lang === "th" ? "หลักฐาน" : "Proof"}</TableHead>
                  {canDelete && <TableHead className="w-12 text-right">{lang === "th" ? "ลบ" : ""}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.teaching_date}</TableCell>
                    <TableCell>{r.period}</TableCell>
                    <TableCell>{r.original_teacher}</TableCell>
                    <TableCell className="font-medium">{r.substitute_teacher}</TableCell>
                    <TableCell>{r.subjects?.name_th || "-"}</TableCell>
                    <TableCell>{r.classrooms ? `${r.classrooms.grade_level} ${r.classrooms.name}` : "-"}</TableCell>
                    <TableCell>
                      {r.proof_photo_url ? (
                        <Badge className="bg-green-100 text-green-800">{lang === "th" ? "มี" : "Yes"}</Badge>
                      ) : (
                        <Badge variant="outline">{lang === "th" ? "ไม่มี" : "No"}</Badge>
                      )}
                    </TableCell>
                    {canDelete && (
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" title={lang === "th" ? "ลบประวัติ" : "Delete"}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{lang === "th" ? "ลบประวัติการสอนแทน?" : "Delete substitute record?"}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {lang === "th"
                                  ? `${r.teaching_date} · คาบ ${r.period} · ${r.substitute_teacher} — การกระทำนี้ย้อนกลับไม่ได้`
                                  : `${r.teaching_date} · period ${r.period} · ${r.substitute_teacher} — this cannot be undone.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{lang === "th" ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(r.id)} className="bg-destructive hover:bg-destructive/90">
                                {lang === "th" ? "ลบ" : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent || ""}`}>{value}</div>
    </div>
  );
}
