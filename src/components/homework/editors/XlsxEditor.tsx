import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Plus, Minus } from "lucide-react";
import { downloadHomeworkBlob, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";

interface Props {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

type SheetData = { name: string; data: any[][] };

const colName = (n: number) => {
  let s = "";
  n += 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

export default function XlsxEditor({ open, attachment, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!open || !attachment) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const XLSX: any = await import("xlsx");
        const blob = await downloadHomeworkBlob(attachment.path);
        const buf = await blob.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellFormula: true });
        const out: SheetData[] = wb.SheetNames.map((n: string) => {
          const ws = wb.Sheets[n];
          const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as any[][];
          // ensure at least 20 rows x 8 cols
          const rows = Math.max(arr.length, 20);
          const cols = Math.max(arr.reduce((m, r) => Math.max(m, r.length), 0), 8);
          const data: any[][] = [];
          for (let r = 0; r < rows; r++) {
            const row: any[] = [];
            for (let c = 0; c < cols; c++) row.push(arr[r]?.[c] ?? "");
            data.push(row);
          }
          return { name: n, data };
        });
        if (!cancelled) {
          setSheets(out.length ? out : [{ name: "Sheet1", data: Array.from({ length: 20 }, () => Array(8).fill("")) }]);
          setActiveIdx(0);
        }
      } catch (e: any) {
        console.error(e);
        toast.error("เปิดไฟล์ Excel ไม่สำเร็จ: " + (e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, attachment?.id]);

  const active = sheets[activeIdx];

  const setCell = (r: number, c: number, v: string) => {
    setSheets((prev) => prev.map((s, i) => {
      if (i !== activeIdx) return s;
      const data = s.data.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? v : cell) : row);
      return { ...s, data };
    }));
  };

  const addRow = () => setSheets((p) => p.map((s, i) => i === activeIdx ? { ...s, data: [...s.data, Array(s.data[0]?.length || 8).fill("")] } : s));
  const addCol = () => setSheets((p) => p.map((s, i) => i === activeIdx ? { ...s, data: s.data.map((r) => [...r, ""]) } : s));
  const delRow = () => setSheets((p) => p.map((s, i) => i === activeIdx && s.data.length > 1 ? { ...s, data: s.data.slice(0, -1) } : s));
  const delCol = () => setSheets((p) => p.map((s, i) => i === activeIdx && (s.data[0]?.length || 0) > 1 ? { ...s, data: s.data.map((r) => r.slice(0, -1)) } : s));

  const handleSave = async () => {
    if (!attachment) return;
    setSaving(true);
    try {
      const XLSX: any = await import("xlsx");
      const wb = XLSX.utils.book_new();
      sheets.forEach((s) => {
        const aoa = s.data.map((row) => row.map((cell) => {
          if (typeof cell === "string" && cell.startsWith("=")) return { f: cell.slice(1) };
          if (cell === "" || cell == null) return "";
          const num = Number(cell);
          return !isNaN(num) && cell !== "" && /^-?\d+(\.\d+)?$/.test(String(cell)) ? num : cell;
        }));
        const ws = XLSX.utils.aoa_to_sheet([]);
        aoa.forEach((row, r) => row.forEach((cell, c) => {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (cell && typeof cell === "object" && "f" in cell) ws[addr] = { t: "n", f: (cell as any).f };
          else if (cell !== "") ws[addr] = { t: typeof cell === "number" ? "n" : "s", v: cell };
        }));
        const lastRow = aoa.length - 1, lastCol = (aoa[0]?.length || 1) - 1;
        ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
        XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
      });
      const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([arr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const baseName = attachment.name.replace(/\.[^.]+$/, "");
      await onSave(blob, `${baseName}_edited.xlsx`);
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="truncate">แก้ไข Excel: {attachment?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          <div className="flex flex-wrap gap-1">
            {sheets.map((s, i) => (
              <Button key={i} size="sm" variant={i === activeIdx ? "default" : "outline"} onClick={() => setActiveIdx(i)}>{s.name}</Button>
            ))}
          </div>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="w-3.5 h-3.5 mr-1" />แถว</Button>
            <Button size="sm" variant="outline" onClick={delRow}><Minus className="w-3.5 h-3.5 mr-1" />แถว</Button>
            <Button size="sm" variant="outline" onClick={addCol}><Plus className="w-3.5 h-3.5 mr-1" />คอลัมน์</Button>
            <Button size="sm" variant="outline" onClick={delCol}><Minus className="w-3.5 h-3.5 mr-1" />คอลัมน์</Button>
          </div>
        </div>

        <div className="overflow-auto max-h-[60vh] border rounded">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />กำลังโหลด...</div>
          ) : active ? (
            <table className="text-xs border-collapse w-max">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  <th className="w-10 border px-1 py-0.5"></th>
                  {active.data[0]?.map((_, c) => <th key={c} className="border px-2 py-0.5 min-w-[100px] text-center font-medium">{colName(c)}</th>)}
                </tr>
              </thead>
              <tbody>
                {active.data.map((row, r) => (
                  <tr key={r}>
                    <td className="border px-1 py-0.5 text-center bg-muted text-muted-foreground sticky left-0">{r + 1}</td>
                    {row.map((cell, c) => (
                      <td key={c} className="border p-0">
                        <input
                          className="w-full px-1.5 py-1 outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary"
                          value={cell == null ? "" : String(cell)}
                          onChange={(e) => setCell(r, c, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">เริ่มด้วย <code>=</code> เพื่อใส่สูตร (จะคำนวณตอนเปิดใน Excel)</p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            บันทึก & แนบกลับ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
