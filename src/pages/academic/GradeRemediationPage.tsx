import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Megaphone, Wrench, ClipboardCheck, Printer, Upload, Calendar, CheckCircle2 } from "lucide-react";
import { GRADE_REMEDIATION_TYPES, REMEDIATION_STATUS, STATUS_COLOR, GRADE_LABEL } from "@/lib/gradeRemediation";
import { notifyGradeRemediationAnnounced, notifyGradeRemediationBatchAnnounced, notifyGradeRemediationFix, notifyGradeRemediationRetakeScheduled } from "@/lib/notificationTriggers";

type Remediation = {
  id: string;
  student_id: string;
  subject_code: string;
  subject_name: string | null;
  term: string;
  original_grade: string;
  status: string;
  announced_at: string | null;
  fix_deadline: string | null;
  fix_method: string | null;
  fix_score: number | null;
  new_grade: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  students?: { first_name: string; last_name: string; student_code: string; prefix?: string };
};

export default function GradeRemediationPage() {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const [tab, setTab] = useState("list");
  const [items, setItems] = useState<Remediation[]>([]);
  const [loading, setLoading] = useState(false);
  const [termFilter, setTermFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fixOpen, setFixOpen] = useState(false);
  const [fixItem, setFixItem] = useState<Remediation | null>(null);
  const [fixScore, setFixScore] = useState("");
  const [fixGrade, setFixGrade] = useState("");
  const [fixMethod, setFixMethod] = useState("ส่งงาน");
  const [fixDeadline, setFixDeadline] = useState("");
  const [fixNotes, setFixNotes] = useState("");
  const [retakeOpen, setRetakeOpen] = useState(false);
  const [retakeItem, setRetakeItem] = useState<Remediation | null>(null);
  const [retakeDate, setRetakeDate] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("grade_remediation").select("*, students(first_name, last_name, student_code, prefix)").order("created_at", { ascending: false }).limit(200);
    if (termFilter) q = q.eq("term", termFilter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    setItems((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [termFilter, statusFilter]);

  const toggleSelect = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };

  const filtered = items;

  const handleImport = async () => {
    setImportLoading(true);
    try {
      // Find grades with 0/ร/มส/มผ from grades or student_grades tables
      // Try both table names
      let grades: any[] = [];
      for (const tbl of ["grades", "student_grades", "pp5_grades"]) {
        const { data } = await supabase.from(tbl as any).select("student_id, subject_code, subject_name, term, grade, academic_year").in("grade", ["0", "ร", "มส", "มผ"]).limit(500);
        if (data && data.length) { grades = data; break; }
      }
      if (grades.length === 0) {
        // Fallback: also check incomplete_grade_reports if exists
        const { data } = await supabase.from("incomplete_grade_reports" as any).select("student_id, subject_code, term, grade").limit(200);
        if (data && data.length) grades = (data as any[]).map((r: any) => ({ student_id: r.student_id, subject_code: r.subject_code, subject_name: r.subject_code, term: r.term, grade: r.grade }));
      }
      if (grades.length === 0) { toast.info(L("ไม่พบเกรด 0 ร มส มผ", "No 0/ร/มส/มผ grades found")); return; }
      let inserted = 0;
      for (const g of grades) {
        const term = g.term || (g.academic_year ? `${g.academic_year}` : "1/2568");
        const { error } = await supabase.from("grade_remediation").insert({
          student_id: g.student_id,
          subject_code: g.subject_code || "GEN",
          subject_name: g.subject_name || g.subject_code || "",
          term,
          academic_year: g.academic_year || term.split("/")[1] || "",
          original_grade: g.grade,
          status: "ติด",
        } as any);
        if (!error) inserted++;
      }
      toast.success(L(`นำเข้า ${inserted} รายการ`, `Imported ${inserted} rows`));
      load();
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally { setImportLoading(false); }
  };

  const handleAnnounce = async () => {
    if (selected.size === 0) return toast.error(L("เลือกอย่างน้อย 1 รายการ", "Select at least 1"));
    const ids = Array.from(selected);
    const { error } = await supabase.from("grade_remediation").update({ status: "ประกาศแล้ว", announced_at: new Date().toISOString() } as any).in("id", ids);
    if (error) toast.error(error.message);
    else {
      toast.success(L(`ประกาศ ${ids.length} คนแล้ว`, `Announced ${ids.length}`));
      // Comprehensive fan-out via centralized triggers — includes parent + student + homeroom, in_app/push/line/gchat
      const toAnnounce = ids.map((id) => items.find((x) => x.id === id)).filter(Boolean) as Remediation[];
      // Batch helper handles family resolution (auth_user_id + parent_user_id + parent_student_links + profiles.student_code) and dedup
      notifyGradeRemediationBatchAnnounced(
        toAnnounce.map((it) => ({
          student_id: it.student_id,
          subject_code: it.subject_code,
          subject_name: it.subject_name,
          term: it.term,
          original_grade: it.original_grade,
          id: it.id,
        }))
      ).catch((e) => console.warn("[GradeRemediation] batch notify failed", e));
      // Also fire per-item via single helper for backward-compat audit trail (non-blocking)
      toAnnounce.forEach((it) => {
        notifyGradeRemediationAnnounced({
          studentIds: [it.student_id],
          subjectCode: it.subject_code,
          subjectName: it.subject_name,
          term: it.term,
          originalGrade: it.original_grade,
          remediationIds: [it.id],
        }).catch(() => {});
      });
      setSelected(new Set());
      load();
    }
  };

  const openFix = (it: Remediation) => {
    setFixItem(it);
    setFixScore(it.fix_score?.toString() || "");
    setFixGrade(it.new_grade || "");
    setFixMethod(it.fix_method || "ส่งงาน");
    setFixDeadline(it.fix_deadline || "");
    setFixNotes(it.notes || "");
    setFixOpen(true);
  };
  const submitFix = async () => {
    if (!fixItem) return;
    const isPass = fixGrade && !GRADE_REMEDIATION_TYPES.includes(fixGrade as any);
    const status = isPass ? "ผ่าน" : fixGrade === "" ? "กำลังแก้" : "ไม่ผ่าน";
    const { error } = await supabase.from("grade_remediation").update({
      fix_score: fixScore ? Number(fixScore) : null,
      new_grade: fixGrade || null,
      fix_method: fixMethod,
      fix_deadline: fixDeadline || null,
      notes: fixNotes || null,
      status,
    } as any).eq("id", fixItem.id);
    if (error) toast.error(error.message);
    else {
      toast.success(L("บันทึกการแก้แล้ว", "Fix saved"));
      // trigger grade remediation fix notification (student + parents via in_app/push/line/gchat)
      notifyGradeRemediationFix({
        studentId: fixItem.student_id,
        subjectCode: fixItem.subject_code,
        term: fixItem.term,
        newGrade: fixGrade || null,
        fixScore: fixScore ? Number(fixScore) : null,
        fixMethod,
        status,
        remediationId: fixItem.id,
      }).catch((e) => console.warn("[GradeRemediation] fix notify failed", e));
      setFixOpen(false);
      load();
    }
  };

  const openRetake = (it: Remediation) => {
    setRetakeItem(it);
    setRetakeDate(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
    setRetakeOpen(true);
  };
  const submitRetake = async () => {
    if (!retakeItem || !retakeDate) return;
    const { error } = await supabase.from("remediation_sessions").insert({ remediation_id: retakeItem.id, session_date: retakeDate, result: "รอผล" } as any);
    if (error) toast.error(error.message);
    else {
      await supabase.from("grade_remediation").update({ status: "รอสอบแก้" } as any).eq("id", retakeItem.id);
      toast.success(L("นัดสอบแก้แล้ว", "Retake scheduled"));
      notifyGradeRemediationRetakeScheduled({
        studentId: retakeItem.student_id,
        subjectCode: retakeItem.subject_code,
        term: retakeItem.term,
        retakeDate,
        remediationId: retakeItem.id,
      }).catch((e) => console.warn("[GradeRemediation] retake notify failed", e));
      setRetakeOpen(false); load();
    }
  };

  const handlePrint = () => {
    const rows = filtered.map((r) => `<tr><td>${r.students ? `${r.students.prefix || ""}${r.students.first_name} ${r.students.last_name} (${r.students.student_code})` : r.student_id.slice(0, 8)}</td><td>${r.subject_code} ${r.subject_name || ""}</td><td>${r.term}</td><td>${r.original_grade}</td><td>${r.status}</td><td>${r.new_grade || "-"}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>0 ร มส</title><style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5}</style></head><body><h2>ประกาศรายชื่อติด 0 ร มส มผ</h2><table><thead><tr><th>นักเรียน</th><th>วิชา</th><th>เทอม</th><th>เกรดเดิม</th><th>สถานะ</th><th>เกรดใหม่</th></tr></thead><tbody>${rows}</tbody></table><script>window.print()</script></body></html>`);
    w.document.close();
  };

  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === "ติด").length,
    announced: items.filter((i) => i.status === "ประกาศแล้ว").length,
    fixing: items.filter((i) => ["กำลังแก้", "รอสอบแก้"].includes(i.status)).length,
    passed: items.filter((i) => i.status === "ผ่าน").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-amber-500" /> {L("ระบบ 0 ร มส มผ — ประกาศ/แก้/สอบแก้", "0/R/MS/MP Remediation")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImport} disabled={importLoading}><Upload className="w-4 h-4 mr-1" /> {importLoading ? "..." : L("ดึงจากเกรด", "Import from grades")}</Button>
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" /> {L("พิมพ์ประกาศ", "Print")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">ทั้งหมด</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">ติด</p><p className="text-2xl font-bold text-red-600">{stats.pending}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">ประกาศแล้ว</p><p className="text-2xl font-bold text-amber-600">{stats.announced}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">กำลังแก้</p><p className="text-2xl font-bold text-sky-600">{stats.fixing}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">ผ่าน</p><p className="text-2xl font-bold text-emerald-600">{stats.passed}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder={L("เทอม เช่น 1/2568", "Term e.g. 1/2568")} value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className="w-40 h-8 text-sm" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("ทุกสถานะ", "All")}</SelectItem>
                {REMEDIATION_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={load}>{L("รีเฟรช", "Refresh")}</Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={handleAnnounce} disabled={selected.size === 0} className="gap-1"><Megaphone className="w-4 h-4" /> {L(`ประกาศ ${selected.size} คน`, `Announce ${selected.size}`)}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-8"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>{L("นักเรียน", "Student")}</TableHead>
              <TableHead>{L("วิชา", "Subject")}</TableHead>
              <TableHead>{L("เทอม", "Term")}</TableHead>
              <TableHead>{L("เกรดเดิม", "Original")}</TableHead>
              <TableHead>{L("สถานะ", "Status")}</TableHead>
              <TableHead>{L("เกรดใหม่", "New")}</TableHead>
              <TableHead>{L("จัดการ", "Actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8} className="text-center py-8">{L("กำลังโหลด...", "Loading...")}</TableCell></TableRow> :
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></TableCell>
                    <TableCell className="text-sm">{r.students ? `${r.students.prefix || ""}${r.students.first_name} ${r.students.last_name} (${r.students.student_code})` : r.student_id.slice(0, 8)}</TableCell>
                    <TableCell><span className="font-mono text-xs">{r.subject_code}</span> <span className="text-xs text-muted-foreground">{r.subject_name}</span></TableCell>
                    <TableCell className="text-xs">{r.term}</TableCell>
                    <TableCell><Badge variant="outline" className="font-bold">{GRADE_LABEL[r.original_grade as any] || r.original_grade}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${STATUS_COLOR[r.status as any] || ""}`}>{r.status}</Badge></TableCell>
                    <TableCell>{r.new_grade ? <Badge>{r.new_grade}</Badge> : "-"}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openFix(r)}><Wrench className="w-3 h-3 mr-1" /> {L("แก้", "Fix")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => openRetake(r)}><Calendar className="w-3 h-3 mr-1" /> {L("นัดสอบ", "Retake")}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">{L("ยังไม่มีรายการ", "No records")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={fixOpen} onOpenChange={setFixOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("บันทึกการแก้ 0 ร มส", "Fix Grade")}</DialogTitle></DialogHeader>
          {fixItem && <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{fixItem.students?.first_name} {fixItem.students?.last_name} • {fixItem.subject_code} • {fixItem.original_grade} →</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{L("คะแนนแก้", "Fix Score")}</Label><Input type="number" value={fixScore} onChange={(e) => setFixScore(e.target.value)} placeholder="0-100" /></div>
              <div><Label>{L("เกรดใหม่", "New Grade")}</Label>
                <Select value={fixGrade} onValueChange={setFixGrade}><SelectTrigger><SelectValue placeholder="เลือกเกรด" /></SelectTrigger>
                  <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="4">4</SelectItem><SelectItem value="0">0</SelectItem><SelectItem value="ร">ร</SelectItem><SelectItem value="มส">มส</SelectItem><SelectItem value="มผ">มผ</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{L("วิธีแก้", "Method")}</Label>
                <Select value={fixMethod} onValueChange={setFixMethod}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ส่งงาน">ส่งงาน</SelectItem><SelectItem value="สอบแก้">สอบแก้</SelectItem><SelectItem value="เรียนซ่อม">เรียนซ่อม</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>{L("กำหนดส่ง", "Deadline")}</Label><Input type="date" value={fixDeadline} onChange={(e) => setFixDeadline(e.target.value)} /></div>
            </div>
            <div><Label>{L("หมายเหตุ", "Notes")}</Label><Textarea value={fixNotes} onChange={(e) => setFixNotes(e.target.value)} rows={2} /></div>
            <p className="text-xs text-muted-foreground">{L("ถ้าเกรดใหม่เป็น 1-4 ระบบจะ mark ผ่าน อัตโนมัติ", "New grade 1-4 = Passed")}</p>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setFixOpen(false)}>{L("ยกเลิก", "Cancel")}</Button><Button onClick={submitFix}><CheckCircle2 className="w-4 h-4 mr-1" /> {L("บันทึก", "Save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={retakeOpen} onOpenChange={setRetakeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("นัดสอบแก้", "Schedule Retake")}</DialogTitle></DialogHeader>
          {retakeItem && <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{retakeItem.subject_code} • {retakeItem.students?.first_name}</p>
            <div><Label>{L("วันที่สอบแก้", "Retake Date")}</Label><Input type="date" value={retakeDate} onChange={(e) => setRetakeDate(e.target.value)} /></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setRetakeOpen(false)}>{L("ยกเลิก", "Cancel")}</Button><Button onClick={submitRetake}><ClipboardCheck className="w-4 h-4 mr-1" /> {L("นัดหมาย", "Schedule")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
