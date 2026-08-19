import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Download, Printer, FileText } from "lucide-react";
import mammoth from "mammoth";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { JoditDocEditor, type JoditDocEditorHandle } from "@/components/office/JoditDocEditor";
import { swal } from "@/lib/swal";

export default function DocsEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState<string>("เอกสารใหม่.docx");
  const [loading, setLoading] = useState(!!fileIdParam);
  const [initialHtml, setInitialHtml] = useState<string>("<p><br/></p>");
  const [pageSize, setPageSize] = useState<"A4" | "Letter">("A4");
  const editorRef = useRef<JoditDocEditorHandle>(null);

  useEffect(() => {
    setFileId(fileIdParam);
    setLoading(!!fileIdParam);
    if (!fileIdParam) return;
    (async () => {
      try {
        const meta = await getFileMeta(fileIdParam);
        setFileName(meta.name);
        const buf = await downloadFile(fileIdParam);
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
        setInitialHtml(value || "<p><br/></p>");
      } catch (e: any) {
        swal.error("เปิดไฟล์ไม่สำเร็จ", String(e?.message ?? e));
        setFileId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [fileIdParam]);

  const handleImportLocal = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
      setInitialHtml(value || "<p><br/></p>");
      editorRef.current?.setHtml(value || "");
      setFileName(file.name);
      setFileId(null);
    } catch (e: any) {
      swal.error("อ่านไฟล์ไม่ได้", String(e?.message ?? e));
    }
  };

  const buildDocx = async (): Promise<Blob> => {
    const body = editorRef.current?.getHtml() ?? "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body{font-family:'Sarabun','TH Sarabun New',sans-serif;font-size:14pt;color:#111;line-height:1.6;}
        h1{font-size:24pt}h2{font-size:20pt}h3{font-size:16pt}
        img{max-width:100%}
        table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #666;padding:4px 8px}
      </style></head><body>${body}</body></html>`;
    const { asBlob } = await import("html-docx-js-typescript");
    const out = await asBlob(html);
    return out instanceof Blob ? out : new Blob([out as any], { type: MIME.docx });
  };

  const download = async () => {
    try {
      const blob = await buildDocx();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
      a.click();
    } catch (e: any) {
      swal.error("Export ไม่สำเร็จ", String(e?.message ?? e));
    }
  };

  const doPrint = () => {
    const html = editorRef.current?.getHtml() ?? "";
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
      <style>
        @page { size: ${pageSize}; margin: 2.54cm; }
        body { font-family: Sarabun, 'TH Sarabun New', sans-serif; font-size: 14pt; color: #111; line-height: 1.6; }
        h1{font-size:24pt}h2{font-size:20pt}h3{font-size:16pt}
        img{max-width:100%}
        table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #999;padding:4px 8px}
      </style></head><body>${html}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
  };

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <FileText className="w-5 h-5 text-blue-600" />
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <select
            value={pageSize}
            onChange={e => setPageSize(e.target.value as "A4" | "Letter")}
            className="h-8 text-xs border rounded px-2 bg-background"
            title="ขนาดกระดาษ"
          >
            <option value="A4">A4 (21 × 29.7 ซม.)</option>
            <option value="Letter">Letter (21.59 × 27.94 ซม.)</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".docx" className="hidden" onChange={e => e.target.files?.[0] && handleImportLocal(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />นำเข้า</span></Button>
            </label>
            <Button variant="outline" size="sm" onClick={doPrint}><Printer className="w-4 h-4 mr-1" />พิมพ์</Button>
            <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด .docx</Button>
            <SaveToDriveButton
              fileId={fileId} fileName={fileName} defaultName="เอกสารใหม่.docx"
              mimeType={MIME.docx} getBlob={buildDocx}
              onSaved={(id, name) => { setFileId(id); setFileName(name); }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">กำลังโหลดเอกสาร…</div>
        ) : (
          <JoditDocEditor
            ref={editorRef}
            value={initialHtml}
            pageSize={pageSize}
            minHeight={900}
          />
        )}
      </div>
    </div>
  );
}
