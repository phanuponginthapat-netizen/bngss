import type { BackgroundRemovalPipeline } from "@huggingface/transformers";

let remover: Promise<BackgroundRemovalPipeline> | undefined;

/** Flatten the portrait matte onto white without regenerating facial details. */
export function flattenPortraitOnWhite(data: Uint8ClampedArray): Uint8ClampedArray {
  if (data.length % 4 !== 0) throw new Error("ข้อมูลรูปตัดพื้นหลังไม่สมบูรณ์");
  const result = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    for (let c = 0; c < 3; c++) result[i + c] = data[i + c] * alpha + 255 * (1 - alpha);
    result[i + 3] = 255;
  }
  return result;
}

async function loadRemover() {
  if (!remover) {
    remover = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      // A single CPU worker also works on mobile without cross-origin isolation.
      if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
      return pipeline("background-removal", "Xenova/modnet", { dtype: "fp32", device: "wasm" });
    })().catch((error) => {
      remover = undefined;
      throw error;
    });
  }
  return remover;
}

/** Local portrait matting: photo pixels never leave this browser. */
export async function removeIdPhotoBackground(canvas: HTMLCanvasElement, onProgress?: (message: string) => void) {
  try {
    onProgress?.("กำลังเตรียมตัวตัดพื้นหลัง...");
    const segmenter = await loadRemover();
    onProgress?.("กำลังตัดพื้นหลัง...");
    const { RawImage } = await import("@huggingface/transformers");
    const portrait = await segmenter(RawImage.fromCanvas(canvas));
    if (portrait.channels !== 4 || portrait.width !== canvas.width || portrait.height !== canvas.height) {
      throw new Error("ขนาดรูปตัดพื้นหลังไม่ถูกต้อง");
    }
    // Reject empty/full masks rather than silently saving a missing portrait or unchanged background.
    let foreground = 0, background = 0;
    for (let i = 3; i < portrait.data.length; i += 4) {
      if (portrait.data[i] > 200) foreground++;
      if (portrait.data[i] < 50) background++;
    }
    const total = canvas.width * canvas.height;
    if (foreground < total * 0.05 || background < total * 0.01) {
      throw new Error("แยกตัวนักเรียนออกจากพื้นหลังไม่ได้");
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับการปรับรูป");
    ctx.putImageData(new ImageData(flattenPortraitOnWhite(portrait.data), canvas.width, canvas.height), 0, 0);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    throw new Error(`ตัดพื้นหลังไม่สำเร็จ รูปเดิมยังไม่ถูกเปลี่ยน กรุณาลองใหม่ หรือปิดการตัดพื้นหลัง${detail ? ` (${detail})` : ""}`);
  }
}