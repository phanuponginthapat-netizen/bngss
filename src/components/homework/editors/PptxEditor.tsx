import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Type, Pencil, Eraser, ChevronLeft, ChevronRight } from "lucide-react";
import { downloadHomeworkBlob, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";

interface Props {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

const SLIDE_W = 960;

export default function PptxEditor({ open, attachment, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [mode, setMode] = useState<"select" | "draw">("select");
  const slideImagesRef = useRef<string[]>([]);
  const slideDimRef = useRef<{ w: number; h: number }>({ w: SLIDE_W, h: 540 });
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricNsRef = useRef<any>(null);
  const pageStatesRef = useRef<Record<number, any>>({});

  useEffect(() => {
    if (!open || !attachment) return;
    let cancelled = false;
    setLoading(true);
    setPageNum(1);
    pageStatesRef.current = {};
    slideImagesRef.current = [];

    (async () => {
      try {
        const fabric: any = await import("fabric");
        fabricNsRef.current = fabric;

        const blob = await downloadHomeworkBlob(attachment.path);
        const buf = await blob.arrayBuffer();

        const { init }: any = await import("pptx-preview");
        const holder = document.createElement("div");
        holder.style.position = "fixed";
        holder.style.left = "-9999px";
        holder.style.top = "0";
        document.body.appendChild(holder);
        const previewer = init(holder, { width: SLIDE_W, height: SLIDE_W * 0.5625 });
        await previewer.preview(buf);

        const html2canvas = (await import("html2canvas")).default;
        const slides = Array.from(holder.querySelectorAll(".pptx-preview-wrapper > section, .slide, .pptx-slide"));
        const targets = slides.length ? slides : Array.from(holder.children) as HTMLElement[];

        const imgs: string[] = [];
        for (const s of targets as HTMLElement[]) {
          const canvas = await html2canvas(s, { backgroundColor: "#fff", scale: 1, logging: false, useCORS: true });
          imgs.push(canvas.toDataURL("image/jpeg", 0.9));
          if (imgs.length === 1) slideDimRef.current = { w: canvas.width, h: canvas.height };
        }
        document.body.removeChild(holder);

        if (!imgs.length) throw new Error("ไม่พบสไลด์ในไฟล์");
        if (cancelled) return;

        slideImagesRef.current = imgs;
        setPageCount(imgs.length);

        // init fabric
        try { fabricCanvasRef.current?.dispose?.(); } catch {}
        const canvas = new fabric.Canvas(canvasElRef.current, {
          backgroundColor: "#fff",
          width: slideDimRef.current.w,
          height: slideDimRef.current.h,
        });
        fabricCanvasRef.current = canvas;
        await renderSlide(1);
      } catch (e: any) {
        console.error(e);
        toast.error("เปิดไฟล์ PowerPoint ไม่สำเร็จ: " + (e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try { fabricCanvasRef.current?.dispose?.(); } catch {}
      fabricCanvasRef.current = null;
      pageStatesRef.current = {};
      slideImagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attachment?.id]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    if (!canvas || !fabric) return;
    canvas.isDrawingMode = mode === "draw";
    if (mode === "draw") {
      const brush = new fabric.PencilBrush(canvas);
      brush.color = "#e11d48"; brush.width = 3;
      canvas.freeDrawingBrush = brush;
    }
  }, [mode]);

  const renderSlide = async (n: number) => {
    const fabric = fabricNsRef.current;
    const canvas = fabricCanvasRef.current;
    if (!canvas || !fabric) return;
    const dataUrl = slideImagesRef.current[n - 1];
    if (!dataUrl) return;
    canvas.clear();
    canvas.backgroundColor = "#fff";
    const img = await fabric.FabricImage.fromURL(dataUrl);
    const w = img.width, h = img.height;
    canvas.setDimensions({ width: w, height: h });
    img.set({ selectable: false, evented: false, left: 0, top: 0, excludeFromExport: true });
    canvas.add(img);
    canvas.sendObjectToBack(img);
    const state = pageStatesRef.current[n];
    if (state?.objects?.length) {
      const objs = await fabric.util.enlivenObjects(state.objects);
      objs.forEach((o: any) => canvas.add(o));
    }
    canvas.requestRenderAll();
  };

  const persist = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    pageStatesRef.current[pageNum] = canvas.toJSON();
  };

  const goPage = async (n: number) => {
    if (n < 1 || n > pageCount || n === pageNum) return;
    persist();
    setPageNum(n);
    await renderSlide(n);
  };

  const addText = () => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    if (!canvas || !fabric) return;
    const t = new fabric.IText("พิมพ์ที่นี่", {
      left: 60, top: 60, fontSize: 28, fill: "#111",
      fontFamily: "IBM Plex Sans Thai, Inter, sans-serif",
      backgroundColor: "rgba(255,255,0,0.6)", padding: 4,
    });
    canvas.add(t); canvas.setActiveObject(t); canvas.requestRenderAll();
  };

  const deleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach((o: any) => canvas.remove(o));
    canvas.discardActiveObject(); canvas.requestRenderAll();
  };

  const handleSave = async () => {
    if (!attachment) return;
    setSaving(true);
    try {
      persist();
      const pptxgen: any = (await import("pptxgenjs")).default;
      const pres = new pptxgen();
      pres.defineLayout({ name: "EDIT", width: 10, height: 5.625 });
      pres.layout = "EDIT";

      for (let i = 1; i <= pageCount; i++) {
        await renderSlide(i);
        const c = fabricCanvasRef.current;
        const dataUrl = c.toDataURL({ format: "jpeg", multiplier: 1, quality: 0.9 });
        const slide = pres.addSlide();
        slide.addImage({ data: dataUrl, x: 0, y: 0, w: 10, h: 5.625 });
      }
      const out = await pres.write({ outputType: "blob" });
      const blob = out instanceof Blob ? out : new Blob([out as any], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
      const baseName = attachment.name.replace(/\.[^.]+$/, "");
      await onSave(blob, `${baseName}_edited.pptx`);
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
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate">แก้ไข PowerPoint: {attachment?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-center border-b pb-2">
          <Button size="sm" variant="outline" onClick={addText} disabled={loading}><Type className="w-4 h-4 mr-1" />ข้อความ</Button>
          <Button size="sm" variant={mode === "draw" ? "default" : "outline"} onClick={() => setMode(mode === "draw" ? "select" : "draw")} disabled={loading}>
            <Pencil className="w-4 h-4 mr-1" />{mode === "draw" ? "หยุดวาด" : "วาดเส้น"}
          </Button>
          <Button size="sm" variant="outline" onClick={deleteSelected} disabled={loading}><Eraser className="w-4 h-4 mr-1" />ลบที่เลือก</Button>
          {pageCount > 1 && (
            <div className="flex items-center gap-1 ml-auto">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => goPage(pageNum - 1)} disabled={loading || pageNum <= 1}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-xs">สไลด์ {pageNum}/{pageCount}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => goPage(pageNum + 1)} disabled={loading || pageNum >= pageCount}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>

        <div className="overflow-auto max-h-[60vh] bg-muted/30 rounded">
          {loading && <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />กำลังแปลงสไลด์...</div>}
          <div className="flex justify-center p-3">
            <canvas ref={canvasElRef} className="border bg-white shadow-sm max-w-full" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">หมายเหตุ: ไฟล์ที่บันทึกจะกลายเป็นสไลด์ภาพ (เหมาะกับการเขียนคำตอบบนใบงาน)</p>

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
