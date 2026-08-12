import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Check, X, Clock, FileText, Send, CalendarDays, Paperclip } from "lucide-react";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { uploadLeaveAttachment, openLeaveAttachment } from "@/lib/leaveAttachment";
import NotificationHighlightScroller from "@/components/NotificationHighlightScroller";
import { todayBangkok, bkkDateISO } from "@/lib/dateBE";

const LEAVE_TYPES = [
  { value: "sick", th: "ลาป่วย", en: "Sick Leave" },
  { value: "personal", th: "ลากิจส่วนตัว", en: "Personal Leave" },
  { value: "annual", th: "ลาพักผ่อน", en: "Annual Leave" },
  { value: "maternity", th: "ลาคลอดบุตร", en: "Maternity Leave" },
  { value: "ordination", th: "ลาอุปสมบท", en: "Ordination Leave" },
  { value: "training", th: "ลาไปอบรม/สัมมนา", en: "Training Leave" },
  { value: "other", th: "อื่นๆ", en: "Other" },
];

const StaffLeavePage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { role, userId, isAdmin, isDirector, isTeacher } = useUserRole();
  const canApprove = isAdmin || isDirector;

  const [open, setOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const location = useLocation();

  // Form state
  const [personnelId, setPersonnelId] = useState("");
  const [leaveType, setLeaveType] = useState("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [actingTeacher, setActingTeacher] = useState("");
  const [substitutePlan, setSubstitutePlan] = useState<Record<string, string>>({});
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);


  // Get current user's personnel record
  const { data: myPersonnel } = useQuery({
    queryKey: ["my-personnel-leave", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("employee_code, phone").eq("id", userId!).maybeSingle();
      if (!profile?.employee_code) return null;
      const { data } = await supabase.from("personnel").select("*").eq("employee_code", profile.employee_code).maybeSingle();
      return data ? { ...data, profile_phone: profile.phone } : null;
    },
  });

  // Auto-fill personnelId for non-admin users
  useEffect(() => {
    if (myPersonnel && !canApprove && !personnelId) {
      setPersonnelId(myPersonnel.id);
    }
    if (myPersonnel && (myPersonnel as any).profile_phone && !contactPhone) {
      setContactPhone((myPersonnel as any).profile_phone || "");
    }
  }, [myPersonnel, canApprove]);

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("*").eq("status", "active").order("first_name");
      return data || [];
    },
  });

  // ---- Per-period substitute planning ----
  const applicantId = canApprove ? personnelId : myPersonnel?.id || "";
  const applicant: any = personnel.find((p: any) => p.id === applicantId) || (applicantId === myPersonnel?.id ? myPersonnel : null);
  const applicantFullName = applicant
    ? `${applicant.prefix || ""}${applicant.first_name} ${applicant.last_name}`
    : "";

  // list of dates in the leave range (max 31 days)
  const leaveDates: string[] = (() => {
    if (!startDate || !endDate) return [];
    const out: string[] = [];
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate + "T00:00:00");
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return [];
    for (let d = new Date(s); d <= e && out.length < 31; d.setDate(d.getDate() + 1)) {
      out.push(bkkDateISO(d));
    }
    return out;
  })();

  const { data: mySchedule = [] } = useQuery({
    queryKey: ["my-teaching-schedule", applicantFullName],
    enabled: !!applicantFullName,
    queryFn: async () => {
      const { data } = await supabase
        .from("schedules")
        .select("id, day_of_week, period, room, subject_name_raw, classroom_id, subject_id")
        .eq("teacher_name", applicantFullName)
        .order("period");
      return data || [];
    },
  });

  const { data: classroomMap = {} } = useQuery({
    queryKey: ["classroom-names-leave"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("id, grade_level, room_number");
      const map: Record<string, string> = {};
      (data || []).forEach((c: any) => { map[c.id] = `${c.grade_level}/${c.room_number}`; });
      return map;
    },
  });

  // slots that need a substitute: one per (date, period) in the leave range
  const leaveSlots = leaveDates.flatMap((date) => {
    const dow = ((new Date(date + "T00:00:00").getDay() + 6) % 7) + 1; // Mon=1..Sun=7
    return mySchedule
      .filter((s: any) => s.day_of_week === dow)
      .map((s: any) => ({
        key: `${date}|${s.period}`,
        date,
        period: s.period as number,
        subject: s.subject_name_raw || "-",
        classroom: s.classroom_id ? classroomMap[s.classroom_id] || "" : "",
      }));
  });



  const { data: records = [] } = useQuery({
    queryKey: ["staff_leaves", canApprove ? "all" : myPersonnel?.id],
    enabled: canApprove || !!myPersonnel?.id,
    queryFn: async () => {
      let q = supabase.from("staff_leaves").select("*").order("created_at", { ascending: false });
      // Teachers see only their own leaves
      if (!canApprove && myPersonnel?.id) {
        q = q.eq("personnel_id", myPersonnel.id);
      }
      const { data } = await q;
      return data || [];
    },
  });

  // If arriving from a notification with ?highlight=<id>, auto-switch to the tab
  // containing that record so the user actually sees the request.
  useEffect(() => {
    const highlight = new URLSearchParams(location.search).get("highlight");
    if (!highlight || records.length === 0) return;
    const found = records.find((r: any) => r.id === highlight);
    if (found && (found.status === "pending" || found.status === "approved" || found.status === "rejected")) {
      setTab(found.status);
    } else {
      setTab("all");
    }
  }, [location.search, records]);


  const resetForm = () => {
    if (canApprove) setPersonnelId("");
    setLeaveType("sick"); setStartDate(""); setEndDate("");
    setReason(""); setContactPhone((myPersonnel as any)?.profile_phone || ""); setActingTeacher("");
    setAttachment(null);
  };

  const sendGoogleChatNotification = async (message: string, department: string) => {
    try {
      await supabase.functions.invoke("notify-google-chat", {
        body: { message, department },
      });
    } catch (err) {
      console.error("Failed to send Google Chat notification:", err);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const targetPersonnelId = canApprove ? personnelId : myPersonnel?.id;
    if (!targetPersonnelId || !startDate || !endDate || !reason) {
      toast.error(lang === "th" ? "กรุณากรอกข้อมูลให้ครบถ้วน" : "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const person = personnel.find((p: any) => p.id === targetPersonnelId);

      // Client-side pre-check to prevent double-submit creating duplicate rows
      const { data: existing } = await supabase
        .from("staff_leaves")
        .select("id")
        .eq("personnel_id", targetPersonnelId)
        .eq("leave_type", leaveType)
        .eq("start_date", startDate)
        .eq("end_date", endDate)
        .limit(1);
      if (existing && existing.length > 0) {
        toast.error(lang === "th" ? "มีใบลาซ้ำในช่วงวันเดียวกันอยู่แล้ว" : "A leave for the same dates already exists");
        return;
      }

      let attachmentPath: string | null = null;
      try {
        if (attachment) {
          attachmentPath = await uploadLeaveAttachment(attachment, targetPersonnelId);
        }
      } catch (e: any) {
        toast.error((lang === "th" ? "อัปโหลดไฟล์แนบล้มเหลว: " : "Attachment upload failed: ") + e.message);
        return;
      }
      const normalizedActingTeacher = actingTeacher && actingTeacher !== "none" ? actingTeacher : "";
      const { error } = await supabase.from("staff_leaves").insert({
        personnel_id: targetPersonnelId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
        contact_phone: contactPhone,
        acting_teacher: normalizedActingTeacher,
        attachment_url: attachmentPath,
      } as any);

      if (error) {
        const dup = /duplicate|unique|uniq_staff_leaves_pending/i.test(error.message);
        toast.error(dup
          ? (lang === "th" ? "มีใบลาซ้ำในช่วงวันเดียวกันอยู่แล้ว (รออนุมัติ)" : "A pending leave for the same dates already exists")
          : error.message);
        return;
      }

      const leaveLabel = LEAVE_TYPES.find(t => t.value === leaveType)?.th || leaveType;
      toast.success(lang === "th" ? "ยื่นใบลาสำเร็จ" : "Leave request submitted");

      // Google Chat / LINE notifications are already sent by database triggers (trg_gchat_staff_leave, line_vault_staff_leave_ins).
      // Do NOT call sendGoogleChatNotification here or the message will be duplicated.

      qc.invalidateQueries({ queryKey: ["staff_leaves"] });
      setOpen(false);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    console.log("[StaffLeave] approve clicked", { id, role, canApprove });
    const record = records.find((r: any) => r.id === id);
    const { data: updated, error: updErr } = await supabase
      .from("staff_leaves")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: role || "admin",
      } as any)
      .eq("id", id)
      .select();

    console.log("[StaffLeave] approve result", { updated, updErr });

    if (updErr) {
      toast.error((lang === "th" ? "อนุมัติไม่สำเร็จ: " : "Approve failed: ") + updErr.message);
      return;
    }
    if (!updated || updated.length === 0) {
      toast.error(lang === "th" ? "ไม่มีสิทธิ์อนุมัติ (RLS)" : "Not allowed to approve (RLS)");
      return;
    }

    toast.success(lang === "th" ? "อนุมัติสำเร็จ" : "Approved");

    if (record) {
      const person = personnel.find((p: any) => p.id === (record as any).personnel_id);
      if (person) {
        await sendGoogleChatNotification(
          `✅ *อนุมัติการลา*\n👤 ${(person as any).prefix || ""}${(person as any).first_name} ${(person as any).last_name}\n📅 ${(record as any).start_date} ถึง ${(record as any).end_date}\n🟢 สถานะ: อนุมัติแล้ว`,
          "hr"
        );
        if ((person as any).user_id) {
          await notify({
            user_ids: [(person as any).user_id],
            title: "✅ ใบลาได้รับการอนุมัติ",
            body: `วันที่ ${(record as any).start_date} ถึง ${(record as any).end_date}`,
            type: "staff_leave_approved",
            severity: "success",
            reference_id: (record as any).id,
            reference_type: "staff_leaves",
            url: "/dashboard/hr/leave",
            channels: ["in_app", "push", "line"],
          });
        }
      }

      // Auto create substitute teaching record(s) — one per day in the leave range (best-effort)
      try {
        const startD = new Date((record as any).start_date);
        const endD = new Date((record as any).end_date);
        const actingTeacherName = (record as any).acting_teacher && (record as any).acting_teacher !== "none"
          ? (record as any).acting_teacher
          : "";
        const rows: any[] = [];
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          rows.push({
            original_teacher: person ? `${(person as any).first_name} ${(person as any).last_name}` : "",
            substitute_teacher: actingTeacherName,
            teaching_date: bkkDateISO(d),
            period: "ทั้งวัน",
            status: actingTeacherName ? "confirmed" : "pending",
            notes: `อัตโนมัติจากใบลา (${(record as any).start_date} - ${(record as any).end_date})`,
            leave_id: (record as any).id,
          });
        }
        if (rows.length > 0) {
          const { error: subErr } = await supabase.from("substitute_teaching").insert(rows as any);
          if (subErr) console.error("substitute insert failed:", subErr);
        }
      } catch (e) {
        console.error(e);
      }
    }

    qc.invalidateQueries({ queryKey: ["staff_leaves"] });
    qc.invalidateQueries({ queryKey: ["staff_leaves_approved"] });
    qc.invalidateQueries({ queryKey: ["substitute_teaching"] });
  };

  const handleReject = async () => {
    const { data: updated, error: updErr } = await supabase
      .from("staff_leaves")
      .update({
        status: "rejected",
        rejected_reason: rejectReason,
      } as any)
      .eq("id", rejectId)
      .select();

    if (updErr) {
      toast.error((lang === "th" ? "ปฏิเสธไม่สำเร็จ: " : "Reject failed: ") + updErr.message);
      return;
    }
    if (!updated || updated.length === 0) {
      toast.error(lang === "th" ? "ไม่มีสิทธิ์ปฏิเสธ (RLS)" : "Not allowed (RLS)");
      return;
    }

    const record = records.find((r: any) => r.id === rejectId);
    if (record) {
      const person = personnel.find((p: any) => p.id === (record as any).personnel_id);
      if (person) {
        await sendGoogleChatNotification(
          `❌ *ไม่อนุมัติการลา*\n👤 ${(person as any).prefix || ""}${(person as any).first_name} ${(person as any).last_name}\n📅 ${(record as any).start_date} ถึง ${(record as any).end_date}\n🔴 เหตุผล: ${rejectReason || "-"}`,
          "hr"
        );
      }
    }

    toast.success(lang === "th" ? "ปฏิเสธสำเร็จ" : "Rejected");
    qc.invalidateQueries({ queryKey: ["staff_leaves"] });
    qc.invalidateQueries({ queryKey: ["staff_leaves_approved"] });
    setRejectOpen(false);
    setRejectReason("");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("staff_leaves").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["staff_leaves"] });
  };

  const getPersonnelName = (pid: string) => {
    const p = personnel.find((x: any) => x.id === pid);
    return p ? `${(p as any).prefix || ""}${(p as any).first_name} ${(p as any).last_name}` : pid;
  };

  const getLeaveLabel = (type: string) => {
    const t = LEAVE_TYPES.find(l => l.value === type);
    return t ? (lang === "th" ? t.th : t.en) : type;
  };

  const getDayCount = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: lang === "th" ? "รออนุมัติ" : "Pending", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="w-3 h-3" /> },
    approved: { label: lang === "th" ? "อนุมัติ" : "Approved", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <Check className="w-3 h-3" /> },
    rejected: { label: lang === "th" ? "ไม่อนุมัติ" : "Rejected", color: "bg-red-100 text-red-800 border-red-200", icon: <X className="w-3 h-3" /> },
  };

  const pendingRecords = records.filter((r: any) => r.status === "pending");
  const approvedRecords = records.filter((r: any) => r.status === "approved");
  const rejectedRecords = records.filter((r: any) => r.status === "rejected");

  return (
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+8rem)] md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            {lang === "th" ? "ระบบลาออนไลน์" : "Staff Leave Management"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "th" ? "ยื่นใบลา ติดตามสถานะ และอนุมัติการลาของบุคลากร" : "Submit, track, and approve staff leave requests"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {lang === "th" ? "ยื่นใบลา" : "New Request"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                {lang === "th" ? "แบบฟอร์มยื่นใบลา" : "Leave Request Form"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-sm font-medium">{lang === "th" ? "ผู้ยื่นลา *" : "Applicant *"}</Label>
                {canApprove ? (
                  <Select value={personnelId} onValueChange={setPersonnelId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder={lang === "th" ? "เลือกบุคลากร" : "Select staff"} /></SelectTrigger>
                    <SelectContent>
                      {personnel.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.prefix || ""}{p.first_name} {p.last_name} ({p.employee_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : myPersonnel ? (
                  <div className="mt-1 p-3 rounded-lg bg-muted/50 border text-sm font-medium">
                    {(myPersonnel as any).prefix || ""}{(myPersonnel as any).first_name} {(myPersonnel as any).last_name} ({(myPersonnel as any).employee_code})
                  </div>
                ) : (
                  <div className="mt-1 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {lang === "th" ? "ไม่พบข้อมูลบุคลากรที่เชื่อมโยงกับบัญชีนี้ กรุณาติดต่อ Admin" : "No personnel record linked to this account"}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">{lang === "th" ? "ประเภทการลา *" : "Leave Type *"}</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{lang === "th" ? t.th : t.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">{lang === "th" ? "ตั้งแต่วันที่ *" : "From *"}</Label>
                  <BEDatePicker value={startDate} onChange={(v) => setStartDate(v)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium">{lang === "th" ? "ถึงวันที่ *" : "To *"}</Label>
                  <BEDatePicker value={endDate} onChange={(v) => setEndDate(v)} className="mt-1" />
                </div>
              </div>

              {startDate && endDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <CalendarDays className="w-4 h-4" />
                  {lang === "th" ? `จำนวน ${getDayCount(startDate, endDate)} วัน` : `${getDayCount(startDate, endDate)} day(s)`}
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">{lang === "th" ? "เหตุผลการลา *" : "Reason *"}</Label>
                <Textarea className="mt-1" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={lang === "th" ? "ระบุเหตุผลการลา..." : "Describe the reason..."} />
              </div>

              <div>
                <Label className="text-sm font-medium">{lang === "th" ? "เบอร์โทรติดต่อ" : "Contact Phone"}</Label>
                <Input className="mt-1" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
              </div>

              <div>
                <Label className="text-sm font-medium">{lang === "th" ? "ครูผู้สอนแทน" : "Acting Teacher"}</Label>
                <Select value={actingTeacher} onValueChange={setActingTeacher}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={lang === "th" ? "เลือกครูสอนแทน (ถ้ามี)" : "Select substitute (optional)"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lang === "th" ? "ไม่ระบุ" : "None"}</SelectItem>
                    {personnel.filter((p: any) => p.id !== personnelId).map((p: any) => (
                      <SelectItem key={p.id} value={`${p.first_name} ${p.last_name}`}>
                        {p.prefix || ""}{p.first_name} {p.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" />
                  {lang === "th" ? "ไฟล์/รูปแนบ (เช่น ใบรับรองแพทย์)" : "Attachment (e.g. medical certificate)"}
                </Label>
                <Input
                  className="mt-1"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                />
                {attachment && <p className="text-xs text-muted-foreground mt-1">{attachment.name}</p>}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                {lang === "th" ? "ยกเลิก" : "Cancel"}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                <Send className="w-4 h-4" />
                {submitting ? (lang === "th" ? "กำลังส่ง..." : "Submitting...") : (lang === "th" ? "ยื่นใบลา" : "Submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "รออนุมัติ" : "Pending"}</p>
                <p className="text-3xl font-bold text-amber-600">{pendingRecords.length}</p>
              </div>
              <Clock className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "อนุมัติแล้ว" : "Approved"}</p>
                <p className="text-3xl font-bold text-emerald-600">{records.filter((r: any) => r.status === "approved").length}</p>
              </div>
              <Check className="w-10 h-10 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "ทั้งหมด" : "Total"}</p>
                <p className="text-3xl font-bold text-primary">{records.length}</p>
              </div>
              <FileText className="w-10 h-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <NotificationHighlightScroller />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>

        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="w-3.5 h-3.5" />
            {lang === "th" ? `รออนุมัติ (${pendingRecords.length})` : `Pending (${pendingRecords.length})`}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1">
            <Check className="w-3.5 h-3.5" />
            {lang === "th" ? `อนุมัติแล้ว (${approvedRecords.length})` : `Approved (${approvedRecords.length})`}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1">
            <X className="w-3.5 h-3.5" />
            {lang === "th" ? `ไม่อนุมัติ (${rejectedRecords.length})` : `Rejected (${rejectedRecords.length})`}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1">
            <FileText className="w-3.5 h-3.5" />
            {lang === "th" ? "ทั้งหมด" : "All"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {/* Mobile card view - always shows action buttons */}
          <div className="md:hidden space-y-2 pb-20">
            {pendingRecords.map((r: any) => (
              <Card key={r.id} data-notif-id={r.id} className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-sm">{getPersonnelName(r.personnel_id)}</div>
                    <div className="text-xs text-muted-foreground">{getLeaveLabel(r.leave_type)} · {getDayCount(r.start_date, r.end_date)} {lang === "th" ? "วัน" : "d"}</div>
                  </div>
                  <Badge variant="outline" className={`gap-1 text-xs ${statusConfig[r.status]?.color}`}>
                    {statusConfig[r.status]?.icon}
                    {statusConfig[r.status]?.label}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-1">📅 {r.start_date} → {r.end_date}</div>
                {r.reason && <div className="text-xs mb-2 line-clamp-2">💬 {r.reason}</div>}
                {r.attachment_url && (
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1 mb-2" onClick={() => openLeaveAttachment(r.attachment_url).catch(e => toast.error(e.message))}>
                    <Paperclip className="w-3 h-3" />{lang === "th" ? "ดูไฟล์แนบ" : "View attachment"}
                  </Button>
                )}
                <div className="flex gap-2 pt-2 border-t">
                  {canApprove && (
                    <>
                      <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={() => handleApprove(r.id)}>
                        <Check className="w-4 h-4" /> {lang === "th" ? "อนุมัติ" : "Approve"}
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => { setRejectId(r.id); setRejectOpen(true); }}>
                        <X className="w-4 h-4" /> {lang === "th" ? "ไม่อนุมัติ" : "Reject"}
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {pendingRecords.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {lang === "th" ? "ไม่มีรายการรออนุมัติ" : "No pending requests"}
              </Card>
            )}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "th" ? "ผู้ยื่นลา" : "Applicant"}</TableHead>
                    <TableHead>{lang === "th" ? "ประเภท" : "Type"}</TableHead>
                    <TableHead>{lang === "th" ? "วันที่ลา" : "Leave Dates"}</TableHead>
                    <TableHead>{lang === "th" ? "จำนวนวัน" : "Days"}</TableHead>
                    <TableHead>{lang === "th" ? "เหตุผล" : "Reason"}</TableHead>
                    <TableHead>{lang === "th" ? "ครูสอนแทน" : "Substitute"}</TableHead>
                    <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                    <TableHead>{lang === "th" ? "จัดการ" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRecords.map((r: any) => (
                    <TableRow key={r.id} data-notif-id={r.id}>
                      <TableCell className="font-medium">{getPersonnelName(r.personnel_id)}</TableCell>
                      <TableCell>{getLeaveLabel(r.leave_type)}</TableCell>
                      <TableCell className="text-sm">{r.start_date} → {r.end_date}</TableCell>
                      <TableCell>{getDayCount(r.start_date, r.end_date)}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate">{r.reason || "-"}</div>
                        {r.attachment_url && (
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={() => openLeaveAttachment(r.attachment_url).catch(e => toast.error(e.message))}>
                            <Paperclip className="w-3 h-3" />{lang === "th" ? "ดูไฟล์แนบ" : "View"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>{r.acting_teacher || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${statusConfig[r.status]?.color}`}>
                          {statusConfig[r.status]?.icon}
                          {statusConfig[r.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canApprove && (
                            <>
                              <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleApprove(r.id)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { setRejectId(r.id); setRejectOpen(true); }}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        {lang === "th" ? "ไม่มีรายการรออนุมัติ" : "No pending requests"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {(["approved", "rejected"] as const).map((tabKey) => {
          const list = tabKey === "approved" ? approvedRecords : rejectedRecords;
          const emptyText = tabKey === "approved"
            ? (lang === "th" ? "ยังไม่มีรายการที่อนุมัติ" : "No approved requests")
            : (lang === "th" ? "ยังไม่มีรายการที่ไม่อนุมัติ" : "No rejected requests");
          return (
            <TabsContent key={tabKey} value={tabKey}>
              <Card className="mb-20 md:mb-0">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === "th" ? "ผู้ยื่นลา" : "Applicant"}</TableHead>
                        <TableHead>{lang === "th" ? "ประเภท" : "Type"}</TableHead>
                        <TableHead>{lang === "th" ? "วันที่ลา" : "Leave Dates"}</TableHead>
                        <TableHead>{lang === "th" ? "จำนวนวัน" : "Days"}</TableHead>
                        <TableHead>{lang === "th" ? "เหตุผล" : "Reason"}</TableHead>
                        <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                        <TableHead>{tabKey === "approved" ? (lang === "th" ? "อนุมัติเมื่อ" : "Approved at") : (lang === "th" ? "เหตุผลปฏิเสธ" : "Reject reason")}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((r: any) => (
                        <TableRow key={r.id} data-notif-id={r.id}>
                          <TableCell className="font-medium">{getPersonnelName(r.personnel_id)}</TableCell>
                          <TableCell>{getLeaveLabel(r.leave_type)}</TableCell>
                          <TableCell className="text-sm">{r.start_date} → {r.end_date}</TableCell>
                          <TableCell>{getDayCount(r.start_date, r.end_date)}</TableCell>
                          <TableCell className="max-w-[200px]"><div className="truncate">{r.reason || "-"}</div></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${statusConfig[r.status]?.color}`}>
                              {statusConfig[r.status]?.icon}
                              {statusConfig[r.status]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            <div className="truncate">
                              {tabKey === "approved"
                                ? (r.approved_at ? new Date(r.approved_at).toLocaleString("th-TH") : "-")
                                : (r.rejected_reason || "-")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {list.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">{emptyText}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        <TabsContent value="all">
          <Card className="mb-20 md:mb-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "th" ? "ผู้ยื่นลา" : "Applicant"}</TableHead>
                    <TableHead>{lang === "th" ? "ประเภท" : "Type"}</TableHead>
                    <TableHead>{lang === "th" ? "วันที่ลา" : "Leave Dates"}</TableHead>
                    <TableHead>{lang === "th" ? "จำนวนวัน" : "Days"}</TableHead>
                    <TableHead>{lang === "th" ? "เหตุผล" : "Reason"}</TableHead>
                    <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r: any) => (
                    <TableRow key={r.id} data-notif-id={r.id}>
                      <TableCell className="font-medium">{getPersonnelName(r.personnel_id)}</TableCell>
                      <TableCell>{getLeaveLabel(r.leave_type)}</TableCell>
                      <TableCell className="text-sm">{r.start_date} → {r.end_date}</TableCell>
                      <TableCell>{getDayCount(r.start_date, r.end_date)}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate">{r.reason || "-"}</div>
                        {r.attachment_url && (
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={() => openLeaveAttachment(r.attachment_url).catch(e => toast.error(e.message))}>
                            <Paperclip className="w-3 h-3" />{lang === "th" ? "ดูไฟล์แนบ" : "View"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${statusConfig[r.status]?.color}`}>
                          {statusConfig[r.status]?.icon}
                          {statusConfig[r.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        {lang === "th" ? "ไม่มีข้อมูล" : "No data"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "th" ? "ปฏิเสธใบลา" : "Reject Leave Request"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{lang === "th" ? "เหตุผลที่ไม่อนุมัติ" : "Rejection Reason"}</Label>
              <Textarea className="mt-1" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={lang === "th" ? "ระบุเหตุผล..." : "Enter reason..."} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
            <Button variant="destructive" onClick={handleReject}>{lang === "th" ? "ปฏิเสธ" : "Reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffLeavePage;
