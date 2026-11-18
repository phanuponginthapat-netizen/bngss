import { useEffect, useRef, useState } from "react";
import { escapeHtml } from "@/lib/escapeHtml";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Download, Printer } from "lucide-react";
import { OfficeWorkspace } from "@/components/office/OfficeWorkspace";
import { downloadOfficeBlob } from "@/lib/office/downloadBlob";
import mammoth from "mammoth";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { JoditDocEditor, type JoditDocEditorHandle } from "@/components/office/JoditDocEditor";
import { swal } from "@/lib/swal";
import { requireOfficeSourceReady } from "@/lib/office/sourceReadState";
import { attachEditableSource, readEditableSource } from "@/lib/office/editableArchive";
import DOMPurify from "dompurify";

async function readDocx(buf: ArrayBuffer) {
  const saved = await readEditableSource(buf, "docs");
  if (saved !== null && typeof saved !== "string") throw new Error("ข้อมูลเอกสารไม่สมบูรณ์");
  return DOMPurify.sanitize(typeof saved === "string" ? saved : (await mammoth.convertToHtml({ arrayBuffer: buf })).value);
}

export default function DocsEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState<string>("เอกสารใหม่.docx");
  const [loading, setLoading] = useState(!!fileIdParam);
  const [readError, setReadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const sourceVersion = useRef(0);
  const [initialHtml, setInitialHtml] = useState<string>("<p><br/></p>");
  const [pageSize, setPageSize] = useState<"A4" | "Letter">("A4");
  const editorRef = useRef<JoditDocEditorHandle>(null);

  useEffect(() => {
    const version = ++sourceVersion.current;
    setFileId(fileIdParam); setLoading(!!fileIdParam); setReadError(null);
    if (!fileIdParam) { setInitialHtml("<p><br/></p>"); setFileName("เอกสารใหม่.docx"); return; }
    (async () => {
      try {
        const meta = await getFileMeta(fileIdParam);
        const buf = await downloadFile(fileIdParam);
        const value = await readDocx(buf);
        if (version !== sourceVersion.current) return;
        setInitialHtml(value || "<p><br/></p>");
        setFileName(meta.name);
      } catch (e: any) {
        if (version === sourceVersion.current) setReadError(String(e?.message ?? e));
      } finally { if (version === sourceVersion.current) setLoading(false); }
    })();
    return () => { sourceVersion.current += 1; };
  }, [fileIdParam, retry]);

  const handleImportLocal = async (file: File) => {
    const version = ++sourceVersion.current;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const value = await readDocx(buf);
      if (version !== sourceVersion.current) return;
      setInitialHtml(value || "<p><br/></p>");
      editorRef.current?.setHtml(value || "");
      setFileName(file.name);
      setFileId(null); setReadError(null);
    } catch (e: any) {
      swal.error("อ่านไฟล์ไม่ได้", String(e?.message ?? e));
    } finally { if (version === sourceVersion.current) setLoading(false); }
  };

  const buildDocx = async (): Promise<Blob> => {
    requireOfficeSourceReady(loading, readError);
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
    return attachEditableSource(out instanceof Blob ? out : new Blob([out as any], { type: MIME.docx }), "docs", body);
  };

  const download = async () => {
    try {
      const blob = await buildDocx();
      downloadOfficeBlob(blob, fileName.endsWith(".docx") ? fileName : `${fileName}.docx`);
    } catch (e: any) {
      swal.error("Export ไม่สำเร็จ", String(e?.message ?? e));
    }
  };

  const doPrint = () => {
    if (loading || readError) return;
    const html = editorRef.current?.getHtml() ?? "";
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title>
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
    <OfficeWorkspace app="docs" name={fileName} onNameChange={setFileName} status={loading ? "กำลังเปิด" : readError ? "เปิดไม่สำเร็จ" : `${pageSize} · Word .docx`} actions={<>
      <select aria-label="ขนาดกระดาษ" value={pageSize} onChange={e => setPageSize(e.target.value as "A4" | "Letter")} className="h-9 text-sm border rounded-md px-2 bg-background"><option value="A4">A4</option><option value="Letter">Letter</option></select>
      <label className="cursor-pointer"><input aria-label="นำเข้าไฟล์ Word" type="file" accept=".docx" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleImportLocal(file); e.target.value = ""; }} /><Button variant="outline" size="sm" asChild><span><Upload />นำเข้า</span></Button></label>
      <Button variant="outline" size="sm" disabled={loading || !!readError} onClick={doPrint}><Printer />พิมพ์</Button>
      <Button variant="outline" size="sm" disabled={loading || !!readError} onClick={download}><Download />ดาวน์โหลด</Button>
      <SaveToDriveButton disabled={loading || !!readError} fileId={fileId} fileName={fileName} defaultName="เอกสารใหม่.docx" mimeType={MIME.docx} getBlob={buildDocx} onSaved={(id, name) => { setFileId(id); setFileName(name); }} />
    </>}>
      {loading ? <div className="text-center py-16 text-muted-foreground">กำลังโหลดเอกสาร…</div> : readError ? <div className="text-center py-12 space-y-3"><p className="text-destructive">เปิดไฟล์ไม่สำเร็จ</p><p className="text-sm text-muted-foreground">{readError}</p><Button variant="outline" onClick={() => setRetry(v => v + 1)}>ลองใหม่</Button></div> : <JoditDocEditor ref={editorRef} value={initialHtml} pageSize={pageSize} minHeight={900} />}
    </OfficeWorkspace>
  );
}
