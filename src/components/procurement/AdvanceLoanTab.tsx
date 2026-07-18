import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Wallet, CheckCircle2, Send, Coins } from "lucide-react";
import { ADVANCE_STATUS, fmtMoney } from "@/lib/procurementFlow";
import { DateInput } from "@/components/ui/date-input";

interface Props { canManage: boolean }

export default function AdvanceLoanTab({ canManage }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ purpose: "", amount: "", due_date: "", notes: "" });

  const { data: advances = [] } = useQuery({
    queryKey: ["procurement_advances"],
    queryFn: async () => {
      const { data } = await supabase
        .from("procurement_advances")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleAdd = async () => {
    if (!form.purpose || !form.amount) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("กรุณาเข้าสู่ระบบ"); return; }
    const { error } = await supabase.from("procurement_advances").insert({
      borrower_id: user.id,
      purpose: form.purpose,
      amount: parseFloat(form.amount),
      due_date: form.due_date || null,
      notes: form.notes || null,
      borrowed_at: new Date().toISOString().slice(0, 10),
      status: "requested",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("ส่งคำขอยืมเงินสำเร็จ");
    qc.invalidateQueries({ queryKey: ["procurement_advances"] });
    setOpen(false);
    setForm({ purpose: "", amount: "", due_date: "", notes: "" });
  };

  const moveStatus = async (id: string, status: string, ts?: string) => {
    const patch: any = { status };
    if (ts) patch[ts] = new Date().toISOString();
    const { error } = await supabase.from("procurement_advances").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("อัปเดตสถานะแล้ว");
    qc.invalidateQueries({ queryKey: ["procurement_advances"] });
  };

  const clearAdvance = async (id: string, repaid: number, refund: number) => {
    const { error } = await supabase
      .from("procurement_advances")
      .update({
        status: "cleared",
        cleared_at: new Date().toISOString(),
        repaid_amount: repaid,
        refund_amount: refund,
      })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ส่งใช้/ล้างเงินยืมสำเร็จ");
    qc.invalidateQueries({ queryKey: ["procurement_advances"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" />ขั้น 1.3 — ยืมเงินรองราชการ</h2>
          <p className="text-xs text-muted-foreground">เฉพาะกรณี 2: ต้องสำรองจ่ายก่อนดำเนินการจัดซื้อ</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />ขอยืมเงิน</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>คำขอยืมเงินรองราชการ</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>วัตถุประสงค์ *</Label><Textarea value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>จำนวนเงิน (บาท) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
                <div><Label>กำหนดส่งใช้</Label><DateInput value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
              </div>
              <div><Label>หมายเหตุ</Label><Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleAdd} className="w-full">ส่งคำขอ</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>วันที่ยืม</TableHead>
            <TableHead>วัตถุประสงค์</TableHead>
            <TableHead className="text-right">จำนวน</TableHead>
            <TableHead>กำหนดส่ง</TableHead>
            <TableHead className="text-right">ส่งใช้แล้ว</TableHead>
            <TableHead className="text-right">คืน</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead className="w-[200px]">ดำเนินการ</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {advances.map((a: any) => {
              const meta = ADVANCE_STATUS[a.status] || { label: a.status, color: "" };
              return (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-xs">{a.borrowed_at || "-"}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{a.purpose}</TableCell>
                  <TableCell className="text-right font-mono">฿{fmtMoney(a.amount)}</TableCell>
                  <TableCell className="text-xs">{a.due_date || "-"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">฿{fmtMoney(a.repaid_amount)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">฿{fmtMoney(a.refund_amount)}</TableCell>
                  <TableCell><Badge className={meta.color}>{meta.label}</Badge></TableCell>
                  <TableCell>
                    {canManage && a.status === "requested" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moveStatus(a.id, "approved", "approved_at")}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />อนุมัติ
                      </Button>
                    )}
                    {canManage && a.status === "approved" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moveStatus(a.id, "disbursed", "disbursed_at")}>
                        <Send className="w-3 h-3 mr-1" />จ่ายเงิน
                      </Button>
                    )}
                    {canManage && a.status === "disbursed" && (
                      <ClearDialog amount={Number(a.amount)} onClear={(r, ref) => clearAdvance(a.id, r, ref)} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {advances.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่มีคำขอยืมเงิน</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function ClearDialog({ amount, onClear }: { amount: number; onClear: (repaid: number, refund: number) => void }) {
  const [open, setOpen] = useState(false);
  const [repaid, setRepaid] = useState(String(amount));
  const [refund, setRefund] = useState("0");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-7 text-xs"><Coins className="w-3 h-3 mr-1" />ส่งใช้/ล้าง</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>ส่งใช้เงินยืม / ล้างเงิน</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">ยอดยืม: <strong>฿{fmtMoney(amount)}</strong></p>
          <div><Label>ยอดที่ใช้จริง (บาท)</Label><Input type="number" value={repaid} onChange={e => setRepaid(e.target.value)} /></div>
          <div><Label>ยอดคืน (บาท)</Label><Input type="number" value={refund} onChange={e => setRefund(e.target.value)} /></div>
          <Button className="w-full" onClick={() => { onClear(parseFloat(repaid) || 0, parseFloat(refund) || 0); setOpen(false); }}>
            ยืนยันส่งใช้
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
