import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Banknote, Award } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const PROMOTION_ROUNDS = ["เมษายน", "ตุลาคม"];
const DECORATION_TYPES = ["บ.ม.", "บ.ช.", "ท.ม.", "ท.ช.", "ต.ม.", "ต.ช.", "จ.ม.", "จ.ช.", "จตุตถดิเรกคุณาภรณ์", "ตติยดิเรกคุณาภรณ์"];

const SalaryPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { role, userId, isAdmin, isDirector } = useUserRole();
  const canManageAll = isAdmin || isDirector;
  const [open, setOpen] = useState(false);
  const [personnelId, setPersonnelId] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear() + 543));
  const [baseSalary, setBaseSalary] = useState("");
  const [posAllowance, setPosAllowance] = useState("0");
  const [otherAllowance, setOtherAllowance] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [salaryStep, setSalaryStep] = useState("");
  const [promotionRound, setPromotionRound] = useState("");
  const [decorationRequest, setDecorationRequest] = useState("");
  const [notes, setNotes] = useState("");

  // Get current user's profile to find their personnel_id
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-salary", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("employee_code").eq("id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: myPersonnel } = useQuery({
    queryKey: ["my-personnel-salary", myProfile?.employee_code],
    enabled: !!myProfile?.employee_code,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id").eq("employee_code", myProfile!.employee_code!).maybeSingle();
      return data;
    },
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("*").eq("status", "active").order("first_name");
      return data || [];
    },
  });

  // Admin/director sees all, teacher sees only own
  const { data: records = [], isLoading: recordsLoading, isError: recordsError } = useQuery({
    queryKey: canManageAll ? ["salary_records"] : ["my_salary_records", myPersonnel?.id],
    enabled: canManageAll || !!myPersonnel?.id,
    queryFn: async () => {
      let q = supabase.from("salary_records").select("*, personnel(prefix, first_name, last_name, employee_code, position)");
      if (!canManageAll && myPersonnel?.id) {
        q = q.eq("personnel_id", myPersonnel.id);
      }
      const { data, error } = await q.order("salary_year", { ascending: false }).order("salary_month", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleAdd = async () => {
    const targetPersonnelId = canManageAll ? personnelId : myPersonnel?.id;
    if (!targetPersonnelId || !baseSalary) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const base = parseFloat(baseSalary);
    const pos = parseFloat(posAllowance);
    const other = parseFloat(otherAllowance);
    const ded = parseFloat(deductions);
    const net = base + pos + other - ded;
    const { error } = await supabase.from("salary_records").insert({
      personnel_id: targetPersonnelId, salary_month: parseInt(month), salary_year: parseInt(year) - 543,
      base_salary: base, position_allowance: pos, other_allowance: other, deductions: ded,
      net_salary: net, salary_step: salaryStep, promotion_round: promotionRound,
      decoration_request: decorationRequest, notes,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกสำเร็จ");
    qc.invalidateQueries({ queryKey: ["salary_records"] });
    qc.invalidateQueries({ queryKey: ["my_salary_records"] });
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("salary_records").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["salary_records"] });
    qc.invalidateQueries({ queryKey: ["my_salary_records"] });
  };

  const formatMoney = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

  if (recordsError) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-8 text-center space-y-2 text-destructive">
          <p className="font-semibold">โหลดข้อมูลเงินเดือนไม่สำเร็จ</p>
          <p className="text-sm text-muted-foreground">โปรดลองรีเฟรชหน้านี้</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {recordsLoading && <div className="text-xs text-muted-foreground animate-pulse">กำลังโหลดข้อมูลเงินเดือน...</div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" />
            ระบบเงินเดือนและเครื่องราชฯ
          </h1>
          <p className="text-sm text-muted-foreground">
            {canManageAll ? "จัดการการเลื่อนขั้นเงินเดือนและเสนอขอเครื่องราชอิสริยาภรณ์" : "ดูข้อมูลเงินเดือนและบันทึกข้อมูลของตนเอง"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />บันทึกเงินเดือน</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>บันทึกเงินเดือน{canManageAll ? "บุคลากร" : "ของฉัน"}</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {canManageAll ? (
                <div><Label>บุคลากร *</Label>
                  <Select value={personnelId} onValueChange={setPersonnelId}>
                    <SelectTrigger><SelectValue placeholder="เลือกบุคลากร" /></SelectTrigger>
                    <SelectContent>{personnel.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.employee_code} - {p.prefix}{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">บันทึกข้อมูลเงินเดือนของตนเอง</p>
                  {!myPersonnel?.id && <p className="text-destructive text-xs mt-1">⚠ ยังไม่พบข้อมูลบุคลากรของคุณในระบบ กรุณาติดต่อผู้ดูแลระบบ</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>เดือน</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>ปี พ.ศ.</Label><Input value={year} onChange={e => setYear(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>เงินเดือน *</Label><Input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} /></div>
                <div><Label>เงินประจำตำแหน่ง</Label><Input type="number" value={posAllowance} onChange={e => setPosAllowance(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>เงินอื่นๆ</Label><Input type="number" value={otherAllowance} onChange={e => setOtherAllowance(e.target.value)} /></div>
                <div><Label>หักรายการ</Label><Input type="number" value={deductions} onChange={e => setDeductions(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ขั้นเงินเดือน</Label><Input value={salaryStep} onChange={e => setSalaryStep(e.target.value)} placeholder="เช่น ค.ศ.2 ขั้น 20,000" /></div>
                <div><Label>รอบเลื่อนขั้น</Label>
                  <Select value={promotionRound} onValueChange={setPromotionRound}>
                    <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>{PROMOTION_ROUNDS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>เสนอขอเครื่องราชฯ</Label>
                <Select value={decorationRequest} onValueChange={setDecorationRequest}>
                  <SelectTrigger><SelectValue placeholder="เลือก (ถ้ามี)" /></SelectTrigger>
                  <SelectContent>{DECORATION_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>หมายเหตุ</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
              <Button onClick={handleAdd} className="w-full" disabled={!canManageAll && !myPersonnel?.id}>บันทึก</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>รหัส</TableHead>
            <TableHead>ชื่อ-สกุล</TableHead>
            <TableHead>ตำแหน่ง</TableHead>
            <TableHead>เดือน/ปี</TableHead>
            <TableHead className="text-right">เงินเดือน</TableHead>
            <TableHead className="text-right">รวมสุทธิ</TableHead>
            <TableHead>ขั้น</TableHead>
            <TableHead>เครื่องราชฯ</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.personnel?.employee_code || "-"}</TableCell>
                <TableCell>{r.personnel ? `${r.personnel.prefix || ""}${r.personnel.first_name} ${r.personnel.last_name}` : "-"}</TableCell>
                <TableCell>{r.personnel?.position || "-"}</TableCell>
                <TableCell>{MONTHS[(r.salary_month || 1) - 1]} {(r.salary_year || 0) + 543}</TableCell>
                <TableCell className="text-right font-mono">฿{formatMoney(Number(r.base_salary))}</TableCell>
                <TableCell className="text-right font-mono font-bold">฿{formatMoney(Number(r.net_salary))}</TableCell>
                <TableCell>{r.salary_step || "-"}</TableCell>
                <TableCell>{r.decoration_request ? <Badge variant="outline" className="gap-1"><Award className="w-3 h-3" />{r.decoration_request}</Badge> : "-"}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
            {records.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default SalaryPage;
