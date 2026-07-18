import type jsPDF from "jspdf";

let cache: { regular: string; bold: string } | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load font: ${url}`);
  const buf = await res.arrayBuffer();
  // Convert ArrayBuffer -> base64 (chunked to avoid call-stack overflow)
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Register TH Sarabun fonts with the given jsPDF doc and set it as default.
 * Call BEFORE writing any Thai text. Subsequent calls reuse the cache.
 */
export async function registerThaiFont(doc: jsPDF) {
  if (!cache) {
    const [regular, bold] = await Promise.all([
      fetchAsBase64("/fonts/thsarabunnew.ttf"),
      fetchAsBase64("/fonts/thsarabunnew_bold.ttf"),
    ]);
    cache = { regular, bold };
  }
  doc.addFileToVFS("THSarabunNew.ttf", cache.regular);
  doc.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
  doc.addFileToVFS("THSarabunNew-Bold.ttf", cache.bold);
  doc.addFont("THSarabunNew-Bold.ttf", "THSarabunNew", "bold");
  doc.setFont("THSarabunNew", "normal");
}