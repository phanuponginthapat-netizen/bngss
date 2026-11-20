import { fetchAllRows } from "@/lib/fetchAllRows";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, BarChart3, Wallet, Calendar, RefreshCw, Landmark } from "lucide-react";
import { toBE } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { StatCard } from "@/components/shared";
import { saveErrorMessage, safeInt, nullIfEmpty } from "@/lib/saveError";
import { swal } from "@/lib/swal";
import { accountingAmount, bangkokToday, budgetDateParts, budgetPeriodRows, budgetSummary, latestAccountSnapshots, canUseBudgetAccounting } from "@/lib/budgetAccounting";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const CATEGORIES = [
  { value: "operational", th: "ค่าดำเนินการ" },
  { value: "personnel", th: "ค่าบุคลากร" },
  { value: "investment", th: "ค่าลงทุน" },
  { value: "subsidy", th: "เงินอุดหนุน" },
  { value: "other_income", th: "เงินรายได้สถานศึกษา" },
  { value: "donation", th: "เงินบริจาค" },
];

const BUDGET_SOURCES = [
  { value: "งบประมาณ", th: "งบประมาณ" },
  { value: "เงินนอกงบประมาณ", th: "เงินนอกงบประมาณ" },
  { value: "เงินรายได้สถานศึกษา", th: "เงินรายได้สถานศึกษา" },
  { value: "เงินบริจาค", th: "เงินบริจาค" },
  { value: "เงินกสศ.", th: "เงินกสศ." },
];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const BudgetAccountingPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { role, userId, readOnly } = useUserRole();
  const canManageBalance = canUseBudgetAccounting(role) && !readOnly;
  const [open, setOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingBalance, setSavingBalance] = useState(false);
  const [txType, setTxType] = useState("expense");
  const [category, setCategory] = useState("operational");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [budgetSource, setBudgetSource] = useState("งบประมาณ");
  const [quarter, setQuarter] = useState("1");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [transactionDate, setTransactionDate] = useState(bangkokToday);
  const [balanceDate, setBalanceDate] = useState(bangkokToday);

  // Filters
  const currentYear = budgetDateParts(bangkokToday()).year;
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterMonth, setFilterMonth] = useState("all");
  const [viewMode, setViewMode] = useState("all"); // all, income, expense

  // Balance form
  const [balAccountName, setBalAccountName] = useState("");
  const [balAmount, setBalAmount] = useState("");
  const [balNotes, setBalNotes] = useState("");

  const { data: records = [], isLoading: recordsLoading, error: recordsError, refetch: refetchRecords } = useQuery({
    queryKey: ["budget_transactions", userId],
    queryFn: async () => {
      return fetchAllRows((from,to)=>supabase.from("budget_transactions").select("*").order("transaction_date",{ascending:false}).order("id").range(from,to));
    },
  });

  const { data: balances = [], isLoading: balancesLoading, error: balancesError, refetch: refetchBalances } = useQuery({
    queryKey: ["account_balances", userId],
    queryFn: async () => {
      return fetchAllRows((from,to)=>supabase.from("account_balances").select("*").order("updated_at",{ascending:false}).order("id").range(from,to));
    },
  });

  const periodRecords = budgetPeriodRows(records, filterYear, filterMonth);
  const filteredRecords = periodRecords.filter(r => viewMode === "all" || r.transaction_type === viewMode);
  const summary = budgetSummary(periodRecords);
  const { income: totalIncome, expense: totalExpense, net: txBalance } = summary;
  const accountSnapshots = latestAccountSnapshots(balances, filterYear, filterMonth);
  const totalAccountBalance = accountSnapshots.reduce((sum, b) => sum + accountingAmount(b.balance), 0);
  const availableYears = [...new Set([currentYear, ...records.map(r => budgetDateParts(r.transaction_date).year), ...balances.map(b => b.fiscal_year >= 2400 ? b.fiscal_year - 543 : b.fiscal_year)])].sort((a,b)=>b-a);

  const handleAdd = async () => {
    if (saving || !canManageBalance) return;
    if (!description || !amount) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("จำนวนเงินต้องมากกว่า 0"); return; }
    setSaving(true);
    try {
      const d = budgetDateParts(transactionDate);
      const { data, error } = await supabase.from("budget_transactions").insert({
        transaction_date: transactionDate, fiscal_year: d.year,
        transaction_type: txType, category, project_name: nullIfEmpty(projectName), description,
        amount: amt, budget_source: budgetSource, quarter: safeInt(quarter, 1),
        receipt_number: nullIfEmpty(receiptNumber), notes: nullIfEmpty(notes),
      }).select("id").single();
      if (error) throw error;
      if (!data?.id) throw new Error("ยังไม่ได้รับการยืนยันการบันทึก");
      qc.invalidateQueries({ queryKey: ["budget_transactions"] });
      setOpen(false); resetForm();
      toast.success("บันทึกรายการแล้ว", { description: `${txType === "income" ? "รับเงิน" : "จ่ายเงิน"} ${formatMoney(amt)} บาท • ${description}` });
    } catch (error) { toast.error(saveErrorMessage(error)); } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTxType("expense"); setCategory("operational"); setProjectName("");
    setDescription(""); setAmount(""); setBudgetSource("งบประมาณ");
    setQuarter("1"); setReceiptNumber(""); setNotes(""); setTransactionDate(bangkokToday());
  };

  const handleDelete = async (id: string) => {
    if (!canManageBalance) return;
    const ok = await swal.confirm({ title: "ต้องการลบรายการนี้หรือไม่?", danger: true });
    if (!ok) return;
    const { data, error } = await supabase.from("budget_transactions").delete().eq("id", id).select("id");
    if (error) { toast.error(saveErrorMessage(error)); return; }
    if (!data?.length) { toast.error("ไม่พบรายการที่ลบได้ กรุณาลองใหม่"); return; }
    toast.success("ลบสำเร็จ");
    qc.invalidateQueries({ queryKey: ["budget_transactions"] });
  };

  const handleAddBalance = async () => {
    if (savingBalance || !canManageBalance) return;
    if (!balAccountName || !balAmount) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const bal = Number(balAmount);
    if (!Number.isFinite(bal)) { toast.error("จำนวนเงินไม่ถูกต้อง"); return; }
    setSavingBalance(true);
    try {
      const d = budgetDateParts(balanceDate);
      const { data, error } = await supabase.from("account_balances").insert({
        fiscal_year: d.year, month: d.month, updated_by_user_id: userId,
        account_name: balAccountName,
        balance: bal,
        notes: nullIfEmpty(balNotes),
      }).select("id").single();
      if (error) throw error;
      if (!data?.id) throw new Error("ยังไม่ได้รับการยืนยันยอดบัญชี");
      qc.invalidateQueries({ queryKey: ["account_balances"] });
      setBalanceOpen(false);
      setBalAccountName(""); setBalAmount(""); setBalNotes("");
      toast.success("บันทึกยอดคงเหลือแล้ว", { description: `${balAccountName} • ${formatMoney(bal)} บาท` });
    } catch (error) { toast.error(saveErrorMessage(error)); } finally {
      setSavingBalance(false);
    }
  };

  const handleDeleteBalance = async (id: string) => {
    if (!canManageBalance) return;
    const ok = await swal.confirm({ title: "ต้องการลบยอดคงเหลือนี้หรือไม่?", danger: true });
    if (!ok) return;
    const { data, error } = await supabase.from("account_balances").delete().eq("id", id).select("id");
    if (error) { toast.error(saveErrorMessage(error)); return; }
    if (!data?.length) { toast.error("ไม่พบรายการที่ลบได้ กรุณาลองใหม่"); return; }
    toast.success("ลบสำเร็จ");
    qc.invalidateQueries({ queryKey: ["account_balances"] });
  };

  const formatMoney = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${toBE(d.getFullYear())}`;
  };

  if (recordsLoading || balancesLoading || recordsError || balancesError) return <div role="status" className="p-6">{recordsError || balancesError ? "อ่านข้อมูลการเงินไม่สำเร็จ" : "กำลังโหลดข้อมูลการเงิน"}<Button variant="outline" onClick={() => { void refetchRecords(); void refetchBalances(); }}>ลองใหม่</Button></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" />
            {lang === "th" ? "ระบบบริหารงบประมาณและบัญชี" : "Budget & Accounting"}
          </h1>
          <p className="text-sm text-muted-foreground">บันทึกรับ-จ่ายเงินตามแผนปฏิบัติการประจำปี</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="icon" aria-label="อัปเดตข้อมูลการเงิน" onClick={() => { void refetchRecords(); void refetchBalances(); }}><RefreshCw className="h-4 w-4" /></Button>
          {canManageBalance && (
            <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
              <DialogTrigger asChild><Button variant="outline"><Wallet className="w-4 h-4 mr-2" />บันทึกยอดคงเหลือ</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>บันทึกยอดคงเหลือบัญชี</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>วันที่ยอดบัญชี</Label><Input aria-label="วันที่ยอดบัญชี" type="date" value={balanceDate} onChange={e=>setBalanceDate(e.target.value)} /></div>
                  <div><Label>ชื่อบัญชี *</Label><Input value={balAccountName} onChange={e => setBalAccountName(e.target.value)} placeholder="เช่น บัญชีเงินอุดหนุน" /></div>
                  <div><Label>ยอดคงเหลือ (บาท) *</Label><Input type="number" value={balAmount} onChange={e => setBalAmount(e.target.value)} /></div>
                  <div><Label>หมายเหตุ</Label><Textarea value={balNotes} onChange={e => setBalNotes(e.target.value)} rows={2} /></div>
                  <Button onClick={handleAddBalance} className="w-full" disabled={savingBalance}>{savingBalance ? "กำลังบันทึก..." : "บันทึก"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canManageBalance && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />บันทึกรายการ</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>บันทึกรายการรับ-จ่าย</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div><Label>วันที่รายการ *</Label><Input aria-label="วันที่รายการ" type="date" value={transactionDate} onChange={e=>setTransactionDate(e.target.value)} /></div>
                <div>
                  <Label>ประเภทรายการ</Label>
                  <Select value={txType} onValueChange={setTxType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">รับเงิน</SelectItem>
                      <SelectItem value="expense">จ่ายเงิน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>หมวดรายการ</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.th}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>แหล่งงบ</Label>
                  <Select value={budgetSource} onValueChange={setBudgetSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUDGET_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.th}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>ชื่อโครงการ</Label><Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="เช่น โครงการพัฒนาผู้เรียน" /></div>
                <div><Label>รายละเอียด *</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>จำนวนเงิน (บาท) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                  <div><Label>ไตรมาส</Label>
                    <Select value={quarter} onValueChange={setQuarter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1">Q1</SelectItem><SelectItem value="2">Q2</SelectItem><SelectItem value="3">Q3</SelectItem><SelectItem value="4">Q4</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>เลขที่ใบเสร็จ</Label><Input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} /></div>
                <div><Label>หมายเหตุ</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
                <Button onClick={handleAdd} className="w-full" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
              </div>
            </DialogContent>
          </Dialog>}
        </div>
      </div>

      {/* Filters */}
      <section className="border-y border-border py-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกปี</SelectItem>
                {availableYears.map(y => <SelectItem key={y} value={String(y)}>พ.ศ. {toBE(y)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกเดือน</SelectItem>
                {THAI_MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="income">รายรับ</SelectItem>
                <SelectItem value="expense">รายจ่าย</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">{filteredRecords.length} รายการ</span>
          </div>
        </div>
      </section>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="รายรับ" value={`฿${formatMoney(totalIncome)}`} icon={TrendingUp} tone="success" />
        <StatCard label="รายจ่าย" value={`฿${formatMoney(totalExpense)}`} icon={TrendingDown} tone="destructive" />
        <StatCard
          label="ผลต่างรับ–จ่าย"
          value={`฿${formatMoney(txBalance)}`}
          icon={BarChart3}
          tone={txBalance >= 0 ? "primary" : "destructive"}
        />
        <StatCard
          label="ยอดคงเหลือบัญชีรวม"
          value={accountSnapshots.length ? `฿${formatMoney(totalAccountBalance)}` : "—"}
          icon={Wallet}
          tone={totalAccountBalance >= 0 ? "primary" : "destructive"}
          highlighted={accountSnapshots.length > 0}
          hint={accountSnapshots.length ? `ยอดล่าสุด ${accountSnapshots.length} บัญชีในช่วงที่เลือก` : "ยังไม่ได้บันทึกยอดบัญชีในช่วงนี้"}
        />
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] border-y border-border py-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-5"><BarChart3 className="h-5 w-5 text-primary" /><h2 className="font-semibold">ภาพรวมรับ–จ่ายรายเดือน</h2></div>
          {periodRecords.length ? <div className="h-72 w-full" aria-label="กราฟรายรับและรายจ่ายรายเดือน"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.months} barGap={3}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="month" tickFormatter={m=>THAI_MONTHS[m-1]?.slice(0,3) || String(m)} tick={{fill:"hsl(var(--muted-foreground))",fontSize:12}} axisLine={false} tickLine={false} />
            <YAxis width={65} tickFormatter={n=>Number(n).toLocaleString('th-TH',{notation:'compact'})} tick={{fill:"hsl(var(--muted-foreground))",fontSize:12}} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v:number)=>`${formatMoney(v)} บาท`} labelFormatter={m=>THAI_MONTHS[Number(m)-1]} contentStyle={{background:"hsl(var(--card))",borderColor:"hsl(var(--border))",color:"hsl(var(--foreground))"}} /><Legend />
            <Bar name="รายรับ" dataKey="income" fill="hsl(var(--success))" radius={[3,3,0,0]} /><Bar name="รายจ่าย" dataKey="expense" fill="hsl(var(--destructive))" radius={[3,3,0,0]} />
          </BarChart></ResponsiveContainer></div> : <div className="h-72 flex flex-col items-center justify-center text-muted-foreground bg-muted/30"><BarChart3 className="h-10 w-10 mb-3 opacity-40" /><p>ยังไม่มีรายการในช่วงที่เลือก</p></div>}
        </div>
        <div className="min-w-0"><h2 className="font-semibold flex items-center gap-2 mb-5"><Landmark className="h-5 w-5 text-primary" />แหล่งงบประมาณ</h2>
          {summary.sources.length ? summary.sources.map(source=><div key={source.name} className="border-b border-border py-3"><p className="font-medium text-sm break-words">{source.name}</p><dl className="mt-2 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">รับ</dt><dd className="text-success tabular-nums break-all">฿{formatMoney(source.income)}</dd></div><div><dt className="text-muted-foreground">จ่าย</dt><dd className="text-destructive tabular-nums break-all">฿{formatMoney(source.expense)}</dd></div></dl></div>) : <p className="text-sm text-muted-foreground py-8">ยังไม่มีรายการแหล่งงบ</p>}
        </div>
      </section>

      {/* Account Balances */}
      {accountSnapshots.length > 0 && (
        <section>
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Wallet className="w-4 h-4" /> ยอดคงเหลือบัญชี</h2>
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {accountSnapshots.map((b: any) => (
                <div key={b.id} className="border rounded-lg p-3 flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{b.account_name}</p>
                    <p className="text-lg font-bold text-primary">฿{formatMoney(Number(b.balance))}</p>
                    {b.notes && <p className="text-xs text-muted-foreground mt-1">{b.notes}</p>}
                    <p className="text-xs text-muted-foreground">อัปเดต: {formatThaiDate(b.updated_at)}</p>
                  </div>
                  {canManageBalance && (
                    <Button variant="ghost" size="sm" aria-label={`ลบยอดบัญชี ${b.account_name}`} onClick={() => handleDeleteBalance(b.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Transaction Table */}
      <section className="min-w-0"><h2 className="font-semibold mb-4">รายการรับ–จ่าย <span className="text-muted-foreground font-normal text-sm">({filteredRecords.length})</span></h2><div className="overflow-x-auto border-y border-border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>วันที่</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>รายละเอียด</TableHead>
            <TableHead>โครงการ</TableHead>
            <TableHead>แหล่งงบ</TableHead>
            <TableHead className="text-right">จำนวนเงิน</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredRecords.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-sm">{formatThaiDate(r.transaction_date)}</TableCell>
                <TableCell><Badge className={r.transaction_type === "income" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>{r.transaction_type === "income" ? "รับ" : "จ่าย"}</Badge></TableCell>
                <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
                <TableCell>{r.project_name || "-"}</TableCell>
                <TableCell><Badge variant="outline">{r.budget_source}</Badge></TableCell>
                <TableCell className={`text-right font-mono ${r.transaction_type === "income" ? "text-success" : "text-destructive"}`}>{r.transaction_type === "income" ? "+" : "-"}฿{formatMoney(Number(r.amount))}</TableCell>
                <TableCell>{canManageBalance && <Button aria-label={`ลบรายการ ${r.description}`} variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}</TableCell>
              </TableRow>
            ))}
            {filteredRecords.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div></section>
    </div>
  );
};

export default BudgetAccountingPage;
