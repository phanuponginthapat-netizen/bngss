import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, Printer, Eye, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { OBEC_PRINT_CSS } from "@/lib/printUtils";
import { parseFields, fillTemplate, FormField, autoDetectFields } from "@/lib/formFieldToken";

/**
 * หน้า "กรอกแบบฟอร์ม" — โหลด template, แตก field tokens, แสดงฟอร์มกรอก + preview เรียลไทม์
 * URL: /form-template/:code/fill?title=...
 */
export default function FormTemplateFillPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(code);
  const [html, setHtml] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("form_templates").select("title,content_html").eq("code", code).maybeSingle();
      if (data) {
        setTitle(data.title || code);
        setHtml(data.content_html || "");
      }
      setLoading(false);
    })();
  }, [code]);

  // Inject OBEC CSS for preview
  useEffect(() => {
    const id = "obec-print-css-fill";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = OBEC_PRINT_CSS.replace(/__LOVABLE_ORIGIN__/g, window.location.origin);
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Auto-detect: ถ้าเทมเพลตยังไม่มี token ให้แปลง ___ / ........... เป็นช่องกรอกอัตโนมัติ
  const effectiveHtml = useMemo(() => {
    const raw = parseFields(html);
    if (raw.length > 0) return html;
    return autoDetectFields(html).html;
  }, [html]);
  const fields: FormField[] = useMemo(() => parseFields(effectiveHtml), [effectiveHtml]);
  const filledHtml = useMemo(() => fillTemplate(effectiveHtml, values), [effectiveHtml, values]);

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>${OBEC_PRINT_CSS.replace(/__LOVABLE_ORIGIN__/g, window.location.origin)}
        @page { size: A4; margin: 1.5cm; }
        body { margin:0; font-family:'TH Sarabun New','Sarabun',serif; }
      </style></head><body><div class="obec-a4-page">${filledHtml}</div>
      <script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},400));</script>
    </body></html>`);
    w.document.close();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-editor-canvas">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-editor-chrome text-editor-chrome-foreground text-sm shrink-0">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-white hover:bg-white/15" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" />ย้อนกลับ
        </Button>
        <span className="font-semibold">📝 กรอกแบบฟอร์ม</span>
        <span className="opacity-70">—</span>
        <span className="truncate">{title}</span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto h-7"
          onClick={() => {
            const params = new URLSearchParams();
            if (title) params.set("title", title);
            window.open(`/form-template/${encodeURIComponent(code)}?${params.toString()}`, "_blank", "noopener");
          }}
        >
          <Pencil className="w-4 h-4 mr-1" />แก้ไขฟอร์ม (ใส่ช่องกรอก)
        </Button>
        <Button size="sm" variant="secondary" className="h-7" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-1" />พิมพ์ / บันทึก PDF
        </Button>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[380px_1fr]">
        {/* === Form pane === */}
        <div className="overflow-auto border-r bg-white p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Eye className="w-4 h-4" />ช่องกรอกที่ตรวจพบ ({fields.length})</h2>
          {fields.length === 0 && (
            <Card className="p-4 text-sm space-y-3">
              <div className="font-semibold text-base">📋 วิธีใช้งาน</div>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>กดปุ่ม <b className="text-foreground">"แก้ไขฟอร์ม"</b> ด้านบนขวา เพื่อเข้าสู่ Word editor</li>
                <li>พิมพ์/นำเข้าเนื้อหา (รองรับ .docx และ .html)</li>
                <li>เลือกจุดที่ต้องการ → แท็บ <b>"แทรก"</b> → ปุ่ม <span className="px-1.5 py-0.5 bg-info-soft text-info rounded">แทรกช่องกรอก</span></li>
                <li>กด <b>บันทึก</b> แล้วกลับมาหน้านี้เพื่อกรอกข้อมูล</li>
              </ol>
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (title) params.set("title", title);
                  window.open(`/form-template/${encodeURIComponent(code)}?${params.toString()}`, "_blank", "noopener");
                }}
              >
                <Pencil className="w-4 h-4 mr-1" />เปิดหน้าแก้ไขฟอร์ม
              </Button>
            </Card>
          )}
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label} <span className="text-muted-foreground">({f.key})</span></Label>
              {f.type === "textarea" ? (
                <Textarea value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} rows={3} />
              ) : f.type === "select" ? (
                <Select value={values[f.key] || ""} onValueChange={(v) => setValues({ ...values, [f.key]: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="-- เลือก --" /></SelectTrigger>
                  <SelectContent>
                    {(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="h-9"
                />
              )}
            </div>
          ))}
        </div>

        {/* === Preview pane === */}
        <div className="overflow-auto bg-editor-canvas p-6 flex justify-center">
          <div
            className="obec-a4-page bg-white shadow-lg"
            style={{ width: "21cm", minHeight: "29.7cm", padding: "2.54cm", boxSizing: "border-box", color: "#000" }}
            dangerouslySetInnerHTML={{ __html: filledHtml }}
          />
        </div>
      </div>
    </div>
  );
}
