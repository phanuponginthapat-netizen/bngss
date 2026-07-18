import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Type, ChevronLeft, ChevronRight, Save, Pencil, Eraser } from "lucide-react";
import { downloadHomeworkBlob, signedHomeworkUrl, isImageMime, isPdfMime, isDocxMime, isXlsxMime, isPptxMime, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";
import OfficePreviewEditor from "./editors/OfficePreviewEditor";

interface Props {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

// Max canvas width — falls back to viewport width on small screens so the page
// always fits without a horizontal scrollbar.
const getCanvasWidth = () =>
  Math.min(800, (typeof window !== "undefined" ? window.innerWidth : 800) - 64);

export default function HomeworkEditor(props: Props) {
  const { open, attachment } = props;
  // Office files → preview + reply (รวม DOCX/XLSX/PPTX)
  if (open && attachment && (isDocxMime(attachment.mime, attachment.name) || isXlsxMime(attachment.mime, attachment.name) || isPptxMime(attachment.mime, attachment.name))) {
    return <OfficePreviewEditor {...props} />;
  }
  // Image / PDF → canvas annotation (เขียนทับได้)
  return <CanvasImagePdfEditor {...props} />;
}

function CanvasImagePdfEditor({ open, attachment, onClose, onSave }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricNsRef = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);
  const pageStatesRef = useRef<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [mode, setMode] = useState<"select" | "draw">("select");

  useEffect(() => {
    if (!open || !attachment) return;
    let cancelled = false;
    setLoading(true);
    setPageNum(1);
    setPageCount(1);
    pageStatesRef.current = {};

    (async () => {
      const fabric: any = await import("fabric");
      fabricNsRef.current = fabric;
      if (cancelled || !canvasElRef.current) return;

      try { fabricCanvasRef.current?.dispose?.(); } catch {}

      const canvas = new fabric.Canvas(canvasElRef.current, {
        backgroundColor: "#fff",
        selection: true,
        width: getCanvasWidth(),
        height: 600,
      });
      fabricCanvasRef.current = canvas;

      const blob = await downloadHomeworkBlob(attachment.path);

      if (isImageMime(attachment.mime)) {
        const url = URL.createObjectURL(blob);
        const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
        const scale = Math.min(getCanvasWidth() / img.width, 1);
        const w = img.width * scale; const h = img.height * scale;
        canvas.setDimensions({ width: w, height: h });
        img.scale(scale);
        img.set({ selectable: false, evented: false, left: 0, top: 0, excludeFromExport: true });
        canvas.add(img);
        canvas.sendObjectToBack(img);
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
        toast.error("ไฟล์นี้ยังแก้ไขในระบบไม่ได้ ดาวน์โหลดไปทำแล้วแนบกลับมาได้");
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

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    if (!canvas || !fabric) return;
    canvas.isDrawingMode = mode === "draw";
    if (mode === "draw") {
      const brush = new fabric.PencilBrush(canvas);
      brush.color = "#e11d48";
      brush.width = 2;
      canvas.freeDrawingBrush = brush;
    }
  }, [mode]);

  const renderPdfPage = async (n: number) => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    const pdf = pdfDocRef.current;
    if (!canvas || !pdf || !fabric) return;
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const scale = getCanvasWidth() / viewport.width;
    const scaled = page.getViewport({ scale });
    const tmp = document.createElement("canvas");
    tmp.width = scaled.width; tmp.height = scaled.height;
    await page.render({ canvasContext: tmp.getContext("2d")!, viewport: scaled }).promise;
    const dataUrl = tmp.toDataURL("image/png");

    canvas.clear();
    canvas.backgroundColor = "#fff";
    canvas.setDimensions({ width: scaled.width, height: scaled.height });

    const img = await fabric.FabricImage.fromURL(dataUrl);
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

  const persistCurrentPage = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const json = canvas.toJSON();
    pageStatesRef.current[pageNum] = json;
  };

  const goPage = async (n: number) => {
    if (n < 1 || n > pageCount || n === pageNum) return;
    persistCurrentPage();
    setPageNum(n);
    await renderPdfPage(n);
  };

  const addText = () => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    if (!canvas || !fabric) return;
    const t = new fabric.IText("พิมพ์ที่นี่", {
      left: 40, top: 40, fontSize: 22, fill: "#111",
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
      const canvas = fabricCanvasRef.current;
      if (isImageMime(attachment.mime)) {
        const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
        const blob = await (await fetch(dataUrl)).blob();
        const baseName = attachment.name.replace(/\.[^.]+$/, "");
        await onSave(blob, `${baseName}_edited.png`);
      } else if (isPdfMime(attachment.mime)) {
        persistCurrentPage();
        const { jsPDF } = await import("jspdf");
        const out = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
        for (let i = 1; i <= pageCount; i++) {
          await renderPdfPage(i);
          const c = fabricCanvasRef.current;
          const dataUrl = c.toDataURL({ format: "png", multiplier: 1 });
          const w = c.getWidth(); const h = c.getHeight();
          const pageW = out.internal.pageSize.getWidth();
          const pageH = out.internal.pageSize.getHeight();
          const s = Math.min(pageW / w, pageH / h);
          const drawW = w * s; const drawH = h * s;
          if (i > 1) out.addPage();
          out.addImage(dataUrl, "PNG", (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);
        }
        const blob = out.output("blob");
        const baseName = attachment.name.replace(/\.[^.]+$/, "");
        await onSave(blob, `${baseName}_edited.pdf`);
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenOriginal = async () => {
    if (!attachment) return;
    try {
      const url = await signedHomeworkUrl(attachment.path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "เปิดไม่สำเร็จ");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">แก้ไข: {attachment?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-center border-b pb-2">
          <Button type="button" size="sm" variant="outline" onClick={addText} disabled={loading}><Type className="w-4 h-4 mr-1" />เพิ่มข้อความ</Button>
          <Button type="button" size="sm" variant={mode === "draw" ? "default" : "outline"} onClick={() => setMode(mode === "draw" ? "select" : "draw")} disabled={loading}>
            <Pencil className="w-4 h-4 mr-1" />{mode === "draw" ? "หยุดวาด" : "วาดเส้น"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={deleteSelected} disabled={loading}><Eraser className="w-4 h-4 mr-1" />ลบที่เลือก</Button>
          {isPdfMime(attachment?.mime) && pageCount > 1 && (
            <div className="flex items-center gap-1 ml-auto">
              <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => goPage(pageNum - 1)} disabled={loading || pageNum <= 1}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-xs">หน้า {pageNum}/{pageCount}</span>
              <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => goPage(pageNum + 1)} disabled={loading || pageNum >= pageCount}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>

        <div className="overflow-auto max-h-[60vh] bg-muted/30 rounded">
          {loading && <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> กำลังโหลดไฟล์...</div>}
          <div className="flex justify-center p-3">
            <canvas ref={canvasElRef} className="border bg-white shadow-sm" />
          </div>
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={handleOpenOriginal}>เปิดต้นฉบับในแท็บใหม่</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
            <Button type="button" onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              บันทึก & แนบกลับ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
