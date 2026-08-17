import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Copy, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { BE_OFFSET } from "@/lib/dateBE";
import { swal } from "@/lib/swal";
import { saveErrorMessage } from "@/lib/saveError";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subjects: any[];
}

/**
 * คัดลอกรายวิชาจากภาคเรียนต้นทาง → ภาคเรียนปลายทาง
 * ข้ามวิชาที่มีรหัสเดิมอยู่แล้วในปลายทาง (ไม่ทับข้อมูล)
 */
export const CopySubjectsDialog = ({ open, onOpenChange, subjects }: Props) => {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  // build available (year, semester) pairs from current data
  const buckets = useMemo(() => {
    const set = new Map<string, { year: number; sem: number; count: number }>();
    for (const s of subjects) {
      if (s.academic_year == null || s.semester == null) continue;
      const key = `${s.academic_year}|${s.semester}`;
      const cur = set.get(key);
      if (cur) cur.count++;
      else set.set(key, { year: s.academic_year, sem: s.semester, count: 1 });
    }
    return [...set.values()].sort((a, b) => (b.year - a.year) || (a.sem - b.sem));
  }, [subjects]);

  const [srcKey, setSrcKey] = useState<string>("");
  const [tgtYearBE, setTgtYearBE] = useState<string>(
    String(new Date().getFullYear() + BE_OFFSET),
  );
  const [tgtSem, setTgtSem] = useState<string>("2");

  const src = useMemo(() => {
    if (!srcKey) return null;
    const [y, s] = srcKey.split("|").map(Number);
    return { year: y, sem: s };
  }, [srcKey]);

  const srcRows = useMemo(() => {
    if (!src) return [];
    return subjects.filter(
      (s) => s.academic_year === src.year && s.semester === src.sem,
    );
  }, [subjects, src]);

  const tgtYear = parseInt(tgtYearBE) - BE_OFFSET;
  const tgtSemNum = parseInt(tgtSem);

  const existingAtTarget = useMemo(() => {
    return new Set(
      subjects
        .filter((s) => s.academic_year === tgtYear && s.semester === tgtSemNum)
        .map((s) => (s.code || "").trim()),
    );
  }, [subjects, tgtYear, tgtSemNum]);

  const toCopy = useMemo(
    () => srcRows.filter((s) => !existingAtTarget.has((s.code || "").trim())),
    [srcRows, existingAtTarget],
  );
  const skipCount = srcRows.length - toCopy.length;

  const handleCopy = async () => {
    if (!src) {
      toast.error("กรุณาเลือกภาคเรียนต้นทาง");
      return;
    }
    if (src.year === tgtYear && src.sem === tgtSemNum) {
      toast.error("ต้นทางและปลายทางต้องต่างกัน");
      return;
    }
    if (toCopy.length === 0) {
      toast.info("ไม่มีวิชาที่ต้องคัดลอก (ปลายทางมีครบแล้ว)");
      return;
    }
    if (
      !(await swal.confirm({
        title: `คัดลอก ${toCopy.length} วิชา ไปที่ ${tgtYearBE}/${tgtSem}?`,
        text: skipCount > 0 ? `ข้าม ${skipCount} วิชาที่มีอยู่แล้ว` : undefined,
      }))
    )
      return;

    setLoading(true);
    try {
      const rows = toCopy.map((s) => ({
        code: s.code,
        name_th: s.name_th,
        name_en: s.name_en,
        credits: s.credits,
        hours_per_week: s.hours_per_week,
        grade_level: s.grade_level,
        subject_type: s.subject_type,
        weight_assignment: s.weight_assignment,
        weight_midterm: s.weight_midterm,
        weight_final: s.weight_final,
        weight_attendance: s.weight_attendance,
        weeks_per_semester: s.weeks_per_semester,
        academic_year: tgtYear,
        semester: tgtSemNum,
      }));

      // upsert by (code, semester) — ปลอดภัยและตรงกับ unique key ของ subjects
      const { error } = await supabase
        .from("subjects")
        .upsert(rows, { onConflict: "code,semester", ignoreDuplicates: true });
      if (error) {
        toast.error(saveErrorMessage(error));
      } else {
        toast.success(`คัดลอกสำเร็จ ${toCopy.length} วิชา`);
        qc.invalidateQueries({ queryKey: ["subjects"] });
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e.message || "เกิดข้อผิดพลาด");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>คัดลอกรายวิชาไปภาคเรียนอื่น</DialogTitle>
          <DialogDescription>
            เลือกภาคเรียนต้นทาง แล้วระบุปลายทาง ระบบจะคัดลอกเฉพาะวิชาที่ยังไม่มีในปลายทาง
            (ตรวจจากรหัสวิชา + ภาคเรียน)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>ต้นทาง (ปี/ภาค)</Label>
            <Select value={srcKey} onValueChange={setSrcKey}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกภาคเรียนที่มีวิชา..." />
              </SelectTrigger>
              <SelectContent>
                {buckets.map((b) => (
                  <SelectItem key={`${b.year}|${b.sem}`} value={`${b.year}|${b.sem}`}>
                    {b.year + BE_OFFSET}/{b.sem === 0 ? "ทั้งปี" : b.sem} — {b.count} วิชา
                  </SelectItem>
                ))}
                {buckets.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    ยังไม่มีวิชาในระบบ
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ปลายทาง — ปีการศึกษา (พ.ศ.)</Label>
              <Select value={tgtYearBE} onValueChange={setTgtYearBE}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, -1, 2].map((off) => {
                    const y = new Date().getFullYear() + BE_OFFSET + off;
                    return (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ปลายทาง — ภาคเรียน</Label>
              <Select value={tgtSem} onValueChange={setTgtSem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
                  <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
                  <SelectItem value="0">ทั้งปี</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {src && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                จะคัดลอก <b>{toCopy.length}</b> วิชา
                {skipCount > 0 && (
                  <>
                    {" "}(ข้าม <b>{skipCount}</b> ที่ปลายทางมีอยู่แล้ว)
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              ยกเลิก
            </Button>
            <Button onClick={handleCopy} disabled={loading || !src || toCopy.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังคัดลอก...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" /> คัดลอก
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
