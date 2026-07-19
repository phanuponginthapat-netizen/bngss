import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Plus, Trash2, Play, Type, Image as ImageIcon, Square, Circle,
  Copy, ChevronUp, ChevronDown, Maximize, Layout, Bold as BoldIcon, Italic as ItalicIcon, AlignLeft, AlignCenter, AlignRight, Minus } from "lucide-react";
import pptxgen from "pptxgenjs";
import { MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { swal } from "@/lib/swal";

type ElBase = { id: string; x: number; y: number; w: number; h: number };
type Element =
  | ElBase & { type: "text"; text: string; fontSize: number; bold?: boolean; italic?: boolean; align?: "left"|"center"|"right"; color?: string; fontFamily?: string }
  | ElBase & { type: "image"; src: string }
  | ElBase & { type: "shape"; shape: "rect" | "circle" | "line"; fill: string; stroke?: string };

interface Slide { id: string; bg: string; elements: Element[]; }

const SLIDE_W = 1280;  // px preview (16:9)
const SLIDE_H = 720;
const uid = () => Math.random().toString(36).slice(2, 9);

const THEMES = [
  { name: "ขาว", bg: "#ffffff", title: "#0f172a", body: "#475569" },
  { name: "กรม", bg: "#0f172a", title: "#f8fafc", body: "#cbd5e1" },
  { name: "ฟ้า", bg: "#e0f2fe", title: "#0c4a6e", body: "#075985" },
  { name: "พีช", bg: "#fef3c7", title: "#78350f", body: "#92400e" },
  { name: "มิ้นต์", bg: "#d1fae5", title: "#064e3b", body: "#065f46" },
  { name: "ชมพู", bg: "#fce7f3", title: "#831843", body: "#9d174d" },
];

const LAYOUTS = [
  {
    name: "หน้าปก",
    make: (theme = THEMES[0]): Element[] => [
      { id: uid(), type: "shape", shape: "rect", x: 0, y: SLIDE_H - 120, w: SLIDE_W, h: 8, fill: theme.title },
      { id: uid(), type: "text", text: "ชื่อเรื่องการนำเสนอ", x: 80, y: 260, w: SLIDE_W - 160, h: 100, fontSize: 60, bold: true, align: "left", color: theme.title },
      { id: uid(), type: "text", text: "ผู้นำเสนอ • วันที่", x: 80, y: 380, w: SLIDE_W - 160, h: 50, fontSize: 24, align: "left", color: theme.body },
    ],
  },
  {
    name: "หัวข้อ+เนื้อหา",
    make: (theme = THEMES[0]): Element[] => [
      { id: uid(), type: "text", text: "หัวข้อสไลด์", x: 80, y: 60, w: SLIDE_W - 160, h: 80, fontSize: 44, bold: true, align: "left", color: theme.title },
      { id: uid(), type: "shape", shape: "rect", x: 80, y: 150, w: 80, h: 6, fill: theme.title },
      { id: uid(), type: "text", text: "• จุดที่หนึ่ง\n• จุดที่สอง\n• จุดที่สาม", x: 80, y: 200, w: SLIDE_W - 160, h: 400, fontSize: 28, align: "left", color: theme.body },
    ],
  },
  {
    name: "สองคอลัมน์",
    make: (theme = THEMES[0]): Element[] => [
      { id: uid(), type: "text", text: "หัวข้อสไลด์", x: 80, y: 60, w: SLIDE_W - 160, h: 80, fontSize: 40, bold: true, align: "left", color: theme.title },
      { id: uid(), type: "text", text: "คอลัมน์ซ้าย…", x: 80, y: 200, w: (SLIDE_W - 200) / 2, h: 400, fontSize: 22, color: theme.body },
      { id: uid(), type: "text", text: "คอลัมน์ขวา…", x: SLIDE_W / 2 + 20, y: 200, w: (SLIDE_W - 200) / 2, h: 400, fontSize: 22, color: theme.body },
    ],
  },
  {
    name: "ตัวเลขใหญ่",
    make: (theme = THEMES[0]): Element[] => [
      { id: uid(), type: "text", text: "100%", x: 80, y: 200, w: SLIDE_W - 160, h: 220, fontSize: 180, bold: true, align: "center", color: theme.title },
      { id: uid(), type: "text", text: "คำอธิบายตัวเลข", x: 80, y: 440, w: SLIDE_W - 160, h: 60, fontSize: 28, align: "center", color: theme.body },
    ],
  },
];

function makeSlide(layoutIdx = 1, theme = THEMES[0]): Slide {
  return { id: uid(), bg: theme.bg, elements: LAYOUTS[layoutIdx].make(theme) };
}

export default function SlidesEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState("สไลด์ใหม่.pptx");
  const [slides, setSlides] = useState<Slide[]>([makeSlide(0), makeSlide(1)]);
  const [active, setActive] = useState(0);
  const [selEl, setSelEl] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const cur = slides[active];
  const selected = cur?.elements.find(e => e.id === selEl);

  // Responsive scale
  useEffect(() => {
    const compute = () => {
      const el = canvasWrapRef.current; if (!el) return;
      const w = el.clientWidth - 32, h = el.clientHeight - 32;
      setScale(Math.min(w / SLIDE_W, h / SLIDE_H, 1));
    };
    compute();
    const ro = new ResizeObserver(compute); if (canvasWrapRef.current) ro.observe(canvasWrapRef.current);
    return () => ro.disconnect();
  }, [presenting]);

  // Present-mode keyboard nav
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") setActive(a => Math.min(slides.length - 1, a + 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setActive(a => Math.max(0, a - 1));
      else if (e.key === "Escape") setPresenting(false);
      else if (e.key === "Home") setActive(0);
      else if (e.key === "End") setActive(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, slides.length]);

  const updateEl = (id: string, patch: Partial<Element>) => {
    setSlides(prev => prev.map((s, i) => i === active
      ? { ...s, elements: s.elements.map(e => e.id === id ? { ...e, ...patch } as Element : e) } : s));
  };
  const removeEl = (id: string) => {
    setSlides(prev => prev.map((s, i) => i === active ? { ...s, elements: s.elements.filter(e => e.id !== id) } : s));
    setSelEl(null);
  };
  const addEl = (el: Element) => {
    setSlides(prev => prev.map((s, i) => i === active ? { ...s, elements: [...s.elements, el] } : s));
    setSelEl(el.id);
  };
  const addText = () => addEl({ id: uid(), type: "text", text: "ข้อความ", x: 200, y: 300, w: 500, h: 80, fontSize: 32, color: "#111827" });
  const addImageUrl = async () => {
    const src = prompt("URL รูปภาพ"); if (!src) return;
    addEl({ id: uid(), type: "image", src, x: 200, y: 200, w: 400, h: 300 });
  };
  const addImageFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => addEl({ id: uid(), type: "image", src: String(reader.result), x: 200, y: 200, w: 400, h: 300 });
    reader.readAsDataURL(file);
  };
  const addShape = (shape: "rect" | "circle" | "line") =>
    addEl({ id: uid(), type: "shape", shape, x: 300, y: 300, w: shape === "line" ? 400 : 200, h: shape === "line" ? 6 : 200, fill: "#3b82f6" });

  const duplicateSlide = () => {
    setSlides(prev => {
      const copy: Slide = JSON.parse(JSON.stringify(prev[active]));
      copy.id = uid(); copy.elements = copy.elements.map(e => ({ ...e, id: uid() }));
      const next = [...prev]; next.splice(active + 1, 0, copy); return next;
    });
    setActive(a => a + 1);
  };
  const moveSlide = (dir: -1 | 1) => {
    const to = active + dir; if (to < 0 || to >= slides.length) return;
    setSlides(prev => { const n = [...prev]; [n[active], n[to]] = [n[to], n[active]]; return n; });
    setActive(to);
  };
  const applyLayout = (i: number) =>
    setSlides(prev => prev.map((s, k) => k === active ? { ...s, elements: LAYOUTS[i].make(THEMES.find(t => t.bg === s.bg) ?? THEMES[0]) } : s));
  const applyTheme = (t: typeof THEMES[0]) =>
    setSlides(prev => prev.map((s, k) => k === active ? { ...s, bg: t.bg } : s));

  // Drag / resize
  const startDrag = (e: React.PointerEvent, id: string, mode: "move" | "nw" | "ne" | "sw" | "se") => {
    e.stopPropagation();
    const el = cur.elements.find(x => x.id === id); if (!el) return;
    setSelEl(id);
    const startX = e.clientX, startY = e.clientY;
    const { x, y, w, h } = el;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale, dy = (ev.clientY - startY) / scale;
      if (mode === "move") updateEl(id, { x: Math.max(0, x + dx), y: Math.max(0, y + dy) });
      else if (mode === "se") updateEl(id, { w: Math.max(20, w + dx), h: Math.max(20, h + dy) });
      else if (mode === "nw") updateEl(id, { x: x + dx, y: y + dy, w: Math.max(20, w - dx), h: Math.max(20, h - dy) });
      else if (mode === "ne") updateEl(id, { y: y + dy, w: Math.max(20, w + dx), h: Math.max(20, h - dy) });
      else if (mode === "sw") updateEl(id, { x: x + dx, w: Math.max(20, w - dx), h: Math.max(20, h + dy) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // Keyboard delete/arrows
  useEffect(() => {
    if (presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (!selEl) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeEl(selEl); }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault(); const d = e.shiftKey ? 20 : 4;
        const el = cur.elements.find(x => x.id === selEl); if (!el) return;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        updateEl(selEl, { x: el.x + dx, y: el.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const buildPptx = async (): Promise<Blob> => {
    const pres = new pptxgen();
    pres.layout = "LAYOUT_WIDE";
    const PW = 13.333, PH = 7.5;
    for (const s of slides) {
      const slide = pres.addSlide();
      slide.background = { color: s.bg.replace("#", "") };
      for (const el of s.elements) {
        const x = (el.x / SLIDE_W) * PW, y = (el.y / SLIDE_H) * PH;
        const w = (el.w / SLIDE_W) * PW, h = (el.h / SLIDE_H) * PH;
        if (el.type === "text") {
          slide.addText(el.text, {
            x, y, w, h, fontSize: el.fontSize * 0.75, bold: !!el.bold, italic: !!el.italic,
            color: (el.color ?? "#000000").replace("#", ""),
            align: el.align ?? "left", fontFace: el.fontFamily ?? "Sarabun", valign: "top",
          });
        } else if (el.type === "image") {
          try {
            if (el.src.startsWith("data:")) slide.addImage({ data: el.src, x, y, w, h });
            else slide.addImage({ path: el.src, x, y, w, h });
          } catch { /* ignore */ }
        } else if (el.type === "shape") {
          const shape = el.shape === "circle" ? pres.ShapeType.ellipse : el.shape === "line" ? pres.ShapeType.rect : pres.ShapeType.rect;
          slide.addShape(shape, { x, y, w, h, fill: { color: el.fill.replace("#", "") }, line: el.stroke ? { color: el.stroke.replace("#", "") } : undefined });
        }
      }
    }
    return await pres.write({ outputType: "blob" }) as Blob;
  };

  const download = async () => {
    try {
      const blob = await buildPptx();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = fileName.endsWith(".pptx") ? fileName : `${fileName}.pptx`; a.click();
    } catch (e: any) { swal.error("Export ไม่สำเร็จ", String(e?.message ?? e)); }
  };

  const enterPresent = async () => {
    setPresenting(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
  };
  const exitPresent = async () => {
    setPresenting(false);
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
  };

  if (presenting) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
        <div className="relative shadow-2xl"
          style={{ width: SLIDE_W, height: SLIDE_H, background: cur.bg, transform: `scale(${Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H) * 0.95})`, transformOrigin: "center" }}>
          {cur.elements.map(el => renderEl(el, false, () => {}, () => {}))}
        </div>
        <div className="absolute bottom-4 flex items-center gap-2 text-white bg-black/50 backdrop-blur rounded-full px-4 py-2">
          <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20" onClick={() => setActive(Math.max(0, active - 1))}>◀</Button>
          <span className="text-sm min-w-[60px] text-center">{active + 1} / {slides.length}</span>
          <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20" onClick={() => setActive(Math.min(slides.length - 1, active + 1))}>▶</Button>
          <Separator orientation="vertical" className="h-6 bg-white/30" />
          <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20" onClick={exitPresent}>ออก (Esc)</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-muted/30 flex flex-col">
      {/* Top */}
      <div className="bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={enterPresent}><Play className="w-4 h-4 mr-1" />นำเสนอ (F5)</Button>
            <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด .pptx</Button>
            <SaveToDriveButton fileId={fileId} fileName={fileName} defaultName="สไลด์ใหม่.pptx"
              mimeType={MIME.pptx} getBlob={buildPptx}
              onSaved={(id, name) => { setFileId(id); setFileName(name); }} />
          </div>
        </div>
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 border-t flex-wrap">
          <Button variant="ghost" size="sm" onClick={addText}><Type className="w-4 h-4 mr-1" />ข้อความ</Button>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && addImageFile(e.target.files[0])} />
            <Button variant="ghost" size="sm" asChild><span><ImageIcon className="w-4 h-4 mr-1" />รูป</span></Button>
          </label>
          <Button variant="ghost" size="sm" onClick={addImageUrl}>URL</Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={() => addShape("rect")}><Square className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => addShape("circle")}><Circle className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => addShape("line")}><Minus className="w-4 h-4" /></Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-xs text-muted-foreground">เลย์เอาต์:</span>
          {LAYOUTS.map((l, i) => (
            <Button key={i} variant="ghost" size="sm" onClick={() => applyLayout(i)}><Layout className="w-3 h-3 mr-1" />{l.name}</Button>
          ))}
          <Separator orientation="vertical" className="h-6" />
          <span className="text-xs text-muted-foreground">ธีม:</span>
          {THEMES.map(t => (
            <button key={t.name} title={t.name} onClick={() => applyTheme(t)} className="w-5 h-5 rounded border-2 border-border" style={{ background: t.bg }} />
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Slide list */}
        <aside className="w-52 border-r bg-background overflow-y-auto p-2 space-y-2">
          {slides.map((s, i) => (
            <div key={s.id} className="relative group">
              <button
                onClick={() => { setActive(i); setSelEl(null); }}
                className={`w-full aspect-video border-2 rounded overflow-hidden text-left relative ${i === active ? "border-primary shadow-md" : "border-border"}`}
                style={{ background: s.bg }}
              >
                <div className="absolute inset-0 origin-top-left" style={{ transform: `scale(${192 / SLIDE_W})`, width: SLIDE_W, height: SLIDE_H }}>
                  {s.elements.map(el => renderEl(el, false, () => {}, () => {}))}
                </div>
                <div className="absolute top-1 left-1 text-[10px] px-1 rounded bg-black/50 text-white">{i + 1}</div>
              </button>
              {slides.length > 1 && (
                <button onClick={() => { setSlides(p => p.filter((_, k) => k !== i)); setActive(a => Math.max(0, a - (i <= a ? 1 : 0))); }}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1">
            <Button size="sm" variant="outline" onClick={() => { setSlides(p => [...p, makeSlide(1)]); setActive(slides.length); }}>
              <Plus className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={duplicateSlide}><Copy className="w-3 h-3" /></Button>
            <Button size="sm" variant="outline" onClick={() => moveSlide(-1)}><ChevronUp className="w-3 h-3" /></Button>
            <Button size="sm" variant="outline" onClick={() => moveSlide(1)}><ChevronDown className="w-3 h-3" /></Button>
          </div>
        </aside>

        {/* Canvas */}
        <div ref={canvasWrapRef} className="flex-1 flex items-center justify-center overflow-hidden p-4 bg-slate-200">
          <div className="relative shadow-2xl origin-center"
            style={{ width: SLIDE_W, height: SLIDE_H, background: cur.bg, transform: `scale(${scale})` }}
            onClick={() => setSelEl(null)}>
            {cur.elements.map(el => renderEl(el, selEl === el.id,
              () => setSelEl(el.id),
              (e, mode) => startDrag(e, el.id, mode),
              (v) => updateEl(el.id, { text: v } as any)
            ))}
          </div>
        </div>

        {/* Properties */}
        <aside className="w-64 border-l bg-background overflow-y-auto p-3 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">พื้นหลังสไลด์</label>
            <Input type="color" value={cur.bg} onChange={e => setSlides(p => p.map((s, i) => i === active ? { ...s, bg: e.target.value } : s))} />
          </div>
          {!selected && <p className="text-xs text-muted-foreground">แตะที่อ็อบเจกต์เพื่อแก้ไข · ใช้ลูกศรเลื่อน · Del ลบ</p>}
          {selected?.type === "text" && (
            <>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">ข้อความ</label>
                <Textarea value={selected.text} onChange={e => updateEl(selected.id, { text: e.target.value })} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted-foreground">ขนาด</label>
                  <Input type="number" value={selected.fontSize} onChange={e => updateEl(selected.id, { fontSize: Number(e.target.value) })} /></div>
                <div><label className="text-xs text-muted-foreground">สี</label>
                  <Input type="color" value={selected.color ?? "#000000"} onChange={e => updateEl(selected.id, { color: e.target.value })} /></div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={selected.bold ? "default" : "outline"} onClick={() => updateEl(selected.id, { bold: !selected.bold })}><BoldIcon className="w-4 h-4" /></Button>
                <Button size="sm" variant={selected.italic ? "default" : "outline"} onClick={() => updateEl(selected.id, { italic: !selected.italic })}><ItalicIcon className="w-4 h-4" /></Button>
                <Button size="sm" variant={selected.align === "left" ? "default" : "outline"} onClick={() => updateEl(selected.id, { align: "left" })}><AlignLeft className="w-4 h-4" /></Button>
                <Button size="sm" variant={selected.align === "center" ? "default" : "outline"} onClick={() => updateEl(selected.id, { align: "center" })}><AlignCenter className="w-4 h-4" /></Button>
                <Button size="sm" variant={selected.align === "right" ? "default" : "outline"} onClick={() => updateEl(selected.id, { align: "right" })}><AlignRight className="w-4 h-4" /></Button>
              </div>
              <Button size="sm" variant="destructive" className="w-full" onClick={() => removeEl(selected.id)}>ลบ</Button>
            </>
          )}
          {selected?.type === "image" && (
            <>
              <Separator />
              <div><label className="text-xs text-muted-foreground">รูป (URL หรือ data:)</label>
                <Input value={selected.src} onChange={e => updateEl(selected.id, { src: e.target.value })} /></div>
              <Button size="sm" variant="destructive" className="w-full" onClick={() => removeEl(selected.id)}>ลบ</Button>
            </>
          )}
          {selected?.type === "shape" && (
            <>
              <Separator />
              <div><label className="text-xs text-muted-foreground">สีเติม</label>
                <Input type="color" value={selected.fill} onChange={e => updateEl(selected.id, { fill: e.target.value })} /></div>
              <Button size="sm" variant="destructive" className="w-full" onClick={() => removeEl(selected.id)}>ลบ</Button>
            </>
          )}
          {selected && (
            <>
              <Separator />
              <div className="grid grid-cols-4 gap-1 text-xs">
                <div><label>X</label><Input type="number" value={Math.round(selected.x)} onChange={e => updateEl(selected.id, { x: Number(e.target.value) })} /></div>
                <div><label>Y</label><Input type="number" value={Math.round(selected.y)} onChange={e => updateEl(selected.id, { y: Number(e.target.value) })} /></div>
                <div><label>W</label><Input type="number" value={Math.round(selected.w)} onChange={e => updateEl(selected.id, { w: Number(e.target.value) })} /></div>
                <div><label>H</label><Input type="number" value={Math.round(selected.h)} onChange={e => updateEl(selected.id, { h: Number(e.target.value) })} /></div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function renderEl(
  el: Element, selected: boolean,
  onSelect: () => void,
  onDrag: (e: React.PointerEvent, mode: "move" | "nw" | "ne" | "sw" | "se") => void,
  onEditText?: (v: string) => void,
) {
  const base: React.CSSProperties = {
    position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h,
    outline: selected ? "2px solid hsl(var(--primary))" : undefined,
    cursor: selected ? "move" : "pointer",
  };
  const handles = selected && onDrag !== (() => {}) ? (
    <>
      {(["nw","ne","sw","se"] as const).map(pos => (
        <div key={pos} onPointerDown={e => onDrag(e, pos)}
          className="absolute w-3 h-3 bg-primary border border-white rounded-sm z-10"
          style={{ [pos.includes("n") ? "top" : "bottom"]: -6, [pos.includes("w") ? "left" : "right"]: -6, cursor: `${pos}-resize` }} />
      ))}
    </>
  ) : null;

  if (el.type === "text") {
    return (
      <div key={el.id} style={{ ...base, fontSize: el.fontSize, fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? "italic" : undefined, color: el.color, padding: 4, whiteSpace: "pre-wrap",
        textAlign: el.align, fontFamily: el.fontFamily ?? "Sarabun, sans-serif", lineHeight: 1.3, overflow: "hidden" }}
        onPointerDown={e => { onSelect(); onDrag(e, "move"); }}
        onDoubleClick={() => onEditText && onEditText(prompt("แก้ไขข้อความ", el.text) ?? el.text)}>
        {el.text}
        {handles}
      </div>
    );
  }
  if (el.type === "image") {
    return (
      <div key={el.id} style={base} onPointerDown={e => { onSelect(); onDrag(e, "move"); }}>
        <img src={el.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
        {handles}
      </div>
    );
  }
  // shape
  const shapeStyle: React.CSSProperties = { ...base, background: el.fill, borderRadius: el.shape === "circle" ? "50%" : el.shape === "line" ? 0 : 4 };
  return (
    <div key={el.id} style={shapeStyle} onPointerDown={e => { onSelect(); onDrag(e, "move"); }}>{handles}</div>
  );
}
