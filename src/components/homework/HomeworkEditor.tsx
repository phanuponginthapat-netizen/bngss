import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Type, ChevronLeft, ChevronRight, Save, Pencil, Eraser,
  Highlighter, Square, Circle as CircleIcon, ArrowRight, Undo2, Redo2,
  RotateCw, PenLine, Stamp, MousePointer2, Mic, Video, StopCircle,
} from "lucide-react";
import {
  downloadHomeworkBlob, signedHomeworkUrl,
  isImageMime, isPdfMime, isDocxMime, isXlsxMime, isPptxMime,
  type Attachment,
} from "@/lib/homeworkStorage";
import { toast } from "sonner";
import OfficePreviewEditor from "./editors/OfficePreviewEditor";

interface Props {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

const getCanvasWidth = () =>
  Math.min(900, (typeof window !== "undefined" ? window.innerWidth : 900) - 64);

type Tool = "select" | "draw" | "highlight" | "rect" | "ellipse" | "arrow" | "text";

export default function HomeworkEditor(props: Props) {
  const { open, attachment } = props;
  if (open && attachment && (isDocxMime(attachment.mime, attachment.name) || isXlsxMime(attachment.mime, attachment.name) || isPptxMime(attachment.mime, attachment.name))) {
    return <OfficePreviewEditor {...props} />;
  }
  return <CanvasImagePdfEditor {...props} />;
}

function CanvasImagePdfEditor({ open, attachment, onClose, onSave }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricNsRef = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);
  const pageStatesRef = useRef<Record<number, any>>({});
  const pageRotationRef = useRef<Record<number, number>>({});
  const undoStackRef = useRef<any[]>([]);
  const redoStackRef = useRef<any[]>([]);
  const skipHistoryRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#e11d48");
  const [size, setSize] = useState(3);
  const [signOpen, setSignOpen] = useState(false);
  const [recAudio, setRecAudio] = useState<MediaRecorder|null>(null);
  const [recVideo, setRecVideo] = useState<MediaRecorder|null>(null);

  const pushHistory = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || skipHistoryRef.current) return;
    try {
      undoStackRef.current.push(JSON.stringify(canvas.toJSON()));
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      redoStackRef.current = [];
    } catch {}
  };

  const attachHistory = (canvas: any) => {
    canvas.on("object:added", pushHistory);
    canvas.on("object:modified", pushHistory);
    canvas.on("object:removed", pushHistory);
  };

  useEffect(() => {
    if (!open || !attachment) return;
    let cancelled = false;
    setLoading(true);
    setPageNum(1);
    setPageCount(1);
    pageStatesRef.current = {};
    pageRotationRef.current = {};
    undoStackRef.current = [];
    redoStackRef.current = [];

    (async () => {
      const fabric: any = await import("fabric");
      fabricNsRef.current = fabric;
      if (cancelled || !canvasElRef.current) return;

      try { fabricCanvasRef.current?.dispose?.(); } catch {}

      const canvas = new fabric.Canvas(canvasElRef.current, {
        backgroundColor: "#fff", selection: true,
        width: getCanvasWidth(), height: 600,
      });
      fabricCanvasRef.current = canvas;
      attachHistory(canvas);

      const blob = await downloadHomeworkBlob(attachment.path);

      if (isImageMime(attachment.mime)) {
        const url = URL.createObjectURL(blob);
        const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
        const scale = Math.min(getCanvasWidth() / img.width, 1);
        const w = img.width * scale, h = img.height * scale;
        canvas.setDimensions({ width: w, height: h });
        img.scale(scale);
        img.set({ selectable: false, evented: false, left: 0, top: 0, excludeFromExport: true });
        skipHistoryRef.current = true;
        canvas.add(img); canvas.sendObjectToBack(img);
        skipHistoryRef.current = false;
        canvas.requestRenderAll();
      } else if (isPdfMime(attachment.mime)) {
        const pdfjs: any = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const buf = await blob.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        await renderPdfPage(1);
      } else {
        toast.error("ไฟล์นี้ยังแก้ไขในระบบไม่ได้");
      }
      if (!cancelled) setLoading(false);
    })().catch((e) => {
      console.error(e);
      toast.error("เปิดไฟล์ไม่สำเร็จ: " + (e?.message || e));
      setLoading(false);
    });

    return () => {
      cancelled = true;
      try { fabricCanvasRef.current?.dispose?.(); } catch {}
      fabricCanvasRef.current = null;
      pdfDocRef.current = null;
      pageStatesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attachment?.id]);

  // Handle tool switching + shape drawing
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    if (!canvas || !fabric) return;

    canvas.isDrawingMode = tool === "draw" || tool === "highlight";
    canvas.selection = tool === "select";
    if (tool === "draw") {
      const b = new fabric.PencilBrush(canvas);
      b.color = color; b.width = size;
      canvas.freeDrawingBrush = b;
    } else if (tool === "highlight") {
      const b = new fabric.PencilBrush(canvas);
      b.color = color + "55";
      b.width = Math.max(12, size * 6);
      canvas.freeDrawingBrush = b;
    }

    // Shape drag-to-draw
    let start: any = null;
    let shape: any = null;
    const onDown = (o: any) => {
      if (!["rect", "ellipse", "arrow", "text"].includes(tool)) return;
      const p = canvas.getPointer(o.e);
      start = p;
      if (tool === "text") {
        const t = new fabric.IText("พิมพ์ที่นี่", {
          left: p.x, top: p.y, fontSize: 20, fill: color,
          fontFamily: "IBM Plex Sans Thai, Inter, sans-serif",
        });
        canvas.add(t); canvas.setActiveObject(t);
        setTool("select");
        return;
      }
      if (tool === "rect") {
        shape = new fabric.Rect({ left: p.x, top: p.y, width: 1, height: 1, fill: "transparent", stroke: color, strokeWidth: size });
      } else if (tool === "ellipse") {
        shape = new fabric.Ellipse({ left: p.x, top: p.y, rx: 1, ry: 1, fill: "transparent", stroke: color, strokeWidth: size });
      } else if (tool === "arrow") {
        shape = new fabric.Line([p.x, p.y, p.x, p.y], { stroke: color, strokeWidth: size });
      }
      if (shape) { skipHistoryRef.current = true; canvas.add(shape); }
    };
    const onMove = (o: any) => {
      if (!shape || !start) return;
      const p = canvas.getPointer(o.e);
      if (tool === "rect") shape.set({ width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y), left: Math.min(p.x, start.x), top: Math.min(p.y, start.y) });
      else if (tool === "ellipse") shape.set({ rx: Math.abs(p.x - start.x) / 2, ry: Math.abs(p.y - start.y) / 2, left: Math.min(p.x, start.x), top: Math.min(p.y, start.y) });
      else if (tool === "arrow") shape.set({ x2: p.x, y2: p.y });
      canvas.requestRenderAll();
    };
    const onUp = () => {
      if (shape) {
        skipHistoryRef.current = false;
        pushHistory();
      }
      shape = null; start = null;
    };

    canvas.on("mouse:down", onDown);
    canvas.on("mouse:move", onMove);
    canvas.on("mouse:up", onUp);
    return () => {
      canvas.off("mouse:down", onDown);
      canvas.off("mouse:move", onMove);
      canvas.off("mouse:up", onUp);
    };
  }, [tool, color, size]);

  const renderPdfPage = async (n: number) => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    const pdf = pdfDocRef.current;
    if (!canvas || !pdf || !fabric) return;
    const rotation = pageRotationRef.current[n] || 0;
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1, rotation });
    const scale = getCanvasWidth() / viewport.width;
    const scaled = page.getViewport({ scale, rotation });
    const tmp = document.createElement("canvas");
    tmp.width = scaled.width; tmp.height = scaled.height;
    await page.render({ canvasContext: tmp.getContext("2d")!, viewport: scaled }).promise;
    const dataUrl = tmp.toDataURL("image/png");

    skipHistoryRef.current = true;
    canvas.clear();
    canvas.backgroundColor = "#fff";
    canvas.setDimensions({ width: scaled.width, height: scaled.height });
    const img = await fabric.FabricImage.fromURL(dataUrl);
    img.set({ selectable: false, evented: false, left: 0, top: 0, excludeFromExport: true });
    canvas.add(img); canvas.sendObjectToBack(img);
    const state = pageStatesRef.current[n];
    if (state?.objects?.length) {
      const objs = await fabric.util.enlivenObjects(state.objects);
      objs.forEach((o: any) => canvas.add(o));
    }
    skipHistoryRef.current = false;
    canvas.requestRenderAll();
  };

  const persistCurrentPage = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    pageStatesRef.current[pageNum] = canvas.toJSON();
  };

  const goPage = async (n: number) => {
    if (n < 1 || n > pageCount || n === pageNum) return;
    persistCurrentPage();
    setPageNum(n);
    await renderPdfPage(n);
  };

  const rotatePage = async () => {
    if (!pdfDocRef.current) {
      const c = fabricCanvasRef.current;
      const active = c?.getActiveObject();
      if (active) { active.rotate(((active.angle || 0) + 90) % 360); c.requestRenderAll(); pushHistory(); }
      return;
    }
    pageRotationRef.current[pageNum] = ((pageRotationRef.current[pageNum] || 0) + 90) % 360;
    delete pageStatesRef.current[pageNum];
    await renderPdfPage(pageNum);
  };

  const deleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach((o: any) => canvas.remove(o));
    canvas.discardActiveObject(); canvas.requestRenderAll();
  };

  const undo = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || undoStackRef.current.length < 2) return;
    const current = undoStackRef.current.pop();
    if (current) redoStackRef.current.push(current);
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    if (!prev) return;
    skipHistoryRef.current = true;
    await canvas.loadFromJSON(prev);
    canvas.requestRenderAll();
    skipHistoryRef.current = false;
  };
  const redo = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !redoStackRef.current.length) return;
    const next = redoStackRef.current.pop();
    undoStackRef.current.push(next);
    skipHistoryRef.current = true;
    await canvas.loadFromJSON(next);
    canvas.requestRenderAll();
    skipHistoryRef.current = false;
  };

  const addStamp = (label: string, fill: string) => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    if (!canvas || !fabric) return;
    const t = new fabric.IText(label, {
      left: 60, top: 60, fontSize: 28, fill,
      fontFamily: "IBM Plex Sans Thai, Inter, sans-serif", fontWeight: "bold",
      stroke: fill, strokeWidth: 1, padding: 8,
      backgroundColor: fill + "22",
      angle: -12,
    });
    canvas.add(t); canvas.setActiveObject(t); canvas.requestRenderAll();
  };

  const handleSave = async () => {
    if (!attachment) return;
    setSaving(true);
    try {
      const canvas = fabricCanvasRef.current;
      if (isImageMime(attachment.mime)) {
        const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
        const blob = await (await fetch(dataUrl)).blob();
        const base = attachment.name.replace(/\.[^.]+$/, "");
        await onSave(blob, `${base}_edited.png`);
      } else if (isPdfMime(attachment.mime)) {
        persistCurrentPage();
        const { jsPDF } = await import("jspdf");
        const out = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
        for (let i = 1; i <= pageCount; i++) {
          await renderPdfPage(i);
          const c = fabricCanvasRef.current;
          const dataUrl = c.toDataURL({ format: "png", multiplier: 1 });
          const w = c.getWidth(), h = c.getHeight();
          const pageW = out.internal.pageSize.getWidth();
          const pageH = out.internal.pageSize.getHeight();
          const s = Math.min(pageW / w, pageH / h);
          const drawW = w * s, drawH = h * s;
          if (i > 1) out.addPage();
          out.addImage(dataUrl, "PNG", (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);
        }
        const blob = out.output("blob");
        const base = attachment.name.replace(/\.[^.]+$/, "");
        await onSave(blob, `${base}_edited.pdf`);
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally { setSaving(false); }
  };

  const handleOpenOriginal = async () => {
    if (!attachment) return;
    try { window.open(await signedHomeworkUrl(attachment.path), "_blank"); }
    catch (e: any) { toast.error(e?.message || "เปิดไม่สำเร็จ"); }
  };

  const toggleAudio = async () => {
    if (recAudio) { recAudio.stop(); setRecAudio(null); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(s);
      const chunks: BlobPart[] = [];
      r.ondataavailable = e=> chunks.push(e.data);
      r.onstop = async ()=>{ const b=new Blob(chunks,{type:"audio/webm"}); s.getTracks().forEach(t=>t.stop()); await onSave(b, `audio_${Date.now()}.webm`); toast.success("บันทึกเสียงแล้ว"); };
      r.start(); setRecAudio(r); toast("กำลังอัดเสียง... กดอีกครั้งเพื่อหยุด");
    } catch(e:any){ toast.error(e?.message||"อัดเสียงไม่สำเร็จ"); }
  };
  const toggleVideo = async () => {
    if (recVideo) { recVideo.stop(); setRecVideo(null); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
      const r = new MediaRecorder(s);
      const chunks: BlobPart[] = [];
      r.ondataavailable = e=> chunks.push(e.data);
      r.onstop = async ()=>{ const b=new Blob(chunks,{type:"video/webm"}); s.getTracks().forEach(t=>t.stop()); await onSave(b, `video_${Date.now()}.webm`); toast.success("บันทึกวิดีโอแล้ว"); };
      r.start(); setRecVideo(r); toast("กำลังอัดวิดีโอ... กดอีกครั้งเพื่อหยุด");
    } catch(e:any){ toast.error(e?.message||"อัดวิดีโอไม่สำเร็จ"); }
  };

  const placeSignature = (dataUrl: string) => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    if (!canvas || !fabric) return;
    fabric.FabricImage.fromURL(dataUrl).then((img: any) => {
      img.set({ left: 60, top: canvas.getHeight() - 140, scaleX: 0.5, scaleY: 0.5 });
      canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll();
    });
    setSignOpen(false);
  };

  const ToolBtn = ({ id, icon, title }: { id: Tool; icon: any; title: string }) => (
    <Button size="sm" variant={tool === id ? "default" : "outline"} onClick={() => setTool(id)} title={title} className="h-8 w-8 p-0">
      {icon}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate">แก้ไข: {attachment?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1 items-center border-b pb-2">
          <ToolBtn id="select" title="เลือก" icon={<MousePointer2 className="w-4 h-4" />} />
          <ToolBtn id="draw" title="ปากกา" icon={<Pencil className="w-4 h-4" />} />
          <ToolBtn id="highlight" title="ไฮไลต์" icon={<Highlighter className="w-4 h-4" />} />
          <ToolBtn id="text" title="ข้อความ" icon={<Type className="w-4 h-4" />} />
          <ToolBtn id="rect" title="สี่เหลี่ยม" icon={<Square className="w-4 h-4" />} />
          <ToolBtn id="ellipse" title="วงกลม" icon={<CircleIcon className="w-4 h-4" />} />
          <ToolBtn id="arrow" title="เส้น/ลูกศร" icon={<ArrowRight className="w-4 h-4" />} />

          <div className="w-px h-6 bg-border mx-1" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded border" title="สี" />
          <Input type="number" min={1} max={30} value={size} onChange={(e) => setSize(Number(e.target.value) || 1)} className="h-8 w-14 text-xs" title="ขนาด" />

          <div className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant="outline" onClick={undo} className="h-8 w-8 p-0" title="Undo"><Undo2 className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={redo} className="h-8 w-8 p-0" title="Redo"><Redo2 className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={rotatePage} className="h-8 w-8 p-0" title="หมุน"><RotateCw className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={deleteSelected} className="h-8 w-8 p-0" title="ลบ"><Eraser className="w-4 h-4" /></Button>

          <div className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant="outline" onClick={() => setSignOpen(true)} className="h-8" title="ลายเซ็น"><PenLine className="w-4 h-4 mr-1" />ลายเซ็น</Button>
          <Button size="sm" variant="outline" onClick={() => addStamp("ต้นฉบับ", "#dc2626")} className="h-8"><Stamp className="w-4 h-4 mr-1" />ต้นฉบับ</Button>
          <Button size="sm" variant="outline" onClick={() => addStamp("สำเนา", "#0284c7")} className="h-8">สำเนา</Button>
          <Button size="sm" variant="outline" onClick={() => addStamp("อนุมัติ", "#16a34a")} className="h-8">อนุมัติ</Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant={recAudio?"default":"outline"} onClick={toggleAudio} className="h-8" title="อัดเสียงพูด">{recAudio?<StopCircle className="w-4 h-4 mr-1"/>:<Mic className="w-4 h-4 mr-1"/>}{recAudio?"หยุด":"อัดเสียง"}</Button>
          <Button size="sm" variant={recVideo?"default":"outline"} onClick={toggleVideo} className="h-8" title="อัดคลิปวิดีโอ">{recVideo?<StopCircle className="w-4 h-4 mr-1"/>:<Video className="w-4 h-4 mr-1"/>}{recVideo?"หยุด":"วิดีโอ"}</Button>

          {isPdfMime(attachment?.mime) && pageCount > 1 && (
            <div className="flex items-center gap-1 ml-auto">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => goPage(pageNum - 1)} disabled={pageNum <= 1}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-xs">หน้า {pageNum}/{pageCount}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => goPage(pageNum + 1)} disabled={pageNum >= pageCount}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>

        <div className="overflow-auto max-h-[60vh] bg-muted/30 rounded">
          {loading && <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> กำลังโหลด...</div>}
          <div className="flex justify-center p-3">
            <canvas ref={canvasElRef} className="border bg-white shadow-sm" />
          </div>
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleOpenOriginal}>เปิดต้นฉบับ</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              บันทึก & แนบกลับ
            </Button>
          </div>
        </div>

        {signOpen && <SignaturePadDialog onCancel={() => setSignOpen(false)} onDone={placeSignature} />}
      </DialogContent>
    </Dialog>
  );
}

function SignaturePadDialog({ onCancel, onDone }: { onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2; ctx.strokeStyle = "#111"; ctx.lineCap = "round"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    const pos = (e: any) => { const r = c.getBoundingClientRect(); const t = e.touches?.[0] ?? e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const down = (e: any) => { drawing.current = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e: any) => { if (!drawing.current) return; e.preventDefault(); const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
    const up = () => { drawing.current = false; };
    c.addEventListener("mousedown", down); c.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    c.addEventListener("touchstart", down); c.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
    return () => {
      c.removeEventListener("mousedown", down); c.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      c.removeEventListener("touchstart", down); c.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
    };
  }, []);
  const clear = () => { const c = ref.current!; const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); };
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>วาดลายเซ็น</DialogTitle></DialogHeader>
        <canvas ref={ref} width={480} height={200} className="border rounded bg-white touch-none" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={clear}>ล้าง</Button>
          <Button variant="outline" onClick={onCancel}>ยกเลิก</Button>
          <Button onClick={() => onDone(ref.current!.toDataURL("image/png"))}>ใช้ลายเซ็นนี้</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
