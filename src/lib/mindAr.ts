// โหลดไลบรารี MindAR (image tracking) แบบ on-demand จาก CDN
const MINDAR_VERSION = "1.2.5";
const CDN = `https://cdn.jsdelivr.net/npm/mind-ar@${MINDAR_VERSION}/dist`;
const AFRAME_SRC = "https://aframe.io/releases/1.5.0/aframe.min.js";

const loaded = new Map<string, Promise<void>>();

const loadScript = (src: string, asModule = false) => {
  if (loaded.has(src)) return loaded.get(src)!;
  const p = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && (existing as any).dataset.loaded === "1") return resolve();
    const el = document.createElement("script");
    el.src = src;
    if (asModule) el.type = "module";
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

const getCompilerCtor = () => (window as any).MINDAR?.IMAGE?.Compiler;

const waitForCompiler = async (ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const c = getCompilerCtor();
    if (c) return c;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
};

/** สำหรับหน้าจัดการ: ตัวคอมไพล์ภาพเป้าหมาย (.mind) */
export const loadArCompiler = async () => {
  let ctor = getCompilerCtor();
  if (!ctor) {
    // dist/mindar-image.prod.js เป็น ES module ต้องโหลดแบบ module
    try {
      await loadScript(`${CDN}/mindar-image.prod.js`, true);
      ctor = await waitForCompiler(6000);
    } catch { /* ลองทางสำรองด้านล่าง */ }
  }
  if (!ctor) {
    // ทางสำรอง: bundle แบบ classic script ที่รวมตัวคอมไพล์ไว้
    await loadScript(AFRAME_SRC);
    await loadScript(`${CDN}/mindar-image-aframe.prod.js`);
    ctor = await waitForCompiler(8000);
  }
  if (!ctor) throw new Error("ไม่พบตัวคอมไพล์ภาพเป้าหมาย");
  return new ctor();
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
