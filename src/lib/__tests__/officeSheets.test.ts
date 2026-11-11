import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { sheetsToXlsxBlob } from "@/components/office/FortuneSheetEditor";
describe("edited workbook export", () => {
  it("exports edited dense cells including zero and formulas instead of stale sparse import data", async () => {
    const blob = sheetsToXlsxBlob([{ name: "Sheet1", id: "1", celldata: [{r:0,c:0,v:{v:"old"}}], data: [[{v:"edited"},{v:0},{v:2,f:"=1+1"}]] }] as any);
    const bytes = await new Promise<ArrayBuffer>((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result as ArrayBuffer); r.onerror=reject; r.readAsArrayBuffer(blob); });
    const ws = XLSX.read(bytes,{type:"array"}).Sheets.Sheet1;
    expect(ws.A1.v).toBe("edited");
    expect(ws.B1.v).toBe(0);
    expect(ws.C1.f).toBe("1+1");
  });
});