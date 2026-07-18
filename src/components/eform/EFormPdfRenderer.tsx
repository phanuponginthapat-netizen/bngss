// Renders a PDF as page canvases with optional positioned overlay elements.
// Used by both the designer (interactive: drag/move fields) and the fill/preview view.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { pdfjs, getEformPdfUrl, type PdfOverlayField } from "@/lib/eformPdf";

interface PdfPageInfo {
  pageNumber: number;
  width: number;  // CSS px at render scale
  height: number;
}

interface Props {
  pdfPath: string;
  scale?: number; // render scale, default 1.4
  overlays?: PdfOverlayField[];
  renderOverlay?: (f: PdfOverlayField, pageInfo: PdfPageInfo) => React.ReactNode;
  onPageClick?: (page: number, xPct: number, yPct: number) => void;
  pageRefs?: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
}

export function EFormPdfRenderer({ pdfPath, scale = 1.4, overlays = [], renderOverlay, onPageClick, pageRefs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PdfPageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!pdfPath) return;
      setLoading(true);
      setError(null);
      try {
        const url = await getEformPdfUrl(pdfPath);
        const pdf = await pdfjs.getDocument({ url } as any).promise;
        if (cancelled) return;
        const infos: PdfPageInfo[] = [];
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block";
          const wrapper = document.createElement("div");
          wrapper.className = "relative mx-auto bg-white shadow-md mb-4 select-none";
          wrapper.style.width = `${viewport.width}px`;
          wrapper.style.height = `${viewport.height}px`;
          wrapper.dataset.page = String(i);
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
          if (pageRefs) pageRefs.current[i] = wrapper;
          const ctx = canvas.getContext("2d")!;
          const task = page.render({ canvas, canvasContext: ctx, viewport } as any);
          renderTaskRef.current.push(task);
          await task.promise;
          infos.push({ pageNumber: i, width: viewport.width, height: viewport.height });
        }
        if (!cancelled) setPages(infos);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "โหลด PDF ไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      renderTaskRef.current.forEach(t => { try { t.cancel(); } catch {} });
      renderTaskRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPath, scale]);

  // Mount overlays via React portals into the per-page wrappers
  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex items-center justify-center p-6 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> กำลังเรนเดอร์ PDF...
        </div>
      )}
      {error && <div className="text-destructive text-sm p-4">{error}</div>}
      <div ref={containerRef} className="overflow-auto" />
      {/* React-rendered overlays positioned by absolute coords */}
      {pages.length > 0 && pageRefs && pages.map(info => {
        const wrapper = pageRefs.current[info.pageNumber];
        if (!wrapper) return null;
        return (
          <PageOverlayLayer
            key={info.pageNumber}
            wrapper={wrapper}
            info={info}
            overlays={overlays.filter(o => o.page === info.pageNumber)}
            renderOverlay={renderOverlay}
            onPageClick={onPageClick}
          />
        );
      })}
    </div>
  );
}

function PageOverlayLayer({
  wrapper, info, overlays, renderOverlay, onPageClick,
}: {
  wrapper: HTMLDivElement;
  info: PdfPageInfo;
  overlays: PdfOverlayField[];
  renderOverlay?: (f: PdfOverlayField, pageInfo: PdfPageInfo) => React.ReactNode;
  onPageClick?: (page: number, xPct: number, yPct: number) => void;
}) {
  // Use createPortal to mount overlay inside the page wrapper
  return createPortal(
    <div
      className="absolute inset-0"
      onClick={onPageClick ? (e) => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const xPct = ((e.clientX - r.left) / r.width) * 100;
        const yPct = ((e.clientY - r.top) / r.height) * 100;
        onPageClick(info.pageNumber, xPct, yPct);
      } : undefined}
    >
      {overlays.map(f => renderOverlay ? (
        <div key={f.key} style={{
          position: "absolute",
          left: `${f.xPct}%`,
          top: `${f.yPct}%`,
          width: `${f.widthPct}%`,
          height: `${f.heightPct}%`,
        }}>
          {renderOverlay(f, info)}
        </div>
      ) : null)}
    </div>,
    wrapper,
  );
}
