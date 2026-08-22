import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, Download, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, Calendar, PiggyBank } from "lucide-react";
import { todayBangkok } from "@/lib/dateBE";
import { toast } from "sonner";

interface PettyCashEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "in" | "out";
  category: string | null;
  receipt_no: string | null;
  created_at: string;
  budget_transaction_id?: string | null;
}

const CATEGORIES = [
  "ค่าอาหาร", "ค่าเดินทาง", "ค่าอุปกรณ์", "ค่าบริการ", "ค่าซ่อมบำรุง",
  "เงินเดือน", "ค่าสาธารณูปโภค", "อื่นๆ",
];

export default function PettyCashPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [form, setForm] = useState({
    date: todayBangkok(),
    description: "",
    amount: "",
    type: "out" as "in" | "out",
    category: "",
    receipt_no: "",
  });

  const todayStr = todayBangkok();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["petty_cash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("petty_cash")
        .select("*")
        .order("date", { ascending: false });
      return (data ?? []) as PettyCashEntry[];
    },
  });

  // Budget totals for remaining vs budget - link to budget_transactions
  const { data: budgetInfo } = useQuery({
    queryKey: ["budget_totals_for_petty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_transactions")
        .select("amount, transaction_type, approval_status");
      if (error) throw error;
      const rows = (data ?? []) as any[];
      // approved or pending budgets considered as pool, expense as usage
      const income = rows
        .filter((r) => r.transaction_type === "income")
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const expense = rows
        .filter((r) => r.transaction_type === "expense")
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalPool = income || rows.reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
      return { totalPool, income, expense, count: rows.length };
    },
  });

  const addMutation = useMutation({
    mutationFn: async (entry: typeof form) => {
      const { error } = await supabase.from("petty_cash").insert({
        date: entry.date,
        description: entry.description,
        amount: Number(entry.amount),
        type: entry.type,
        category: entry.category || null,
        receipt_no: entry.receipt_no || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["petty_cash"] });
      toast.success("บันทึกรายการเงินสดย่อยสำเร็จ");
      setDialogOpen(false);
      setForm({ date: todayBangkok(), description: "", amount: "", type: "out", category: "", receipt_no: "" });
    },
    onError: (e: any) => toast.error(e.message || "บันทึกไม่สำเร็จ"),
  });

  // Transfer to budget_transactions when out > 5000
  const transferMutation = useMutation({
    mutationFn: async (entry: PettyCashEntry) => {
      if (entry.type !== "out") throw new Error("โอนได้เฉพาะรายการจ่าย (out) เท่านั้น");
      if (entry.amount <= 5000) throw new Error("ยอดต้องมากกว่า 5000 บาท จึงโอนเข้างบประมาณได้");
      const fiscalYear = new Date(entry.date).getFullYear();
      const { data, error } = await supabase
        .from("budget_transactions")
        .insert({
          description: `[PettyCash→Budget] ${entry.description}`,
          amount: entry.amount,
          transaction_type: "expense",
          transaction_date: entry.date,
          category: entry.category || "operational",
          budget_source: "เงินสดย่อย",
          notes: `โอนจาก petty_cash id=${entry.id} receipt=${entry.receipt_no || "-"} date=${entry.date}`,
          fiscal_year: fiscalYear,
          quarter: Math.floor((new Date(entry.date).getMonth() + 3) / 3),
          approval_status: "pending",
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      // try to link back if FK column exists (migration 20260822100005_finance_link)
      if (data?.id) {
        const { error: linkErr } = await supabase
          .from("petty_cash")
          .update({ budget_transaction_id: data.id } as any)
          .eq("id", entry.id);
        // ignore error if column not yet migrated
        if (linkErr && !String(linkErr.message).includes("budget_transaction_id")) {
          console.warn("link back failed", linkErr.message);
        }
      }
      return data;
    },
    onSuccess: () => {
      toast.success("โอนเข้างบประมาณสำเร็จ (สถานะ pending รออนุมัติ)");
      queryClient.invalidateQueries({ queryKey: ["budget-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget_totals_for_petty"] });
      queryClient.invalidateQueries({ queryKey: ["budget_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance_daily_summary"] });
    },
    onError: (e: any) => toast.error(e.message || "โอนไม่สำเร็จ"),
  });

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (monthFilter && !e.date.startsWith(monthFilter)) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          e.description.toLowerCase().includes(s) ||
          (e.category || "").toLowerCase().includes(s) ||
          (e.receipt_no || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [entries, search, monthFilter]);

  const summary = useMemo(() => {
    const monthEntries = entries.filter((e) => monthFilter && e.date.startsWith(monthFilter));
    const totalIn = monthEntries.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
    const totalOut = monthEntries.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [entries, monthFilter]);

  const todaySummary = useMemo(() => {
    const todayEntries = entries.filter((e) => e.date === todayStr);
    const inToday = todayEntries.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
    const outToday = todayEntries.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
    return { inToday, outToday, balanceToday: inToday - outToday, count: todayEntries.length, entries: todayEntries };
  }, [entries, todayStr]);

  // Running balance map (cumulative by date asc)
  const runningMap = useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let running = 0;
    const map = new Map<string, number>();
    for (const e of sorted) {
      running += e.type === "in" ? e.amount : -e.amount;
      map.set(e.id, running);
    }
    return map;
  }, [entries]);

  const budgetTotal = budgetInfo?.totalPool ?? 0;
  const budgetRemaining = budgetTotal > 0 ? budgetTotal - summary.totalOut : 0;
  // eligible transfers count
  const eligibleTransfers = filtered.filter((e) => e.type === "out" && e.amount > 5000).length;

  const exportCsv = () => {
    const rows = [
      ["วันที่", "รายการ", "ประเภท", "จำนวนเงิน", "หมวดหมู่", "ใบเสร็จ", "ยอดสะสม (running)"],
      ...filtered.map((e) => [
        e.date,
        e.description,
        e.type === "in" ? "รับ" : "จ่าย",
        e.amount,
        e.category || "-",
        e.receipt_no || "-",
        runningMap.get(e.id) ?? "-",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `petty_cash_${monthFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            เงินสดย่อย (Petty Cash)
          </CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> วันนี้ {todayStr} • แสดงยอดสะสม (running balance) ต่อรายการ • เชื่อมโยงงบประมาณ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Month summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">รับเดือนนี้</span>
                </div>
                <p className="text-2xl font-bold text-emerald-800 mt-1">{summary.totalIn.toLocaleString()} ฿</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-sm font-medium">จ่ายเดือนนี้</span>
                </div>
                <p className="text-2xl font-bold text-red-800 mt-1">{summary.totalOut.toLocaleString()} ฿</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">ยอดคงเหลือ (เดือนนี้)</span>
                </div>
                <p className="text-2xl font-bold text-blue-800 mt-1">{summary.balance.toLocaleString()} ฿</p>
                <p className="text-xs text-blue-600 mt-1">Running ทั้งหมด: {(runningMap.size ? Array.from(runningMap.values()).pop() : 0)?.toLocaleString()} ฿</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily + Budget link summary card */}
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-amber-700" />
                สรุปวันนี้ + เทียบงบประมาณ
                <Badge variant="outline" className="ml-auto bg-white">{todayStr}</Badge>
              </CardTitle>
              <CardDescription>
                รวม petty_cash รับ/จ่าย วันนี้ และยอดคงเหลือเทียบกับงบประมาณรวม (budget_transactions)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white rounded-lg p-3 border text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" /> รับวันนี้</p>
                  <p className="text-lg font-bold text-emerald-700">{todaySummary.inToday.toLocaleString()} ฿</p>
                  <p className="text-xs text-muted-foreground">{todaySummary.entries.filter(e=>e.type==='in').length} รายการ</p>
                </div>
                <div className="bg-white rounded-lg p-3 border text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3" /> จ่ายวันนี้</p>
                  <p className="text-lg font-bold text-red-700">{todaySummary.outToday.toLocaleString()} ฿</p>
                  <p className="text-xs text-muted-foreground">{todaySummary.entries.filter(e=>e.type==='out').length} รายการ</p>
                </div>
                <div className="bg-white rounded-lg p-3 border text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Wallet className="w-3 h-3" /> คงเหลือวันนี้</p>
                  <p className={`text-lg font-bold ${todaySummary.balanceToday >=0 ? "text-blue-700" : "text-red-700"}`}>{todaySummary.balanceToday.toLocaleString()} ฿</p>
                  <p className="text-xs text-muted-foreground">{todaySummary.count} รายการรวม</p>
                </div>
                <div className="bg-white rounded-lg p-3 border text-center">
                  <p className="text-xs text-muted-foreground">งบประมาณรวม</p>
                  <p className="text-lg font-bold text-slate-800">{budgetTotal.toLocaleString()} ฿</p>
                  <p className="text-xs text-muted-foreground">{budgetInfo?.count ?? 0} ทรานแซคชัน</p>
                </div>
                <div className={`rounded-lg p-3 border text-center ${budgetTotal>0 && budgetRemaining<0 ? "bg-red-100 border-red-300" : "bg-white"}`}>
                  <p className="text-xs text-muted-foreground">คงเหลือ vs งบ</p>
                  <p className={`text-lg font-bold ${budgetRemaining>=0 ? "text-emerald-700" : "text-red-700"}`}>{budgetTotal>0 ? budgetRemaining.toLocaleString() + " ฿" : "—"}</p>
                  <p className="text-xs text-muted-foreground">{budgetTotal>0 ? `${((budgetRemaining/budgetTotal)*100).toFixed(1)}% เหลือ` : "ยังไม่มีงบ"}</p>
                </div>
              </div>
              {budgetTotal>0 && todaySummary.outToday > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  ใช้งบไปแล้ว {summary.totalOut.toLocaleString()} ฿ จาก {budgetTotal.toLocaleString()} ฿ • สัดส่วน {(summary.totalOut / budgetTotal *100).toFixed(1)}%
                  {budgetRemaining<0 && <span className="text-red-600 font-medium"> • เกินงบประมาณ!</span>}
                </p>
              )}
              {eligibleTransfers>0 && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                  <p className="text-xs text-blue-800">พบ {eligibleTransfers} รายการจ่าย &gt; 5,000 บาท สามารถโอนเข้างบประมาณได้</p>
                  <Badge className="bg-blue-600">พร้อมโอน</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="ค้นหารายการ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-[180px]"
            />
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> เพิ่มรายการ
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">วันที่</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead className="text-right">ยอดสะสม</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>ใบเสร็จ</TableHead>
                  <TableHead className="w-[150px]">งบประมาณ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่มีรายการ</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((e) => {
                    const running = runningMap.get(e.id) ?? 0;
                    const canTransfer = e.type === "out" && e.amount > 5000;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs whitespace-nowrap">{e.date}</TableCell>
                        <TableCell className="text-sm">{e.description}</TableCell>
                        <TableCell>
                          <Badge variant={e.type === "in" ? "default" : "destructive"}>
                            {e.type === "in" ? "รับ" : "จ่าย"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={e.type === "in" ? "text-emerald-600" : "text-red-600"}>
                            {e.type === "in" ? "+" : "-"}{e.amount.toLocaleString()} ฿
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          <span className={running >=0 ? "text-slate-700" : "text-red-600"}>{running.toLocaleString()} ฿</span>
                        </TableCell>
                        <TableCell className="text-xs">{e.category || "-"}</TableCell>
                        <TableCell className="text-xs">{e.receipt_no || "-"}</TableCell>
                        <TableCell>
                          {canTransfer ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => transferMutation.mutate(e)}
                              disabled={transferMutation.isPending}
                            >
                              <ArrowRightLeft className="w-3 h-3 mr-1" /> โอนเข้างบประมาณ
                            </Button>
                          ) : e.type === "out" ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            แสดง {filtered.length} รายการ • ยอดสะสมคำนวณจากประวัติทั้งหมดเรียงตามวันที่ • ปุ่ม "โอนเข้างบประมาณ" จะสร้าง budget_transactions (pending) เมื่อยอดจ่าย &gt; 5,000 บาท
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มรายการเงินสดย่อย</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <Input
              placeholder="รายละเอียด"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "in" | "out" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">รับเงิน</SelectItem>
                  <SelectItem value="out">จ่ายเงิน</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="จำนวนเงิน"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="เลขที่ใบเสร็จ (ไม่บังคับ)"
              value={form.receipt_no}
              onChange={(e) => setForm({ ...form, receipt_no: e.target.value })}
            />
            {form.type === "out" && Number(form.amount) > 5000 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3" /> ยอด &gt; 5,000 บาท หลังบันทึกจะสามารถกด “โอนเข้างบประมาณ” เพื่อสร้าง budget_transactions ได้
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button
              onClick={() => addMutation.mutate(form)}
              disabled={!form.description || !form.amount || addMutation.isPending}
            >
              {addMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
