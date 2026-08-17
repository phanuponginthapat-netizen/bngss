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
import { Plus, Trash2, Heart } from "lucide-react";
import { saveErrorMessage, safeNum, nullIfEmpty } from "@/lib/saveError";
import { swal } from "@/lib/swal";

const SUBSIDY_TYPES = ["ปัจจัยพื้นฐาน", "ทุนเสมอภาค (กสศ.)", "ค่าอุปกรณ์การเรียน", "ค่าเครื่องแบบ", "ค่าอาหารกลางวัน", "ค่านมโรงเรียน", "ทุนการศึกษาอื่นๆ"];

const SubsidyPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [subsidyType, setSubsidyType] = useState("ปัจจัยพื้นฐาน");
  const [amount, setAmount] = useState("");
  const [incomePerMonth, setIncomePerMonth] = useState("");
  const [screeningResult, setScreeningResult] = useState("");
  const [notes, setNotes] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level)").eq("status", "active").order("student_code");
      return data || [];
    },
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level");
      return data || [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["student_subsidies"],
    queryFn: async () => {
      const { data } = await supabase.from("student_subsidies").select("*, students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name))").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Search filter state
  const [searchCode, setSearchCode] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");

  const filteredStudents = students.filter((s: any) => {
    if (searchCode && !s.student_code.includes(searchCode) && !s.first_name.includes(searchCode) && !s.last_name.includes(searchCode)) return false;
    if (selectedGrade && s.classrooms?.grade_level !== selectedGrade) return false;
    return true;
  });

  const handleAdd = async () => {
    if (saving) return;
    if (!selectedStudentId || !amount) { toast.error("กรุณาเลือกนักเรียนและกรอกจำนวนเงิน"); return; }
    const amt = safeNum(amount, 0);
    if (amt <= 0) { toast.error("จำนวนเงินต้องมากกว่า 0"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("student_subsidies").insert({
        student_id: selectedStudentId, subsidy_type: subsidyType,
        amount: amt, income_per_month: incomePerMonth ? safeNum(incomePerMonth, 0) : null,
        screening_result: nullIfEmpty(screeningResult), notes: nullIfEmpty(notes), is_eligible: true,
      } as any);
      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success("บันทึกสำเร็จ");
      qc.invalidateQueries({ queryKey: ["student_subsidies"] });
      setOpen(false); setSelectedStudentId(""); setAmount(""); setIncomePerMonth(""); setScreeningResult(""); setNotes("");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await swal.confirm({ title: "ต้องการลบรายการเงินอุดหนุนนี้หรือไม่?", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("student_subsidies").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบสำเร็จ");
    qc.invalidateQueries({ queryKey: ["student_subsidies"] });
  };

  const formatMoney = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
  const totalAmount = records.reduce((s: number, r: any) => s + Number(r.amount), 0);

  const gradeOptions = [...new Set(classrooms.map((c: any) => c.grade_level))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" />
            ระบบเงินอุดหนุน / กสศ.
          </h1>
          <p className="text-sm text-muted-foreground">คัดกรองและส่งต่อเงินช่วยเหลือนักเรียนยากจน</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />บันทึกเงินอุดหนุน</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>บันทึกเงินอุดหนุนนักเรียน</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <Label>ค้นหานักเรียน</Label>
                <Input placeholder="พิมพ์รหัสหรือชื่อ..." value={searchCode} onChange={e => setSearchCode(e.target.value)} className="mb-2" />
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger><SelectValue placeholder="เลือกระดับชั้น" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                    {gradeOptions.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>เลือกนักเรียน *</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger>
                  <SelectContent>{filteredStudents.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.student_code} - {s.prefix}{s.first_name} {s.last_name} ({s.classrooms?.name || ""})</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div><Label>ประเภทเงินอุดหนุน</Label>
                <Select value={subsidyType} onValueChange={setSubsidyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBSIDY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>จำนวนเงิน (บาท) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                <div><Label>รายได้ครอบครัว/เดือน</Label><Input type="number" value={incomePerMonth} onChange={e => setIncomePerMonth(e.target.value)} /></div>
              </div>
              <div><Label>ผลการคัดกรอง</Label>
                <Select value={screeningResult} onValueChange={setScreeningResult}>
                  <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ยากจน">ยากจน</SelectItem>
                    <SelectItem value="ยากจนพิเศษ">ยากจนพิเศษ</SelectItem>
                    <SelectItem value="ไม่ยากจน">ไม่ยากจน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>หมายเหตุ</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
              <Button onClick={handleAdd} className="w-full" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">จำนวนผู้รับทุน</p><p className="text-2xl font-bold text-primary">{records.length} คน</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">เงินอุดหนุนรวม</p><p className="text-2xl font-bold text-emerald-600">฿{formatMoney(totalAmount)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ยากจนพิเศษ</p><p className="text-2xl font-bold text-amber-600">{records.filter((r: any) => r.screening_result === "ยากจนพิเศษ").length} คน</p></CardContent></Card>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>รหัส</TableHead>
            <TableHead>ชื่อ-สกุล</TableHead>
            <TableHead>ห้อง</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead className="text-right">จำนวนเงิน</TableHead>
            <TableHead>ผลคัดกรอง</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.students?.student_code || "-"}</TableCell>
                <TableCell>{r.students ? `${r.students.prefix || ""}${r.students.first_name} ${r.students.last_name}` : "-"}</TableCell>
                <TableCell>{r.students?.classrooms?.name || "-"}</TableCell>
                <TableCell><Badge variant="outline">{r.subsidy_type}</Badge></TableCell>
                <TableCell className="text-right font-mono">฿{formatMoney(Number(r.amount))}</TableCell>
                <TableCell><Badge className={r.screening_result === "ยากจนพิเศษ" ? "bg-red-100 text-red-800" : r.screening_result === "ยากจน" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>{r.screening_result || "-"}</Badge></TableCell>
                <TableCell><Badge className={r.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>{r.status === "approved" ? "อนุมัติ" : "รอดำเนินการ"}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
            {records.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default SubsidyPage;
