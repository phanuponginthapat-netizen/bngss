import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { swal } from "@/lib/swal";
import { validateTermDates, type TermDates } from "@/lib/academicPeriodValidation";
import { clearCurrentPeriodCache } from "@/lib/ppImportChecks";

export default function AcademicPeriodDates({ currentYear }: { currentYear: number }) {
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [year, setYear] = useState(currentYear);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [terms, setTerms] = useState<TermDates[]>([]);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["academic-period-date-editor", year],
    enabled: Number.isInteger(year) && year >= 2400 && year <= 3000,
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_periods")
        .select("semester, start_date, end_date").eq("academic_year_be", year).order("semester");
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!data || dirty) return;
    setTerms([1, 2].map(semester => ({ semester, start_date: data.find(t => t.semester === semester)?.start_date ?? "", end_date: data.find(t => t.semester === semester)?.end_date ?? "" })));
  }, [data, dirty]);
  const change = (semester: number, field: "start_date" | "end_date", value: string) => {
    setDirty(true); setTerms(old => old.map(t => t.semester === semester ? { ...t, [field]: value } : t));
  };
  const save = async () => {
    if (!isAdmin) return;
    const problem = validateTermDates(terms);
    if (problem) { swal.error(problem); return; }
    if (!(await swal.confirm({ title: `บันทึกวันเปิด–ปิด ปีการศึกษา ${year}?`, text: "ภาคเรียนปัจจุบันจะอ้างอิงวันที่ใหม่ โดยไม่ย้ายคะแนนหรือการมาเรียนที่บันทึกไว้แล้ว" }))) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("save_academic_period_dates" as any, { _year_be: year, _terms: terms });
      if (error) throw error;
      clearCurrentPeriodCache(); setDirty(false);
      await Promise.all([qc.invalidateQueries({ queryKey: ["academic-periods"] }), qc.invalidateQueries({ queryKey: ["academic-period-date-editor"] }), qc.invalidateQueries({ queryKey: ["academic-calendar-term-dates"] }), qc.invalidateQueries({ queryKey: ["semester-config"] }), qc.invalidateQueries({ queryKey: ["academic_events"] }), qc.invalidateQueries({ queryKey: ["dashboard_stats_v2"] })]);
      swal.success("บันทึกวันเปิด–ปิดภาคเรียนแล้ว");
    } catch { swal.error("บันทึกไม่สำเร็จ", "ตรวจสิทธิ์ผู้ดูแลและการติดตั้งคำสั่งปรับปรุงบนฐานข้อมูลโรงเรียน แล้วลองอีกครั้ง"); }
    finally { setSaving(false); }
  };
  return <section className="space-y-4 border-b pb-6">
    <h2 className="text-lg font-semibold">วันเปิด–ปิดภาคเรียน</h2>
    <div className="max-w-48 space-y-2"><Label htmlFor="term-year-be">ปีการศึกษา (พ.ศ.)</Label>
      <Input id="term-year-be" type="number" min={2400} max={3000} value={year} disabled={saving} onChange={e => { setDirty(false); setTerms([]); setYear(Number(e.target.value)); }} />
    </div>
    {isLoading ? <Skeleton className="h-28" /> : error ? <p role="alert" className="text-destructive">โหลดวันเปิด–ปิดไม่สำเร็จ <Button variant="outline" onClick={() => refetch()}>ลองอีกครั้ง</Button></p> : <div className="grid gap-5 md:grid-cols-2">
      {terms.map(t => <div key={t.semester} className="space-y-3">
        <h3 className="font-medium">ภาคเรียนที่ {t.semester}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>วันเปิดภาคเรียน</Label><BEDatePicker value={t.start_date} onChange={v => change(t.semester, "start_date", v)} disabled={!isAdmin || saving} /></div>
          <div className="space-y-1.5"><Label>วันปิดภาคเรียน</Label><BEDatePicker value={t.end_date} onChange={v => change(t.semester, "end_date", v)} disabled={!isAdmin || saving} /></div>
        </div>
      </div>)}
    </div>}
    {isAdmin && <Button onClick={save} disabled={saving || isLoading || !!error || !dirty}><Save className="mr-2 h-4 w-4" />{saving ? "กำลังบันทึก..." : "บันทึกวันเปิด–ปิด"}</Button>}
  </section>;
}