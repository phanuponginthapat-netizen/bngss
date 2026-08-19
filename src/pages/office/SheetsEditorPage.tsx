import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Download, Printer, Sheet as SheetIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { FortuneSheetEditor, workbookToSheets, sheetsToXlsxBlob, type FortuneSheetHandle } from "@/components/office/FortuneSheetEditor";
import type { Sheet } from "@fortune-sheet/core";
import { swal } from "@/lib/swal";

export default function SheetsEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState("ตารางใหม่.xlsx");
  const [loading, setLoading] = useState(!!fileIdParam);
  const [sheets, setSheets] = useState<Sheet[]>([
    { name: "Sheet1", id: "sheet_0", order: 0, status: 1, celldata: [], row: 100, column: 26 } as unknown as Sheet,
  ]);
  const sheetRef = useRef<FortuneSheetHandle>(null);

  useEffect(() => {
    setFileId(fileIdParam);
    if (!fileIdParam) return;
    (async () => {
      try {
        const meta = await getFileMeta(fileIdParam);
        setFileName(meta.name);
        const buf = await downloadFile(fileIdParam);
        setSheets(workbookToSheets(new Uint8Array(buf)));
      } catch (e: any) {
        swal.error("เปิดไฟล์ไม่สำเร็จ", String(e?.message ?? e));
        setFileId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [fileIdParam]);

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      setSheets(workbookToSheets(new Uint8Array(buf)));
      setFileName(file.name);
      setFileId(null);
    } catch (e: any) {
      swal.error("อ่านไฟล์ไม่ได้", String(e?.message ?? e));
    }
  };

  const buildXlsx = async (): Promise<Blob> => {
    if (sheetRef.current) return sheetRef.current.exportXlsx();
    return sheetsToXlsxBlob(sheets);
  };

  const download = async () => {
    try {
      const blob = await buildXlsx();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
      a.click();
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
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = fileName.replace(/\.[^.]+$/, "") + ".csv";
      a.click();
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
        return `<h3>${n}</h3><table>${arr.map(r =>
          `<tr>${(r as any[]).map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`
        ).join("")}</table>`;
      }).join("<div style='page-break-after:always'></div>");
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
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
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <SheetIcon className="w-5 h-5 text-emerald-600" />
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <div className="ml-auto flex items-center gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />นำเข้า</span></Button>
            </label>
            <Button variant="outline" size="sm" onClick={exportCsv}>CSV</Button>
            <Button variant="outline" size="sm" onClick={doPrint}><Printer className="w-4 h-4 mr-1" />พิมพ์</Button>
            <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด .xlsx</Button>
            <SaveToDriveButton
              fileId={fileId} fileName={fileName} defaultName="ตารางใหม่.xlsx"
              mimeType={MIME.xlsx} getBlob={buildXlsx}
              onSaved={(id, name) => { setFileId(id); setFileName(name); }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">กำลังโหลด…</div>
        ) : (
          <FortuneSheetEditor
            ref={sheetRef}
            initialSheets={sheets}
            className="w-full h-[calc(100vh-64px)]"
          />
        )}
      </div>
    </div>
  );
}
