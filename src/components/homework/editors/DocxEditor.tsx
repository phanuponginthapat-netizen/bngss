import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import RichDocEditor from "@/components/editor/RichDocEditor";
import { downloadHomeworkBlob, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";

interface Props {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

export default function DocxEditor({ open, attachment, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!open || !attachment) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const blob = await downloadHomeworkBlob(attachment.path);
        const buf = await blob.arrayBuffer();
        const mammoth: any = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (!cancelled) setHtml(result.value || "<p></p>");
      } catch (e: any) {
        console.error(e);
        toast.error("เปิดไฟล์ Word ไม่สำเร็จ: " + (e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, attachment?.id]);

  const handleSave = async () => {
    if (!attachment) return;
    setSaving(true);
    try {
      const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:'TH Sarabun New','IBM Plex Sans Thai',sans-serif;font-size:16pt;}
        h1{font-size:24pt;} h2{font-size:20pt;} h3{font-size:18pt;}
        table{border-collapse:collapse;} td,th{border:1px solid #888;padding:4px;}
      </style></head><body>${html}</body></html>`;
      const { asBlob } = await import("html-docx-js-typescript");
      const out = await asBlob(full);
      const blob = out instanceof Blob ? out : new Blob([out as any], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const baseName = attachment.name.replace(/\.[^.]+$/, "");
      await onSave(blob, `${baseName}_edited.docx`);
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="truncate">แก้ไข Word: {attachment?.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />กำลังโหลด...</div>
        ) : (
          <RichDocEditor value={html} onChange={setHtml} minHeight="60vh" />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            บันทึก & แนบกลับ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
