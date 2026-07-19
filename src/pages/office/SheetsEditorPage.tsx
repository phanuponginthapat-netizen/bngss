import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { ArrowLeft, Upload, Download, Plus, Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Printer, Palette, Undo, Redo } from "lucide-react";
import * as XLSX from "xlsx";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { swal } from "@/lib/swal";

interface CellStyle { bold?: boolean; italic?: boolean; align?: "left" | "center" | "right"; color?: string; bg?: string; }
interface SheetData { name: string; rows: string[][]; styles: Record<string, CellStyle>; }

const DEFAULT_COLS = 20;
const DEFAULT_ROWS = 50;

function emptyRows(r: number, c: number): string[][] {
  return Array.from({ length: r }, () => Array.from({ length: c }, () => ""));
}
const cellKey = (r: number, c: number) => `${r}:${c}`;

// ── Formula engine ─────────────────────────────────────────────
function colFromLabel(s: string): number { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
function refToRC(ref: string): { r: number; c: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/i); if (!m) return null;
  return { c: colFromLabel(m[1]), r: parseInt(m[2]) - 1 };
}
function evalFormula(formula: string, rows: string[][], stack = new Set<string>()): string {
  try {
    let expr = formula.startsWith("=") ? formula.slice(1) : formula;
    // Range functions
    expr = expr.replace(/(SUM|AVERAGE|AVG|COUNT|MIN|MAX|COUNTA)\(([A-Z]+\d+):([A-Z]+\d+)\)/gi, (_, fn, a, b) => {
      const A = refToRC(a)!, B = refToRC(b)!;
      const vals: number[] = []; let count = 0, counta = 0;
      for (let r = Math.min(A.r, B.r); r <= Math.max(A.r, B.r); r++) {
        for (let c = Math.min(A.c, B.c); c <= Math.max(A.c, B.c); c++) {
          const raw = rows[r]?.[c] ?? "";
          if (raw !== "") counta++;
          const v = parseFloat(String(raw).startsWith("=") ? evalFormula(raw, rows, stack) : raw);
          if (!isNaN(v)) { vals.push(v); count++; }
        }
      }
      const F = fn.toUpperCase();
      if (F === "SUM") return String(vals.reduce((a, b) => a + b, 0));
      if (F === "AVERAGE" || F === "AVG") return String(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
      if (F === "COUNT") return String(count);
      if (F === "COUNTA") return String(counta);
      if (F === "MIN") return String(vals.length ? Math.min(...vals) : 0);
      if (F === "MAX") return String(vals.length ? Math.max(...vals) : 0);
      return "0";
    });
    // Cell refs A1
    expr = expr.replace(/\b([A-Z]+)(\d+)\b/gi, (_, col, row) => {
      const rc = refToRC(col + row)!;
      const key = `${rc.r}:${rc.c}`;
      if (stack.has(key)) return "0";
      stack.add(key);
      const raw = rows[rc.r]?.[rc.c] ?? "";
      const val = String(raw).startsWith("=") ? evalFormula(raw, rows, stack) : raw;
      stack.delete(key);
      const n = parseFloat(val);
      return isNaN(n) ? `"${val.replace(/"/g, '\\"')}"` : String(n);
    });
    // IF(cond, a, b)
    expr = expr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, c, a, b) => {
      try { return eval(c) ? a : b; } catch { return b; }
    });
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    return String(result);
  } catch { return "#ERR"; }
}

export default function SheetsEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState("ตารางใหม่.xlsx");
  const [sheets, setSheets] = useState<SheetData[]>([{ name: "Sheet1", rows: emptyRows(DEFAULT_ROWS, DEFAULT_COLS), styles: {} }]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(!!fileIdParam);
  const [sel, setSel] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [formulaEdit, setFormulaEdit] = useState("");
  const history = useRef<SheetData[][]>([]);
  const future = useRef<SheetData[][]>([]);

  const pushHist = useCallback((prev: SheetData[]) => {
    history.current.push(JSON.parse(JSON.stringify(prev)));
    if (history.current.length > 100) history.current.shift();
    future.current = [];
  }, []);

  const undo = () => {
    const prev = history.current.pop(); if (!prev) return;
    future.current.push(JSON.parse(JSON.stringify(sheets)));
    setSheets(prev);
  };
  const redo = () => {
    const nxt = future.current.pop(); if (!nxt) return;
    history.current.push(JSON.parse(JSON.stringify(sheets)));
    setSheets(nxt);
  };

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
      } finally { setLoading(false); }
    })();
  }, [fileIdParam]);

  const loadWorkbook = (data: Uint8Array | ArrayBuffer) => {
    const wb = XLSX.read(data, { type: "array" });
    const list: SheetData[] = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name];
      const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: false }) as any[][];
      const rows = arr.map(r => r.map(v => v == null ? "" : String(v)));
      const cols = Math.max(DEFAULT_COLS, ...rows.map(r => r.length));
      const padded = rows.map(r => [...r, ...Array(Math.max(0, cols - r.length)).fill("")]);
      while (padded.length < DEFAULT_ROWS) padded.push(Array(cols).fill(""));
      return { name, rows: padded, styles: {} };
    });
    setSheets(list.length ? list : [{ name: "Sheet1", rows: emptyRows(DEFAULT_ROWS, DEFAULT_COLS), styles: {} }]);
    setActive(0);
    history.current = []; future.current = [];
  };

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      loadWorkbook(new Uint8Array(buf));
      setFileName(file.name); setFileId(null);
    } catch (e: any) { swal.error("อ่านไฟล์ไม่ได้", String(e?.message ?? e)); }
  };

  const buildXlsx = async (): Promise<Blob> => {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const rows = [...s.rows];
      while (rows.length && rows[rows.length - 1].every(c => c === "")) rows.pop();
      // Convert formulas to computed values on export
      const out = rows.map(row => row.map(v => v.startsWith("=") ? evalFormula(v, s.rows) : v));
      const ws = XLSX.utils.aoa_to_sheet(out.length ? out : [[""]]);
      XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31));
    }
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([buf], { type: MIME.xlsx });
  };

  const download = async () => {
    const blob = await buildXlsx();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`; a.click();
  };
  const exportCsv = () => {
    const rows = sheets[active].rows.map(r => r.map(v => v.startsWith("=") ? evalFormula(v, sheets[active].rows) : v));
    while (rows.length && rows[rows.length - 1].every(c => c === "")) rows.pop();
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = fileName.replace(/\.[^.]+$/, "") + ".csv"; a.click();
  };
  const doPrint = () => {
    const cur = sheets[active];
    const rows = cur.rows.map(r => r.map(v => v.startsWith("=") ? evalFormula(v, cur.rows) : v));
    while (rows.length && rows[rows.length - 1].every(c => c === "")) rows.pop();
    const win = window.open("", "_blank"); if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
      <style>@page{size:A4 landscape;margin:1cm}body{font-family:Sarabun,sans-serif;font-size:11pt}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #666;padding:4px 6px}
      th{background:#f1f5f9}</style></head><body><h3>${cur.name}</h3><table>
      ${rows.map(r => `<tr>${r.map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}</table></body></html>`);
    win.document.close(); setTimeout(() => { win.focus(); win.print(); }, 300);
  };

  const updateCell = (r: number, c: number, val: string) => {
    setSheets(prev => {
      pushHist(prev);
      const next = [...prev];
      const rows = next[active].rows.map(row => [...row]);
      // expand grid if needed
      while (rows.length <= r) rows.push(Array(rows[0]?.length ?? DEFAULT_COLS).fill(""));
      while (rows[r].length <= c) rows[r].push("");
      rows[r][c] = val;
      next[active] = { ...next[active], rows };
      return next;
    });
  };

  const setStyle = (patch: Partial<CellStyle>) => {
    setSheets(prev => {
      pushHist(prev);
      const next = [...prev];
      const styles = { ...next[active].styles };
      const k = cellKey(sel.r, sel.c);
      styles[k] = { ...styles[k], ...patch };
      next[active] = { ...next[active], styles };
      return next;
    });
  };

  const addSheet = () => {
    setSheets(prev => { pushHist(prev); return [...prev, { name: `Sheet${prev.length + 1}`, rows: emptyRows(DEFAULT_ROWS, DEFAULT_COLS), styles: {} }]; });
    setActive(sheets.length);
  };
  const removeSheet = (i: number) => {
    if (sheets.length === 1) return;
    setSheets(prev => { pushHist(prev); return prev.filter((_, idx) => idx !== i); });
    setActive(a => Math.max(0, a - (i <= a ? 1 : 0)));
  };
  const renameSheet = (i: number) => {
    const nm = prompt("ชื่อชีต", sheets[i].name); if (!nm) return;
    setSheets(prev => { pushHist(prev); const n = [...prev]; n[i] = { ...n[i], name: nm.substring(0, 31) }; return n; });
  };
  const addRow = () => setSheets(prev => {
    pushHist(prev); const next = [...prev];
    const cols = next[active].rows[0]?.length ?? DEFAULT_COLS;
    next[active] = { ...next[active], rows: [...next[active].rows, Array(cols).fill("")] };
    return next;
  });
  const addCol = () => setSheets(prev => {
    pushHist(prev); const next = [...prev];
    next[active] = { ...next[active], rows: next[active].rows.map(r => [...r, ""]) };
    return next;
  });

  const cur = sheets[active];
  const selKey = cellKey(sel.r, sel.c);
  const selStyle = cur.styles[selKey] ?? {};
  const selRaw = cur.rows[sel.r]?.[sel.c] ?? "";

  useEffect(() => { setFormulaEdit(selRaw); }, [sel.r, sel.c, active]);

  const handleKey = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === "Enter") { e.preventDefault(); setSel({ r: r + 1, c }); (document.querySelector(`[data-cell="${r + 1}:${c}"]`) as HTMLElement)?.focus(); }
    else if (e.key === "Tab") { e.preventDefault(); setSel({ r, c: c + 1 }); (document.querySelector(`[data-cell="${r}:${c + 1}"]`) as HTMLElement)?.focus(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); redo(); }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <div className="ml-auto flex items-center gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />นำเข้า</span></Button>
            </label>
            <Button variant="outline" size="sm" onClick={exportCsv}>CSV</Button>
            <Button variant="outline" size="sm" onClick={doPrint}><Printer className="w-4 h-4 mr-1" />พิมพ์</Button>
            <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด .xlsx</Button>
            <SaveToDriveButton fileId={fileId} fileName={fileName} defaultName="ตารางใหม่.xlsx"
              mimeType={MIME.xlsx} getBlob={buildXlsx}
              onSaved={(id, name) => { setFileId(id); setFileName(name); }} />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 border-t flex-wrap">
          <Button variant="ghost" size="sm" onClick={undo}><Undo className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={redo}><Redo className="w-4 h-4" /></Button>
          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={!!selStyle.bold} onPressedChange={v => setStyle({ bold: v })}><Bold className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={!!selStyle.italic} onPressedChange={v => setStyle({ italic: v })}><Italic className="w-4 h-4" /></Toggle>
          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={selStyle.align === "left"} onPressedChange={() => setStyle({ align: "left" })}><AlignLeft className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={selStyle.align === "center"} onPressedChange={() => setStyle({ align: "center" })}><AlignCenter className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={selStyle.align === "right"} onPressedChange={() => setStyle({ align: "right" })}><AlignRight className="w-4 h-4" /></Toggle>
          <Separator orientation="vertical" className="h-6" />
          <label className="flex items-center gap-1 text-xs"><Palette className="w-4 h-4" /> สีตัวอักษร
            <input type="color" value={selStyle.color ?? "#000000"} onChange={e => setStyle({ color: e.target.value })} className="w-6 h-6" />
          </label>
          <label className="flex items-center gap-1 text-xs">พื้นหลัง
            <input type="color" value={selStyle.bg ?? "#ffffff"} onChange={e => setStyle({ bg: e.target.value })} className="w-6 h-6" />
          </label>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={addRow}>+ แถว</Button>
          <Button variant="ghost" size="sm" onClick={addCol}>+ คอลัมน์</Button>
        </div>

        {/* Formula bar */}
        <div className="flex items-center gap-2 px-2 py-1 border-t bg-muted/20">
          <div className="text-xs font-mono min-w-[60px] bg-background rounded px-2 py-1 border">
            {colLabel(sel.c)}{sel.r + 1}
          </div>
          <span className="text-muted-foreground text-xs">fx</span>
          <input
            value={formulaEdit}
            onChange={e => setFormulaEdit(e.target.value)}
            onBlur={() => updateCell(sel.r, sel.c, formulaEdit)}
            onKeyDown={e => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
            className="flex-1 h-7 text-sm px-2 rounded border bg-background font-mono"
            placeholder="พิมพ์ค่า หรือ =SUM(A1:A10)"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto" onKeyDown={e => (e.ctrlKey || e.metaKey) && e.key === "z" && (e.preventDefault(), undo())}>
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">กำลังโหลด…</div>
        ) : (
          <div className="p-2">
            <table className="border-collapse text-sm bg-background">
              <thead>
                <tr>
                  <th className="w-10 bg-muted border sticky top-0 left-0 z-20" />
                  {cur.rows[0].map((_, ci) => (
                    <th key={ci} className={`min-w-24 px-2 py-1 border text-xs font-mono sticky top-0 z-10 ${ci === sel.c ? "bg-primary/20" : "bg-muted"}`}>
                      {colLabel(ci)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cur.rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className={`border text-center text-xs font-mono w-10 sticky left-0 z-10 ${ri === sel.r ? "bg-primary/20" : "bg-muted"}`}>{ri + 1}</td>
                    {row.map((v, ci) => {
                      const st = cur.styles[cellKey(ri, ci)] ?? {};
                      const isSel = sel.r === ri && sel.c === ci;
                      const display = v.startsWith("=") ? evalFormula(v, cur.rows) : v;
                      return (
                        <td key={ci} className={`border p-0 ${isSel ? "ring-2 ring-primary ring-inset" : ""}`}
                          style={{ background: st.bg }}>
                          <input
                            data-cell={cellKey(ri, ci)}
                            value={isSel ? formulaEdit : display}
                            onFocus={() => setSel({ r: ri, c: ci })}
                            onChange={e => setFormulaEdit(e.target.value)}
                            onBlur={() => updateCell(ri, ci, formulaEdit)}
                            onKeyDown={e => handleKey(e, ri, ci)}
                            className="w-full min-w-24 px-2 py-1 outline-none bg-transparent text-sm"
                            style={{
                              fontWeight: st.bold ? 700 : 400,
                              fontStyle: st.italic ? "italic" : undefined,
                              textAlign: st.align,
                              color: st.color,
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sheet tabs */}
      <div className="border-t bg-background flex items-center gap-1 p-1 overflow-x-auto">
        {sheets.map((s, i) => (
          <div key={i} className="flex items-center">
            <button
              onClick={() => setActive(i)}
              onDoubleClick={() => renameSheet(i)}
              className={`px-3 py-1 text-sm rounded ${i === active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >{s.name}</button>
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
  let s = ""; n++;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
