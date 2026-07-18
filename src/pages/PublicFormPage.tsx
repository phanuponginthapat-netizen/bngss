import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, CheckCircle2, Download, Search } from "lucide-react";
import { toast } from "sonner";
import type { PdfTemplateRecord } from "@/lib/pdfTemplate/types";
import { extractBindingPaths, SYSTEM_AUTOFILL_PATHS } from "@/lib/pdfTemplate/bindings";
import { loadSystemDataForStudent, type SystemData } from "@/lib/pdfTemplate/resolveSystemData";
import { renderPdfTemplate, downloadBlob } from "@/lib/pdfTemplate/renderTemplate";
import { submitPublicForm } from "@/lib/pdfTemplate/submitForm";

// Set value into nested object by dotted path
function setDeep(obj: any, path: string, val: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] ?? {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}
function getDeep(obj: any, path: string): any {
  return path.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);
}

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tpl, setTpl] = useState<(PdfTemplateRecord & { sync_targets?: any; require_student_code?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [data, setData] = useState<SystemData | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterContact, setSubmitterContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data: t, error } = await supabase
        .from("pdf_templates" as any).select("*")
        .eq("public_slug", slug).eq("is_public", true).maybeSingle();
      if (error || !t) toast.error("ไม่พบฟอร์มนี้ หรือยังไม่เปิดเผยแพร่");
      setTpl(t as any);
      setLoading(false);
    })();
  }, [slug]);

  // Group fields by binding path → input rows
  const inputRows = useMemo(() => {
    if (!tpl) return [];
    const seen = new Set<string>();
    const out: { path: string; label: string; multiline?: boolean; system: boolean }[] = [];
    for (const f of tpl.fields || []) {
      const paths = extractBindingPaths(f.binding || "");
      for (const p of paths) {
        if (seen.has(p)) continue;
        seen.add(p);
        out.push({
          path: p,
          label: f.label || p,
          multiline: !!f.multiline,
          system: SYSTEM_AUTOFILL_PATHS.has(p),
        });
      }
    }
    return out;
  }, [tpl]);

  const lookup = async () => {
    if (!code.trim()) { toast.error("กรอกรหัสนักเรียน"); return; }
    const res = await loadSystemDataForStudent(code.trim());
    if (!res.student_id) {
      toast.error("ไม่พบนักเรียนรหัสนี้");
      return;
    }
    setData(res.data);
    setStudentId(res.student_id);
    setSchoolId(res.school_id);
    setSubmitterName(res.data.student.full_name || "");
    toast.success("ดึงข้อมูลนักเรียนสำเร็จ");
  };

  const setVal = (path: string, val: string) => {
    setData(d => {
      const next: any = d ? structuredClone(d) : { school: {}, student: {}, guardian: {}, academic: {}, director: {}, teacher: {}, user: {}, form: {}, visit: {}, scholarship: {}, leave: {}, custom: {} };
      setDeep(next, path, val);
      return next;
    });
  };

  const submit = async () => {
    if (!tpl || !data) return;
    setSubmitting(true);
    try {
      const res = await submitPublicForm({
        template: tpl as any,
        student_id: studentId,
        school_id: schoolId,
        submitter_name: submitterName,
        submitter_contact: submitterContact,
        values: data,
      });
      setSubmittedId(res.submission_id);
      toast.success("ส่งฟอร์มเรียบร้อย");
    } catch (e: any) {
      toast.error("ส่งฟอร์มไม่สำเร็จ: " + e.message);
    } finally { setSubmitting(false); }
  };

  const downloadPdf = async () => {
    if (!tpl || !data) return;
    try {
      const blob = await renderPdfTemplate(tpl as any, data as any);
      downloadBlob(blob, `${tpl.name || "form"}.pdf`);
    } catch (e: any) {
      toast.error("สร้าง PDF ไม่สำเร็จ: " + e.message);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!tpl) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">ไม่พบฟอร์ม</div>;
  }

  // Success state
  if (submittedId) {
    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 mx-auto text-success" />
              <h2 className="text-2xl font-bold">ส่งฟอร์มเรียบร้อย</h2>
              <p className="text-muted-foreground text-sm">รหัสอ้างอิง: <span className="font-mono">{submittedId.slice(0, 8)}</span></p>
              <Button onClick={downloadPdf} className="mt-4">
                <Download className="w-4 h-4 mr-2" /> ดาวน์โหลด PDF สำเนา
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> {tpl.name}
            </CardTitle>
            {tpl.description && <p className="text-sm text-muted-foreground">{tpl.description}</p>}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: student code */}
            {!data && (
              <div className="space-y-3">
                <Label>รหัสนักเรียน</Label>
                <div className="flex gap-2">
                  <Input value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น 12345"
                         onKeyDown={e => e.key === "Enter" && lookup()} />
                  <Button onClick={lookup}><Search className="w-4 h-4 mr-1" /> ค้นหา</Button>
                </div>
                <p className="text-xs text-muted-foreground">ระบบจะดึงข้อมูลโรงเรียน นักเรียน ผู้ปกครอง และปีการศึกษามาให้อัตโนมัติ</p>
              </div>
            )}

            {/* Step 2: form fields */}
            {data && (
              <div className="space-y-4">
                <div className="rounded border bg-primary/5 border-primary/20 p-3 text-sm">
                  <div className="font-medium">{data.student.full_name} <span className="text-muted-foreground">({data.student.student_code})</span></div>
                  <div className="text-xs text-muted-foreground">{data.student.classroom} • {data.school.name}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ชื่อผู้กรอก</Label>
                    <Input value={submitterName} onChange={e => setSubmitterName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">เบอร์ติดต่อ</Label>
                    <Input value={submitterContact} onChange={e => setSubmitterContact(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3 border-t pt-3">
                  <h3 className="font-medium text-sm">รายการที่ต้องกรอก</h3>
                  {inputRows.map(row => {
                    const val = getDeep(data, row.path) ?? "";
                    return (
                      <div key={row.path} className="space-y-1">
                        <Label className="text-xs flex items-center gap-2">
                          {row.label}
                          {row.system && <span className="text-[10px] px-1.5 rounded bg-success/15 text-success">auto</span>}
                        </Label>
                        {row.multiline ? (
                          <Textarea rows={2} value={val} onChange={e => setVal(row.path, e.target.value)} />
                        ) : (
                          <Input value={val} onChange={e => setVal(row.path, e.target.value)} />
                        )}
                      </div>
                    );
                  })}
                  {inputRows.length === 0 && <p className="text-sm text-muted-foreground">ฟอร์มนี้ยังไม่มีฟิลด์</p>}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={submit} disabled={submitting} className="flex-1">
                    {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    ส่งฟอร์ม
                  </Button>
                  <Button variant="outline" onClick={downloadPdf}>
                    <Download className="w-4 h-4 mr-1" /> ดูตัวอย่าง PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
