/**
 * Native client-side image compression using Canvas API.
 * No dependencies — keeps bundle size small and avoids native build issues.
 *
 * Default targets: max 1280px on longest edge, JPEG quality 0.8 → ~50–150KB.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0..1
  mimeType?: "image/jpeg" | "image/webp" | "image/png";
  maxSizeKB?: number; // re-encode at lower quality until under this
}

const DEFAULTS: Required<Omit<CompressOptions, "maxSizeKB">> & { maxSizeKB?: number } = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.8,
  mimeType: "image/webp", // WebP รองรับเกือบทุก browser และเล็กกว่า JPEG ~30%
  maxSizeKB: 150,
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Compress an image File or Blob. Returns a new File with same name. */
export async function compressImage(
  input: File | Blob,
  opts: CompressOptions = {}
): Promise<File> {
  const o = { ...DEFAULTS, ...opts };
  const originalName = input instanceof File ? input.name : "image.jpg";

  // Skip non-images and already-tiny files
  if (input.type && !input.type.startsWith("image/")) return input as File;
  if (input.size <= (o.maxSizeKB ?? 150) * 1024 && input.type === o.mimeType) {
    return input as File;
  }
  // PNG with transparency edge case → keep PNG
  const targetType = o.mimeType;

  const dataUrl = await fileToDataUrl(input);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  const ratio = Math.min(o.maxWidth / width, o.maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return input as File;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = o.quality;
  let blob: Blob | null = null;

  // Loop down quality if still too large
  for (let i = 0; i < 4; i++) {
    blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, targetType, quality)
    );
    if (!blob) break;
    if (!o.maxSizeKB || blob.size <= o.maxSizeKB * 1024) break;
    quality = Math.max(0.4, quality - 0.15);
  }

  if (!blob) return input as File;

  const ext = targetType === "image/webp" ? "webp" : targetType === "image/png" ? "png" : "jpg";
  const newName = originalName.replace(/\.[^.]+$/, "") + "." + ext;
  return new File([blob], newName, { type: targetType });
}
