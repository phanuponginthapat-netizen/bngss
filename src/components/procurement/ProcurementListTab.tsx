import { Fragment, useState } from "react";
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
import { Plus, Trash2, ChevronDown, ChevronUp, FileText, Upload } from "lucide-react";
import { STATUS_META, CASE_LABEL, REQUEST_LABEL, fmtMoney, type ProcurementStatus } from "@/lib/procurementFlow";
import ProcurementStepper from "./ProcurementStepper";
import { confirmDelete } from "@/lib/confirmAction";

const METHODS = ["เฉพาะเจาะจง", "คัดเลือก", "e-bidding", "สอบราคา", "ประกวดราคา"];

interface Props {
  records: any[];
  advances: any[];
  canManage: boolean;
}

const emptyForm = {
  case_type: "case1_direct",
  request_type: "purchase",
  procurement_type: "purchase",
  method: "เฉพาะเจาะจง",
  project_name: "",
  description: "",
  vendor_name: "",
  amount: "",
  tor_text: "",
  advance_request_id: "",
  notes: "",
};

export default function ProcurementListTab({ records, advances, canManage }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleAdd = async () => {
    if (!form.description || !form.amount || !form.project_name) {
      toast.error("กรุณากรอกข้อมูลที่จำเป็น (โครงการ, รายละเอียด, จำนวนเงิน)"); return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      ...form,
      amount: parseFloat(form.amount),
      requested_by: user?.id,
      status: "draft",
      advance_request_id: form.advance_request_id || null,
    };
    const { error } = await supabase.from("procurement_records").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("สร้างคำขอจัดซื้อสำเร็จ");
    qc.invalidateQueries({ queryKey: ["procurement_records"] });
    setOpen(false);
    setForm(emptyForm);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete("ลบรายการนี้?"))) return;
    await supabase.from("procurement_records").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["procurement_records"] });
    toast.success("ลบสำเร็จ");
  };

  const moveStatus = async (id: string, status: ProcurementStatus, tsField: string | null) => {
    const patch: any = { status };
    if (tsField) patch[tsField] = new Date().toISOString();
    const { error } = await supabase.from("procurement_records").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("อัปเดตสถานะแล้ว");
    qc.invalidateQueries({ queryKey: ["procurement_records"] });
  };

  const updateRecord = async (id: string, patch: any) => {
    const { error } = await supabase.from("procurement_records").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["procurement_records"] });
  };

  const availableAdvances = advances.filter((a) => a.status === "disbursed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />ขั้น 1.4 — จัดซื้อจัดจ้าง</h2>
          <p className="text-xs text-muted-foreground">รายการคำขอ + ดำเนินการตามขั้นตอน e-GP</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />สร้างคำขอจัดซื้อ</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>คำขอจัดซื้อ/จ้าง (e-GP)</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>กรณี *</Label>
                  <Select value={form.case_type} onValueChange={v => setForm(p => ({ ...p, case_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="case1_direct">กรณี 1: มีงบจัดซื้อตรง</SelectItem>
                      <SelectItem value="case2_advance">กรณี 2: ใช้เงินยืม</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ประเภทคำขอ *</Label>
                  <Select value={form.request_type} onValueChange={v => setForm(p => ({ ...p, request_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">ซื้อพัสดุ/จ้าง</SelectItem>
                      <SelectItem value="activity">จัดกิจกรรม</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.case_type === "case2_advance" && (
                <div>
                  <Label>เงินยืมที่ใช้</Label>
                  <Select value={form.advance_request_id} onValueChange={v => setForm(p => ({ ...p, advance_request_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="เลือกเงินยืมที่จ่ายแล้ว" /></SelectTrigger>
                    <SelectContent>
                      {availableAdvances.length === 0 && <SelectItem value="__none__" disabled>ไม่มีเงินยืมที่จ่ายแล้ว</SelectItem>}
                      {availableAdvances.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.purpose} (฿{fmtMoney(a.amount)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div><Label>ชื่อโครงการ/แผนงาน *</Label><Input value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} /></div>

              <div className="grid grid-cols-2 gap-3">
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
                  <Label>วิธีการ</Label>
                  <Select value={form.method} onValueChange={v => setForm(p => ({ ...p, method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div><Label>รายละเอียดสิ่งที่จัดซื้อ/จ้าง *</Label><Textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ผู้ขาย/ผู้รับจ้าง</Label><Input value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} /></div>
                <div><Label>จำนวนเงิน (บาท) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              </div>
              <div><Label>ขอบเขตงาน (TOR)</Label><Textarea rows={3} value={form.tor_text} onChange={e => setForm(p => ({ ...p, tor_text: e.target.value }))} placeholder="ขอบเขตงาน คุณลักษณะ ราคากลาง ฯลฯ" /></div>
              <div><Label>หมายเหตุ</Label><Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleAdd} className="w-full">บันทึกเป็นร่าง</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>โครงการ</TableHead>
            <TableHead>กรณี</TableHead>
            <TableHead>วิธี</TableHead>
            <TableHead className="text-right">จำนวน</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead className="w-8"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => {
              const meta = STATUS_META[r.status as ProcurementStatus] || { label: r.status, color: "" };
              const isOpen = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.id)}>
                    <TableCell>{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.project_name || r.description}</div>
                      <div className="text-xs text-muted-foreground">{REQUEST_LABEL[r.request_type as keyof typeof REQUEST_LABEL] || r.request_type}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{CASE_LABEL[r.case_type as keyof typeof CASE_LABEL]?.replace("กรณี ", "ก.") || "-"}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.method}</Badge></TableCell>
                    <TableCell className="text-right font-mono">฿{fmtMoney(r.amount)}</TableCell>
                    <TableCell><Badge className={meta.color}>{meta.label}</Badge></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canManage && <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="space-y-3 p-2">
                          <ProcurementStepper
                            status={r.status as ProcurementStatus}
                            canManage={canManage || r.requested_by === r._currentUser}
                            onMove={(next, ts) => moveStatus(r.id, next, ts)}
                          />
                          <div className="grid md:grid-cols-2 gap-3 text-sm">
                            <div><span className="text-muted-foreground">รายละเอียด:</span> {r.description}</div>
                            <div><span className="text-muted-foreground">ผู้ขาย:</span> {r.vendor_name || "-"}</div>
                            {r.tor_text && <div className="md:col-span-2"><span className="text-muted-foreground">TOR:</span><div className="text-xs whitespace-pre-wrap bg-card border rounded p-2 mt-1">{r.tor_text}</div></div>}
                            {r.advance_request_id && <div><span className="text-muted-foreground">ใช้เงินยืม:</span> {r.advance_request_id.slice(0,8)}</div>}
                            <div><span className="text-muted-foreground">เลข e-GP:</span> {r.egp_number || "-"}</div>
                            <div><span className="text-muted-foreground">EGPEASY:</span> {r.egpeasy_number || "-"}</div>
                            <div><span className="text-muted-foreground">เลขสัญญา:</span> {r.contract_number || "-"}</div>
                          </div>
                          {canManage && r.status !== "closed" && r.status !== "cancelled" && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              <InlineEdit label="เลข e-GP" value={r.egp_number || ""} onSave={(v) => updateRecord(r.id, { egp_number: v })} />
                              <InlineEdit label="เลขสัญญา" value={r.contract_number || ""} onSave={(v) => updateRecord(r.id, { contract_number: v })} />
                              {(r.status === "clearing" || r.status === "received") && (
                                <InlineEdit label="เลข EGPEASY" value={r.egpeasy_number || ""} onSave={(v) => updateRecord(r.id, { egpeasy_number: v })} />
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {records.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ไม่มีรายการ — กดสร้างคำขอจัดซื้อ</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function InlineEdit({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs whitespace-nowrap">{label}:</Label>
      <Input value={v} onChange={(e) => setV(e.target.value)} className="h-7 text-xs w-40" />
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave(v)}>บันทึก</Button>
    </div>
  );
}
