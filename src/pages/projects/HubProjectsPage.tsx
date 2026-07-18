import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, FolderKanban, Wallet, TrendingUp, Calendar, Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { BE_OFFSET } from "@/lib/dateBE";

const STATUSES = [
  { value: "planning", label: "วางแผน", color: "bg-slate-100 text-slate-700" },
  { value: "active", label: "ดำเนินการ", color: "bg-blue-100 text-blue-700" },
  { value: "paused", label: "พักไว้", color: "bg-yellow-100 text-yellow-700" },
  { value: "completed", label: "เสร็จสิ้น", color: "bg-emerald-100 text-emerald-700" },
  { value: "cancelled", label: "ยกเลิก", color: "bg-red-100 text-red-700" },
];

const fmtBaht = (n: number | null | undefined) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(n || 0));

export default function HubProjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", category: "", hub_project_code: "",
    fiscal_year: new Date().getFullYear() + BE_OFFSET,
    start_date: "", end_date: "", responsible_person: "",
    target_beneficiaries: "", goals: "",
  });

  const { data: school } = useQuery({
    queryKey: ["school-obec"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("obec_code").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["hub_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_projects").select("*")
        .order("fiscal_year", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const generateCode = () => {
    const obec = (school as any)?.obec_code?.toString().trim();
    if (!obec) return "";
    const prefix = `${obec}-`;
    const nums = projects
      .map((p: any) => p.hub_project_code as string | null)
      .filter((c): c is string => !!c && c.startsWith(prefix))
      .map((c) => parseInt(c.slice(prefix.length), 10))
      .filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}${String(next).padStart(2, "0")}`;
  };

  const openCreate = () => {
    setForm((f) => ({
      ...f,
      name: "", description: "", category: "",
      hub_project_code: generateCode(),
      start_date: "", end_date: "", responsible_person: "",
      target_beneficiaries: "", goals: "",
    }));
    setOpen(true);
  };

  const filtered = projects.filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (yearFilter !== "all" && String(p.fiscal_year) !== yearFilter) return false;
    if (search && !`${p.name} ${p.hub_project_code || ""} ${p.category || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const years = Array.from(new Set(projects.map((p: any) => p.fiscal_year))).sort((a: any, b: any) => b - a);

  // KPI totals
  const totals = filtered.reduce(
    (acc: any, p: any) => {
      acc.received += Number(p.budget_received || 0);
      acc.spent += Number(p.budget_spent || 0);
      acc.count += 1;
      if (p.status === "active") acc.active += 1;
      return acc;
    },
    { received: 0, spent: 0, count: 0, active: 0 }
  );

  const create = async () => {
    if (!form.name.trim()) return toast.error("กรอกชื่อโครงการ");
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      category: form.category || null,
      hub_project_code: form.hub_project_code || null,
      fiscal_year: Number(form.fiscal_year),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      responsible_person: form.responsible_person || null,
      target_beneficiaries: form.target_beneficiaries ? Number(form.target_beneficiaries) : null,
      goals: form.goals || null,
      created_by: user.user?.id,
    };
    const { error } = await supabase.from("hub_projects").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("สร้างโครงการแล้ว");
    setOpen(false);
    setForm({ ...form, name: "", description: "", category: "", hub_project_code: "", start_date: "", end_date: "", responsible_person: "", target_beneficiaries: "", goals: "" });
    qc.invalidateQueries({ queryKey: ["hub_projects"] });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FolderKanban className="h-7 w-7 text-primary" /> โครงการพิเศษ / Hub Projects
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            รายงานโครงการ สรุปงบที่ได้รับจากฮับกลาง และค่าใช้จ่ายอย่างเป็นทางการ
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => v ? openCreate() : setOpen(false)}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2"><Plus className="h-4 w-4" /> เพิ่มโครงการ</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>เพิ่มโครงการใหม่</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><Label>ชื่อโครงการ *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>รหัสโครงการ (สร้างอัตโนมัติ)</Label>
                <Input value={form.hub_project_code} readOnly className="bg-muted font-mono"
                  placeholder={(school as any)?.obec_code ? "" : "กรุณาตั้งรหัส OBEC ของโรงเรียนก่อน"} /></div>
              <div><Label>หมวด/ประเภท</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="วิชาการ / กิจกรรม / สิ่งแวดล้อม ..." /></div>
              <div><Label>ปีงบประมาณ (พ.ศ.)</Label>
                <Input type="number" value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: Number(e.target.value) })} /></div>
              <div><Label>ผู้รับผิดชอบ</Label>
                <Input value={form.responsible_person} onChange={(e) => setForm({ ...form, responsible_person: e.target.value })} /></div>
              <div><Label>วันเริ่ม</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>วันสิ้นสุด</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <div><Label>จำนวนผู้ได้รับประโยชน์</Label>
                <Input type="number" value={form.target_beneficiaries} onChange={(e) => setForm({ ...form, target_beneficiaries: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>รายละเอียดโครงการ</Label>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>เป้าหมาย / ตัวชี้วัด</Label>
                <Textarea rows={2} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button onClick={create}>บันทึก</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">โครงการทั้งหมด</div>
          <div className="text-2xl font-bold">{totals.count}</div>
          <div className="text-xs text-muted-foreground">กำลังดำเนินการ {totals.active}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> งบที่ได้รับรวม</div>
          <div className="text-xl font-bold text-emerald-600">{fmtBaht(totals.received)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> ค่าใช้จ่ายรวม</div>
          <div className="text-xl font-bold text-orange-600">{fmtBaht(totals.spent)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">งบคงเหลือ</div>
          <div className="text-xl font-bold text-primary">{fmtBaht(totals.received - totals.spent)}</div>
          <div className="text-xs text-muted-foreground">
            ใช้ไป {totals.received > 0 ? Math.round((totals.spent / totals.received) * 100) : 0}%
          </div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="ค้นหาชื่อ/รหัส/หมวด" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="สถานะ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            {STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="ปีงบประมาณ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกปี</SelectItem>
            {years.map((y: any) => (<SelectItem key={y} value={String(y)}>พ.ศ. {y}</SelectItem>))}
          </SelectContent>
        </Select>
      </CardContent></Card>

      {/* Project cards */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          ยังไม่มีโครงการ • กด "เพิ่มโครงการ" เพื่อเริ่มต้น
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any) => {
            const used = Number(p.budget_received) > 0
              ? Math.min(100, (Number(p.budget_spent) / Number(p.budget_received)) * 100) : 0;
            const st = STATUSES.find((s) => s.value === p.status) || STATUSES[0];
            return (
              <Link key={p.id} to={`/dashboard/projects/hub/${p.id}`}>
                <Card className="hover:shadow-lg transition-shadow h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-2">{p.name}</CardTitle>
                      <Badge className={st.color} variant="secondary">{st.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      {p.hub_project_code && <span>#{p.hub_project_code}</span>}
                      {p.category && <span>• {p.category}</span>}
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> พ.ศ. {p.fiscal_year}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div><div className="text-muted-foreground">ได้รับ</div>
                        <div className="font-semibold text-emerald-600">{fmtBaht(p.budget_received)}</div></div>
                      <div><div className="text-muted-foreground">ใช้ไป</div>
                        <div className="font-semibold text-orange-600">{fmtBaht(p.budget_spent)}</div></div>
                    </div>
                    <Progress value={used} className="h-2" />
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>ใช้ {Math.round(used)}%</span>
                      <span className="flex items-center gap-1 text-primary">ดูรายละเอียด <ArrowRight className="h-3 w-3" /></span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
