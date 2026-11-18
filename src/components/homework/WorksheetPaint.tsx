import { useEffect, useRef, useState, type PointerEvent } from "react";
import { getStroke } from "perfect-freehand";
import { Brush, Pencil, Eraser, PaintBucket, Pipette, Minus, Square, Circle, Type, Undo2, Redo2, Trash2, Maximize, Download, ImagePlus, Check, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fillPaintRegion, paintHexColor } from "@/lib/worksheetPaint";
import "./worksheetPaint.css";

type Tool = "pencil" | "brush" | "eraser" | "fill" | "picker" | "line" | "rect" | "ellipse" | "text";
const tools = [
  { id: "pencil", name: "ดินสอ", icon: Pencil }, { id: "brush", name: "แปรงทาสี", icon: Brush },
  { id: "eraser", name: "ยางลบ", icon: Eraser }, { id: "fill", name: "เทสี", icon: PaintBucket },
  { id: "picker", name: "ดูดสี", icon: Pipette }, { id: "line", name: "เส้นตรง", icon: Minus },
  { id: "rect", name: "สี่เหลี่ยม", icon: Square }, { id: "ellipse", name: "วงรี", icon: Circle },
  { id: "text", name: "ข้อความ", icon: Type },
] as const;
const colors = ["ink", "paper", "gray", "red", "orange", "yellow", "green", "teal", "blue", "violet", "pink", "brown"];
const colorNames: Record<string, string> = { ink: "ดำ", paper: "ขาว", gray: "เทา", red: "แดง", orange: "ส้ม", yellow: "เหลือง", green: "เขียว", teal: "เขียวอมฟ้า", blue: "น้ำเงิน", violet: "ม่วง", pink: "ชมพู", brown: "น้ำตาล" };
const WIDTH = 900;
const HEIGHT = 450;

export default function WorksheetPaint({ value, onChange, readOnly, label }: { value: unknown; onChange: (value: string) => void; readOnly?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="relative w-full h-full border border-primary/50 rounded bg-background/95 overflow-hidden pointer-events-none">
    {typeof value === "string" && value ? <img src={value} alt={label || "ภาพวาด"} className="w-full h-full object-fill" /> : null}
    <Button type="button" size="sm" variant="secondary" className="absolute top-1 left-1 h-8 px-2 pointer-events-auto" title="เปิดหน้าวาดเต็มจอ" aria-label="เปิดหน้าวาดเต็มจอ" onClick={() => setOpen(true)}><Maximize /><span className="hidden sm:inline">{readOnly ? "ดูภาพ" : "วาดภาพ"}</span></Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined} className="w-full max-w-none h-[100dvh] sm:h-[100dvh] sm:max-h-[100dvh] sm:rounded-none rounded-none p-0 sm:p-0 sm:pt-0 sm:pb-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="border-b px-4 py-3 pr-14 shrink-0"><DialogTitle className="text-left leading-snug">{label || "วาดภาพ"}</DialogTitle></DialogHeader>
        {open && <PaintEditor value={typeof value === "string" ? value : ""} onChange={onChange} readOnly={readOnly} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  </div>;
}

function PaintEditor({ value, onChange, readOnly, onClose }: { value: string; onChange: (v: string) => void; readOnly?: boolean; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const initialValue = useRef(value);
  const points = useRef<number[][]>([]);
  const before = useRef<ImageData | null>(null);
  const drawing = useRef(false);
  const loading = useRef(true);
  const history = useRef<ImageData[]>([]);
  const cursor = useRef(0);
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("");
  const [size, setSize] = useState(8);
  const [opacity, setOpacity] = useState(100);
  const [filled, setFilled] = useState(false);
  const [text, setText] = useState("");
  const [zoom, setZoom] = useState(100);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncHistory = () => setHistoryState({ undo: cursor.current > 0, redo: cursor.current < history.current.length - 1 });
  const snapshot = () => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    history.current = history.current.slice(0, cursor.current + 1);
    history.current.push(ctx.getImageData(0, 0, WIDTH, HEIGHT));
    if (history.current.length > 30) history.current.shift();
    cursor.current = history.current.length - 1;
    syncHistory();
  };
  const publish = () => {
    const c = canvas.current;
    if (!c) return;
    try { onChange(c.toDataURL("image/png")); setError(null); }
    catch { setError("เก็บภาพวาดไม่สำเร็จ กรุณาลองใหม่"); }
  };
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d", { willReadFrequently: true });
    if (!c || !ctx) return;
    let active = true;
    const cssColor = getComputedStyle(c).getPropertyValue("--paint-ink").trim();
    setColor(cssColor);
    const finish = () => { if (active) { snapshot(); loading.current = false; setReady(true); } };
    if (initialValue.current) {
      const img = new Image();
      img.onload = () => { if (active) { ctx.drawImage(img, 0, 0, WIDTH, HEIGHT); finish(); } };
      img.onerror = () => { if (active) setError("เปิดภาพเดิมไม่สำเร็จ กรุณาปิดแล้วลองใหม่"); };
      img.src = initialValue.current;
    } else finish();
    return () => { active = false; };
  }, []);

  const position = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return [Math.max(0, Math.min(WIDTH - 1, (e.clientX - r.left) * WIDTH / r.width)), Math.max(0, Math.min(HEIGHT - 1, (e.clientY - r.top) * HEIGHT / r.height)), e.pointerType === "pen" ? e.pressure : 0.5];
  };
  const render = () => {
    const ctx = canvas.current?.getContext("2d");
    const start = points.current[0];
    const end = points.current[points.current.length - 1];
    if (!ctx || !before.current || !start || !end) return;
    ctx.putImageData(before.current, 0, 0);
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (tool === "brush" || tool === "pencil" || tool === "eraser") {
      if (tool === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.globalAlpha = 1; }
      const stroke = getStroke(points.current, { size: tool === "pencil" ? Math.max(1, size / 3) : size, thinning: tool === "brush" ? 0.5 : 0, smoothing: 0.6, simulatePressure: points.current.every(p => p[2] === 0.5) });
      ctx.beginPath();
      stroke.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      if (tool === "line") { ctx.moveTo(start[0], start[1]); ctx.lineTo(end[0], end[1]); }
      if (tool === "rect") ctx.rect(start[0], start[1], end[0] - start[0], end[1] - start[1]);
      if (tool === "ellipse") ctx.ellipse((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, Math.abs(end[0] - start[0]) / 2, Math.abs(end[1] - start[1]) / 2, 0, 0, Math.PI * 2);
      if (filled && tool !== "line") ctx.fill(); else ctx.stroke();
    }
    ctx.restore();
  };
  const endStroke = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    if (canvas.current?.hasPointerCapture(e.pointerId)) canvas.current.releasePointerCapture(e.pointerId);
    snapshot(); publish();
  };
  const stepHistory = (delta: number) => {
    if (drawing.current) return;
    const next = cursor.current + delta;
    const image = history.current[next];
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !image) return;
    cursor.current = next; ctx.putImageData(image, 0, 0); syncHistory(); publish();
  };
  const iconButton = (name: string, Icon: typeof Brush, action: () => void, disabled = false) => <Button type="button" variant="ghost" size="icon" title={name} aria-label={name} disabled={disabled} onClick={action}><Icon /></Button>;

  return <>
    <div className="border-b bg-background shrink-0 p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {!readOnly && tools.map(t => <Button key={t.id} type="button" variant={tool === t.id ? "default" : "ghost"} size="icon" title={t.name} aria-label={t.name} aria-pressed={tool === t.id} disabled={!ready} onClick={() => setTool(t.id)}><t.icon /></Button>)}
        {!readOnly && <>
          <span className="h-7 border-l mx-1" />
          {iconButton("เลิกทำ", Undo2, () => stepHistory(-1), !historyState.undo)}
          {iconButton("ทำซ้ำ", Redo2, () => stepHistory(1), !historyState.redo)}
          {iconButton("ล้างภาพ", Trash2, () => { canvas.current?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT); snapshot(); publish(); }, !ready)}
          {iconButton("เพิ่มรูปภาพ", ImagePlus, () => fileInput.current?.click(), !ready)}
        </>}
        {iconButton("ดาวน์โหลดภาพ", Download, () => {
          const c = canvas.current; if (!c) return;
          const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "ภาพวาดใบงาน.png"; a.click();
        }, !ready)}
      </div>
      {!readOnly && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {colors.map(c => <Button key={c} type="button" size="icon" variant="outline" className="h-7 w-7 shrink-0 p-0 worksheet-paint-swatch" style={{ "--paint-swatch": `var(--paint-${c})` } as React.CSSProperties} title={`สี${colorNames[c]}`} aria-label={`สี${colorNames[c]}`} onClick={() => { const el = canvas.current; if (el) setColor(getComputedStyle(el).getPropertyValue(`--paint-${c}`).trim()); }} />)}
          {color && <input type="color" aria-label="เลือกสี" title="เลือกสี" value={color} onChange={e => setColor(e.target.value)} className="w-9 h-8 shrink-0 cursor-pointer bg-background border rounded" />}
        </div>
        <label className="flex items-center gap-2 text-xs">ขนาด <Slider aria-label="ขนาดแปรง" className="w-24" min={1} max={60} value={[size]} onValueChange={v => setSize(v[0])} /><span className="w-6 tabular-nums">{size}</span></label>
        <label className="flex items-center gap-2 text-xs">ความทึบ <Slider aria-label="ความทึบ" className="w-20" min={10} max={100} value={[opacity]} onValueChange={v => setOpacity(v[0])} /><span className="w-8 tabular-nums">{opacity}%</span></label>
        {(tool === "rect" || tool === "ellipse") && <Button type="button" size="sm" variant={filled ? "default" : "outline"} aria-pressed={filled} onClick={() => setFilled(v => !v)}><PaintBucket />เติมสีรูปทรง</Button>}
        {tool === "text" && <Input aria-label="ข้อความที่จะใส่" placeholder="ข้อความ" value={text} onChange={e => setText(e.target.value)} className="w-48 h-9" />}
      </div>}
    </div>
    <div className="flex-1 min-h-0 overflow-auto bg-muted p-3 sm:p-6">
      <div className="mx-auto" style={{ width: `${zoom}%`, maxWidth: WIDTH * zoom / 100, minWidth: 280 }}>
        <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="พื้นที่วาดภาพ" className="worksheet-paint-paper w-full h-auto shadow border touch-none cursor-crosshair" onPointerDown={e => {
          if (readOnly || loading.current || drawing.current || (e.pointerType === "mouse" && e.button !== 0)) return;
          const c = canvas.current; const ctx = c?.getContext("2d"); const p = position(e);
          if (!c || !ctx || !p) return;
          e.preventDefault();
          if (tool === "picker") { const rgba = ctx.getImageData(p[0], p[1], 1, 1).data; if (rgba[3]) setColor(`#${Array.from(rgba.slice(0, 3)).map(v => v.toString(16).padStart(2, "0")).join("")}`); return; }
          if (tool === "fill") { const img = ctx.getImageData(0, 0, WIDTH, HEIGHT); if (fillPaintRegion(img.data, WIDTH, HEIGHT, p[0], p[1], paintHexColor(color, opacity))) { ctx.putImageData(img, 0, 0); snapshot(); publish(); } return; }
          if (tool === "text") { if (!text.trim()) { toast.error("พิมพ์ข้อความก่อนวางบนภาพ"); return; } ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = opacity / 100; ctx.font = `${Math.max(16, size * 3)}px sans-serif`; ctx.fillText(text, p[0], p[1]); ctx.restore(); snapshot(); publish(); return; }
          c.setPointerCapture(e.pointerId); before.current = ctx.getImageData(0, 0, WIDTH, HEIGHT); points.current = [p]; drawing.current = true; render();
        }} onPointerMove={e => { if (!drawing.current) return; const p = position(e); if (p) { points.current.push(p); render(); } }} onPointerUp={endStroke} onPointerCancel={endStroke} />
      </div>
      {error && <p role="alert" className="text-destructive text-sm mt-2">{error}</p>}
    </div>
    <div className="flex items-center justify-between gap-2 border-t bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shrink-0">
      <div className="flex items-center gap-1">
        {iconButton("ย่อภาพวาด", ZoomOut, () => setZoom(v => v - 25), zoom <= 50)}
        <span className="text-xs tabular-nums w-10 text-center">{zoom}%</span>
        {iconButton("ขยายภาพวาด", ZoomIn, () => setZoom(v => v + 25), zoom >= 300)}
      </div>
      <Button type="button" disabled={!ready} onClick={onClose}><Check />{readOnly ? "ปิดภาพ" : "ใช้ภาพนี้"}</Button>
    </div>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => {
      const file = e.target.files?.[0]; e.target.value = "";
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast.error("รูปภาพต้องไม่เกิน 10MB"); return; }
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => { const ctx = canvas.current?.getContext("2d"); if (ctx) { const scale = Math.min(WIDTH / img.width, HEIGHT / img.height); ctx.drawImage(img, (WIDTH - img.width * scale) / 2, (HEIGHT - img.height * scale) / 2, img.width * scale, img.height * scale); snapshot(); publish(); } URL.revokeObjectURL(url); };
      img.onerror = () => { URL.revokeObjectURL(url); toast.error("เปิดรูปภาพไม่สำเร็จ"); }; img.src = url;
    }} />
  </>;
}