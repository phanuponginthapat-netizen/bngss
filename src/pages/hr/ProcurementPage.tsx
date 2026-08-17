import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { saveErrorMessage } from "@/lib/saveError";

const METHODS = [
  "เฉพาะเจาะจง", "คัดเลือก", "e-bidding", "สอบราคา", "ประกวดราคา",
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "ร่าง", color: "bg-gray-100 text-gray-800" },
  pending: { label: "รอดำเนินการ", color: "bg-amber-100 text-amber-800" },
  approved: { label: "อนุมัติ", color: "bg-emerald-100 text-emerald-800" },
  completed: { label: "เสร็จสิ้น", color: "bg-blue-100 text-blue-800" },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-800" },
};

const ProcurementPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const emptyForm = () => ({ procurement_date: todayISO(), procurement_type: "purchase", method: "เฉพาะเจาะจง", description: "", vendor_name: "", amount: "", egp_number: "", contract_number: "", notes: "" });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: records = [] } = useQuery({
    queryKey: ["procurement_records"],
    queryFn: async () =>
      fetchAllRows((from, to) =>
        supabase
          .from("procurement_records")
          .select("*")
          .order("procurement_date", { ascending: false })
          .order("id")
          .range(from, to),
      ),
  });

  const handleAdd = async () => {
    const amount = parseFloat(form.amount);
    if (!form.description.trim()) { toast.error("กรุณากรอกรายละเอียด"); return; }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("จำนวนเงินต้องมากกว่า 0"); return; }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { toast.error("กรุณาเข้าสู่ระบบใหม่"); return; }
      const { error } = await supabase.from("procurement_records").insert({
        ...form,
        description: form.description.trim(),
        vendor_name: form.vendor_name.trim() || null,
        egp_number: form.egp_number.trim() || null,
        contract_number: form.contract_number.trim() || null,
        notes: form.notes.trim() || null,
        amount,
        requested_by: auth.user.id,
      } as any);
      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success("บันทึกสำเร็จ");
      qc.invalidateQueries({ queryKey: ["procurement_records"] });
      setOpen(false);
      setForm(emptyForm());
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await swal.confirm({ title: "ต้องการลบรายการนี้หรือไม่?", danger: true }))) return;
    const { error } = await supabase.from("procurement_records").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบสำเร็จ");
    qc.invalidateQueries({ queryKey: ["procurement_records"] });
  };

  const formatMoney = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            ระบบจัดซื้อจัดจ้าง (e-GP)
          </h1>
          <p className="text-sm text-muted-foreground">จัดซื้อจัดจ้างตามระเบียบกรมบัญชีกลาง</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />เพิ่มรายการ</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>บันทึกการจัดซื้อจัดจ้าง</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <Label>วันที่จัดซื้อ/จัดจ้าง *</Label>
                <Input type="date" value={form.procurement_date} onChange={e => setForm(p => ({ ...p, procurement_date: e.target.value }))} />
              </div>
              <div>
                <Label>ประเภท</Label>
                <Select value={form.procurement_type} onValueChange={v => setForm(p => ({ ...p, procurement_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">จัดซื้อ</SelectItem>
                    <SelectItem value="hire">จัดจ้าง</SelectItem>
                    <SelectItem value="lease">เช่า</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>วิธีการจัดซื้อจัดจ้าง</Label>
                <Select value={form.method} onValueChange={v => setForm(p => ({ ...p, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>รายละเอียด *</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div><Label>ผู้ขาย/ผู้รับจ้าง</Label><Input value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>จำนวนเงิน (บาท) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
                <div><Label>เลขที่ e-GP</Label><Input value={form.egp_number} onChange={e => setForm(p => ({ ...p, egp_number: e.target.value }))} /></div>
              </div>
              <div><Label>เลขที่สัญญา</Label><Input value={form.contract_number} onChange={e => setForm(p => ({ ...p, contract_number: e.target.value }))} /></div>
              <div><Label>หมายเหตุ</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
              <Button onClick={handleAdd} disabled={saving} className="w-full">{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>วันที่</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>วิธีการ</TableHead>
            <TableHead>รายละเอียด</TableHead>
            <TableHead>ผู้ขาย</TableHead>
            <TableHead className="text-right">จำนวนเงิน</TableHead>
            <TableHead>เลข e-GP</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => {
              const st = STATUS_MAP[r.status] || { label: r.status, color: "" };
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.procurement_date}</TableCell>
                  <TableCell>{r.procurement_type === "purchase" ? "จัดซื้อ" : r.procurement_type === "hire" ? "จัดจ้าง" : "เช่า"}</TableCell>
                  <TableCell><Badge variant="outline">{r.method}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
                  <TableCell>{r.vendor_name || "-"}</TableCell>
                  <TableCell className="text-right font-mono">฿{formatMoney(Number(r.amount))}</TableCell>
                  <TableCell className="font-mono text-xs">{r.egp_number || "-"}</TableCell>
                  <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                </TableRow>
              );
            })}
            {records.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default ProcurementPage;
