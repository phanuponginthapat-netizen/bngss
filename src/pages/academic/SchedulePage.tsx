import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Calendar, Wand2, Settings, Lock, UtensilsCrossed, Pin, User, Upload, Download } from "lucide-react";
import { TeacherScheduleImportDialog } from "@/components/academic/TeacherScheduleImportDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateAutoSchedule, buildSubjectEntries } from "@/lib/autoScheduler";
import type { ActivityLock } from "@/lib/autoScheduler";
import { buildPeriodSlots, gradeToLevel, type SchoolLevel, type PeriodTimeOverride } from "@/lib/periodSchedule";
import { Switch } from "@/components/ui/switch";
import { Sun, Moon, CalendarPlus } from "lucide-react";
import { TimeInput } from "@/components/ui/time-input";

const ALL_DAYS = [
  { th: "จันทร์", en: "Mon", val: 1 },
  { th: "อังคาร", en: "Tue", val: 2 },
  { th: "พุธ", en: "Wed", val: 3 },
  { th: "พฤหัสบดี", en: "Thu", val: 4 },
  { th: "ศุกร์", en: "Fri", val: 5 },
  { th: "เสาร์", en: "Sat", val: 6 },
  { th: "อาทิตย์", en: "Sun", val: 7 },
];

const normalizeTeacherName = (value?: string | null) =>
  (value || "")
    .replace(/^(ครู|นาย|นางสาว|นาง|น\.ส\.|ดร\.|อ\.)\s*/, "")
    .replace(/[์\-\s]/g, "")
    .trim();

const getPersonnelFullName = (person: any) =>
  `${person?.prefix || ""}${person?.first_name || ""} ${person?.last_name || ""}`.trim();

const splitExcelSubject = (raw?: string | null) => {
  const value = (raw || "").trim();
  const match = value.match(/^(.*)\s+([A-Za-zก-ฮ]\d{5}(?:[-/][A-Za-z0-9ก-ฮ.]+)?)$/);
  return match ? { name: match[1].trim(), code: match[2].trim() } : { name: value, code: "" };
};

const SchedulePage = () => {
  const { lang } = useLanguage();
  const { isAdmin, isTeacher, isStudent, isParent, userId } = useUserRole();
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
        .select("id, prefix, first_name, last_name, teaching_level")
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
        .select("id, prefix, first_name, last_name, teaching_level")
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
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activityLockOpen, setActivityLockOpen] = useState(false);
  // Settings inputs — when split enabled, hold both primary & secondary inputs separately
  const [splitInput, setSplitInput] = useState(false);
  const [settingsLevelTab, setSettingsLevelTab] = useState<SchoolLevel>("primary");
  const [periodsInput, setPeriodsInput] = useState("");
  const [lunchInput, setLunchInput] = useState("");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [periodMinInput, setPeriodMinInput] = useState("");
  const [lunchMinInput, setLunchMinInput] = useState("");
  const [periodsInputSec, setPeriodsInputSec] = useState("");
  const [lunchInputSec, setLunchInputSec] = useState("");
  const [startTimeInputSec, setStartTimeInputSec] = useState("");
  const [periodMinInputSec, setPeriodMinInputSec] = useState("");
  const [lunchMinInputSec, setLunchMinInputSec] = useState("");
  // Per-period time overrides (one set per level when split)
  const [customPeriodsEnabled, setCustomPeriodsEnabled] = useState(false);
  const [periodTimesInput, setPeriodTimesInput] = useState<PeriodTimeOverride[]>([]);
  const [customPeriodsEnabledSec, setCustomPeriodsEnabledSec] = useState(false);
  const [periodTimesInputSec, setPeriodTimesInputSec] = useState<PeriodTimeOverride[]>([]);
  // Weekend schedule
  const [weekendEnabledInput, setWeekendEnabledInput] = useState(false);
  const [weekendSatInput, setWeekendSatInput] = useState(true);
  const [weekendSunInput, setWeekendSunInput] = useState(false);


  // Load full schedule settings (all keys at once) — keeps everything consistent
  const { data: scheduleSettings } = useQuery({
    queryKey: ["school_settings", "schedule_full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "split_levels_schedule",
          "periods_per_day", "lunch_after_period", "period_start_time", "period_duration_min", "lunch_duration_min", "period_times_json",
          "primary_periods_per_day", "primary_lunch_after_period", "primary_period_start_time", "primary_period_duration_min", "primary_lunch_duration_min", "primary_period_times_json",
          "secondary_periods_per_day", "secondary_lunch_after_period", "secondary_period_start_time", "secondary_period_duration_min", "secondary_lunch_duration_min", "secondary_period_times_json",
          "weekend_schedule_enabled", "weekend_days_json",
        ]);
      const m: Record<string, string> = {};
      (data || []).forEach((r: any) => { if (r.setting_value != null) m[r.setting_key] = r.setting_value; });
      return m;
    },
  });

  const splitEnabled = (scheduleSettings?.split_levels_schedule === "1" || scheduleSettings?.split_levels_schedule === "true");
  const weekendEnabled = scheduleSettings?.weekend_schedule_enabled === "1" || scheduleSettings?.weekend_schedule_enabled === "true";
  const weekendDays: number[] = useMemo(() => {
    if (!weekendEnabled) return [];
    try {
      const arr = JSON.parse(scheduleSettings?.weekend_days_json || "[6,7]");
      return Array.isArray(arr) ? arr.map((x: any) => parseInt(x)).filter((x) => x === 6 || x === 7) : [6, 7];
    } catch { return [6, 7]; }
  }, [weekendEnabled, scheduleSettings]);

  const days = useMemo(() => {
    const base = ALL_DAYS.slice(0, 5);
    return weekendEnabled ? [...base, ...ALL_DAYS.filter((d) => weekendDays.includes(d.val))] : base;
  }, [weekendEnabled, weekendDays]);

  const parsePeriodTimes = (raw?: string): PeriodTimeOverride[] => {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((x: any) => ({ period: parseInt(x?.period), start: String(x?.start || "").slice(0, 5), end: String(x?.end || "").slice(0, 5) }))
        .filter((x: PeriodTimeOverride) => x.period && /^\d\d:\d\d$/.test(x.start) && /^\d\d:\d\d$/.test(x.end));
    } catch { return []; }
  };


  const getLevelCfg = (level: SchoolLevel) => {
    const m = scheduleSettings || {};
    const pfx = splitEnabled ? (level === "primary" ? "primary_" : "secondary_") : "";
    const pick = (k: string) => m[`${pfx}${k}`] || m[k] || "";
    return {
      periodsPerDay: parseInt(pick("periods_per_day") || "") || 8,
      lunchAfterPeriod: parseInt(pick("lunch_after_period") || "") || 4,
      start: (pick("period_start_time") || "08:30").slice(0, 5),
      periodMin: parseInt(pick("period_duration_min") || "") || 50,
      lunchMin: parseInt(pick("lunch_duration_min") || "") || 60,
      periodTimes: parsePeriodTimes(pick("period_times_json")),
    };
  };


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

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
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

  // Determine active school level from selected classroom; default to primary
  // For mySchedule: derive from teacher's own classes — if any secondary class (or both), use secondary
  const activeLevel: SchoolLevel = useMemo(() => {
    if (viewMode === "classroom" && filterClass && filterClass !== "all") {
      const c = classrooms.find((x: any) => x.id === filterClass);
      if (c) return gradeToLevel((c as any).grade_level);
    }
    if (viewMode === "mySchedule") {
      // Prefer explicit teaching_level on the personnel record (admin can set it manually).
      // both → use secondary as primary view (ตามคำขอ)
      let teachingLevel: string | null = null;
      if (isAdmin && selectedTeacherName) {
        const p = allPersonnel.find((x: any) => getPersonnelFullName(x) === selectedTeacherName);
        teachingLevel = (p as any)?.teaching_level || null;
      } else {
        teachingLevel = (myPersonnel as any)?.teaching_level || null;
      }
      if (teachingLevel === "secondary" || teachingLevel === "both") return "secondary";
      if (teachingLevel === "primary") return "primary";

      // Fallback: derive from teacher's actual classes
      const cMap = new Map<string, any>();
      classrooms.forEach((c: any) => cMap.set(c.id, c));
      let hasPri = false, hasSec = false;
      const myRows = schedules.filter((s: any) => {
        if (effectiveTeacherId && s.teacher_id === effectiveTeacherId) return true;
        if (!s.teacher_id && s.teacher_name && effectiveTeacherName) {
          const a = normalizeTeacherName(s.teacher_name);
          const b = normalizeTeacherName(effectiveTeacherName);
          if (a && b && (a === b || a.startsWith(normalizeTeacherName(effectiveTeacherFirstName) || "_") || b.startsWith(a))) return true;
        }
        return false;
      });
      for (const r of myRows) {
        const cls = cMap.get(r.classroom_id);
        if (!cls) continue;
        const lvl = gradeToLevel(cls.grade_level);
        if (lvl === "primary") hasPri = true;
        else if (lvl === "secondary") hasSec = true;
        if (hasPri && hasSec) break;
      }
      if (hasSec) return "secondary";
      if (hasPri) return "primary";
    }
    return "primary";
  }, [viewMode, filterClass, classrooms, schedules, effectiveTeacherId, effectiveTeacherName, effectiveTeacherFirstName, isAdmin, selectedTeacherName, allPersonnel, myPersonnel]);

  // Derived level-specific values used throughout the page
  const activeCfg = useMemo(() => getLevelCfg(activeLevel), [scheduleSettings, splitEnabled, activeLevel]);
  const periodsPerDay = activeCfg.periodsPerDay;
  const lunchAfterPeriod = activeCfg.lunchAfterPeriod;
  const scheduleTimes = { start: activeCfg.start, periodMin: activeCfg.periodMin, lunchMin: activeCfg.lunchMin };
  const activeSlots = useMemo(
    () => buildPeriodSlots({
      periodsPerDay: activeCfg.periodsPerDay,
      lunchAfterPeriod: activeCfg.lunchAfterPeriod,
      startTime: activeCfg.start,
      periodMinutes: activeCfg.periodMin,
      lunchMinutes: activeCfg.lunchMin,
      periodTimes: activeCfg.periodTimes,
    }),
    [activeCfg],
  );
  const periodTimeMap = useMemo(() => {
    const m: Record<number, { start: string; end: string }> = {};
    activeSlots.forEach((s) => { if (s.kind === "period") m[s.period] = { start: s.start, end: s.end }; });
    return m;
  }, [activeSlots]);

  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);



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
    // Classroom schedule must show one classroom at a time; mixing all rooms makes periods look like co-teaching.
    return [];
  }, [viewMode, effectiveTeacherId, effectiveTeacherName, effectiveTeacherFirstName, filterClass, schedules, isStudent, isParent]);

  const shouldSelectClassroom = viewMode === "classroom" && (!filterClass || filterClass === "all") && !isStudent && !isParent;



  const getSubjectName = (sid: string) => {
    const s = subjects.find((x: any) => x.id === sid);
    return s ? (lang === "th" ? s.name_th : s.name_en || s.name_th) : "";
  };

  const getSubjectCode = (sid: string) => {
    const s = subjects.find((x: any) => x.id === sid);
    return s?.code || "";
  };

  const getDisplaySubjectName = (schedule: any) => {
    const excelSubject = splitExcelSubject(schedule?.subject_name_raw);
    return excelSubject.name || getSubjectName(schedule?.subject_id) || "";
  };

  const getDisplaySubjectCode = (schedule: any) => {
    const excelSubject = splitExcelSubject(schedule?.subject_name_raw);
    const code = excelSubject.code || getSubjectCode(schedule?.subject_id);
    return code.startsWith("IMP-") || code.startsWith("T-") || code.startsWith("AUTO-") ? "" : code;
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
    if (!cellDialog || !selectedSubject) return;
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
    } as any);

    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "เพิ่มคาบเรียนสำเร็จ" : "Period added");
    qc.invalidateQueries({ queryKey: ["schedules"] });
    setCellDialog(null);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.info(lang === "th" ? "เฉพาะ Admin เท่านั้น" : "Admin only");
      return;
    }
    await supabase.from("schedules").delete().eq("id", id);
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
        await supabase.from("schedules").delete().eq("classroom_id", cid).eq("semester", filterSemester);
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
      toast.error(err.message);
    } finally {
      setAutoScheduling(false);
    }
  };

  const handleSaveSettings = async () => {
    const validate = (pi: string, li: string, pm: string, lm: string, label: string) => {
      const val = parseInt(pi);
      if (!val || val < 1 || val > 15) { toast.error(`${label}: กรุณากรอกจำนวนคาบ 1-15`); return null; }
      const lunchVal = parseInt(li);
      if (!lunchVal || lunchVal < 1 || lunchVal >= val) { toast.error(`${label}: กรุณากรอกคาบพักที่ถูกต้อง`); return null; }
      const periodMin = parseInt(pm) || 50;
      const lunchMin = parseInt(lm) || 60;
      if (periodMin < 10 || periodMin > 180) { toast.error(`${label}: ความยาวคาบ 10-180 นาที`); return null; }
      if (lunchMin < 10 || lunchMin > 180) { toast.error(`${label}: พักเที่ยง 10-180 นาที`); return null; }
      return { val, lunchVal, periodMin, lunchMin };
    };

    const serializeTimes = (enabled: boolean, arr: PeriodTimeOverride[], periodCount: number) => {
      if (!enabled) return "";
      const cleaned = arr
        .filter((x) => x && x.period >= 1 && x.period <= periodCount && /^\d\d:\d\d$/.test(x.start) && /^\d\d:\d\d$/.test(x.end))
        .map((x) => ({ period: x.period, start: x.start, end: x.end }));
      return JSON.stringify(cleaned);
    };

    const upserts: { setting_key: string; setting_value: string }[] = [
      { setting_key: "split_levels_schedule", setting_value: splitInput ? "1" : "0" },
      { setting_key: "weekend_schedule_enabled", setting_value: weekendEnabledInput ? "1" : "0" },
      { setting_key: "weekend_days_json", setting_value: JSON.stringify([
        ...(weekendSatInput ? [6] : []),
        ...(weekendSunInput ? [7] : []),
      ]) },
    ];

    if (splitInput) {
      const pri = validate(periodsInput, lunchInput, periodMinInput, lunchMinInput, "ประถม");
      if (!pri) return;
      const sec = validate(periodsInputSec, lunchInputSec, periodMinInputSec, lunchMinInputSec, "มัธยม");
      if (!sec) return;
      const sTimePri = (startTimeInput || "08:30").slice(0, 5);
      const sTimeSec = (startTimeInputSec || "08:30").slice(0, 5);
      upserts.push(
        { setting_key: "primary_periods_per_day", setting_value: String(pri.val) },
        { setting_key: "primary_lunch_after_period", setting_value: String(pri.lunchVal) },
        { setting_key: "primary_period_start_time", setting_value: sTimePri },
        { setting_key: "primary_period_duration_min", setting_value: String(pri.periodMin) },
        { setting_key: "primary_lunch_duration_min", setting_value: String(pri.lunchMin) },
        { setting_key: "primary_period_times_json", setting_value: serializeTimes(customPeriodsEnabled, periodTimesInput, pri.val) },
        { setting_key: "secondary_periods_per_day", setting_value: String(sec.val) },
        { setting_key: "secondary_lunch_after_period", setting_value: String(sec.lunchVal) },
        { setting_key: "secondary_period_start_time", setting_value: sTimeSec },
        { setting_key: "secondary_period_duration_min", setting_value: String(sec.periodMin) },
        { setting_key: "secondary_lunch_duration_min", setting_value: String(sec.lunchMin) },
        { setting_key: "secondary_period_times_json", setting_value: serializeTimes(customPeriodsEnabledSec, periodTimesInputSec, sec.val) },
      );
    } else {
      const g = validate(periodsInput, lunchInput, periodMinInput, lunchMinInput, "ตารางเรียน");
      if (!g) return;
      const startTime = (startTimeInput || "08:30").slice(0, 5);
      upserts.push(
        { setting_key: "periods_per_day", setting_value: String(g.val) },
        { setting_key: "lunch_after_period", setting_value: String(g.lunchVal) },
        { setting_key: "period_start_time", setting_value: startTime },
        { setting_key: "period_duration_min", setting_value: String(g.periodMin) },
        { setting_key: "lunch_duration_min", setting_value: String(g.lunchMin) },
        { setting_key: "period_times_json", setting_value: serializeTimes(customPeriodsEnabled, periodTimesInput, g.val) },
      );
    }

    const { error } = await supabase.from("school_settings").upsert(upserts, { onConflict: "setting_key" });
    if (error) { toast.error(error.message); return; }
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

    if (error) { toast.error(error.message); return; }

    // Auto-apply: insert activity rows into schedules for every classroom (no full regenerate needed)
    try {
      const now = new Date();
      const yr = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;
      let applied = 0;
      let replaced = 0;
      for (const lock of locks) {
        const lockedSubj: any = subjects.find((s: any) => s.id === lock.subject_id);
        if (!lockedSubj) continue;
        const sameCode = subjects.filter((s: any) => (s as any).code === lockedSubj.code);
        for (const cls of classrooms as any[]) {
          // Pick subject matching this classroom's grade (fallback to lockedSubj)
          const subjForGrade = sameCode.find((s: any) => s.grade_level === cls.grade_level) || lockedSubj;
          // Remove existing rows occupying this slot for this classroom/semester
          const { data: existing } = await supabase
            .from("schedules")
            .select("id")
            .eq("classroom_id", cls.id)
            .eq("semester", filterSemester)
            .eq("day_of_week", lock.day_of_week)
            .eq("period", lock.start_period);
          if (existing && existing.length) {
            await supabase.from("schedules").delete().in("id", existing.map((r: any) => r.id));
            replaced += existing.length;
          }
          const { error: insErr } = await supabase.from("schedules").insert({
            classroom_id: cls.id,
            subject_id: subjForGrade.id,
            day_of_week: lock.day_of_week,
            period: lock.start_period,
            duration_periods: 1,
            academic_year: yr,
            semester: filterSemester,
            teacher_name: subjForGrade.name_th || lockedSubj.name_th,
          });
          if (!insErr) applied++;
        }
      }
      toast.success(`บันทึก & ใส่กิจกรรมในตารางสำเร็จ ${applied} คาบ${replaced ? ` (แทนที่ ${replaced} คาบเดิม)` : ""}`);
    } catch (e: any) {
      toast.error(e.message || "ใส่กิจกรรมลงตารางไม่สำเร็จ");
    }

    qc.invalidateQueries({ queryKey: ["school_settings", "activity_locks"] });
    qc.invalidateQueries({ queryKey: ["schedules"] });
    setActivityLockOpen(false);
  };

  const cellBgClass = (subjectType: string) => {
    switch (subjectType) {
      case "activity": return "bg-warning-soft dark:bg-warning/20";
      case "elective": return "bg-info-soft dark:bg-info/20";
      default: return "bg-primary/5";
    }
  };

  const tableRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadImage = async () => {
    if (!tableRef.current) return;
    try {
      setDownloading(true);
      const node = tableRef.current;
      const prevOverflow = node.style.overflow;
      node.style.overflow = "visible";
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        windowWidth: node.scrollWidth,
      });
      node.style.overflow = prevOverflow;
      const ctx =
        viewMode === "mySchedule"
          ? effectiveTeacherName || "teacher"
          : (classrooms.find((c: any) => c.id === filterClass) as any)?.name || "all";
      const filename = `schedule-${ctx}-${filterSemester}.png`.replace(/\s+/g, "_");
      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success(lang === "th" ? "ดาวน์โหลดรูปสำเร็จ" : "Image downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setDownloading(false);
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
              <Button variant="outline" size="sm" onClick={() => {
                const pri = getLevelCfg("primary");
                const sec = getLevelCfg("secondary");
                setSplitInput(splitEnabled);
                setSettingsLevelTab(activeLevel);
                setPeriodsInput(String(pri.periodsPerDay));
                setLunchInput(String(pri.lunchAfterPeriod));
                setStartTimeInput(pri.start);
                setPeriodMinInput(String(pri.periodMin));
                setLunchMinInput(String(pri.lunchMin));
                setPeriodsInputSec(String(sec.periodsPerDay));
                setLunchInputSec(String(sec.lunchAfterPeriod));
                setStartTimeInputSec(sec.start);
                setPeriodMinInputSec(String(sec.periodMin));
                setLunchMinInputSec(String(sec.lunchMin));
                setCustomPeriodsEnabled((pri.periodTimes?.length || 0) > 0);
                setPeriodTimesInput(pri.periodTimes || []);
                setCustomPeriodsEnabledSec((sec.periodTimes?.length || 0) > 0);
                setPeriodTimesInputSec(sec.periodTimes || []);
                setWeekendEnabledInput(weekendEnabled);
                setWeekendSatInput(weekendDays.includes(6) || !weekendEnabled);
                setWeekendSunInput(weekendDays.includes(7));
                setSettingsOpen(true);
              }}>

                <Settings className="w-4 h-4 mr-1" />
                {periodsPerDay} คาบ/วัน{splitEnabled ? ` · ${activeLevel === "primary" ? "ประถม" : "มัธยม"}` : ""}
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
          <Button variant="outline" size="sm" onClick={handleDownloadImage} disabled={downloading}>
            <Download className="w-4 h-4 mr-1" />
            {downloading ? (lang === "th" ? "กำลังสร้าง..." : "Generating...") : (lang === "th" ? "ดาวน์โหลดรูป" : "Download image")}
          </Button>
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
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-info-soft dark:bg-info/40 border" /> วิชาเพิ่มเติม</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-warning-soft dark:bg-warning/40 border" /> กิจกรรมพัฒนาผู้เรียน</div>
        {!isAdmin && <div className="flex items-center gap-1 text-muted-foreground"><Lock className="w-3 h-3" /> Admin เท่านั้นที่แก้ไขได้</div>}
      </div>

      <Card>
        <CardContent className="p-2 md:p-3">
          <div ref={tableRef} className="overflow-x-auto bg-background">
            {shouldSelectClassroom ? (
              <div className="min-h-[240px] flex items-center justify-center text-sm font-medium text-muted-foreground">
                กรุณาเลือกห้องเรียนเพื่อดูตารางให้ตรงกับไฟล์ Excel
              </div>
            ) : (
            <table className="w-full border-collapse text-[12px] table-fixed min-w-[900px]">
              <thead>
                <tr>
                  <th rowSpan={2} className="border border-border p-1 bg-muted/50 text-[11px] font-bold w-14 sticky left-0 z-10">
                    {lang === "th" ? "วัน / คาบ" : "Day / Period"}
                  </th>

                  {lunchAfterPeriod > 0 && (
                    <th colSpan={lunchAfterPeriod} className="border border-border p-1.5 bg-info-soft dark:bg-info/20 text-xs font-semibold text-info dark:text-info text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Sun className="w-3 h-3" /> ภาคเช้า
                      </div>
                    </th>
                  )}
                  {lunchAfterPeriod > 0 && lunchAfterPeriod < periodsPerDay && (
                    <th className="border border-border p-1.5 bg-warning-soft dark:bg-warning/20 text-xs font-medium text-warning dark:text-warning text-center">
                      <div className="flex items-center justify-center gap-1">
                        <UtensilsCrossed className="w-3 h-3" /> พัก
                      </div>
                    </th>
                  )}
                  {lunchAfterPeriod < periodsPerDay && (
                    <th colSpan={periodsPerDay - lunchAfterPeriod} className="border border-border p-1.5 bg-info-soft dark:bg-info/20 text-xs font-semibold text-info dark:text-info text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Moon className="w-3 h-3" /> ภาคบ่าย
                      </div>
                    </th>
                  )}
                </tr>
                <tr>
                  {(() => {
                    const cols: (number | "lunch")[] = [];
                    for (let p = 1; p <= periodsPerDay; p++) {
                      cols.push(p);
                      if (p === lunchAfterPeriod && p < periodsPerDay && p > 0) cols.push("lunch");
                    }
                    return cols.map((col) => {
                      if (col === "lunch") {
                        const ls = activeSlots.find((s) => s.kind === "lunch");
                        return (
                          <th key="lunch" className="border border-border p-1 bg-muted/50 text-center w-10">
                            <UtensilsCrossed className="w-3 h-3 mx-auto text-warning" />
                            {ls && <div className="text-[8px] font-mono text-muted-foreground mt-0.5">{ls.start}<br />{ls.end}</div>}
                          </th>
                        );
                      }
                      return (
                        <th key={col} className={`border border-border p-1 bg-muted/50 text-[11px] font-bold text-center min-w-[72px] ${col <= lunchAfterPeriod ? "text-info dark:text-info" : "text-info dark:text-info"}`}>

                          <div>คาบ {col}</div>
                          {periodTimeMap[col] && (
                            <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
                              {periodTimeMap[col].start}<br />{periodTimeMap[col].end}
                            </div>
                          )}
                        </th>
                      );
                    });
                  })()}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const isWeekend = d.val === 6 || d.val === 7;
                  return (
                    <tr key={d.val}>
                      <td className={`border border-border p-1 text-[11px] font-bold text-center sticky left-0 z-10 w-14 ${isWeekend ? "bg-info-soft dark:bg-info/20 text-info dark:text-info" : "bg-muted/30"}`}>
                        <div className="flex items-center justify-center gap-1">
                          {isWeekend && <CalendarPlus className="w-3 h-3" />}
                          {lang === "th" ? d.th : d.en}
                        </div>
                        {isWeekend && <div className="text-[9px] font-normal opacity-80">เรียนพิเศษ</div>}
                      </td>
                      {(() => {
                        const cols: (number | "lunch")[] = [];
                        for (let p = 1; p <= periodsPerDay; p++) {
                          cols.push(p);
                          if (p === lunchAfterPeriod && p < periodsPerDay && p > 0) cols.push("lunch");
                        }
                        const coveredPeriods = new Set<number>();
                        return cols.map((col) => {
                          if (col === "lunch") {
                            return (
                              <td key="lunch" className="border border-border p-0.5 text-center bg-warning/50 dark:bg-warning/10 w-10">
                                <div className="text-[9px] text-warning dark:text-warning font-medium">พัก</div>
                              </td>
                            );
                          }
                          if (coveredPeriods.has(col)) return null;
                          const items = filtered.filter((s: any) => s.day_of_week === d.val && s.period === col);
                          const item = items[0];
                          const span = item ? Math.max(1, Math.min(item.duration_periods || 1, periodsPerDay - col + 1)) : 1;
                          if (span > 1) {
                            for (let p = col + 1; p < col + span; p++) coveredPeriods.add(p);
                          }
                          const subType = item ? getSubjectType(item.subject_id) : "";
                          const roomBookings = bookingByDayPeriod[`${d.val}-${col}`] || [];
                          return (
                            <td
                              key={col}
                              colSpan={span}
                              className={`border border-border p-1 text-center align-top transition-all min-w-[110px] ${item ? cellBgClass(subType) + " hover:shadow-lg hover:z-10 relative" : isAdmin ? "hover:bg-accent/50 cursor-pointer" : ""}`}
                              onClick={() => items.length === 0 && handleCellClick(d.val, col)}
                            >
                              {items.length > 0 ? (
                                <div className="relative group min-h-[68px] space-y-1 p-1.5 rounded-md">
                                  {items.length > 1 && (
                                    <div className="text-[10px] font-bold text-info bg-info-soft dark:bg-info/40 dark:text-info rounded-full px-2 py-0.5 inline-block">
                                      สอนร่วม {items.length} คน
                                    </div>
                                  )}
                                  {items.map((it: any, idx: number) => {
                                    const code = getDisplaySubjectCode(it);
                                    const subjectName = getDisplaySubjectName(it);
                                    return (
                                      <div key={it.id} className={`space-y-1 ${idx > 0 ? "border-t border-border/40 pt-1 mt-1" : ""}`}>
                                        {code && (
                                          <div className="text-[10px] font-mono font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 inline-block leading-tight tracking-wide">{code}</div>
                                        )}
                                        <div className="text-[12px] font-semibold text-foreground leading-snug break-words whitespace-normal text-center" title={subjectName}>
                                          {subjectName}
                                          {!it.subject_id && it.subject_name_raw && (
                                            <span className="ml-1 text-[9px] text-warning">(ยังไม่จับคู่)</span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground leading-tight break-words whitespace-normal flex items-start justify-center gap-1">
                                          <User className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                                          <span className="text-left">
                                            {viewMode === "mySchedule"
                                              ? classrooms.find((c: any) => c.id === it.classroom_id)?.name || ""
                                              : it.teacher_name}
                                          </span>
                                        </div>
                                        {it.room && (
                                          <div className="text-[11px] font-medium text-info dark:text-info leading-tight break-words whitespace-normal text-center" title={it.room}>
                                            📍 {it.room}
                                          </div>
                                        )}
                                        {isAdmin && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute top-0 right-0 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(it.id); }}
                                          >
                                            <Trash2 className="w-3 h-3 text-destructive" />
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {roomBookings.map((b: any) => (
                                    <div
                                      key={b.id}
                                      className="mt-1 text-[10px] font-medium text-success dark:text-success break-words whitespace-normal border-t border-success/30 dark:border-success/30 pt-1"
                                      title={`จองห้อง ${b.special_rooms?.name || ""} โดย ${b.teacher_name} (${b.booking_date})`}
                                    >
                                      🏫 {b.special_rooms?.name || "ห้องพิเศษ"} · {b.teacher_name}
                                    </div>
                                  ))}
                                </div>
                              ) : roomBookings.length > 0 ? (
                                <div className="min-h-[36px] space-y-0.5 py-1">
                                  {roomBookings.map((b: any) => (
                                    <div
                                      key={b.id}
                                      className="text-[10px] rounded bg-success-soft dark:bg-success/30 border border-success/30 dark:border-success/30 px-1 py-0.5"
                                      title={`จองห้อง ${b.special_rooms?.name || ""} โดย ${b.teacher_name}`}
                                    >
                                      <div className="font-semibold text-success dark:text-success truncate">🏫 {b.special_rooms?.name || "ห้องพิเศษ"}</div>
                                      <div className="text-[9px] text-muted-foreground truncate">{b.teacher_name}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="min-h-[36px] flex items-center justify-center">
                                  {isAdmin && <span className="text-muted-foreground/30 text-xs">+</span>}
                                </div>
                              )}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
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
                  <Button onClick={handleAssignToCell} className="w-full" disabled={!selectedSubject}>
                    {lang === "th" ? "บันทึก" : "Save"}
                  </Button>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ตั้งค่าตารางเรียน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Split toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <div className="text-sm font-medium">แยกเวลาเรียน ประถม / มัธยม</div>
                <p className="text-[11px] text-muted-foreground">เปิดเพื่อใช้คาบและเวลาแยกกันระหว่าง ป.1–ป.6 และ ม.1–ม.6</p>
              </div>
              <Switch checked={splitInput} onCheckedChange={setSplitInput} />
            </div>

            {/* Weekend toggle */}
            <div className="rounded-lg border border-info/30 dark:border-info/30 bg-info/40 dark:bg-info/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarPlus className="w-4 h-4 text-info" />
                    ตารางเรียนพิเศษ เสาร์-อาทิตย์
                  </div>
                  <p className="text-[11px] text-muted-foreground">เพิ่มคอลัมน์วันเสาร์/อาทิตย์สำหรับติวพิเศษหรือกิจกรรมเสริม</p>
                </div>
                <Switch checked={weekendEnabledInput} onCheckedChange={setWeekendEnabledInput} />
              </div>
              {weekendEnabledInput && (
                <div className="flex items-center gap-4 pl-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={weekendSatInput} onChange={(e) => setWeekendSatInput(e.target.checked)} />
                    วันเสาร์
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={weekendSunInput} onChange={(e) => setWeekendSunInput(e.target.checked)} />
                    วันอาทิตย์
                  </label>
                </div>
              )}
            </div>

            {splitInput && (
              <Tabs value={settingsLevelTab} onValueChange={(v) => setSettingsLevelTab(v as SchoolLevel)}>
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="primary">ประถม (ป.1–ป.6)</TabsTrigger>
                  <TabsTrigger value="secondary">มัธยม (ม.1–ม.6)</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {(() => {
              const useSec = splitInput && settingsLevelTab === "secondary";
              const pi = useSec ? periodsInputSec : periodsInput;
              const setPi = useSec ? setPeriodsInputSec : setPeriodsInput;
              const li = useSec ? lunchInputSec : lunchInput;
              const setLi = useSec ? setLunchInputSec : setLunchInput;
              const st = useSec ? startTimeInputSec : startTimeInput;
              const setSt = useSec ? setStartTimeInputSec : setStartTimeInput;
              const pm = useSec ? periodMinInputSec : periodMinInput;
              const setPm = useSec ? setPeriodMinInputSec : setPeriodMinInput;
              const lm = useSec ? lunchMinInputSec : lunchMinInput;
              const setLm = useSec ? setLunchMinInputSec : setLunchMinInput;
              const customOn = useSec ? customPeriodsEnabledSec : customPeriodsEnabled;
              const setCustomOn = useSec ? setCustomPeriodsEnabledSec : setCustomPeriodsEnabled;
              const customTimes = useSec ? periodTimesInputSec : periodTimesInput;
              const setCustomTimes = useSec ? setPeriodTimesInputSec : setPeriodTimesInput;

              const pCount = parseInt(pi) || 0;
              const lAfter = parseInt(li) || 0;
              const pMin = parseInt(pm) || 50;
              const lMin = parseInt(lm) || 60;
              const sTime = (st || "08:30").slice(0, 5);

              // Build a working overrides array indexed by period
              const overridesByPeriod = new Map<number, PeriodTimeOverride>();
              customTimes.forEach((o) => overridesByPeriod.set(o.period, o));
              const setOverride = (period: number, key: "start" | "end", value: string) => {
                const next = new Map(overridesByPeriod);
                const cur = next.get(period) || { period, start: "", end: "" };
                next.set(period, { ...cur, [key]: value });
                setCustomTimes(Array.from(next.values()).sort((a, b) => a.period - b.period));
              };

              const previewSlots = (pCount && lAfter)
                ? buildPeriodSlots({
                    periodsPerDay: pCount,
                    lunchAfterPeriod: lAfter,
                    startTime: sTime,
                    periodMinutes: pMin,
                    lunchMinutes: lMin,
                    periodTimes: customOn ? customTimes : undefined,
                  })
                : [];
              const lastSlot = previewSlots[previewSlots.length - 1];


              return (
                <>
                  <div>
                    <Label>จำนวนคาบต่อวัน</Label>
                    <Input type="number" min={1} max={15} value={pi} onChange={(e) => setPi(e.target.value)} />
                  </div>
                  <div>
                    <Label>พักกลางวันหลังคาบที่</Label>
                    <Input type="number" min={1} max={14} value={li} onChange={(e) => setLi(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">เช่น ใส่ 4 = พักหลังคาบที่ 4</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>เริ่มคาบแรก</Label>
                      <TimeInput value={st} onChange={(e) => setSt(e.target.value)} />
                    </div>
                    <div>
                      <Label>คาบละ (นาที)</Label>
                      <Input type="number" min={10} max={180} value={pm} onChange={(e) => setPm(e.target.value)} />
                    </div>
                    <div>
                      <Label>พักเที่ยง (นาที)</Label>
                      <Input type="number" min={10} max={180} value={lm} onChange={(e) => setLm(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    {splitInput
                      ? `ค่านี้ใช้กับระดับ${settingsLevelTab === "primary" ? "ประถม" : "มัธยม"} เท่านั้น`
                      : "โครงสร้างนี้ใช้กับทั้งตารางเรียนและตารางจองห้องพิเศษ"}
                  </p>

                  {/* Per-period custom times editor */}
                  <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">กำหนดเวลารายคาบเอง</div>
                        <p className="text-[11px] text-muted-foreground">เปิดเพื่อระบุเวลาเริ่ม-เลิกของแต่ละคาบ (เช่น คาบเช้า/บ่ายไม่เท่ากัน)</p>
                      </div>
                      <Switch checked={customOn} onCheckedChange={setCustomOn} />
                    </div>
                    {customOn && pCount > 0 && (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto pt-1">
                        {Array.from({ length: pCount }, (_, i) => i + 1).map((per) => {
                          const ov = overridesByPeriod.get(per);
                          const session = per <= lAfter ? "เช้า" : "บ่าย";
                          return (
                            <div key={per} className="flex items-center gap-2">
                              <span className={`text-[11px] font-medium w-16 ${per <= lAfter ? "text-info" : "text-info"}`}>
                                คาบ {per} ({session})
                              </span>
                              <TimeInput
                                value={ov?.start || ""}
                                onChange={(e) => setOverride(per, "start", e.target.value)}
                                className="h-8 text-xs flex-1"
                              />
                              <span className="text-xs text-muted-foreground">–</span>
                              <TimeInput
                                value={ov?.end || ""}
                                onChange={(e) => setOverride(per, "end", e.target.value)}
                                className="h-8 text-xs flex-1"
                              />
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-muted-foreground pt-1">
                          คาบที่เว้นว่างจะใช้เวลาตามค่าด้านบนอัตโนมัติ
                        </p>
                      </div>
                    )}
                  </div>


                  {previewSlots.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 max-h-64 overflow-y-auto">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        ตัวอย่างเวลาแต่ละคาบ {splitInput && `(${settingsLevelTab === "primary" ? "ประถม" : "มัธยม"})`}
                      </div>
                      {previewSlots.map((s, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                            s.kind === "lunch" ? "bg-warning/10 text-warning dark:text-warning font-medium" : "bg-background"
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
                  )}
                </>
              );
            })()}

            <Button onClick={handleSaveSettings} className="w-full">บันทึก</Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Activity Lock dialog */}
      <Dialog open={activityLockOpen} onOpenChange={setActivityLockOpen}>
        <DialogContent className="max-w-lg">
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
