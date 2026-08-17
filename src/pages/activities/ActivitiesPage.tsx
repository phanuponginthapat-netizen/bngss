import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trophy, Plus, CalendarDays, MapPin, Users, Search, ClipboardList } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDateBE } from "@/lib/dateBE";
import { ACTIVITY_CATEGORIES, RULE_PRESETS, getRulePreset, categoryLabel } from "@/lib/competitionRules";
import { BRACKET_TYPES } from "@/lib/bracket";
import { saveErrorMessage } from "@/lib/saveError";

const db = supabase as any;

export default function ActivitiesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role } = useUserRole();
  const canManage = ["admin", "director", "teacher"].includes(role || "");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [form, setForm] = useState<any>(null);

  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await db.from("activities").select("*").order("start_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: myStudent } = useQuery({
    queryKey: ["my_student_for_activity"],
    queryFn: async () => (await db.rpc("get_my_student")).data?.[0] || null,
  });

  const { data: myRegs = [] } = useQuery({
    queryKey: ["my_activity_regs", myStudent?.id],
    enabled: !!myStudent?.id,
    queryFn: async () =>
      (await db.from("activity_participants").select("id, activity_id").eq("student_id", myStudent.id)).data || [],
  });

  const counts = useQuery({
    queryKey: ["activity_counts"],
    queryFn: async () => {
      const { data } = await db.from("activity_participants").select("activity_id");
      const m: Record<string, number> = {};
      (data || []).forEach((r: any) => { m[r.activity_id] = (m[r.activity_id] || 0) + 1; });
      return m;
    },
  });

  const filtered = useMemo(
    () => activities.filter((a: any) =>
      (cat === "all" || a.category === cat) &&
      (!search || (a.title || "").includes(search) || (a.location || "").includes(search))),
    [activities, cat, search],
  );

  const newActivity = () => {
    setForm({
      title: "", category: "sports_day", description: "", location: "",
      start_at: "", end_at: "", status: "planned", level: "โรงเรียน",
      bracket_type: "single_elim", rule_preset_key: "", rules: "",
      registration_open: true, registration_deadline: "", max_participants: null,
      group_count: 2, scoring_mode: "point", max_score: 100, supervisor_teachers: "",
    });
    setOpen(true);
  };

  const applyPreset = (key: string) => {
    const p = getRulePreset(key);
    setForm((f: any) => ({
      ...f,
      rule_preset_key: key,
      rules: p?.rules || f.rules,
      format: p?.format || f.format,
      bracket_type: p?.format && p.format !== "score" ? p.format : "score",
      scoring_mode: p?.scoringMode || f.scoring_mode,
      max_score: p?.maxScore ?? f.max_score,
      criteria: p?.criteria ? p.criteria : f.criteria,
    }));
  };

  const save = async () => {
    if (!form.title?.trim()) return toast.error("กรุณาระบุชื่อกิจกรรม");
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      title: form.title,
      category: form.category,
      description: form.description || null,
      location: form.location || null,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      status: form.status,
      level: form.level || null,
      bracket_type: form.bracket_type,
      rule_preset_key: form.rule_preset_key || null,
      rules: form.rules || null,
      registration_open: !!form.registration_open,
      registration_deadline: form.registration_deadline ? new Date(form.registration_deadline).toISOString() : null,
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      group_count: form.group_count ? Number(form.group_count) : null,
      scoring_mode: form.scoring_mode,
      max_score: form.max_score ? Number(form.max_score) : null,
      supervisor_teachers: form.supervisor_teachers || null,
      criteria: form.criteria || null,
      created_by: u?.user?.id,
    };
    const { error } = await db.from("activities").insert(payload);
    if (error) return toast.error(saveErrorMessage(error));
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["activities"] });
    toast.success("สร้างกิจกรรมแล้ว");
  };

  const register = async (a: any) => {
    if (!myStudent?.id) return toast.error("บัญชีนี้ไม่ได้ผูกกับข้อมูลนักเรียน");
    const { error } = await db.from("activity_participants").insert({ activity_id: a.id, student_id: myStudent.id });
    if (error) return toast.error(saveErrorMessage(error));
    qc.invalidateQueries({ queryKey: ["my_activity_regs"] });
    qc.invalidateQueries({ queryKey: ["activity_counts"] });
    toast.success("สมัครเข้าร่วมเรียบร้อย");
  };

  const withdraw = async (a: any) => {
    const reg = myRegs.find((r: any) => r.activity_id === a.id);
    if (!reg) return;
    const { error } = await db.from("activity_participants").delete().eq("id", reg.id);
    if (error) return toast.error(saveErrorMessage(error));
    qc.invalidateQueries({ queryKey: ["my_activity_regs"] });
    qc.invalidateQueries({ queryKey: ["activity_counts"] });
    toast.success("ยกเลิกการสมัครแล้ว");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" /> กิจกรรมและการแข่งขัน
          </h1>
          <p className="text-sm text-muted-foreground">
            งานวิชาการ วันวิทยาศาสตร์ วันภาษาไทย กีฬาสี กีฬาสามัคคี — สมัครเข้าร่วม จัดสาย บันทึกผล และออกเกียรติบัตร
          </p>
        </div>
        {canManage && <Button onClick={newActivity}><Plus className="w-4 h-4 mr-1" /> สร้างกิจกรรม</Button>}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="ค้นหากิจกรรม" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {ACTIVITY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((a: any) => {
          const joined = myRegs.some((r: any) => r.activity_id === a.id);
          return (
            <Card key={a.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug">{a.title}</h3>
                  <Badge variant="secondary" className="shrink-0">{categoryLabel(a.category)}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {a.start_at && <p className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{formatDateBE(a.start_at)}</p>}
                  {a.location && <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{a.location}</p>}
                  <p className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />ผู้สมัคร {counts.data?.[a.id] || 0}
                    {a.max_participants ? ` / ${a.max_participants}` : ""} คน
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {a.registration_open
                    ? <Badge className="text-[10px]">เปิดรับสมัคร</Badge>
                    : <Badge variant="outline" className="text-[10px]">ปิดรับสมัคร</Badge>}
                  {a.bracket_type && a.bracket_type !== "score" && (
                    <Badge variant="outline" className="text-[10px]">
                      {BRACKET_TYPES.find((b) => b.value === a.bracket_type)?.label}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1"
                    onClick={() => navigate(`/dashboard/activities/${a.id}`)}>
                    <ClipboardList className="w-4 h-4 mr-1" /> รายละเอียด
                  </Button>
                  {myStudent && (joined
                    ? <Button size="sm" variant="ghost" onClick={() => withdraw(a)}>ยกเลิก</Button>
                    : a.registration_open && <Button size="sm" onClick={() => register(a)}>สมัคร</Button>)}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">ยังไม่มีกิจกรรม</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>สร้างกิจกรรม / รายการแข่งขัน</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">ชื่อกิจกรรม</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">ประเภทงาน</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">กติกาสำเร็จรูป</Label>
                  <Select value={form.rule_preset_key || ""} onValueChange={applyPreset}>
                    <SelectTrigger><SelectValue placeholder="เลือกรายการแข่งขัน" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {RULE_PRESETS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">เริ่ม</Label>
                  <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">สิ้นสุด</Label>
                  <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">สถานที่</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">ผู้ควบคุม/ครูผู้รับผิดชอบ</Label>
                  <Input value={form.supervisor_teachers} onChange={(e) => setForm({ ...form, supervisor_teachers: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">รูปแบบการแข่งขัน</Label>
                  <Select value={form.bracket_type} onValueChange={(v) => setForm({ ...form, bracket_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BRACKET_TYPES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.bracket_type === "group_knockout" && (
                  <div>
                    <Label className="text-xs">จำนวนสาย</Label>
                    <Input type="number" min={2} max={8} value={form.group_count}
                      onChange={(e) => setForm({ ...form, group_count: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label className="text-xs">จำนวนผู้สมัครสูงสุด</Label>
                  <Input type="number" value={form.max_participants || ""}
                    onChange={(e) => setForm({ ...form, max_participants: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">ปิดรับสมัครวันที่</Label>
                  <Input type="datetime-local" value={form.registration_deadline}
                    onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={form.registration_open}
                    onCheckedChange={(v) => setForm({ ...form, registration_open: v })} />
                  <Label className="text-xs">เปิดรับสมัคร</Label>
                </div>
              </div>
              <div>
                <Label className="text-xs">รายละเอียด</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">กติกาการแข่งขัน</Label>
                <Textarea rows={8} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
