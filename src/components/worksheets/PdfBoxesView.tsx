import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnswerBox = {
  id: string;
  page: number;      // 1-based
  x: number;         // 0..1
  y: number;
  w: number;
  h: number;
};

interface Props {
  fileUrl: string;
  fileType: "pdf" | "image" | string;
  boxes: AnswerBox[];
  /** editor mode: draw new boxes by dragging; click a box to select */
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onCreateBox?: (b: AnswerBox) => void;
  onUpdateBox?: (b: AnswerBox) => void;
  onLoaded?: (pageCount: number) => void;
  /** render input/label inside a box (player mode) */
  renderBox?: (b: AnswerBox) => React.ReactNode;
  scale?: number; // render scale
  className?: string;
  pageClassName?: string;
}

const newId = () => Math.random().toString(36).slice(2, 9);

export default function PdfBoxesView({
  fileUrl, fileType, boxes, editable, selectedId, onSelect,
  onCreateBox, onUpdateBox, onLoaded, renderBox, scale = 1.3,
  className, pageClassName,
}: Props) {
  const [pages, setPages] = useState<{ url: string; w: number; h: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const drag = useRef<{ page: number; sx: number; sy: number } | null>(null);
  const [draft, setDraft] = useState<AnswerBox | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (fileType === "image" || /\.(png|jpe?g|webp)$/i.test(fileUrl)) {
          // single image as one page
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = fileUrl;
          await img.decode();
          if (cancelled) return;
          setPages([{ url: fileUrl, w: img.naturalWidth, h: img.naturalHeight }]);
          onLoaded?.(1);
        } else {
          const pdfjs: any = await import("pdfjs-dist");
          const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          const pdf = await pdfjs.getDocument({ url: fileUrl, withCredentials: false }).promise;
          const out: { url: string; w: number; h: number }[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d")!;
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            out.push({ url: canvas.toDataURL("image/jpeg", 0.85), w: viewport.width, h: viewport.height });
            if (cancelled) return;
          }
          setPages(out);
          onLoaded?.(out.length);
        }
      } catch (e) {
        console.error("PdfBoxesView load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, fileType, scale]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin w-6 h-6" /></div>;
  if (!pages.length) return <div className="text-center py-10 text-muted-foreground text-sm">โหลดไฟล์ไม่สำเร็จ</div>;

  const onPointerDown = (e: React.PointerEvent, pageIdx: number) => {
    if (!editable) return;
    if ((e.target as HTMLElement).dataset?.boxId) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    drag.current = { page: pageIdx + 1, sx, sy };
    setDraft({ id: "draft", page: pageIdx + 1, x: sx, y: sy, w: 0, h: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !editable) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const cy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const { sx, sy } = drag.current;
    setDraft({ id: "draft", page: drag.current.page, x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx), h: Math.abs(cy - sy) });
  };
  const finishDrag = (e?: React.PointerEvent) => {
    if (!editable) return;
    try { if (e) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (draft && draft.w > 0.01 && draft.h > 0.008) {
      onCreateBox?.({ ...draft, id: newId() });
    }
    drag.current = null;
    setDraft(null);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {pages.map((p, idx) => {
        const pageBoxes = boxes.filter((b) => b.page === idx + 1);
        return (
          <div key={idx} className={cn("relative w-full", pageClassName)}>
            <div className="mb-2 flex justify-center">
              <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                หน้า {idx + 1} / {pages.length}
              </span>
            </div>
            <div
              className="relative w-full select-none touch-none rounded-sm shadow-lg"
              style={{ cursor: editable ? "crosshair" : "default" }}
              onPointerDown={(e) => onPointerDown(e, idx)}
              onPointerMove={onPointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
              <img
                src={p.url}
                alt={`page-${idx + 1}`}
                className="block h-auto w-full rounded-sm border bg-background pointer-events-none"
                draggable={false}
              />
              {pageBoxes.map((b) => (
                <div
                  key={b.id}
                  data-box-id={b.id}
                  onPointerDown={(e) => { e.stopPropagation(); onSelect?.(b.id); }}
                  className={`absolute border-2 ${selectedId === b.id ? "border-primary bg-primary/20" : "border-primary/80 bg-primary/10"} ${editable ? "cursor-pointer" : ""}`}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
                >
                  {renderBox?.(b)}
                </div>
              ))}
              {draft && draft.page === idx + 1 && (
                <div className="absolute border-2 border-dashed border-primary bg-primary/20 pointer-events-none"
                  style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
