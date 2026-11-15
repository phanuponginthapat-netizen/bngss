import { useEffect, useState } from "react";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { resolveDigestStatuses } from "../../../supabase/functions/_shared/attendanceDigest";
import { todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import LiffShell from "./LiffShell";
import { saveErrorMessage } from "@/lib/saveError";

type Student = { id: string; prefix: string | null; first_name: string; last_name: string; student_code: string | null };
type Status = "present" | "absent" | "late" | "leave";

function CheckIn({ lineUserId }: { lineUserId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [prescanned, setPrescanned] = useState<Record<string, Status>>({});

  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scanError,setScanError] = useState("");
  const today = todayBangkok();

  useEffect(() => {
    (async () => {
      // หา teacher profile -> personnel -> classroom homeroom
      const { data: prof } = await supabase.from("profiles").select("id,first_name,last_name").eq("line_user_id", lineUserId).maybeSingle();
      if (!prof) { setLoading(false); return; }
      const { data: per } = await supabase.from("personnel").select("id,prefix,first_name,last_name").eq("user_id", prof.id).maybeSingle();
      if (!per) { setLoading(false); return; }
      // Prefer FK lookup; fall back to legacy string match for un-backfilled rows.
      let cls: { id: string } | null = null;
      const fk = await supabase.from("classrooms").select("id")
        .or(`homeroom_teacher_id.eq.${per.id},homeroom_teacher_2_id.eq.${per.id}`)
        .limit(1).maybeSingle();
      cls = fk.data ?? null;
      if (!cls) {
        const tname = `${per.prefix ?? ""}${per.first_name} ${per.last_name}`;
        const legacy = await supabase.from("classrooms").select("id")
          .or(`homeroom_teacher.eq.${tname},homeroom_teacher.eq.${per.first_name} ${per.last_name}`)
          .limit(1).maybeSingle();
        cls = legacy.data ?? null;
      }
      if (!cls) { setLoading(false); return; }
      setClassroomId(cls.id);
      const { data: studs } = await supabase.from("students").select("id,prefix,first_name,last_name,student_code")
        .eq("classroom_id", cls.id).eq("status", "active").order("student_code");
      setStudents(studs ?? []);
      // ใช้ผลสแกนเข้าโรงเรียนเป็นค่าตั้งต้น (ไม่ใช่เช็คชื่อหน้าเสาธงใหม่)
      const ids = (studs ?? []).map((s) => s.id);
      const { data: scanned, error: scanError } = ids.length
        ? await supabase.from("attendance").select("student_id,status")
            .eq("attendance_date", today).is("subject_id", null).in("student_id", ids)
        : { data: [] as any[], error: null };
      if(scanError) {setScanError("อ่านผลสแกนไม่สำเร็จ กรุณาลองใหม่");setLoading(false);return;}
      const scanMap: Record<string, Status> = {};
      (scanned ?? []).forEach((r: any) => { scanMap[r.student_id] = r.status; });
      setPrescanned(scanMap);
      const init: Record<string, Status> = {};
      (studs ?? []).forEach((s) => { init[s.id] = scanMap[s.id] ?? "absent"; });
      setMarks(init);
      setLoading(false);
    })();
  }, [lineUserId]);


  useEffect(() => {
    if (!students.length) return;
    const refresh = async () => {
      try {
        const ids=students.map(s=>s.id);
        const [attendance,scans,threshold] = await Promise.all([
          fetchAllRows((a,b)=>supabase.from("attendance").select("student_id,status").eq("attendance_date",today).is("subject_id",null).in("student_id",ids).order("id").range(a,b)),
          fetchAllRows((a,b)=>supabase.from("face_scan_logs").select("student_id,scan_time,scan_type").eq("scan_date",today).in("scan_type",["entry","assembly"]).in("student_id",ids).order("id").range(a,b)),
          supabase.from("school_settings").select("setting_value").eq("setting_key","clock_late_threshold").maybeSingle(),
        ]);
        if(threshold.error)throw threshold.error;
        const resolved=resolveDigestStatuses(attendance,scans,String(threshold.data?.setting_value||"08:30"));
        const found:Record<string,Status>={};
        for(const [id,status] of resolved) if(["present","late","absent","leave"].includes(status))found[id]=status as Status;
        setPrescanned(found);setScanError("");
        setMarks(prev=>{const next={...prev};for(const [id,status] of Object.entries(found))if(status==="present"||status==="late")next[id]=status;return next;});
      }catch{setScanError("อ่านผลสแกนไม่สำเร็จ กรุณาลองใหม่");}
    };
    void refresh();const timer=window.setInterval(refresh,30_000);window.addEventListener("focus",refresh);
    window.addEventListener("facegate:receipt",refresh);
    return ()=>{window.clearInterval(timer);window.removeEventListener("facegate:receipt",refresh);window.removeEventListener("focus",refresh);};
  },[students,today]);

  const save = async () => {
    if (!classroomId) return;
    setBusy(true);
    try {
      const {data: period,error: periodError} = await supabase.from("academic_periods").select("academic_year_be,semester").lte("start_date",today).gte("end_date",today).order("start_date",{ascending:false}).limit(1).maybeSingle();
      if(periodError || !period) throw new Error("ไม่พบภาคเรียนของวันที่เช็คชื่อ กรุณาตรวจปฏิทินโรงเรียน");
      const year = period.academic_year_be - 543, sem = period.semester;
      const ids = students.map(s=>s.id);
      const [saved, scans, thresholdRes] = await Promise.all([
        fetchAllRows((a,b)=>supabase.from("attendance").select("student_id,status").eq("attendance_date",today).is("subject_id",null).in("student_id",ids).order("id").range(a,b)),
        fetchAllRows((a,b)=>supabase.from("face_scan_logs").select("student_id,scan_time,scan_type").eq("scan_date",today).in("scan_type",["entry","assembly"]).in("student_id",ids).order("id").range(a,b)),
        supabase.from("school_settings").select("setting_value").eq("setting_key","clock_late_threshold").maybeSingle(),
      ]);
      if(thresholdRes.error) throw thresholdRes.error;
      const confirmed = resolveDigestStatuses(saved,scans,String(thresholdRes.data?.setting_value || "08:30"));
      const savedIds = new Set(saved.map(r=>r.student_id));
      const { data: u } = await supabase.auth.getUser();
      // ไม่เขียนทับผลสแกนเข้าโรงเรียน (มา/สาย)
      const targets = students.filter((s) => {
        if (savedIds.has(s.id)) return false;
        const pre = confirmed.get(s.id);
        if (pre === "present" || pre === "late") return false;
        return true;
      });
      if (targets.length === 0) {
        toast.info("ทุกคนมีผลสแกนเข้าโรงเรียนแล้ว");
        setTimeout(() => (window as any).liff?.closeWindow?.(), 800);
        return;
      }
      const rows = targets.map((s) => ({
        student_id: s.id,
        attendance_date: today,
        subject_id: null,
        status: marks[s.id] ?? "absent",
        academic_year: year,
        semester: sem,
        recorded_by: u?.user?.id ?? null,
        notes: "liff",
      }));
      for (const row of rows) {
        const {error} = await supabase.from("attendance").insert(row);
        if(error && error.code !== "23505") throw error;
      }
      toast.success("บันทึกเช็คชื่อแล้ว");
      setTimeout(() => (window as any).liff?.closeWindow?.(), 800);
    } catch (e: any) { toast.error(saveErrorMessage(e)); } finally { setBusy(false); }
  };

  if (loading) return <p>กำลังโหลด...</p>;
  if (!classroomId) return <p className="text-muted-foreground">ไม่พบห้องประจำชั้น</p>;
  if (!students.length) return <p className="text-muted-foreground">ไม่มีนักเรียน</p>;

  const colors: Record<Status, string> = {
    present: "bg-emerald-500 text-white",
    absent: "bg-rose-500 text-white",
    late: "bg-amber-500 text-white",
    leave: "bg-sky-500 text-white",
  };

  return (
    <div className="space-y-2 max-w-md mx-auto pb-24">
      {scanError && <p role="alert" className="text-destructive">{scanError}</p>}
      {students.map((s) => {
        const locked = prescanned[s.id] === "present" || prescanned[s.id] === "late";
        return (
        <div key={s.id} className="rounded-xl border bg-card p-3">
          <p className="font-medium text-sm">{s.prefix}{s.first_name} {s.last_name}</p>
          <p className="text-xs text-muted-foreground mb-2">
            {s.student_code}
            {locked && <span className="ml-2 text-emerald-600">• สแกนเข้าโรงเรียนแล้ว ({prescanned[s.id] === "late" ? "สาย" : "มา"})</span>}
          </p>
          <div className="grid grid-cols-4 gap-1">
            {(["present", "absent", "late", "leave"] as Status[]).map((st) => (
              <button key={st} disabled={locked} onClick={() => setMarks({ ...marks, [s.id]: st })}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60 ${marks[s.id] === st ? colors[st] : "bg-muted text-muted-foreground"}`}>
                {st === "present" ? "มา" : st === "absent" ? "ขาด" : st === "late" ? "สาย" : "ลา"}
              </button>
            ))}
          </div>
        </div>
        );
      })}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t">
        <Button onClick={save} disabled={busy || !!scanError} className="w-full">
          {busy ? "กำลังบันทึก..." : `บันทึกเช็คชื่อ ${today}`}
        </Button>
      </div>
    </div>
  );
}

export default function LiffAttendancePage() {
  return <LiffShell title="✅ เช็คชื่อนักเรียน">{(uid) => <CheckIn lineUserId={uid} />}</LiffShell>;
}
