/**
 * ย่อภาพใบหน้าให้เป็น data URL ขนาดเล็ก (สำหรับเก็บใน student_face_descriptors.face_image)
 * ใช้แสดง "ใบหน้าที่ลงทะเบียนไว้" เทียบกับใบหน้าที่สแกนได้ที่หน้าคีออส
 */
const MAX_SIDE = 320;

function drawScaled(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function canvasToFaceThumb(canvas: HTMLCanvasElement): string {
  try {
    return drawScaled(canvas, canvas.width, canvas.height);
  } catch {
    return "";
  }
}

/** โหลดรูปจาก URL (เช่น signed URL ของ storage) แล้วย่อเป็น data URL */
export async function urlToFaceThumb(url: string): Promise<string> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
      img.src = url;
    });
    return drawScaled(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return "";
  }
}
