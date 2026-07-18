// Fill / preview view for PDF-mode templates.
// Renders the PDF and overlays user-entered values as positioned text/images on top.
import { useRef } from "react";
import { thaiDate, resolveAutofill, type EFormRenderContext } from "@/lib/eformTemplate";
import { type PdfOverlayField } from "@/lib/eformPdf";
import { EFormPdfRenderer } from "./EFormPdfRenderer";

interface Props {
  pdfPath: string;
  overlays: PdfOverlayField[];
  values: Record<string, string>;
  context: EFormRenderContext;
}

function displayValue(f: PdfOverlayField, raw: string, ctx: EFormRenderContext): string {
  if (f.type === "autofill") return resolveAutofill(f.autofillSource as any, ctx);
  if (!raw) return "";
  if (f.type === "checkbox") return raw === "true" || raw === "1" ? "☑" : "";
  if (f.type === "date") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : thaiDate(d);
  }
  return raw;
}

export function EFormPdfFill({ pdfPath, overlays, values, context }: Props) {
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  return (
    <EFormPdfRenderer
      pdfPath={pdfPath}
      scale={1.4}
      overlays={overlays}
      pageRefs={pageRefs}
      renderOverlay={(f) => {
        const raw = values[f.key] ?? f.defaultValue ?? "";
        const v = displayValue(f, raw, context);
        if (f.type === "signature" && raw.startsWith("data:image")) {
          return <img src={raw} alt="ลายเซ็น" className="w-full h-full object-contain" />;
        }
        return (
          <div
            style={{
              fontFamily: "'Sarabun', sans-serif",
              fontSize: `${f.fontSizePt || 12}px`,
              lineHeight: 1,
              color: "#000",
            }}
            className="w-full h-full overflow-hidden whitespace-pre-wrap"
          >
            {v}
          </div>
        );
      }}
    />
  );
}
