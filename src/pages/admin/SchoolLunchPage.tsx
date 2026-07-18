import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { toCE } from "@/lib/utils";
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
import { Plus, UtensilsCrossed, TrendingUp, Users, DollarSign, Pencil, Trash2, Printer } from "lucide-react";
import { format } from "date-fns";
import { useSchoolReport } from "@/hooks/useSchoolReport";
import { buildTable, buildInfoGrid, buildSummaryBox, buildSectionTitle } from "@/lib/obecReportBuilder";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { swal } from "@/lib/swal";

const BUDGET_SOURCES = ["อปท.", "เงินอุดหนุนรัฐบาล", "เงินบริจาค", "งบประมาณโรงเรียน", "กสศ."];

const SchoolLunchPage = () => {
  const { lang } = useLanguage();
  const { isAdmin, isDirector, isTeacher } = useUserRole();
  const { currentAcademicYear: academicYear } = useAcademicYear();
  const academicYearCE = toCE(academicYear);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const canManage = isAdmin || isDirector || isTeacher;
  const L = (th: string, en: string) => lang === "th" ? th : en;

  const [form, setForm] = useState({
    lunch_date: format(new Date(), "yyyy-MM-dd"),
    menu_name: "",
    menu_description: "",
    student_count: 0,
    actual_eaters: 0,
    cost_per_head: 21,
    budget_source: "อปท.",
    nutrition_info: "",
    prepared_by: "",
    notes: "",
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["school-lunch", academicYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_lunch_records")
        .select("*")
        .eq("academic_year", academicYearCE)
        .order("lunch_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        ...values,
        academic_year: academicYearCE,
        total_cost: values.actual_eaters * values.cost_per_head,
      };
      if (editId) {
        const { error } = await supabase.from("school_lunch_records").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_lunch_records").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-lunch"] });
      toast.success(editId ? L("แก้ไขสำเร็จ", "Updated") : L("บันทึกสำเร็จ", "Saved"));
      resetForm();
    },
    onError: () => toast.error(L("เกิดข้อผิดพลาด", "Error")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_lunch_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-lunch"] });
      toast.success(L("ลบสำเร็จ", "Deleted"));
    },
  });

  const resetForm = () => {
    setForm({ lunch_date: format(new Date(), "yyyy-MM-dd"), menu_name: "", menu_description: "", student_count: 0, actual_eaters: 0, cost_per_head: 21, budget_source: "อปท.", nutrition_info: "", prepared_by: "", notes: "" });
    setEditId(null);
    setOpen(false);
  };

  const handleEdit = (r: any) => {
    setForm({
      lunch_date: r.lunch_date, menu_name: r.menu_name, menu_description: r.menu_description || "",
      student_count: r.student_count, actual_eaters: r.actual_eaters || 0, cost_per_head: r.cost_per_head || 21,
      budget_source: r.budget_source || "อปท.", nutrition_info: r.nutrition_info || "", prepared_by: r.prepared_by || "", notes: r.notes || "",
    });
    setEditId(r.id);
    setOpen(true);
  };

  const { printReport } = useSchoolReport();

  // Stats
  const totalMeals = records.reduce((s, r) => s + (r.actual_eaters || 0), 0);
  const totalCost = records.reduce((s, r) => s + (r.total_cost || 0), 0);
  const avgCost = records.length > 0 ? totalCost / records.length : 0;

  const handlePrint = () => {
    const thaiYear = academicYear;
    const summary = buildInfoGrid([
      { label: "ปีการศึกษา", value: String(academicYear) },
      { label: "จำนวนวันที่บันทึก", value: `${records.length} วัน` },
      { label: "รวมมื้ออาหาร", value: `${totalMeals.toLocaleString()} มื้อ` },
      { label: "ค่าใช้จ่ายรวม", value: `฿${totalCost.toLocaleString()}` },
    ]);
    const table = buildTable(
      [
        { label: "ลำดับ", align: "center", width: "40px" },
        { label: "วันที่", align: "center" },
        { label: "เมนูอาหาร", align: "left" },
        { label: "จำนวน นร.", align: "center" },
        { label: "รับจริง", align: "center" },
        { label: "ต้นทุน/หัว", align: "right" },
        { label: "รวม (฿)", align: "right" },
        { label: "แหล่งงบ", align: "center" },
      ],
      records.map((r: any, i: number) => [
        String(i + 1),
        r.lunch_date,
        r.menu_name,
        String(r.student_count),
        String(r.actual_eaters || 0),
        `฿${r.cost_per_head}`,
        `฿${(r.total_cost || 0).toLocaleString()}`,
        r.budget_source || "-",
      ]),
      ["", "", "รวมทั้งสิ้น", "", String(totalMeals), "", `฿${totalCost.toLocaleString()}`, ""]
    );
    const summaryBox = buildSummaryBox([
      { label: "ค่าเฉลี่ย/วัน", value: `฿${avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
      { label: "ค่าเฉลี่ย/หัว", value: `฿${records.length > 0 ? (totalCost / totalMeals).toFixed(2) : "0"}` },
    ]);
    printReport(`${summary}${buildSectionTitle("รายการบันทึกอาหารกลางวัน")}${table}${summaryBox}`, {
      documentTitle: "รายงานอาหารกลางวัน",
      subtitle: `ปีการศึกษา ${academicYear}`,
      additionalSigners: [{ title: "ผู้จัดทำรายงาน" }],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-primary" />
            {L("ระบบอาหารกลางวัน", "School Lunch Program")}
          </h1>
          <p className="text-sm text-muted-foreground">{L("บันทึกข้อมูลอาหารกลางวันตามแบบฟอร์ม สพฐ.", "Daily lunch records per OBEC standards")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />{L("พิมพ์รายงาน", "Print Report")}
          </Button>
          {canManage && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" />{L("บันทึกประจำวัน", "Add Record")}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg sm:max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? L("แก้ไขข้อมูล", "Edit Record") : L("บันทึกอาหารกลางวัน", "New Lunch Record")}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>{L("วันที่", "Date")}</Label><BEDatePicker value={form.lunch_date} onChange={(v) => setForm(f => ({ ...f, lunch_date: v }))} /></div>
                  <div><Label>{L("แหล่งงบ", "Budget Source")}</Label>
                    <Select value={form.budget_source} onValueChange={v => setForm(f => ({ ...f, budget_source: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{BUDGET_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>{L("เมนูอาหาร", "Menu")}</Label><Input value={form.menu_name} onChange={e => setForm(f => ({ ...f, menu_name: e.target.value }))} required placeholder={L("เช่น ข้าวผัดไก่, แกงจืด", "e.g. Fried rice, Soup")} /></div>
                <div><Label>{L("รายละเอียดเมนู", "Menu Description")}</Label><Textarea value={form.menu_description} onChange={e => setForm(f => ({ ...f, menu_description: e.target.value }))} rows={2} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><Label>{L("จำนวนนักเรียน", "Students")}</Label><Input type="number" value={form.student_count} onChange={e => setForm(f => ({ ...f, student_count: Number(e.target.value) }))} /></div>
                  <div><Label>{L("รับจริง", "Actual")}</Label><Input type="number" value={form.actual_eaters} onChange={e => setForm(f => ({ ...f, actual_eaters: Number(e.target.value) }))} /></div>
                  <div><Label>{L("ต้นทุน/หัว (฿)", "Cost/Head")}</Label><Input type="number" value={form.cost_per_head} onChange={e => setForm(f => ({ ...f, cost_per_head: Number(e.target.value) }))} /></div>
                </div>
                <div><Label>{L("ข้อมูลโภชนาการ", "Nutrition")}</Label><Input value={form.nutrition_info} onChange={e => setForm(f => ({ ...f, nutrition_info: e.target.value }))} placeholder={L("พลังงาน, โปรตีน, ไขมัน", "Calories, Protein, Fat")} /></div>
                <div><Label>{L("ผู้จัดทำ", "Prepared by")}</Label><Input value={form.prepared_by} onChange={e => setForm(f => ({ ...f, prepared_by: e.target.value }))} /></div>
                <div><Label>{L("หมายเหตุ", "Notes")}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  {L("รวมค่าใช้จ่าย", "Total Cost")}: <strong>฿{(form.actual_eaters * form.cost_per_head).toLocaleString()}</strong>
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>{L("บันทึก", "Save")}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><UtensilsCrossed className="w-5 h-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">{L("จำนวนวันที่บันทึก", "Days Recorded")}</p><p className="text-xl font-bold">{records.length}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10"><Users className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-muted-foreground">{L("รวมมื้ออาหาร", "Total Meals")}</p><p className="text-xl font-bold">{totalMeals.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-orange-500/10"><DollarSign className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-muted-foreground">{L("ค่าใช้จ่ายรวม", "Total Cost")}</p><p className="text-xl font-bold">฿{totalCost.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><TrendingUp className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">{L("เฉลี่ย/วัน", "Avg/Day")}</p><p className="text-xl font-bold">฿{avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>{L("รายการบันทึกอาหารกลางวัน", "Lunch Records")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground text-center py-8">{L("กำลังโหลด...", "Loading...")}</p> : records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{L("ยังไม่มีข้อมูล", "No records yet")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L("วันที่", "Date")}</TableHead>
                    <TableHead>{L("เมนู", "Menu")}</TableHead>
                    <TableHead className="text-center">{L("จำนวน/รับจริง", "Count/Actual")}</TableHead>
                    <TableHead className="text-right">{L("ต้นทุน/หัว", "Cost/Head")}</TableHead>
                    <TableHead className="text-right">{L("รวม", "Total")}</TableHead>
                    <TableHead>{L("แหล่งงบ", "Source")}</TableHead>
                    {canManage && <TableHead className="w-20"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.lunch_date}</TableCell>
                      <TableCell><div className="font-medium">{r.menu_name}</div>{r.menu_description && <div className="text-xs text-muted-foreground">{r.menu_description}</div>}</TableCell>
                      <TableCell className="text-center">{r.student_count}/{r.actual_eaters || 0}</TableCell>
                      <TableCell className="text-right">฿{r.cost_per_head}</TableCell>
                      <TableCell className="text-right font-medium">฿{(r.total_cost || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{r.budget_source}</Badge></TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { if (await swal.confirm({ title: L("ลบรายการนี้?", "Delete?"), danger: true })) deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
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

export default SchoolLunchPage;
