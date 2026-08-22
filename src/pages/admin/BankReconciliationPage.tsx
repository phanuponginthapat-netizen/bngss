import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle, XCircle, RefreshCw, Wallet, Landmark, ArrowLeftRight, PiggyBank } from "lucide-react";
import { toast } from "sonner";

interface BudgetTxn {
  id: string;
  date: string; // mapped from transaction_date
  description: string;
  amount: number;
  category: string | null;
}

interface PettyCashRecon {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "in" | "out";
  category: string | null;
}

interface BankRow {
  idx: number;
  date: string;
  description: string;
  amount: number;
  matched: boolean;
  matchedId: string | null;
  matchedSource: "budget" | "petty" | null;
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
    rows.push({ idx: i, date: date.trim(), description: desc, amount, matched: false, matchedId: null, matchedSource: null });
  }
  return rows;
}

export default function BankReconciliationPage() {
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [manualMatch, setManualMatch] = useState<Record<number, string>>({});

  const { data: budgetTxns = [], isLoading } = useQuery({
    queryKey: ["budget_transactions_recon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_transactions")
        .select("id, transaction_date, description, amount, category")
        .order("transaction_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        date: r.transaction_date,
        description: r.description,
        amount: Number(r.amount),
        category: r.category,
      })) as BudgetTxn[];
    },
  });

  // Fetch petty_cash last 30 days and auto-reconcile
  const { data: pettyEntries = [], isLoading: pettyLoading } = useQuery({
    queryKey: ["petty_cash_recon_30d"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const iso = since.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("petty_cash")
        .select("id, date, description, amount, type, category")
        .gte("date", iso)
        .order("date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PettyCashRecon[];
    },
  });

  const petty30Stats = useMemo(() => {
    const totalIn = pettyEntries.filter((p) => p.type === "in").reduce((s, p) => s + Number(p.amount), 0);
    const totalOut = pettyEntries.filter((p) => p.type === "out").reduce((s, p) => s + Number(p.amount), 0);
    return { totalIn, totalOut, net: totalIn - totalOut, count: pettyEntries.length };
  }, [pettyEntries]);

  const budgetStats = useMemo(() => {
    const total = budgetTxns.reduce((s, b) => s + Number(b.amount), 0);
    return { total, count: budgetTxns.length };
  }, [budgetTxns]);

  const autoMatched = useMemo(() => {
    if (!bankRows.length) return bankRows;
    return bankRows.map((row) => {
      // try budget first
      const bMatch = budgetTxns.find(
        (bt) => Math.abs(Number(bt.amount) - row.amount) < 0.01 && bt.date === row.date
      );
      if (bMatch) {
        return { ...row, matched: true, matchedId: bMatch.id, matchedSource: "budget" as const };
      }
      // then petty_cash last 30 days
      const pMatch = pettyEntries.find(
        (pc) => Math.abs(Number(pc.amount) - row.amount) < 0.01 && pc.date === row.date
      );
      if (pMatch) {
        return { ...row, matched: true, matchedId: pMatch.id, matchedSource: "petty" as const };
      }
      // fuzzy: amount only match within 30d if date off by 1 day (optional minimal)
      const pFuzzy = pettyEntries.find((pc) => Math.abs(Number(pc.amount) - row.amount) < 0.01);
      if (pFuzzy && bankRows.length < 50) {
        // not auto-match fuzzy to avoid false positives, keep unmatched
      }
      return row;
    });
  }, [bankRows, budgetTxns, pettyEntries]);

  const matched = autoMatched.filter((r) => r.matched);
  const unmatched = autoMatched.filter((r) => !r.matched);
  const matchedBudget = autoMatched.filter((r) => r.matchedSource === "budget").length;
  const matchedPetty = autoMatched.filter((r) => r.matchedSource === "petty").length;

  const bankTotal = useMemo(() => bankRows.reduce((s, r) => s + r.amount, 0), [bankRows]);
  const diffVsPetty = bankTotal - petty30Stats.totalOut;
  const diffVsBudget = bankTotal - budgetStats.total;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseBankCsv(text);
      setBankRows(parsed);
      if (parsed.length) {
        toast.success(`อัปโหลดสำเร็จ ${parsed.length} รายการ • กำลังเทียบกับ petty_cash 30 วันอัตโนมัติ`);
      }
    };
    reader.readAsText(file);
  };

  const handleManualMatch = (bankIdx: number, value: string) => {
    // value format "budget:id" or "petty:id"
    const [source, id] = value.split(":");
    setBankRows((prev) =>
      prev.map((r) =>
        r.idx === bankIdx ? { ...r, matched: true, matchedId: id, matchedSource: source as any } : r
      )
    );
    setManualMatch((prev) => {
      const next = { ...prev };
      delete next[bankIdx];
      return next;
    });
    toast.success(`จับคู่ด้วยมือสำเร็จ (${source === "petty" ? "เงินสดย่อย" : "งบประมาณ"})`);
  };

  const exportCsv = () => {
    const rows = [
      ["วันที่ bank", "รายการ bank", "จำนวนเงิน", "จับคู่แล้ว", "แหล่งที่มา", "Match ID"],
      ...autoMatched.map((r) => [
        r.date,
        r.description,
        r.amount,
        r.matched ? "ใช่" : "ไม่",
        r.matchedSource === "petty" ? "petty_cash" : r.matchedSource === "budget" ? "budget" : "-",
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
          <CardDescription>
            เทียบยอด bank statement กับ petty_cash (30 วันล่าสุด) และ budget_transactions อัตโนมัติ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Petty + Budget summary before upload */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <p className="text-xs text-amber-800 flex items-center gap-1"><PiggyBank className="w-3 h-3" /> Petty Cash 30 วัน</p>
                <p className="text-sm font-medium text-amber-900 mt-1">{petty30Stats.count} รายการ</p>
                <p className="text-xs text-amber-700">รับ {petty30Stats.totalIn.toLocaleString()} ฿ • จ่าย {petty30Stats.totalOut.toLocaleString()} ฿</p>
                <p className="text-sm font-bold text-amber-900">Net {petty30Stats.net.toLocaleString()} ฿</p>
                {pettyLoading && <p className="text-xs text-muted-foreground">กำลังโหลด...</p>}
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <p className="text-xs text-blue-800 flex items-center gap-1"><Landmark className="w-3 h-3" /> Budget รวม</p>
                <p className="text-sm font-medium text-blue-900 mt-1">{budgetStats.count} รายการ</p>
                <p className="text-xs text-blue-700">ยอดรวม {budgetStats.total.toLocaleString()} ฿</p>
                <p className="text-xs text-blue-600 mt-1">ใช้เทียบ auto-reconcile</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-slate-700 flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" /> สถานะเทียบยอด</p>
                {bankRows.length > 0 ? (
                  <>
                    <p className="text-sm font-medium">Bank {bankTotal.toLocaleString()} ฿</p>
                    <p className="text-xs">Diff vs Petty (out): {diffVsPetty.toLocaleString()} ฿</p>
                    <p className="text-xs">Diff vs Budget: {diffVsBudget.toLocaleString()} ฿</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">อัปโหลดไฟล์ CSV เพื่อดูผลต่าง</p>
                )}
              </CardContent>
            </Card>
          </div>

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
            {bankRows.length > 0 && (
              <span className="text-xs text-muted-foreground self-center">เทียบอัตโนมัติ: {matchedBudget} จาก budget • {matchedPetty} จาก petty_cash 30 วัน</span>
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
                  <p className="text-xs text-emerald-600">budget {matchedBudget} • petty {matchedPetty}</p>
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

          {/* Comparison totals card */}
          {bankRows.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="p-3">
                <p className="text-xs font-medium flex items-center gap-2"><Wallet className="w-3 h-3" /> เปรียบเทียบยอดรวม</p>
                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                  <div className="bg-white border rounded p-2 text-center">
                    <p className="text-muted-foreground">Bank Total</p>
                    <p className="font-bold">{bankTotal.toLocaleString()} ฿</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-center">
                    <p className="text-amber-800">Petty 30d Out</p>
                    <p className="font-bold text-amber-900">{petty30Stats.totalOut.toLocaleString()} ฿</p>
                    <p className={`text-xs ${Math.abs(diffVsPetty) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>ต่าง {diffVsPetty.toLocaleString()} ฿</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
                    <p className="text-blue-800">Budget Total</p>
                    <p className="font-bold text-blue-900">{budgetStats.total.toLocaleString()} ฿</p>
                    <p className={`text-xs ${Math.abs(diffVsBudget) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>ต่าง {diffVsBudget.toLocaleString()} ฿</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(isLoading || pettyLoading) && <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</p>}

          {bankRows.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">วันที่</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead className="w-[130px]">สถานะ</TableHead>
                    <TableHead className="w-[260px]">จับคู่ด้วยมือ</TableHead>
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
                          <Badge className="bg-emerald-100 text-emerald-800 flex w-fit items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {row.matchedSource === "petty" ? "Petty" : row.matchedSource === "budget" ? "Budget" : "จับคู่แล้ว"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex w-fit items-center gap-1">
                            <XCircle className="w-3 h-3" /> ยังไม่จับคู่
                          </Badge>
                        )}
                        {row.matchedId && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{row.matchedId.slice(0,8)}</p>}
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
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">— Budget —</div>
                              {budgetTxns.slice(0,50).map((bt) => (
                                <SelectItem key={`budget:${bt.id}`} value={`budget:${bt.id}`} className="text-xs">
                                  [B] {bt.date} - {bt.description} ({bt.amount.toLocaleString()} ฿)
                                </SelectItem>
                              ))}
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">— Petty Cash 30 วัน —</div>
                              {pettyEntries.slice(0,50).map((pc) => (
                                <SelectItem key={`petty:${pc.id}`} value={`petty:${pc.id}`} className="text-xs">
                                  [P] {pc.date} - {pc.description} ({pc.amount.toLocaleString()} ฿) {pc.type}
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
              <p className="text-xs mt-2">ระบบจะดึง petty_cash 30 วันล่าสุดมาเทียบอัตโนมัติ และแสดงยอดรวมเปรียบเทียบ</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
