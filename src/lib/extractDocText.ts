// Extract plain text from uploaded files (PDF, DOCX, TXT, MD, CSV, JSON, images).
// Returns up to `maxChars` characters of text.
// Images use Lovable AI Gateway vision via the ai-chat edge function (OCR).

import { supabase } from "@/integrations/supabase/client";

export async function extractDocText(file: File, maxChars = 50000): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  // PDF
  if (name.endsWith(".pdf") || type === "application/pdf") {
    const pdfjs: any = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let out = "";
    for (let i = 1; i <= pdf.numPages && out.length < maxChars; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const Y_TOL = 3;
      const lineMap = new Map<number, Array<{ str: string; x: number; width: number }>>();
      for (const it of tc.items as any[]) {
        if (!it.str || !it.str.trim()) continue;
        const y = Math.round(it.transform[5] / Y_TOL) * Y_TOL;
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push({
          str: it.str,
          x: it.transform[4],
          width: it.width || it.str.length * 5,
        });
      }
      const lines = Array.from(lineMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) => {
          items.sort((a, b) => a.x - b.x);
          let line = "";
          for (let k = 0; k < items.length; k++) {
            if (k > 0) {
              const gap = items[k].x - (items[k - 1].x + items[k - 1].width);
              if (gap > 10) line += "  ";
              else if (gap > 1) line += " ";
            }
            line += items[k].str;
          }
          return line;
        });
      out += lines.join("\n") + "\n\n";
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

  // Images → OCR via Lovable AI Gateway vision
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) {
    const dataUrl = await fileToDataUrl(file);
    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "อ่านข้อความ/ตารางทั้งหมดจากภาพนี้ออกมาเป็น plain text " +
                  "ถ้าเป็นตารางให้คั่นคอลัมน์ด้วย Tab และขึ้นบรรทัดใหม่ทุกแถว " +
                  "ห้ามใส่คำอธิบายอื่นใด ตอบเฉพาะเนื้อหาที่อ่านได้",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      },
    });
    if (error) throw error;
    const text = (data as any)?.reply || (data as any)?.content || "";
    return String(text).slice(0, maxChars);
  }

  // Text-like
  const text = await file.text();
  return text.slice(0, maxChars);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
