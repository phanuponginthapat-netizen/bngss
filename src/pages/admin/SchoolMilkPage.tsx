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
import { toast } from "sonner";
import { Plus, Milk, Package, Users, Thermometer, Pencil, Trash2, AlertTriangle, Printer } from "lucide-react";
import { format } from "date-fns";
import { useSchoolReport } from "@/hooks/useSchoolReport";
import { buildTable, buildInfoGrid, buildSummaryBox, buildSectionTitle } from "@/lib/obecReportBuilder";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { swal } from "@/lib/swal";

const MILK_TYPES = ["พาสเจอร์ไรส์", "UHT", "นมถั่วเหลือง", "นมกล่อง"];
const QUALITY_STATUSES = ["ปกติ", "พบปัญหา", "เสื่อมคุณภาพ", "คืนซัพพลายเออร์"];
const GRADE_OPTIONS = ["อ.1", "อ.2", "อ.3", "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6", "ม.1", "ม.2", "ม.3"];

const SchoolMilkPage = () => {
  const { lang } = useLanguage();
  const { isAdmin, isDirector, isTeacher } = useUserRole();
  const { currentAcademicYear: academicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const canManage = isAdmin || isDirector || isTeacher;
  const L = (th: string, en: string) => lang === "th" ? th : en;

  const [form, setForm] = useState({
    distribution_date: format(new Date(), "yyyy-MM-dd"),
    milk_type: "พาสเจอร์ไรส์",
    milk_brand: "",
    quantity_boxes: 0,
    student_count: 0,
    actual_recipients: 0,
    supplier: "",
    batch_number: "",
    expiry_date: "",
    temperature_check: 0,
    quality_status: "ปกติ",
    budget_source: "อปท.",
    unit_cost: 6.58,
    notes: "",
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["school-milk", academicYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_milk_records")
        .select("*")
        .eq("academic_year", academicYear)
        .order("distribution_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        ...values,
        academic_year: academicYear,
        total_cost: values.quantity_boxes * values.unit_cost,
        expiry_date: values.expiry_date || null,
        temperature_check: values.temperature_check || null,
      };
      if (editId) {
        const { error } = await supabase.from("school_milk_records").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_milk_records").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-milk"] });
      toast.success(editId ? L("แก้ไขสำเร็จ", "Updated") : L("บันทึกสำเร็จ", "Saved"));
      resetForm();
    },
    onError: () => toast.error(L("เกิดข้อผิดพลาด", "Error")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_milk_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-milk"] });
      toast.success(L("ลบสำเร็จ", "Deleted"));
    },
  });

  const resetForm = () => {
    setForm({ distribution_date: format(new Date(), "yyyy-MM-dd"), milk_type: "พาสเจอร์ไรส์", milk_brand: "", quantity_boxes: 0, student_count: 0, actual_recipients: 0, supplier: "", batch_number: "", expiry_date: "", temperature_check: 0, quality_status: "ปกติ", budget_source: "อปท.", unit_cost: 6.58, notes: "" });
    setEditId(null);
    setOpen(false);
  };

  const handleEdit = (r: any) => {
    setForm({
      distribution_date: r.distribution_date, milk_type: r.milk_type, milk_brand: r.milk_brand || "",
      quantity_boxes: r.quantity_boxes, student_count: r.student_count, actual_recipients: r.actual_recipients || 0,
      supplier: r.supplier || "", batch_number: r.batch_number || "", expiry_date: r.expiry_date || "",
      temperature_check: r.temperature_check || 0, quality_status: r.quality_status || "ปกติ",
      budget_source: r.budget_source || "อปท.", unit_cost: r.unit_cost || 6.58, notes: r.notes || "",
    });
    setEditId(r.id);
    setOpen(true);
  };

  const { printReport } = useSchoolReport();

  const totalBoxes = records.reduce((s, r) => s + (r.quantity_boxes || 0), 0);
  const totalCost = records.reduce((s, r) => s + (r.total_cost || 0), 0);
  const issueCount = records.filter((r: any) => r.quality_status !== "ปกติ").length;

  const handlePrint = () => {
    const summary = buildInfoGrid([
      { label: "ปีการศึกษา", value: String(academicYear) },
      { label: "จำนวนวันแจก", value: `${records.length} วัน` },
      { label: "รวมจำนวนกล่อง", value: `${totalBoxes.toLocaleString()} กล่อง` },
      { label: "ค่าใช้จ่ายรวม", value: `฿${totalCost.toLocaleString()}` },
    ]);
    const table = buildTable(
      [
        { label: "ลำดับ", align: "center", width: "40px" },
        { label: "วันที่", align: "center" },
        { label: "ประเภท/ยี่ห้อ", align: "left" },
        { label: "จำนวนกล่อง", align: "center" },
        { label: "นร./รับจริง", align: "center" },
        { label: "เลขล็อต", align: "center" },
        { label: "คุณภาพ", align: "center" },
        { label: "รวม (฿)", align: "right" },
      ],
      records.map((r: any, i: number) => [
        String(i + 1),
        r.distribution_date,
        `${r.milk_type}${r.milk_brand ? ` (${r.milk_brand})` : ""}`,
        String(r.quantity_boxes),
        `${r.student_count}/${r.actual_recipients || 0}`,
        r.batch_number || "-",
        r.quality_status,
        `฿${(r.total_cost || 0).toLocaleString()}`,
      ]),
      ["", "", "รวมทั้งสิ้น", String(totalBoxes), "", "", "", `฿${totalCost.toLocaleString()}`]
    );
    const issues = issueCount > 0 ? buildSummaryBox([{ label: "พบปัญหาคุณภาพ", value: `${issueCount} รายการ` }]) : "";
    printReport(`${summary}${buildSectionTitle("รายการแจกนมโรงเรียน")}${table}${issues}`, {
      documentTitle: "รายงานนมโรงเรียน",
      subtitle: `ปีการศึกษา ${academicYear}`,
      additionalSigners: [{ title: "ผู้รับผิดชอบโครงการนมโรงเรียน" }],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Milk className="w-6 h-6 text-primary" />
            {L("ระบบนมโรงเรียน", "School Milk Program")}
          </h1>
          <p className="text-sm text-muted-foreground">{L("บันทึกการแจกนมตามแบบฟอร์ม สพฐ./อปท.", "Milk distribution records per OBEC/LGO standards")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />{L("พิมพ์รายงาน", "Print Report")}
          </Button>
          {canManage && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" />{L("บันทึกการแจก", "Add Record")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? L("แก้ไขข้อมูล", "Edit Record") : L("บันทึกการแจกนม", "New Milk Record")}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{L("วันที่แจก", "Date")}</Label><BEDatePicker value={form.distribution_date} onChange={(v) => setForm(f => ({ ...f, distribution_date: v }))} /></div>
                  <div><Label>{L("ประเภทนม", "Milk Type")}</Label>
                    <Select value={form.milk_type} onValueChange={v => setForm(f => ({ ...f, milk_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MILK_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{L("ยี่ห้อ", "Brand")}</Label><Input value={form.milk_brand} onChange={e => setForm(f => ({ ...f, milk_brand: e.target.value }))} /></div>
                  <div><Label>{L("ผู้จำหน่าย", "Supplier")}</Label><Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>{L("จำนวนกล่อง", "Boxes")}</Label><Input type="number" value={form.quantity_boxes} onChange={e => setForm(f => ({ ...f, quantity_boxes: Number(e.target.value) }))} /></div>
                  <div><Label>{L("นักเรียน", "Students")}</Label><Input type="number" value={form.student_count} onChange={e => setForm(f => ({ ...f, student_count: Number(e.target.value) }))} /></div>
                  <div><Label>{L("รับจริง", "Actual")}</Label><Input type="number" value={form.actual_recipients} onChange={e => setForm(f => ({ ...f, actual_recipients: Number(e.target.value) }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{L("เลขล็อต", "Batch No.")}</Label><Input value={form.batch_number} onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))} /></div>
                  <div><Label>{L("วันหมดอายุ", "Expiry")}</Label><BEDatePicker value={form.expiry_date} onChange={(v) => setForm(f => ({ ...f, expiry_date: v }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{L("อุณหภูมิ (°C)", "Temp (°C)")}</Label><Input type="number" step="0.1" value={form.temperature_check} onChange={e => setForm(f => ({ ...f, temperature_check: Number(e.target.value) }))} /></div>
                  <div><Label>{L("สถานะคุณภาพ", "Quality")}</Label>
                    <Select value={form.quality_status} onValueChange={v => setForm(f => ({ ...f, quality_status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{QUALITY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{L("ราคา/กล่อง (฿)", "Cost/Box")}</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: Number(e.target.value) }))} /></div>
                  <div><Label>{L("แหล่งงบ", "Budget")}</Label><Input value={form.budget_source} onChange={e => setForm(f => ({ ...f, budget_source: e.target.value }))} /></div>
                </div>
                <div><Label>{L("หมายเหตุ", "Notes")}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  {L("รวมค่าใช้จ่าย", "Total Cost")}: <strong>฿{(form.quantity_boxes * form.unit_cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{L("บันทึก", "Save")}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Milk className="w-5 h-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">{L("จำนวนวันแจก", "Days")}</p><p className="text-xl font-bold">{records.length}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-success/10"><Package className="w-5 h-5 text-success" /></div><div><p className="text-xs text-muted-foreground">{L("รวมกล่อง", "Total Boxes")}</p><p className="text-xl font-bold">{totalBoxes.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-warning/10"><Thermometer className="w-5 h-5 text-warning" /></div><div><p className="text-xs text-muted-foreground">{L("ค่าใช้จ่ายรวม", "Total Cost")}</p><p className="text-xl font-bold">฿{totalCost.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className={`p-2 rounded-lg ${issueCount > 0 ? "bg-danger/10" : "bg-success/10"}`}><AlertTriangle className={`w-5 h-5 ${issueCount > 0 ? "text-danger" : "text-success"}`} /></div><div><p className="text-xs text-muted-foreground">{L("พบปัญหา", "Issues")}</p><p className="text-xl font-bold">{issueCount}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{L("รายการแจกนม", "Milk Distribution Records")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground text-center py-8">{L("กำลังโหลด...", "Loading...")}</p> : records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{L("ยังไม่มีข้อมูล", "No records yet")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L("วันที่", "Date")}</TableHead>
                    <TableHead>{L("ประเภท/ยี่ห้อ", "Type/Brand")}</TableHead>
                    <TableHead className="text-center">{L("กล่อง", "Boxes")}</TableHead>
                    <TableHead className="text-center">{L("นร./รับจริง", "Students")}</TableHead>
                    <TableHead>{L("ล็อต", "Batch")}</TableHead>
                    <TableHead>{L("คุณภาพ", "Quality")}</TableHead>
                    <TableHead className="text-right">{L("รวม", "Total")}</TableHead>
                    {canManage && <TableHead className="w-20"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.distribution_date}</TableCell>
                      <TableCell><div className="font-medium">{r.milk_type}</div>{r.milk_brand && <div className="text-xs text-muted-foreground">{r.milk_brand}</div>}</TableCell>
                      <TableCell className="text-center">{r.quantity_boxes}</TableCell>
                      <TableCell className="text-center">{r.student_count}/{r.actual_recipients || 0}</TableCell>
                      <TableCell className="text-xs">{r.batch_number || "-"}</TableCell>
                      <TableCell><Badge variant={r.quality_status === "ปกติ" ? "default" : "destructive"}>{r.quality_status}</Badge></TableCell>
                      <TableCell className="text-right font-medium">฿{(r.total_cost || 0).toLocaleString()}</TableCell>
                      {canManage && (
                        <TableCell>
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

export default SchoolMilkPage;
