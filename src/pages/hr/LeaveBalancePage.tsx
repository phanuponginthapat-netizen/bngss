import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CalendarDays, Calculator, Pencil, Users } from "lucide-react";

type LeaveBalance = {
  id: string;
  user_id: string;
  year: number;
  leave_type: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
  first_name?: string;
  last_name?: string;
  prefix?: string;
};

const LEAVE_TYPES = [
  { value: "sick", th: "ลาป่วย", en: "Sick Leave" },
  { value: "personal", th: "ลากิจส่วนตัว", en: "Personal Leave" },
  { value: "vacation", th: "ลาพักผ่อน", en: "Vacation" },
  { value: "maternity", th: "ลาคลอดบุตร", en: "Maternity" },
  { value: "training", th: "ลาไปอบรม", en: "Training" },
];

const LEAVE_TYPE_COLORS: Record<string, string> = {
  sick: "bg-amber-500",
  personal: "bg-sky-500",
  vacation: "bg-emerald-500",
  maternity: "bg-purple-500",
  training: "bg-orange-500",
};

const LeaveBalancePage = () => {
  const { lang } = useLanguage();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveBalance | null>(null);
  const [newTotal, setNewTotal] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ["leave-balances", year],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leave_balances")
        .select(`
          id, user_id, year, leave_type, total_days, used_days, remaining_days,
          profiles:user_id (first_name, last_name, prefix)
        `)
        .eq("year", year)
        .order("leave_type");
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        first_name: b.profiles?.first_name,
        last_name: b.profiles?.last_name,
        prefix: b.profiles?.prefix,
      })) as LeaveBalance[];
    },
  });

  const staffBalances = (() => {
    const map: Record<string, { name: string; types: Record<string, LeaveBalance> }> = {};
    balances.forEach((b) => {
      if (!map[b.user_id]) {
        map[b.user_id] = {
          name: `${b.prefix || ""}${b.first_name || ""} ${b.last_name || ""}`.trim(),
          types: {},
        };
      }
      map[b.user_id].types[b.leave_type] = b;
    });
    return Object.entries(map).sort((a, b) => a[1].name.localeCompare(b[1].name, "th"));
  })();

  const handleCalculate = async () => {
    try {
      const { error } = await supabase.rpc("calculate_leave_balances" as any, { _year: year } as any);
      if (error) throw error;
      toast.success(lang === "th" ? "คำนวณยอดลาสำเร็จ" : "Balances calculated");
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openAdjust = (b: LeaveBalance) => {
    setSelected(b);
    setNewTotal(String(b.total_days));
    setAdjustOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const val = parseFloat(newTotal);
      if (isNaN(val) || val < 0) {
        toast.error(lang === "th" ? "กรุณากรอกจำนวนวันที่ถูกต้อง" : "Invalid number of days");
        return;
      }
      const { error } = await (supabase as any)
        .from("leave_balances")
        .update({ total_days: val, updated_at: new Date().toISOString() })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success(lang === "th" ? "อัปเดตสำเร็จ" : "Updated");
      setAdjustOpen(false);
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (t: string) => LEAVE_TYPES.find((x) => x.value === t)?.[lang === "th" ? "th" : "en"] || t;

  return (
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+8rem)] md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            {lang === "th" ? "ยอดลาคงเหลือ" : "Leave Balance"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "th"
              ? "คำนวณอัตโนมัติตามพระราชบัญญัติแรงงานไทย"
              : "Auto-calculated per Thai Labor Law"}
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
          />
          {isAdmin && (
            <Button onClick={handleCalculate} className="gap-2">
              <Calculator className="w-4 h-4" />
              {lang === "th" ? "คำนวณ" : "Calculate"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "บุคลากรทั้งหมด" : "Total Staff"}</p>
                <p className="text-3xl font-bold text-primary">{staffBalances.length}</p>
              </div>
              <Users className="w-10 h-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "รายการทั้งหมด" : "Total Records"}</p>
                <p className="text-3xl font-bold text-emerald-600">{balances.length}</p>
              </div>
              <CalendarDays className="w-10 h-10 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "ปีที่เลือก" : "Selected Year"}</p>
                <p className="text-3xl font-bold text-amber-600">{year}</p>
              </div>
              <Badge variant="outline" className="text-lg px-3 py-1">{year}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">{lang === "th" ? "ชื่อ" : "Name"}</TableHead>
                <TableHead>{lang === "th" ? "ลาป่วย" : "Sick"}</TableHead>
                <TableHead>{lang === "th" ? "ลากิจ" : "Personal"}</TableHead>
                <TableHead>{lang === "th" ? "ลาพักผ่อน" : "Vacation"}</TableHead>
                {isAdmin && <TableHead className="w-[80px]">{lang === "th" ? "จัดการ" : "Actions"}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffBalances.map(([uid, { name, types }]) => (
                <TableRow key={uid}>
                  <TableCell className="font-medium">{name}</TableCell>
                  {["sick", "personal", "vacation"].map((lt) => {
                    const b = types[lt];
                    if (!b) return <TableCell key={lt} className="text-muted-foreground">-</TableCell>;
                    const pct = b.total_days > 0 ? (b.used_days / b.total_days) * 100 : 0;
                    return (
                      <TableCell key={lt}>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span>{b.used_days}/{b.total_days}</span>
                            <span className="text-muted-foreground text-xs">{b.remaining_days} {lang === "th" ? "เหลือ" : "left"}</span>
                          </div>
                          <Progress
                            value={pct}
                            className="h-2"
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                  {isAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const firstType = types["sick"] || types["personal"] || types["vacation"];
                        if (firstType) openAdjust(firstType);
                      }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {staffBalances.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-muted-foreground">
                    {lang === "th" ? "ไม่มีข้อมูลยอดลา" : "No balance data"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              {lang === "th" ? "แก้ไขยอดลา" : "Adjust Leave Balance"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {selected.leave_type && getTypeLabel(selected.leave_type)} · {year}
              </div>
              <div>
                <Label>{lang === "th" ? "จำนวนวันทั้งหมด" : "Total Days"}</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={newTotal}
                  onChange={(e) => setNewTotal(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {lang === "th" ? "ใช้ไปแล้ว" : "Used"}: {selected.used_days} · {lang === "th" ? "เหลือ" : "Remaining"}: {selected.remaining_days}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              {lang === "th" ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (lang === "th" ? "กำลังบันทึก..." : "Saving...") : (lang === "th" ? "บันทึก" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveBalancePage;
