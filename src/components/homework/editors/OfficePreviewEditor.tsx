import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Download, ExternalLink, Upload, Info } from "lucide-react";
import { downloadHomeworkBlob, signedHomeworkUrl, isDocxMime, isXlsxMime, isPptxMime, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";

interface Props {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

/**
 * Unified preview-and-reply editor for Office files (DOCX/XLSX/PPTX).
 *
 * เราเลิกใช้การแปลง DOCX↔HTML / XLSX↔Sheet กลับไปกลับมา (mammoth/xlsx/html-docx-js)
 * เพราะมันทำให้เนื้อหาภาษาไทย ตาราง รูปภาพ และฟอนต์เพี้ยน/หายในไฟล์จริง
 * แทนที่ด้วย:
 *  1) แสดงเนื้อหาไฟล์ครู *จริง ๆ* ด้วย Microsoft Office Online Viewer (iframe)
 *  2) ให้ผู้ใช้พิมพ์โน้ต และอัปไฟล์ที่แก้แล้ว / ถ่ายรูปงานแนบกลับ
 */
export default function OfficePreviewEditor({ open, attachment, onClose, onSave }: Props) {
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !attachment) return;
    let cancelled = false;
    setSignedUrl("");
    setNote("");
    setFile(null);
    setLoadingUrl(true);
    (async () => {
      try {
        // Long expiry so Office Online can fetch it
        const url = await signedHomeworkUrl(attachment.path, 60 * 60 * 4);
        if (!cancelled) setSignedUrl(url);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || "เปิดไฟล์ไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoadingUrl(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, attachment?.id]);

  const kind =
    attachment && isDocxMime(attachment.mime, attachment.name) ? "Word"
    : attachment && isXlsxMime(attachment.mime, attachment.name) ? "Excel"
    : attachment && isPptxMime(attachment.mime, attachment.name) ? "PowerPoint"
    : "เอกสาร";

  const officeViewerSrc = signedUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`
    : "";

  const handleDownload = async () => {
    if (!attachment) return;
    try {
      const blob = await downloadHomeworkBlob(attachment.path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "ดาวน์โหลดไม่สำเร็จ");
    }
  };

  const handleSave = async () => {
    if (!attachment) return;
    if (!file && !note.trim()) {
      toast.error("พิมพ์โน้ต หรือแนบไฟล์อย่างน้อย 1 อย่าง");
      return;
    }
    setSaving(true);
    try {
      if (file) {
        await onSave(file, file.name);
      } else {
        // No file — save the note as a small .txt so it still flows through onSave
        const blob = new Blob([note], { type: "text/plain;charset=utf-8" });
        const baseName = attachment.name.replace(/\.[^.]+$/, "");
        await onSave(blob, `${baseName}_note.txt`);
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="truncate">แก้ไข {kind}: {attachment?.name}</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 overflow-hidden">
          {loadingUrl ? (
            <div className="p-10 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />กำลังโหลดไฟล์...
            </div>
          ) : officeViewerSrc ? (
            <iframe
              key={officeViewerSrc}
              src={officeViewerSrc}
              title={attachment?.name || "preview"}
              className="w-full bg-white"
              style={{ height: "55vh", border: 0 }}
              allow="fullscreen"
            />
          ) : (
            <div className="p-10 text-center text-muted-foreground">เปิดดูตัวอย่างไม่ได้</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5 mr-1" /> ดาวน์โหลดไฟล์ครู
          </Button>
          {signedUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={signedUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> เปิดในแท็บใหม่
              </a>
            </Button>
          )}
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 ml-auto">
            <Info className="w-3 h-3" /> แก้ไขในเครื่อง แล้วอัปไฟล์ที่เสร็จแล้วด้านล่าง
          </div>
        </div>

        <div className="space-y-2 border-t pt-3">
          <label className="text-xs font-medium">โน้ต/คำตอบถึงครู</label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="พิมพ์คำตอบหรือข้อความถึงครู (ถ้ามี)..." />

          <label className="text-xs font-medium block pt-1">แนบไฟล์ที่แก้ไขแล้ว / ภาพถ่ายงาน</label>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 text-xs border rounded-md px-3 py-1.5 cursor-pointer hover:bg-muted">
              <Upload className="w-3.5 h-3.5" />
              {file ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,image/*"
              />
            </label>
            {file && (
              <span className="text-xs text-muted-foreground truncate max-w-[40ch]">
                {file.name} · {Math.round(file.size / 1024)} KB
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            บันทึก & แนบกลับ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
