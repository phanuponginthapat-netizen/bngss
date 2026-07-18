import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Coins, CheckCircle2 } from "lucide-react";
import { STATUS_META, fmtMoney, type ProcurementStatus } from "@/lib/procurementFlow";

interface Props {
  records: any[];
  canManage: boolean;
}

export default function ClearingTab({ records, canManage }: Props) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Records waiting for EGPEASY clearing
  const toClear = records.filter((r) =>
    r.status === "received" || r.status === "clearing"
  );
  const closed = records.filter((r) => r.status === "closed");

  const saveEgpeasy = async (id: string) => {
    const num = edits[id]?.trim();
    if (!num) { toast.error("กรอกเลข EGPEASY ก่อน"); return; }
    const { error } = await supabase.from("procurement_records")
      .update({ egpeasy_number: num, status: "clearing" })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกเลข EGPEASY แล้ว");
    qc.invalidateQueries({ queryKey: ["procurement_records"] });
  };

  const closeItem = async (id: string) => {
    const { error } = await supabase.from("procurement_records")
      .update({ status: "closed", cleared_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ปิดงานสำเร็จ");
    qc.invalidateQueries({ queryKey: ["procurement_records"] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Coins className="w-5 h-5 text-primary" />ขั้น 5 — ล้างหนี้ผ่าน EGPEASY / e-GP</h2>
        <p className="text-xs text-muted-foreground">บันทึกเลขอ้างอิงและปิดงาน</p>
      </div>

      <Card><CardContent className="p-0">
        <div className="px-4 py-2 border-b text-sm font-medium">รายการรอล้างหนี้ ({toClear.length})</div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>โครงการ</TableHead>
            <TableHead className="text-right">จำนวน</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>เลข EGPEASY</TableHead>
            <TableHead className="w-[200px]"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {toClear.map((r: any) => {
              const meta = STATUS_META[r.status as ProcurementStatus];
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.project_name || r.description}</div>
                    <div className="text-xs text-muted-foreground">{r.vendor_name}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">฿{fmtMoney(r.amount)}</TableCell>
                  <TableCell><Badge className={meta.color}>{meta.label}</Badge></TableCell>
                  <TableCell>
                    {canManage ? (
                      <Input
                        value={edits[r.id] ?? r.egpeasy_number ?? ""}
                        onChange={(e) => setEdits(p => ({ ...p, [r.id]: e.target.value }))}
                        className="h-8 text-xs font-mono w-40"
                        placeholder="เลข EGPEASY..."
                      />
                    ) : (
                      <span className="text-xs font-mono">{r.egpeasy_number || "-"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveEgpeasy(r.id)}>บันทึก</Button>
                        {r.status === "clearing" && r.egpeasy_number && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => closeItem(r.id)}>
                            <CheckCircle2 className="w-3 h-3 mr-1" />ปิดงาน
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {toClear.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">ไม่มีรายการรอล้างหนี้</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <div className="px-4 py-2 border-b text-sm font-medium">รายการปิดงานแล้ว ({closed.length})</div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>โครงการ</TableHead>
            <TableHead className="text-right">จำนวน</TableHead>
            <TableHead>EGPEASY</TableHead>
            <TableHead>วันที่ปิด</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {closed.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.project_name || r.description}</TableCell>
                <TableCell className="text-right font-mono">฿{fmtMoney(r.amount)}</TableCell>
                <TableCell className="text-xs font-mono">{r.egpeasy_number || "-"}</TableCell>
                <TableCell className="text-xs">{r.cleared_at ? new Date(r.cleared_at).toLocaleDateString("th-TH") : "-"}</TableCell>
              </TableRow>
            ))}
            {closed.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">ยังไม่มี</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
