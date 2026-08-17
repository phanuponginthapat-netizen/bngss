// pdfjs initialization and helpers for E-Form PDF overlays
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite worker URL import
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string;

export const pdfjs = pdfjsLib;

export const EFORM_PDF_BUCKET = "eform-pdfs";

export interface PdfOverlayField {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "checkbox" | "signature" | "autofill";
  page: number; // 1-indexed
  xPct: number; // 0..100, top-left origin
  yPct: number;
  widthPct: number;
  heightPct: number;
  fontSizePt?: number;
  required?: boolean;
  autofillSource?: string;
  options?: string[];
  defaultValue?: string;
}

/** Upload a PDF file and return its storage path (not signed URL). */
export async function uploadEformPdf(file: File): Promise<string> {
  const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] || "pdf").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(EFORM_PDF_BUCKET)
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
  return path;
}

const signedUrlCache = new Map<string, { url: string; exp: number }>();

/** Get a signed URL for a stored PDF, cached per session. */
export async function getEformPdfUrl(path: string): Promise<string> {
  if (!path) return "";
  // Support legacy full URLs
  if (path.startsWith("http")) return path;
  const cached = signedUrlCache.get(path);
  if (cached && cached.exp > Date.now()) return cached.url;
  const { data, error } = await supabase.storage
    .from(EFORM_PDF_BUCKET)
    .createSignedUrl(path, 60 * 60); // 1h
  if (error) throw error;
  signedUrlCache.set(path, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}
