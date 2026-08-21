import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { renderEFormTemplate, type EFormTemplateRow, type EFormRenderContext } from "@/lib/eformTemplate";

interface Props {
  template: EFormTemplateRow;
  context: EFormRenderContext;
  /** Visible width of thumbnail (px). Height auto = width * (297/210) for A4. */
  thumbWidthPx?: number;
}

const A4_RATIO = 297 / 210;
const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = Math.round(PAGE_WIDTH_PX * A4_RATIO);

/** Visual thumbnail only: renders the original A4, then zooms the preview layer out if needed. */
export const EFormTemplateThumbnail = ({
  template,
  context,
  thumbWidthPx = 280,
}: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const scale = thumbWidthPx / PAGE_WIDTH_PX;
  const thumbHeightPx = Math.round(PAGE_HEIGHT_PX * scale);

  const html = useMemo(() => {
    const rendered = renderEFormTemplate(
      template.content_html || "",
      template.fields || [],
      {},
      context,
      { placeholderOnEmpty: false },
    );
    return DOMPurify.sanitize(rendered, { ADD_ATTR: ["target", "data-eform-field", "style"] });
  }, [template.content_html, template.fields, context]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const contentWidth = Math.max(PAGE_WIDTH_PX, el.scrollWidth);
        const contentHeight = Math.max(PAGE_HEIGHT_PX, el.scrollHeight);
        const nextZoom = Math.min(1, PAGE_WIDTH_PX / contentWidth, PAGE_HEIGHT_PX / contentHeight);
        setPreviewZoom((prev) => (Math.abs(prev - nextZoom) < 0.005 ? prev : nextZoom));
      });
    };

    setPreviewZoom(1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    const images = Array.from(el.querySelectorAll("img"));
    images.forEach((img) => img.addEventListener("load", measure));

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      images.forEach((img) => img.removeEventListener("load", measure));
    };
  }, [html]);

  return (
    <div
      data-eform-thumb
      className="relative bg-white rounded-md border shadow-sm"
      style={{
        width: thumbWidthPx,
        height: thumbHeightPx,
        overflow: "hidden",
      }}
    >
      <div
        data-eform-thumb-stage
        style={{
          width: PAGE_WIDTH_PX,
          height: PAGE_HEIGHT_PX,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div
          ref={contentRef}
          data-eform-thumb-content
          style={{
            width: PAGE_WIDTH_PX,
            minHeight: PAGE_HEIGHT_PX,
            overflow: "visible",
            transform: `scale(${previewZoom})`,
            transformOrigin: "top left",
            fontFamily: template.font_family || 'Sarabun',
            fontSize: `${Math.round((template.font_size_pt || 16) * 4 / 3)}px`,
            padding: "25mm 20mm 20mm 30mm",
            color: "#000",
            lineHeight: 1.5,
            boxSizing: "border-box",
          }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
};

export default EFormTemplateThumbnail;
