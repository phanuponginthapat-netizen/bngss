import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GraduationCap, ArrowUpCircle, Hourglass, AlertTriangle, UserMinus, CheckCircle2, Undo2, History } from "lucide-react";
import { GRADE_NEXT } from "@/lib/gradeOrder";
import { sortGrades } from "@/lib/gradeOrder";

// ชั้นรอยต่อ (ปลายช่วงชั้น → ต้นช่วงชั้นถัดไป) — รับนักเรียนใหม่ / มีคนออก
const TRANSITION_FROM: Record<string, string> = {
  "อ.3": "ป.1",
  "ป.6": "ม.1",
  "ม.3": "ม.4",
};
// ชั้นจบการศึกษา → ย้ายเป็นศิษย์เก่า
const FINAL_GRADES = ["ม.6"];

const YearEndPromotionPage = () => {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);

  // อ่านปีการศึกษาปัจจุบันจาก academic_periods (ปีที่กำลังจะปิด)
  const { data: currentPeriod } = useQuery({
    queryKey: ["year-end-current-period"],
    queryFn: async () => {
      const { data } = await supabase
        .from("academic_periods")
        .select("*")
        .eq("is_current", true)
        .order("semester", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["year-end-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, status, classroom_id, transition_pending_to, classrooms!students_classroom_id_fkey(name, grade_level)")
        .or("status.eq.active,transition_pending_to.not.is.null");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ["year-end-classrooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classrooms")
        .select("id, name, grade_level")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // จัดกลุ่ม
  const { continuousCount, transitionByGrade, graduatingCount, continuousByGrade } = useMemo(() => {
    const active = students.filter((s: any) => s.status === "active" && !s.transition_pending_to);
    const cont: Record<string, number> = {};
    const trans: Record<string, number> = {};
    let grad = 0;
    active.forEach((s: any) => {
      const g = s.classrooms?.grade_level;
      if (!g) return;
      if (FINAL_GRADES.includes(g)) { grad++; return; }
      if (TRANSITION_FROM[g]) { trans[g] = (trans[g] || 0) + 1; return; }
      if (GRADE_NEXT[g]) { cont[g] = (cont[g] || 0) + 1; }
    });
    const continuousCount = Object.values(cont).reduce((a, b) => a + b, 0);
    return { continuousCount, transitionByGrade: trans, graduatingCount: grad, continuousByGrade: cont };
  }, [students]);

  const pending = useMemo(
    () => students.filter((s: any) => !!s.transition_pending_to),
    [students],
  );
  const pendingByTarget = useMemo(() => {
    const m: Record<string, any[]> = {};
    pending.forEach((s: any) => {
      const t = s.transition_pending_to;
      (m[t] = m[t] || []).push(s);
    });
    return m;
  }, [pending]);

  const handleRunYearEnd = async () => {
    if (!currentPeriod) {
      toast.error("ไม่พบปีการศึกษาปัจจุบัน — กรุณาตั้งค่าที่ ตั้งค่าปีการศึกษา");
      return;
    }
    setRunning(true);
    const tid = toast.loading("กำลังประมวลผลสิ้นปีการศึกษา...");
    try {
      const now = new Date();
      // ใช้ปี BE จาก academic_periods → แปลงเป็น CE สำหรับ snapshot (สอดคล้องกับ attendance/student_scores)
      const closingYearBE = (currentPeriod as any).academic_year_be as number;
      const closingAcademicYear = closingYearBE - 543;
      const year = closingAcademicYear;
      const active = students.filter((s: any) => s.status === "active" && !s.transition_pending_to);

      // 0) Snapshot ทุกคนเข้า student_enrollment_history (idempotent ด้วย unique)
      const snapshotRows = active.map((s: any) => ({
        student_id: s.id,
        academic_year: closingAcademicYear,
        classroom_id: s.classroom_id,
        classroom_name: s.classrooms?.name || null,
        grade_level: s.classrooms?.grade_level || null,
        status: FINAL_GRADES.includes(s.classrooms?.grade_level)
          ? "graduated"
          : TRANSITION_FROM[s.classrooms?.grade_level]
            ? "pending_transition"
            : "promoted",
        end_date: now.toISOString().slice(0, 10),
      }));
      if (snapshotRows.length > 0) {
        await supabase
          .from("student_enrollment_history")
          .upsert(snapshotRows, { onConflict: "student_id,academic_year" });
      }

      // เก็บ snapshot ของ classroom_id/status เดิมไว้สำหรับ rollback
      const beforeSnapshot = active.map((s: any) => ({
        id: s.id,
        classroom_id: s.classroom_id,
        status: s.status,
        transition_pending_to: null,
      }));

      // 1) ชั้นต่อเนื่อง — เลื่อนทันที
      const continuousUpdates: { id: string; classroom_id: string }[] = [];
      const byClassroom: Record<string, any[]> = {};
      active.forEach((s: any) => {
        const g = s.classrooms?.grade_level;
        if (!g || FINAL_GRADES.includes(g) || TRANSITION_FROM[g] || !GRADE_NEXT[g]) return;
        (byClassroom[s.classroom_id] = byClassroom[s.classroom_id] || []).push(s);
      });
      let promoted = 0;
      for (const cid of Object.keys(byClassroom)) {
        const list = byClassroom[cid];
        const currentGrade = list[0].classrooms?.grade_level;
        const nextGrade = GRADE_NEXT[currentGrade];
        const targets = classrooms.filter((c: any) => c.grade_level === nextGrade);
        if (targets.length === 0) {
          toast.warning(`ไม่มีห้องระดับ ${nextGrade} — ข้าม ${list.length} คน`);
          continue;
        }
        for (let i = 0; i < list.length; i++) {
          const t = targets[i % targets.length];
          continuousUpdates.push({ id: list[i].id, classroom_id: t.id });
        }
        promoted += list.length;
      }
      for (const u of continuousUpdates) {
        await supabase.from("students").update({ classroom_id: u.classroom_id }).eq("id", u.id);
      }

      // 2) ชั้นรอยต่อ — เข้า holding zone
      let held = 0;
      for (const s of active) {
        const g = s.classrooms?.grade_level;
        const next = TRANSITION_FROM[g];
        if (!next) continue;
        const { error } = await supabase
          .from("students")
          .update({
            transition_pending_to: next,
            transition_pending_at: now.toISOString(),
          })
          .eq("id", s.id);
        if (!error) held++;
      }

      // 3) ม.6 — จบการศึกษา
      let grad = 0;
      for (const s of active) {
        const g = s.classrooms?.grade_level;
        if (!FINAL_GRADES.includes(g)) continue;
        const { error } = await supabase
          .from("students")
          .update({
            status: "graduated",
            graduation_year: year,
            graduation_level: g,
          })
          .eq("id", s.id);
        if (!error) grad++;
      }

      // 4) บันทึก promotion_run (สำหรับ rollback)
      const { data: userRes } = await supabase.auth.getUser();
      await supabase.from("promotion_runs").insert({
        run_by: userRes?.user?.id || null,
        academic_year: closingAcademicYear,
        summary: { promoted, held, graduated: grad },
        snapshot: beforeSnapshot,
      });

      // 5) ปิดปีเก่า + สร้างปีถัดไป (เทอม 1 + เทอม 2) อัตโนมัติ
      const { error: rpcErr } = await supabase.rpc("create_next_year_periods" as any, {
        closing_year_be: closingYearBE,
      });
      if (rpcErr) {
        toast.warning(`สร้างปีถัดไปไม่สำเร็จ: ${rpcErr.message}`);
      }

      toast.dismiss(tid);
      toast.success(
        `เสร็จสิ้น: เลื่อน ${promoted} • รอจัดรอยต่อ ${held} • จบการศึกษา ${grad} • เปิดปี ${closingYearBE + 1} แล้ว`,
      );
      qc.invalidateQueries({ queryKey: ["year-end-students"] });
      qc.invalidateQueries({ queryKey: ["promotion-runs"] });
      qc.invalidateQueries({ queryKey: ["year-end-current-period"] });
      qc.invalidateQueries({ queryKey: ["academic_periods_all"] });
      setConfirmOpen(false);
    } catch (e: any) {
      toast.dismiss(tid);

      toast.error(e.message);
    }
    setRunning(false);
  };

  const assignToClassroom = async (studentId: string, classroomId: string) => {
    const { error } = await supabase
      .from("students")
      .update({
        classroom_id: classroomId,
        transition_pending_to: null,
        transition_pending_at: null,
      })
      .eq("id", studentId);
    if (error) return toast.error(error.message);
    toast.success("จัดห้องสำเร็จ");
    qc.invalidateQueries({ queryKey: ["year-end-students"] });
  };

  const markDropOut = async (studentId: string, newStatus: "transferred" | "dropped") => {
    const { error } = await supabase
      .from("students")
      .update({
        status: newStatus,
        transition_pending_to: null,
        transition_pending_at: null,
      })
      .eq("id", studentId);
    if (error) return toast.error(error.message);
    toast.success(newStatus === "transferred" ? "บันทึกย้ายโรงเรียน" : "บันทึกลาออก");
    qc.invalidateQueries({ queryKey: ["year-end-students"] });
  };

  // Promotion runs (สำหรับ rollback ภายใน 7 วัน)
  const { data: runs = [] } = useQuery({
    queryKey: ["promotion-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotion_runs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const handleRollback = async (run: any) => {
    const ageMs = Date.now() - new Date(run.run_at).getTime();
    if (ageMs > 7 * 24 * 60 * 60 * 1000) {
      toast.error("เกิน 7 วันแล้ว ไม่สามารถ rollback ได้");
      return;
    }
    if (run.rolled_back_at) {
      toast.error("rollback ไปแล้ว");
      return;
    }
    if (!confirm("ยืนยัน rollback การเลื่อนชั้นครั้งนี้?")) return;
    const tid = toast.loading("กำลัง rollback...");
    try {
      const snap = (run.snapshot as any[]) || [];
      for (const s of snap) {
        await supabase
          .from("students")
          .update({
            classroom_id: s.classroom_id,
            status: s.status,
            transition_pending_to: null,
            transition_pending_at: null,
            graduation_year: null,
            graduation_level: null,
          })
          .eq("id", s.id);
      }
      // ลบ snapshot ของปีที่ rollback
      await supabase
        .from("student_enrollment_history")
        .delete()
        .eq("academic_year", run.academic_year);

      const { data: userRes } = await supabase.auth.getUser();
      await supabase
        .from("promotion_runs")
        .update({
          rolled_back_at: new Date().toISOString(),
          rolled_back_by: userRes?.user?.id || null,
        })
        .eq("id", run.id);

      toast.dismiss(tid);
      toast.success(`Rollback สำเร็จ ${snap.length} คน`);
      qc.invalidateQueries({ queryKey: ["year-end-students"] });
      qc.invalidateQueries({ queryKey: ["promotion-runs"] });
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error(e.message);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="text-primary" /> สิ้นปีการศึกษา & เลื่อนชั้นอัตโนมัติ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            เลื่อนชั้นต่อเนื่องอัตโนมัติ • ชั้นรอยต่อ (อ.3 / ป.6 / ม.3) เข้า Holding Zone รอจัดห้อง • ม.6 ย้ายเป็นศิษย์เก่า
          </p>
          {currentPeriod && (
            <div className="mt-2 text-xs flex items-center gap-2 flex-wrap">
              <Badge variant="outline">
                ปีการศึกษาปัจจุบัน: {(currentPeriod as any).academic_year_be} • เทอม {(currentPeriod as any).semester}
              </Badge>
              <span className="text-muted-foreground">
                ({new Date((currentPeriod as any).start_date).toLocaleDateString("th-TH")} – {new Date((currentPeriod as any).end_date).toLocaleDateString("th-TH")})
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={async () => {
              const { error } = await supabase.rpc("auto_set_current_period" as any);
              if (error) return toast.error(error.message);
              toast.success("ปรับเทอมปัจจุบันตามวันนี้แล้ว");
              qc.invalidateQueries({ queryKey: ["year-end-current-period"] });
              qc.invalidateQueries({ queryKey: ["academic_periods_all"] });
            }}
          >
            ปรับเทอมตามวันที่
          </Button>
          <Button size="lg" onClick={() => setConfirmOpen(true)} className="gap-2">
            <ArrowUpCircle className="w-5 h-5" /> รันสิ้นปีการศึกษา
          </Button>
        </div>
      </div>


      {/* Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-success/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-success" /> เลื่อนอัตโนมัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{continuousCount}</div>
            <p className="text-xs text-muted-foreground mt-1">ชั้นต่อเนื่อง — เลื่อนทันที</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {sortGrades(Object.keys(continuousByGrade)).map((g) => (
                <Badge key={g} variant="secondary" className="text-xs">
                  {g} → {GRADE_NEXT[g]} ({continuousByGrade[g]})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-warning" /> รอจัดชั้นรอยต่อ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {Object.values(transitionByGrade).reduce((a, b) => a + b, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">เข้า Holding Zone — admin จัดห้อง</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {sortGrades(Object.keys(transitionByGrade)).map((g) => (
                <Badge key={g} variant="secondary" className="text-xs">
                  {g} → {TRANSITION_FROM[g]} ({transitionByGrade[g]})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-info/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-info" /> จบการศึกษา (ม.6)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-info">{graduatingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">ย้ายเป็นศิษย์เก่าโดยอัตโนมัติ</p>
          </CardContent>
        </Card>
      </div>

      {/* Holding Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-warning" />
            Holding Zone — รอจัดห้องช่วงชั้นรอยต่อ
            <Badge variant="outline">{pending.length} คน</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-success/60" />
              ไม่มีนักเรียนรอจัดห้องในขณะนี้
            </div>
          ) : (
            <Tabs defaultValue={Object.keys(pendingByTarget)[0]}>
              <TabsList>
                {sortGrades(Object.keys(pendingByTarget)).map((target) => (
                  <TabsTrigger key={target} value={target}>
                    เข้า {target} ({pendingByTarget[target].length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(pendingByTarget).map(([target, list]) => {
                const targetClassrooms = classrooms.filter((c: any) => c.grade_level === target);
                return (
                  <TabsContent key={target} value={target} className="space-y-2">
                    {targetClassrooms.length === 0 && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-danger-soft text-danger text-sm">
                        <AlertTriangle className="w-4 h-4" /> ยังไม่มีห้องระดับ {target} — สร้างห้องก่อนจึงจะจัดได้
                      </div>
                    )}
                    <div className="space-y-2">
                      {list.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-3 p-3 border rounded-md flex-wrap">
                          <div className="flex-1 min-w-[200px]">
                            <div className="font-medium">
                              {s.prefix}{s.first_name} {s.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.student_code} • จาก {s.classrooms?.name || "—"}
                            </div>
                          </div>
                          <Select onValueChange={(cid) => assignToClassroom(s.id, cid)}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder={`จัดเข้าห้อง ${target}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {targetClassrooms.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => markDropOut(s.id, "transferred")}>
                            <UserMinus className="w-3 h-3 mr-1" /> ย้าย รร.
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => markDropOut(s.id, "dropped")}>
                            ลาออก
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* ประวัติการรัน + Rollback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> ประวัติการรันสิ้นปีการศึกษา
            <span className="text-xs font-normal text-muted-foreground">(rollback ได้ภายใน 7 วัน)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">ยังไม่มีประวัติการรัน</div>
          ) : (
            <div className="space-y-2">
              {runs.map((r: any) => {
                const summary = r.summary || {};
                const ageMs = Date.now() - new Date(r.run_at).getTime();
                const canRollback = !r.rolled_back_at && ageMs <= 7 * 24 * 60 * 60 * 1000;
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 border rounded-md flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium">
                        ปีการศึกษา {r.academic_year + 543}
                        {r.rolled_back_at && <Badge variant="outline" className="ml-2 text-danger border-danger">Rolled back</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.run_at).toLocaleString("th-TH")} • เลื่อน {summary.promoted ?? 0} • รอจัด {summary.held ?? 0} • จบ {summary.graduated ?? 0}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(r)}
                      disabled={!canRollback}
                    >
                      <Undo2 className="w-3 h-3 mr-1" />
                      {r.rolled_back_at ? "ยกเลิกแล้ว" : canRollback ? "Rollback" : "เกิน 7 วัน"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>


      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันรันสิ้นปีการศึกษา?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>ระบบจะดำเนินการ:</div>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>เลื่อนชั้นต่อเนื่อง <b className="text-success">{continuousCount}</b> คน ทันที</li>
                  <li>ย้ายชั้นรอยต่อเข้า Holding Zone <b className="text-warning">{Object.values(transitionByGrade).reduce((a, b) => a + b, 0)}</b> คน (admin จัดห้องภายหลัง)</li>
                  <li>บันทึก ม.6 จบการศึกษา <b className="text-info">{graduatingCount}</b> คน</li>
                </ul>
                <div className="text-xs text-danger mt-2">⚠ การกระทำนี้แก้กลับยาก แนะนำสำรองข้อมูลก่อน</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleRunYearEnd} disabled={running}>
              {running ? "กำลังประมวลผล..." : "ยืนยันรัน"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default YearEndPromotionPage;
