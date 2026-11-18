// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { sheetsToXlsxBlob } from "@/components/office/FortuneSheetEditor";
describe("edited workbook export", () => {
  it("exports edited dense cells including zero and formulas instead of stale sparse import data", async () => {
    const blob = sheetsToXlsxBlob([{ name: "Sheet1", id: "1", celldata: [{r:0,c:0,v:{v:"old"}}], data: [[{v:"edited"},{v:0},{v:2,f:"=1+1"}]] }] as any);
    const bytes = await blob.arrayBuffer();
    const ws = XLSX.read(bytes,{type:"array"}).Sheets.Sheet1;
    expect(ws.A1.v).toBe("edited");
    expect(ws.B1.v).toBe(0);
    expect(ws.C1.f).toBe("1+1");
  });
  it("preserves merges, row heights, number formats and formulas without cached values", async () => {
    const blob = sheetsToXlsxBlob([{ name: "Data", data: [[{ v: 0, ct: { fa: "0.00" } }, { f: "=SUM(A1:A1)" }]], config: { merge: { "2_0": { r: 2, c: 0, rs: 1, cs: 2 } }, rowlen: { 0: 32 } } }] as any);
    const ws = XLSX.read(await blob.arrayBuffer(), { type: "array", cellStyles: true, cellNF: true }).Sheets.Data;
    expect(ws.A1.z).toBe("0.00");
    expect(ws.B1.f).toBe("SUM(A1:A1)");
    expect(ws["!merges"]).toEqual([{ s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }]);
    expect(ws["!rows"]?.[0].hpx).toBe(32);
  });
});