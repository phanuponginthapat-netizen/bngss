/** Remove light paper from a flat signature scan; never synthesize handwriting. */
export function transparentSignaturePixels(input: Uint8ClampedArray): Uint8ClampedArray {
  if (input.length % 4) throw new Error("ข้อมูลรูปลายเซ็นไม่สมบูรณ์");
  const out = new Uint8ClampedArray(input.length);
  for (let i = 0; i < input.length; i += 4) {
    const r = input[i], g = input[i + 1], b = input[i + 2];
    // Neutral light paper disappears; chromatic (e.g. blue) ink remains.
    const darkest = Math.min(r, g, b);
    const opacity = Math.min(1, Math.max(0, (245 - darkest) / 185));
    out[i + 3] = Math.round(input[i + 3] * opacity);
    if (opacity > 0) {
      // Undo the white-paper matte to keep antialiased strokes free of white halos.
      out[i] = Math.max(0, (r - 255 * (1 - opacity)) / opacity);
      out[i + 1] = Math.max(0, (g - 255 * (1 - opacity)) / opacity);
      out[i + 2] = Math.max(0, (b - 255 * (1 - opacity)) / opacity);
    }
  }
  return out;
}

export function resolveDirectorSignature(settings?: Record<string, string> | null): string {
  return settings?.director_signature || settings?.director_signature_url || "";
}

export async function makeTransparentSignature(file: File): Promise<Blob> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("กรุณาใช้รูปลายเซ็น JPG, PNG หรือ WebP บนกระดาษสีขาว");
  }
  if (file.size > 6 * 1024 * 1024) throw new Error("รูปลายเซ็นต้องไม่เกิน 6 MB");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ไม่สามารถเตรียมรูปลายเซ็นได้");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pixels.data.set(transparentSignaturePixels(pixels.data));
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    let background = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = pixels.data[(y * canvas.width + x) * 4 + 3];
        if (alpha < 10) background++;
        if (alpha > 20) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
    }
    if (right < left || background < canvas.width * canvas.height * 0.05) {
      throw new Error("แยกลายเซ็นไม่ได้ กรุณาใช้ภาพลายเซ็นชัด ๆ บนกระดาษสีขาว");
    }
    ctx.putImageData(pixels, 0, 0);
    const pad = 12;
    const output = document.createElement("canvas");
    output.width = right - left + 1 + pad * 2;
    output.height = bottom - top + 1 + pad * 2;
    const outputCtx = output.getContext("2d");
    if (!outputCtx) throw new Error("ไม่สามารถเตรียมรูปลายเซ็นได้");
    outputCtx.drawImage(canvas, left, top, right - left + 1, bottom - top + 1,
      pad, pad, right - left + 1, bottom - top + 1);
    return await new Promise<Blob>((resolve, reject) => output.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("บันทึกรูปลายเซ็นไม่ได้")), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}