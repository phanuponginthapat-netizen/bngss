import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface BudgetTxn {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
}

interface BankRow {
  idx: number;
  date: string;
  description: string;
  amount: number;
  matched: boolean;
  matchedId: string | null;
}

function parseBankCsv(text: string): BankRow[] {
  const lines = text.trim().split("\n");
  const rows: BankRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((c) => c.trim());
    if (parts.length < 3) continue;
    const [date, ...rest] = parts;
    const amountStr = rest[rest.length - 1];
    const desc = rest.slice(0, -1).join(" ").trim();
    const amount = Math.abs(parseFloat(amountStr.replace(/[^0-9.\-]/g, "")));
    if (isNaN(amount)) continue;
    rows.push({ idx: i, date: date.trim(), description: desc, amount, matched: false, matchedId: null });
  }
  return rows;
}

export default function BankReconciliationPage() {
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [manualMatch, setManualMatch] = useState<Record<number, string>>({});

  const { data: budgetTxns = [], isLoading } = useQuery({
    queryKey: ["budget_transactions_recon"],
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_transactions")
        .select("id, date, description, amount, category")
        .order("date", { ascending: false });
      return (data ?? []) as BudgetTxn[];
    },
  });

  const autoMatched = useMemo(() => {
    if (!bankRows.length) return bankRows;
    return bankRows.map((row) => {
      const match = budgetTxns.find(
        (bt) => !bt.id.startsWith("matched_") && Math.abs(bt.amount - row.amount) < 0.01 && bt.date === row.date
      );
      if (match) {
        return { ...row, matched: true, matchedId: match.id };
      }
      return row;
    });
  }, [bankRows, budgetTxns]);

  const matched = autoMatched.filter((r) => r.matched);
  const unmatched = autoMatched.filter((r) => !r.matched);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setBankRows(parseBankCsv(text));
    };
    reader.readAsText(file);
  };

  const handleManualMatch = (bankIdx: number, budgetId: string) => {
    setBankRows((prev) =>
      prev.map((r) =>
        r.idx === bankIdx ? { ...r, matched: true, matchedId: budgetId } : r
      )
    );
    setManualMatch((prev) => {
      const next = { ...prev };
      delete next[bankIdx];
      return next;
    });
  };

  const exportCsv = () => {
    const rows = [
      ["วันที่ bank", "รายการ bank", "จำนวนเงิน", "จับคู่แล้ว", "Match ID"],
      ...autoMatched.map((r) => [
        r.date,
        r.description,
        r.amount,
        r.matched ? "ใช่" : "ไม่",
        r.matchedId || "-",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bank_reconciliation.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            กระทบยอดธนาคาร (Bank Reconciliation)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span className="text-sm">อัปโหลดใบแจ้งยอดธนาคาร (CSV):</span>
              <Input type="file" accept=".csv" onChange={handleFileUpload} className="w-auto" />
            </label>
            {bankRows.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCsv}>
                Export CSV
              </Button>
            )}
          </div>

          {bankRows.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-blue-700">ทั้งหมด</p>
                  <p className="text-2xl font-bold text-blue-800">{bankRows.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-emerald-700 flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4" /> จับคู่แล้ว
                  </p>
                  <p className="text-2xl font-bold text-emerald-800">{matched.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-red-700 flex items-center justify-center gap-1">
                    <XCircle className="w-4 h-4" /> ยังไม่จับคู่
                  </p>
                  <p className="text-2xl font-bold text-red-800">{unmatched.length}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</p>}

          {bankRows.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">วันที่</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead className="w-[100px]">สถานะ</TableHead>
                    <TableHead className="w-[220px]">จับคู่ด้วยมือ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoMatched.map((row) => (
                    <TableRow key={row.idx}>
                      <TableCell className="text-xs whitespace-nowrap">{row.date}</TableCell>
                      <TableCell className="text-sm">{row.description}</TableCell>
                      <TableCell className="text-right font-medium">
                        {row.amount.toLocaleString()} ฿
                      </TableCell>
                      <TableCell>
                        {row.matched ? (
                          <Badge className="bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3 mr-1" /> จับคู่แล้ว
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" /> ยังไม่จับคู่
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!row.matched && (
                          <Select
                            value={manualMatch[row.idx] || ""}
                            onValueChange={(v) => {
                              setManualMatch((p) => ({ ...p, [row.idx]: v }));
                              handleManualMatch(row.idx, v);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="เลือกรายการ..." />
                            </SelectTrigger>
                            <SelectContent>
                              {budgetTxns.map((bt) => (
                                <SelectItem key={bt.id} value={bt.id} className="text-xs">
                                  {bt.date} - {bt.description} ({bt.amount.toLocaleString()} ฿)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {bankRows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>อัปโหลดไฟล์ CSV จากธนาคารเพื่อเริ่มกระทบยอด</p>
              <p className="text-xs mt-1">รูปแบบ: วันที่, รายละเอียด, จำนวนเงิน</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
