import { useEffect, useRef, useState } from "react";
import { escapeHtml } from "@/lib/escapeHtml";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Download, Printer, FileDown } from "lucide-react";
import { OfficeWorkspace } from "@/components/office/OfficeWorkspace";
import { downloadOfficeBlob } from "@/lib/office/downloadBlob";
import * as XLSX from "xlsx";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { FortuneSheetEditor, workbookToSheets, sheetsToXlsxBlob, type FortuneSheetHandle } from "@/components/office/FortuneSheetEditor";
import type { Sheet } from "@fortune-sheet/core";
import { swal } from "@/lib/swal";
import { requireOfficeSourceReady } from "@/lib/office/sourceReadState";

export default function SheetsEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState("ตารางใหม่.xlsx");
  const [loading, setLoading] = useState(!!fileIdParam);
  const [readError, setReadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const sourceVersion = useRef(0);
  const [sheets, setSheets] = useState<Sheet[]>([
    { name: "Sheet1", id: "sheet_0", order: 0, status: 1, celldata: [], row: 100, column: 26 } as unknown as Sheet,
  ]);
  const sheetRef = useRef<FortuneSheetHandle>(null);

  useEffect(() => {
    const version = ++sourceVersion.current;
    setFileId(fileIdParam); setLoading(!!fileIdParam); setReadError(null);
    if (!fileIdParam) { setSheets([{ name: "Sheet1", id: "sheet_0", order: 0, status: 1, celldata: [], row: 100, column: 26 } as unknown as Sheet]); setFileName("ตารางใหม่.xlsx"); return; }
    (async () => {
      try {
        const meta = await getFileMeta(fileIdParam);
        const buf = await downloadFile(fileIdParam);
        const loaded = workbookToSheets(new Uint8Array(buf));
        if (version !== sourceVersion.current) return;
        setSheets(loaded);
        setFileName(meta.name);
      } catch (e: any) {
        if (version === sourceVersion.current) setReadError(String(e?.message ?? e));
      } finally { if (version === sourceVersion.current) setLoading(false); }
    })();
    return () => { sourceVersion.current += 1; };
  }, [fileIdParam, retry]);

  const handleImport = async (file: File) => {
    const version = ++sourceVersion.current;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const loaded = workbookToSheets(new Uint8Array(buf));
      if (version !== sourceVersion.current) return;
      setSheets(loaded);
      setFileName(file.name);
      setFileId(null); setReadError(null);
    } catch (e: any) {
      swal.error("อ่านไฟล์ไม่ได้", String(e?.message ?? e));
    } finally { if (version === sourceVersion.current) setLoading(false); }
  };

  const buildXlsx = async (): Promise<Blob> => {
    requireOfficeSourceReady(loading, readError);
    if (sheetRef.current) return sheetRef.current.exportXlsx();
    return sheetsToXlsxBlob(sheets);
  };

  const download = async () => {
    try {
      const blob = await buildXlsx();
      downloadOfficeBlob(blob, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
    } catch (e: any) {
      swal.error("Export ไม่สำเร็จ", String(e?.message ?? e));
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await buildXlsx();
      const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws);
      const out = new Blob([csv], { type: "text/csv;charset=utf-8" });
      downloadOfficeBlob(out, fileName.replace(/\.[^.]+$/, "") + ".csv");
    } catch (e: any) {
      swal.error("CSV ไม่สำเร็จ", String(e?.message ?? e));
    }
  };

  const doPrint = async () => {
    try {
      const blob = await buildXlsx();
      const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
      const win = window.open("", "_blank");
      if (!win) return;
      const parts = wb.SheetNames.map(n => {
        const ws = wb.Sheets[n];
        const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) as any[][];
        return `<h3>${escapeHtml(n)}</h3><table>${arr.map(r =>
          `<tr>${(r as any[]).map(c => `<td>${escapeHtml(c ?? "")}</td>`).join("")}</tr>`
        ).join("")}</table>`;
      }).join("<div style='page-break-after:always'></div>");
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title>
        <style>@page{size:A4 landscape;margin:1cm}
        body{font-family:Sarabun,sans-serif;font-size:11pt}
        table{border-collapse:collapse;width:100%;margin-bottom:12px}
        td,th{border:1px solid #666;padding:4px 6px}
        h3{margin:8px 0}
        </style></head><body>${parts}</body></html>`);
      win.document.close();
      setTimeout(() => { win.focus(); win.print(); }, 300);
    } catch (e: any) {
      swal.error("พิมพ์ไม่สำเร็จ", String(e?.message ?? e));
    }
  };

  return (
    <OfficeWorkspace app="sheets" name={fileName} onNameChange={setFileName} status={loading ? "กำลังเปิด" : readError ? "เปิดไม่สำเร็จ" : `${sheets.length} แผ่นงาน · Excel .xlsx`} actions={<>
      <label className="cursor-pointer"><input aria-label="นำเข้าไฟล์ตาราง" type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleImport(file); e.target.value = ""; }} /><Button variant="outline" size="sm" asChild><span><Upload />นำเข้า</span></Button></label>
      <Button variant="outline" size="sm" disabled={loading || !!readError} onClick={exportCsv}><FileDown />CSV</Button>
      <Button variant="outline" size="sm" disabled={loading || !!readError} onClick={doPrint}><Printer />พิมพ์</Button>
      <Button variant="outline" size="sm" disabled={loading || !!readError} onClick={download}><Download />ดาวน์โหลด</Button>
      <SaveToDriveButton disabled={loading || !!readError} fileId={fileId} fileName={fileName} defaultName="ตารางใหม่.xlsx" mimeType={MIME.xlsx} getBlob={buildXlsx} onSaved={(id, name) => { setFileId(id); setFileName(name); }} />
    </>}>
      {loading ? <div className="text-center py-16 text-muted-foreground">กำลังโหลด…</div> : readError ? <div className="text-center py-12 space-y-3"><p className="text-destructive">เปิดไฟล์ไม่สำเร็จ</p><p className="text-sm text-muted-foreground">{readError}</p><Button variant="outline" onClick={() => setRetry(v => v + 1)}>ลองใหม่</Button></div> : <FortuneSheetEditor ref={sheetRef} initialSheets={sheets} className="w-full h-full min-h-[420px]" />}
    </OfficeWorkspace>
  );
}
