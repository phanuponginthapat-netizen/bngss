import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, ClipboardCheck, Target, DollarSign, CheckCircle2, Pencil, Trash2, BarChart3, Printer } from "lucide-react";
import { useSchoolReport } from "@/hooks/useSchoolReport";
import { buildTable, buildInfoGrid, buildSummaryBox, buildSectionTitle, buildBodyText } from "@/lib/obecReportBuilder";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { swal } from "@/lib/swal";

const DEPARTMENTS = ["วิชาการ", "กิจการนักเรียน", "บริหารทั่วไป", "งบประมาณและบุคคล", "ConnextED"];
const STATUSES = [
  { value: "plan", label: "Plan (วางแผน)", color: "bg-info" },
  { value: "do", label: "Do (ดำเนินการ)", color: "bg-warning" },
  { value: "check", label: "Check (ตรวจสอบ)", color: "bg-warning" },
  { value: "act", label: "Act (ปรับปรุง)", color: "bg-success" },
  { value: "completed", label: "เสร็จสิ้น", color: "bg-primary" },
];

const ActionPlanPage = () => {
  const { lang } = useLanguage();
  const { isAdmin, isDirector, isTeacher } = useUserRole();
  const { currentAcademicYear: academicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const canManage = isAdmin || isDirector || isTeacher;
  const L = (th: string, en: string) => lang === "th" ? th : en;

  const emptyForm = {
    plan_code: "", title: "", description: "", department: "วิชาการ",
    strategy: "", objective: "", kpi_indicator: "", kpi_target: "",
    responsible_person: "", budget_amount: 0, budget_source: "งบประมาณ",
    start_date: "", end_date: "", status: "plan",
    plan_details: "", do_details: "", check_details: "", act_details: "",
    overall_result: "",
  };
  const [form, setForm] = useState(emptyForm);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["action-plans", academicYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plans")
        .select("*")
        .eq("academic_year", academicYear)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        ...values,
        academic_year: academicYear,
        budget_amount: Number(values.budget_amount),
        start_date: values.start_date || null,
        end_date: values.end_date || null,
      };
      if (editId) {
        const { error } = await supabase.from("action_plans").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("action_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-plans"] });
      toast.success(editId ? L("แก้ไขสำเร็จ", "Updated") : L("บันทึกสำเร็จ", "Saved"));
      resetForm();
    },
    onError: () => toast.error(L("เกิดข้อผิดพลาด", "Error")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action-plans"] });
      toast.success(L("ลบสำเร็จ", "Deleted"));
    },
  });

  const resetForm = () => { setForm(emptyForm); setEditId(null); setOpen(false); };

  const handleEdit = (r: any) => {
    setForm({
      plan_code: r.plan_code || "", title: r.title, description: r.description || "",
      department: r.department, strategy: r.strategy || "", objective: r.objective || "",
      kpi_indicator: r.kpi_indicator || "", kpi_target: r.kpi_target || "",
      responsible_person: r.responsible_person || "", budget_amount: r.budget_amount || 0,
      budget_source: r.budget_source || "งบประมาณ", start_date: r.start_date || "",
      end_date: r.end_date || "", status: r.status,
      plan_details: r.plan_details || "", do_details: r.do_details || "",
      check_details: r.check_details || "", act_details: r.act_details || "",
      overall_result: r.overall_result || "",
    });
    setEditId(r.id);
    setOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find(x => x.value === status);
    return <Badge variant="outline" className="gap-1"><span className={`w-2 h-2 rounded-full ${s?.color || "bg-neutral"}`} />{s?.label || status}</Badge>;
  };

  const getProgress = (status: string) => {
    const map: Record<string, number> = { plan: 25, do: 50, check: 75, act: 90, completed: 100 };
    return map[status] || 0;
  };

  const { printReport } = useSchoolReport();
  const detailRecord = records.find((r: any) => r.id === detailId);
  const totalBudget = records.reduce((s, r: any) => s + (r.budget_amount || 0), 0);
  const completedCount = records.filter((r: any) => r.status === "completed").length;

  const statusLabel = (s: string) => STATUSES.find(x => x.value === s)?.label || s;

  const handlePrintAll = () => {
    const summary = buildInfoGrid([
      { label: "ปีการศึกษา", value: String(academicYear) },
      { label: "แผนงานทั้งหมด", value: `${records.length} โครงการ` },
      { label: "เสร็จสิ้น", value: `${completedCount} โครงการ` },
      { label: "งบประมาณรวม", value: `฿${totalBudget.toLocaleString()}` },
    ]);
    const table = buildTable(
      [
        { label: "ลำดับ", align: "center", width: "35px" },
        { label: "รหัส", align: "center" },
        { label: "ชื่อโครงการ", align: "left" },
        { label: "ฝ่ายงาน", align: "center" },
        { label: "สถานะ", align: "center" },
        { label: "งบ (฿)", align: "right" },
        { label: "ผู้รับผิดชอบ", align: "left" },
      ],
      records.map((r: any, i: number) => [
        String(i + 1),
        r.plan_code || "-",
        r.title,
        r.department,
        statusLabel(r.status),
        r.budget_amount ? `฿${r.budget_amount.toLocaleString()}` : "-",
        r.responsible_person || "-",
      ]),
      ["", "", "รวมงบประมาณ", "", "", `฿${totalBudget.toLocaleString()}`, ""]
    );
    printReport(`${summary}${buildSectionTitle("สรุปแผนปฏิบัติการ")}${table}`, {
      documentTitle: "รายงานแผนปฏิบัติการ / PDCA",
      subtitle: `ปีการศึกษา ${academicYear}`,
    });
  };

  const handlePrintDetail = (r: any) => {
    const info = buildInfoGrid([
      { label: "รหัสแผน", value: r.plan_code || "-" },
      { label: "ฝ่ายงาน", value: r.department },
      { label: "ผู้รับผิดชอบ", value: r.responsible_person || "-" },
      { label: "งบประมาณ", value: r.budget_amount ? `฿${r.budget_amount.toLocaleString()}` : "-" },
      { label: "ระยะเวลา", value: `${r.start_date || "..."} ถึง ${r.end_date || "..."}` },
      { label: "สถานะ", value: statusLabel(r.status) },
    ]);
    const kpi = r.kpi_indicator ? buildSectionTitle("ตัวชี้วัด (KPI)") + buildBodyText(`${r.kpi_indicator} → เป้าหมาย: ${r.kpi_target || "-"}`) : "";
    const pdcaSections = [
      { key: "plan_details", title: "P - Plan (วางแผน)" },
      { key: "do_details", title: "D - Do (ดำเนินการ)" },
      { key: "check_details", title: "C - Check (ตรวจสอบ)" },
      { key: "act_details", title: "A - Act (ปรับปรุง)" },
    ].filter(s => r[s.key]).map(s => buildSectionTitle(s.title) + buildBodyText(r[s.key])).join("");
    const result = r.overall_result ? buildSectionTitle("ผลลัพธ์ภาพรวม") + buildBodyText(r.overall_result) : "";

    printReport(`${info}${r.description ? buildBodyText(r.description) : ""}${kpi}${pdcaSections}${result}`, {
      documentTitle: r.title,
      subtitle: `แผนปฏิบัติการ ปีการศึกษา ${academicYear}`,
      additionalSigners: [
        { name: r.responsible_person || undefined, title: "ผู้รับผิดชอบโครงการ" },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            {L("แผนปฏิบัติการ / PDCA", "Action Plan / PDCA")}
          </h1>
          <p className="text-sm text-muted-foreground">{L("จัดการแผนงาน/โครงการตามวงจร PDCA ตามแบบฟอร์ม สพฐ.", "Manage plans/projects with PDCA cycle per OBEC standards")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintAll}>
            <Printer className="w-4 h-4 mr-1" />{L("พิมพ์รายงาน", "Print Report")}
          </Button>
          {canManage && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" />{L("เพิ่มแผนงาน", "Add Plan")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? L("แก้ไขแผนงาน", "Edit Plan") : L("เพิ่มแผนงาน/โครงการ", "New Plan/Project")}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
                <Tabs defaultValue="info">
                  <TabsList className="w-full">
                    <TabsTrigger value="info" className="flex-1">{L("ข้อมูลทั่วไป", "General")}</TabsTrigger>
                    <TabsTrigger value="pdca" className="flex-1">PDCA</TabsTrigger>
                  </TabsList>
                  <TabsContent value="info" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>{L("รหัสแผน", "Plan Code")}</Label><Input value={form.plan_code} onChange={e => setForm(f => ({ ...f, plan_code: e.target.value }))} placeholder="เช่น AC-001" /></div>
                      <div><Label>{L("ฝ่ายงาน", "Department")}</Label>
                        <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>{L("ชื่อโครงการ/แผนงาน", "Project Title")}</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
                    <div><Label>{L("รายละเอียด", "Description")}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>{L("กลยุทธ์", "Strategy")}</Label><Input value={form.strategy} onChange={e => setForm(f => ({ ...f, strategy: e.target.value }))} /></div>
                      <div><Label>{L("วัตถุประสงค์", "Objective")}</Label><Input value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>{L("ตัวชี้วัด (KPI)", "KPI Indicator")}</Label><Input value={form.kpi_indicator} onChange={e => setForm(f => ({ ...f, kpi_indicator: e.target.value }))} /></div>
                      <div><Label>{L("เป้าหมาย", "Target")}</Label><Input value={form.kpi_target} onChange={e => setForm(f => ({ ...f, kpi_target: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>{L("ผู้รับผิดชอบ", "Responsible")}</Label><Input value={form.responsible_person} onChange={e => setForm(f => ({ ...f, responsible_person: e.target.value }))} /></div>
                      <div><Label>{L("งบประมาณ (฿)", "Budget")}</Label><Input type="number" value={form.budget_amount} onChange={e => setForm(f => ({ ...f, budget_amount: Number(e.target.value) }))} /></div>
                      <div><Label>{L("แหล่งงบ", "Source")}</Label><Input value={form.budget_source} onChange={e => setForm(f => ({ ...f, budget_source: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>{L("วันเริ่ม", "Start")}</Label><BEDatePicker value={form.start_date} onChange={(v) => setForm(f => ({ ...f, start_date: v }))} /></div>
                      <div><Label>{L("วันสิ้นสุด", "End")}</Label><BEDatePicker value={form.end_date} onChange={(v) => setForm(f => ({ ...f, end_date: v }))} /></div>
                      <div><Label>{L("สถานะ", "Status")}</Label>
                        <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="pdca" className="space-y-3 mt-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="border-l-4 border-info/30 pl-3">
                        <Label className="text-info font-semibold">P - Plan ({L("วางแผน", "Planning")})</Label>
                        <Textarea value={form.plan_details} onChange={e => setForm(f => ({ ...f, plan_details: e.target.value }))} rows={3} placeholder={L("รายละเอียดขั้นตอนการวางแผน...", "Planning details...")} />
                      </div>
                      <div className="border-l-4 border-warning/30 pl-3">
                        <Label className="text-warning font-semibold">D - Do ({L("ดำเนินการ", "Implementation")})</Label>
                        <Textarea value={form.do_details} onChange={e => setForm(f => ({ ...f, do_details: e.target.value }))} rows={3} placeholder={L("รายละเอียดการดำเนินงาน...", "Implementation details...")} />
                      </div>
                      <div className="border-l-4 border-warning/30 pl-3">
                        <Label className="text-warning font-semibold">C - Check ({L("ตรวจสอบ", "Evaluation")})</Label>
                        <Textarea value={form.check_details} onChange={e => setForm(f => ({ ...f, check_details: e.target.value }))} rows={3} placeholder={L("ผลการตรวจสอบ/ประเมินผล...", "Evaluation results...")} />
                      </div>
                      <div className="border-l-4 border-success/30 pl-3">
                        <Label className="text-success font-semibold">A - Act ({L("ปรับปรุง", "Improvement")})</Label>
                        <Textarea value={form.act_details} onChange={e => setForm(f => ({ ...f, act_details: e.target.value }))} rows={3} placeholder={L("แนวทางการปรับปรุง/พัฒนา...", "Improvement actions...")} />
                      </div>
                      <div><Label>{L("ผลลัพธ์ภาพรวม", "Overall Result")}</Label><Textarea value={form.overall_result} onChange={e => setForm(f => ({ ...f, overall_result: e.target.value }))} rows={2} /></div>
                    </div>
                  </TabsContent>
                </Tabs>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{L("บันทึก", "Save")}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><ClipboardCheck className="w-5 h-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">{L("แผนงานทั้งหมด", "Total Plans")}</p><p className="text-xl font-bold">{records.length}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="w-5 h-5 text-success" /></div><div><p className="text-xs text-muted-foreground">{L("เสร็จสิ้น", "Completed")}</p><p className="text-xl font-bold">{completedCount}/{records.length}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-warning/10"><DollarSign className="w-5 h-5 text-warning" /></div><div><p className="text-xs text-muted-foreground">{L("งบประมาณรวม", "Total Budget")}</p><p className="text-xl font-bold">฿{totalBudget.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-info/10"><BarChart3 className="w-5 h-5 text-info" /></div><div><p className="text-xs text-muted-foreground">{L("อัตราสำเร็จ", "Success Rate")}</p><p className="text-xl font-bold">{records.length > 0 ? Math.round(completedCount / records.length * 100) : 0}%</p></div></CardContent></Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailRecord && (
            <>
              <DialogHeader><DialogTitle>{detailRecord.title}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {getStatusBadge(detailRecord.status)}
                  <Badge variant="outline">{detailRecord.department}</Badge>
                  {detailRecord.plan_code && <Badge variant="secondary">{detailRecord.plan_code}</Badge>}
                </div>
                <Progress value={getProgress(detailRecord.status)} className="h-2" />
                {detailRecord.description && <p className="text-sm text-muted-foreground">{detailRecord.description}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailRecord.objective && <div><span className="text-muted-foreground">{L("วัตถุประสงค์", "Objective")}:</span> {detailRecord.objective}</div>}
                  {detailRecord.kpi_indicator && <div><span className="text-muted-foreground">KPI:</span> {detailRecord.kpi_indicator} → {detailRecord.kpi_target}</div>}
                  {detailRecord.responsible_person && <div><span className="text-muted-foreground">{L("ผู้รับผิดชอบ", "Responsible")}:</span> {detailRecord.responsible_person}</div>}
                  {detailRecord.budget_amount > 0 && <div><span className="text-muted-foreground">{L("งบ", "Budget")}:</span> ฿{detailRecord.budget_amount?.toLocaleString()}</div>}
                </div>
                <div className="space-y-3">
                  {[
                    { key: "plan_details", label: "P - Plan", color: "border-info/30" },
                    { key: "do_details", label: "D - Do", color: "border-warning/30" },
                    { key: "check_details", label: "C - Check", color: "border-warning/30" },
                    { key: "act_details", label: "A - Act", color: "border-success/30" },
                  ].map(({ key, label, color }) => (
                    (detailRecord as any)[key] && (
                      <div key={key} className={`border-l-4 ${color} pl-3`}>
                        <p className="font-semibold text-sm">{label}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{(detailRecord as any)[key]}</p>
                      </div>
                    )
                  ))}
                </div>
                {detailRecord.overall_result && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-semibold text-sm">{L("ผลลัพธ์", "Result")}</p>
                    <p className="text-sm">{detailRecord.overall_result}</p>
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => handlePrintDetail(detailRecord)}>
                  <Printer className="w-4 h-4 mr-1" />{L("พิมพ์โครงการนี้", "Print This Plan")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>{L("รายการแผนงาน/โครงการ", "Plans & Projects")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground text-center py-8">{L("กำลังโหลด...", "Loading...")}</p> : records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{L("ยังไม่มีข้อมูล", "No records yet")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L("รหัส", "Code")}</TableHead>
                    <TableHead>{L("ชื่อโครงการ", "Project")}</TableHead>
                    <TableHead>{L("ฝ่าย", "Dept")}</TableHead>
                    <TableHead>{L("สถานะ", "Status")}</TableHead>
                    <TableHead className="text-right">{L("งบ (฿)", "Budget")}</TableHead>
                    <TableHead className="w-28">{L("ความคืบหน้า", "Progress")}</TableHead>
                    {canManage && <TableHead className="w-24"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetailId(r.id)}>
                      <TableCell className="font-mono text-xs">{r.plan_code || "-"}</TableCell>
                      <TableCell><div className="font-medium">{r.title}</div>{r.responsible_person && <div className="text-xs text-muted-foreground">{r.responsible_person}</div>}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.department}</Badge></TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">{r.budget_amount ? `฿${r.budget_amount.toLocaleString()}` : "-"}</TableCell>
                      <TableCell><Progress value={getProgress(r.status)} className="h-1.5" /></TableCell>
                      {canManage && (
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { if (await swal.confirm({ title: L("ลบ?", "Delete?"), danger: true })) deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActionPlanPage;
