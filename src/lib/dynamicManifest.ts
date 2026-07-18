import { supabase } from "@/integrations/supabase/client";

/**
 * โหลด branding จาก cms_settings + ตาราง schools แล้วสร้าง manifest.json + favicon แบบไดนามิก
 * รวมการตรวจสอบและ "ครอป + ปรับขนาด" โลโก้ให้เป็น 1:1 อัตโนมัติ (192/512)
 * ก่อนนำไปใช้ใน manifest, apple-touch-icon, และ favicon
 * ไม่มีการ hardcode ชื่อ/โลโก้โรงเรียนใด ๆ
 */

const DEFAULT_ICON_192 = "/icon-192.png";
const DEFAULT_ICON_512 = "/icon-512.png";
const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp", "svg"];
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];

// cache ผลลัพธ์ใน session เดียว เพื่อไม่ต้องครอปซ้ำ
const squareCache = new Map<string, string>();

export async function applyDynamicBranding() {
  try {
    const [cmsRes, schoolRes] = await Promise.all([
      supabase
        .from("cms_settings")
        .select("key, value")
        .in("key", [
          "school_name",
          "school_short_name",
          "school_logo",
          "school_logo_512",
          "theme_primary_color",
          "theme_secondary_color",
          "theme_accent_color",
          "primary_color",
          "theme_color",
          "background_color",
          "school_description",
        ]),
      supabase
        .from("schools")
        .select("school_name, short_name, logo_url")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const map: Record<string, string> = {};
    (cmsRes.data || []).forEach((r: any) => {
      if (r?.value) map[r.key] = r.value;
    });

    const school: any = schoolRes.data || {};

    // CMS → schools → ค่าทั่วไป (ไม่ผูกชื่อโรงเรียนใดในโค้ด)
    const name =
      map.school_name ||
      school.school_name ||
      "ระบบจัดการโรงเรียน";
    const shortName =
      map.school_short_name ||
      school.short_name ||
      (name.length > 12 ? name.slice(0, 12) : name);
    const themeColor =
      map.theme_primary_color || map.theme_color || map.primary_color || "#2563EB";
    const bgColor = map.background_color || "#FFFFFF";
    const description =
      map.school_description ||
      `${name} — ระบบบริหารจัดการโรงเรียน`;

    const source = map.school_logo_512 || map.school_logo || school.logo_url;

    const [logo192, logo512] = await Promise.all([
      prepareSquareLogo(source, 192, bgColor).catch(() => DEFAULT_ICON_192),
      prepareSquareLogo(source, 512, bgColor).catch(() => DEFAULT_ICON_512),
    ]);

    document.title = name;
    setMeta("theme-color", themeColor);
    setMeta("description", description);
    // iOS ใช้ meta เหล่านี้ตอนติดตั้งจาก Safari (manifest อย่างเดียวไม่พอ)
    setMeta("apple-mobile-web-app-title", shortName);
    setMeta("application-name", shortName);
    setMeta("og:title", name, "property");
    setMeta("og:description", description, "property");
    // og:image / twitter:image — ใช้โลโก้ 512 ของโรงเรียนถ้าตั้งไว้
    if (logo512) {
      setMeta("og:image", logo512, "property");
      setMeta("twitter:image", logo512);
      setMeta("twitter:card", "summary_large_image");
    }
    setLink("apple-touch-icon", logo192);
    setLink("apple-touch-icon", logo192, "180x180");
    setLink("apple-touch-icon", logo192, "192x192");
    setLink("apple-touch-icon", logo512, "512x512");
    setLink("icon", logo192);

    // NOTE: ตัว manifest.json ถูกเสิร์ฟแบบ dynamic โดย edge function `dynamic-manifest` แล้ว
    // (อ้างใน index.html) จึงไม่ต้องสร้าง blob URL ทับที่นี่อีก — เพราะ PC Chrome อ่าน manifest
    // ตอนโหลดหน้าเพื่อตัดสินใจติดตั้ง PWA ทันที ก่อน JS รัน ถ้าเรา replace ทีหลังจะไม่ทัน

    (window as any).__branding = { name, shortName, logo: logo192, themeColor };
    window.dispatchEvent(new CustomEvent("branding:ready", { detail: (window as any).__branding }));
  } catch (e) {
    console.warn("applyDynamicBranding failed", e);
  }
}

/**
 * ตรวจสอบ + ครอป "ตรงกลาง" ให้เป็นสี่เหลี่ยมจัตุรัส แล้วย่อ/ขยายเป็น size×size
 */
async function prepareSquareLogo(src: string | undefined | null, size: number, bgColor: string): Promise<string> {
  if (!src) throw new Error("no-src");

  const cacheKey = `${src}::${size}::${bgColor}`;
  const cached = squareCache.get(cacheKey);
  if (cached) return cached;

  const lower = src.toLowerCase().split("?")[0];
  const ext = lower.includes(".") ? lower.split(".").pop() : "";
  const isData = src.startsWith("data:");
  const dataMime = isData ? src.slice(5, src.indexOf(";")) : "";

  if (!isData && ext && !ALLOWED_EXT.includes(ext)) {
    console.warn(`[branding] นามสกุลไม่รองรับ: .${ext}`);
    throw new Error("bad-ext");
  }
  if (isData && !ALLOWED_MIME.includes(dataMime)) {
    console.warn(`[branding] MIME ไม่รองรับ: ${dataMime}`);
    throw new Error("bad-mime");
  }

  const img = await loadImage(src);
  const w = img.naturalWidth || size;
  const h = img.naturalHeight || size;
  if (!w || !h) throw new Error("invalid-image");

  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");

  ctx.fillStyle = bgColor || "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("[branding] canvas tainted, ใช้รูปต้นฉบับแทน", e);
    return src;
  }

  squareCache.set(cacheKey, dataUrl);
  return dataUrl;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("timeout")), 8000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("load-error"));
    };
    img.src = src;
  });
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string, sizes?: string) {
  const selector = sizes
    ? `link[rel="${rel}"][sizes="${sizes}"]`
    : `link[rel="${rel}"]:not([sizes])`;
  let el = document.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (sizes) el.setAttribute("sizes", sizes);
    document.head.appendChild(el);
  }
  el.href = href;
}
