import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, PenLine } from "lucide-react";

interface Props {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  height?: number;
}

/** ลายเซ็นแบบ canvas — คืนค่าเป็น dataURL (PNG โปร่งใส) */
export function SignaturePad({ value, onChange, height = 140 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(!!value);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    c.width = w * ratio;
    c.height = height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, height);
      img.src = value;
    }
  }, [height, value]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    setDrawing(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };
  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    onChange(canvasRef.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-white relative" style={{ height }}>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full h-full touch-none cursor-crosshair"
          style={{ height }}
        />
        {!hasInk && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground text-sm">
            <PenLine className="w-4 h-4 mr-1" /> เซ็นชื่อที่นี่
          </div>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={clear}>
        <Eraser className="w-4 h-4 mr-1" /> ล้าง
      </Button>
    </div>
  );
}
