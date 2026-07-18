import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Download, Pen, Highlighter, Type, Eraser, ChevronLeft, ChevronRight, Save, MousePointer2, Signature, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { toast } from "sonner";

type Tool = "none" | "pen" | "highlight" | "text" | "signature";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pdfBlob: Blob | null;
  filename?: string;
  onSave?: (blob: Blob, filename: string) => void | Promise<void>;
}

interface Annotation {
  page: number;
  type: "stroke" | "text";
  color: string;
  size: number;
  points?: { x: number; y: number }[]; // normalized 0-1
  text?: string;
  x?: number; y?: number;
  highlight?: boolean;
}

/**
 * PDF Viewer + Annotator (pen / highlight / text / signature) แบบ Full option
 * - แสดง PDF ด้วย pdfjs-dist
 * - วาด/เซ็น/ไฮไลต์/แทรกข้อความ บน overlay canvas
 * - บันทึก: ผนวก annotations ลงในไฟล์ PDF ใหม่ด้วย pdf-lib
 */
export default function PdfAnnotator({ open, onOpenChange, pdfBlob, filename = "annotated.pdf", onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#dc2626");
  const [size, setSize] = useState(3);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [zoom, setZoom] = useState(1.5);
  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const pdfDocRef = useRef<any>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    if (!open || !pdfBlob) return;
    setLoading(true);
    setAnnotations([]); setPageNum(1);
    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist");
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const buf = await pdfBlob.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
      } catch (e: any) {
        console.error(e); toast.error("เปิด PDF ไม่สำเร็จ: " + (e?.message || e));
      } finally { setLoading(false); }
    })();
  }, [open, pdfBlob]);

  // Render page
  useEffect(() => {
    if (!pdfDocRef.current || !pdfCanvasRef.current) return;
    (async () => {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = pdfCanvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width; canvas.height = viewport.height;
      sizeRef.current = { w: viewport.width, h: viewport.height };
      if (drawCanvasRef.current) {
        drawCanvasRef.current.width = viewport.width;
        drawCanvasRef.current.height = viewport.height;
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
      redrawOverlay();
    })();
    // eslint-disable-next-line
  }, [pageNum, annotations, zoom]);

  const redrawOverlay = () => {
    const c = drawCanvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height);
    for (const a of annotations.filter(x => x.page === pageNum)) {
      if (a.type === "stroke" && a.points) {
        ctx.strokeStyle = a.color; ctx.lineWidth = a.size; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.globalAlpha = a.highlight ? 0.35 : 1;
        ctx.beginPath();
        a.points.forEach((p, i) => {
          const x = p.x * c.width, y = p.y * c.height;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.globalAlpha = 1;
      } else if (a.type === "text" && a.text) {
        ctx.fillStyle = a.color; ctx.font = `${a.size * 6}px 'TH Sarabun New', sans-serif`;
        ctx.fillText(a.text, (a.x || 0) * c.width, (a.y || 0) * c.height);
      }
    }
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = drawCanvasRef.current!; const rect = c.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: (cx - rect.left) / rect.width, y: (cy - rect.top) / rect.height };
  };

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === "none") return;
    if (tool === "text") {
      const p = getPos(e);
      const text = window.prompt("ข้อความ"); if (!text) return;
      setAnnotations(a => [...a, { page: pageNum, type: "text", color, size, text, x: p.x, y: p.y }]);
      return;
    }
    setDrawing(true); setCurrentStroke([getPos(e)]);
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const p = getPos(e); setCurrentStroke(s => {
      const next = [...s, p];
      const c = drawCanvasRef.current; if (!c) return next;
      const ctx = c.getContext("2d")!;
      ctx.strokeStyle = color; ctx.lineWidth = tool === "highlight" ? size * 4 : size;
      ctx.globalAlpha = tool === "highlight" ? 0.35 : 1;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      const a = s[s.length - 1] || p;
      ctx.moveTo(a.x * c.width, a.y * c.height);
      ctx.lineTo(p.x * c.width, p.y * c.height);
      ctx.stroke(); ctx.globalAlpha = 1;
      return next;
    });
  };
  const onEnd = () => {
    if (!drawing) return;
    setDrawing(false);
    if (currentStroke.length > 1) {
      setAnnotations(a => [...a, {
        page: pageNum, type: "stroke", color, size: tool === "highlight" ? size * 4 : size,
        points: currentStroke, highlight: tool === "highlight",
      }]);
    }
    setCurrentStroke([]);
  };

  const clearPage = () => setAnnotations(a => a.filter(x => x.page !== pageNum));
  const clearAll = () => setAnnotations([]);

  const handleSave = async () => {
    if (!pdfBlob) return;
    setSaving(true);
    try {
      const { PDFDocument, rgb } = await import("pdf-lib");
      const buf = await pdfBlob.arrayBuffer();
      const doc = await PDFDocument.load(buf);
      for (const ann of annotations) {
        const page = doc.getPage(ann.page - 1);
        const { width, height } = page.getSize();
        const hex = ann.color.replace("#", "");
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        if (ann.type === "stroke" && ann.points && ann.points.length > 1) {
          for (let i = 1; i < ann.points.length; i++) {
            const a = ann.points[i - 1], p = ann.points[i];
            page.drawLine({
              start: { x: a.x * width, y: height - a.y * height },
              end: { x: p.x * width, y: height - p.y * height },
              thickness: ann.size / 1.5,
              color: rgb(r, g, b),
              opacity: ann.highlight ? 0.35 : 1,
            });
          }
        } else if (ann.type === "text" && ann.text) {
          page.drawText(ann.text, {
            x: (ann.x || 0) * width,
            y: height - (ann.y || 0) * height - ann.size * 6,
            size: ann.size * 6 * 0.75,
            color: rgb(r, g, b),
          });
        }
      }
      const bytes = await doc.save();
      const out = new Blob([bytes as any], { type: "application/pdf" });
      if (onSave) await onSave(out, filename);
      else {
        const url = URL.createObjectURL(out); const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      toast.success("บันทึก PDF เรียบร้อย");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e); toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-4 !flex flex-col gap-2 overflow-hidden">

        <DialogHeader><DialogTitle>แก้ไข PDF — เซ็น/ขีดเขียน/ไฮไลต์</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-center gap-1 border-b pb-2">
          <Button size="sm" variant={tool === "none" ? "default" : "outline"} onClick={() => setTool("none")}><MousePointer2 className="w-4 h-4" /></Button>
          <Button size="sm" variant={tool === "pen" ? "default" : "outline"} onClick={() => setTool("pen")}><Pen className="w-4 h-4 mr-1" />ปากกา</Button>
          <Button size="sm" variant={tool === "highlight" ? "default" : "outline"} onClick={() => setTool("highlight")}><Highlighter className="w-4 h-4 mr-1" />ไฮไลต์</Button>
          <Button size="sm" variant={tool === "text" ? "default" : "outline"} onClick={() => setTool("text")}><Type className="w-4 h-4 mr-1" />ข้อความ</Button>
          <Button size="sm" variant={tool === "signature" ? "default" : "outline"} onClick={() => { setTool("pen"); setColor("#1e3a8a"); setSize(2); }}><Signature className="w-4 h-4 mr-1" />เซ็นชื่อ</Button>

          <Separator orientation="vertical" className="h-6 mx-2" />
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-10 rounded border cursor-pointer" />
          <Select value={String(size)} onValueChange={v => setSize(parseInt(v))}>
            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 6, 8, 12].map(n => <SelectItem key={n} value={String(n)}>{n}px</SelectItem>)}</SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6 mx-2" />
          <Button size="sm" variant="outline" onClick={clearPage}><Eraser className="w-4 h-4 mr-1" />ล้างหน้านี้</Button>
          <Button size="sm" variant="outline" onClick={clearAll}>ล้างทั้งหมด</Button>

          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}><ZoomOut className="w-4 h-4" /></Button>
            <span className="text-xs px-1 w-12 text-center">{Math.round(zoom / 1.5 * 100)}%</span>
            <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}><ZoomIn className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setZoom(1.5)} title="Reset"><Maximize2 className="w-4 h-4" /></Button>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <Button size="sm" variant="ghost" disabled={pageNum <= 1} onClick={() => setPageNum(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs px-2">หน้า {pageNum} / {numPages}</span>
            <Button size="sm" variant="ghost" disabled={pageNum >= numPages} onClick={() => setPageNum(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>

        <div ref={containerRef} className="relative bg-muted/30 overflow-auto flex-1 min-h-0 flex justify-center items-start p-4">

          {loading ? (
            <div className="p-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />กำลังโหลด PDF...</div>
          ) : (
            <div className="relative inline-block">
              <canvas ref={pdfCanvasRef} className="shadow-md bg-white" />
              <canvas
                ref={drawCanvasRef}
                className="absolute top-0 left-0"
                style={{ cursor: tool === "none" ? "default" : tool === "text" ? "text" : "crosshair", touchAction: "none" }}
                onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
                onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            บันทึก PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
