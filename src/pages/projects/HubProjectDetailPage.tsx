import { useState, useRef } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Wallet, Receipt, Image as ImageIcon, FileText, Trash2, Upload, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { saveErrorMessage } from "@/lib/saveError";
import { swal } from "@/lib/swal";
import { safeNum } from "@/lib/saveError";

const fmtBaht = (n: any) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(n || 0));

const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const STATUSES: Record<string, { label: string; color: string }> = {
  planning: { label: "วางแผน", color: "bg-slate-100 text-slate-700" },
  active: { label: "ดำเนินการ", color: "bg-blue-100 text-blue-700" },
  paused: { label: "พักไว้", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "เสร็จสิ้น", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700" },
};

const EXPENSE_CATS = ["วัสดุ-อุปกรณ์", "ค่าใช้สอย", "ค่าตอบแทน", "อาหาร-เครื่องดื่ม", "ค่าเดินทาง", "ค่าจ้าง", "อื่น ๆ"];

export default function HubProjectDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["hub_project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("hub_projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["hub_project_budgets", id],
    queryFn: async () => {
      const { data } = await supabase.from("hub_project_budgets").select("*").eq("project_id", id).order("received_date", { ascending: false });
      return data || [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["hub_project_expenses", id],
    queryFn: async () => {
      const { data } = await supabase.from("hub_project_expenses").select("*").eq("project_id", id).order("expense_date", { ascending: false });
      return data || [];
    },
  });

  const { data: updates = [] } = useQuery({
    queryKey: ["hub_project_updates", id],
    queryFn: async () => {
      const { data } = await supabase.from("hub_project_updates").select("*").eq("project_id", id).order("update_date", { ascending: false });
      return data || [];
    },
  });

  // dialogs
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ amount: "", received_date: todayBangkok(), source: "ฮับกลาง / เขต", reference_no: "", notes: "" });
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: "", expense_date: todayBangkok(), category: "วัสดุ-อุปกรณ์", description: "", vendor: "", receipt_no: "", notes: "" });
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ title: "", summary: "", details: "", period_label: "", update_date: todayBangkok(), participants_count: "", progress_percent: "" });
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);

  const addBudget = async () => {
    if (savingBudget) return;
    const amt = safeNum(budgetForm.amount, 0);
    if (!budgetForm.amount || amt <= 0) return toast.error("กรอกจำนวนเงิน");
    setSavingBudget(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("hub_project_budgets").insert({
        project_id: id, amount: amt,
        received_date: budgetForm.received_date, source: budgetForm.source || null,
        reference_no: budgetForm.reference_no || null, notes: budgetForm.notes || null,
        created_by: user.user?.id,
      } as any);
      if (error) return toast.error(saveErrorMessage(error));
      toast.success("บันทึกงบที่ได้รับแล้ว");
      setBudgetOpen(false);
      setBudgetForm({ ...budgetForm, amount: "", reference_no: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["hub_project_budgets", id] });
      qc.invalidateQueries({ queryKey: ["hub_project", id] });
    } finally {
      setSavingBudget(false);
    }
  };

  const addExpense = async () => {
    if (savingExpense) return;
    const amt = safeNum(expenseForm.amount, 0);
    if (!expenseForm.amount || amt <= 0) return toast.error("กรอกจำนวนเงิน");
    if (!expenseForm.description.trim()) return toast.error("กรอกรายการ");
    setSavingExpense(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("hub_project_expenses").insert({
        project_id: id, amount: amt,
        expense_date: expenseForm.expense_date, category: expenseForm.category,
        description: expenseForm.description, vendor: expenseForm.vendor || null,
        receipt_no: expenseForm.receipt_no || null, notes: expenseForm.notes || null,
        created_by: user.user?.id,
      } as any);
      if (error) return toast.error(saveErrorMessage(error));
      toast.success("บันทึกค่าใช้จ่ายแล้ว");
      setExpenseOpen(false);
      setExpenseForm({ ...expenseForm, amount: "", description: "", vendor: "", receipt_no: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["hub_project_expenses", id] });
      qc.invalidateQueries({ queryKey: ["hub_project", id] });
    } finally {
      setSavingExpense(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const urls: string[] = [];
    for (const file of files) {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("hub-projects").upload(path, file);
      if (error) { toast.error(saveErrorMessage(error)); continue; }
      const { data: signed } = await supabase.storage.from("hub-projects").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }
    setUploadedPhotos((prev) => [...prev, ...urls]);
    toast.success(`อัปโหลด ${urls.length} ภาพ`);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addUpdate = async () => {
    if (savingUpdate) return;
    if (!updateForm.title.trim()) return toast.error("กรอกหัวข้อ");
    setSavingUpdate(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("hub_project_updates").insert({
        project_id: id, title: updateForm.title, summary: updateForm.summary || null,
        details: updateForm.details || null, period_label: updateForm.period_label || null,
        update_date: updateForm.update_date,
        participants_count: updateForm.participants_count ? safeNum(updateForm.participants_count, 0) : null,
        progress_percent: updateForm.progress_percent ? safeNum(updateForm.progress_percent, 0) : null,
        photos: uploadedPhotos as any,
        created_by: user.user?.id,
      } as any);
      if (error) return toast.error(saveErrorMessage(error));
      toast.success("เผยแพร่รายงานความคืบหน้าแล้ว");
      setUpdateOpen(false);
      setUpdateForm({ ...updateForm, title: "", summary: "", details: "", period_label: "", participants_count: "", progress_percent: "" });
      setUploadedPhotos([]);
      qc.invalidateQueries({ queryKey: ["hub_project_updates", id] });
    } finally {
      setSavingUpdate(false);
    }
  };

  const removeExpense = async (eid: string) => {
    const ok = await swal.confirm({ title: "ลบรายการนี้?", danger: true, confirmText: "ลบ" });
    if (!ok) return;
    const { error } = await supabase.from("hub_project_expenses").delete().eq("id", eid);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["hub_project_expenses", id] });
    qc.invalidateQueries({ queryKey: ["hub_project", id] });
  };
  const removeBudget = async (bid: string) => {
    const ok = await swal.confirm({ title: "ลบงบที่ได้รับนี้?", danger: true, confirmText: "ลบ" });
    if (!ok) return;
    const { error } = await supabase.from("hub_project_budgets").delete().eq("id", bid);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["hub_project_budgets", id] });
    qc.invalidateQueries({ queryKey: ["hub_project", id] });
  };

  const changeStatus = async (status: string) => {
    const { error } = await supabase.from("hub_projects").update({ status } as any).eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("อัปเดตสถานะแล้ว");
    qc.invalidateQueries({ queryKey: ["hub_project", id] });
    setStatusOpen(false);
  };

  if (isLoading) return <div className="p-8 text-center">กำลังโหลด...</div>;
  if (!project) return <div className="p-8 text-center">ไม่พบโครงการ</div>;

  const used = Number(project.budget_received) > 0
    ? Math.min(100, (Number(project.budget_spent) / Number(project.budget_received)) * 100) : 0;
  const remain = Number(project.budget_received) - Number(project.budget_spent);
  const st = STATUSES[project.status] || STATUSES.planning;

  // expense breakdown
  const byCat: Record<string, number> = {};
  expenses.forEach((e: any) => { byCat[e.category || "อื่น ๆ"] = (byCat[e.category || "อื่น ๆ"] || 0) + Number(e.amount); });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Link to="/dashboard/projects/hub"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> กลับ</Button></Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1"><Printer className="h-4 w-4" /> พิมพ์รายงาน</Button>
        </div>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">โครงการ พ.ศ. {project.fiscal_year}{project.hub_project_code ? ` • รหัส #${project.hub_project_code}` : ""}</div>
              <CardTitle className="text-2xl">{project.name}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                {project.category && <Badge variant="outline">{project.category}</Badge>}
                <Badge className={st.color}>{st.label}</Badge>
                {project.responsible_person && <span>ผู้รับผิดชอบ: {project.responsible_person}</span>}
                {project.start_date && <span>• {fmtDate(project.start_date)} – {fmtDate(project.end_date)}</span>}
              </div>
            </div>
            <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><CheckCircle2 className="h-4 w-4" /> เปลี่ยนสถานะ</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>เปลี่ยนสถานะโครงการ</DialogTitle></DialogHeader>
                <div className="grid gap-2">
                  {Object.entries(STATUSES).map(([k, v]) => (
                    <Button key={k} variant={project.status === k ? "default" : "outline"} onClick={() => changeStatus(k)}>{v.label}</Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {project.description && <p className="text-sm text-muted-foreground mt-2">{project.description}</p>}
          {project.goals && <div className="text-sm mt-2"><span className="font-semibold">เป้าหมาย: </span>{project.goals}</div>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className="text-xs text-muted-foreground">งบที่ได้รับ</div>
              <div className="text-lg font-bold text-emerald-600">{fmtBaht(project.budget_received)}</div></div>
            <div><div className="text-xs text-muted-foreground">ใช้ไป</div>
              <div className="text-lg font-bold text-orange-600">{fmtBaht(project.budget_spent)}</div></div>
            <div><div className="text-xs text-muted-foreground">คงเหลือ</div>
              <div className="text-lg font-bold text-primary">{fmtBaht(remain)}</div></div>
            <div><div className="text-xs text-muted-foreground">ผู้ได้รับประโยชน์</div>
              <div className="text-lg font-bold">{project.target_beneficiaries ?? "-"}</div></div>
          </div>
          <Progress value={used} className="h-2 mt-3" />
          <div className="text-xs text-muted-foreground mt-1">ใช้งบไป {Math.round(used)}% ของงบที่ได้รับ</div>
        </CardContent>
      </Card>

      <Tabs defaultValue="feed">
        <TabsList className="grid grid-cols-1 sm:grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="feed" className="gap-1"><ImageIcon className="h-4 w-4" /> ฟีดความคืบหน้า</TabsTrigger>
          <TabsTrigger value="budget" className="gap-1"><Wallet className="h-4 w-4" /> งบที่ได้รับ</TabsTrigger>
          <TabsTrigger value="expense" className="gap-1"><Receipt className="h-4 w-4" /> ค่าใช้จ่าย</TabsTrigger>
          <TabsTrigger value="summary" className="gap-1"><FileText className="h-4 w-4" /> สรุป</TabsTrigger>
        </TabsList>

        {/* FEED */}
        <TabsContent value="feed" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">รายงานความคืบหน้าเป็นช่วง ๆ พร้อมภาพกิจกรรม (เผยแพร่ไปยังฮับกลางอัตโนมัติ)</p>
            <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> เพิ่มรายงาน</Button></DialogTrigger>
              <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>เพิ่มรายงานความคืบหน้า</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2"><Label>หัวข้อ *</Label>
                    <Input value={updateForm.title} onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })} /></div>
                  <div><Label>วันที่</Label>
                    <Input type="date" value={updateForm.update_date} onChange={(e) => setUpdateForm({ ...updateForm, update_date: e.target.value })} /></div>
                  <div><Label>ช่วงรายงาน</Label>
                    <Input placeholder="เช่น ไตรมาส 1, สัปดาห์ที่ 5" value={updateForm.period_label} onChange={(e) => setUpdateForm({ ...updateForm, period_label: e.target.value })} /></div>
                  <div><Label>จำนวนผู้เข้าร่วม</Label>
                    <Input type="number" value={updateForm.participants_count} onChange={(e) => setUpdateForm({ ...updateForm, participants_count: e.target.value })} /></div>
                  <div><Label>ความก้าวหน้า (%)</Label>
                    <Input type="number" min={0} max={100} value={updateForm.progress_percent} onChange={(e) => setUpdateForm({ ...updateForm, progress_percent: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>สรุปสั้น</Label>
                    <Textarea rows={2} value={updateForm.summary} onChange={(e) => setUpdateForm({ ...updateForm, summary: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>รายละเอียดเต็ม</Label>
                    <Textarea rows={4} value={updateForm.details} onChange={(e) => setUpdateForm({ ...updateForm, details: e.target.value })} /></div>
                  <div className="md:col-span-2">
                    <Label>ภาพกิจกรรม</Label>
                    <div className="mt-1">
                      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
                        <Upload className="h-4 w-4" /> อัปโหลดภาพ
                      </Button>
                      {uploadedPhotos.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
                          {uploadedPhotos.map((u, i) => (
                            <div key={i} className="relative">
                              <img loading="lazy" decoding="async" src={u} className="w-full h-20 object-cover rounded" alt="" />
                              <button type="button" onClick={() => setUploadedPhotos(uploadedPhotos.filter((_, idx) => idx !== i))}
                                className="absolute top-0 right-0 bg-red-600 text-white rounded-bl px-1 text-xs">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUpdateOpen(false)}>ยกเลิก</Button>
                  <Button onClick={addUpdate} disabled={savingUpdate}>เผยแพร่</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {updates.length === 0 ? (
            <Card><CardContent className="text-center py-8 text-muted-foreground">ยังไม่มีรายงาน</CardContent></Card>
          ) : updates.map((u: any) => (
            <Card key={u.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <div className="text-xs text-muted-foreground">{fmtDate(u.update_date)}{u.period_label ? ` • ${u.period_label}` : ""}</div>
                    <CardTitle className="text-lg">{u.title}</CardTitle>
                  </div>
                  {u.progress_percent != null && (
                    <Badge variant="outline">ความก้าวหน้า {u.progress_percent}%</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {u.summary && <p className="text-sm">{u.summary}</p>}
                {u.details && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{u.details}</p>}
                {u.participants_count != null && (
                  <div className="text-xs text-muted-foreground">ผู้เข้าร่วม {u.participants_count} คน</div>
                )}
                {Array.isArray(u.photos) && u.photos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {u.photos.map((p: string, i: number) => (
                      <a key={i} href={p} target="_blank" rel="noreferrer">
                        <img loading="lazy" decoding="async" src={p} alt="" className="w-full h-32 object-cover rounded border" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* BUDGET */}
        <TabsContent value="budget" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">งบประมาณที่ได้รับจัดสรรจากฮับกลาง/เขต/แหล่งอื่น</p>
            <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> รับงบใหม่</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>บันทึกงบที่ได้รับ</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>จำนวนเงิน (บาท) *</Label>
                    <Input type="number" value={budgetForm.amount} onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })} /></div>
                  <div><Label>วันที่รับ</Label>
                    <Input type="date" value={budgetForm.received_date} onChange={(e) => setBudgetForm({ ...budgetForm, received_date: e.target.value })} /></div>
                  <div className="col-span-2"><Label>แหล่งงบ</Label>
                    <Input value={budgetForm.source} onChange={(e) => setBudgetForm({ ...budgetForm, source: e.target.value })} /></div>
                  <div className="col-span-2"><Label>เลขที่อ้างอิง</Label>
                    <Input value={budgetForm.reference_no} onChange={(e) => setBudgetForm({ ...budgetForm, reference_no: e.target.value })} /></div>
                  <div className="col-span-2"><Label>หมายเหตุ</Label>
                    <Textarea value={budgetForm.notes} onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={addBudget} disabled={savingBudget}>บันทึก</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {budgets.length === 0 ? (
            <Card><CardContent className="text-center py-8 text-muted-foreground">ยังไม่มีรายการ</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr>
                  <th className="text-left p-3">วันที่</th><th className="text-left p-3">แหล่งงบ</th>
                  <th className="text-left p-3">อ้างอิง</th><th className="text-right p-3">จำนวน</th>
                  <th className="text-right p-3"></th>
                </tr></thead>
                <tbody>
                  {budgets.map((b: any) => (
                    <tr key={b.id} className="border-t">
                      <td className="p-3">{fmtDate(b.received_date)}</td>
                      <td className="p-3">{b.source || "-"}</td>
                      <td className="p-3">{b.reference_no || "-"}</td>
                      <td className="p-3 text-right font-semibold text-emerald-600">{fmtBaht(b.amount)}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeBudget(b.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* EXPENSE */}
        <TabsContent value="expense" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">รายการค่าใช้จ่ายของโครงการ</p>
            <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> เพิ่มค่าใช้จ่าย</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>บันทึกค่าใช้จ่าย</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>วันที่</Label>
                    <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} /></div>
                  <div><Label>หมวด</Label>
                    <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>รายการ *</Label>
                    <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></div>
                  <div><Label>จำนวนเงิน *</Label>
                    <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div>
                  <div><Label>เลขที่ใบเสร็จ</Label>
                    <Input value={expenseForm.receipt_no} onChange={(e) => setExpenseForm({ ...expenseForm, receipt_no: e.target.value })} /></div>
                  <div className="col-span-2"><Label>ผู้ขาย/ผู้รับเงิน</Label>
                    <Input value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} /></div>
                  <div className="col-span-2"><Label>หมายเหตุ</Label>
                    <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={addExpense} disabled={savingExpense}>บันทึก</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {expenses.length === 0 ? (
            <Card><CardContent className="text-center py-8 text-muted-foreground">ยังไม่มีรายการ</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr>
                  <th className="text-left p-3">วันที่</th><th className="text-left p-3">หมวด</th>
                  <th className="text-left p-3">รายการ</th><th className="text-left p-3">ใบเสร็จ</th>
                  <th className="text-right p-3">จำนวน</th><th></th>
                </tr></thead>
                <tbody>
                  {expenses.map((e: any) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-3">{fmtDate(e.expense_date)}</td>
                      <td className="p-3"><Badge variant="outline">{e.category}</Badge></td>
                      <td className="p-3">{e.description}{e.vendor && <div className="text-xs text-muted-foreground">{e.vendor}</div>}</td>
                      <td className="p-3 text-xs">{e.receipt_no || "-"}</td>
                      <td className="p-3 text-right font-semibold text-orange-600">{fmtBaht(e.amount)}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeExpense(e.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* SUMMARY */}
        <TabsContent value="summary" className="space-y-3">
          <Card><CardHeader><CardTitle className="text-base">สรุปงบประมาณ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-muted-foreground">รับมา {budgets.length} ครั้ง</div>
                  <div className="text-lg font-bold text-emerald-600">{fmtBaht(project.budget_received)}</div></div>
                <div><div className="text-muted-foreground">ใช้ไป {expenses.length} รายการ</div>
                  <div className="text-lg font-bold text-orange-600">{fmtBaht(project.budget_spent)}</div></div>
                <div><div className="text-muted-foreground">คงเหลือ</div>
                  <div className="text-lg font-bold text-primary">{fmtBaht(remain)}</div></div>
                <div><div className="text-muted-foreground">ใช้ไปแล้ว</div>
                  <div className="text-lg font-bold">{Math.round(used)}%</div></div>
              </div>
              <div className="mt-3">
                <div className="text-sm font-semibold mb-2">สัดส่วนค่าใช้จ่ายตามหมวด</div>
                <div className="space-y-2">
                  {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                    const pct = project.budget_spent > 0 ? (v / Number(project.budget_spent)) * 100 : 0;
                    return (
                      <div key={k}>
                        <div className="flex justify-between text-xs"><span>{k}</span>
                          <span className="font-semibold">{fmtBaht(v)} ({pct.toFixed(1)}%)</span></div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                  {Object.keys(byCat).length === 0 && <div className="text-sm text-muted-foreground">ยังไม่มีค่าใช้จ่าย</div>}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm font-semibold mb-2">รายงานที่เผยแพร่ ({updates.length} รายงาน)</div>
                <ul className="text-sm space-y-1">
                  {updates.map((u: any) => (
                    <li key={u.id} className="flex justify-between border-b py-1">
                      <span>{fmtDate(u.update_date)} - {u.title}</span>
                      {u.progress_percent != null && <span className="text-muted-foreground">{u.progress_percent}%</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
