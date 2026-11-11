import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayBangkok } from "@/lib/dateBE";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, RefreshCw, Users } from "lucide-react";

type Mode = "day" | "month" | "term";
interface Cell { date: string; total: number; present: number; late: number; leave: number; absent: number; unrecorded: number; evidence: boolean }
interface Period { academic_year_be: number; semester: number; start_date: string; end_date: string }
interface ClassSummary { name: string; rosterTotal: number; daily: Cell[] }
interface Report { today: string; rosterTotal: number; current: Period | null; periods: Period[]; daily: Cell[]; classes: ClassSummary[]; updatedAt: string }
const dateLabel = (date: string) => new Date(`${date}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

export default function PublicAttendanceSummary() {
  const [today, setToday] = useState(todayBangkok);
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [term, setTerm] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayBangkok()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [year, semester] = term.split("-").map(Number);
  const query = useQuery({
    queryKey: ["public-school-attendance", mode, date, month, term, today],
    enabled: mode !== "term" || Boolean(term),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("public-school-attendance", { body: { mode, date, month, year, semester } });
      if (error || data?.error) throw new Error(data?.error || "ไม่สามารถโหลดสถิติการมาโรงเรียนได้");
      return data as Report;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (!query.data) return;
    setPeriods(query.data.periods);
    if (!term && query.data.current) setTerm(`${query.data.current.academic_year_be}-${query.data.current.semester}`);
  }, [query.data, term]);
  const daily = query.data?.daily ?? [];
  const recorded = daily.filter(row => row.evidence);
  const selected = mode === "day" ? daily : recorded;
  const totals = selected.reduce((sum, row) => ({ total: sum.total + row.total, present: sum.present + row.present, late: sum.late + row.late, leave: sum.leave + row.leave, absent: sum.absent + row.absent, unrecorded: sum.unrecorded + row.unrecorded }), { total: 0, present: 0, late: 0, leave: 0, absent: 0, unrecorded: 0 });
  const rate = totals.total ? ((totals.present + totals.late) / totals.total * 100).toFixed(1) : null;
  const units = mode === "day" ? "คน" : "คน-วัน";
  const classRows = (query.data?.classes ?? []).map(group => {
    const cells = mode === "day" ? group.daily : group.daily.filter(row => row.evidence);
    const sum = cells.reduce((s,r)=>({total:s.total+r.total,present:s.present+r.present,late:s.late+r.late,leave:s.leave+r.leave,absent:s.absent+r.absent,unrecorded:s.unrecorded+r.unrecorded}),{total:0,present:0,late:0,leave:0,absent:0,unrecorded:0});
    return {...sum,name:group.name,rosterTotal:group.rosterTotal,evidence:cells.some(r=>r.evidence)};
  });
  return (
    <section aria-label="สถิติการมาโรงเรียน" className="bg-background border-y border-border py-10 sm:py-14">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-primary mb-2"><CalendarCheck className="h-5 w-5" /><span className="text-sm font-medium">การมาโรงเรียน</span></div><h2 className="text-2xl sm:text-3xl font-bold text-foreground">สถิติการมาโรงเรียนของนักเรียน</h2></div>
          <Button size="icon" variant="outline" aria-label="อัปเดตสถิติ" title="อัปเดตสถิติ" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /></Button>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Tabs value={mode} onValueChange={value => setMode(value as Mode)}><TabsList><TabsTrigger value="day">รายวัน</TabsTrigger><TabsTrigger value="month">รายเดือน</TabsTrigger><TabsTrigger value="term">รายเทอม</TabsTrigger></TabsList></Tabs>
          {mode === "day" && <Input aria-label="วันที่รายงาน" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className="w-44" />}
          {mode === "month" && <Input aria-label="เดือนรายงาน" type="month" value={month} max={today.slice(0, 7)} onChange={e => setMonth(e.target.value)} className="w-48" />}
          {mode === "term" && <Select value={term} onValueChange={setTerm}><SelectTrigger aria-label="ภาคเรียนรายงาน" className="w-56"><SelectValue placeholder="เลือกภาคเรียน" /></SelectTrigger><SelectContent>{periods.map(p => <SelectItem key={`${p.academic_year_be}-${p.semester}`} value={`${p.academic_year_be}-${p.semester}`}>เทอม {p.semester} / {p.academic_year_be}</SelectItem>)}</SelectContent></Select>}
        </div>
        {query.isLoading && <p role="status" className="py-8 text-muted-foreground">กำลังโหลดสถิติ…</p>}
        {query.isError && <div role="alert" className="flex flex-wrap items-center gap-3 text-destructive"><p>โหลดสถิติไม่สำเร็จ</p><Button variant="outline" onClick={() => query.refetch()}>ลองใหม่</Button></div>}
        {mode === "term" && !term && !query.isLoading && <p className="text-muted-foreground">ยังไม่มีปฏิทินภาคเรียนที่พร้อมใช้งาน</p>}
        {query.data && !query.isError && !query.isLoading && <>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-2"><Users className="h-4 w-4" />นักเรียนกำลังศึกษา {query.data.rosterTotal} คน</span><span>{mode === "day" ? dateLabel(date) : `วันที่มีบันทึก ${recorded.length} วัน`}</span><span>อัปเดต {new Date(query.data.updatedAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} น.</span></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[{ label: "มาโรงเรียน (รวมสาย)", value: totals.present + totals.late, tone: "text-primary" }, { label: "ตรงเวลา", value: totals.present, tone: "text-foreground" }, { label: "สาย", value: totals.late, tone: "text-foreground" }, { label: "ลา / ป่วย", value: totals.leave, tone: "text-foreground" }, { label: "ขาด", value: totals.absent, tone: "text-destructive" }, { label: "ยังไม่มีบันทึก", value: totals.unrecorded, tone: "text-muted-foreground" }].map(item => <div key={item.label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground min-h-8">{item.label}</p><p className={`text-3xl font-bold tabular-nums ${item.tone}`}>{item.value.toLocaleString("th-TH")}</p><p className="text-xs text-muted-foreground mt-1">{units}</p></div>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4"><p className="font-medium text-foreground">อัตราการมาโรงเรียน <span className="text-primary">{rate === null || !recorded.length ? "—" : `${rate}%`}</span></p><p className="text-xs text-muted-foreground">ฐานทะเบียนนักเรียนกำลังศึกษาปัจจุบัน</p></div>
          {!recorded.length && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลการมาโรงเรียนในช่วงที่เลือก</p>}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">สรุปการเข้าเรียนรายชั้น</h3>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table aria-label="สรุปการเข้าเรียนรายชั้น" className="w-full text-sm whitespace-nowrap">
                <thead className="bg-muted text-muted-foreground"><tr>{["ชั้น","นักเรียนทั้งหมด",`ฐาน (${units})`,`มา (รวมสาย)`,"สาย","ลา / ป่วย","ขาด","ยังไม่มีบันทึก","% เข้าเรียน"].map(h=><th key={h} className="px-3 py-3 text-right font-medium first:text-left">{h}</th>)}</tr></thead>
                <tbody>{classRows.map(row=><tr key={row.name} className="border-t border-border"><th scope="row" className="px-3 py-3 text-left font-medium">{row.name}</th>{[row.rosterTotal,row.total,row.present+row.late,row.late,row.leave,row.absent,row.unrecorded].map((v,i)=><td key={i} className="px-3 py-3 text-right tabular-nums">{v.toLocaleString("th-TH")}</td>)}<td className="px-3 py-3 text-right font-semibold tabular-nums text-primary">{row.evidence && row.total ? `${((row.present+row.late)/row.total*100).toFixed(1)}%` : "—"}</td></tr>)}</tbody>
                <tfoot className="bg-muted font-semibold"><tr className="border-t border-border"><th scope="row" className="px-3 py-3 text-left">รวมทั้งหมด</th>{[query.data.rosterTotal,totals.total,totals.present+totals.late,totals.late,totals.leave,totals.absent,totals.unrecorded].map((v,i)=><td key={i} className="px-3 py-3 text-right tabular-nums">{v.toLocaleString("th-TH")}</td>)}<td className="px-3 py-3 text-right text-primary">{rate === null || !recorded.length ? "—" : `${rate}%`}</td></tr></tfoot>
              </table>
            </div>
          </div>
          {mode !== "day" && <>
            <p className="text-xs text-muted-foreground">ยอดสะสมเป็นคน-วัน เฉพาะวันที่มีหลักฐานการมาโรงเรียน · วันที่ไม่มีหลักฐาน {daily.length - recorded.length} วัน ไม่นับเป็นขาด</p>
            {daily.length > 0 && <div className="overflow-x-auto max-h-80"><table className="w-full text-sm whitespace-nowrap"><thead className="bg-muted text-muted-foreground sticky top-0"><tr>{["วันที่", "มา (รวมสาย)", "สาย", "ลา / ป่วย", "ขาด", "ยังไม่มีบันทึก"].map(h => <th key={h} className="text-left px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{daily.map(row => <tr key={row.date} className="border-b border-border"><td className="px-3 py-3">{dateLabel(row.date)}</td>{(row.evidence ? [row.present + row.late, row.late, row.leave, row.absent, row.unrecorded] : ["—", "—", "—", "—", "ไม่มีหลักฐาน"]).map((value, i) => <td key={i} className="px-3 py-3 tabular-nums">{value}</td>)}</tr>)}</tbody></table></div>}
          </>}
        </>}
      </div>
    </section>
  );
}