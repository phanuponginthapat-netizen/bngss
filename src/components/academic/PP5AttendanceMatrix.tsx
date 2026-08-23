import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Wand2, Save, Zap, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BE_OFFSET, bkkDateISO, formatDateBE, parseDateBE, toISODate } from "@/lib/dateBE";
import { saveErrorMessage } from "@/lib/saveError";
import { fetchHolidays, isHolidaySync, type Holiday } from "@/lib/holiday";
import { todayBangkok } from "@/lib/dateBE";

interface Props {
  subjectId: string;
  classroomId: string;
  students: any[];
  hoursPerWeek: number;
  weeksPerSemester: number;
  periodDates: string[];
  semester: number;
  academicYear: number;
  canEdit: boolean;
}

const fmtDateBE = (iso: string) => formatDateBE(iso);

/** Small dd/mm/yyyy (พ.ศ.) date picker — replaces native input to force Thai display */
const BEDatePicker = ({
  value, onChange, disabled, className, placeholder = "dd/mm/พ.ศ.",
}: { value: string; onChange: (iso: string) => void; disabled?: boolean; className?: string; placeholder?: string }) => {
  const selected = value ? (parseDateBE(value) || undefined) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" disabled={disabled}
          className={cn(
            "h-6 px-1 text-[10px] border rounded flex items-center gap-1 bg-background hover:bg-accent disabled:opacity-50",
            className
          )}>
          <CalendarIcon className="w-2.5 h-2.5" />
          <span>{value ? fmtDateBE(value) : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && onChange(toISODate(d))}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

const PP5AttendanceMatrix = ({
  subjectId, classroomId, students = [],
  hoursPerWeek, weeksPerSemester, periodDates = [],
  semester, academicYear, canEdit,
}: Props) => {
  const qc = useQueryClient();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  useEffect(() => { fetchHolidays().then(setHolidays).catch(()=>{}); }, []);
  const isHoliday = (iso: string) => isHolidaySync(iso, holidays);

  const total = Math.max(1, (hoursPerWeek || 1) * (weeksPerSemester || 20));
  const [weeks, setWeeks] = useState<number>(weeksPerSemester || 20);
  const [startDate, setStartDate] = useState<string>("");
  const [dates, setDates] = useState<string[]>(() => {
    const base = [...(periodDates || [])];
    while (base.length < total) base.push("");
    return base.slice(0, total);
  });
  const effectiveTotal = Math.max(1, dates.filter(d => d && !isHoliday(d)).length);

  // Range quick-fill state
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const [rangeStatus, setRangeStatus] = useState<"present" | "absent" | "leave">("absent");
  const [rangeStudent, setRangeStudent] = useState<string>("__all__");

  useEffect(() => { setWeeks(weeksPerSemester || 20); }, [weeksPerSemester]);

  useEffect(() => {
    const base = [...(periodDates || [])];
    while (base.length < total) base.push("");
    setDates(base.slice(0, total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDates?.join(","), total]);

  const studentIds = students.map(s => s.id);
  const { data: absences = [] } = useQuery({
    queryKey: ["pp5_absences", subjectId, semester, academicYear, studentIds.length],
    enabled: !!subjectId && studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("attendance")
        .select("id, student_id, attendance_date, status")
        .eq("subject_id", subjectId)
        .eq("academic_year", academicYear)
        .eq("semester", semester)
        .in("student_id", studentIds)
        .in("status", ["absent", "leave"]);
      return data || [];
    },
  });

  const statusMap = useMemo(() => {
    const m = new Map<string, { id: string; status: string }>();
    absences.forEach((a: any) => m.set(`${a.student_id}|${a.attendance_date}`, { id: a.id, status: a.status }));
    return m;
  }, [absences]);

  const setStatus = async (studentId: string, dateIso: string, next: "present" | "absent" | "leave") => {
    if (isHoliday(dateIso)) { toast.error("วันหยุด ไม่ต้องบันทึกการมาเรียน"); return; }
    if (!canEdit) return;
    if (!dateIso) { toast.error("กรุณากำหนดวันที่ของคาบนี้ก่อน"); return; }
    const key = `${studentId}|${dateIso}`;
    const cur = statusMap.get(key);
    if (next === "present") {
      if (cur) {
        const { error } = await supabase.from("attendance").delete().eq("id", cur.id);
        if (error) { toast.error("ลบไม่สำเร็จ: " + error.message); return; }
      }
    } else if (cur) {
      if (cur.status !== next) {
        const { error } = await supabase.from("attendance").update({ status: next }).eq("id", cur.id);
        if (error) { toast.error("บันทึกไม่สำเร็จ: " + error.message); return; }
      }
    } else {
      const { error } = await supabase.from("attendance").upsert({
        student_id: studentId, subject_id: subjectId,
        attendance_date: dateIso, status: next,
        academic_year: academicYear, semester,
      } as any, { onConflict: "student_id,attendance_date,subject_id", ignoreDuplicates: false });
      if (error) { toast.error("บันทึกไม่สำเร็จ: " + error.message); return; }
    }
    qc.invalidateQueries({ queryKey: ["pp5_absences"] });
  };

  const cycleStatus = async (studentId: string, dateIso: string) => {
    if (isHoliday(dateIso)) return;
    const cur = statusMap.get(`${studentId}|${dateIso}`);
    const next = !cur ? "absent" : cur.status === "absent" ? "leave" : "present";
    await setStatus(studentId, dateIso, next as any);
  };

  const bulkFillColumn = async (dateIso: string, status: "present" | "absent" | "leave") => {
    if (isHoliday(dateIso)) { toast.error("วันหยุด ไม่ต้องบันทึก"); return; }
    if (!canEdit) return;
    if (!dateIso) { toast.error("กรุณากำหนดวันที่ของคาบนี้ก่อน"); return; }
    if (!confirm(`ยืนยันตั้งสถานะ "${status === "present" ? "มาเรียน" : status === "absent" ? "ขาด" : "ลา"}" ให้นักเรียนทุกคนของคาบนี้?`)) return;
    for (const s of students) {
       
      await setStatus(s.id, dateIso, status);
    }
    toast.success("บันทึกเรียบร้อย");
  };

  const bulkFillStudent = async (studentId: string, status: "present" | "absent" | "leave") => {
    if (!canEdit) return;
    const valid = dates.filter(Boolean);
    if (valid.length === 0) { toast.error("ยังไม่มีวันที่กำกับคาบ"); return; }
    if (!confirm(`ยืนยันตั้งสถานะ "${status === "present" ? "มาเรียน" : status === "absent" ? "ขาด" : "ลา"}" ทุกคาบให้นักเรียนคนนี้?`)) return;
    for (const d of valid) {
       
      await setStatus(studentId, d, status);
    }
    toast.success("บันทึกเรียบร้อย");
  };

  const applyRangeQuickFill = async () => {
    if (!canEdit) return;
    if (!rangeFrom || !rangeTo) { toast.error("กรุณาเลือกช่วงวัน (ตั้งแต่–ถึง)"); return; }
    const from = rangeFrom, to = rangeTo;
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const periods = dates.filter(d => d && d >= lo && d <= hi);
    if (periods.length === 0) { toast.error("ไม่มีคาบเรียนในช่วงวันที่เลือก"); return; }
    const targets = rangeStudent === "__all__" ? students : students.filter(s => s.id === rangeStudent);
    if (targets.length === 0) { toast.error("ไม่พบนักเรียนที่เลือก"); return; }
    const label = rangeStatus === "present" ? "มาเรียน" : rangeStatus === "absent" ? "ขาด" : "ลา";
    if (!confirm(`ยืนยันตั้งสถานะ "${label}" — ${periods.length} คาบ × ${targets.length} คน = ${periods.length * targets.length} รายการ?`)) return;
    let done = 0;
    for (const s of targets) {
      for (const d of periods) {
         
        await setStatus(s.id, d, rangeStatus);
        done++;
      }
    }
    toast.success(`บันทึกเรียบร้อย (${done} รายการ)`);
  };

  const updateDate = (idx: number, iso: string) => {
    const next = dates.map((d, i) => i === idx ? iso : d);
    setDates(next);
    void persistDates(next);
  };

  const persistDates = async (arr: string[]) => {
    if (!canEdit) return;
    const { error } = await supabase.from("subjects").update({
      pp5_period_dates: arr.filter(Boolean),
    } as any).eq("id", subjectId);
    if (error) toast.error("บันทึกวันที่ไม่สำเร็จ: " + error.message);
  };

  const autoFillDates = () => {
    if (!startDate) { toast.error("กรุณาเลือกวันเริ่มต้น"); return; }
    const start = parseDateBE(startDate);
    if (!start) return;
    const result: string[] = [];
    const cur = new Date(start);
    let added = 0;
    while (added < total) {
      const day = cur.getUTCDay();
      if (day !== 0 && day !== 6) {
        for (let h = 0; h < hoursPerWeek && added < total; h++) {
          result.push(toISODate(cur));
          added++;
        }
        cur.setUTCDate(cur.getUTCDate() + 7);
      } else {
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    setDates(result);
    void persistDates(result);
  };

  const saveConfig = async () => {
    if (!canEdit) return;
    const { error } = await supabase.from("subjects").update({
      weeks_per_semester: weeks,
      pp5_period_dates: dates.filter(Boolean),
    } as any).eq("id", subjectId);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("บันทึกการตั้งค่าเวลาเรียนแล้ว");
    qc.invalidateQueries({ queryKey: ["my_teacher_assignments"] });
    qc.invalidateQueries({ queryKey: ["subjects"] });
  };

  const [autoScanLoading, setAutoScanLoading] = useState(false);
  const autoFillFromScan = async () => {
    if (!canEdit) return;
    const validDates = dates.filter(Boolean);
    if (validDates.length === 0) { toast.error("ยังไม่มีวันที่กำกับคาบ"); return; }
    if (students.length === 0) { toast.error("ไม่มีนักเรียน"); return; }
    setAutoScanLoading(true);
    try {
      const from = validDates.reduce((a, b) => a < b ? a : b);
      const to = validDates.reduce((a, b) => a > b ? a : b);
      // Deduplicate to distinct dates (face_scan is per day, not per period)
      const distinctDates = Array.from(new Set(validDates)).sort().filter(d => !isHoliday(d));
      if (distinctDates.length === 0) { toast.info("ทุกคาบเป็นวันหยุด ไม่ต้องดึงสแกน"); setAutoScanLoading(false); return; }
      const fromH = distinctDates[0], toH = distinctDates[distinctDates.length-1];
      const { data: scans } = await supabase.from("face_scan_logs").select("student_id, scan_date").eq("scan_type", "entry").gte("scan_date", fromH).lte("scan_date", toH).in("student_id", studentIds);
      const { data: attends } = await supabase.from("attendance").select("student_id, attendance_date").gte("attendance_date", fromH).lte("attendance_date", toH).in("student_id", studentIds);
      const presentSet = new Set<string>();
      for (const s of (scans as any[]) || []) presentSet.add(`${s.student_id}|${s.scan_date}`);
      for (const a of (attends as any[]) || []) presentSet.add(`${a.student_id}|${a.attendance_date}`);
      // Also check manual attendance present = not in absences (already handled) - scan is extra evidence for present
      let filled = 0;
      for (const s of students) {
        for (const d of distinctDates) {
          const key = `${s.id}|${d}`;
          const hasScan = presentSet.has(key);
          const cur = statusMap.get(key);
          // If has scan and currently absent/leave or not present, set to present (delete absent/leave)
          if (hasScan && cur) {
            await supabase.from("attendance").delete().eq("id", cur.id);
            filled++;
          } else if (!hasScan && !cur) {
            // No scan and no record => keep as present (no row) - don't auto mark absent to avoid overwriting holidays
            // Do nothing; teacher can bulk mark absent if needed
          }
        }
      }
      qc.invalidateQueries({ queryKey: ["pp5_absences"] });
      toast.success(`ดึงจากการสแกนแล้ว ${filled} รายการ (สแกนเข้า = มาเรียน)`);
    } catch (e: any) {
      toast.error("ดึงสแกนไม่สำเร็จ: " + (e?.message || ""));
    } finally { setAutoScanLoading(false); }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">ชั่วโมง/สัปดาห์</Label>
            <Input value={hoursPerWeek} disabled className="w-20 h-8" />
          </div>
          <div>
            <Label className="text-xs">สัปดาห์/ภาคเรียน</Label>
            <Input type="number" min={1} max={40} value={weeks} disabled={!canEdit}
              onChange={e => setWeeks(Number(e.target.value) || 0)} className="w-20 h-8" />
          </div>
          <div>
            <Label className="text-xs">รวมคาบทั้งหมด</Label>
            <div className="h-8 px-3 flex items-center rounded-md bg-muted font-bold">{total}</div>
          </div>
          <div className="border-l pl-3">
            <Label className="text-xs">เติมวันที่อัตโนมัติ (เริ่มจาก)</Label>
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild disabled={!canEdit}>
                  <Button variant="outline" size="sm" className="h-8 w-40 justify-start font-normal">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                    {startDate ? fmtDateBE(startDate) : <span className="text-muted-foreground">dd/mm/พ.ศ.</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar mode="single"
                    selected={startDate ? (parseDateBE(startDate) || undefined) : undefined}
                    onSelect={(d) => d && setStartDate(toISODate(d))}
                    initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Button size="sm" variant="outline" onClick={autoFillDates} disabled={!canEdit}>
                <Wand2 className="w-3.5 h-3.5 mr-1" />เติม
              </Button>
            </div>
          </div>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="secondary" onClick={autoFillFromScan} disabled={!canEdit || autoScanLoading} title="ดึงบันทึกสแกนเข้าเรียน (face_scan_logs + attendance) มาใส่ช่องเวลาเรียนอัตโนมัติ">
              {autoScanLoading ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />} ดึงจากการสแกน
            </Button>
            <Button size="sm" onClick={saveConfig} disabled={!canEdit}>
              <Save className="w-3.5 h-3.5 mr-1" />บันทึกตั้งค่า
            </Button>
          </div>
          <p className="basis-full text-[11px] text-muted-foreground">
            คลิกเซลล์เพื่อสลับสถานะ: <span className="font-semibold text-blue-700 dark:text-blue-300">มา</span> = มาเรียน · <span className="font-semibold text-destructive">×</span> = ขาด · <span className="font-semibold text-amber-600">ล</span> = ลา · แสดงวันที่แบบ dd/mm/yyyy (พ.ศ.) · วันที่บันทึกอัตโนมัติเมื่อแก้ไข
          </p>
        </CardContent>
      </Card>

      {/* Range Quick-Fill */}
      <Card className="border-primary/30">
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-1 text-sm font-semibold text-primary mr-2">
            <Zap className="w-4 h-4" />เติมเร็วตามช่วงวัน
          </div>
          <div>
            <Label className="text-xs">ตั้งแต่</Label>
            <Popover>
              <PopoverTrigger asChild disabled={!canEdit}>
                <Button variant="outline" size="sm" className="h-8 w-36 justify-start font-normal">
                  <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                  {rangeFrom ? fmtDateBE(rangeFrom) : <span className="text-muted-foreground">dd/mm/พ.ศ.</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar mode="single"
                  selected={rangeFrom ? (parseDateBE(rangeFrom) || undefined) : undefined}
                  onSelect={(d) => d && setRangeFrom(toISODate(d))}
                  initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs">ถึง</Label>
            <Popover>
              <PopoverTrigger asChild disabled={!canEdit}>
                <Button variant="outline" size="sm" className="h-8 w-36 justify-start font-normal">
                  <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                  {rangeTo ? fmtDateBE(rangeTo) : <span className="text-muted-foreground">dd/mm/พ.ศ.</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar mode="single"
                  selected={rangeTo ? (parseDateBE(rangeTo) || undefined) : undefined}
                  onSelect={(d) => d && setRangeTo(toISODate(d))}
                  initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs">นักเรียน</Label>
            <Select value={rangeStudent} onValueChange={setRangeStudent} disabled={!canEdit}>
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="__all__">— ทั้งหมด ({students.length} คน) —</SelectItem>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.student_code} {s.prefix}{s.first_name} {s.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">สถานะ</Label>
            <Select value={rangeStatus} onValueChange={(v) => setRangeStatus(v as any)} disabled={!canEdit}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="present">มาเรียน</SelectItem>
                <SelectItem value="absent">ขาด</SelectItem>
                <SelectItem value="leave">ลา</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={applyRangeQuickFill} disabled={!canEdit}>
            <Zap className="w-3.5 h-3.5 mr-1" />ใส่สถานะช่วงนี้
          </Button>
          <p className="basis-full text-[11px] text-muted-foreground">
            ระบบจะเลือกเฉพาะ "คาบที่มีวันที่กำกับ" และอยู่ในช่วงวันที่เลือกเท่านั้น
          </p>
        </CardContent>
      </Card>

      <div className="overflow-x-auto scrollbar-thin">
        <Table className="border-2 border-border [&_td]:py-0.5 [&_td]:px-1 [&_td]:border [&_td]:border-border [&_th]:py-1 [&_th]:px-1 [&_th]:border [&_th]:border-border text-xs [&_tbody_tr:hover]:bg-primary/10 [&_tbody_tr:nth-child(even)]:bg-muted/10">
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="w-10 text-center align-middle">ลำดับ</TableHead>
              <TableHead rowSpan={2} className="w-24 text-center align-middle">รหัส</TableHead>
              <TableHead rowSpan={2} className="text-center align-middle min-w-[160px]">ชื่อ-สกุล</TableHead>
              <TableHead colSpan={total} className="text-center bg-muted/30">วันเดือนปีที่ขาด</TableHead>
              <TableHead rowSpan={2} className="text-center align-middle bg-amber-50 dark:bg-amber-950/30">ขาด</TableHead>
              <TableHead rowSpan={2} className="text-center align-middle bg-blue-50 dark:bg-blue-950/30">มาเรียน</TableHead>
              <TableHead rowSpan={2} className="text-center align-middle bg-emerald-50 dark:bg-emerald-950/30">%</TableHead>
            </TableRow>
            <TableRow>
              {dates.map((d, i) => {
                const holiday = d ? isHoliday(d) : false;
                return (
                <TableHead key={i} className={`text-center p-0.5 align-bottom ${holiday ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200" : "bg-muted/10"}`} style={{ minWidth: 84 }}>
                  <div className="text-[10px] text-muted-foreground">{i + 1} {holiday && <span className="text-amber-600">หยุด</span>}</div>
                  {holiday ? (
                    <div className="text-[9px] font-bold text-amber-700 dark:text-amber-300 py-1">วันหยุด</div>
                  ) : canEdit ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <BEDatePicker value={d || ""} onChange={(iso) => updateDate(i, iso)} />
                      <div className="flex gap-0.5">
                        <button type="button" title="ทุกคน: มา" onClick={() => bulkFillColumn(d, "present")}
                          className="text-[9px] px-1 rounded bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40">มา</button>
                        <button type="button" title="ทุกคน: ขาด" onClick={() => bulkFillColumn(d, "absent")}
                          className="text-[9px] px-1 rounded bg-destructive/20 hover:bg-destructive/30">×</button>
                        <button type="button" title="ทุกคน: ลา" onClick={() => bulkFillColumn(d, "leave")}
                          className="text-[9px] px-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40">ล</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] font-medium">{fmtDateBE(d) || "—"}</div>
                  )}
                </TableHead>
              );})}
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow><TableCell colSpan={6 + total} className="text-center py-8 text-muted-foreground">ไม่มีนักเรียน</TableCell></TableRow>
            ) : students.map((s, idx) => {
              let absent = 0, leave = 0;
              dates.forEach(d => {
                if (!d) return;
                if (isHoliday(d)) return;
                const st = statusMap.get(`${s.id}|${d}`)?.status;
                if (st === "absent") absent++;
                else if (st === "leave") leave++;
              });
              const attended = effectiveTotal - absent - leave;
              const pct = Math.round((attended / effectiveTotal) * 100);
              return (
                <TableRow key={s.id}>
                  <TableCell className="text-center">{idx + 1}</TableCell>
                  <TableCell className="text-center font-mono text-[10px]">{s.student_code}</TableCell>
                  <TableCell className="text-[11px]">
                    <div className="flex items-center justify-between gap-1">
                      <span>{s.prefix}{s.first_name} {s.last_name}</span>
                      {canEdit && (
                        <div className="flex gap-0.5 shrink-0">
                          <button type="button" title="ทุกคาบ: มา" onClick={() => bulkFillStudent(s.id, "present")}
                            className="text-[9px] px-1 rounded bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40">มา</button>
                          <button type="button" title="ทุกคาบ: ขาด" onClick={() => bulkFillStudent(s.id, "absent")}
                            className="text-[9px] px-1 rounded bg-destructive/20 hover:bg-destructive/30">×</button>
                          <button type="button" title="ทุกคาบ: ลา" onClick={() => bulkFillStudent(s.id, "leave")}
                            className="text-[9px] px-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40">ล</button>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {dates.map((d, i) => {
                    const holiday = d ? isHoliday(d) : false;
                    if (holiday) {
                      return <TableCell key={i} className="text-center bg-amber-50 dark:bg-amber-950/30 text-amber-600 font-bold text-[10px]">หยุด</TableCell>;
                    }
                    const st = d ? statusMap.get(`${s.id}|${d}`)?.status : undefined;
                    const mark = st === "absent" ? "×" : st === "leave" ? "ล" : d ? "มา" : "";
                    const cls = st === "absent"
                      ? "bg-destructive/20 text-destructive font-bold"
                      : st === "leave"
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold"
                      : "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-primary/10";
                    return (
                      <TableCell key={i}
                        onClick={() => cycleStatus(s.id, d)}
                        className={`text-center cursor-pointer select-none ${cls} ${!d ? "opacity-40" : ""}`}
                        title={d ? "คลิกเพื่อสลับ: มา → ขาด → ลา → มา" : "ยังไม่ระบุวันที่"}>
                        {mark}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-semibold bg-amber-50 dark:bg-amber-950/20">{absent}{leave ? ` (+${leave}ล)` : ""}</TableCell>
                  <TableCell className="text-center font-semibold bg-blue-50 dark:bg-blue-950/20">{attended}</TableCell>
                  <TableCell className={`text-center font-bold ${pct >= 80 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"} bg-emerald-50 dark:bg-emerald-950/20`}>{pct}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PP5AttendanceMatrix;
