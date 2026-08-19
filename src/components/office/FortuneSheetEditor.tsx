import { forwardRef, useImperativeHandle, useMemo, useRef, useEffect } from "react";
import { Workbook } from "@fortune-sheet/react";
import type { Sheet } from "@fortune-sheet/core";
import "@fortune-sheet/react/dist/index.css";
import * as XLSX from "xlsx";

export interface FortuneSheetHandle {
  /** Return .xlsx Blob assembled from current state (SheetJS). */
  exportXlsx: () => Promise<Blob>;
  /** Return all sheet data as FortuneSheet objects. */
  getSheets: () => Sheet[];
  /** Replace all sheets. */
  setSheets: (sheets: Sheet[]) => void;
  /** Load .xlsx buffer and replace sheets. */
  loadXlsx: (data: ArrayBuffer | Uint8Array) => void;
}

interface Props {
  initialSheets?: Sheet[];
  onChange?: (sheets: Sheet[]) => void;
  className?: string;
}

/** Convert SheetJS workbook → FortuneSheet Sheet[]. */
export function workbookToSheets(data: ArrayBuffer | Uint8Array): Sheet[] {
  const wb = XLSX.read(data, { type: "array", cellStyles: true, cellNF: true });
  return wb.SheetNames.map((name, idx) => {
    const ws = wb.Sheets[name];
    const ref = ws["!ref"] ?? "A1";
    const range = XLSX.utils.decode_range(ref);
    const celldata: any[] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        celldata.push({
          r,
          c,
          v: {
            v: cell.v,
            m: cell.w ?? String(cell.v ?? ""),
            ct: { fa: "General", t: cell.t === "n" ? "n" : cell.t === "b" ? "b" : "s" },
            f: cell.f ? `=${cell.f}` : undefined,
          },
        });
      }
    }
    // Column widths
    const columnlen: Record<number, number> = {};
    (ws["!cols"] ?? []).forEach((col: any, i: number) => {
      if (col?.wpx) columnlen[i] = col.wpx;
      else if (col?.wch) columnlen[i] = Math.round(col.wch * 7);
    });
    const rowlen: Record<number, number> = {};
    (ws["!rows"] ?? []).forEach((row: any, i: number) => {
      if (row?.hpx) rowlen[i] = row.hpx;
    });
    return {
      name,
      id: `sheet_${idx}_${idx}`,
      order: idx,
      status: idx === 0 ? 1 : 0,
      celldata,
      row: Math.max(100, range.e.r + 20),
      column: Math.max(30, range.e.c + 5),
      config: { columnlen, rowlen },
    } as unknown as Sheet;
  });
}

/** Convert FortuneSheet Sheet[] → .xlsx Blob via SheetJS. */
export function sheetsToXlsxBlob(sheets: Sheet[]): Blob {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws: any = {};
    const celldata: any[] = (s as any).celldata ?? [];
    let maxR = 0;
    let maxC = 0;
    for (const cell of celldata) {
      const v = cell.v?.v;
      if (v === undefined || v === null) continue;
      const addr = XLSX.utils.encode_cell({ r: cell.r, c: cell.c });
      const t = typeof v === "number" ? "n" : typeof v === "boolean" ? "b" : "s";
      if (t === "s" && v === "") continue;
      ws[addr] = { v, t };
      const f = cell.v?.f;
      if (typeof f === "string" && f.startsWith("=")) ws[addr].f = f.slice(1);
      maxR = Math.max(maxR, cell.r);
      maxC = Math.max(maxC, cell.c);
    }
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    const cols: any[] = [];
    const columnlen: Record<string, number> = ((s as any).config?.columnlen ?? {}) as any;
    for (const [k, v] of Object.entries(columnlen)) cols[+k] = { wpx: v };
    if (cols.length) ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, (s.name ?? "Sheet1").substring(0, 31));
  }
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export const FortuneSheetEditor = forwardRef<FortuneSheetHandle, Props>(function FortuneSheetEditor(
  { initialSheets, onChange, className },
  ref,
) {
  // Workbook is uncontrolled — we drive it via ref + `data` prop keyed on load id.
  const wbRef = useRef<any>(null);
  const dataRef = useRef<Sheet[]>(
    initialSheets && initialSheets.length
      ? initialSheets
      : ([{ name: "Sheet1", id: "sheet_0", order: 0, status: 1, celldata: [], row: 100, column: 26 } as unknown as Sheet]),
  );
  // key remount when initialSheets identity changes
  const key = useMemo(() => Math.random().toString(36).slice(2), [initialSheets]);

  useImperativeHandle(ref, () => ({
    getSheets: () => (wbRef.current?.getAllSheets?.() as Sheet[]) ?? dataRef.current,
    setSheets: (sheets) => {
      dataRef.current = sheets;
      // Setting via ref is limited; consumer should key-remount via prop.
    },
    loadXlsx: (data) => {
      dataRef.current = workbookToSheets(data);
    },
    exportXlsx: async () => {
      const s = (wbRef.current?.getAllSheets?.() as Sheet[]) ?? dataRef.current;
      return sheetsToXlsxBlob(s);
    },
  }));

  useEffect(() => {
    if (initialSheets) dataRef.current = initialSheets;
  }, [initialSheets]);

  return (
    <div className={className ?? "w-full h-[calc(100vh-220px)]"}>
      <Workbook
        key={key}
        ref={wbRef}
        data={dataRef.current as any}
        lang="zh" // FortuneSheet ships zh/en — zh is closer to MS Excel button layout
        onChange={(sheets) => {
          dataRef.current = sheets as Sheet[];
          onChange?.(sheets as Sheet[]);
        }}
      />
    </div>
  );
});
