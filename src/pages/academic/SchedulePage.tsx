import { Fragment, useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useParentChildren } from "@/hooks/useParentChildren";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Time24Input } from "@/components/ui/time24-input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Calendar, Wand2, Settings, Lock, UtensilsCrossed, Pin, User, Upload } from "lucide-react";
import { TeacherScheduleImportDialog } from "@/components/academic/TeacherScheduleImportDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateAutoSchedule, buildSubjectEntries } from "@/lib/autoScheduler";
import type { ActivityLock } from "@/lib/autoScheduler";
import { buildPeriodSlots } from "@/lib/periodSchedule";
import { saveErrorMessage } from "@/lib/saveError";

const days = [
  { th: "จันทร์", en: "Mon", val: 1 },
  { th: "อังคาร", en: "Tue", val: 2 },
  { th: "พุธ", en: "Wed", val: 3 },
  { th: "พฤหัสบดี", en: "Thu", val: 4 },
  { th: "ศุกร์", en: "Fri", val: 5 },
];

const normalizeTeacherName = (value?: string | null) =>
  (value || "")
    .replace(/^(ครู|นาย|นางสาว|นาง|น\.ส\.|ดร\.|อ\.)\s*/, "")
    .replace(/[์\-\s]/g, "")
    .trim();

const getPersonnelFullName = (person: any) =>
  `${person?.prefix || ""}${person?.first_name || ""} ${person?.last_name || ""}`.trim();

const SchedulePage = () => {
  const { lang } = useLanguage();
  const { isAdmin: _rawAdmin, isDirector, isTeacher, isStudent, isParent, userId } = useUserRole();
  const isAdmin = _rawAdmin || isDirector;
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"classroom" | "mySchedule">(isTeacher ? "mySchedule" : "classroom");
  const [filterClass, setFilterClass] = useState("");

  // Parent: resolve linked children
  const { children: parentChildren } = useParentChildren();

  // For students: find their classroom by auth_user_id. Parents use first linked child.
  const { data: myStudentRecord } = useQuery({
    queryKey: ["my_student_classroom", userId, isParent, parentChildren?.[0]?.id],
    enabled: !!userId && (isStudent || isParent),
    queryFn: async () => {
      if (isParent) {
        return parentChildren?.[0] ? { id: parentChildren[0].id, classroom_id: parentChildren[0].classroom_id } : null;
      }
      const { data } = await supabase
        .from("students")
        .select("id, classroom_id")
        .eq("auth_user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if ((isStudent || isParent) && myStudentRecord?.classroom_id) {
      setViewMode("classroom");
      setFilterClass(myStudentRecord.classroom_id);
    }
  }, [isStudent, isParent, myStudentRecord]);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>("");

  // Fetch teacher's personnel record for "my schedule" view
  const { data: myPersonnel } = useQuery({
    queryKey: ["my_personnel", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  // Fetch all personnel for admin's teacher selector
  const { data: allPersonnel = [] } = useQuery({
    queryKey: ["all_personnel_for_schedule"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name")
        .eq("status", "active")
        .order("first_name");
      return data || [];
    },
  });

  const myTeacherName = useMemo(() => {
    if (!myPersonnel) return null;
    return getPersonnelFullName(myPersonnel);
  }, [myPersonnel]);

  // Effective teacher name in "mySchedule" mode: admin uses selector, others use own personnel
  const effectiveTeacherName = useMemo(() => {
    if (isAdmin && selectedTeacherName) return selectedTeacherName;
    return myTeacherName;
  }, [isAdmin, selectedTeacherName, myTeacherName]);

  // Personnel id for matching schedules.teacher_id (preferred over name matching)
  const effectiveTeacherId = useMemo(() => {
    if (isAdmin && selectedTeacherName) {
      const p = allPersonnel.find((x: any) =>
        getPersonnelFullName(x) === selectedTeacherName
      );
      return p?.id || null;
    }
    return myPersonnel?.id || null;
  }, [isAdmin, selectedTeacherName, allPersonnel, myPersonnel]);

  const effectiveTeacherFirstName = useMemo(() => {
    if (isAdmin && selectedTeacherName) {
      const p = allPersonnel.find((x: any) => getPersonnelFullName(x) === selectedTeacherName);
      return p?.first_name || null;
    }
    return myPersonnel?.first_name || null;
  }, [isAdmin, selectedTeacherName, allPersonnel, myPersonnel]);



  const [filterSemester, setFilterSemester] = useState<number>(1);
  const [cellDialog, setCellDialog] = useState<{ day: number; period: number } | null>(null);
  const [savingCell, setSavingCell] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("1");

  const [autoScheduling, setAutoScheduling] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activityLockOpen, setActivityLockOpen] = useState(false);
  const [periodsInput, setPeriodsInput] = useState("");
  const [lunchInput, setLunchInput] = useState("");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [periodMinInput, setPeriodMinInput] = useState("");
  const [lunchMinInput, setLunchMinInput] = useState("");

  const { data: periodsPerDay = 8 } = useQuery({
    queryKey: ["school_settings", "periods_per_day"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", "periods_per_day")
        .maybeSingle();
      return parseInt(data?.setting_value || "8") || 8;
    },
  });

  const { data: lunchAfterPeriod = 4 } = useQuery({
    queryKey: ["school_settings", "lunch_after_period"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", "lunch_after_period")
        .maybeSingle();
      return parseInt(data?.setting_value || "4") || 4;
    },
  });

  const { data: scheduleTimes = { start: "08:30", periodMin: 50, lunchMin: 60 } } = useQuery({
    queryKey: ["school_settings", "schedule_times"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["period_start_time", "period_duration_min", "lunch_duration_min"]);
      const m: Record<string, string> = {};
      (data || []).forEach((r: any) => { if (r.setting_value != null) m[r.setting_key] = r.setting_value; });
      return {
        start: (m.period_start_time || "08:30").slice(0, 5),
        periodMin: parseInt(m.period_duration_min || "") || 50,
        lunchMin: parseInt(m.lunch_duration_min || "") || 60,
      };
    },
  });

  // Load saved activity locks from school_settings
  const { data: savedActivityLocks = [] } = useQuery({
    queryKey: ["school_settings", "activity_locks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", "activity_locks")
        .maybeSingle();
      try {
        return data?.setting_value ? JSON.parse(data.setting_value) as ActivityLock[] : [];
      } catch {
        return [];
      }
    },
  });

  const [localLocks, setLocalLocks] = useState<Record<string, { day: string; period: string }>>({});

  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("*").order("code");
      return data || [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["teacher_assignments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teacher_assignments")
        .select("*, personnel(*), subjects(*), classrooms(*)")
        .order("created_at");
      return data || [];
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules", filterSemester],
    queryFn: async () => {
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .eq("semester", filterSemester)
        .order("day_of_week")
        .order("period");
      return data || [];
    },
  });

  // ===== This week's special-room bookings overlay =====
  const weekRange = useMemo(() => {
    const today = new Date();
    const dow = today.getDay() || 7; // Sun=7
    const mon = new Date(today);
    mon.setDate(today.getDate() - dow + 1);
    mon.setHours(0, 0, 0, 0);
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { start: iso(mon), end: iso(fri), mon };
  }, []);

  const { data: weekRoomBookings = [] } = useQuery({
    queryKey: ["schedule_week_bookings", weekRange.start, weekRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_center_bookings")
        .select("id, booking_date, period, teacher_id, teacher_name, classroom_id, room_id, special_rooms(name)")
        .eq("status", "confirmed")
        .gte("booking_date", weekRange.start)
        .lte("booking_date", weekRange.end);
      return data || [];
    },
  });

  // Realtime — keep schedule overlay in sync with new bookings
  useEffect(() => {
    const ch = supabase
      .channel("schedule-lcb-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "learning_center_bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["schedule_week_bookings"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Build day-of-week + period lookup, filtered to context
  const bookingByDayPeriod = useMemo(() => {
    const map: Record<string, any[]> = {};
    weekRoomBookings.forEach((b: any) => {
      if (!b.period) return;
      // Context filter — mySchedule: only my (or selected) teacher; classroom: only that class
      if (viewMode === "mySchedule") {
        if (effectiveTeacherId && b.teacher_id !== effectiveTeacherId) return;
      } else if (viewMode === "classroom") {
        if (filterClass && filterClass !== "all" && b.classroom_id !== filterClass) return;
      }
      const d = new Date(b.booking_date + "T00:00:00");
      const dow = d.getDay() || 7; // 1..5 for Mon..Fri
      if (dow > 5) return;
      const key = `${dow}-${b.period}`;
      (map[key] = map[key] || []).push(b);
    });
    return map;
  }, [weekRoomBookings, viewMode, effectiveTeacherId, filterClass]);


  const teacherOptions = useMemo(() => {
    const realTeacherFirstNames = new Set(
      allPersonnel
        .filter((p: any) => p.last_name && p.last_name !== "-" && !normalizeTeacherName(p.first_name).includes("ไม่ระบุ"))
        .map((p: any) => normalizeTeacherName(p.first_name))
    );
    const scheduledTeacherIds = new Set(schedules.map((s: any) => s.teacher_id).filter(Boolean));

    return allPersonnel.filter((p: any) => {
      const firstNameKey = normalizeTeacherName(p.first_name);
      if (!firstNameKey || firstNameKey.includes("ไม่ระบุ")) return false;

      const isProxyTeacher = !p.last_name || p.last_name === "-";
      if (isProxyTeacher && realTeacherFirstNames.has(firstNameKey) && !scheduledTeacherIds.has(p.id)) return false;
      if (isProxyTeacher && !scheduledTeacherIds.has(p.id)) return false;

      return true;
    });
  }, [allPersonnel, schedules]);

  useEffect(() => {
    if (selectedTeacherName && !teacherOptions.some((p: any) => getPersonnelFullName(p) === selectedTeacherName)) {
      setSelectedTeacherName("");
    }
  }, [selectedTeacherName, teacherOptions]);

  // Activity subjects (unique by subject_id)
  const activitySubjects = useMemo(() => {
    return subjects.filter((s: any) => s.subject_type === "activity");
  }, [subjects]);

  // Deduplicate activity subjects by code (same subject across grade levels)
  const uniqueActivitySubjects = useMemo(() => {
    const seen = new Map<string, any>();
    activitySubjects.forEach((s: any) => {
      if (!seen.has(s.code)) seen.set(s.code, s);
    });
    return Array.from(seen.values());
  }, [activitySubjects]);

  // Set default view mode when role loads
  useEffect(() => {
    if (isTeacher && !isAdmin) {
      setViewMode("mySchedule");
    }
  }, [isTeacher, isAdmin]);

  const filtered = useMemo(() => {
    if (viewMode === "mySchedule") {
      if (!effectiveTeacherId && !effectiveTeacherName) return [];
      const normalizedFullName = normalizeTeacherName(effectiveTeacherName);
      const normalizedFirstName = normalizeTeacherName(effectiveTeacherFirstName);
      return schedules.filter((s: any) => {
        if (effectiveTeacherId && s.teacher_id === effectiveTeacherId) return true;
        if (s.teacher_name) {
          const normalizedScheduleName = normalizeTeacherName(s.teacher_name);
          if (normalizedFullName && normalizedScheduleName === normalizedFullName) return true;
          if (normalizedFirstName && (
            normalizedScheduleName === normalizedFirstName ||
            normalizedScheduleName.startsWith(normalizedFirstName) ||
            normalizedFirstName.startsWith(normalizedScheduleName)
          )) return true;
        }
        return false;
      });
    }
    if (filterClass && filterClass !== "all") {
      return schedules.filter((s: any) => s.classroom_id === filterClass);
    }
    // Students/parents: never show all classes mixed together
    if (isStudent || isParent) return [];
    return schedules;
  }, [viewMode, effectiveTeacherId, effectiveTeacherName, effectiveTeacherFirstName, filterClass, schedules, isStudent, isParent]);

  // ===== Double-period (คาบคู่) helpers =====
  const spanOf = (s: any) => Math.max(1, Math.min(4, Number(s?.duration_periods) || 1));

  /** item ที่ "เริ่ม" ที่ช่องนี้ */
  const startingAt = (day: number, period: number) =>
    filtered.find((s: any) => s.day_of_week === day && s.period === period);

  /** item ที่ "คร่อม" ช่องนี้อยู่ (แต่ไม่ได้เริ่มที่นี่) — ไม่ต้องวาด td */
  const coveredBy = (day: number, period: number) =>
    filtered.find(
      (s: any) =>
        s.day_of_week === day && s.period < period && s.period + spanOf(s) > period
    );

  /** จำนวนคาบติดกันสูงสุดที่วางได้จากคาบนี้ (ไม่ข้ามพักเที่ยง / ไม่ชนคาบอื่น) */
  const maxSpanFrom = (day: number, period: number) => {
    let max = 1;
    for (let n = 1; n <= 4; n++) {
      const p = period + n;
      if (p > periodsPerDay) break;
      if (period + n - 1 === lunchAfterPeriod) break; // ห้ามคร่อมพักเที่ยง
      if (startingAt(day, p) || coveredBy(day, p)) break;
      max = n + 1;
    }
    return max;
  };




  const getSubjectName = (sid: string) => {
    const s = subjects.find((x: any) => x.id === sid);
    return s ? (lang === "th" ? s.name_th : s.name_en || s.name_th) : "";
  };

  const getSubjectCode = (sid: string) => {
    const s = subjects.find((x: any) => x.id === sid);
    return s?.code || "";
  };

  const getSubjectType = (sid: string) => {
    const s = subjects.find((x: any) => x.id === sid);
    return s?.subject_type || "required";
  };

  const handleCellClick = (day: number, period: number) => {
    if (!isAdmin) {
      toast.info(lang === "th" ? "เฉพาะ Admin เท่านั้นที่สามารถแก้ไขตารางได้" : "Only Admin can edit schedules");
      return;
    }
    if (!filterClass || filterClass === "all") {
      toast.info(lang === "th" ? "กรุณาเลือกห้องเรียนก่อน" : "Please select a classroom first");
      return;
    }
    const existing = filtered.find((s: any) => s.day_of_week === day && s.period === period);
    if (existing) return;
    setCellDialog({ day, period });
    setSelectedSubject("");
    setSelectedRoom("");
    setSelectedDuration("1");

  };

  const getClassroomSubjects = () => {
    if (!filterClass || filterClass === "all") return [];
    const classroom = classrooms.find((c: any) => c.id === filterClass);
    if (!classroom) return [];
    return subjects.filter((s: any) =>
      s.grade_level === classroom.grade_level &&
      (s.semester === 0 || s.semester === filterSemester || s.semester == null)
    );
  };

  const handleAssignToCell = async () => {
    if (!cellDialog || !selectedSubject || savingCell) return;
    setSavingCell(true);
    try {
      const assignment = assignments.find(
        (a: any) => a.subject_id === selectedSubject && a.classroom_id === filterClass
      );
      const teacherName = assignment?.personnel
        ? `${assignment.personnel.prefix || ""}${assignment.personnel.first_name} ${assignment.personnel.last_name}`
        : "";
      const { error } = await supabase.from("schedules").insert({
        classroom_id: filterClass,
        subject_id: selectedSubject,
        day_of_week: cellDialog.day,
        period: cellDialog.period,
        teacher_name: teacherName || null,
        teacher_id: assignment?.personnel?.id || null,
        semester: filterSemester,
        room: selectedRoom.trim() || null,
        duration_periods: Math.max(1, Math.min(maxSpanFrom(cellDialog.day, cellDialog.period), parseInt(selectedDuration) || 1)),

      } as any);

      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success(lang === "th" ? "เพิ่มคาบเรียนสำเร็จ" : "Period added");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setCellDialog(null);
    } finally {
      setSavingCell(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.info(lang === "th" ? "เฉพาะ Admin เท่านั้น" : "Admin only");
      return;
    }
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["schedules"] });
  };

  const handleAutoSchedule = async () => {
    if (!isAdmin) return;

    const targetClassroomIds = filterClass && filterClass !== "all"
      ? [filterClass]
      : classrooms.map((c: any) => c.id);

    if (targetClassroomIds.length === 0) {
      toast.error("ไม่มีห้องเรียน");
      return;
    }

    const targetClassroomObjs = classrooms.filter((c: any) => targetClassroomIds.includes(c.id));
    const entries = buildSubjectEntries(targetClassroomObjs, subjects, assignments, filterSemester);

    if (entries.length === 0) {
      toast.error(lang === "th" ? "ไม่พบรายวิชาสำหรับห้องเรียนที่เลือก" : "No subjects found for selected classrooms");
      return;
    }

    setAutoScheduling(true);
    try {
      for (const cid of targetClassroomIds) {
        const { error: delErr } = await supabase.from("schedules").delete().eq("classroom_id", cid).eq("semester", filterSemester);
        if (delErr) throw delErr;
      }

      // Build activity locks: expand code-based locks to all matching subject IDs
      const expandedLocks: ActivityLock[] = [];
      savedActivityLocks.forEach((lock: ActivityLock) => {
        // Find the locked subject's code
        const lockedSubj = subjects.find((s: any) => s.id === lock.subject_id);
        if (!lockedSubj) return;
        // Find all subjects with same code (across grade levels)
        const matchingSubjects = subjects.filter((s: any) => s.code === (lockedSubj as any).code);
        matchingSubjects.forEach((ms: any) => {
          expandedLocks.push({
            subject_id: ms.id,
            day_of_week: lock.day_of_week,
            start_period: lock.start_period,
          });
        });
      });

      const newSlots = generateAutoSchedule(
        entries,
        targetClassroomIds,
        periodsPerDay,
        [],
        expandedLocks
      );

      if (newSlots.length === 0) {
        toast.error("ไม่สามารถจัดตารางได้");
        return;
      }

      for (let i = 0; i < newSlots.length; i += 50) {
        const batch = newSlots.slice(i, i + 50).map((slot) => ({ ...slot, semester: filterSemester }));
        const { error } = await supabase.from("schedules").insert(batch);
        if (error) throw error;
      }

      toast.success(`จัดตารางอัตโนมัติสำเร็จ ${newSlots.length} คาบ สำหรับ ${targetClassroomIds.length} ห้อง`);
      qc.invalidateQueries({ queryKey: ["schedules"] });
    } catch (err: any) {
      toast.error(saveErrorMessage(err));
    } finally {
      setAutoScheduling(false);
    }
  };

  const handleSaveSettings = async () => {
    const val = parseInt(periodsInput);
    if (!val || val < 1 || val > 15) {
      toast.error("กรุณากรอกจำนวนคาบ 1-15");
      return;
    }
    const lunchVal = parseInt(lunchInput);
    if (!lunchVal || lunchVal < 1 || lunchVal >= val) {
      toast.error("กรุณากรอกคาบพักที่ถูกต้อง");
      return;
    }
    const periodMin = parseInt(periodMinInput) || 50;
    const lunchMin = parseInt(lunchMinInput) || 60;
    if (periodMin < 10 || periodMin > 180) { toast.error("ความยาวคาบควรอยู่ระหว่าง 10-180 นาที"); return; }
    if (lunchMin < 10 || lunchMin > 180) { toast.error("ระยะพักเที่ยงควรอยู่ระหว่าง 10-180 นาที"); return; }
    const startTime = (startTimeInput || "08:30").slice(0, 5);
    const upserts = [
      { setting_key: "periods_per_day", setting_value: String(val) },
      { setting_key: "lunch_after_period", setting_value: String(lunchVal) },
      { setting_key: "period_start_time", setting_value: startTime },
      { setting_key: "period_duration_min", setting_value: String(periodMin) },
      { setting_key: "lunch_duration_min", setting_value: String(lunchMin) },
    ];
    const { error } = await supabase.from("school_settings").upsert(upserts, { onConflict: "setting_key" });
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("บันทึกการตั้งค่าสำเร็จ");
    qc.invalidateQueries({ queryKey: ["school_settings"] });
    qc.invalidateQueries({ queryKey: ["period_schedule_config"] });
    setSettingsOpen(false);
  };

  // Open activity lock dialog with current saved values
  const openActivityLockDialog = () => {
    const initial: Record<string, { day: string; period: string }> = {};
    savedActivityLocks.forEach((lock: ActivityLock) => {
      initial[lock.subject_id] = {
        day: String(lock.day_of_week),
        period: String(lock.start_period),
      };
    });
    setLocalLocks(initial);
    setActivityLockOpen(true);
  };

  const handleSaveActivityLocks = async () => {
    const locks: ActivityLock[] = [];
    Object.entries(localLocks).forEach(([subjectId, val]) => {
      const day = parseInt(val.day);
      const period = parseInt(val.period);
      if (day && period) {
        locks.push({ subject_id: subjectId, day_of_week: day, start_period: period });
      }
    });

    const { error } = await supabase
      .from("school_settings")
      .upsert(
        { setting_key: "activity_locks", setting_value: JSON.stringify(locks) },
        { onConflict: "setting_key" }
      );

    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("บันทึกการล็อควันกิจกรรมสำเร็จ");
    qc.invalidateQueries({ queryKey: ["school_settings", "activity_locks"] });
    setActivityLockOpen(false);
  };

  const cellBgClass = (subjectType: string) => {
    switch (subjectType) {
      case "activity": return "bg-orange-50 dark:bg-orange-950/20";
      case "elective": return "bg-blue-50 dark:bg-blue-950/20";
      default: return "bg-primary/5";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            {lang === "th" ? "ตารางเรียน-ตารางสอน" : "Class Schedule"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === "mySchedule" && effectiveTeacherName
              ? `ตารางสอนของ ${effectiveTeacherName}`
              : viewMode === "mySchedule" && isAdmin
                ? (lang === "th" ? "เลือกครูเพื่อดูตารางสอน" : "Select a teacher to view schedule")
                : lang === "th"
                  ? isAdmin
                    ? "กดจัดอัตโนมัติหรือคลิกช่องว่างเพื่อเพิ่มวิชา"
                    : "ดูตารางเรียนตามห้องเรียน"
                  : isAdmin
                    ? "Auto-generate or click empty cells to assign"
                    : "View class schedule"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle - teachers + admin */}
          {(myPersonnel || isAdmin) && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "classroom" | "mySchedule")} className="mr-2">
              <TabsList className="h-9">
                <TabsTrigger value="mySchedule" className="text-xs gap-1">
                  <User className="w-3.5 h-3.5" />
                  {isAdmin && !myPersonnel ? "ตารางสอนครู" : "ตารางสอนของฉัน"}
                </TabsTrigger>
                <TabsTrigger value="classroom" className="text-xs gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  ตารางห้องเรียน
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setPeriodsInput(String(periodsPerDay)); setLunchInput(String(lunchAfterPeriod)); setStartTimeInput(scheduleTimes.start); setPeriodMinInput(String(scheduleTimes.periodMin)); setLunchMinInput(String(scheduleTimes.lunchMin)); setSettingsOpen(true); }}>
                <Settings className="w-4 h-4 mr-1" />
                {periodsPerDay} คาบ/วัน
              </Button>
              <Button variant="outline" size="sm" onClick={openActivityLockDialog}>
                <Pin className="w-4 h-4 mr-1" />
                {lang === "th" ? "ล็อควันกิจกรรม" : "Lock Activities"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-1" />
                {lang === "th" ? "นำเข้าตารางสอน" : "Import Schedule"}
              </Button>
              <Button
                onClick={handleAutoSchedule}
                disabled={autoScheduling}
                className="gap-1.5"
              >
                <Wand2 className="w-4 h-4" />
                {autoScheduling
                  ? "กำลังจัด..."
                  : filterClass && filterClass !== "all"
                    ? "จัดตารางห้องนี้"
                    : "จัดตารางทั้งหมด"}
              </Button>
            </>
          )}
          <Select value={String(filterSemester)} onValueChange={(v) => setFilterSemester(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{lang === "th" ? "เทอม 1" : "Semester 1"}</SelectItem>
              <SelectItem value="2">{lang === "th" ? "เทอม 2" : "Semester 2"}</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === "mySchedule" && isAdmin && (
            <Select value={selectedTeacherName} onValueChange={setSelectedTeacherName}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={lang === "th" ? "เลือกครู" : "Select teacher"} />
              </SelectTrigger>
              <SelectContent>
                {teacherOptions.map((p: any) => {
                  const name = getPersonnelFullName(p);
                  return (
                    <SelectItem key={p.id} value={name}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          {viewMode === "classroom" && !isStudent && !isParent && (
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={lang === "th" ? "เลือกห้องเรียน" : "Select classroom"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "th" ? "ทั้งหมด" : "All"}</SelectItem>
                {classrooms.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Activity lock badges */}
      {savedActivityLocks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Pin className="w-3 h-3" /> ล็อควันกิจกรรม:
          </span>
          {savedActivityLocks.map((lock: ActivityLock) => {
            const subj = subjects.find((s: any) => s.id === lock.subject_id);
            const dayLabel = days.find((d) => d.val === lock.day_of_week);
            return subj ? (
              <Badge key={lock.subject_id} variant="secondary" className="text-[10px]">
                {(subj as any).name_th} → {dayLabel?.th || ""} คาบ {lock.start_period}
              </Badge>
            ) : null;
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-primary/10 border" /> วิชาพื้นฐาน</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-950/40 border" /> วิชาเพิ่มเติม</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-950/40 border" /> กิจกรรมพัฒนาผู้เรียน</div>
        {!isAdmin && <div className="flex items-center gap-1 text-muted-foreground"><Lock className="w-3 h-3" /> Admin เท่านั้นที่แก้ไขได้</div>}
      </div>

      <Card>
        <CardContent className="p-2 md:p-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted/50 text-xs font-bold w-16">
                    {lang === "th" ? "คาบ" : "Period"}
                  </th>
                  {days.map((d) => (
                    <th key={d.val} className="border border-border p-2 bg-muted/50 text-xs font-bold text-center min-w-[120px]">
                      {lang === "th" ? d.th : d.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <Fragment key={`period-${p}`}>
                    {p - 1 === lunchAfterPeriod && (
                      <tr key={`lunch-${p}`}>
                        <td
                          colSpan={days.length + 1}
                          className="border border-border p-2 text-center bg-amber-50 dark:bg-amber-950/20"
                        >
                          <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                            <UtensilsCrossed className="w-4 h-4" />
                            {lang === "th" ? "พักรับประทานอาหารกลางวัน" : "Lunch Break"}
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr key={p}>
                      <td className="border border-border p-2 text-center font-semibold text-sm bg-muted/30">
                        {p}
                      </td>
                      {days.map((d) => {
                        if (coveredBy(d.val, p)) return null; // ถูกคาบคู่ครอบอยู่แล้ว
                        const item = startingAt(d.val, p);
                        const span = item ? spanOf(item) : 1;
                        const subType = item ? getSubjectType(item.subject_id) : "";
                        const roomBookings = bookingByDayPeriod[`${d.val}-${p}`] || [];
                        return (
                          <td
                            key={`${d.val}-${p}`}
                            rowSpan={span > 1 ? span : undefined}
                            className={`border border-border p-1 text-center align-top transition-colors ${
                              item
                                ? cellBgClass(subType)
                                : isAdmin
                                  ? "hover:bg-accent/50 cursor-pointer"
                                  : ""
                            }`}
                            onClick={() => !item && handleCellClick(d.val, p)}
                          >

                            {item ? (
                              <div className="relative group min-h-[50px]">
                                {(() => {
                                  const code = getSubjectCode(item.subject_id);
                                  const isProxy = code.startsWith("IMP-") || code.startsWith("T-") || code.startsWith("AUTO-");
                                  const showCode = code && !isProxy;
                                  return showCode ? (
                                     <div className="text-xs font-bold text-primary truncate text-center">{code}</div>
                                  ) : null;
                                })()}
                                <div className="text-xs font-semibold text-foreground truncate text-center" title={getSubjectName(item.subject_id) || item.subject_name_raw || ""}>
                                  {getSubjectName(item.subject_id) || item.subject_name_raw || ""}
                                  {!item.subject_id && item.subject_name_raw && (
                                    <span className="ml-1 text-[9px] text-amber-600">(ยังไม่จับคู่)</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate text-center">
                                  {viewMode === "mySchedule"
                                    ? classrooms.find((c: any) => c.id === item.classroom_id)?.name || ""
                                    : item.teacher_name}
                                </div>
                                {(viewMode !== "mySchedule") && (
                                  <div className="text-[10px] text-sky-700 dark:text-sky-400 truncate text-center" title="ห้องเรียน">
                                    🏷️ {classrooms.find((c: any) => c.id === item.classroom_id)?.name || "-"}
                                  </div>
                                )}
                                {item.room && (
                                  <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 truncate text-center" title={item.room}>
                                    📍 {item.room}
                                  </div>
                                )}
                                {span > 1 && (
                                  <div className="text-[10px] font-semibold text-fuchsia-600 dark:text-fuchsia-400 text-center">
                                    ⧉ คาบคู่ ({item.period}-{item.period + span - 1})
                                  </div>
                                )}

                                {roomBookings.map((b: any) => (
                                  <div
                                    key={b.id}
                                    className="mt-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 truncate text-center border-t border-emerald-200 dark:border-emerald-900 pt-0.5"
                                    title={`จองห้อง ${b.special_rooms?.name || ""} โดย ${b.teacher_name} (${b.booking_date})`}
                                  >
                                    🏫 {b.special_rooms?.name || "ห้องพิเศษ"} · {b.teacher_name}
                                  </div>
                                ))}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute top-0 right-0 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(item.id);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ) : roomBookings.length > 0 ? (
                              <div className="min-h-[50px] space-y-0.5 py-1">
                                {roomBookings.map((b: any) => (
                                  <div
                                    key={b.id}
                                    className="text-[10px] rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-1 py-0.5"
                                    title={`จองห้อง ${b.special_rooms?.name || ""} โดย ${b.teacher_name}`}
                                  >
                                    <div className="font-semibold text-emerald-700 dark:text-emerald-400 truncate">🏫 {b.special_rooms?.name || "ห้องพิเศษ"}</div>
                                    <div className="text-[9px] text-muted-foreground truncate">{b.teacher_name}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="min-h-[50px] flex items-center justify-center">
                                {isAdmin && <span className="text-muted-foreground/30 text-xs">+</span>}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cell assignment dialog */}
      <Dialog open={!!cellDialog} onOpenChange={(open) => !open && setCellDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lang === "th" ? "เลือกวิชาสำหรับ" : "Select subject for"}{" "}
              {cellDialog && (
                <span className="text-primary">
                  {lang === "th"
                    ? days.find((d) => d.val === cellDialog.day)?.th
                    : days.find((d) => d.val === cellDialog.day)?.en}{" "}
                  {lang === "th" ? `คาบ ${cellDialog.period}` : `Period ${cellDialog.period}`}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const classSubjects = getClassroomSubjects();
              if (classSubjects.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {lang === "th"
                      ? "ยังไม่มีวิชาสำหรับระดับชั้นนี้ กรุณาเพิ่มวิชาก่อน"
                      : "No subjects for this grade level. Please add subjects first."}
                  </p>
                );
              }
              return (
                <>
                  <div>
                    <Label>{lang === "th" ? "เลือกวิชา" : "Select Subject"}</Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger>
                        <SelectValue placeholder={lang === "th" ? "เลือกวิชา" : "Select subject"} />
                      </SelectTrigger>
                      <SelectContent>
                        {classSubjects.map((s: any) => {
                          const assignment = assignments.find(
                            (a: any) => a.subject_id === s.id && a.classroom_id === filterClass
                          );
                          const teacherName = assignment?.personnel
                            ? `${assignment.personnel.prefix || ""}${assignment.personnel.first_name}`
                            : null;
                          return (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{s.code}</span>
                                <span>{s.name_th}</span>
                                {teacherName && (
                                  <Badge variant="outline" className="text-[10px] ml-1">
                                    {teacherName}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {lang === "th"
                        ? "ครูผู้สอนจะถูกใส่อัตโนมัติหากมีการมอบหมายแล้ว"
                        : "Teacher will be auto-filled if assigned"}
                    </p>
                  </div>
                  <div>
                    <Label>{lang === "th" ? "ห้องที่ใช้สอน (ไม่บังคับ)" : "Room (optional)"}</Label>
                    <Input
                      value={selectedRoom}
                      onChange={(e) => setSelectedRoom(e.target.value)}
                      placeholder={lang === "th" ? "เช่น Learning Center, ห้องคอมฯ 1" : "e.g. Learning Center"}
                    />
                  </div>
                  {cellDialog && (
                    <div>
                      <Label>{lang === "th" ? "จำนวนคาบติดกัน (คาบคู่)" : "Consecutive periods"}</Label>
                      <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: maxSpanFrom(cellDialog.day, cellDialog.period) }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 1 ? (lang === "th" ? "1 คาบ (ปกติ)" : "1 period") : `${n} ${lang === "th" ? "คาบติดกัน" : "periods"} (${cellDialog.period}-${cellDialog.period + n - 1})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lang === "th" ? "คาบคู่จะไม่ข้ามพักกลางวันและไม่ทับคาบอื่น" : "Double periods never cross lunch or overlap"}
                      </p>
                    </div>
                  )}

                  <Button onClick={handleAssignToCell} className="w-full" disabled={!selectedSubject || savingCell}>
                    {savingCell ? (lang === "th" ? "กำลังบันทึก..." : "Saving...") : (lang === "th" ? "บันทึก" : "Save")}
                  </Button>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ตั้งค่าตารางเรียน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>จำนวนคาบต่อวัน</Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={periodsInput}
                onChange={(e) => setPeriodsInput(e.target.value)}
              />
            </div>
            <div>
              <Label>พักกลางวันหลังคาบที่</Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={lunchInput}
                onChange={(e) => setLunchInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                เช่น ใส่ 4 = พักหลังคาบที่ 4
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label>เริ่มคาบแรก</Label>
                <Time24Input withSeconds={false} value={startTimeInput} onChange={(v) => setStartTimeInput(v)} />
              </div>
              <div>
                <Label>คาบละ (นาที)</Label>
                <Input type="number" min={10} max={180} value={periodMinInput} onChange={(e) => setPeriodMinInput(e.target.value)} />
              </div>
              <div>
                <Label>พักเที่ยง (นาที)</Label>
                <Input type="number" min={10} max={180} value={lunchMinInput} onChange={(e) => setLunchMinInput(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">โครงสร้างนี้ใช้กับทั้งตารางเรียนและตารางจองห้องพิเศษ</p>

            {/* Live preview — ตารางคาบที่คำนวณจากค่าด้านบน */}
            {(() => {
              const pCount = parseInt(periodsInput) || 0;
              const lAfter = parseInt(lunchInput) || 0;
              const pMin = parseInt(periodMinInput) || 50;
              const lMin = parseInt(lunchMinInput) || 60;
              const sTime = (startTimeInput || "08:30").slice(0, 5);
              if (!pCount || !lAfter) return null;
              const previewSlots = buildPeriodSlots({
                periodsPerDay: pCount,
                lunchAfterPeriod: lAfter,
                startTime: sTime,
                periodMinutes: pMin,
                lunchMinutes: lMin,
              });
              const lastSlot = previewSlots[previewSlots.length - 1];
              return (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 max-h-64 overflow-y-auto">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">ตัวอย่างเวลาแต่ละคาบ</div>
                  {previewSlots.map((s, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                        s.kind === "lunch" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium" : "bg-background"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {s.kind === "lunch" && <UtensilsCrossed className="w-3 h-3" />}
                        {s.label}
                      </span>
                      <span className="font-mono">{s.start}–{s.end}</span>
                    </div>
                  ))}
                  {lastSlot && (
                    <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-border font-semibold text-primary">
                      <span>🔔 เวลาเลิกเรียน</span>
                      <span className="font-mono">{lastSlot.end}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <Button onClick={handleSaveSettings} className="w-full">บันทึก</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity Lock dialog */}
      <Dialog open={activityLockOpen} onOpenChange={setActivityLockOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pin className="w-5 h-5" />
              {lang === "th" ? "ล็อควัน-คาบ กิจกรรมพัฒนาผู้เรียน" : "Lock Activity Day/Period"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "กำหนดวันและคาบที่ต้องการล็อกสำหรับแต่ละกิจกรรม เพื่อให้จัดตรงกันทั้งโรงเรียน (เว้นว่างหากไม่ต้องการล็อก)"
              : "Set the day and period for each activity to lock across all classrooms (leave empty to auto-assign)"}
          </p>
          <div className="space-y-3 mt-2 max-h-[400px] overflow-y-auto">
            {uniqueActivitySubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                ยังไม่มีรายวิชาประเภทกิจกรรมพัฒนาผู้เรียน
              </p>
            ) : (
              uniqueActivitySubjects.map((subj: any) => {
                const lockVal = localLocks[subj.id] || { day: "", period: "" };
                return (
                  <div key={subj.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{subj.name_th}</div>
                      <div className="text-xs text-muted-foreground">{subj.code} · {subj.hours_per_week} ชม./สัปดาห์</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={lockVal.day}
                        onValueChange={(v) =>
                          setLocalLocks((prev) => ({
                            ...prev,
                            [subj.id]: { ...prev[subj.id], day: v, period: prev[subj.id]?.period || "" },
                          }))
                        }
                      >
                        <SelectTrigger className="w-[100px] h-8 text-xs">
                          <SelectValue placeholder="วัน" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ไม่ล็อก</SelectItem>
                          {days.map((d) => (
                            <SelectItem key={d.val} value={String(d.val)}>
                              {d.th}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={lockVal.period}
                        onValueChange={(v) =>
                          setLocalLocks((prev) => ({
                            ...prev,
                            [subj.id]: { ...prev[subj.id], period: v, day: prev[subj.id]?.day || "" },
                          }))
                        }
                      >
                        <SelectTrigger className="w-[80px] h-8 text-xs">
                          <SelectValue placeholder="คาบ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          {periods.map((p) => (
                            <SelectItem key={p} value={String(p)}>
                              คาบ {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Button onClick={handleSaveActivityLocks} className="w-full mt-2">
            {lang === "th" ? "บันทึกการล็อก" : "Save Locks"}
          </Button>
        </DialogContent>
      </Dialog>
      <TeacherScheduleImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
};

export default SchedulePage;
