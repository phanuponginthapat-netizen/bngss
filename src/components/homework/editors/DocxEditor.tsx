import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save, FileDown } from "lucide-react";
import { downloadHomeworkBlob, type Attachment } from "@/lib/homeworkStorage";
import { JoditDocEditor, type JoditDocEditorHandle } from "@/components/office/JoditDocEditor";
import { toast } from "sonner";

interface Props {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

/**
 * MS-Word-like homework editor (Jodit). Retains:
 *  - Auto-save draft to localStorage every 30s
 *  - Save as .docx back to Homework storage via html-docx-js
 *  - PDF export
 */
export default function DocxEditor({ open, attachment, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialHtml, setInitialHtml] = useState<string>("<p><br/></p>");
  const editorRef = useRef<JoditDocEditorHandle>(null);
  const autoSaveKey = attachment ? `docx-draft:${attachment.id}` : "";

  useEffect(() => {
    if (!open || !attachment) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const draft = localStorage.getItem(autoSaveKey);
        if (draft) {
          setInitialHtml(draft);
          toast.info("กู้คืนฉบับร่างอัตโนมัติแล้ว");
          return;
        }
        const blob = await downloadHomeworkBlob(attachment.path);
        const buf = await blob.arrayBuffer();
        const mammoth: any = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (!cancelled) setInitialHtml(result.value || "<p><br/></p>");
      } catch (e: any) {
        console.error(e);
        toast.error("เปิดไฟล์ Word ไม่สำเร็จ: " + (e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, attachment?.id, autoSaveKey]);

  useEffect(() => {
    if (!open || !autoSaveKey) return;
    const id = setInterval(() => {
      try {
        const html = editorRef.current?.getHtml();
        if (html) localStorage.setItem(autoSaveKey, html);
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(id);
  }, [open, autoSaveKey]);

  const handleSave = async () => {
    if (!attachment) return;
    setSaving(true);
    try {
      const body = editorRef.current?.getHtml() ?? "";
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:'IBM Plex Sans Thai','TH Sarabun New',sans-serif;font-size:14pt;}
        h1{font-size:20pt;} h2{font-size:16pt;} h3{font-size:14pt;}
        table{border-collapse:collapse;} td,th{border:1px solid #888;padding:4px;}
        img{max-width:100%;}
      </style></head><body>${body}</body></html>`;
      const { asBlob } = await import("html-docx-js-typescript");
      const out = await asBlob(html);
      const blob = out instanceof Blob ? out : new Blob([out as any], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const baseName = attachment.name.replace(/\.[^.]+$/, "");
      await onSave(blob, `${baseName}_edited.docx`);
      try { localStorage.removeItem(autoSaveKey); } catch { /* ignore */ }
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    try {
      const html2pdf: any = (await import("html2pdf.js" as any)).default;
      const container = document.createElement("div");
      container.style.padding = "24px";
      container.style.fontFamily = "'IBM Plex Sans Thai','TH Sarabun New',sans-serif";
      container.innerHTML = editorRef.current?.getHtml() ?? "";
      await html2pdf().from(container).set({
        margin: 10, filename: `${attachment?.name?.replace(/\.[^.]+$/, "") || "document"}.pdf`,
        html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4" },
      }).save();
    } catch (e: any) {
      toast.error("ส่งออก PDF ไม่สำเร็จ: " + (e?.message || e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 flex-row items-center justify-between space-y-0">
          <DialogTitle className="truncate">แก้ไข Word: {attachment?.name}</DialogTitle>
          <div className="flex items-center gap-2 pr-8">
            <Button size="sm" variant="outline" onClick={exportPdf} className="h-8">
              <FileDown className="w-4 h-4 mr-1" />PDF
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-8">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              บันทึก
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-3 pb-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>กำลังโหลด…</span>
            </div>
          ) : (
            <JoditDocEditor ref={editorRef} value={initialHtml} pageSize="A4" minHeight={700} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
