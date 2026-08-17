import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, BarChart3, Wallet, Calendar } from "lucide-react";
import { toBE, currentBEYear } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { StatCard } from "@/components/shared";
import { saveErrorMessage, safeNum, safeInt, nullIfEmpty } from "@/lib/saveError";
import { swal } from "@/lib/swal";

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
  const { role } = useUserRole();
  const canManageBalance = role === "admin" || role === "director";
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

  // Filters
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterMonth, setFilterMonth] = useState("all");
  const [viewMode, setViewMode] = useState("all"); // all, income, expense

  // Balance form
  const [balAccountName, setBalAccountName] = useState("");
  const [balAmount, setBalAmount] = useState("");
  const [balNotes, setBalNotes] = useState("");

  const { data: records = [] } = useQuery({
    queryKey: ["budget_transactions"],
    queryFn: async () => {
      const { data } = await supabase.from("budget_transactions").select("*").order("transaction_date", { ascending: false });
      return data || [];
    },
  });

  const { data: balances = [] } = useQuery({
    queryKey: ["account_balances"],
    queryFn: async () => {
      const { data } = await supabase.from("account_balances").select("*").order("updated_at", { ascending: false });
      return data || [];
    },
  });

  // Filter records
  const filteredRecords = records.filter((r: any) => {
    const date = new Date(r.transaction_date);
    const yearMatch = filterYear === "all" || date.getFullYear() === parseInt(filterYear);
    const monthMatch = filterMonth === "all" || (date.getMonth() + 1) === parseInt(filterMonth);
    const typeMatch = viewMode === "all" || r.transaction_type === viewMode;
    return yearMatch && monthMatch && typeMatch;
  });

  // Summaries based on filtered
  const totalIncome = filteredRecords.filter((r: any) => r.transaction_type === "income").reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalExpense = filteredRecords.filter((r: any) => r.transaction_type === "expense").reduce((s: number, r: any) => s + Number(r.amount), 0);
  const txBalance = totalIncome - totalExpense;
  const totalAccountBalance = balances.reduce((s: number, b: any) => s + Number(b.balance || 0), 0);
  const displayBalance = balances.length > 0 ? totalAccountBalance : txBalance;

  // Available years from data
  const availableYears = [...new Set(records.map((r: any) => new Date(r.transaction_date).getFullYear()))].sort((a, b) => b - a);
  if (!availableYears.includes(currentYear)) availableYears.unshift(currentYear);

  const handleAdd = async () => {
    if (saving) return;
    if (!description || !amount) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const amt = safeNum(amount, 0);
    if (amt <= 0) { toast.error("จำนวนเงินต้องมากกว่า 0"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("budget_transactions").insert({
        transaction_type: txType, category, project_name: nullIfEmpty(projectName), description,
        amount: amt, budget_source: budgetSource, quarter: safeInt(quarter, 1),
        receipt_number: nullIfEmpty(receiptNumber), notes: nullIfEmpty(notes),
      } as any);
      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success("บันทึกสำเร็จ");
      qc.invalidateQueries({ queryKey: ["budget_transactions"] });
      setOpen(false); resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTxType("expense"); setCategory("operational"); setProjectName("");
    setDescription(""); setAmount(""); setBudgetSource("งบประมาณ");
    setQuarter("1"); setReceiptNumber(""); setNotes("");
  };

  const handleDelete = async (id: string) => {
    const ok = await swal.confirm({ title: "ต้องการลบรายการนี้หรือไม่?", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("budget_transactions").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบสำเร็จ");
    qc.invalidateQueries({ queryKey: ["budget_transactions"] });
  };

  const handleAddBalance = async () => {
    if (savingBalance) return;
    if (!balAccountName || !balAmount) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const bal = safeNum(balAmount, 0);
    setSavingBalance(true);
    try {
      const { error } = await supabase.from("account_balances").insert({
        account_name: balAccountName,
        balance: bal,
        notes: nullIfEmpty(balNotes),
      } as any);
      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success("บันทึกยอมคงเหลือสำเร็จ");
      qc.invalidateQueries({ queryKey: ["account_balances"] });
      setBalanceOpen(false);
      setBalAccountName(""); setBalAmount(""); setBalNotes("");
    } finally {
      setSavingBalance(false);
    }
  };

  const handleDeleteBalance = async (id: string) => {
    const ok = await swal.confirm({ title: "ต้องการลบยอดคงเหลือนี้หรือไม่?", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("account_balances").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบสำเร็จ");
    qc.invalidateQueries({ queryKey: ["account_balances"] });
  };

  const formatMoney = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${toBE(d.getFullYear())}`;
  };

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
        <div className="flex gap-2">
          {canManageBalance && (
            <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
              <DialogTrigger asChild><Button variant="outline"><Wallet className="w-4 h-4 mr-2" />บันทึกยอดคงเหลือ</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>บันทึกยอดคงเหลือบัญชี</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>ชื่อบัญชี *</Label><Input value={balAccountName} onChange={e => setBalAccountName(e.target.value)} placeholder="เช่น บัญชีเงินอุดหนุน" /></div>
                  <div><Label>ยอดคงเหลือ (บาท) *</Label><Input type="number" value={balAmount} onChange={e => setBalAmount(e.target.value)} /></div>
                  <div><Label>หมายเหตุ</Label><Textarea value={balNotes} onChange={e => setBalNotes(e.target.value)} rows={2} /></div>
                  <Button onClick={handleAddBalance} className="w-full" disabled={savingBalance}>{savingBalance ? "กำลังบันทึก..." : "บันทึก"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />บันทึกรายการ</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>บันทึกรายการรับ-จ่าย</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="รายรับ" value={`฿${formatMoney(totalIncome)}`} icon={TrendingUp} tone="success" />
        <StatCard label="รายจ่าย" value={`฿${formatMoney(totalExpense)}`} icon={TrendingDown} tone="destructive" />
        <StatCard
          label="คงเหลือ (รายการ)"
          value={`฿${formatMoney(txBalance)}`}
          icon={BarChart3}
          tone={txBalance >= 0 ? "primary" : "destructive"}
        />
        <StatCard
          label="ยอดคงเหลือบัญชีรวม"
          value={`฿${formatMoney(displayBalance)}`}
          icon={Wallet}
          tone={displayBalance >= 0 ? "primary" : "destructive"}
          highlighted={balances.length > 0}
          hint={balances.length > 0 ? `จาก ${balances.length} บัญชี` : undefined}
        />
      </div>

      {/* Account Balances */}
      {balances.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4" /> ยอดคงเหลือบัญชี</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {balances.map((b: any) => (
                <div key={b.id} className="border rounded-lg p-3 flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{b.account_name}</p>
                    <p className="text-lg font-bold text-primary">฿{formatMoney(Number(b.balance))}</p>
                    {b.notes && <p className="text-xs text-muted-foreground mt-1">{b.notes}</p>}
                    <p className="text-xs text-muted-foreground">อัปเดต: {formatThaiDate(b.updated_at)}</p>
                  </div>
                  {canManageBalance && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteBalance(b.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Table */}
      <Card><CardContent className="p-0">
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
                <TableCell><Badge className={r.transaction_type === "income" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>{r.transaction_type === "income" ? "รับ" : "จ่าย"}</Badge></TableCell>
                <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
                <TableCell>{r.project_name || "-"}</TableCell>
                <TableCell><Badge variant="outline">{r.budget_source}</Badge></TableCell>
                <TableCell className={`text-right font-mono ${r.transaction_type === "income" ? "text-emerald-600" : "text-red-600"}`}>{r.transaction_type === "income" ? "+" : "-"}฿{formatMoney(Number(r.amount))}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
            {filteredRecords.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default BudgetAccountingPage;
