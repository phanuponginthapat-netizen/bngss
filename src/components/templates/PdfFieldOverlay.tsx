import { useEffect, useMemo, useRef, useState } from "react";
import { renderPdfToImages, RenderedPage } from "@/lib/pdfRender";
import { cn } from "@/lib/utils";

export interface TemplateField {
  id: string;
  key: string;
  label: string;
  type: "text" | "checkbox" | "radio" | "date" | "signature" | "number" | "longtext" | "image" | "autofill";
  group?: string | null;
  page: number;
  x: number; y: number; w: number; h: number;
  options?: string[];
  value?: string | null;
  option?: string | null;
  data_hint?: string | null;
  data_source?: string | null;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
}


interface Props {
  pdfBytes: ArrayBuffer | null;
  pdfUrl?: string | null;
  fields: TemplateField[];
  highlightId?: string | null;
  onFieldClick?: (id: string) => void;
  values?: Record<string, any>;
  editable?: boolean;
  onFieldChange?: (id: string, patch: Partial<TemplateField>) => void;
  /** When editable, dragging on empty area creates a new field via this callback. */
  onCreateField?: (rect: { x: number; y: number; w: number; h: number; page: number }) => void;
  /** Snap positions/sizes to this fraction of the page (e.g. 0.005 = 0.5%). Default 0.002 */
  snapStep?: number;
}

type DragState = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  pageW: number;
  pageH: number;
  orig: { x: number; y: number; w: number; h: number };
};

type MarqueeState = {
  page: number;
  pageW: number;
  pageH: number;
  startX: number;
  startY: number;
  startXPct: number;
  startYPct: number;
  rect: { x: number; y: number; w: number; h: number };
};

function snap(v: number, step: number) {
  if (!step) return v;
  return Math.round(v / step) * step;
}

export function PdfFieldOverlay({
  pdfBytes, pdfUrl, fields, highlightId, onFieldClick, values,
  editable = false, onFieldChange, onCreateField, snapStep = 0.002,
}: Props) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [guides, setGuides] = useState<{ page: number; v: number[]; h: number[] } | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      const src = pdfBytes ?? pdfUrl;
      if (!src) return;
      setLoading(true);
      setError(null);
      try {
        const imgs = await renderPdfToImages(src as any, 1.4);
        if (!cancel) setPages(imgs);
      } catch (e: any) {
        if (!cancel) {
          setPages([]);
          setError(e?.message || "เรนเดอร์ PDF ไม่สำเร็จ");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [pdfBytes, pdfUrl]);

  const byPage = useMemo(() => {
    const m: Record<number, TemplateField[]> = {};
    for (const f of fields) {
      (m[f.page] = m[f.page] || []).push(f);
    }
    return m;
  }, [fields]);

  // Drag (move/resize) handlers — pointer events รองรับ touch บนมือถือ
  useEffect(() => {
    if (!drag || !editable || !onFieldChange) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      const dx = (e.clientX - drag.startX) / drag.pageW;
      const dy = (e.clientY - drag.startY) / drag.pageH;
      const others = fields.filter((ff) => ff.id !== drag.id && ff.page === (fields.find(f=>f.id===drag.id)?.page ?? 1));
      const gv: number[] = [];
      const gh: number[] = [];
      if (drag.mode === "move") {
        let nx = Math.max(0, Math.min(1 - drag.orig.w, drag.orig.x + dx));
        let ny = Math.max(0, Math.min(1 - drag.orig.h, drag.orig.y + dy));
        const tol = 0.006;
        for (const o of others) {
          const candX = [o.x, o.x + o.w / 2 - drag.orig.w / 2, o.x + o.w - drag.orig.w];
          for (const c of candX) if (Math.abs(nx - c) < tol) { nx = c; gv.push(c); }
          const candY = [o.y, o.y + o.h / 2 - drag.orig.h / 2, o.y + o.h - drag.orig.h];
          for (const c of candY) if (Math.abs(ny - c) < tol) { ny = c; gh.push(c); }
        }
        nx = snap(nx, snapStep);
        ny = snap(ny, snapStep);
        setGuides({ page: fields.find(f=>f.id===drag.id)?.page ?? 1, v: gv, h: gh });
        onFieldChange(drag.id, { x: nx, y: ny });
      } else {
        const nw = snap(Math.max(0.01, Math.min(1 - drag.orig.x, drag.orig.w + dx)), snapStep);
        const nh = snap(Math.max(0.005, Math.min(1 - drag.orig.y, drag.orig.h + dy)), snapStep);
        onFieldChange(drag.id, { w: nw, h: nh });
      }
    };
    const up = () => { setDrag(null); setGuides(null); };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, editable, onFieldChange, fields, snapStep]);

  // Marquee create handlers
  useEffect(() => {
    if (!marquee || !editable || !onCreateField) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      const dx = (e.clientX - marquee.startX) / marquee.pageW;
      const dy = (e.clientY - marquee.startY) / marquee.pageH;
      const x = dx < 0 ? Math.max(0, marquee.startXPct + dx) : marquee.startXPct;
      const y = dy < 0 ? Math.max(0, marquee.startYPct + dy) : marquee.startYPct;
      const w = Math.min(1 - x, Math.abs(dx));
      const h = Math.min(1 - y, Math.abs(dy));
      setMarquee({ ...marquee, rect: { x, y, w, h } });
    };
    const up = () => {
      const r = marquee.rect;
      if (r.w >= 0.01 && r.h >= 0.008) {
        onCreateField({
          x: snap(r.x, snapStep),
          y: snap(r.y, snapStep),
          w: snap(Math.max(0.02, r.w), snapStep),
          h: snap(Math.max(0.015, r.h), snapStep),
          page: marquee.page,
        });
      }
      setMarquee(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [marquee, editable, onCreateField, snapStep]);

  const startDrag = (e: React.PointerEvent, f: TemplateField, mode: "move" | "resize") => {
    if (!editable || !onFieldChange) return;
    e.preventDefault();
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const container = pageRefs.current[f.page];
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setDrag({
      id: f.id, mode,
      startX: e.clientX, startY: e.clientY,
      pageW: rect.width, pageH: rect.height,
      orig: { x: f.x, y: f.y, w: f.w, h: f.h },
    });
    onFieldClick?.(f.id);
  };

  const startMarquee = (e: React.PointerEvent, pageNumber: number) => {
    if (!editable || !onCreateField) return;
    if ((e.target as HTMLElement).closest("[data-field-box]")) return;
    const container = pageRefs.current[pageNumber];
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    e.preventDefault();
    setMarquee({
      page: pageNumber,
      pageW: rect.width,
      pageH: rect.height,
      startX: e.clientX,
      startY: e.clientY,
      startXPct: xPct,
      startYPct: yPct,
      rect: { x: xPct, y: yPct, w: 0, h: 0 },
    });
  };



  if (loading) return <div className="text-sm text-muted-foreground p-4">กำลังเรนเดอร์ PDF...</div>;
  if (error) return <div className="text-sm text-destructive p-4">เปิด PDF ไม่สำเร็จ: {error}</div>;
  if (!pages.length) return <div className="text-sm text-muted-foreground p-4">ยังไม่มี PDF</div>;

  return (
    <div className="space-y-4">
      {pages.map((p) => (
        <div
          key={p.pageNumber}
          ref={(el) => { pageRefs.current[p.pageNumber] = el; }}
          onPointerDown={(e) => startMarquee(e, p.pageNumber)}
          className={cn("relative inline-block shadow border bg-white", editable && onCreateField && "cursor-crosshair")}
        >
          <img src={p.dataUrl} alt={`page ${p.pageNumber}`} className="block max-w-full select-none pointer-events-none" style={{ width: p.width }} />

          {/* Guidelines while dragging */}
          {guides && guides.page === p.pageNumber && (
            <>
              {guides.v.map((v, i) => (
                <div key={`gv${i}`} className="absolute top-0 bottom-0 border-l border-pink-500/70 pointer-events-none" style={{ left: `${v * 100}%` }} />
              ))}
              {guides.h.map((h, i) => (
                <div key={`gh${i}`} className="absolute left-0 right-0 border-t border-pink-500/70 pointer-events-none" style={{ top: `${h * 100}%` }} />
              ))}
            </>
          )}

          {/* Marquee preview */}
          {marquee && marquee.page === p.pageNumber && (
            <div className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
              style={{
                left: `${marquee.rect.x * 100}%`,
                top: `${marquee.rect.y * 100}%`,
                width: `${marquee.rect.w * 100}%`,
                height: `${marquee.rect.h * 100}%`,
              }}
            />
          )}

          {(byPage[p.pageNumber] || []).map((f) => {
            const v = values?.[f.key];
            const filled = v != null && v !== "" && v !== false;
            const isSel = highlightId === f.id;
            return (
              <div
                key={f.id}
                data-field-box
                onPointerDown={(e) => editable && startDrag(e, f, "move")}
                onClick={(e) => { e.stopPropagation(); onFieldClick?.(f.id); }}
                className={cn(
                  "absolute border-2 transition-colors text-[10px] leading-tight overflow-hidden group",
                  editable ? "cursor-move touch-none" : "cursor-pointer",
                  isSel
                    ? "border-orange-500 bg-orange-200/40 ring-2 ring-orange-500"
                    : filled
                      ? "border-green-500 bg-green-200/30 hover:bg-green-200/50"
                      : f.type === "image"
                        ? "border-purple-500 bg-purple-200/20 hover:bg-purple-200/40"
                        : f.type === "autofill"
                          ? "border-amber-500 bg-amber-200/20 hover:bg-amber-200/40"
                          : "border-blue-500 bg-blue-200/20 hover:bg-blue-200/40",
                )}
                style={{
                  left: `${f.x * 100}%`,
                  top: `${f.y * 100}%`,
                  width: `${f.w * 100}%`,
                  height: `${f.h * 100}%`,
                }}
                title={`${f.label} (${f.type})${editable ? " — ลากเพื่อย้าย" : ""}`}
              >
                {f.type === "image" && filled && typeof v === "string" && v.startsWith("data:image") ? (
                  <img src={v} alt="" className="w-full h-full object-contain pointer-events-none" />
                ) : (
                  <span
                    className="px-0.5 block truncate"
                    style={{
                      fontSize: f.fontSize ? `${f.fontSize * 1.333}px` : undefined,
                      fontWeight: f.bold ? 700 : undefined,
                      textAlign: f.align || undefined,
                      color: f.color || undefined,
                      fontFamily: f.fontFamily ? `'${f.fontFamily}', sans-serif` : undefined,
                    }}
                  >
                    {f.type === "checkbox" && filled ? "✓" : ""}
                    {f.type === "image" && !filled ? "🖼️" : ""}
                    {f.type === "autofill" && !filled ? `⚡${f.label}` : ""}
                    {f.type !== "checkbox" && f.type !== "image" && filled ? String(v).slice(0, 50) : ""}
                  </span>
                )}

                {editable && (
                  <div
                    onPointerDown={(e) => startDrag(e, f, "resize")}
                    className="absolute -right-1 -bottom-1 w-5 h-5 bg-primary rounded-sm cursor-se-resize opacity-80 hover:opacity-100 touch-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
      {editable && onCreateField && (
        <p className="text-xs text-muted-foreground">
          💡 <b>ลากคลุมพื้นที่บน PDF</b> เพื่อสร้างช่องใหม่ทันที · เส้นชมพูช่วยจัดแนวให้ตรงกับช่องอื่น
        </p>
      )}
    </div>
  );
}
