import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string;

export type WorksheetFieldType =
  | "text"
  | "textarea"
  | "mc"
  | "checkbox"
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
    data = await resp.arrayBuffer();
  } else if (fileOrUrl instanceof ArrayBuffer) {
    data = fileOrUrl;
  } else {
    data = await fileOrUrl.arrayBuffer();
  }
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const out: WorksheetPageImage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    out.push({
      page: i,
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return out;
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
  if (type === "mc") {
    base.options = base.options || ["ตัวเลือก 1", "ตัวเลือก 2", "ตัวเลือก 3"];
    base.h = 12;
    base.w = 35;
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

export function gradeField(
  field: WorksheetField,
  answer: any,
): { correct: boolean; score: number } {
  const maxScore = field.score ?? 1;
  if (field.correct === undefined || field.correct === null || field.correct === "") {
    return { correct: false, score: 0 };
  }
  const norm = (v: any) => {
    if (typeof v !== "string") return v;
    let s = v;
    if (field.trim !== false) s = s.trim();
    if (!field.caseSensitive) s = s.toLowerCase();
    return s;
  };
  switch (field.type) {
    case "text":
    case "textarea": {
      const expected = String(field.correct).split("|").map((s) => norm(s));
      const got = norm(answer ?? "");
      return expected.includes(got) ? { correct: true, score: maxScore } : { correct: false, score: 0 };
    }
    case "mc": {
      return Number(answer) === Number(field.correct)
        ? { correct: true, score: maxScore }
        : { correct: false, score: 0 };
    }
    case "checkbox": {
      return !!answer === !!field.correct
        ? { correct: true, score: maxScore }
        : { correct: false, score: 0 };
    }
    default:
      return { correct: false, score: 0 };
  }
}
