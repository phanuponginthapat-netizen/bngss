import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Plus, Trash2, Play, Type, Image as ImageIcon } from "lucide-react";
import pptxgen from "pptxgenjs";
import { MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { swal } from "@/lib/swal";

type Element =
  | { id: string; type: "text"; text: string; x: number; y: number; w: number; h: number; fontSize: number; bold?: boolean; color?: string }
  | { id: string; type: "image"; src: string; x: number; y: number; w: number; h: number };

interface Slide {
  id: string;
  bg: string;
  elements: Element[];
}

const SLIDE_W = 960;  // px preview (16:9)
const SLIDE_H = 540;

const uid = () => Math.random().toString(36).slice(2, 9);

function newSlide(): Slide {
  return {
    id: uid(),
    bg: "#ffffff",
    elements: [
      { id: uid(), type: "text", text: "หัวข้อสไลด์", x: 60, y: 60, w: 840, h: 80, fontSize: 44, bold: true, color: "#1e293b" },
      { id: uid(), type: "text", text: "คำอธิบาย…", x: 60, y: 180, w: 840, h: 300, fontSize: 24, color: "#475569" },
    ],
  };
}

export default function SlidesEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState("สไลด์ใหม่.pptx");
  const [slides, setSlides] = useState<Slide[]>([newSlide()]);
  const [active, setActive] = useState(0);
  const [selEl, setSelEl] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

  const cur = slides[active];
  const selected = cur?.elements.find(e => e.id === selEl);

  const update = (patch: Partial<Slide>) => {
    setSlides(prev => prev.map((s, i) => i === active ? { ...s, ...patch } : s));
  };
  const updateEl = (id: string, patch: Partial<Element>) => {
    setSlides(prev => prev.map((s, i) => i === active
      ? { ...s, elements: s.elements.map(e => e.id === id ? { ...e, ...patch } as Element : e) }
      : s));
  };
  const removeEl = (id: string) => {
    setSlides(prev => prev.map((s, i) => i === active
      ? { ...s, elements: s.elements.filter(e => e.id !== id) } : s));
    setSelEl(null);
  };
  const addText = () => {
    const el: Element = { id: uid(), type: "text", text: "ข้อความใหม่", x: 100, y: 200, w: 400, h: 60, fontSize: 24, color: "#000000" };
    setSlides(prev => prev.map((s, i) => i === active ? { ...s, elements: [...s.elements, el] } : s));
    setSelEl(el.id);
  };
  const addImage = () => {
    const src = prompt("URL รูปภาพ");
    if (!src) return;
    const el: Element = { id: uid(), type: "image", src, x: 100, y: 150, w: 300, h: 200 };
    setSlides(prev => prev.map((s, i) => i === active ? { ...s, elements: [...s.elements, el] } : s));
    setSelEl(el.id);
  };

  const buildPptx = async (): Promise<Blob> => {
    const pres = new pptxgen();
    pres.layout = "LAYOUT_WIDE";  // 13.333 x 7.5 inches
    const PW = 13.333, PH = 7.5;
    for (const s of slides) {
      const slide = pres.addSlide();
      slide.background = { color: s.bg.replace("#", "") };
      for (const el of s.elements) {
        const x = (el.x / SLIDE_W) * PW;
        const y = (el.y / SLIDE_H) * PH;
        const w = (el.w / SLIDE_W) * PW;
        const h = (el.h / SLIDE_H) * PH;
        if (el.type === "text") {
          slide.addText(el.text, {
            x, y, w, h,
            fontSize: el.fontSize * 0.75, // px→pt approx
            bold: !!el.bold,
            color: (el.color ?? "#000000").replace("#", ""),
          });
        } else if (el.type === "image") {
          try {
            slide.addImage({ path: el.src, x, y, w, h });
          } catch { /* skip */ }
        }
      }
    }
    const blob = await pres.write({ outputType: "blob" }) as Blob;
    return blob;
  };

  const download = async () => {
    try {
      const blob = await buildPptx();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName.endsWith(".pptx") ? fileName : `${fileName}.pptx`;
      a.click();
    } catch (e: any) {
      swal.error("Export ไม่สำเร็จ", String(e?.message ?? e));
    }
  };

  if (presenting) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative shadow-2xl" style={{ width: SLIDE_W, height: SLIDE_H, background: cur.bg, maxWidth: "90vw", maxHeight: "90vh", aspectRatio: "16/9" }}>
            {cur.elements.map(el => renderEl(el, false, () => {}))}
          </div>
        </div>
        <div className="text-center text-white p-4 space-x-2">
          <Button variant="secondary" size="sm" onClick={() => setActive(Math.max(0, active - 1))}>◀ ก่อนหน้า</Button>
          <span className="text-sm">{active + 1} / {slides.length}</span>
          <Button variant="secondary" size="sm" onClick={() => setActive(Math.min(slides.length - 1, active + 1))}>ถัดไป ▶</Button>
          <Button variant="destructive" size="sm" onClick={() => setPresenting(false)}>ออก</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={addText}><Type className="w-4 h-4 mr-1" />ข้อความ</Button>
          <Button variant="ghost" size="sm" onClick={addImage}><ImageIcon className="w-4 h-4 mr-1" />รูป</Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPresenting(true)}><Play className="w-4 h-4 mr-1" />นำเสนอ</Button>
            <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด</Button>
            <SaveToDriveButton
              fileId={fileId}
              fileName={fileName}
              defaultName="สไลด์ใหม่.pptx"
              mimeType={MIME.pptx}
              getBlob={buildPptx}
              onSaved={(id, name) => { setFileId(id); setFileName(name); }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Slide list */}
        <aside className="w-48 border-r bg-background overflow-y-auto p-2 space-y-2">
          {slides.map((s, i) => (
            <div key={s.id} className="relative">
              <button
                onClick={() => { setActive(i); setSelEl(null); }}
                className={`w-full aspect-video border-2 rounded overflow-hidden text-left ${i === active ? "border-primary" : "border-border"}`}
                style={{ background: s.bg }}
              >
                <div className="text-[8px] p-1 text-slate-600 truncate">{i + 1}. {(s.elements[0] as any)?.text ?? ""}</div>
              </button>
              {slides.length > 1 && (
                <button
                  onClick={() => { setSlides(p => p.filter((_, k) => k !== i)); setActive(a => Math.max(0, a - (i <= a ? 1 : 0))); }}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full" onClick={() => { setSlides(p => [...p, newSlide()]); setActive(slides.length); }}>
            <Plus className="w-4 h-4 mr-1" />เพิ่มสไลด์
          </Button>
        </aside>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4">
          <div
            className="relative shadow-lg border"
            style={{ width: SLIDE_W, height: SLIDE_H, background: cur.bg, transform: "scale(min(1, calc((100vw - 400px) / 960)))", transformOrigin: "center" }}
            onClick={() => setSelEl(null)}
          >
            {cur.elements.map(el => renderEl(el, selEl === el.id, () => setSelEl(el.id)))}
          </div>
        </div>

        {/* Properties */}
        <aside className="w-64 border-l bg-background overflow-y-auto p-3 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">พื้นหลัง</label>
            <Input type="color" value={cur.bg} onChange={e => update({ bg: e.target.value })} />
          </div>
          {selected && selected.type === "text" && (
            <>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">ข้อความ</label>
                <Textarea value={selected.text} onChange={e => updateEl(selected.id, { text: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">ขนาด</label>
                  <Input type="number" value={selected.fontSize} onChange={e => updateEl(selected.id, { fontSize: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">สี</label>
                  <Input type="color" value={selected.color ?? "#000000"} onChange={e => updateEl(selected.id, { color: e.target.value })} />
                </div>
              </div>
              <Button size="sm" variant={selected.bold ? "default" : "outline"} onClick={() => updateEl(selected.id, { bold: !selected.bold })}>Bold</Button>
              <Button size="sm" variant="destructive" className="w-full" onClick={() => removeEl(selected.id)}>ลบ</Button>
            </>
          )}
          {selected && selected.type === "image" && (
            <>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">URL รูป</label>
                <Input value={selected.src} onChange={e => updateEl(selected.id, { src: e.target.value })} />
              </div>
              <Button size="sm" variant="destructive" className="w-full" onClick={() => removeEl(selected.id)}>ลบ</Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function renderEl(el: Element, selected: boolean, onClick: () => void) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: el.x, top: el.y, width: el.w, height: el.h,
    outline: selected ? "2px solid hsl(var(--primary))" : undefined,
    cursor: "pointer",
  };
  if (el.type === "text") {
    return (
      <div key={el.id} style={{ ...style, fontSize: el.fontSize, fontWeight: el.bold ? 700 : 400, color: el.color, padding: 4, whiteSpace: "pre-wrap" }}
        onClick={e => { e.stopPropagation(); onClick(); }}>
        {el.text}
      </div>
    );
  }
  return (
    <img key={el.id} src={el.src} alt="" style={{ ...style, objectFit: "contain" }} onClick={e => { e.stopPropagation(); onClick(); }} />
  );
}
