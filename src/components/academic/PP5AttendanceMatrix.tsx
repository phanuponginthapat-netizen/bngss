import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Wand2, Save } from "lucide-react";
import { toast } from "sonner";
import { BE_OFFSET, bkkDateISO } from "@/lib/dateBE";

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

const fmtDateBE = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const be = d.getFullYear() + BE_OFFSET;
  return `${dd}/${mm}/${be}`;
};


const PP5AttendanceMatrix = ({
  subjectId, classroomId, students,
  hoursPerWeek, weeksPerSemester, periodDates,
  semester, academicYear, canEdit,
}: Props) => {
  const qc = useQueryClient();
  const total = Math.max(1, (hoursPerWeek || 1) * (weeksPerSemester || 20));
  const [weeks, setWeeks] = useState<number>(weeksPerSemester || 20);
  const [startDate, setStartDate] = useState<string>("");
  const [dates, setDates] = useState<string[]>(() => {
    const base = [...(periodDates || [])];
    while (base.length < total) base.push("");
    return base.slice(0, total);
  });

  useEffect(() => {
    setWeeks(weeksPerSemester || 20);
  }, [weeksPerSemester]);

  useEffect(() => {
    const base = [...(periodDates || [])];
    while (base.length < total) base.push("");
    setDates(base.slice(0, total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDates?.join(","), total]);

  // Fetch absent records for these students/subject/year/semester
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
      } as any, { onConflict: "student_id,attendance_date,subject_id" });
      if (error) { toast.error("บันทึกไม่สำเร็จ: " + error.message); return; }
    }
    qc.invalidateQueries({ queryKey: ["pp5_absences"] });
  };

  const cycleStatus = async (studentId: string, dateIso: string) => {
    const cur = statusMap.get(`${studentId}|${dateIso}`);
    const next = !cur ? "absent" : cur.status === "absent" ? "leave" : "present";
    await setStatus(studentId, dateIso, next as any);
  };

  const bulkFillColumn = async (dateIso: string, status: "present" | "absent" | "leave") => {
    if (!canEdit) return;
    if (!dateIso) { toast.error("กรุณากำหนดวันที่ของคาบนี้ก่อน"); return; }
    if (!confirm(`ยืนยันตั้งสถานะ "${status === "present" ? "มาเรียน" : status === "absent" ? "ขาด" : "ลา"}" ให้นักเรียนทุกคนของคาบนี้?`)) return;
    for (const s of students) {
      // eslint-disable-next-line no-await-in-loop
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
      // eslint-disable-next-line no-await-in-loop
      await setStatus(studentId, d, status);
    }
    toast.success("บันทึกเรียบร้อย");
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
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return;
    const result: string[] = [];
    let cur = new Date(start);
    let added = 0;
    while (added < total) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) { // skip weekends
        for (let h = 0; h < hoursPerWeek && added < total; h++) {
          result.push(bkkDateISO(cur));
          added++;
        }
        // move +7 days for next week if filled hoursPerWeek for this week
        cur.setDate(cur.getDate() + 7);
      } else {
        cur.setDate(cur.getDate() + 1);
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
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกการตั้งค่าเวลาเรียนแล้ว");
    qc.invalidateQueries({ queryKey: ["my_teacher_assignments"] });
    qc.invalidateQueries({ queryKey: ["subjects"] });
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
              <Input type="date" value={startDate} disabled={!canEdit}
                onChange={e => setStartDate(e.target.value)} className="w-40 h-8" />
              <Button size="sm" variant="outline" onClick={autoFillDates} disabled={!canEdit}>
                <Wand2 className="w-3.5 h-3.5 mr-1" />เติม
              </Button>
            </div>
          </div>
          <div className="ml-auto">
            <Button size="sm" onClick={saveConfig} disabled={!canEdit}>
              <Save className="w-3.5 h-3.5 mr-1" />บันทึกตั้งค่า
            </Button>
          </div>
          <p className="basis-full text-[11px] text-muted-foreground">
            คลิกเซลล์เพื่อสลับสถานะ: เว้นว่าง = <span className="font-semibold">มาเรียน</span> · <span className="font-semibold text-destructive">×</span> = ขาด · <span className="font-semibold text-amber-600">ล</span> = ลา · แสดงวันที่แบบ dd/mm/yyyy (พ.ศ.) · วันที่บันทึกอัตโนมัติเมื่อแก้ไข
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
              {dates.map((d, i) => (
                <TableHead key={i} className="text-center p-0.5 bg-muted/10 align-bottom" style={{ minWidth: 56 }}>
                  <div className="text-[10px] text-muted-foreground">{i + 1}</div>
                  {canEdit ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Input type="date" value={d || ""}
                        onChange={e => updateDate(i, e.target.value)}
                        className="h-6 px-0.5 text-[9px] border rounded w-[76px]" />
                      <div className="text-[9px] font-medium text-primary">{fmtDateBE(d) || "—"}</div>
                    </div>
                  ) : (
                    <div className="text-[10px] font-medium">{fmtDateBE(d) || "—"}</div>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow><TableCell colSpan={6 + total} className="text-center py-8 text-muted-foreground">ไม่มีนักเรียน</TableCell></TableRow>
            ) : students.map((s, idx) => {
              let absent = 0, leave = 0;
              dates.forEach(d => {
                if (!d) return;
                const st = statusMap.get(`${s.id}|${d}`)?.status;
                if (st === "absent") absent++;
                else if (st === "leave") leave++;
              });
              const attended = total - absent - leave;
              const pct = Math.round((attended / total) * 100);
              return (
                <TableRow key={s.id}>
                  <TableCell className="text-center">{idx + 1}</TableCell>
                  <TableCell className="text-center font-mono text-[10px]">{s.student_code}</TableCell>
                  <TableCell className="text-[11px]">{s.prefix}{s.first_name} {s.last_name}</TableCell>
                  {dates.map((d, i) => {
                    const st = d ? statusMap.get(`${s.id}|${d}`)?.status : undefined;
                    const mark = st === "absent" ? "×" : st === "leave" ? "ล" : "";
                    const cls = st === "absent"
                      ? "bg-destructive/20 text-destructive font-bold"
                      : st === "leave"
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold"
                      : "hover:bg-primary/10";
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
