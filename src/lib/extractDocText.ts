// Extract plain text from uploaded files (PDF, DOCX, TXT, MD, CSV, JSON).
// Returns up to `maxChars` characters of text.

export async function extractDocText(file: File, maxChars = 50000): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  // PDF
  if (name.endsWith(".pdf") || type === "application/pdf") {
    const pdfjs: any = await import("pdfjs-dist");
    // Use bundled worker via Vite ?url import
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let out = "";
    for (let i = 1; i <= pdf.numPages && out.length < maxChars; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map((it: any) => it.str).join(" ") + "\n\n";
    }
    return out.slice(0, maxChars);
  }

  // DOCX
  if (name.endsWith(".docx") || type.includes("wordprocessingml")) {
    const mammoth: any = await import("mammoth");
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    return String(res.value || "").slice(0, maxChars);
  }


  // Text-like
  const text = await file.text();
  return text.slice(0, maxChars);
}
