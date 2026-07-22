import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage, FabricText, Circle, Rect, PencilBrush } from "fabric";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Circle as CircleIcon, Square, Type, Trash2, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";

type Tool = "draw" | "circle" | "rect" | "text" | "select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imageUrl: string;
  initialAnnotatedUrl?: string | null;
  onSaved: (annotatedUrl: string) => void | Promise<void>;
}

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#111827"];

export default function AnnotateImageDialog({ open, onOpenChange, imageUrl, initialAnnotatedUrl, onSaved }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fcRef = useRef<FabricCanvas | null>(null);
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ef4444");
  const [width, setWidth] = useState(3);
  const [textValue, setTextValue] = useState("");
  const [busy, setBusy] = useState(false);

  // Init canvas when dialog opens
  useEffect(() => {
    if (!open || !canvasElRef.current) return;
    const fc = new FabricCanvas(canvasElRef.current, {
      width: 800, height: 600, backgroundColor: "#f8fafc",
    });
    fcRef.current = fc;
    const src = initialAnnotatedUrl || imageUrl;
    FabricImage.fromURL(src, { crossOrigin: "anonymous" }).then((img) => {
      if (!img) return;
      const maxW = 900, maxH = 620;
      const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
      const w = (img.width || 0) * scale;
      const h = (img.height || 0) * scale;
      fc.setDimensions({ width: w, height: h });
      img.scale(scale);
      img.set({ selectable: false, evented: false });
      fc.backgroundImage = img;
      fc.renderAll();
    }).catch(() => toast.error("โหลดรูปไม่สำเร็จ (อาจติด CORS)"));

    return () => { fc.dispose(); fcRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // React to tool/color changes
  useEffect(() => {
    const fc = fcRef.current; if (!fc) return;
    fc.isDrawingMode = tool === "draw";
    if (fc.isDrawingMode) {
      const brush = new PencilBrush(fc);
      brush.color = color;
      brush.width = width;
      fc.freeDrawingBrush = brush;
    }
    fc.selection = tool === "select";
  }, [tool, color, width]);

  const addShape = () => {
    const fc = fcRef.current; if (!fc) return;
    const common = { left: 80, top: 80, fill: "transparent", stroke: color, strokeWidth: width };
    if (tool === "circle") fc.add(new Circle({ ...common, radius: 50 }));
    else if (tool === "rect") fc.add(new Rect({ ...common, width: 120, height: 80 }));
    fc.setActiveObject(fc.getObjects().slice(-1)[0]);
    setTool("select");
  };

  const addText = () => {
    const fc = fcRef.current; if (!fc) return;
    if (!textValue.trim()) { toast.error("พิมพ์ข้อความก่อน"); return; }
    const t = new FabricText(textValue, {
      left: 100, top: 100, fill: color, fontSize: 24, fontFamily: "IBM Plex Sans Thai, Inter, sans-serif",
    });
    fc.add(t); fc.setActiveObject(t);
    setTextValue(""); setTool("select");
  };

  const deleteSelected = () => {
    const fc = fcRef.current; if (!fc) return;
    fc.getActiveObjects().forEach(o => fc.remove(o));
    fc.discardActiveObject(); fc.requestRenderAll();
  };

  const undo = () => {
    const fc = fcRef.current; if (!fc) return;
    const objs = fc.getObjects();
    if (objs.length) { fc.remove(objs[objs.length - 1]); fc.requestRenderAll(); }
  };

  const handleSave = async () => {
    const fc = fcRef.current; if (!fc) return;
    setBusy(true);
    try {
      const dataUrl = fc.toDataURL({ format: "png", multiplier: 1 });
      const blob = await (await fetch(dataUrl)).blob();
      const path = `homework/annotated/${Date.now()}.png`;
      const res = await uploadPublicFileWithFallback("cms-images", path, blob, { contentType: "image/png", upsert: true });
      await onSaved(res.publicUrl);
      toast.success("บันทึกรูปที่ตรวจแล้ว");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl sm:max-h-[95vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ตรวจการบ้าน — ขีด / วง / ใส่ข้อความบนรูป</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
          <Button size="sm" variant={tool === "draw" ? "default" : "outline"} onClick={() => setTool("draw")}><Pencil className="w-3.5 h-3.5 mr-1" />วาด</Button>
          <Button size="sm" variant={tool === "circle" ? "default" : "outline"} onClick={() => { setTool("circle"); setTimeout(addShape, 0); }}><CircleIcon className="w-3.5 h-3.5 mr-1" />วงกลม</Button>
          <Button size="sm" variant={tool === "rect" ? "default" : "outline"} onClick={() => { setTool("rect"); setTimeout(addShape, 0); }}><Square className="w-3.5 h-3.5 mr-1" />สี่เหลี่ยม</Button>
          <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => setTool("select")}>เลือก/ย้าย</Button>
          <div className="h-6 w-px bg-border" />
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
              style={{ background: c }} aria-label={c} />
          ))}
          <div className="h-6 w-px bg-border" />
          <Label className="text-xs">หนา</Label>
          <input type="range" min={1} max={20} value={width} onChange={(e) => setWidth(+e.target.value)} className="w-20" />
          <span className="text-xs w-6">{width}</span>
          <div className="h-6 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={undo}><Undo2 className="w-3.5 h-3.5 mr-1" />ย้อนกลับ</Button>
          <Button size="sm" variant="outline" onClick={deleteSelected}><Trash2 className="w-3.5 h-3.5 mr-1" />ลบที่เลือก</Button>
        </div>

        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-muted-foreground" />
          <Input value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="พิมพ์ข้อความที่จะใส่ในรูป..." className="h-9" />
          <Button size="sm" onClick={addText}>ใส่ข้อความ</Button>
        </div>

        <div className="flex justify-center overflow-auto bg-[length:20px_20px] bg-[linear-gradient(45deg,#0001_25%,transparent_25%,transparent_75%,#0001_75%),linear-gradient(45deg,#0001_25%,transparent_25%,transparent_75%,#0001_75%)] bg-[position:0_0,10px_10px] rounded-lg border border-border p-2">
          <canvas ref={canvasElRef} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={busy}><Save className="w-4 h-4 mr-1" />{busy ? "กำลังบันทึก..." : "บันทึกรูปที่ตรวจ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
