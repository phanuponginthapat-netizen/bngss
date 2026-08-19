import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PdfFieldOverlay, TemplateField } from "@/components/templates/PdfFieldOverlay";
import { DynamicFormRenderer } from "@/components/templates/DynamicFormRenderer";
import { loadPrintTemplatePdf } from "@/lib/printTemplatePdf";
import { resolveAutofill } from "@/lib/templateAutofill";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Wand2 } from "lucide-react";
import { saveErrorMessage } from "@/lib/saveError";


export default function FillTemplatePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [studentId, setStudentId] = useState<string>("");
  const [hi, setHi] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const { data: tpl, isLoading, error: tplError } = useQuery({
    queryKey: ["fill-tpl", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_templates").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("ไม่พบเทมเพลตนี้ (อาจถูกลบไปแล้ว)");
      return data;
    },
    enabled: !!id,
    retry: false,
  });

  const { data: me } = useQuery({
    queryKey: ["fill-me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("first_name, last_name, school_id").eq("id", user.id).maybeSingle();
      return { userId: user.id, ...(data || {}) };
    },
  });

  const schoolId = (me as any)?.school_id || null;
  const { data: students = [] } = useQuery({
    queryKey: ["students-light", schoolId ?? "all"],
    queryFn: async () => {
      // จำกัดเฉพาะนักเรียนในโรงเรียนของผู้ใช้ (กันเห็นข้อมูลข้ามโรงเรียน)
      let q = supabase.from("students").select("id, student_code, first_name, last_name, prefix, auth_user_id");
      if (schoolId) q = q.eq("school_id", schoolId);
      const { data } = await q.limit(2000);
      return data || [];
    },
  });

  // ถ้าผู้ใช้เป็นนักเรียน ให้เลือกตัวเองอัตโนมัติเพื่อให้ autofill ใช้ข้อมูลของตัวเอง
  useEffect(() => {
    if (studentId || !(me as any)?.userId || !students.length) return;
    const mine = students.find((s: any) => s.auth_user_id === (me as any).userId);
    if (mine) setStudentId(mine.id);
  }, [students, me, studentId]);

  const { data: schoolInfo } = useQuery({
    queryKey: ["school-info-light"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!tpl?.source_pdf_path) return;
    (async () => {
      try {
        setPdfBytes(null);
        setPdfUrl(null);
        const source = await loadPrintTemplatePdf(tpl.source_pdf_path as string);
        if (source.type === "bytes") setPdfBytes(source.bytes);
        else setPdfUrl(source.url);
      } catch (e: any) {
        toast.error("โหลด PDF ไม่สำเร็จ", { description: e?.message });
      }
    })();
  }, [tpl?.id]);

  const fields = (tpl?.field_map as any[] as TemplateField[]) || [];

  // Auto-resolve `autofill` fields whenever student/school changes
  useEffect(() => {
    if (!fields.length) return;
    const student = students.find((s: any) => s.id === studentId);
    const userName = `${(me as any)?.first_name || ""} ${(me as any)?.last_name || ""}`.trim();
    const ctx = { student, school: schoolInfo, user: userName ? { name: userName } : undefined };
    setValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const f of fields) {
        if (f.type !== "autofill" || !f.data_source) continue;
        const v = resolveAutofill(f.data_source, ctx);
        if (next[f.key] !== v) { next[f.key] = v; changed = true; }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, schoolInfo, me, tpl?.id]);


  const autoFill = () => {
    if (!schoolInfo && !studentId) {
      toast.error("เลือกนักเรียนก่อน หรือบันทึกข้อมูลโรงเรียน");
      return;
    }
    const student = students.find((s: any) => s.id === studentId);
    const next = { ...values };
    let filled = 0;
    for (const f of fields) {
      if (next[f.key]) continue;
      const hint = (f.data_hint || "").toLowerCase();
      const label = (f.label || "").toLowerCase();
      const key = (f.key || "").toLowerCase();

      // School
      if (/school|โรงเรียน/.test(hint + label + key) && schoolInfo) {
        next[f.key] = (schoolInfo as any).school_name || (schoolInfo as any).name; filled++; continue;
      }
      if (/director|ผู้อำนวยการ/.test(hint + label + key) && schoolInfo) {
        next[f.key] = (schoolInfo as any).director_name; filled++; continue;
      }
      // Student
      if (student) {
        if (/first.?name|ชื่อ(?!.*สกุล)/.test(hint + label + key)) { next[f.key] = student.first_name; filled++; continue; }
        if (/last.?name|นามสกุล|สกุล/.test(hint + label + key)) { next[f.key] = student.last_name; filled++; continue; }
        if (/student.?code|รหัสนักเรียน/.test(hint + label + key)) { next[f.key] = student.student_code; filled++; continue; }
        if (/full.?name|ชื่อ-สกุล|ชื่อสกุล|ชื่อนักเรียน/.test(hint + label + key)) {
          next[f.key] = `${student.prefix || ""}${student.first_name} ${student.last_name}`; filled++; continue;
        }
      }
    }
    setValues(next);
    toast.success(`เติมข้อมูลอัตโนมัติ ${filled} ช่อง`);
  };

  const generate = async () => {
    setGenerating(true);
    setResultUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("fill-pdf-template", {
        body: { template_id: id, data: values, student_id: studentId || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResultUrl((data as any).url);
      toast.success("สร้าง PDF สำเร็จ");
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  if (tplError || !tpl) return (
    <div className="p-8 text-center space-y-3">
      <p className="text-sm text-muted-foreground">{(tplError as Error)?.message || "ไม่พบเทมเพลตนี้"}</p>
      <Button variant="outline" onClick={() => nav(-1)}><ArrowLeft className="w-4 h-4 mr-1" />ย้อนกลับ</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="text-xl font-bold">{tpl.name}</h1>
            <p className="text-xs text-muted-foreground">กรอกข้อมูล → ระบบจะเติมลง PDF ต้นฉบับให้อัตโนมัติ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoFill}><Wand2 className="w-4 h-4 mr-1" />เติมจากระบบ</Button>
          <Button onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            สร้าง PDF
          </Button>
        </div>
      </div>

      {resultUrl && (
        <Card className="bg-green-50 border-green-300">
          <CardContent className="py-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm">PDF พร้อมแล้ว</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild><a href={resultUrl} target="_blank" rel="noreferrer">เปิด</a></Button>
              <Button size="sm" asChild><a href={resultUrl} download>ดาวน์โหลด</a></Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">กรอกข้อมูล</CardTitle>
            <div>
              <Label className="text-xs">นักเรียน (ออปชั่น — สำหรับ auto-fill)</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.student_code} {s.first_name} {s.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-y-auto">
            <DynamicFormRenderer
              fields={fields}
              values={values}
              onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))}
              highlightedId={hi}
              setHighlightedId={setHi}
            />
          </CardContent>
        </Card>

        <div className="border rounded-lg bg-muted/30 p-4 overflow-auto max-h-[80vh]">
          <PdfFieldOverlay
            pdfBytes={pdfBytes}
            pdfUrl={pdfUrl}
            fields={fields}
            highlightId={hi}
            values={values}
            onFieldClick={(fid) => {
              setHi(fid);
              document.getElementById(`field-${fid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        </div>
      </div>
    </div>
  );
}
