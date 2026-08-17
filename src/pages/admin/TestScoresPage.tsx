import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, BarChart3, Pencil, Sparkles, Upload, Loader2, FileText } from "lucide-react";
import { swal } from "@/lib/swal";
import { Textarea } from "@/components/ui/textarea";
import { BE_OFFSET } from "@/lib/dateBE";
import { saveErrorMessage, safeNum, safeInt, nullIfEmpty } from "@/lib/saveError";

const TEST_TYPES = [
  { value: "onet", label: "O-NET" },
  { value: "nt", label: "NT" },
  { value: "rt", label: "RT (อ่านออกเขียนได้)" },
  { value: "pisa", label: "PISA" },
  { value: "other", label: "อื่นๆ" },
];

const GRADE_LEVELS = ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6", "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];

const empty = {
  id: null as string | null,
  academic_year: new Date().getFullYear() + BE_OFFSET,
  test_type: "onet",
  grade_level: "ป.6",
  subject: "ภาษาไทย",
  avg_score: 0,
  student_count: 0,
  national_avg: null as number | null,
  area_avg: null as number | null,
  notes: "",
};

export default function TestScoresPage() {
  const { school, schoolId } = useSchoolContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  // AI Import state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiFileName, setAiFileName] = useState("");
  const [aiFileB64, setAiFileB64] = useState<string | null>(null);
  const [aiFileMime, setAiFileMime] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRows, setAiRows] = useState<any[] | null>(null);
  const [aiSaving, setAiSaving] = useState(false);

  const { data: scores = [] } = useQuery({
    queryKey: ["school-test-scores", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from("school_test_scores")
        .select("*")
        .eq("school_id", schoolId!)
        .order("academic_year", { ascending: false })
        .order("test_type")
        .order("grade_level")
        .order("subject");
      return data || [];
    },
  });

  const years = [...new Set(scores.map((s: any) => s.academic_year))];
  const filtered = scores.filter((s: any) =>
    (filterType === "all" || s.test_type === filterType) &&
    (filterYear === "all" || String(s.academic_year) === filterYear)
  );

  const openAdd = () => { setForm(empty); setOpen(true); };
  const openEdit = (row: any) => {
    setForm({
      id: row.id,
      academic_year: row.academic_year,
      test_type: row.test_type,
      grade_level: row.grade_level,
      subject: row.subject,
      avg_score: Number(row.avg_score || 0),
      student_count: Number(row.student_count || 0),
      national_avg: row.national_avg,
      area_avg: row.area_avg,
      notes: row.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (saving) return;
    if (!schoolId) return toast.error("ยังไม่มีข้อมูลโรงเรียน");
    if (!form.subject.trim()) return toast.error("กรุณาระบุวิชา");
    if (form.avg_score < 0 || form.avg_score > 100) return toast.error("คะแนนต้องอยู่ระหว่าง 0-100");

    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        academic_year: safeInt(form.academic_year, new Date().getFullYear() + BE_OFFSET),
        test_type: form.test_type,
        grade_level: form.grade_level,
        subject: form.subject.trim(),
        avg_score: safeNum(form.avg_score, 0),
        student_count: safeInt(form.student_count, 0),
        national_avg: form.national_avg == null ? null : safeNum(form.national_avg, 0),
        area_avg: form.area_avg == null ? null : safeNum(form.area_avg, 0),
        notes: nullIfEmpty(form.notes),
      };

      const { error } = form.id
        ? await supabase.from("school_test_scores").update(payload).eq("id", form.id)
        : await supabase.from("school_test_scores").upsert(payload, {
            onConflict: "school_id,academic_year,test_type,grade_level,subject",
          });

      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success("บันทึกคะแนนเรียบร้อย — Hub กลางจะดึงผ่าน /test-scores");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["school-test-scores", schoolId] });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!(await swal.confirm({ title: "ลบรายการคะแนนนี้?", danger: true }))) return;
    const { error } = await supabase.from("school_test_scores").delete().eq("id", id);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("ลบแล้ว");
    qc.invalidateQueries({ queryKey: ["school-test-scores", schoolId] });
  };

  // ===== AI Import =====
  const onPickFile = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error("ไฟล์ใหญ่เกิน 15MB");
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setAiFileB64(b64);
    setAiFileMime(file.type || "application/pdf");
    setAiFileName(file.name);
  };

  const runAiExtract = async () => {
    if (!aiText.trim() && !aiFileB64) return toast.error("กรุณาแนบไฟล์ หรือวางข้อความ");
    setAiLoading(true);
    setAiRows(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-import-test-scores", {
        body: aiFileB64
          ? { fileBase64: aiFileB64, mimeType: aiFileMime }
          : { text: aiText },
      });
      if (error) throw error;
      const rows = (data as any)?.rows || [];
      if (!rows.length) {
        toast.warning("AI ไม่พบข้อมูลคะแนนในเอกสาร — ลองส่งหน้าที่มีตารางคะแนนชัดๆ");
      } else {
        toast.success(`พบ ${rows.length} รายการ — ตรวจสอบและกดบันทึก`);
      }
      setAiRows(rows);
    } catch (e: any) {
      toast.error("AI ดึงข้อมูลไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setAiLoading(false);
    }
  };

  const updateAiRow = (i: number, patch: any) => {
    setAiRows((rows) => rows!.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeAiRow = (i: number) => setAiRows((rows) => rows!.filter((_, idx) => idx !== i));

  const saveAiRows = async () => {
    if (!schoolId || !aiRows?.length) return;
    setAiSaving(true);
    const payload = aiRows.map((r) => ({
      school_id: schoolId,
      academic_year: Number(r.academic_year) || new Date().getFullYear() + BE_OFFSET,
      test_type: r.test_type,
      grade_level: r.grade_level,
      subject: String(r.subject || "").trim(),
      avg_score: Number(r.avg_score) || 0,
      student_count: Number(r.student_count) || 0,
      national_avg: r.national_avg == null || r.national_avg === "" ? null : Number(r.national_avg),
      area_avg: r.area_avg == null || r.area_avg === "" ? null : Number(r.area_avg),
      notes: r.notes || null,
    })).filter((r) => r.subject);
    const { error } = await supabase
      .from("school_test_scores")
      .upsert(payload, { onConflict: "school_id,academic_year,test_type,grade_level,subject" });
    setAiSaving(false);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success(`บันทึก ${payload.length} รายการเรียบร้อย`);
    setAiOpen(false);
    setAiRows(null); setAiText(""); setAiFileB64(null); setAiFileName("");
    qc.invalidateQueries({ queryKey: ["school-test-scores", schoolId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> คะแนนสอบมาตรฐาน (O-NET / NT / RT / PISA)
          </h1>
          <p className="text-sm text-muted-foreground">
            กรอกคะแนนเฉลี่ยรายวิชา/ระดับชั้น — ส่งออกอัตโนมัติผ่าน District Feed API ให้ Hub กลาง / สพฐ.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="w-4 h-4 mr-1 text-fuchsia-500" /> AI กรอกให้
          </Button>
          <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> เพิ่มคะแนน</Button>
        </div>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">{school?.school_name || "-"}</CardTitle>
          <CardDescription>
            ทั้งหมด {scores.length} รายการ • ปีที่มีข้อมูล: {years.length ? years.join(", ") : "-"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="ประเภท" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                {TEST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-40"><SelectValue placeholder="ปีการศึกษา" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกปี</SelectItem>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ปี</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ชั้น</TableHead>
                  <TableHead>วิชา</TableHead>
                  <TableHead className="text-right">คะแนน รร.</TableHead>
                  <TableHead className="text-right">ค่าเฉลี่ยประเทศ</TableHead>
                  <TableHead className="text-right">ค่าเฉลี่ยเขต</TableHead>
                  <TableHead className="text-right">นร.</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">ยังไม่มีคะแนน — กด "เพิ่มคะแนน" เพื่อเริ่ม</TableCell></TableRow>
                ) : filtered.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.academic_year}</TableCell>
                    <TableCell><Badge variant="outline">{TEST_TYPES.find(t => t.value === row.test_type)?.label || row.test_type}</Badge></TableCell>
                    <TableCell>{row.grade_level}</TableCell>
                    <TableCell>{row.subject}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{Number(row.avg_score).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{row.national_avg != null ? Number(row.national_avg).toFixed(2) : "-"}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{row.area_avg != null ? Number(row.area_avg).toFixed(2) : "-"}</TableCell>
                    <TableCell className="text-right">{row.student_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="แก้ไข" onClick={() => openEdit(row)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="ลบ" onClick={() => remove(row.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-sm">📡 Endpoint สำหรับ Hub กลาง</CardTitle>
        </CardHeader>
        <CardContent className="text-xs font-mono space-y-1">
          <div><Badge>GET</Badge> /functions/v1/district-feed-api/test-scores?school_id=...&test_type=onet&academic_year=2567</div>
          <div><Badge>GET</Badge> /functions/v1/district-feed-api/test-scores/summary?school_id=...</div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "แก้ไขคะแนน" : "เพิ่มคะแนนสอบ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>ปีการศึกษา (พ.ศ.)</Label>
                <Input type="number" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>ประเภทการสอบ</Label>
                <Select value={form.test_type} onValueChange={(v) => setForm({ ...form, test_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ระดับชั้น</Label>
                <Select value={form.grade_level} onValueChange={(v) => setForm({ ...form, grade_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>วิชา</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="เช่น ภาษาไทย, คณิต, วิทย์, อังกฤษ" />
              </div>
              <div>
                <Label>คะแนนเฉลี่ยโรงเรียน</Label>
                <Input type="number" step="0.01" value={form.avg_score} onChange={(e) => setForm({ ...form, avg_score: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>จำนวนนักเรียน</Label>
                <Input type="number" value={form.student_count} onChange={(e) => setForm({ ...form, student_count: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>ค่าเฉลี่ยประเทศ</Label>
                <Input type="number" step="0.01" value={form.national_avg ?? ""} onChange={(e) => setForm({ ...form, national_avg: e.target.value === "" ? null : parseFloat(e.target.value) })} />
              </div>
              <div>
                <Label>ค่าเฉลี่ยเขต</Label>
                <Input type="number" step="0.01" value={form.area_avg ?? ""} onChange={(e) => setForm({ ...form, area_avg: e.target.value === "" ? null : parseFloat(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === AI Import Dialog === */}
      <Dialog open={aiOpen} onOpenChange={(v) => { setAiOpen(v); if (!v) { setAiRows(null); } }}>
        <DialogContent className="sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-fuchsia-500" /> AI กรอกคะแนนสอบให้อัตโนมัติ
            </DialogTitle>
          </DialogHeader>

          {!aiRows && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed p-4 space-y-2">
                <Label className="flex items-center gap-1"><Upload className="w-4 h-4" /> แนบไฟล์รายงานคะแนน (PDF / รูป)</Label>
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
                />
                {aiFileName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {aiFileName}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">รองรับใบรายงาน O-NET / NT / RT / PISA จาก สทศ. / สพฐ. หรือสกรีนช็อตของระบบ NT-Access / O-NET</p>
              </div>

              <div className="text-center text-xs text-muted-foreground">— หรือ —</div>

              <div className="space-y-2">
                <Label>วางข้อความ/ตารางคะแนน</Label>
                <Textarea
                  rows={8}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder={"เช่น\nO-NET ป.6 ปี 2566\nภาษาไทย 52.30 (ประเทศ 50.12)\nคณิตศาสตร์ 28.40 (ประเทศ 25.50)\n..."}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAiOpen(false)}>ยกเลิก</Button>
                <Button onClick={runAiExtract} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  ให้ AI ดึงข้อมูล
                </Button>
              </DialogFooter>
            </div>
          )}

          {aiRows && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                ตรวจสอบ/แก้ไขก่อนบันทึก — {aiRows.length} รายการ (จะ upsert ทับรายการเดิมในปี/ประเภท/ชั้น/วิชาเดียวกัน)
              </p>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">ปี</TableHead>
                      <TableHead className="w-28">ประเภท</TableHead>
                      <TableHead className="w-20">ชั้น</TableHead>
                      <TableHead>วิชา</TableHead>
                      <TableHead className="w-24 text-right">คะแนน</TableHead>
                      <TableHead className="w-24 text-right">ประเทศ</TableHead>
                      <TableHead className="w-24 text-right">เขต</TableHead>
                      <TableHead className="w-20 text-right">นร.</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell><Input className="h-8" type="number" value={r.academic_year} onChange={(e) => updateAiRow(i, { academic_year: parseInt(e.target.value) || 0 })} /></TableCell>
                        <TableCell>
                          <Select value={r.test_type} onValueChange={(v) => updateAiRow(i, { test_type: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>{TEST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={r.grade_level} onValueChange={(v) => updateAiRow(i, { grade_level: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>{GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input className="h-8" value={r.subject} onChange={(e) => updateAiRow(i, { subject: e.target.value })} /></TableCell>
                        <TableCell><Input className="h-8 text-right font-mono" type="number" step="0.01" value={r.avg_score} onChange={(e) => updateAiRow(i, { avg_score: parseFloat(e.target.value) || 0 })} /></TableCell>
                        <TableCell><Input className="h-8 text-right font-mono" type="number" step="0.01" value={r.national_avg ?? ""} onChange={(e) => updateAiRow(i, { national_avg: e.target.value === "" ? null : parseFloat(e.target.value) })} /></TableCell>
                        <TableCell><Input className="h-8 text-right font-mono" type="number" step="0.01" value={r.area_avg ?? ""} onChange={(e) => updateAiRow(i, { area_avg: e.target.value === "" ? null : parseFloat(e.target.value) })} /></TableCell>
                        <TableCell><Input className="h-8 text-right" type="number" value={r.student_count} onChange={(e) => updateAiRow(i, { student_count: parseInt(e.target.value) || 0 })} /></TableCell>
                        <TableCell><Button size="icon" variant="ghost" aria-label="ลบแถว" onClick={() => removeAiRow(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAiRows(null)}>← ย้อนกลับ</Button>
                <Button onClick={saveAiRows} disabled={aiSaving || !aiRows.length}>
                  {aiSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  บันทึก {aiRows.length} รายการ
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

