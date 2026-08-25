// โหลดไลบรารี MindAR (image tracking) แบบ on-demand จาก CDN
const MINDAR_VERSION = "1.2.5";
const CDN = `https://cdn.jsdelivr.net/npm/mind-ar@${MINDAR_VERSION}/dist`;
const AFRAME_SRC = "https://aframe.io/releases/1.5.0/aframe.min.js";

const loaded = new Map<string, Promise<void>>();

const loadScript = (src: string) => {
  if (loaded.has(src)) return loaded.get(src)!;
  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && (existing as any).dataset.loaded === "1") return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.crossOrigin = "anonymous";
    el.onload = () => { (el as any).dataset.loaded = "1"; resolve(); };
    el.onerror = () => reject(new Error("โหลดไลบรารี AR ไม่สำเร็จ: " + src));
    document.head.appendChild(el);
  });
  loaded.set(src, p);
  return p;
};

/** สำหรับหน้าสแกน: A-Frame + MindAR image tracking */
export const loadArViewer = async () => {
  await loadScript(AFRAME_SRC);
  await loadScript(`${CDN}/mindar-image-aframe.prod.js`);
};

/** สำหรับหน้าจัดการ: ตัวคอมไพล์ภาพเป้าหมาย (.mind) */
export const loadArCompiler = async () => {
  await loadScript(`${CDN}/mindar-image.prod.js`);
  const compiler = (window as any).MINDAR?.IMAGE?.Compiler;
  if (!compiler) throw new Error("ไม่พบตัวคอมไพล์ภาพเป้าหมาย");
  return new compiler();
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดภาพเป้าหมายไม่สำเร็จ"));
    img.src = url;
  });

/** คอมไพล์ภาพป้าย/วัตถุหลายรูปเป็นไฟล์ targets เดียว (.mind) */
export const compileTargets = async (
  imageUrls: string[],
  onProgress?: (percent: number) => void
): Promise<Blob> => {
  const compiler = await loadArCompiler();
  const images = await Promise.all(imageUrls.map(loadImage));
  await compiler.compileImageTargets(images, (p: number) => onProgress?.(Math.round(p)));
  const buffer = await compiler.exportData();
  return new Blob([buffer], { type: "application/octet-stream" });
};
