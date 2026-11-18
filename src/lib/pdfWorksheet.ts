import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string;

export type WorksheetFieldType =
  | "text"
  | "textarea"
  | "mc"
  | "checkbox"
  | "select"
  | "multiselect"
  | "match"
  | "order"
  | "number"
  | "draw"
  | "audio";

export interface WorksheetField {
  id: string;
  type: WorksheetFieldType;
  page: number; // 1-based
  // position/size as percent of page (0-100) so it scales
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  placeholder?: string;
  options?: string[]; // mc
  correct?: any; // varies by type
  score?: number;
  caseSensitive?: boolean;
  trim?: boolean;
  required?: boolean;
  tolerance?: number;
  pairs?: { left: string; right: string }[];
}

export interface WorksheetPageImage {
  page: number;
  dataUrl: string;
  width: number;
  height: number;
}

const DEFAULT_RENDER_WIDTH = 1100;

export async function renderPdfToImages(
  fileOrUrl: File | string | ArrayBuffer,
  targetWidth = DEFAULT_RENDER_WIDTH,
): Promise<WorksheetPageImage[]> {
  let data: ArrayBuffer;
  if (typeof fileOrUrl === "string") {
    const resp = await fetch(fileOrUrl);
    if (!resp.ok) throw new Error(`โหลด PDF ไม่สำเร็จ (${resp.status})`);
    data = await resp.arrayBuffer();
  } else if (fileOrUrl instanceof ArrayBuffer) {
    data = fileOrUrl;
  } else {
    data = await fileOrUrl.arrayBuffer();
  }
  const task = pdfjsLib.getDocument({ data });
  const doc = await task.promise;
  const out: WorksheetPageImage[] = [];
  try {
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    if (!base.width || !base.height) throw new Error(`อ่านขนาด PDF หน้า ${i} ไม่สำเร็จ`);
    const scale = targetWidth / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(`แสดง PDF หน้า ${i} ไม่สำเร็จ`);
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    out.push({
      page: i,
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: canvas.width,
      height: canvas.height,
    });
  }
  if (!out.length) throw new Error("PDF ไม่มีหน้าที่อ่านได้");
  return out;
  } finally { await task.destroy(); }
}

export function newField(
  type: WorksheetFieldType,
  page: number,
  partial: Partial<WorksheetField> = {},
): WorksheetField {
  const base: WorksheetField = {
    id: crypto.randomUUID(),
    type,
    page,
    x: 20,
    y: 20,
    w: type === "textarea" ? 40 : type === "draw" ? 50 : 25,
    h: type === "textarea" || type === "draw" ? 15 : 5,
    score: 1,
    trim: true,
    ...partial,
  };
  if (["mc", "select", "multiselect", "order"].includes(type)) {
    base.options = base.options || ["ตัวเลือก 1", "ตัวเลือก 2", "ตัวเลือก 3"];
    base.h = 12;
    base.w = 35;
  }
  if (type === "match") {
    base.pairs = base.pairs || [{ left: "คำถาม 1", right: "คำตอบ 1" }, { left: "คำถาม 2", right: "คำตอบ 2" }];
    base.w = 50; base.h = 16;
  }
  if (type === "checkbox") {
    base.w = 4;
    base.h = 3;
  }
  if (type === "audio") {
    base.w = 22;
    base.h = 6;
  }
  return base;
}

export { gradeField, isWorksheetGradable } from "./worksheetGrading";
