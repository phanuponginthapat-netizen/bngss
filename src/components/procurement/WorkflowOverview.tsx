import { STEPS, STATUS_META, type ProcurementStatus, fmtMoney } from "@/lib/procurementFlow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Circle, ShoppingCart, Wallet, FileCheck, Coins } from "lucide-react";

interface Props {
  records: any[];
  advances: any[];
}

const STAGE_ICONS = [FileCheck, CheckCircle2, ShoppingCart, Coins];

export default function WorkflowOverview({ records, advances }: Props) {
  const total = records.length;
  const totalAmount = records.reduce((s, r) => s + Number(r.amount || 0), 0);
  const byStep: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  records.forEach((r) => {
    const s = STATUS_META[r.status as ProcurementStatus]?.step;
    if (s) byStep[s] = (byStep[s] || 0) + 1;
  });
  const pendingAdvance = advances.filter((a) => a.status !== "cleared").length;
  const outstandingAdvance = advances
    .filter((a) => a.status !== "cleared")
    .reduce((s, a) => s + (Number(a.amount) - Number(a.repaid_amount) - Number(a.refund_amount)), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">รายการทั้งหมด</p>
          <p className="text-2xl font-bold">{total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">ยอดเงินรวม</p>
          <p className="text-2xl font-bold text-primary">฿{fmtMoney(totalAmount)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">เงินยืมค้าง</p>
          <p className="text-2xl font-bold text-warning">{pendingAdvance}</p>
          <p className="text-xs text-muted-foreground">฿{fmtMoney(outstandingAdvance)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">รออนุมัติ</p>
          <p className="text-2xl font-bold text-warning">{byStep[2] || 0}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">ขั้นตอนระบบจัดซื้อจัดจ้าง (e-GP)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {STEPS.map((s, i) => {
              const Icon = STAGE_ICONS[i];
              const count = byStep[s.id] || 0;
              return (
                <div key={s.id} className="flex items-center gap-3 flex-1">
                  <div className="flex-1 rounded-lg border bg-card p-4 hover:shadow-md transition">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-primary" />
                      <Badge variant="outline" className="text-xs">ขั้น {s.id}</Badge>
                    </div>
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                    <p className="text-lg font-bold text-primary mt-2">{count} <span className="text-xs text-muted-foreground font-normal">รายการ</span></p>
                  </div>
                  {i < STEPS.length - 1 && <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 hidden md:block" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4" />2 กรณีการดำเนินงาน</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border p-4 bg-success/50">
            <Badge className="bg-success-soft text-success mb-2">กรณี 1</Badge>
            <p className="font-semibold">มีงบจัดซื้อโดยตรง</p>
            <p className="text-sm text-muted-foreground">ข้ามขั้นยืมเงิน → ไปขั้นที่ 4 (จัดซื้อ + ล้างหนี้) ได้ทันที</p>
          </div>
          <div className="rounded-lg border p-4 bg-warning/50">
            <Badge className="bg-warning-soft text-warning mb-2">กรณี 2</Badge>
            <p className="font-semibold">ใช้เงินยืมรองราชการ</p>
            <p className="text-sm text-muted-foreground">ต้องสำรองจ่าย → ดำเนินขั้นยืมเงิน (1.3) ก่อนเสมอ</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
