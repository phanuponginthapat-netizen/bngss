import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import { swal } from "@/lib/swal";

interface ImportPlan {
  table: string;
  summary: string;
  confidence: number;
  notes?: string;
  rows: Record<string, any>[];
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const TABLE_LABEL: Record<string, string> = {
  news: "ข่าวสาร", school_events: "ปฏิทินกิจกรรม",
  classrooms: "ห้องเรียน", subjects: "รายวิชา",
  students: "นักเรียน", personnel: "บุคลากร/ครู",
  schedules: "ตารางสอน", enrollments: "ลงทะเบียนเรียน",
  attendance: "การเช็คชื่อ", behavior_records: "พฤติกรรม",
  homeroom_records: "โฮมรูม", student_leave: "ใบลานักเรียน",
  staff_leave: "ใบลาบุคลากร", documents: "หนังสือ/เอกสาร",
  vaccine_records: "วัคซีน",
};

export default function AiImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [plans, setPlans] = useState<ImportPlan[] | null>(null);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [skip, setSkip] = useState<Record<number, boolean>>({});
  const [importResults, setImportResults] = useState<any[] | null>(null);

  const waitForAnalysisJob = async (jobPath: string) => {
    for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const { data, error } = await supabase.functions.invoke("ai-import-analyze", {
        body: { mode: "poll", job_path: jobPath },
      });
      if (error) throw new Error(error.message || "ตรวจสอบสถานะไม่สำเร็จ");
      const status = data as any;
      setAnalysisStatus(status?.message || "กำลังวิเคราะห์เอกสารด้วย AI...");
      if (status?.status === "completed") return status;
      if (status?.status === "failed") throw new Error(status?.error || "วิเคราะห์ไม่สำเร็จ");
    }
    throw new Error("การวิเคราะห์ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง");
  };

  const analyze = async () => {
    if (!file && !text.trim()) {
      toast.error("กรุณาอัปโหลดไฟล์ หรือวางข้อความ");
      return;
    }
    setLoading(true); setPlans(null); setDetectedType(null); setSkip({}); setAnalysisStatus("กำลังเตรียมข้อมูล...");
    try {
      const body: any = { user_hint: hint || undefined };
      if (file) {
        body.mode = "async";
        if (file.size > 20 * 1024 * 1024) {
          toast.error("ไฟล์ใหญ่เกิน 20MB"); setLoading(false); return;
        }
        // ไฟล์ใหญ่กว่า 4MB → อัปโหลดผ่าน storage (เลี่ยง request body limit)
        if (file.size > 4 * 1024 * 1024) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { toast.error("กรุณาเข้าสู่ระบบใหม่"); setLoading(false); return; }
          const path = sanitizeStorageKey(`${user.id}/${Date.now()}-${file.name}`);
          const { error: upErr } = await supabase.storage.from("ai-import-temp").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
          if (upErr) { toast.error("อัปโหลดไฟล์ไม่สำเร็จ: " + upErr.message); setLoading(false); return; }
          body.storage_path = path;
          body.mime_type = file.type || "application/pdf";
          body.file_name = file.name;
        } else {
          body.file_base64 = await fileToBase64(file);
          body.mime_type = file.type || "application/octet-stream";
          body.file_name = file.name;
        }
      }
      if (text.trim()) body.text = text;

      const { data, error } = await supabase.functions.invoke("ai-import-analyze", { body });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "วิเคราะห์ไม่สำเร็จ");
      } else {
        const result = (data as any)?.status === "processing" && (data as any)?.job_path
          ? await waitForAnalysisJob((data as any).job_path)
          : data;
        const p = (result as any).plans || [];
        const dt = (result as any).detected_type || null;
        setDetectedType(dt);
        if (p.length === 0) toast.warning("AI ไม่พบข้อมูลที่ตรงกับตารางในระบบ");
        else toast.success(`AI วิเคราะห์เสร็จ — พบ ${p.length} ตาราง${dt ? ` (${dt})` : ""}`);
        setPlans(p);
      }
    } catch (e: any) {
      toast.error(e.message || "เกิดข้อผิดพลาด");
    }
    setAnalysisStatus("");
    setLoading(false);
  };

  const confirmImport = async () => {
    if (!plans?.length) return;
    const selected = plans.filter((_, i) => !skip[i]);
    if (selected.length === 0) { toast.error("เลือกอย่างน้อย 1 ตาราง"); return; }
    const total = selected.reduce((a, p) => a + p.rows.length, 0);
    if (!(await swal.confirm({ title: `ยืนยันนำเข้า ${total} แถว ใน ${selected.length} ตาราง?`, danger: true }))) return;

    setImporting(true);
    setImportResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-import-execute", {
        body: { plans: selected.map(p => ({ table: p.table, rows: p.rows })) },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "นำเข้าไม่สำเร็จ");
      } else {
        const results = (data as any).results || [];
        const total = results.reduce((a: number, r: any) => a + (r.inserted || 0), 0);
        const errs = results.filter((r: any) => r.error || (r.warnings && r.warnings.length));
        toast.success(`นำเข้าสำเร็จ ${total} แถว` + (errs.length ? ` (${errs.length} ตารางมีปัญหา)` : ""));
        setImportResults(results);
        if (errs.length === 0) {
          setPlans(null); setFile(null); setText(""); setHint(""); setSkip({});
        }
      }
    } catch (e: any) {
      toast.error(e.message || "เกิดข้อผิดพลาด");
    }
    setImporting(false);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <BackButton />
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
          <Sparkles className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Import — นำเข้าข้อมูลด้วย AI</h1>
          <p className="text-sm text-muted-foreground">
            อัปโหลดเอกสาร/ภาพ/ข้อความ — AI ตรวจชนิดไฟล์เอง + แตกข้อมูลเข้าหลายตารางพร้อมกัน + จำการแมพถาวร (Mapping Memory) ครั้งต่อไปแมพได้แม่นขึ้นทันที
          </p>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>เฉพาะ Admin</AlertTitle>
        <AlertDescription>
          รองรับ: ข่าว, ปฏิทิน, ห้องเรียน, วิชา, นักเรียน, บุคลากร, ตารางสอน, การลงทะเบียน, เช็คชื่อ, พฤติกรรม, โฮมรูม, ใบลา, หนังสือ, วัคซีน — กรุณาตรวจสอบก่อนยืนยัน
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle className="text-base">1) อัปโหลดไฟล์ หรือวางข้อความ</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">ไฟล์ (PDF, รูปภาพ, .txt, .csv) — สูงสุด 20MB · รองรับ PDF ตารางสอนหลายหน้า</label>
            <Input type="file" accept=".pdf,image/*,.txt,.csv,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                <FileText className="inline w-3 h-3 mr-1" />{file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">หรือวางข้อความ</label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder="เช่น ตารางสอน ป.4/1 ภาคเรียนที่ 1, รายชื่อนักเรียน, ข่าวประกาศ..." rows={4} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">คำใบ้ให้ AI (ไม่บังคับ)</label>
            <Input value={hint} onChange={(e) => setHint(e.target.value)}
              placeholder="เช่น 'ตารางสอนชั้น ป.4/1 ภาค 1/2568' หรือ 'รายชื่อ ป.1'" />
          </div>
          <Button onClick={analyze} disabled={loading} className="gradient-primary text-primary-foreground">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังวิเคราะห์...</> : <><Sparkles className="w-4 h-4 mr-2" /> วิเคราะห์ด้วย AI</>}
          </Button>
          {loading && analysisStatus && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {analysisStatus}
            </p>
          )}
        </CardContent>
      </Card>

      {plans && plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              <span>2) แผนการนำเข้า ({plans.length} ตาราง)</span>
              <div className="flex gap-2 flex-wrap">
                {detectedType && <Badge variant="secondary">🔍 {detectedType}</Badge>}
                <Badge variant="outline">{plans.reduce((a, p) => a + p.rows.length, 0)} แถวรวม</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plans.map((plan, idx) => {
              const columns = plan.rows?.[0] ? Object.keys(plan.rows[0]) : [];
              const isSkipped = !!skip[idx];
              return (
                <div key={idx} className={`border rounded-lg p-4 space-y-3 ${isSkipped ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge>{TABLE_LABEL[plan.table] || plan.table}</Badge>
                      <Badge variant="outline">{plan.rows.length} แถว</Badge>
                      <Badge variant={plan.confidence > 0.7 ? "default" : "secondary"}>
                        มั่นใจ {Math.round((plan.confidence || 0) * 100)}%
                      </Badge>
                    </div>
                    <Button size="sm" variant={isSkipped ? "default" : "outline"}
                      onClick={() => setSkip(s => ({ ...s, [idx]: !s[idx] }))}>
                      {isSkipped ? "นำเข้า" : "ข้าม"}
                    </Button>
                  </div>
                  <p className="text-sm"><strong>สรุป:</strong> {plan.summary}</p>
                  {plan.notes && <p className="text-xs text-muted-foreground">📝 {plan.notes}</p>}
                  <div className="border rounded overflow-auto max-h-72">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>{columns.map(c => <th key={c} className="text-left p-2 font-medium whitespace-nowrap">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {plan.rows.slice(0, 20).map((r, i) => (
                          <tr key={i} className="border-t">
                            {columns.map(c => <td key={c} className="p-2 align-top">{String(r[c] ?? "")}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {plan.rows.length > 20 && (
                      <div className="p-2 text-xs text-muted-foreground text-center bg-muted/50">
                        แสดง 20/{plan.rows.length} — จะนำเข้าทั้งหมด
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => { setPlans(null); setSkip({}); }} disabled={importing}>ยกเลิก</Button>
              <Button onClick={confirmImport} disabled={importing} className="gradient-primary text-primary-foreground">
                {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังนำเข้า...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> ยืนยันนำเข้าทั้งหมด</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {plans && plans.length === 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>AI ไม่พบข้อมูลที่จับคู่ตารางในระบบ — ลองให้คำใบ้เพิ่มหรืออัปโหลดไฟล์ที่ชัดขึ้น</AlertDescription>
        </Alert>
      )}

      {importResults && importResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" /> ผลการนำเข้า
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {importResults.map((r, i) => {
              const hasIssue = !!r.error || (r.warnings && r.warnings.length > 0) || (r.skipped > 0);
              return (
                <div key={i} className={`border rounded-lg p-3 space-y-1 ${r.error ? "border-destructive/50 bg-destructive/5" : hasIssue ? "border-warning/50 bg-warning/5" : "border-success/30 bg-success/5"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Badge>{TABLE_LABEL[r.table] || r.table}</Badge>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="secondary">เพิ่ม {r.inserted || 0}</Badge>
                      {r.skipped > 0 && <Badge variant="outline">ข้าม {r.skipped}</Badge>}
                      {r.matched_existing > 0 && <Badge variant="outline">มีอยู่แล้ว {r.matched_existing}</Badge>}
                      {r.replaced > 0 && <Badge variant="outline">แทนที่ {r.replaced}</Badge>}
                    </div>
                  </div>
                  {r.note && <p className="text-xs text-muted-foreground">📝 {r.note}</p>}
                  {r.error && (
                    <div className="text-xs text-destructive flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span className="break-all">{r.error}</span>
                    </div>
                  )}
                  {r.warnings && r.warnings.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-warning">คำเตือน ({r.warnings.length})</summary>
                      <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto pl-4">
                        {r.warnings.map((w: string, j: number) => (
                          <li key={j} className="text-muted-foreground list-disc">{w}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => { setImportResults(null); setPlans(null); setFile(null); setText(""); setHint(""); setSkip({}); }}>
                ปิด / เริ่มใหม่
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
