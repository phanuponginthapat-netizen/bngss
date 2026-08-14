import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { swal } from "@/lib/swal";
import { MapPin, Plus, CalendarClock, Users, CheckCircle2, XCircle, Clock3, LogOut, ClipboardList, ArrowLeft, Search, ShieldCheck, Crosshair, ImagePlus, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import TripPhotosTab from "@/components/offsite/TripPhotosTab";
import { getCurrentCoords, reverseGeocode, mapsLink, formatCoords } from "@/lib/geolocation";

type Trip = {
  id: string;
  title: string;
  purpose: string | null;
  destination: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_address: string | null;
  start_at: string;
  end_at: string;
  leader_personnel_id: string | null;
  transportation: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_reason: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "แบบร่าง", cls: "bg-slate-500/15 text-slate-600" },
  submitted: { label: "รออนุมัติ", cls: "bg-amber-500/15 text-amber-600" },
  approved: { label: "อนุมัติแล้ว", cls: "bg-emerald-500/15 text-emerald-600" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-rose-500/15 text-rose-600" },
  ongoing: { label: "กำลังดำเนินการ", cls: "bg-sky-500/15 text-sky-600" },
  completed: { label: "เสร็จสิ้น", cls: "bg-violet-500/15 text-violet-600" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-500/15 text-slate-500" },
};

const ATT_META: Record<string, { label: string; cls: string; icon: any }> = {
  expected: { label: "รอเช็ค", cls: "bg-slate-100 text-slate-600", icon: Clock3 },
  present: { label: "มา", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  absent: { label: "ขาด", cls: "bg-rose-100 text-rose-700", icon: XCircle },
  late: { label: "สาย", cls: "bg-amber-100 text-amber-700", icon: Clock3 },
  left_early: { label: "กลับก่อน", cls: "bg-orange-100 text-orange-700", icon: LogOut },
  excused: { label: "ลา", cls: "bg-sky-100 text-sky-700", icon: ShieldCheck },
};

function formatDT(s: string | null) {
  if (!s) return "-";
  try {
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
    }).format(new Date(s));
  } catch { return s; }
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function OffsiteTripsPage() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "director";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["offsite_trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_offsite_trips")
        .select("*")
        .order("start_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });

  if (selectedId) {
    return <TripDetail tripId={selectedId} isAdmin={isAdmin} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-500" />
            พานักเรียนออกนอกพื้นที่
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            บันทึกทริป/อบรม/กิจกรรมนอกโรงเรียน · เช็คชื่อนักเรียนรายบุคคล
          </p>
        </div>
        <CreateTripDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["offsite_trips"] })} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            รายการทริปนอกพื้นที่
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
          ) : trips.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีทริป — กดปุ่ม "สร้างทริป" ด้านบนเพื่อเริ่มต้น
            </div>
          ) : (
            <div className="divide-y">
              {trips.map((t) => {
                const meta = STATUS_META[t.status] ?? STATUS_META.draft;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold truncate">{t.title}</div>
                          <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                        </div>
                        {t.destination && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {t.destination}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" /> {formatDT(t.start_at)} — {formatDT(t.end_at)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateTripDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "",
    purpose: "",
    destination: "",
    start_at: toLocalInput(new Date()),
    end_at: toLocalInput(new Date(Date.now() + 4 * 3600 * 1000)),
    transportation: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) { swal.toast.error("กรุณากรอกชื่อกิจกรรม"); return; }
    if (new Date(form.end_at) <= new Date(form.start_at)) { swal.toast.error("เวลาสิ้นสุดต้องหลังเวลาเริ่ม"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("student_offsite_trips").insert({
        title: form.title.trim(),
        purpose: form.purpose.trim() || null,
        destination: form.destination.trim() || null,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        transportation: form.transportation.trim() || null,
        notes: form.notes.trim() || null,
        status: "submitted",
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
      swal.toast.success("สร้างทริปสำเร็จ");
      onOpenChange(false);
      onCreated();
      setForm({ ...form, title: "", purpose: "", destination: "", transportation: "", notes: "" });
    } catch (e: any) {
      swal.toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" />สร้างทริป</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>สร้างทริปนอกพื้นที่</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>ชื่อกิจกรรม *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น แข่งขันตอบปัญหาวิชาการ" />
          </div>
          <div>
            <Label>วัตถุประสงค์</Label>
            <Textarea rows={2} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>
          <div>
            <Label>สถานที่/จุดหมาย</Label>
            <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="เช่น หอประชุม สพป., มหาวิทยาลัย XYZ" />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Button type="button" size="sm" variant="outline" className="gap-1" disabled={locating} onClick={pickCurrentLocation}>
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />} ดึงพิกัดปัจจุบัน
              </Button>
              {form.lat != null && form.lng != null && (
                <a href={mapsLink(form.lat, form.lng)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {formatCoords(form.lat, form.lng)}
                </a>
              )}
            </div>
            {form.address && <p className="text-[11px] text-muted-foreground mt-1">{form.address}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>เริ่ม *</Label>
              <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
            </div>
            <div>
              <Label>สิ้นสุด *</Label>
              <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>ยานพาหนะ</Label>
            <Input value={form.transportation} onChange={(e) => setForm({ ...form, transportation: e.target.value })} placeholder="เช่น รถบัสโรงเรียน, รถตู้เช่า" />
          </div>
          <div>
            <Label>หมายเหตุ</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกและส่งอนุมัติ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Trip detail + attendance ============ */

function TripDetail({ tripId, isAdmin, onBack }: { tripId: string; isAdmin: boolean; onBack: () => void }) {
  const qc = useQueryClient();

  const { data: trip } = useQuery({
    queryKey: ["offsite_trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_offsite_trips").select("*").eq("id", tripId).maybeSingle();
      if (error) throw error;
      return data as Trip;
    },
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["offsite_parts", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_offsite_participants")
        .select("*, students(id, first_name, last_name, student_code, classrooms(grade_level, name))")
        .eq("trip_id", tripId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (status: string, extra: any = {}) => {
    const { error } = await supabase.from("student_offsite_trips").update({ status, ...extra } as any).eq("id", tripId);
    if (error) { swal.toast.error(error.message); return; }
    swal.toast.success("อัพเดตสถานะแล้ว");
    qc.invalidateQueries({ queryKey: ["offsite_trip", tripId] });
    qc.invalidateQueries({ queryKey: ["offsite_trips"] });
  };

  const meta = trip ? (STATUS_META[trip.status] ?? STATUS_META.draft) : STATUS_META.draft;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ArrowLeft className="w-4 h-4" />กลับ</Button>
      {!trip ? (
        <div className="p-8 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-xl">{trip.title}</CardTitle>
                  <div className="text-sm text-muted-foreground mt-1">
                    {trip.destination && <span className="mr-3">📍 {trip.destination}</span>}
                    <span>🕒 {formatDT(trip.start_at)} — {formatDT(trip.end_at)}</span>
                  </div>
                  {trip.purpose && <p className="text-sm mt-2">{trip.purpose}</p>}
                </div>
                <Badge className={meta.cls}>{meta.label}</Badge>
              </div>
            </CardHeader>
            {isAdmin && trip.status === "submitted" && (
              <CardContent className="pt-0 flex gap-2 flex-wrap">
                <Button onClick={() => updateStatus("approved", { approved_at: new Date().toISOString() })} className="bg-emerald-600 hover:bg-emerald-700">อนุมัติ</Button>
                <Button variant="destructive" onClick={async () => {
                  const reason = await swal.prompt("เหตุผลที่ไม่อนุมัติ");
                  if (reason) updateStatus("rejected", { rejected_reason: reason });
                }}>ไม่อนุมัติ</Button>

              </CardContent>
            )}
            {trip.status === "approved" && (
              <CardContent className="pt-0 flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => updateStatus("ongoing")}>เริ่มดำเนินการ</Button>
              </CardContent>
            )}
            {trip.status === "ongoing" && (
              <CardContent className="pt-0 flex gap-2 flex-wrap">
                <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => updateStatus("completed")}>ปิดทริป (เสร็จสิ้น)</Button>
              </CardContent>
            )}
          </Card>

          <Tabs defaultValue="attendance">
            <TabsList>
              <TabsTrigger value="attendance"><Users className="w-4 h-4 mr-1" />เช็คชื่อนักเรียน ({parts.length})</TabsTrigger>
              <TabsTrigger value="add">เพิ่มนักเรียน</TabsTrigger>
            </TabsList>
            <TabsContent value="attendance">
              <AttendanceList tripId={tripId} parts={parts} onChanged={() => qc.invalidateQueries({ queryKey: ["offsite_parts", tripId] })} />
            </TabsContent>
            <TabsContent value="add">
              <AddStudentsPanel tripId={tripId} existingIds={parts.map((p: any) => p.student_id)} onAdded={() => qc.invalidateQueries({ queryKey: ["offsite_parts", tripId] })} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function AttendanceList({ tripId, parts, onChanged }: { tripId: string; parts: any[]; onChanged: () => void }) {
  const setStatus = async (id: string, status: string) => {
    const now = new Date().toISOString();
    const patch: any = { attendance_status: status };
    if (status === "present" || status === "late") patch.check_in_at = now;
    if (status === "left_early") patch.check_out_at = now;
    const { error } = await supabase.from("student_offsite_participants").update(patch).eq("id", id);
    if (error) { swal.toast.error(error.message); return; }
    onChanged();
  };

  const bulkMark = async (status: string) => {
    const ok = await swal.confirm({ title: `ทำเครื่องหมาย "${ATT_META[status].label}" ให้ทุกคน?` });
    if (!ok) return;

    const now = new Date().toISOString();
    const patch: any = { attendance_status: status };
    if (status === "present") patch.check_in_at = now;
    const { error } = await supabase.from("student_offsite_participants").update(patch).eq("trip_id", tripId);
    if (error) { swal.toast.error(error.message); return; }
    onChanged();
    swal.toast.success("อัพเดตแล้ว");
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: parts.length };
    for (const p of parts) c[p.attendance_status] = (c[p.attendance_status] ?? 0) + 1;
    return c;
  }, [parts]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            รวม {counts.total || 0} คน · มา {counts.present ?? 0} · ขาด {counts.absent ?? 0} · สาย {counts.late ?? 0} · กลับก่อน {counts.left_early ?? 0} · ลา {counts.excused ?? 0}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkMark("present")}>ทำเครื่องหมาย "มา" ทั้งหมด</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {parts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">ยังไม่มีรายชื่อ — ไปแท็บ "เพิ่มนักเรียน"</div>
        ) : (
          <div className="divide-y">
            {parts.map((p: any) => {
              const s = p.students;
              const m = ATT_META[p.attendance_status] ?? ATT_META.expected;
              return (
                <div key={p.id} className="p-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s ? `${s.first_name} ${s.last_name}` : "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {s?.student_code} {s?.classrooms ? `· ${s.classrooms.grade_level}/${s.classrooms.name}` : ""}
                    </div>
                    {p.check_in_at && <div className="text-xs text-emerald-600 mt-0.5">เช็คอิน: {formatDT(p.check_in_at)}</div>}
                  </div>
                  <Badge variant="outline" className={m.cls}>{m.label}</Badge>
                  <Select value={p.attendance_status} onValueChange={(v) => setStatus(p.id, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ATT_META).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddStudentsPanel({ tripId, existingIds, onAdded }: { tripId: string; existingIds: string[]; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students_search", q, grade],
    queryFn: async () => {
      let query = supabase.from("students")
        .select("id, first_name, last_name, student_code, classrooms(grade_level, name)")
        .eq("status", "active")
        .order("student_code")
        .limit(200);
      if (q.trim()) {
        const t = `%${q.trim()}%`;
        query = query.or(`first_name.ilike.${t},last_name.ilike.${t},student_code.ilike.${t}`);
      }
      if (grade) (query as any) = (query as any).eq("classrooms.grade_level", grade);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = async (studentId: string) => {
    const { error } = await supabase.from("student_offsite_participants").insert({
      trip_id: tripId,
      student_id: studentId,
      attendance_status: "expected",
    } as any);
    if (error) { swal.toast.error(error.message); return; }
    onAdded();
  };

  const addAllVisible = async () => {
    const toAdd = students.filter((s: any) => !existingIds.includes(s.id));
    if (!toAdd.length) { swal.toast.info("ทุกคนถูกเพิ่มแล้ว"); return; }
    const ok = await swal.confirm({ title: `เพิ่มนักเรียนทั้งหมด ${toAdd.length} คน?` });
    if (!ok) return;

    const rows = toAdd.map((s: any) => ({ trip_id: tripId, student_id: s.id, attendance_status: "expected" }));
    const { error } = await supabase.from("student_offsite_participants").insert(rows as any);
    if (error) { swal.toast.error(error.message); return; }
    swal.toast.success(`เพิ่ม ${toAdd.length} คน`);
    onAdded();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ/รหัสนักเรียน" className="pl-8 h-9" />
          </div>
          <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="ชั้น (เช่น ม.3)" className="w-32 h-9" />
          <Button variant="outline" size="sm" onClick={addAllVisible}>เพิ่มทั้งหมดที่แสดง</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : (
          <div className="divide-y max-h-[500px] overflow-auto">
            {students.map((s: any) => {
              const already = existingIds.includes(s.id);
              return (
                <div key={s.id} className="p-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.first_name} {s.last_name}</div>
                    <div className="text-xs text-muted-foreground">{s.student_code} {s.classrooms ? `· ${s.classrooms.grade_level}/${s.classrooms.name}` : ""}</div>
                  </div>
                  <Button size="sm" variant={already ? "ghost" : "default"} disabled={already} onClick={() => add(s.id)}>
                    {already ? "เพิ่มแล้ว" : "เพิ่ม"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
