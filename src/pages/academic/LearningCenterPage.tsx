import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { toCE } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Time24Input } from "@/components/ui/time24-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, BookOpen, Calendar as CalendarIcon, Clock, MapPin, User, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { usePeriodSchedule } from "@/lib/periodSchedule";
import { notifyRole } from "@/lib/notify";
import { BE_OFFSET } from "@/lib/dateBE";
import { saveErrorMessage } from "@/lib/saveError";

function fmtDateTh(s: string) {
  try {
    const d = new Date(s + "T00:00:00");
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  } catch { return s; }
}
async function notifyAdminsRoomBooking(opts: {
  roomName: string;
  teacherName: string;
  subjectName?: string | null;
  dates: string[];
  start: string;
  end: string;
}) {
  const dateLabel = opts.dates.length === 1
    ? fmtDateTh(opts.dates[0])
    : `${fmtDateTh(opts.dates[0])} (+${opts.dates.length - 1} ครั้ง)`;
  const body = `${opts.teacherName} จอง${opts.subjectName ? ` · ${opts.subjectName}` : ""} · ${dateLabel} · ${opts.start}–${opts.end}`;
  const payload = {
    title: `📅 จองห้อง ${opts.roomName}`,
    body,
    type: "room_booking",
    severity: "info" as const,
    url: "/dashboard/academic/learning-center",
    channels: ["in_app", "push"] as ("in_app" | "push")[],
    dedup_key: `room-booking-${opts.roomName}-${opts.dates[0]}-${opts.start}`,
  };
  await Promise.all([
    notifyRole("admin", payload),
    notifyRole("director", payload),
  ]);
}

const DAYS = [
  { val: 1, th: "จันทร์" },
  { val: 2, th: "อังคาร" },
  { val: 3, th: "พุธ" },
  { val: 4, th: "พฤหัสบดี" },
  { val: 5, th: "ศุกร์" },
];
// Static Tailwind classes (dynamic `bg-${color}-500/10` would be purged at build)
const ROOM_TILE: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-500", sky: "bg-sky-500/10 text-sky-500",
  violet: "bg-violet-500/10 text-violet-500", amber: "bg-amber-500/10 text-amber-500",
  rose: "bg-rose-500/10 text-rose-500", indigo: "bg-indigo-500/10 text-indigo-500",
  teal: "bg-teal-500/10 text-teal-500", fuchsia: "bg-fuchsia-500/10 text-fuchsia-500",
};

const dayOfWeek = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00").getDay(); // 0=Sun..6=Sat
  return d === 0 ? 7 : d;
};

const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("th-TH", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
};

const startOfWeek = (d: Date) => {
  const day = d.getDay() || 7;
  const r = new Date(d);
  r.setDate(d.getDate() - day + 1);
  return r;
};
const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function LearningCenterPage() {
  const qc = useQueryClient();
  const { isAdmin, isDirector, isTeacher, userId } = useUserRole();
  const canBook = isAdmin || isDirector || isTeacher;
  const { currentAcademicYear, currentSemester, config } = useAcademicYear();

  // Compute current semester date range (used by "รายเทอม" booking mode)
  const semesterRange = useMemo(() => {
    const now = new Date();
    const ceYear = (currentAcademicYear || (now.getFullYear() + BE_OFFSET)) - BE_OFFSET;
    const sem = currentSemester || 1;
    let startMonth: number, endMonth: number, startYear: number, endYear: number;
    if (sem === 1) {
      startMonth = config.semester1StartMonth;
      endMonth = config.semester1EndMonth;
      startYear = ceYear; endYear = ceYear;
    } else {
      startMonth = config.semester2StartMonth;
      endMonth = config.semester2EndMonth;
      startYear = ceYear;
      // If sem2 wraps around year (e.g., Nov–Apr), end is next CE year
      endYear = endMonth < startMonth ? ceYear + 1 : ceYear;
    }
    const start = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth, 0); // last day of endMonth
    return { start, end };
  }, [config, currentAcademicYear, currentSemester]);

  const { data: periodData } = usePeriodSchedule();
  const periodSlots = periodData?.periodSlots || [];
  const allSlots = periodData?.slots || [];

  const [tab, setTab] = useState("week");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [open, setOpen] = useState(false);
  const [filterTeacher, setFilterTeacher] = useState<string>("all");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  // Form state
  const [bMode, setBMode] = useState<"single" | "semester">("single");
  const [bDate, setBDate] = useState(isoDate(new Date()));
  const [bEndDate, setBEndDate] = useState(""); // (legacy)
  const [bDow, setBDow] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 1 : d; // Mon–Fri; default Monday if Sunday
  });
  const [bStart, setBStart] = useState("13:00");
  const [bEnd, setBEnd] = useState("14:00");
  const [bPeriod, setBPeriod] = useState<string>("");
  const [bSubjectId, setBSubjectId] = useState<string>("");
  const [bClassroomId, setBClassroomId] = useState<string>("");
  const [bRoomId, setBRoomId] = useState<string>("");
  const [bTopic, setBTopic] = useState("");

  // Special rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ["special_rooms_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("special_rooms")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      return data || [];
    },
  });

  // Default selected room (for filtering views) — first active room
  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) setSelectedRoomId(rooms[0].id);
  }, [rooms, selectedRoomId]);

  // Realtime for rooms list
  useEffect(() => {
    const ch = supabase
      .channel("special-rooms-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "special_rooms" }, () => {
        qc.invalidateQueries({ queryKey: ["special_rooms_active"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);


  // My personnel record
  const { data: myPersonnel } = useQuery({
    queryKey: ["my_personnel_lcb", userId],
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
  const myTeacherName = myPersonnel
    ? `${myPersonnel.prefix || ""}${myPersonnel.first_name} ${myPersonnel.last_name !== "-" ? myPersonnel.last_name : ""}`.trim()
    : "";

  // Classrooms
  const { data: classrooms = [] } = useQuery({
    queryKey: ["lcb_classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("id, name, grade_level").order("grade_level").order("name");
      return data || [];
    },
  });

  // Subjects teacher is assigned to
  const { data: mySubjects = [] } = useQuery({
    queryKey: ["lcb_my_subjects", myPersonnel?.id],
    enabled: !!myPersonnel?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("teacher_assignments")
        .select("subject_id, classroom_id, subjects(id, code, name_th), classrooms(id, name)")
        .eq("personnel_id", myPersonnel!.id);
      return data || [];
    },
  });

  // Schedules of teacher (so admin/director can also pick from their schedule)
  const { data: mySchedules = [] } = useQuery({
    queryKey: ["lcb_my_schedules", myPersonnel?.id, currentAcademicYear, currentSemester],
    enabled: !!myPersonnel?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("schedules")
        .select("subject_id, classroom_id, subjects(id, code, name_th), classrooms(id, name)")
        .eq("teacher_id", myPersonnel!.id)
        .eq("academic_year", toCE(currentAcademicYear || new Date().getFullYear() + BE_OFFSET))
        .eq("semester", currentSemester || 1);
      return data || [];
    },
  });

  // Combined subject + classroom options (unique)
  const subjectOptions = useMemo(() => {
    const seen = new Map<string, any>();
    [...mySubjects, ...mySchedules].forEach((r: any) => {
      if (!r.subject_id) return;
      const key = r.subject_id;
      if (!seen.has(key)) seen.set(key, r);
    });
    return [...seen.values()];
  }, [mySubjects, mySchedules]);

  // Bookings — date range from weekStart .. +6 days (or all for list tab)
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const { data: bookings = [] } = useQuery({
    queryKey: ["lcb_bookings", isoDate(weekStart), isoDate(weekEnd), tab, selectedRoomId],
    enabled: !!selectedRoomId,
    queryFn: async () => {
      let q = supabase.from("learning_center_bookings").select("*").eq("status", "confirmed").eq("room_id", selectedRoomId);
      if (tab === "week") {
        q = q.gte("booking_date", isoDate(weekStart)).lte("booking_date", isoDate(weekEnd));
      } else {
        q = q.gte("booking_date", isoDate(new Date())).order("booking_date").order("start_time");
      }
      const { data } = await q;
      return (data || []).sort((a: any, b: any) =>
        a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time)
      );
    },
  });

  // Nearest upcoming booking for this room — used to guide users when the current week is empty.
  const { data: nearestBooking } = useQuery({
    queryKey: ["lcb_nearest_booking", selectedRoomId],
    enabled: !!selectedRoomId,
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_center_bookings")
        .select("id, booking_date, start_time, end_time, period, subject_name, teacher_name")
        .eq("status", "confirmed")
        .eq("room_id", selectedRoomId)
        .gte("booking_date", isoDate(new Date()))
        .order("booking_date")
        .order("start_time")
        .limit(1)
        .maybeSingle();
      return data || null;
    },
  });

  // Auto-jump weekStart to the first week that has bookings (if current week is empty)
  const userMovedWeek = useRef(false);
  useEffect(() => {
    if (!selectedRoomId || tab !== "week" || userMovedWeek.current) return;
    (async () => {
      const { data } = await supabase
        .from("learning_center_bookings")
        .select("booking_date")
        .eq("status", "confirmed")
        .eq("room_id", selectedRoomId)
        .gte("booking_date", isoDate(weekStart))
        .order("booking_date")
        .limit(1);
      const first = data?.[0]?.booking_date;
      if (!first) return;
      const firstDate = new Date(first + "T00:00:00");
      if (firstDate > weekEnd) {
        setWeekStart(startOfWeek(firstDate));
      }
    })();
  }, [selectedRoomId, tab]);


  // Realtime — listen for booking changes and refetch
  useEffect(() => {
    const ch = supabase
      .channel(`lcb-realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "learning_center_bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["lcb_bookings"], refetchType: "active" });
        qc.invalidateQueries({ queryKey: ["lcb_nearest_booking"], refetchType: "active" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "special_rooms" }, () => {
        qc.invalidateQueries({ queryKey: ["special_rooms_active"], refetchType: "active" });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);


  const teacherNames = useMemo(() => {
    const s = new Set<string>();
    bookings.forEach((b: any) => b.teacher_name && s.add(b.teacher_name));
    return [...s].sort();
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (filterTeacher === "all") return bookings;
    return bookings.filter((b: any) => b.teacher_name === filterTeacher);
  }, [bookings, filterTeacher]);

  const selectedRoom = useMemo(() => rooms.find((r: any) => r.id === selectedRoomId), [rooms, selectedRoomId]);


  const resetForm = () => {
    setBMode("single");
    setBDate(isoDate(new Date()));
    setBEndDate("");
    setBStart("13:00");
    setBEnd("14:00");
    setBPeriod("");
    setBSubjectId("");
    setBClassroomId("");
    setBRoomId(selectedRoomId || (rooms[0]?.id ?? ""));
    setBTopic("");
  };


  const submit = async () => {
    if (!canBook) return toast.error("เฉพาะครู/ผู้บริหารเท่านั้นที่สามารถจองได้");
    if (!myPersonnel) return toast.error("ไม่พบข้อมูลบุคลากรของคุณ");
    if (!bRoomId) return toast.error("กรุณาเลือกห้องที่ต้องการจอง");
    if (!bStart || !bEnd) return toast.error("กรุณากรอกเวลา");
    if (bEnd <= bStart) return toast.error("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม");
    if (bMode === "single" && !bDate) return toast.error("กรุณาเลือกวันที่");


    const picked = subjectOptions.find((r: any) => r.subject_id === bSubjectId);
    const subjectName = picked?.subjects?.name_th || null;
    const classroom = classrooms.find((c: any) => c.id === bClassroomId);

    // Build list of dates
    const dates: string[] = [];
    if (bMode === "single") {
      dates.push(bDate);
    } else {
      // Semester: from today (or semester start, whichever later) → semester end,
      // every week on the selected day-of-week.
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const start = semesterRange.start > today ? new Date(semesterRange.start) : today;
      const end = new Date(semesterRange.end);
      // Advance to the first matching DOW (1=Mon..7=Sun, JS getDay: 0=Sun..6=Sat)
      const targetJsDow = bDow === 7 ? 0 : bDow;
      const d = new Date(start);
      while (d.getDay() !== targetJsDow) d.setDate(d.getDate() + 1);
      for (; d <= end; d.setDate(d.getDate() + 7)) {
        dates.push(isoDate(d));
      }
      if (dates.length === 0) return toast.error("ไม่มีวันที่ตรงเงื่อนไขในเทอมนี้");
    }


    const rows = dates.map((dt) => ({
      booking_date: dt,
      start_time: bStart + ":00",
      end_time: bEnd + ":00",
      period: bPeriod ? Number(bPeriod) : null,
      subject_id: bSubjectId || null,
      subject_name: subjectName,
      classroom_id: bClassroomId || null,
      classroom_name: classroom?.name || null,
      teacher_id: myPersonnel.id,
      teacher_name: myTeacherName,
      topic: bTopic.trim() || null,
      created_by: userId,
      room_id: bRoomId,
    }));


    let firstVisibleDate: string | null = null;

    if (bMode === "single") {
      const { error } = await supabase.from("learning_center_bookings").insert(rows[0]);
      if (error) {
        if (error.message.includes("uq_lcb_slot") || error.code === "23505") {
          return toast.error("ช่วงเวลานี้มีคนจองแล้ว กรุณาเลือกเวลาอื่น");
        }
        return toast.error(saveErrorMessage(error));
      }
      firstVisibleDate = rows[0].booking_date;
      toast.success(`จองห้อง ${selectedRoom?.name || ""} เรียบร้อย`);
    } else {
      // Insert each — collect successes/failures so partial conflicts don't block all
      let ok = 0;
      const conflicts: string[] = [];
      for (const row of rows) {
        const { error } = await supabase.from("learning_center_bookings").insert(row);
        if (error) {
          if (error.message.includes("uq_lcb_slot") || error.code === "23505") {
            conflicts.push(row.booking_date);
          } else {
            return toast.error(saveErrorMessage(error));
          }
        } else {
          ok++;
          if (!firstVisibleDate) firstVisibleDate = row.booking_date;
        }
      }
      if (ok === 0) {
        return toast.error("ไม่สามารถจองได้ — ทุกวันมีคนจองช่วงเวลานี้แล้ว");
      }
      if (conflicts.length > 0) {
        toast.warning(`จองสำเร็จ ${ok}/${rows.length} ครั้ง · ข้าม ${conflicts.length} วันที่ชน: ${conflicts.slice(0, 3).join(", ")}${conflicts.length > 3 ? "…" : ""}`);
      } else {
        toast.success(`จองห้องรายเทอมสำเร็จ ${ok} ครั้ง`);
      }
    }

    // Notify admins/directors of the new booking(s) — fans out to in-app + Web Push
    try {
      const successDates = bMode === "single"
        ? [rows[0].booking_date]
        : rows.map((r) => r.booking_date).filter((d) => !(/* conflicts captured above */ false));
      await notifyAdminsRoomBooking({
        roomName: selectedRoom?.name || "—",
        teacherName: myTeacherName || "ครู",
        subjectName: subjectName,
        dates: successDates,
        start: bStart,
        end: bEnd,
      });
    } catch (_) { /* notify is fire-and-forget */ }

    setOpen(false);
    resetForm();
    setSelectedRoomId(bRoomId);
    setTab("week");
    setFilterTeacher("all");
    if (firstVisibleDate) {
      userMovedWeek.current = false;
      setWeekStart(startOfWeek(new Date(firstVisibleDate + "T00:00:00")));
    }
    qc.invalidateQueries({ queryKey: ["lcb_bookings"] });
    qc.invalidateQueries({ queryKey: ["lcb_nearest_booking"] });
  };


  const cancelBooking = async (b: any) => {
    if (!(await swal.confirm({ title: `ยกเลิกการจอง?`, text: `${b.subject_name || "-"} วันที่ ${fmtDate(b.booking_date)}`, danger: true }))) return;
    const { error } = await supabase.from("learning_center_bookings").delete().eq("id", b.id);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("ยกเลิกการจองแล้ว");
    qc.invalidateQueries({ queryKey: ["lcb_bookings"] });
  };

  // Group bookings by date for week tab
  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      map[isoDate(d)] = [];
    }
    filteredBookings.forEach((b: any) => {
      if (map[b.booking_date]) map[b.booking_date].push(b);
    });
    return map;
  }, [filteredBookings, weekStart]);

  const weekLabel = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString("th-TH", { day: "2-digit", month: "short" })} – ${e.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}`;
  }, [weekStart]);

  const nearestBookingOutsideWeek = useMemo(() => {
    if (!nearestBooking?.booking_date) return false;
    const d = new Date(nearestBooking.booking_date + "T00:00:00");
    return d < weekStart || d > weekEnd;
  }, [nearestBooking, weekStart, weekEnd]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> จองห้องพิเศษ
          </h1>
          <p className="text-sm text-muted-foreground">เลือกห้องที่ต้องการจอง · ครูจองล่วงหน้าสำหรับสอนวิชาของตน · ทุกคนเห็นตารางการใช้ห้อง</p>
        </div>
        {canBook && rooms.length > 0 && (
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> จองห้องใหม่
          </Button>
        )}
      </div>

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            ยังไม่มีห้องพิเศษในระบบ — แอดมินสามารถเพิ่มห้องได้ที่เมนู "ห้องพิเศษ → ตั้งค่าห้องพิเศษ"
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Room selector — shopping-style tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {rooms.map((r: any) => {
              const active = selectedRoomId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoomId(r.id)}
                  className={`flex-shrink-0 rounded-lg border overflow-hidden text-left transition w-44 ${active ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border hover:border-primary/50"}`}
                >
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} className="w-full h-20 object-cover" />
                  ) : (
                    <div className={`w-full h-20 flex items-center justify-center ${ROOM_TILE[r.color || "emerald"] || ROOM_TILE.emerald}`}>
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                  <div className="p-2">
                    <div className="font-semibold text-sm line-clamp-1">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">{r.location || "—"}{r.capacity ? ` · ${r.capacity} คน` : ""}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedRoom && (selectedRoom.description || selectedRoom.location) && (
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-sm flex items-start gap-2 flex-wrap">
                {selectedRoom.location && <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3.5 h-3.5" />{selectedRoom.location}</span>}
                {selectedRoom.capacity && <span className="text-muted-foreground">· ความจุ {selectedRoom.capacity} คน</span>}
                {selectedRoom.description && <span className="text-muted-foreground">· {selectedRoom.description}</span>}
              </CardContent>
            </Card>
          )}
        </>
      )}


      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="week"><CalendarIcon className="w-4 h-4 mr-1" /> ตารางสัปดาห์</TabsTrigger>
            <TabsTrigger value="list">รายการที่จะถึง</TabsTrigger>
          </TabsList>
          {teacherNames.length > 0 && (
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger className="w-56"><SelectValue placeholder="กรองตามครู" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ครูทุกคน</SelectItem>
                {teacherNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="week" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { userMovedWeek.current = true; const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}>← สัปดาห์ก่อน</Button>
              <Button variant="outline" size="sm" onClick={() => { userMovedWeek.current = true; setWeekStart(startOfWeek(new Date())); }}>วันนี้</Button>
              <Button variant="outline" size="sm" onClick={() => { userMovedWeek.current = true; const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}>สัปดาห์ถัดไป →</Button>
              {nearestBookingOutsideWeek && nearestBooking && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    userMovedWeek.current = true;
                    setWeekStart(startOfWeek(new Date(nearestBooking.booking_date + "T00:00:00")));
                  }}
                >
                  ไปสัปดาห์ที่มีจอง
                </Button>
              )}
            </div>
            <div className="text-sm font-medium text-muted-foreground">สัปดาห์ {weekLabel}</div>
          </div>

          {nearestBookingOutsideWeek && nearestBooking && bookings.length === 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 text-sm flex items-center justify-between gap-3 flex-wrap">
                <div className="text-muted-foreground">
                  มีการจองถัดไปวันที่ <span className="font-semibold text-foreground">{fmtDate(nearestBooking.booking_date)}</span>
                  {" "}เวลา <span className="font-mono text-foreground">{nearestBooking.start_time.slice(0, 5)}–{nearestBooking.end_time.slice(0, 5)}</span>
                  {nearestBooking.subject_name ? <span> · {nearestBooking.subject_name}</span> : null}
                  {nearestBooking.teacher_name ? <span> · {nearestBooking.teacher_name}</span> : null}
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    userMovedWeek.current = true;
                    setWeekStart(startOfWeek(new Date(nearestBooking.booking_date + "T00:00:00")));
                  }}
                >
                  แสดงในตาราง
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Period-grid view — rows = periods (with lunch row), cols = 5 days */}
          <Card>
            <CardContent className="p-2 md:p-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border border-border bg-muted/50 p-2 w-28 text-left">คาบ / เวลา</th>
                    {DAYS.map((day, idx) => {
                      const d = new Date(weekStart);
                      d.setDate(weekStart.getDate() + idx);
                      const key = isoDate(d);
                      const isToday = isoDate(new Date()) === key;
                      return (
                        <th key={day.val} className={`border border-border p-2 text-center min-w-[140px] ${isToday ? "bg-primary/10 text-primary" : "bg-muted/50"}`}>
                          <div>{day.th}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">{d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" })}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {allSlots.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">กำลังโหลดคาบเรียน…</td></tr>
                  ) : allSlots.map((slot, slotIdx) => {
                    if (slot.kind === "lunch") {
                      return (
                        <tr key={`lunch-${slotIdx}`}>
                          <td colSpan={DAYS.length + 1} className="border border-border p-2 text-center bg-amber-50 dark:bg-amber-950/20">
                            <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                              <UtensilsCrossed className="w-4 h-4" />
                              พักรับประทานอาหารกลางวัน
                              <span className="text-xs font-normal opacity-80">({slot.start}–{slot.end})</span>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={`p-${slot.period}`}>
                        <td className="border border-border p-2 bg-muted/30 align-top">
                          <div className="font-semibold">คาบ {slot.period}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{slot.start}–{slot.end}</div>
                        </td>
                        {DAYS.map((day, idx) => {
                          const d = new Date(weekStart);
                          d.setDate(weekStart.getDate() + idx);
                          const dateKey = isoDate(d);
                          const bookings = (byDay[dateKey] || []).filter((b: any) => {
                            if (b.period != null) return b.period === slot.period;
                            // No period set — match by time overlap with this slot
                            const bs = (b.start_time || "").slice(0, 5);
                            const be = (b.end_time || "").slice(0, 5);
                            return bs < slot.end && be > slot.start;
                          });
                          const past = d < new Date(new Date().toDateString());
                          const canBookCell = canBook && !past;
                          return (
                            <td
                              key={`${day.val}-${slot.period}`}
                              className={`border border-border p-1 align-top min-h-[60px] ${bookings.length === 0 && canBookCell ? "hover:bg-primary/5 cursor-pointer" : ""}`}
                              onClick={() => {
                                if (bookings.length > 0 || !canBookCell) return;
                                resetForm();
                                setBDate(dateKey);
                                setBPeriod(String(slot.period));
                                setBStart(slot.start);
                                setBEnd(slot.end);
                                setOpen(true);
                              }}
                            >
                              {bookings.length === 0 ? (
                                <div className="text-[10px] text-center text-muted-foreground py-2">
                                  {canBookCell ? "ว่าง · คลิกเพื่อจอง" : "ว่าง"}
                                </div>
                              ) : bookings.map((b: any) => {
                                const mine = b.created_by === userId;
                                return (
                                  <div key={b.id} className={`rounded-md border p-1.5 space-y-0.5 ${mine ? "bg-primary/10 border-primary/40" : "bg-muted/40"}`}>
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-semibold truncate" title={b.subject_name || ""}>{b.subject_name || "(ไม่ระบุวิชา)"}</span>
                                      {(mine || isAdmin || isDirector) && (
                                        <button onClick={(e) => { e.stopPropagation(); cancelBooking(b); }} className="text-destructive hover:opacity-70">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="font-semibold text-foreground truncate flex items-center gap-1" title={`จองโดย ${b.teacher_name}`}>
                                      <User className="w-3 h-3 text-primary" />{b.teacher_name}
                                    </div>
                                    {b.classroom_name && <div className="text-muted-foreground truncate">ชั้น {b.classroom_name}</div>}
                                    {b.topic && <div className="text-muted-foreground italic line-clamp-1" title={b.topic}>"{b.topic}"</div>}
                                  </div>
                                );
                              })}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เวลา</TableHead>
                    <TableHead>วิชา</TableHead>
                    <TableHead>ชั้น</TableHead>
                    <TableHead>ครู</TableHead>
                    <TableHead>หัวข้อ/กิจกรรม</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ยังไม่มีการจองที่จะถึง</TableCell></TableRow>
                  ) : filteredBookings.map((b: any) => {
                    const mine = b.created_by === userId;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm">{fmtDate(b.booking_date)}</TableCell>
                        <TableCell className="text-sm font-mono">{b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}</TableCell>
                        <TableCell className="font-medium">{b.subject_name || "-"}</TableCell>
                        <TableCell>{b.classroom_name || "-"}</TableCell>
                        <TableCell>{b.teacher_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{b.topic || "-"}</TableCell>
                        <TableCell className="text-right">
                          {(mine || isAdmin || isDirector) && (
                            <Button size="icon" variant="ghost" onClick={() => cancelBooking(b)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>จองห้องพิเศษ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ห้องที่ต้องการจอง *</Label>
              <Select value={bRoomId} onValueChange={setBRoomId}>
                <SelectTrigger><SelectValue placeholder="-- เลือกห้อง --" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {rooms.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}{r.location ? ` · ${r.location}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ประเภทการจอง</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setBMode("single")}
                  className={`rounded-md border px-3 py-2 text-sm text-left transition ${bMode === "single" ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:bg-muted/40"}`}
                >
                  📅 รายครั้ง
                  <div className="text-[11px] font-normal text-muted-foreground">จองเฉพาะวันที่เลือก</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBMode("semester")}
                  className={`rounded-md border px-3 py-2 text-sm text-left transition ${bMode === "semester" ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:bg-muted/40"}`}
                >
                  🔁 รายเทอม (ทุกสัปดาห์)
                  <div className="text-[11px] font-normal text-muted-foreground">จองวันเดียวกัน เวลาเดียวกัน ทุกสัปดาห์</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {bMode === "single" ? (
                <div className="col-span-3">
                  <Label>วันที่</Label>
                  <Input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} />
                  {bDate && <p className="text-xs text-muted-foreground mt-1">{fmtDate(bDate)}</p>}
                </div>
              ) : (
                <div className="col-span-3">
                  <Label>วันในสัปดาห์</Label>
                  <Select value={String(bDow)} onValueChange={(v) => setBDow(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d.val} value={String(d.val)}>วัน{d.th}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-primary mt-1">
                    จองทุกวัน{DAYS.find((x) => x.val === bDow)?.th} ตลอดภาคเรียนที่ {currentSemester}/{currentAcademicYear}
                    {" "}({isoDate(semesterRange.start)} – {isoDate(semesterRange.end)})
                  </p>
                </div>
              )}
              <div className="col-span-3">
                <Label>เลือกคาบ *</Label>
                <Select
                  value={bPeriod}
                  onValueChange={(v) => {
                    setBPeriod(v);
                    const slot = periodSlots.find((s) => String(s.period) === v);
                    if (slot) { setBStart(slot.start); setBEnd(slot.end); }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="-- เลือกคาบ --" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {periodSlots.map((s) => (
                      <SelectItem key={s.period} value={String(s.period)}>
                        คาบ {s.period} · {s.start}–{s.end}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">เวลาจะถูกกำหนดอัตโนมัติตามคาบที่เลือก (ปรับโครงสร้างคาบได้ที่หน้าตารางเรียน → ตั้งค่า)</p>
              </div>
              <div>
                <Label>เวลาเริ่ม</Label>
                <Time24Input withSeconds={false} value={bStart} onChange={(v) => setBStart(v)} />
              </div>
              <div className="col-span-2">
                <Label>เวลาสิ้นสุด</Label>
                <Time24Input withSeconds={false} value={bEnd} onChange={(v) => setBEnd(v)} />
              </div>
            </div>




            <div>
              <Label>วิชาของคุณ</Label>
              {subjectOptions.length === 0 ? (
                <p className="text-xs text-amber-600 mt-1">ยังไม่มีวิชาที่ได้รับมอบหมาย — สามารถจองได้แต่จะไม่มีวิชาแนบ</p>
              ) : (
                <Select value={bSubjectId} onValueChange={setBSubjectId}>
                  <SelectTrigger><SelectValue placeholder="-- เลือกวิชา --" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {subjectOptions.map((r: any) => (
                      <SelectItem key={r.subject_id} value={r.subject_id}>
                        <span className="font-mono text-xs mr-2">{r.subjects?.code}</span>
                        {r.subjects?.name_th}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>ห้องเรียนที่จะนำมาเรียน (ไม่บังคับ)</Label>
              <Select value={bClassroomId} onValueChange={setBClassroomId}>
                <SelectTrigger><SelectValue placeholder="-- เลือกห้องเรียน --" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {classrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>หัวข้อ/กิจกรรม (ไม่บังคับ)</Label>
              <Input value={bTopic} onChange={(e) => setBTopic(e.target.value)} placeholder="เช่น เรียนรู้เรื่องระบบสุริยะ" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={submit} disabled={!canBook}>ยืนยันการจอง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
