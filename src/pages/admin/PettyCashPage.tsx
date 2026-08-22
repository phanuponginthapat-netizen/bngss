import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, Download, TrendingUp, TrendingDown } from "lucide-react";
import { todayBangkok } from "@/lib/dateBE";

interface PettyCashEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "in" | "out";
  category: string | null;
  receipt_no: string | null;
  created_at: string;
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

  const addMutation = useMutation({
    mutationFn: async (entry: typeof form) => {
      const { error } = await supabase.from("petty_cash").insert({
        date: entry.date,
        description: entry.description,
        amount: Number(entry.amount),
        type: entry.type,
        category: entry.category || null,
        receipt_no: entry.receipt_no || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["petty_cash"] });
      setDialogOpen(false);
      setForm({ date: todayBangkok(), description: "", amount: "", type: "out", category: "", receipt_no: "" });
    },
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

  const exportCsv = () => {
    const rows = [
      ["วันที่", "รายการ", "ประเภท", "จำนวนเงิน", "หมวดหมู่", "ใบเสร็จ"],
      ...filtered.map((e) => [
        e.date,
        e.description,
        e.type === "in" ? "รับ" : "จ่าย",
        e.amount,
        e.category || "-",
        e.receipt_no || "-",
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
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <span className="text-sm font-medium">ยอดคงเหลือ</span>
                </div>
                <p className="text-2xl font-bold text-blue-800 mt-1">{summary.balance.toLocaleString()} ฿</p>
              </CardContent>
            </Card>
          </div>

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
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>ใบเสร็จ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ไม่มีรายการ</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((e) => (
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
                      <TableCell className="text-xs">{e.category || "-"}</TableCell>
                      <TableCell className="text-xs">{e.receipt_no || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            แสดง {filtered.length} รายการ
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button
              onClick={() => addMutation.mutate(form)}
              disabled={!form.description || !form.amount}
            >
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
