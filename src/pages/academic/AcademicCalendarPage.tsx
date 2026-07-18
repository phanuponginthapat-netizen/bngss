import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, Plus, ChevronLeft, ChevronRight, MapPin, Trash2, Edit, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { BEDatePicker } from "@/components/ui/be-date-picker";

const ICS_FEED_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/calendar-ics`;

const EVENT_TYPES = [
  { value: "activity", label: "กิจกรรม", color: "bg-info-soft text-info" },
  { value: "exam", label: "สอบ", color: "bg-danger-soft text-danger" },
  { value: "meeting", label: "ประชุม", color: "bg-info-soft text-info" },
  { value: "holiday", label: "วันหยุด", color: "bg-success-soft text-success" },
  { value: "ceremony", label: "พิธีการ", color: "bg-warning-soft text-warning" },
  { value: "training", label: "อบรม/สัมมนา", color: "bg-success-soft text-success" },
  { value: "other", label: "อื่นๆ", color: "bg-muted text-muted-foreground" },
];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const AcademicCalendarPage = () => {
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const qc = useQueryClient();
  const canManage = role === "admin" || role === "director";
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", event_date: "", end_date: "", event_type: "activity", location: "",
  });

  const { data: events = [] } = useQuery({
    queryKey: ["academic_events"],
    queryFn: async () => {
      const { data } = await supabase.from("academic_events").select("*").order("event_date");
      return data || [];
    },
  });

  const resetForm = () => {
    setForm({ title: "", description: "", event_date: "", end_date: "", event_type: "activity", location: "" });
    setEditingEvent(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.event_date) {
      toast.error("กรุณากรอกชื่อกิจกรรมและวันที่");
      return;
    }

    const payload = {
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      end_date: form.end_date || null,
      event_type: form.event_type,
      location: form.location || null,
      academic_year: new Date(form.event_date).getFullYear(),
    };

    if (editingEvent) {
      const { error } = await supabase.from("academic_events").update(payload).eq("id", editingEvent.id);
      if (error) { toast.error(error.message); return; }
      toast.success("แก้ไขกิจกรรมสำเร็จ");
    } else {
      const { error } = await supabase.from("academic_events").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("เพิ่มกิจกรรมสำเร็จ");
    }

    qc.invalidateQueries({ queryKey: ["academic_events"] });
    setOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("academic_events").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบกิจกรรมสำเร็จ");
    qc.invalidateQueries({ queryKey: ["academic_events"] });
  };

  const handleEdit = (ev: any) => {
    setForm({
      title: ev.title,
      description: ev.description || "",
      event_date: ev.event_date,
      end_date: ev.end_date || "",
      event_type: ev.event_type,
      location: ev.location || "",
    });
    setEditingEvent(ev);
    setOpen(true);
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
    if (canManage) {
      setForm({ ...form, event_date: dateStr });
    }
  };

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [startDow, daysInMonth]);

  const getEventsForDate = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e: any) => {
      if (e.event_date === dateStr) return true;
      if (e.end_date && e.event_date <= dateStr && e.end_date >= dateStr) return true;
      return false;
    });
  };

  const getTypeInfo = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[6];

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Events for selected date panel
  const selectedDateEvents = selectedDate
    ? events.filter((e: any) => {
        if (e.event_date === selectedDate) return true;
        if (e.end_date && e.event_date <= selectedDate && e.end_date >= selectedDate) return true;
        return false;
      })
    : [];

  // Upcoming events (next 7 days)
  const upcomingEvents = events.filter((e: any) => {
    const d = new Date(e.event_date);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            {lang === "th" ? "ปฏิทินวิชาการ" : "Academic Calendar"}
          </h1>
          <p className="text-sm text-muted-foreground">จัดการกิจกรรม งาน และเหตุการณ์สำคัญตลอดปีการศึกษา</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(ICS_FEED_URL)}`, "_blank")}
            title={lang === "th" ? "เพิ่มเข้า Google Calendar" : "Add to Google Calendar"}
          >
            <ExternalLink className="w-4 h-4 mr-1" /> Google Calendar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(ICS_FEED_URL, "_blank")}
            title={lang === "th" ? "ดาวน์โหลด ICS / Subscribe" : "Download ICS / Subscribe"}
          >
            <Download className="w-4 h-4 mr-1" /> ICS Feed
          </Button>
        {canManage && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่มกิจกรรม</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingEvent ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรมใหม่"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>ชื่อกิจกรรม *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="เช่น กิจกรรมวันเด็ก" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>วันที่เริ่ม *</Label><BEDatePicker value={form.event_date} onChange={(v) => setForm({ ...form, event_date: v })} /></div>
                  <div><Label>วันที่สิ้นสุด</Label><BEDatePicker value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>ประเภท</Label>
                    <Select value={form.event_type} onValueChange={v => setForm({ ...form, event_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>สถานที่</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="เช่น หอประชุม" /></div>
                </div>
                <div><Label>รายละเอียด</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <Button onClick={handleSave} className="w-full">{editingEvent ? "บันทึกการแก้ไข" : "บันทึกกิจกรรม"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-5 h-5" /></Button>
              <CardTitle className="text-lg">{THAI_MONTHS[viewMonth]} {viewYear + 543}</CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-5 h-5" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {THAI_DAYS.map(d => (
                <div key={d} className="bg-muted p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} className="bg-background p-1 min-h-[70px]" />;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = getEventsForDate(day);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                return (
                  <div
                    key={`d-${day}`}
                    className={`bg-background p-1 min-h-[70px] cursor-pointer transition-colors hover:bg-accent/30 ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                    onClick={() => handleDateClick(dateStr)}
                  >
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {dayEvents.slice(0, 2).map((ev: any) => {
                        const info = getTypeInfo(ev.event_type);
                        return (
                          <div key={ev.id} className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${info.color}`}>
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2} อื่นๆ</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Selected date events */}
          {selectedDate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  📅 {new Date(selectedDate + "T00:00:00").toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่มีกิจกรรม</p>
                ) : (
                  selectedDateEvents.map((ev: any) => {
                    const info = getTypeInfo(ev.event_type);
                    return (
                      <div key={ev.id} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Badge className={`${info.color} text-[10px]`}>{info.label}</Badge>
                            <p className="font-semibold text-sm mt-1">{ev.title}</p>
                          </div>
                          {canManage && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(ev)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(ev.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                        {ev.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {ev.location}
                          </p>
                        )}
                        {ev.end_date && ev.end_date !== ev.event_date && (
                          <p className="text-xs text-muted-foreground">
                            ถึง {new Date(ev.end_date + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
                {canManage && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setForm({ ...form, event_date: selectedDate }); setOpen(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มกิจกรรมวันนี้
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🔔 กิจกรรมที่กำลังจะมาถึง</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่มีกิจกรรมใน 7 วันข้างหน้า</p>
              ) : (
                upcomingEvents.map((ev: any) => {
                  const info = getTypeInfo(ev.event_type);
                  return (
                    <div key={ev.id} className="flex items-start gap-2 text-sm border-b border-border pb-2 last:border-0">
                      <Badge className={`${info.color} text-[10px] mt-0.5 shrink-0`}>{info.label}</Badge>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ev.event_date + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Type Legend */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">ประเภทกิจกรรม</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map(t => (
                  <Badge key={t.value} className={`${t.color} text-[10px]`}>{t.label}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AcademicCalendarPage;
