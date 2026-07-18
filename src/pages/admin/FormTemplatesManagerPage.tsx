import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileEdit, FileText, ShieldAlert, Upload, Printer, Loader2 } from "lucide-react";
import FormTemplateButton from "@/components/academic/FormTemplateButton";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OBEC_PRINT_CSS } from "@/lib/printUtils";

const TEMPLATES: { code: string; title: string; category: string }[] = [
  // เอกสารทางการศึกษา (ปพ.)
  { code: "pp1", title: "ปพ.1 — ระเบียนแสดงผลการเรียน (Transcript)", category: "เอกสารทางการ ปพ." },
  { code: "pp2", title: "ปพ.2 — ประกาศนียบัตร", category: "เอกสารทางการ ปพ." },
  { code: "pp3", title: "ปพ.3 — แบบรายงานผู้สำเร็จการศึกษา", category: "เอกสารทางการ ปพ." },
  { code: "pp4", title: "ปพ.4 — แบบรายงานผลการพัฒนาคุณลักษณะ", category: "เอกสารทางการ ปพ." },
  { code: "pp5", title: "ปพ.5 — แบบบันทึกผลการเรียนประจำรายวิชา", category: "เอกสารทางการ ปพ." },
  { code: "pp6", title: "ปพ.6 — แบบรายงานผลการพัฒนาคุณภาพผู้เรียน", category: "เอกสารทางการ ปพ." },
  { code: "pp7", title: "ปพ.7 — ใบรับรองผลการเรียน", category: "เอกสารทางการ ปพ." },
  { code: "pp8", title: "ปพ.8 — ระเบียนสะสม", category: "เอกสารทางการ ปพ." },
  // งานสารบรรณ
  { code: "saraban", title: "สารบรรณอิเล็กทรอนิกส์ — เทมเพลตหนังสือราชการ", category: "งานสารบรรณ" },
  { code: "eform", title: "E-Form — เทมเพลตเอกสารราชการ", category: "งานสารบรรณ" },
  { code: "documents", title: "หนังสือสารบรรณ (ไฟล์แนบ)", category: "งานสารบรรณ" },
  // นักเรียน
  { code: "report_card", title: "สมุดรายงานผลการเรียน (Report Card)", category: "นักเรียน" },
  { code: "id_card", title: "บัตรประจำตัวนักเรียน/บุคลากร", category: "นักเรียน" },
  { code: "home_visit", title: "แบบบันทึกการเยี่ยมบ้านนักเรียน", category: "นักเรียน" },
  { code: "student_leave", title: "ใบลานักเรียน", category: "นักเรียน" },
  // HR
  { code: "id_plan", title: "แผนพัฒนาตนเองรายบุคคล (ID Plan)", category: "บุคลากร" },
  { code: "org_chart", title: "ผังโครงสร้างองค์กร", category: "บุคลากร" },
  { code: "staff_leave", title: "ใบลาบุคลากร", category: "บุคลากร" },
  { code: "asset_report", title: "รายงานทรัพย์สิน/ครุภัณฑ์", category: "บุคลากร" },
  // อื่นๆ
  { code: "ict_loan", title: "แบบยืม-คืน ICT", category: "อื่นๆ" },
  { code: "test_score", title: "รายงานคะแนนสอบมาตรฐาน", category: "อื่นๆ" },
  { code: "sports_day", title: "กำหนดการกีฬาสี", category: "อื่นๆ" },
];

function cleanWordHtml(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<o:p>[\s\S]*?<\/o:p>/g, "")
    .replace(/<o:p\s*\/?>/g, "")
    .replace(/\s(class|lang|xml:lang)="[^"]*mso[^"]*"/gi, "")
    .replace(/\sstyle="mso[^"]*"/gi, "");
}

const DOCX_DATA_PREFIX = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

/** .docx → data URL (SuperDoc loads natively). .html → cleaned HTML string. */
async function fileToContent(f: File): Promise<string> {
  const name = f.name.toLowerCase();
  if (name.endsWith(".docx")) return await blobToDataUrl(f);
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    const text = await f.text();
    const m = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return cleanWordHtml(m ? m[1] : text);
  }
  throw new Error("รองรับเฉพาะไฟล์ .docx และ .html เท่านั้น");
}

function QuickUpload({ code, title, onDone }: { code: string; title: string; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const content = await fileToContent(f);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("form_templates").upsert(
        { code, title, content_html: content, updated_by: u.user?.id || null },
        { onConflict: "code" }
      );
      if (error) throw error;
      toast.success(`อัปโหลด "${title}" สำเร็จ`);
      onDone();
    } catch (err: any) {
      toast.error("อัปโหลดไม่สำเร็จ: " + (err?.message || err));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept=".docx,.html,.htm" className="hidden" onChange={onPick} />
      <Button size="sm" variant="ghost" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
      </Button>
    </>
  );
}

export default function FormTemplatesManagerPage() {
  const { isAdmin, isDirector } = useUserRole();
  const canEdit = isAdmin || isDirector;
  const [filter, setFilter] = useState<string>("all");
  const qc = useQueryClient();

  const { data: savedRows = [] } = useQuery({
    queryKey: ["form_templates_list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("form_templates").select("code, updated_at, updated_by");
      return (data || []) as { code: string; updated_at: string }[];
    },
  });
  const savedMap = new Map(savedRows.map(r => [r.code, r.updated_at]));

  const categories = ["all", ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
  const filtered = filter === "all" ? TEMPLATES : TEMPLATES.filter(t => t.category === filter);
  const grouped = filtered.reduce<Record<string, typeof TEMPLATES>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  /** พิมพ์รวมเล่มทั้งหมวด (booklet) — ดึงเทมเพลตที่บันทึกแล้วใส่ในหน้าเดียวพร้อม page-break */
  const printBooklet = async (cat: string, items: typeof TEMPLATES) => {
    const codes = items.map(i => i.code);
    const { data } = await (supabase as any)
      .from("form_templates").select("code,title,content_html").in("code", codes);
    const map = new Map<string, { title: string; html: string }>(
      (data || []).map((r: any) => [r.code, { title: r.title, html: r.content_html || "" }])
    );
    // booklet print supports HTML templates only — .docx (data URL) must be exported from editor
    const docxCount = (data || []).filter((r: any) => (r.content_html || "").startsWith(DOCX_DATA_PREFIX)).length;
    const pages = items
      .map(i => map.get(i.code))
      .filter((x): x is { title: string; html: string } => !!x && !!x.html.trim() && !x.html.startsWith(DOCX_DATA_PREFIX));
    if (pages.length === 0) {
      toast.error(docxCount > 0
        ? "เทมเพลตในหมวดนี้เป็น .docx — โปรดเปิดทีละไฟล์ใน SuperDoc แล้วใช้ Print/Download"
        : "ยังไม่มีเทมเพลตที่บันทึกในหมวดนี้");
      return;
    }
    if (docxCount > 0) toast.info(`พิมพ์เฉพาะเทมเพลต HTML (${pages.length} ฉบับ) — ข้าม .docx ${docxCount} ฉบับ`);
    const w = window.open("", "_blank", "width=900,height=1200"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${cat}</title>
      <style>
        ${OBEC_PRINT_CSS.replace(/__LOVABLE_ORIGIN__/g, window.location.origin)}
        @page { size: A4; margin: 1.5cm; }
        body { margin:0; font-family:'TH Sarabun New','Sarabun',serif; font-size:16pt; }
        .booklet-page { page-break-after: always; }
        .booklet-page:last-child { page-break-after: auto; }
        input,select,textarea { border:0; border-bottom:1px solid #000; background:transparent; font:inherit; }
      </style></head><body>
      ${pages.map(p => `<div class="booklet-page obec-a4-page">${p.html}</div>`).join("")}
      <script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},500));</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileEdit className="w-6 h-6 text-primary" />
          จัดการเทมเพลตฟอร์มกลาง (ปพ. / สารบรรณ / นักเรียน / บุคลากร)
        </h1>
        <p className="text-sm text-muted-foreground">
          ดู/แก้/อัปโหลด (.docx, .html จาก Word) • พิมพ์รวมเล่มทั้งหมวดในครั้งเดียว
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2 p-3 rounded-md border border-warning/30 bg-warning/10 text-warning dark:text-warning text-sm">
          <ShieldAlert className="w-4 h-4" />
          คุณดูเทมเพลตได้ในโหมดอ่านอย่างเดียว — เฉพาะผู้ดูแล/ผู้อำนวยการเท่านั้นที่บันทึก/อัปโหลดได้
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <Badge key={c} variant={filter === c ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter(c)}>
            {c === "all" ? "ทั้งหมด" : c}
          </Badge>
        ))}
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, items]) => (
          <Card key={cat}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">{cat}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => printBooklet(cat, items)}>
                <Printer className="w-4 h-4 mr-1" />พิมพ์รวมเล่มทั้งหมวด
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(t => {
                  const updated = savedMap.get(t.code);
                  return (
                    <div key={t.code} className="border rounded-lg p-3 flex flex-col gap-2 hover:border-primary/50 transition">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm leading-tight">{t.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <code className="text-[10px]">{t.code}</code>
                            {updated && <span> • อัปเดต {new Date(updated).toLocaleDateString("th-TH")}</span>}
                            {!updated && <span> • ยังไม่มีเทมเพลต</span>}
                          </p>
                        </div>
                        {canEdit && (
                          <QuickUpload code={t.code} title={t.title}
                            onDone={() => qc.invalidateQueries({ queryKey: ["form_templates_list"] })} />
                        )}
                      </div>
                      <FormTemplateButton code={t.code} title={t.title} size="sm" variant="outline" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
