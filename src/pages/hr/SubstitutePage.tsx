import { useState, useMemo, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarCheck, UserCheck, Clock, AlertTriangle, Users, Grid3x3, CheckCircle2, ChevronDown, X, Sparkles, BookOpen, DoorOpen, Lock, Camera, Eye, Image as ImageIcon, Upload, Star } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import SubstituteReport from "@/components/hr/SubstituteReport";

const dayNames = {
  th: ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"],
  en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr);
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) {
      dates.push(cur.toISOString().split("T")[0]);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isPastDate(d: string) {
  return Boolean(d) && d < todayStr();
}

const SubstitutePage = () => {
  const { lang } = useLanguage();
  const { isAdmin, isDirector } = useUserRole();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState("");
  const [pendingPicks, setPendingPicks] = useState<Record<string, { gap: any; teacher: any; originalName: string }>>({});
  const [confirming, setConfirming] = useState(false);
  const [detailSub, setDetailSub] = useState<any | null>(null);
  const [detailPhotoUrl, setDetailPhotoUrl] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPendingPicks({}); }, [selectedDate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  useEffect(() => {
    (supabase as any).rpc("finalize_past_substitute_teaching").then(({ data }: any) => {
      if (data && Number(data) > 0) qc.invalidateQueries({ queryKey: ["substitute_teaching"] });
    });
  }, [qc]);

  // Resolve a signed URL whenever a detailSub with a proof_photo_url is opened
  useEffect(() => {
    const path = (detailSub as any)?.proof_photo_url;
    if (!path) { setDetailPhotoUrl(null); return; }
    supabase.storage.from("substitute-proof").createSignedUrl(path, 3600).then(({ data }) => {
      setDetailPhotoUrl(data?.signedUrl || null);
    });
  }, [detailSub]);

  // Thumbnails for proof photos across the history table
  const [proofThumbs, setProofThumbs] = useState<Record<string, string>>({});


  const { data: approvedLeaves = [] } = useQuery({
    queryKey: ["staff_leaves_approved"],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_leaves")
        .select("*, personnel(id, prefix, first_name, last_name, employee_code)")
        .eq("status", "approved")
        .order("start_date", { ascending: false });
      return data || [];
    },
  });

  const { data: allSchedules = [] } = useQuery({
    queryKey: ["schedules_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("schedules")
        .select("*, subjects(id, code, name_th, name_en), classrooms(id, name, grade_level)")
        .order("day_of_week")
        .order("period");
      return data || [];
    },
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ["personnel_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("*")
        .eq("status", "active")
        .order("first_name");
      return data || [];
    },
  });

  const { data: existingSubs = [] } = useQuery({
    queryKey: ["substitute_teaching"],
    queryFn: async () => {
      const { data } = await supabase
        .from("substitute_teaching")
        .select("*, subjects(id, code, name_th, name_en), classrooms(id, name, grade_level)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Batch-resolve signed thumbnail URLs for every row that has a proof photo
  useEffect(() => {
    const rows = (existingSubs as any[]).filter((r) => r.proof_photo_url && !proofThumbs[r.id]);
    if (rows.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        rows.map(async (r) => {
          const { data } = await supabase.storage.from("substitute-proof").createSignedUrl(r.proof_photo_url, 3600);
          return [r.id, data?.signedUrl || ""] as const;
        })
      );
      if (cancelled) return;
      setProofThumbs((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) if (url) next[id] = url;
        return next;
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSubs]);



  // Unique weekday list across all leaves — hide dates that have already passed
  const allLeaveDates = useMemo(() => {
    const set = new Set<string>();
    const today = todayStr();
    approvedLeaves.forEach((l: any) => {
      getDatesBetween(l.start_date, l.end_date).forEach((d) => {
        if (d >= today) set.add(d);
      });
    });
    return Array.from(set).sort();
  }, [approvedLeaves]);


  // Find current user's personnel record + name variants (for matching substitute_teacher text)
  const myPersonnel = useMemo(
    () => allPersonnel.find((p: any) => p.user_id === currentUserId),
    [allPersonnel, currentUserId]
  );

  const fullName2 = (p: any) => `${p?.prefix || ""}${p?.first_name || ""} ${p?.last_name || ""}`.replace(/\s+/g, " ").trim();

  // My substitute assignments (where I am the substitute teacher)
  const myAssignments = useMemo(() => {
    if (!myPersonnel) return [];
    const names = new Set([
      fullName2(myPersonnel),
      `${myPersonnel.first_name} ${myPersonnel.last_name}`.trim(),
      `ครู${myPersonnel.first_name}`,
    ]);
    return existingSubs
      .filter((s: any) => names.has(s.substitute_teacher))
      .sort((a: any, b: any) => (b.teaching_date || "").localeCompare(a.teaching_date || ""));
  }, [existingSubs, myPersonnel]);


  const nameVariants = (p: any): string[] => {
    if (!p) return [];
    const prefix = (p.prefix || "").trim();
    const first = (p.first_name || "").trim();
    const last = (p.last_name || "").trim();
    return Array.from(
      new Set(
        [
          `${prefix}${first} ${last}`,
          `${prefix} ${first} ${last}`,
          `${first} ${last}`,
          first,
          `ครู${first}`,
          `${prefix}${first}`,
        ]
          .map((s) => s.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      )
    );
  };

  const scheduleMatchesPerson = (scheduleName: string | null, p: any, schedule?: any): boolean => {
    if (!p) return false;
    if (schedule?.teacher_id && schedule.teacher_id === p.user_id) return true;
    if (schedule?.teacher_id && schedule.teacher_id === p.id) return true;
    if (!scheduleName) return false;
    const norm = scheduleName.replace(/\s+/g, " ").trim();
    return nameVariants(p).some((v) => v === norm);
  };

  // Only personnel who actually appear in the schedule (by id or by name) are
  // candidates for substitute. Office/admin staff with no teaching duty are excluded.
  const teachingPersonIds = useMemo(() => {
    const ids = new Set<string>();
    allPersonnel.forEach((p: any) => {
      const isTeacher = allSchedules.some((s: any) => scheduleMatchesPerson(s.teacher_name, p, s));
      if (isTeacher) ids.add(p.id);
    });
    return ids;
  }, [allPersonnel, allSchedules]);

  // Map: personnel.id -> Set of subject_ids that person teaches (from schedules)
  const personSubjects = useMemo(() => {
    const map = new Map<string, Set<string>>();
    allPersonnel.forEach((p: any) => {
      const set = new Set<string>();
      allSchedules.forEach((s: any) => {
        if (s.subject_id && scheduleMatchesPerson(s.teacher_name, p, s)) {
          set.add(s.subject_id);
        }
      });
      if (set.size) map.set(p.id, set);
    });
    return map;
  }, [allPersonnel, allSchedules]);




  const fullName = (p: any) => `${p?.prefix || ""}${p?.first_name || ""} ${p?.last_name || ""}`.replace(/\s+/g, " ").trim();

  // All personnel absent on the selected date (de-dup by id)
  const absentPersonsToday = useMemo(() => {
    if (!selectedDate) return [];
    const map = new Map<string, { personnel: any; leave: any }>();
    approvedLeaves.forEach((lv: any) => {
      if (lv.personnel && lv.start_date <= selectedDate && lv.end_date >= selectedDate) {
        if (!map.has(lv.personnel.id)) map.set(lv.personnel.id, { personnel: lv.personnel, leave: lv });
      }
    });
    return Array.from(map.values());
  }, [selectedDate, approvedLeaves]);

  // Per-absent-teacher gaps: { personId -> { personnel, leave, gaps[] } }
  const gapsByPerson = useMemo(() => {
    if (!selectedDate || absentPersonsToday.length === 0) return [];
    const dow = getDayOfWeek(selectedDate);
    return absentPersonsToday.map(({ personnel, leave }) => {
      const matched = allSchedules.filter(
        (s: any) => s.day_of_week === dow && scheduleMatchesPerson(s.teacher_name, personnel, s)
      );
      // Dedupe by period+classroom
      const seen = new Set<string>();
      const gaps = matched.filter((s: any) => {
        const k = `${s.period}-${s.classroom_id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { personnel, leave, gaps };
    });
  }, [selectedDate, absentPersonsToday, allSchedules]);

  // Available teachers per period — excludes ALL absent persons today
  const availableTeachersForPeriod = useMemo(() => {
    if (!selectedDate) return {} as Record<number, any[]>;
    const dow = getDayOfWeek(selectedDate);
    const result: Record<number, any[]> = {};
    const allAbsentIds = new Set(absentPersonsToday.map((a) => a.personnel.id));

    // Collect all unique periods involved
    const allPeriods = new Set<number>();
    gapsByPerson.forEach((g) => g.gaps.forEach((x: any) => allPeriods.add(x.period)));

    allPeriods.forEach((period) => {
      const periodSchedules = allSchedules.filter(
        (s: any) => s.day_of_week === dow && s.period === period
      );
      const alreadyAssignedNames = new Set(
        existingSubs
          .filter((sub: any) => sub.teaching_date === selectedDate && String(sub.period) === String(period))
          .map((s: any) => s.substitute_teacher)
      );

      result[period] = allPersonnel.filter((p: any) => {
        if (!teachingPersonIds.has(p.id)) return false;
        if (allAbsentIds.has(p.id)) return false;
        const isBusy = periodSchedules.some((s: any) => scheduleMatchesPerson(s.teacher_name, p, s));
        if (isBusy) return false;
        if (alreadyAssignedNames.has(fullName(p))) return false;
        return true;
      });
    });
    return result;
  }, [selectedDate, gapsByPerson, absentPersonsToday, allSchedules, allPersonnel, existingSubs, teachingPersonIds]);

  // Track assignments made within this date (so two gaps in same period don't pick the same sub)
  const assignedSubsByPeriod = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    existingSubs
      .filter((s: any) => s.teaching_date === selectedDate)
      .forEach((s: any) => {
        const k = String(s.period);
        if (!map[k]) map[k] = new Set();
        map[k].add(s.substitute_teacher);
      });
    // Also include pending (draft) picks
    Object.values(pendingPicks).forEach((p) => {
      const k = String(p.gap.period);
      if (!map[k]) map[k] = new Set();
      map[k].add(fullName(p.teacher));
    });
    return map;
  }, [existingSubs, selectedDate, pendingPicks]);

  // Free-teachers grid: every (period, classroom) on the selected date
  const freeTeachersGrid = useMemo(() => {
    if (!selectedDate) return [] as any[];
    const dow = getDayOfWeek(selectedDate);
    const absentIds = new Set(absentPersonsToday.map((a) => a.personnel.id));
    const daySchedules = allSchedules.filter((s: any) => s.day_of_week === dow);

    // Group classrooms per period
    const periodMap = new Map<number, any[]>();
    const seen = new Set<string>();
    daySchedules.forEach((s: any) => {
      const k = `${s.period}-${s.classroom_id}-${s.teacher_name || ""}`;
      if (seen.has(k)) return;
      seen.add(k);
      if (!periodMap.has(s.period)) periodMap.set(s.period, []);
      periodMap.get(s.period)!.push(s);
    });

    const rows: any[] = [];
    Array.from(periodMap.keys())
      .sort((a, b) => a - b)
      .forEach((period) => {
        const periodSchedules = periodMap.get(period)!;
        const freeTeachers = allPersonnel.filter((p: any) => {
          if (!teachingPersonIds.has(p.id)) return false;
          if (absentIds.has(p.id)) return false;
          return !periodSchedules.some((s: any) => scheduleMatchesPerson(s.teacher_name, p, s));
        });
        periodSchedules.forEach((s: any) => {
          const isAbsent = absentPersonsToday.some(({ personnel }) =>
            scheduleMatchesPerson(s.teacher_name, personnel, s)
          );
          rows.push({ period, schedule: s, isAbsent, freeTeachers });
        });
      });
    return rows;
  }, [selectedDate, allSchedules, allPersonnel, absentPersonsToday, teachingPersonIds]);


  // Step 1 (no DB write): add pick to local draft
  const handlePickDraft = (originalName: string, gap: any, teacher: any) => {
    setPendingPicks((prev) => ({
      ...prev,
      [gap.id]: { gap, teacher, originalName },
    }));
  };

  const handleRemovePending = (gapId: string) => {
    setPendingPicks((prev) => {
      const next = { ...prev };
      delete next[gapId];
      return next;
    });
  };

  // Commit a single pick to DB + send notifications
  const commitOne = async ({ originalName, gap, teacher }: { originalName: string; gap: any; teacher: any }) => {
    const teacherName = fullName(teacher);
    const { error } = await supabase.from("substitute_teaching").insert({
      original_teacher: originalName,
      substitute_teacher: teacherName,
      teaching_date: selectedDate,
      period: String(gap.period),
      subject_id: gap.subject_id,
      classroom_id: gap.classroom_id,
      status: "confirmed",
    } as any);
    if (error) throw error;

    const sched = allSchedules.find(
      (s: any) => s.day_of_week === getDayOfWeek(selectedDate) && s.period === gap.period && s.classroom_id === gap.classroom_id
    );
    const subjectLabel = sched?.subjects?.name_th || sched?.subject_name_raw || "";
    const classroomLabel = sched?.classrooms?.name || "";
    const detail = `วันที่ ${selectedDate} คาบ ${gap.period} ${subjectLabel ? `วิชา ${subjectLabel} ` : ""}${classroomLabel ? `ห้อง ${classroomLabel}` : ""}`.trim();
    const personalBody = `คุณได้รับมอบหมายสอนแทน ${originalName} ${detail}`;
    const gchatBody = `ครู ${teacherName} ได้รับมอบหมายสอนแทน ${originalName} ${detail}`;

    if (teacher?.user_id) {
      await notify({
        user_ids: [teacher.user_id],
        title: "📢 ได้รับมอบหมายสอนแทน",
        body: personalBody,
        type: "substitute_teaching",
        reference_type: "substitute_teaching",
        severity: "warning",
        url: "/dashboard/hr/substitute",
        channels: ["in_app", "push", "line"],
      });
    }
    try {
      await supabase.functions.invoke("notify-google-chat", {
        body: { message: `👨‍🏫 *จัดสอนแทน*\n${gchatBody}`, department: "hr" },
      });
    } catch (e) {
      console.error("google chat notify failed", e);
    }
  };

  const handleConfirmAll = async () => {
    const picks = Object.values(pendingPicks);
    if (picks.length === 0) return;
    setConfirming(true);
    let ok = 0;
    let failed = 0;
    for (const p of picks) {
      try {
        await commitOne(p);
        ok++;
      } catch (e: any) {
        console.error(e);
        failed++;
      }
    }
    setConfirming(false);
    setPendingPicks({});
    qc.invalidateQueries({ queryKey: ["substitute_teaching"] });
    if (failed === 0) {
      toast.success(lang === "th" ? `ยืนยันสำเร็จ ${ok} คาบ — ส่งแจ้งเตือนแล้ว` : `Confirmed ${ok} — notified`);
    } else {
      toast.warning(lang === "th" ? `สำเร็จ ${ok} / ล้มเหลว ${failed}` : `Saved ${ok}, failed ${failed}`);
    }
  };



  const isAlreadyAssigned = (gap: any) =>
    existingSubs.some(
      (s: any) =>
        s.teaching_date === selectedDate &&
        String(s.period) === String(gap.period) &&
        s.classroom_id === gap.classroom_id
    );

  const getAssignedSub = (gap: any) =>
    existingSubs.find(
      (s: any) =>
        s.teaching_date === selectedDate &&
        String(s.period) === String(gap.period) &&
        s.classroom_id === gap.classroom_id
    );

  const handleRemoveSub = async (id: string) => {
    await supabase.from("substitute_teaching").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["substitute_teaching"] });
    toast.success(lang === "th" ? "ยกเลิกแล้ว" : "Removed");
  };

  const handleUploadProof = async (file: File) => {
    if (!detailSub) return;
    if (isPastDate(detailSub.teaching_date)) {
      toast.error(lang === "th" ? "เลยวันสอนแทนแล้ว ไม่สามารถอัปโหลดย้อนหลังได้" : "Cannot upload proof after the teaching date");
      return;
    }
    setUploadingProof(true);

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${detailSub.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("substitute-proof").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: updErr } = await (supabase.from("substitute_teaching") as any)
        .update({
          proof_photo_url: path,
          proof_uploaded_at: new Date().toISOString(),
          proof_uploaded_by: currentUserId,
        })
        .eq("id", detailSub.id);
      if (updErr) throw updErr;
      const { data: signed } = await supabase.storage.from("substitute-proof").createSignedUrl(path, 3600);
      setDetailPhotoUrl(signed?.signedUrl || null);
      setDetailSub({ ...detailSub, proof_photo_url: path });
      qc.invalidateQueries({ queryKey: ["substitute_teaching"] });
      toast.success(lang === "th" ? "อัปโหลดภาพหลักฐานแล้ว" : "Proof uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingProof(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-warning-soft text-warning",
    confirmed: "bg-success-soft text-success",
    completed: "bg-info-soft text-info",
    no_substitute: "bg-neutral-soft text-neutral",
  };
  const statusLabels: Record<string, { th: string; en: string }> = {
    pending: { th: "รอดำเนินการ", en: "Pending" },
    confirmed: { th: "จัดสอนแทนแล้ว", en: "Confirmed" },
    completed: { th: "สอนแทนเสร็จสิ้น", en: "Completed" },
    no_substitute: { th: "ไม่มีการสอนแทน", en: "No substitute" },
  };


  // Quick KPI numbers for header
  const totalGapsToday = gapsByPerson.reduce((acc, g) => acc + g.gaps.length, 0);
  const assignedGapsToday = gapsByPerson.reduce(
    (acc, g) => acc + g.gaps.filter((gap: any) => isAlreadyAssigned(gap)).length,
    0
  );
  const pendingGapsToday = totalGapsToday - assignedGapsToday;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-primary" />
              {lang === "th" ? "จัดสอนแทน" : "Substitute Teaching"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {lang === "th"
                ? "ทำ 3 ขั้นตอน: 1) เลือกวันที่ที่มีครูลา  2) ดูคาบที่ว่าง  3) คลิกชื่อครูที่จะให้สอนแทน"
                : "3 steps: 1) Pick a date  2) See open periods  3) Click a teacher to assign"}
            </p>
          </div>
          {selectedDate && (
            <div className="flex gap-2 flex-wrap">
              <div className="rounded-xl bg-background border px-4 py-2 text-center min-w-[88px]">
                <div className="text-2xl font-bold">{totalGapsToday}</div>
                <div className="text-[11px] text-muted-foreground">{lang === "th" ? "คาบที่ต้องจัด" : "Periods"}</div>
              </div>
              <div className="rounded-xl bg-success-soft dark:bg-success/30 border border-success/30 dark:border-success/30 px-4 py-2 text-center min-w-[88px]">
                <div className="text-2xl font-bold text-success dark:text-success">{assignedGapsToday}</div>
                <div className="text-[11px] text-success/80 dark:text-success/80">{lang === "th" ? "จัดแล้ว" : "Assigned"}</div>
              </div>
              <div className="rounded-xl bg-warning-soft dark:bg-warning/30 border border-warning/30 dark:border-warning/30 px-4 py-2 text-center min-w-[88px]">
                <div className="text-2xl font-bold text-warning dark:text-warning">{pendingGapsToday}</div>
                <div className="text-[11px] text-warning/80 dark:text-warning/80">{lang === "th" ? "ค้างจัด" : "Pending"}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report (Director/Admin only) */}
      {(isAdmin || isDirector) && <SubstituteReport />}



      {/* งานสอนแทนของฉัน — visible only when the current user has assignments */}
      {myAssignments.length > 0 && (
        <Card className="border-info/30 dark:border-info/30 bg-info/40 dark:bg-info/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-info dark:text-info">
              <Camera className="w-5 h-5" />
              {lang === "th" ? "งานสอนแทนของฉัน" : "My substitute assignments"}
              <Badge variant="secondary" className="ml-1">{myAssignments.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "th"
                ? "แตะที่รายการเพื่อแนบรูปถ่ายการสอนแทนเป็นหลักฐาน"
                : "Tap an item to upload your proof-of-teaching photo"}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {myAssignments.map((s: any) => {
                const hasProof = !!s.proof_photo_url;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setDetailSub(s)}
                      className="w-full p-3 flex items-center gap-3 hover:bg-info/40 dark:hover:bg-info/30 transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center flex-shrink-0">
                        <div className="text-[10px] leading-none">{lang === "th" ? "คาบ" : "P."}</div>
                        <div className="text-lg font-bold leading-none mt-0.5">{s.period}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {lang === "th" ? "แทน " : "for "}{s.original_teacher}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.teaching_date}</div>
                      </div>
                      {hasProof ? (
                        <Badge className="bg-success-soft text-success dark:bg-success dark:text-success gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {lang === "th" ? "มีรูปแล้ว" : "Photo uploaded"}
                        </Badge>
                      ) : (
                        <Badge className="bg-warning-soft text-warning dark:bg-warning dark:text-warning gap-1">
                          <Upload className="w-3 h-3" />
                          {lang === "th" ? "แนบรูป" : "Upload"}
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}


      {/* Step 1: Select date */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
          <h2 className="font-semibold">{lang === "th" ? "เลือกวันที่ที่มีครูลา" : "Pick a date"}</h2>
        </div>
        {allLeaveDates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-success" />
              {lang === "th" ? "ไม่มีใบลาที่อนุมัติในขณะนี้ — ไม่ต้องจัดสอนแทน" : "No approved leaves — nothing to substitute"}
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {allLeaveDates.map((d) => {
              const dow = getDayOfWeek(d);
              const leavesOnDate = approvedLeaves.filter((lv: any) => lv.start_date <= d && lv.end_date >= d);
              const count = leavesOnDate.length;
              const isActive = selectedDate === d;
              const dateObj = new Date(d);
              const monthsTh = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
              const monthsEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              const fullDateLabel = lang === "th"
                ? `${dayNames.th[dow]} ${dateObj.getDate()} ${monthsTh[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`
                : `${dayNames.en[dow]} ${dateObj.getDate()} ${monthsEn[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`flex-shrink-0 rounded-xl border-2 px-4 py-3 w-[240px] text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className={`text-[12px] font-medium ${isActive ? "opacity-95" : "text-muted-foreground"}`}>
                    {fullDateLabel}
                  </div>
                  <div className={`text-[11px] mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    isActive ? "bg-primary-foreground/20" : "bg-muted"
                  }`}>
                    <Users className="w-3 h-3" />
                    {count} {lang === "th" ? "คนลา" : "absent"}
                  </div>
                  <ul className={`mt-2 space-y-0.5 text-[12px] leading-tight ${isActive ? "opacity-95" : "text-foreground/80"}`}>
                    {leavesOnDate.slice(0, 3).map((lv: any) => (
                      <li key={lv.id} className="truncate">
                        • {lv.personnel ? fullName(lv.personnel) : "-"}
                      </li>
                    ))}
                    {leavesOnDate.length > 3 && (
                      <li className={isActive ? "opacity-80" : "text-muted-foreground"}>
                        +{leavesOnDate.length - 3} {lang === "th" ? "คน" : "more"}
                      </li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Step 2: gaps */}
      {selectedDate && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
            <h2 className="font-semibold">{lang === "th" ? "จัดครูสอนแทน" : "Assign substitutes"}</h2>
          </div>

          {absentPersonsToday.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {lang === "th" ? "ไม่มีครูลาในวันที่เลือก" : "No teachers on leave for this date"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {gapsByPerson.map(({ personnel, leave, gaps }) => {
                const absentName = fullName(personnel);
                const doneCount = gaps.filter((g: any) => isAlreadyAssigned(g)).length;
                const allDone = doneCount === gaps.length && gaps.length > 0;
                return (
                  <Card key={personnel.id} className="overflow-hidden">
                    <CardHeader className="pb-3 bg-muted/30">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                            {personnel.first_name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <CardTitle className="text-base">{absentName}</CardTitle>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] h-5">{leave.leave_type}</Badge>
                              <span>{leave.start_date} → {leave.end_date}</span>
                            </div>
                          </div>
                        </div>
                        <Badge className={allDone ? "bg-success-soft text-success dark:bg-success dark:text-success" : "bg-warning-soft text-warning dark:bg-warning dark:text-warning"}>
                          {allDone && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {doneCount}/{gaps.length} {lang === "th" ? "คาบ" : "periods"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {gaps.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          {lang === "th" ? "ไม่มีคาบสอนในวันนี้" : "No classes on this day"}
                        </div>
                      ) : (
                        <ul className="divide-y">
                          {gaps.map((gap: any) => {
                            const assigned = isAlreadyAssigned(gap);
                            const assignedSub = getAssignedSub(gap);
                            const pending = pendingPicks[gap.id];
                            const base = availableTeachersForPeriod[gap.period] || [];
                            const takenInPeriod = assignedSubsByPeriod[String(gap.period)] || new Set();
                            const absentGroup = (personnel as any).subject_group || null;
                            const annotated = base
                              .filter((p: any) => !takenInPeriod.has(fullName(p)))
                              .map((p: any) => {
                                const sameSubject = !!(gap.subject_id && personSubjects.get(p.id)?.has(gap.subject_id));
                                const sameGroup = !!(absentGroup && p.subject_group && p.subject_group === absentGroup);
                                const score = (sameSubject ? 2 : 0) + (sameGroup ? 1 : 0);
                                return { teacher: p, sameSubject, sameGroup, score };
                              })
                              .sort((a, b) => b.score - a.score);
                            const available = annotated.map((a) => a.teacher);

                            const subjectLabel = gap.subjects
                              ? lang === "th"
                                ? gap.subjects.name_th
                                : gap.subjects.name_en || gap.subjects.name_th
                              : "-";
                            const classroomLabel = gap.classrooms
                              ? `${gap.classrooms.grade_level} ${gap.classrooms.name}`
                              : "-";

                            return (
                              <li key={gap.id} className="p-4 flex items-center gap-4 flex-wrap">
                                {/* Period badge */}
                                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center">
                                  <div className="text-[10px] font-medium leading-none">{lang === "th" ? "คาบ" : "P."}</div>
                                  <div className="text-xl font-bold leading-none mt-0.5">{gap.period}</div>
                                </div>

                                {/* Subject + classroom */}
                                <div className="flex-1 min-w-[200px]">
                                  <div className="font-medium text-sm flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                    {gap.subjects?.code && <span className="text-muted-foreground">{gap.subjects.code}</span>}
                                    {subjectLabel}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                    <DoorOpen className="w-3.5 h-3.5" />
                                    {classroomLabel}
                                  </div>
                                </div>

                                {/* Action */}
                                <div className="flex-shrink-0">
                                  {isPastDate(selectedDate) && !assigned ? (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border rounded-lg px-3 py-1.5">
                                      <Lock className="w-3.5 h-3.5" />
                                      {lang === "th" ? "ไม่มีการสอนแทน" : "No substitute"}
                                    </div>
                                  ) : assigned && assignedSub ? (
                                    <div className="flex items-center gap-2 rounded-lg bg-success-soft dark:bg-success/30 border border-success/30 dark:border-success/30 px-3 py-1.5">
                                      <UserCheck className="w-4 h-4 text-success" />
                                      <span className="text-sm font-medium text-success dark:text-success">
                                        {isPastDate(selectedDate) ? (lang === "th" ? "มีการจัดสอนแทน" : "Substituted") : assignedSub.substitute_teacher}
                                      </span>
                                      <button
                                        onClick={() => setDetailSub(assignedSub)}
                                        className="ml-1 w-5 h-5 rounded-full hover:bg-success-soft text-success flex items-center justify-center"
                                        title={lang === "th" ? "ดูรายละเอียด" : "View"}
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      {(assignedSub as any).proof_photo_url && (
                                        <ImageIcon className="w-3.5 h-3.5 text-success" />
                                      )}
                                      {!isPastDate(selectedDate) && (
                                        <button
                                          onClick={() => handleRemoveSub(assignedSub.id)}
                                          className="ml-1 w-5 h-5 rounded-full hover:bg-danger-soft text-danger flex items-center justify-center"
                                          title={lang === "th" ? "ยกเลิก" : "Remove"}
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ) : pending ? (
                                    <div className="flex items-center gap-2 rounded-lg bg-warning-soft dark:bg-warning/30 border border-dashed border-warning/30 dark:border-warning/30 px-3 py-1.5">
                                      <Clock className="w-4 h-4 text-warning" />
                                      <span className="text-sm font-medium text-warning dark:text-warning">
                                        ครู{pending.teacher.first_name}
                                      </span>
                                      <span className="text-[10px] uppercase tracking-wide text-warning/80 dark:text-warning/80">
                                        {lang === "th" ? "รอยืนยัน" : "draft"}
                                      </span>
                                      <button
                                        onClick={() => handleRemovePending(gap.id)}
                                        className="ml-1 w-5 h-5 rounded-full hover:bg-danger-soft text-danger flex items-center justify-center"
                                        title={lang === "th" ? "ลบ" : "Remove"}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : available.length === 0 ? (
                                    <div className="flex items-center gap-1.5 text-xs text-warning dark:text-warning bg-warning-soft dark:bg-warning/30 border border-warning/30 dark:border-warning/30 rounded-lg px-3 py-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      {lang === "th" ? "ไม่มีครูว่าง" : "No free teacher"}
                                    </div>
                                  ) : (
                                    (() => {
                                      // Rule: prioritize teachers in same subject group or teaching same subject.
                                      // Show top 3 priority teachers first, then "เพิ่มเติม" to pick others.
                                      const priority = annotated.filter((a) => a.sameSubject || a.sameGroup);
                                      const others = annotated.filter((a) => !a.sameSubject && !a.sameGroup);
                                      const primary = priority.slice(0, 3);
                                      const rest = [...priority.slice(3), ...others];
                                      return (
                                        <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[420px]">
                                          {primary.length === 0 && (
                                            <span className="text-[11px] text-muted-foreground italic mr-1">
                                              {lang === "th" ? "ไม่มีครูในหมวด/วิชาเดียวกันที่ว่าง" : "No priority match free"}
                                            </span>
                                          )}
                                          {primary.map(({ teacher: t, sameSubject, sameGroup }) => {
                                            const tip = sameSubject
                                              ? (lang === "th" ? "สอนวิชาเดียวกัน" : "Teaches same subject")
                                              : (lang === "th" ? "หมวดเดียวกัน" : "Same subject group");
                                            return (
                                              <Button
                                                key={t.id}
                                                size="sm"
                                                variant="default"
                                                className="h-8 text-xs bg-primary text-primary-foreground"
                                                onClick={() => handlePickDraft(absentName, gap, t)}
                                                title={tip}
                                              >
                                                {sameSubject ? (
                                                  <Star className="w-3 h-3 mr-1 fill-current" />
                                                ) : (
                                                  <Sparkles className="w-3 h-3 mr-1" />
                                                )}
                                                ครู{t.first_name}
                                                <span className="ml-1 text-[9px] px-1 rounded bg-primary-foreground/20">
                                                  {sameSubject
                                                    ? (lang === "th" ? "วิชาเดียวกัน" : "Same subj.")
                                                    : (lang === "th" ? "หมวดเดียวกัน" : "Same group")}
                                                </span>
                                              </Button>
                                            );
                                          })}
                                          {rest.length > 0 && (
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button size="sm" variant="outline" className="h-8 text-xs">
                                                  {lang === "th" ? `เพิ่มเติม (+${rest.length})` : `More (+${rest.length})`}
                                                  <ChevronDown className="w-3 h-3 ml-1" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-72 p-0" align="end">
                                                <Command>
                                                  <CommandInput placeholder={lang === "th" ? "ค้นหาครู..." : "Search teacher..."} />
                                                  <CommandList>
                                                    <CommandEmpty>{lang === "th" ? "ไม่พบ" : "Not found"}</CommandEmpty>
                                                    <CommandGroup heading={lang === "th" ? `ครูว่างเพิ่มเติม ${rest.length} คน` : `${rest.length} more free teachers`}>
                                                      {rest.map(({ teacher: t, sameSubject, sameGroup }) => (
                                                        <CommandItem
                                                          key={t.id}
                                                          value={fullName(t)}
                                                          onSelect={() => handlePickDraft(absentName, gap, t)}
                                                        >
                                                          {sameSubject ? (
                                                            <Star className="w-3.5 h-3.5 mr-2 text-primary fill-current" />
                                                          ) : sameGroup ? (
                                                            <Sparkles className="w-3.5 h-3.5 mr-2 text-primary" />
                                                          ) : (
                                                            <UserCheck className="w-3.5 h-3.5 mr-2" />
                                                          )}
                                                          <span className="flex-1">{fullName(t)}</span>
                                                          {sameSubject && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                                                              {lang === "th" ? "วิชาเดียวกัน" : "Same subj."}
                                                            </span>
                                                          )}
                                                          {!sameSubject && sameGroup && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                                              {lang === "th" ? "หมวดเดียวกัน" : "Same group"}
                                                            </span>
                                                          )}
                                                        </CommandItem>
                                                      ))}
                                                    </CommandGroup>
                                                  </CommandList>
                                                </Command>
                                              </PopoverContent>
                                            </Popover>
                                          )}
                                        </div>
                                      );
                                    })()
                                  )}

                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Step 3 / advanced: free teachers grid (collapsed by default) */}
      {selectedDate && freeTeachersGrid.length > 0 && (
        <Collapsible>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3 flex flex-row items-center justify-between hover:bg-muted/30 transition-colors">
                <CardTitle className="text-sm flex items-center gap-2 font-medium text-muted-foreground">
                  <Grid3x3 className="w-4 h-4" />
                  {lang === "th" ? "ดูตารางครูว่างทุกคาบ (ขั้นสูง)" : "View all free teachers by period (advanced)"}
                </CardTitle>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{lang === "th" ? "คาบ" : "Period"}</TableHead>
                      <TableHead>{lang === "th" ? "ห้องเรียน" : "Classroom"}</TableHead>
                      <TableHead>{lang === "th" ? "วิชา / ครูประจำ" : "Subject / Teacher"}</TableHead>
                      <TableHead>{lang === "th" ? "ครูว่าง" : "Free Teachers"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freeTeachersGrid.map((row: any, idx: number) => {
                      const s = row.schedule;
                      return (
                        <TableRow key={`${s.id}-${idx}`} className={row.isAbsent ? "bg-warning/50 dark:bg-warning/20" : ""}>
                          <TableCell className="font-bold text-center">{row.period}</TableCell>
                          <TableCell className="text-sm">
                            {s.classrooms ? `${s.classrooms.grade_level} - ${s.classrooms.name}` : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">
                              {s.subjects?.code}{" "}
                              {s.subjects
                                ? lang === "th"
                                  ? s.subjects.name_th
                                  : s.subjects.name_en || s.subjects.name_th
                                : ""}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              {s.teacher_name || "-"}
                              {row.isAbsent && (
                                <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                                  {lang === "th" ? "ลา" : "Absent"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.freeTeachers.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {lang === "th" ? "ไม่มี" : "None"}
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="secondary" className="text-[10px]">
                                  {row.freeTeachers.length} {lang === "th" ? "คน" : "free"}
                                </Badge>
                                {row.freeTeachers.slice(0, 6).map((t: any) => (
                                  <Badge key={t.id} variant="outline" className="text-[10px] font-normal">
                                    {t.prefix || ""}{t.first_name} {t.last_name?.charAt(0)}.
                                  </Badge>
                                ))}
                                {row.freeTeachers.length > 6 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    +{row.freeTeachers.length - 6}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Summary */}
      <Collapsible defaultOpen>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="pb-3 flex flex-row items-center justify-between hover:bg-muted/30 transition-colors">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" />
                {lang === "th" ? "ประวัติการจัดสอนแทน" : "All Substitute Assignments"}
                <Badge variant="secondary" className="text-[10px]">{existingSubs.length}</Badge>
              </CardTitle>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "th" ? "วันที่" : "Date"}</TableHead>
                    <TableHead>{lang === "th" ? "ครูที่ลา" : "Original"}</TableHead>
                    <TableHead>{lang === "th" ? "ครูสอนแทน" : "Substitute"}</TableHead>
                    <TableHead>{lang === "th" ? "คาบ" : "Period"}</TableHead>
                    <TableHead>{lang === "th" ? "หลักฐาน" : "Proof"}</TableHead>
                    <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingSubs.map((r: any) => {
                    const thumb = proofThumbs[r.id];
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setDetailSub(r)}
                      >
                        <TableCell>{r.teaching_date}</TableCell>
                        <TableCell>{r.original_teacher}</TableCell>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {r.substitute_teacher}
                            {r.proof_photo_url && <ImageIcon className="w-3.5 h-3.5 text-success" />}
                          </span>
                        </TableCell>
                        <TableCell>{r.period}</TableCell>
                        <TableCell>
                          {r.proof_photo_url ? (
                            thumb ? (
                              <a
                                href={thumb}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-block"
                              >
                                <img
                                  src={thumb}
                                  alt="proof"
                                  className="w-14 h-14 rounded-md object-cover border hover:ring-2 hover:ring-primary transition"
                                />
                              </a>
                            ) : (
                              <div className="w-14 h-14 rounded-md border bg-muted animate-pulse" />
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[r.status] || ""}>{statusLabels[r.status]?.[lang === "th" ? "th" : "en"] || r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {existingSubs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {lang === "th" ? "ยังไม่มีรายการจัดสอนแทน" : "No substitute assignments yet"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sticky confirm bar — appears when there are draft picks */}
      {Object.keys(pendingPicks).length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(680px,calc(100vw-2rem))]">
          <div className="rounded-2xl border-2 border-primary/30 bg-background/95 backdrop-blur shadow-2xl p-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <div className="w-10 h-10 rounded-full bg-warning-soft dark:bg-warning text-warning dark:text-warning flex items-center justify-center font-bold">
                {Object.keys(pendingPicks).length}
              </div>
              <div>
                <div className="font-semibold text-sm">
                  {lang === "th" ? "รายการรอยืนยัน" : "Pending picks"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === "th"
                    ? "ตรวจสอบและกดยืนยันเพื่อบันทึก + ส่งแจ้งเตือนครู"
                    : "Review then confirm to save & notify"}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingPicks({})}
              disabled={confirming}
            >
              <X className="w-4 h-4 mr-1" />
              {lang === "th" ? "ล้างทั้งหมด" : "Clear"}
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={handleConfirmAll}
              disabled={confirming}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {confirming
                ? lang === "th" ? "กำลังยืนยัน..." : "Confirming..."
                : lang === "th"
                  ? `ยืนยันทั้งหมด (${Object.keys(pendingPicks).length})`
                  : `Confirm all (${Object.keys(pendingPicks).length})`}
            </Button>
          </div>
        </div>
      )}

      {/* Detail / Proof dialog */}
      <Dialog open={!!detailSub} onOpenChange={(o) => !o && setDetailSub(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-success" />
              {lang === "th" ? "รายละเอียดการสอนแทน" : "Substitute details"}
            </DialogTitle>
            <DialogDescription>
              {lang === "th" ? "คาบที่จัดสอนแทน ผู้สอนแทน และภาพหลักฐาน" : "Periods, substitute teachers, and proof photos"}
            </DialogDescription>
          </DialogHeader>
          {detailSub && (() => {
            const relatedSubs = existingSubs
              .filter((s: any) => s.teaching_date === detailSub.teaching_date && s.original_teacher === detailSub.original_teacher)
              .sort((a: any, b: any) => Number(a.period) - Number(b.period));
            const isPast = isPastDate(detailSub.teaching_date);

            // Find the original teacher's personnel record by name (to look up
            // their full schedule for that day-of-week).
            const origNorm = (detailSub.original_teacher || "").replace(/\s+/g, " ").trim();
            const origPerson = allPersonnel.find((p: any) =>
              nameVariants(p).some((v) => v === origNorm)
            );
            const dow = getDayOfWeek(detailSub.teaching_date);
            const daySchedules = allSchedules
              .filter((s: any) =>
                s.day_of_week === dow &&
                (origPerson
                  ? scheduleMatchesPerson(s.teacher_name, origPerson, s)
                  : (s.teacher_name || "").replace(/\s+/g, " ").trim() === origNorm)
              )
              .sort((a: any, b: any) => Number(a.period) - Number(b.period));

            // Merge: prefer the substitute_teaching row when one matches the
            // schedule (by period + classroom). Periods with no row are shown
            // as "ยังไม่ได้จัดสอนแทน".
            const usedSubIds = new Set<string>();
            const seenPeriods = new Set<string>();
            const periodItems = daySchedules
              .filter((s: any) => {
                const k = `${s.period}-${s.classroom_id}`;
                if (seenPeriods.has(k)) return false;
                seenPeriods.add(k);
                return true;
              })
              .map((s: any) => {
                const sub = relatedSubs.find(
                  (r: any) => !usedSubIds.has(r.id) && Number(r.period) === Number(s.period) && (!r.classroom_id || !s.classroom_id || r.classroom_id === s.classroom_id)
                );
                if (sub) usedSubIds.add(sub.id);
                return { schedule: s, sub };
              });

            // Any substitute rows not matched to a schedule (e.g. schedule was
            // changed after assignment) — still show them so nothing is lost.
            const orphanSubs = relatedSubs.filter((r: any) => !usedSubIds.has(r.id));

            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-[11px] text-muted-foreground">{lang === "th" ? "ครูที่ลา" : "Original"}</div>
                    <div className="font-medium">{detailSub.original_teacher}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-[11px] text-muted-foreground">{lang === "th" ? "วันที่สอนแทน" : "Date"}</div>
                    <div className="font-medium">{detailSub.teaching_date}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
                    <span>
                      {lang === "th"
                        ? `ทุกคาบของวันที่ลา (${periodItems.length} คาบ)`
                        : `All periods of leave day (${periodItems.length})`}
                    </span>
                    <span className="text-[10px]">
                      {lang === "th"
                        ? `จัดแล้ว ${periodItems.filter((p) => p.sub).length}/${periodItems.length}`
                        : `Assigned ${periodItems.filter((p) => p.sub).length}/${periodItems.length}`}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {periodItems.map(({ schedule: s, sub: r }) => {
                      const subj = s.subjects || r?.subjects;
                      const cls = s.classrooms || r?.classrooms;
                      const subjectLabel = subj ? (lang === "th" ? subj.name_th : subj.name_en || subj.name_th) : "-";
                      const classroomLabel = cls ? `${cls.grade_level} ${cls.name}` : "";
                      const isSelected = r && r.id === detailSub.id;
                      return (
                        <li
                          key={`${s.id}-${s.period}`}
                          onClick={() => r && setDetailSub(r)}
                          className={`rounded-lg border p-3 transition-all ${
                            r ? "cursor-pointer" : "opacity-90"
                          } ${isSelected ? "border-primary bg-primary/5" : r ? "hover:bg-muted/40" : "bg-muted/20"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center">
                              <div className="text-[10px] leading-none">{lang === "th" ? "คาบ" : "P."}</div>
                              <div className="text-lg font-bold leading-none mt-0.5">{s.period}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                {subj?.code && <span className="text-muted-foreground text-xs">{subj.code}</span>}
                                {subjectLabel}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <DoorOpen className="w-3.5 h-3.5" />
                                {classroomLabel || "-"}
                              </div>
                              {r ? (
                                <div className="text-xs mt-1 flex items-center gap-1.5 text-success dark:text-success">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  {r.substitute_teacher}
                                  {r.proof_photo_url && <ImageIcon className="w-3.5 h-3.5" />}
                                </div>
                              ) : (
                                <div className="text-xs mt-1 flex items-center gap-1.5 text-warning dark:text-warning">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {lang === "th" ? "ยังไม่ได้จัดสอนแทน" : "Not assigned yet"}
                                </div>
                              )}
                            </div>
                            {r ? (
                              <Badge className={statusColors[r.status] || ""}>
                                {statusLabels[r.status]?.[lang === "th" ? "th" : "en"] || r.status}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-warning border-warning/30">
                                {lang === "th" ? "ว่าง" : "Open"}
                              </Badge>
                            )}
                          </div>
                        </li>
                      );
                    })}

                    {periodItems.length === 0 && (
                      <li className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        {lang === "th"
                          ? "ไม่พบคาบสอนของครูที่ลาในวันนี้ (อาจไม่มีตารางสอน)"
                          : "No scheduled periods found for this teacher on this day"}
                      </li>
                    )}

                    {orphanSubs.map((r: any) => {
                      const subjectLabel = r.subjects ? (lang === "th" ? r.subjects.name_th : r.subjects.name_en || r.subjects.name_th) : "-";
                      const classroomLabel = r.classrooms ? `${r.classrooms.grade_level} ${r.classrooms.name}` : "";
                      const isSelected = r.id === detailSub.id;
                      return (
                        <li
                          key={r.id}
                          onClick={() => setDetailSub(r)}
                          className={`rounded-lg border p-3 cursor-pointer transition-all ${
                            isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center">
                              <div className="text-[10px] leading-none">{lang === "th" ? "คาบ" : "P."}</div>
                              <div className="text-lg font-bold leading-none mt-0.5">{r.period}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                {subjectLabel}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <DoorOpen className="w-3.5 h-3.5" />
                                {classroomLabel || "-"}
                              </div>
                              <div className="text-xs mt-1 flex items-center gap-1.5 text-success dark:text-success">
                                <UserCheck className="w-3.5 h-3.5" />
                                {r.substitute_teacher}
                              </div>
                            </div>
                            <Badge className={statusColors[r.status] || ""}>
                              {statusLabels[r.status]?.[lang === "th" ? "th" : "en"] || r.status}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    {lang === "th"
                      ? `ภาพหลักฐาน — คาบ ${detailSub.period}`
                      : `Proof photo — Period ${detailSub.period}`}
                  </div>
                  {detailPhotoUrl ? (
                    <a href={detailPhotoUrl} target="_blank" rel="noreferrer" className="block">
                      <img src={detailPhotoUrl} alt="proof" className="w-full max-h-72 object-cover rounded-lg border" />
                    </a>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed p-6 text-center text-xs text-muted-foreground">
                      {lang === "th" ? "ยังไม่มีภาพหลักฐาน" : "No proof uploaded yet"}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadProof(f);
                      e.target.value = "";
                    }}
                  />
                  {isPast ? (
                    <div className="mt-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      {lang === "th"
                        ? "เลยวันสอนแทนแล้ว — อัปโหลดหลักฐานย้อนหลังไม่ได้"
                        : "Date has passed — cannot upload proof retroactively"}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingProof}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      {uploadingProof
                        ? (lang === "th" ? "กำลังอัปโหลด..." : "Uploading...")
                        : detailPhotoUrl
                          ? (lang === "th" ? "เปลี่ยนภาพ" : "Replace photo")
                          : (lang === "th" ? "ถ่ายภาพ/อัปโหลดหลักฐาน" : "Take/upload proof photo")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetailSub(null)}>
              {lang === "th" ? "ปิด" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default SubstitutePage;
