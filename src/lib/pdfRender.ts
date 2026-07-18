import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;
}

export interface RenderedPage {
  pageNumber: number;
  dataUrl: string;
  width: number;   // pixels at render scale
  height: number;
}

export async function renderPdfToImages(
  source: ArrayBuffer | Uint8Array | string,
  scale = 1.5,
): Promise<RenderedPage[]> {
  const pdfSource = typeof source === "string"
    ? source
    : { data: source instanceof Uint8Array ? source.slice() : new Uint8Array(source.slice(0)) };
  const loadingTask = (pdfjs as any).getDocument(pdfSource);
  const pdf = await loadingTask.promise;
  const out: RenderedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: viewport.width,
      height: viewport.height,
    });
  }
  return out;
}
