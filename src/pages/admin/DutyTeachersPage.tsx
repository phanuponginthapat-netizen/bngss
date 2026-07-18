import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calendar, FileText, MapPin, Users } from "lucide-react";
import { swalError, swalSuccess, swalConfirm } from "@/lib/swal";
import { format } from "date-fns";

type Location = { id: string; name: string; description: string | null; active: boolean; order_index: number };
type Personnel = { id: string; prefix: string | null; first_name: string; last_name: string };
type Assignment = {
  id: string;
  location_id: string;
  teacher_id: string;
  duty_date: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  role_label: string | null;
  notes: string | null;
  duty_locations?: { name: string } | null;
  personnel?: { prefix: string | null; first_name: string; last_name: string } | null;
};
type Log = {
  id: string;
  log_date: string;
  log_time: string;
  category: string | null;
  title: string | null;
  content: string;
  teacher_id: string | null;
  location_id: string | null;
  duty_locations?: { name: string } | null;
  personnel?: { first_name: string; last_name: string } | null;
};

const DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export default function DutyTeachersPage() {
  const [tab, setTab] = useState("today");
  const [locations, setLocations] = useState<Location[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [locDialog, setLocDialog] = useState<{ open: boolean; row?: Location }>({ open: false });
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; row?: Assignment }>({ open: false });
  const [logDialog, setLogDialog] = useState<{ open: boolean }>({ open: false });

  const today = new Date();
  const todayDow = today.getDay();
  const todayISO = format(today, "yyyy-MM-dd");

  async function fetchAll() {
    setLoading(true);
    try {
      const [loc, per, asg, lg] = await Promise.all([
        supabase.from("duty_locations").select("*").order("order_index"),
        supabase.from("personnel").select("id, prefix, first_name, last_name").eq("status", "active").order("first_name"),
        supabase.from("duty_assignments").select("*, duty_locations(name), personnel(prefix,first_name,last_name)").order("day_of_week", { nullsFirst: false }),
        supabase.from("duty_logs").select("*, duty_locations(name), personnel(first_name,last_name)").order("log_date", { ascending: false }).order("log_time", { ascending: false }).limit(200),
      ]);
      if (loc.error) throw loc.error;
      if (per.error) throw per.error;
      if (asg.error) throw asg.error;
      if (lg.error) throw lg.error;
      setLocations(loc.data || []);
      setPersonnel(per.data || []);
      setAssignments((asg.data as any) || []);
      setLogs((lg.data as any) || []);
    } catch (e: any) {
      swalError("โหลดข้อมูลไม่สำเร็จ", e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchAll(); }, []);

  const todayAssignments = useMemo(
    () => assignments.filter(a => a.duty_date === todayISO || a.day_of_week === todayDow),
    [assignments, todayISO, todayDow]
  );

  const personLabel = (p?: Personnel | Assignment["personnel"]) =>
    p ? `${p.prefix || ""}${p.first_name} ${p.last_name}` : "-";

  // ---------- Locations ----------
  async function saveLocation(form: Partial<Location>) {
    try {
      const payload = { name: form.name!, description: form.description || null, order_index: form.order_index ?? 0, active: form.active ?? true };
      const res = form.id
        ? await supabase.from("duty_locations").update(payload).eq("id", form.id)
        : await supabase.from("duty_locations").insert(payload);
      if (res.error) throw res.error;
      swalSuccess("บันทึกจุดเวรแล้ว");
      setLocDialog({ open: false });
      fetchAll();
    } catch (e: any) { swalError("บันทึกไม่สำเร็จ", e.message); }
  }
  async function deleteLocation(id: string) {
    const c = await swalConfirm("ลบจุดเวรนี้?", "การจัดเวรและบันทึกจะเชื่อมโยงกัน");
    if (!c.isConfirmed) return;
    const { error } = await supabase.from("duty_locations").delete().eq("id", id);
    if (error) return swalError("ลบไม่สำเร็จ", error.message);
    swalSuccess("ลบแล้ว"); fetchAll();
  }

  // ---------- Assignments ----------
  async function saveAssignment(form: Partial<Assignment>) {
    try {
      if (!form.location_id || !form.teacher_id) throw new Error("กรุณาเลือกจุดเวรและครู");
      if (form.duty_date == null && form.day_of_week == null) throw new Error("กรุณาระบุวัน (วันที่หรือวันในสัปดาห์)");
      const payload = {
        location_id: form.location_id,
        teacher_id: form.teacher_id,
        duty_date: form.duty_date || null,
        day_of_week: form.day_of_week ?? null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        role_label: form.role_label || null,
        notes: form.notes || null,
      };
      const res = form.id
        ? await supabase.from("duty_assignments").update(payload).eq("id", form.id)
        : await supabase.from("duty_assignments").insert(payload);
      if (res.error) throw res.error;
      swalSuccess("บันทึกการจัดเวรแล้ว");
      setAssignDialog({ open: false });
      fetchAll();
    } catch (e: any) { swalError("บันทึกไม่สำเร็จ", e.message); }
  }
  async function deleteAssignment(id: string) {
    const c = await swalConfirm("ลบการจัดเวรนี้?");
    if (!c.isConfirmed) return;
    const { error } = await supabase.from("duty_assignments").delete().eq("id", id);
    if (error) return swalError("ลบไม่สำเร็จ", error.message);
    swalSuccess("ลบแล้ว"); fetchAll();
  }

  // ---------- Logs ----------
  async function saveLog(form: { location_id: string; teacher_id?: string; category?: string; title?: string; content: string }) {
    try {
      if (!form.content) throw new Error("กรุณากรอกรายละเอียด");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("duty_logs").insert({
        location_id: form.location_id || null,
        teacher_id: form.teacher_id || null,
        category: form.category || null,
        title: form.title || null,
        content: form.content,
        reported_by: u.user?.id,
      });
      if (error) throw error;
      swalSuccess("บันทึกเหตุการณ์แล้ว");
      setLogDialog({ open: false });
      fetchAll();
    } catch (e: any) { swalError("บันทึกไม่สำเร็จ", e.message); }
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ครูเวรประจำวัน</h1>
        <p className="text-muted-foreground">จัดการจุดเวร ตารางเวร บันทึกเหตุการณ์ และรายงาน</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today"><Calendar className="w-4 h-4 mr-1" />เวรวันนี้</TabsTrigger>
          <TabsTrigger value="schedule"><Users className="w-4 h-4 mr-1" />จัดเวร</TabsTrigger>
          <TabsTrigger value="locations"><MapPin className="w-4 h-4 mr-1" />จุดเวร</TabsTrigger>
          <TabsTrigger value="logs"><FileText className="w-4 h-4 mr-1" />บันทึก/รายงาน</TabsTrigger>
        </TabsList>

        {/* ---------- TODAY ---------- */}
        <TabsContent value="today">
          <Card>
            <CardHeader><CardTitle>ครูเวรวันนี้ ({format(today, "dd/MM/yyyy")})</CardTitle></CardHeader>
            <CardContent>
              {loading ? "กำลังโหลด..." : todayAssignments.length === 0 ? (
                <p className="text-muted-foreground">ยังไม่มีการจัดเวรสำหรับวันนี้</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>จุดเวร</TableHead><TableHead>ครู</TableHead>
                    <TableHead>ตำแหน่ง</TableHead><TableHead>เวลา</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {todayAssignments.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.duty_locations?.name || "-"}</TableCell>
                        <TableCell>{personLabel(a.personnel as any)}</TableCell>
                        <TableCell>{a.role_label || "-"}</TableCell>
                        <TableCell>{a.start_time?.slice(0,5) || "-"} - {a.end_time?.slice(0,5) || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <Button className="mt-4" onClick={() => setLogDialog({ open: true })}>
                <Plus className="w-4 h-4 mr-1" />บันทึกเหตุการณ์วันนี้
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- SCHEDULE ---------- */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>ตารางจัดเวร</CardTitle>
              <Button onClick={() => setAssignDialog({ open: true })}><Plus className="w-4 h-4 mr-1" />เพิ่มการจัดเวร</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>วัน</TableHead><TableHead>จุดเวร</TableHead>
                  <TableHead>ครู</TableHead><TableHead>ตำแหน่ง</TableHead>
                  <TableHead>เวลา</TableHead><TableHead className="w-20"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {assignments.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.duty_date
                          ? <Badge variant="outline">{format(new Date(a.duty_date), "dd/MM/yyyy")}</Badge>
                          : a.day_of_week != null
                            ? <Badge>ทุก {DAYS[a.day_of_week]}</Badge>
                            : "-"}
                      </TableCell>
                      <TableCell>{a.duty_locations?.name || "-"}</TableCell>
                      <TableCell>{personLabel(a.personnel as any)}</TableCell>
                      <TableCell>{a.role_label || "-"}</TableCell>
                      <TableCell>{a.start_time?.slice(0,5) || "-"} - {a.end_time?.slice(0,5) || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setAssignDialog({ open: true, row: a })}>แก้</Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteAssignment(a.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- LOCATIONS ---------- */}
        <TabsContent value="locations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>จุดเวร</CardTitle>
              <Button onClick={() => setLocDialog({ open: true })}><Plus className="w-4 h-4 mr-1" />เพิ่มจุดเวร</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ลำดับ</TableHead><TableHead>ชื่อ</TableHead>
                  <TableHead>รายละเอียด</TableHead><TableHead>สถานะ</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {locations.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{l.order_index}</TableCell>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell>{l.description || "-"}</TableCell>
                      <TableCell>{l.active ? <Badge>ใช้งาน</Badge> : <Badge variant="secondary">ปิด</Badge>}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setLocDialog({ open: true, row: l })}>แก้</Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteLocation(l.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- LOGS ---------- */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>บันทึก/รายงานเหตุการณ์</CardTitle>
              <Button onClick={() => setLogDialog({ open: true })}><Plus className="w-4 h-4 mr-1" />เพิ่มบันทึก</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>วันเวลา</TableHead><TableHead>จุดเวร</TableHead>
                  <TableHead>หมวด</TableHead><TableHead>หัวข้อ</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(l.log_date), "dd/MM/yyyy")} {l.log_time?.slice(0,5)}</TableCell>
                      <TableCell>{l.duty_locations?.name || "-"}</TableCell>
                      <TableCell>{l.category ? <Badge variant="outline">{l.category}</Badge> : "-"}</TableCell>
                      <TableCell>{l.title || "-"}</TableCell>
                      <TableCell className="max-w-md whitespace-pre-wrap">{l.content}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Location dialog */}
      <LocationDialog state={locDialog} onClose={() => setLocDialog({ open: false })} onSave={saveLocation} />

      {/* Assignment dialog */}
      <AssignmentDialog
        state={assignDialog}
        locations={locations}
        personnel={personnel}
        onClose={() => setAssignDialog({ open: false })}
        onSave={saveAssignment}
      />

      {/* Log dialog */}
      <LogDialog
        open={logDialog.open}
        locations={locations}
        personnel={personnel}
        onClose={() => setLogDialog({ open: false })}
        onSave={saveLog}
      />
    </div>
  );
}

function LocationDialog({ state, onClose, onSave }: any) {
  const [f, setF] = useState<Partial<Location>>({});
  useEffect(() => { setF(state.row || { active: true, order_index: 0 }); }, [state]);
  return (
    <Dialog open={state.open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{state.row ? "แก้ไข" : "เพิ่ม"}จุดเวร</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ชื่อจุดเวร</Label><Input value={f.name || ""} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>รายละเอียด</Label><Textarea value={f.description || ""} onChange={e => setF({ ...f, description: e.target.value })} /></div>
          <div><Label>ลำดับ</Label><Input type="number" value={f.order_index ?? 0} onChange={e => setF({ ...f, order_index: parseInt(e.target.value) || 0 })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => onSave(f)}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentDialog({ state, locations, personnel, onClose, onSave }: any) {
  const [f, setF] = useState<Partial<Assignment>>({});
  const [mode, setMode] = useState<"date" | "weekly">("weekly");
  useEffect(() => {
    const r = state.row;
    setF(r || {});
    setMode(r?.duty_date ? "date" : "weekly");
  }, [state]);
  return (
    <Dialog open={state.open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{state.row ? "แก้ไข" : "เพิ่ม"}การจัดเวร</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>จุดเวร</Label>
            <Select value={f.location_id} onValueChange={v => setF({ ...f, location_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกจุดเวร" /></SelectTrigger>
              <SelectContent>{locations.map((l: Location) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>ครูผู้เวร</Label>
            <Select value={f.teacher_id} onValueChange={v => setF({ ...f, teacher_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกครู" /></SelectTrigger>
              <SelectContent>{personnel.map((p: Personnel) => <SelectItem key={p.id} value={p.id}>{p.prefix || ""}{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>รูปแบบ</Label>
            <Select value={mode} onValueChange={(v: any) => { setMode(v); setF({ ...f, duty_date: null, day_of_week: null }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">ประจำวันในสัปดาห์</SelectItem>
                <SelectItem value="date">เฉพาะวันที่</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "weekly" ? (
            <div>
              <Label>วัน</Label>
              <Select value={f.day_of_week?.toString()} onValueChange={v => setF({ ...f, day_of_week: parseInt(v), duty_date: null })}>
                <SelectTrigger><SelectValue placeholder="เลือกวัน" /></SelectTrigger>
                <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={i.toString()}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <div><Label>วันที่</Label><Input type="date" value={f.duty_date || ""} onChange={e => setF({ ...f, duty_date: e.target.value, day_of_week: null })} /></div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><Label>เวลาเริ่ม</Label><Input type="time" value={f.start_time || ""} onChange={e => setF({ ...f, start_time: e.target.value })} /></div>
            <div><Label>เวลาเลิก</Label><Input type="time" value={f.end_time || ""} onChange={e => setF({ ...f, end_time: e.target.value })} /></div>
          </div>
          <div><Label>ตำแหน่ง (เช่น หัวหน้าเวร)</Label><Input value={f.role_label || ""} onChange={e => setF({ ...f, role_label: e.target.value })} /></div>
          <div><Label>หมายเหตุ</Label><Textarea value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => onSave(f)}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogDialog({ open, locations, personnel, onClose, onSave }: any) {
  const [f, setF] = useState<{ location_id: string; teacher_id?: string; category?: string; title?: string; content: string }>({ location_id: "", content: "" });
  useEffect(() => { if (open) setF({ location_id: "", content: "" }); }, [open]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>บันทึกเหตุการณ์เวร</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>จุดเวร</Label>
            <Select value={f.location_id} onValueChange={v => setF({ ...f, location_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกจุดเวร" /></SelectTrigger>
              <SelectContent>{locations.map((l: Location) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>ครูผู้บันทึก</Label>
            <Select value={f.teacher_id} onValueChange={v => setF({ ...f, teacher_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกครู (ถ้ามี)" /></SelectTrigger>
              <SelectContent>{personnel.map((p: Personnel) => <SelectItem key={p.id} value={p.id}>{p.prefix || ""}{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>หมวด</Label>
            <Select value={f.category} onValueChange={v => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกหมวด" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ปกติ">ปกติ</SelectItem>
                <SelectItem value="เหตุการณ์">เหตุการณ์</SelectItem>
                <SelectItem value="ข้อเสนอแนะ">ข้อเสนอแนะ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>หัวข้อ</Label><Input value={f.title || ""} onChange={e => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>รายละเอียด</Label><Textarea rows={4} value={f.content} onChange={e => setF({ ...f, content: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => onSave(f)}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
