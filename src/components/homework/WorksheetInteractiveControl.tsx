import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { WorksheetField } from "@/lib/pdfWorksheet";

export default function WorksheetInteractiveControl({ field, value, onChange, readOnly }: { field: WorksheetField; value: unknown; onChange: (value: unknown) => void; readOnly?: boolean }) {
  const values: unknown[] = Array.isArray(value) ? value : [];
  const options = field.options || [];
  const selectClass = "w-full min-w-0 rounded border border-input bg-background text-foreground p-1 text-sm";
  if (field.type === "number") return <Input aria-label={field.label || "คำตอบตัวเลข"} type="number" step="any" className="w-full h-full bg-background/95" value={String(value ?? "")} disabled={readOnly} onChange={e => onChange(e.target.value)} />;
  if (field.type === "select") return <select aria-label={field.label || "เลือกคำตอบ"} className={`${selectClass} h-full`} disabled={readOnly} value={value === undefined || value === null ? "" : String(value)} onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}><option value="">เลือกคำตอบ</option>{options.map((opt, i) => <option key={i} value={i}>{opt}</option>)}</select>;
  if (field.type === "multiselect") return <div className="w-full h-full overflow-auto bg-background/95 border border-primary/50 rounded p-2 space-y-2">{options.map((opt, i) => <label key={i} className="flex gap-2 items-start text-sm"><Checkbox disabled={readOnly} checked={values.includes(i)} onCheckedChange={checked => onChange(checked ? [...values, i] : values.filter(v => v !== i))} /><span className="break-words min-w-0">{opt}</span></label>)}</div>;
  if (field.type === "match") {
    // Stable reverse order avoids revealing the answer while retaining saved indices.
    const choices = (field.pairs || []).map((pair, index) => ({ ...pair, index })).reverse();
    return <div className="w-full h-full overflow-auto bg-background/95 border border-primary/50 rounded p-2 space-y-2">{(field.pairs || []).map((pair, i) => <label key={i} className="grid grid-cols-2 gap-2 items-center text-sm"><span className="break-words min-w-0">{pair.left}</span><select aria-label={`จับคู่ ${pair.left}`} className={selectClass} disabled={readOnly} value={values[i] === undefined || values[i] === null ? "" : String(values[i])} onChange={e => { const next = Array.from({ length: field.pairs?.length ?? 0 }, (_, index) => values[index] ?? null); next[i] = e.target.value === "" ? null : Number(e.target.value); onChange(next); }}><option value="">เลือกคู่</option>{choices.map(pair => <option key={pair.index} value={pair.index}>{pair.right}</option>)}</select></label>)}</div>;
  }
  if (field.type === "order") {
    const order: number[] = values.length === options.length && values.every(v => Number.isInteger(v)) ? values as number[] : options.map((_, i) => i).reverse();
    const move = (from: number, to: number) => { const next = [...order]; [next[from], next[to]] = [next[to], next[from]]; onChange(next); };
    return <div className="w-full h-full overflow-auto bg-background/95 border border-primary/50 rounded p-2 space-y-1">{order.map((index, position) => <div key={index} className="flex items-center gap-1 text-sm"><span className="text-muted-foreground tabular-nums">{position + 1}.</span><span className="min-w-0 flex-1 break-words">{options[index]}</span><Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`เลื่อน ${options[index]} ขึ้น`} title="เลื่อนขึ้น" disabled={readOnly || position === 0} onClick={() => move(position, position - 1)}><ArrowUp className="h-3 w-3" /></Button><Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`เลื่อน ${options[index]} ลง`} title="เลื่อนลง" disabled={readOnly || position === order.length - 1} onClick={() => move(position, position + 1)}><ArrowDown className="h-3 w-3" /></Button></div>)}{!readOnly && <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => onChange(order)}>ยืนยันลำดับ</Button>}</div>;
  }
  return null;
}