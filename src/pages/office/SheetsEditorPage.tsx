import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Upload, Download, Plus, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { swal } from "@/lib/swal";

interface SheetData {
  name: string;
  rows: string[][];
}

const DEFAULT_COLS = 12;
const DEFAULT_ROWS = 30;

function emptyRows(r: number, c: number): string[][] {
  return Array.from({ length: r }, () => Array.from({ length: c }, () => ""));
}

export default function SheetsEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState("ตารางใหม่.xlsx");
  const [sheets, setSheets] = useState<SheetData[]>([{ name: "Sheet1", rows: emptyRows(DEFAULT_ROWS, DEFAULT_COLS) }]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(!!fileIdParam);

  useEffect(() => {
    if (!fileIdParam) return;
    (async () => {
      try {
        const meta = await getFileMeta(fileIdParam);
        setFileName(meta.name);
        const buf = await downloadFile(fileIdParam);
        loadWorkbook(new Uint8Array(buf));
      } catch (e: any) {
        swal.error("เปิดไฟล์ไม่สำเร็จ", String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [fileIdParam]);

  const loadWorkbook = (data: Uint8Array | ArrayBuffer) => {
    const wb = XLSX.read(data, { type: "array" });
    const list: SheetData[] = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name];
      const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) as any[][];
      const rows = arr.map(r => r.map(v => v == null ? "" : String(v)));
      // pad to at least DEFAULT_ROWS × DEFAULT_COLS
      const cols = Math.max(DEFAULT_COLS, ...rows.map(r => r.length));
      const padded = rows.map(r => [...r, ...Array(Math.max(0, cols - r.length)).fill("")]);
      while (padded.length < DEFAULT_ROWS) padded.push(Array(cols).fill(""));
      return { name, rows: padded };
    });
    setSheets(list.length ? list : [{ name: "Sheet1", rows: emptyRows(DEFAULT_ROWS, DEFAULT_COLS) }]);
    setActive(0);
  };

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      loadWorkbook(new Uint8Array(buf));
      setFileName(file.name);
      setFileId(null);
    } catch (e: any) {
      swal.error("อ่านไฟล์ไม่ได้", String(e?.message ?? e));
    }
  };

  const buildXlsx = async (): Promise<Blob> => {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      // trim empty trailing rows
      const rows = [...s.rows];
      while (rows.length && rows[rows.length - 1].every(c => c === "")) rows.pop();
      const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]);
      XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
    }
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([out], { type: MIME.xlsx });
  };

  const download = async () => {
    const blob = await buildXlsx();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
    a.click();
  };

  const updateCell = (r: number, c: number, val: string) => {
    setSheets(prev => {
      const next = [...prev];
      const rows = next[active].rows.map(row => [...row]);
      rows[r][c] = val;
      next[active] = { ...next[active], rows };
      return next;
    });
  };

  const addSheet = () => {
    setSheets(prev => [...prev, { name: `Sheet${prev.length + 1}`, rows: emptyRows(DEFAULT_ROWS, DEFAULT_COLS) }]);
    setActive(sheets.length);
  };

  const removeSheet = (i: number) => {
    if (sheets.length === 1) return;
    setSheets(prev => prev.filter((_, idx) => idx !== i));
    setActive(a => Math.max(0, a - (i <= a ? 1 : 0)));
  };

  const addRow = () => setSheets(prev => {
    const next = [...prev];
    const cols = next[active].rows[0]?.length ?? DEFAULT_COLS;
    next[active] = { ...next[active], rows: [...next[active].rows, Array(cols).fill("")] };
    return next;
  });

  const addCol = () => setSheets(prev => {
    const next = [...prev];
    next[active] = { ...next[active], rows: next[active].rows.map(r => [...r, ""]) };
    return next;
  });

  const cur = sheets[active];

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={addRow}>+ แถว</Button>
          <Button variant="ghost" size="sm" onClick={addCol}>+ คอลัมน์</Button>
          <div className="ml-auto flex items-center gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />นำเข้า</span></Button>
            </label>
            <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด</Button>
            <SaveToDriveButton
              fileId={fileId}
              fileName={fileName}
              defaultName="ตารางใหม่.xlsx"
              mimeType={MIME.xlsx}
              getBlob={buildXlsx}
              onSaved={(id, name) => { setFileId(id); setFileName(name); }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">กำลังโหลด…</div>
        ) : (
          <div className="p-2">
            <table className="border-collapse text-sm bg-background">
              <thead>
                <tr>
                  <th className="w-10 bg-muted border sticky top-0 z-10" />
                  {cur.rows[0].map((_, ci) => (
                    <th key={ci} className="min-w-24 px-2 py-1 bg-muted border text-xs font-mono sticky top-0 z-10">
                      {colLabel(ci)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cur.rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className="bg-muted border text-center text-xs font-mono w-10">{ri + 1}</td>
                    {row.map((v, ci) => (
                      <td key={ci} className="border p-0">
                        <input
                          value={v}
                          onChange={e => updateCell(ri, ci, e.target.value)}
                          className="w-full min-w-24 px-2 py-1 outline-none focus:ring-2 focus:ring-primary bg-transparent text-sm"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t bg-background flex items-center gap-1 p-1 overflow-x-auto">
        {sheets.map((s, i) => (
          <div key={i} className="flex items-center">
            <button
              onClick={() => setActive(i)}
              className={`px-3 py-1 text-sm rounded ${i === active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {s.name}
            </button>
            {sheets.length > 1 && (
              <button onClick={() => removeSheet(i)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={addSheet}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

function colLabel(n: number): string {
  let s = "";
  n++;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
