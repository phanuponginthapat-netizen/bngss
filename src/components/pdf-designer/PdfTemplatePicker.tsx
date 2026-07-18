import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { renderPdfTemplate, downloadBlob, openBlobInNewTab } from "@/lib/pdfTemplate/renderTemplate";
import { CATEGORY_LABEL } from "@/lib/pdfTemplate/types";
import type { PdfTemplateCategory, PdfTemplateRecord } from "@/lib/pdfTemplate/types";

interface Props {
  category: PdfTemplateCategory | PdfTemplateCategory[];
  /** Data object resolved against {path.to.value} bindings inside template fields */
  data: Record<string, any>;
  /** Optional file name (no extension) */
  filename?: string;
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  buttonSize?: "default" | "sm" | "lg";
}

/**
 * ปุ่ม "พิมพ์จากเทมเพลต PDF" — เปิด dialog ให้เลือกเทมเพลตของหมวดที่กำหนด
 * แล้ว render เป็น PDF จริงพร้อมข้อมูลที่ส่งเข้ามา
 */
export default function PdfTemplatePicker({
  category, data, filename, buttonLabel = "พิมพ์จากเทมเพลต PDF",
  buttonVariant = "outline", buttonSize = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PdfTemplateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const cats = Array.isArray(category) ? category : [category];
    supabase.from("pdf_templates" as any)
      .select("*")
      .in("category", cats)
      .eq("is_active", true)
      .order("name")
      .then(({ data: rows }) => { setList((rows || []) as any); setLoading(false); });
  }, [open, category]);

  const run = async (tpl: PdfTemplateRecord, openTab = false) => {
    setBusyId(tpl.id);
    try {
      const blob = await renderPdfTemplate(tpl, data);
      const name = `${filename || tpl.name}.pdf`;
      if (openTab) openBlobInNewTab(blob);
      else downloadBlob(blob, name);
      await logAudit({
        action: "pdf_template.render",
        target_table: "pdf_templates",
        target_id: tpl.id,
        details: { name: tpl.name, category: tpl.category },
      });
      toast.success("สร้าง PDF เรียบร้อย");
    } catch (e: any) {
      toast.error("สร้าง PDF ไม่สำเร็จ: " + e.message);
    } finally { setBusyId(null); }
  };

  return (
    <>
      <Button variant={buttonVariant} size={buttonSize} onClick={() => setOpen(true)}>
        <FileText className="w-4 h-4 mr-1" /> {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>เลือกเทมเพลต PDF</DialogTitle></DialogHeader>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 mx-auto animate-spin" /></div>
          ) : list.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              ยังไม่มีเทมเพลตในหมวดนี้ — ให้แอดมินไปสร้างที่ "PDF Coordinate Designer Pro"
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {list.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[t.category]} • {t.page_count} หน้า • {(t.fields || []).length} ฟิลด์
                      </div>
                      {t.description && <div className="text-xs line-clamp-2">{t.description}</div>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" disabled={busyId === t.id} onClick={() => run(t, true)}>
                        ดู
                      </Button>
                      <Button size="sm" disabled={busyId === t.id} onClick={() => run(t, false)}>
                        {busyId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
