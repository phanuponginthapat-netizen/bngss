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
const BRAND_CACHE_KEY = "cms_branding_cache";

function hexToHsl(hex: string): string | null {
  if (!hex) return null;
  const m = hex.trim().replace(/^#/, "");
  const h = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) hh = ((b - r) / d + 2);
    else hh = ((r - g) / d + 4);
    hh *= 60;
  }
  return `${Math.round(hh)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyThemeVars(themeColor: string) {
  const hsl = hexToHsl(themeColor);
  if (!hsl) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-ring", hsl);
}

function hydrateFromCache() {
  try {
    const raw = localStorage.getItem(BRAND_CACHE_KEY);
    if (!raw) return;
    const b = JSON.parse(raw);
    if (b?.name) document.title = b.name;
    if (b?.themeColor) {
      setMeta("theme-color", b.themeColor);
      applyThemeVars(b.themeColor);
    }
    if (b?.logo) setLink("icon", b.logo);
    (window as any).__branding = b;
  } catch {}
}

export async function applyDynamicBranding() {
  hydrateFromCache();
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
    const themeColor = map.theme_color || map.primary_color || "#2563EB";
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
    setLink("apple-touch-icon", logo192);
    setLink("apple-touch-icon", logo192, "180x180");
    setLink("apple-touch-icon", logo192, "192x192");
    setLink("apple-touch-icon", logo512, "512x512");
    setLink("icon", logo192);

    // Manifest แบบไดนามิก: ชี้ <link rel="manifest"> ไปที่ edge function ที่อ่านค่าจาก CMS
    // — URL คงที่ (identity เสถียร, Android WebAPK ไม่ถอนติดตั้งเอง)
    // — เนื้อหา name/short_name/icons/theme_color เปลี่ยนตาม CMS
    // ส่ง ?origin= เพื่อให้ start_url/scope อยู่ same-origin กับหน้าเว็บตามสเปก PWA
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
    if (supabaseUrl) {
      // URL คงที่ (ไม่มี cache-buster) เพื่อให้ Android WebAPK คง identity เดิมทุกครั้งที่เปิด
      const manifestUrl = `${supabaseUrl}/functions/v1/manifest?origin=${encodeURIComponent(window.location.origin)}`;
      let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "manifest";
        document.head.appendChild(link);
      }
      // manifest อยู่คนละ origin — ต้องใส่ crossorigin แบบ anonymous (ตรงกับ CORS: * ที่ฝั่ง edge)
      link.crossOrigin = "anonymous";
      if (link.href !== manifestUrl) link.href = manifestUrl;
    }



    const branding = { name, shortName, logo: logo192, themeColor };
    (window as any).__branding = branding;
    applyThemeVars(themeColor);
    try { localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(branding)); } catch {}
    window.dispatchEvent(new CustomEvent("branding:ready", { detail: branding }));
  } catch (e) {
    console.warn("applyDynamicBranding failed", e);
  }
}

/**
 * ปรับโลโก้ให้พอดี canvas สี่เหลี่ยมจัตุรัสขนาด size×size แบบ "contain" (ไม่ครอป)
 * และ**คงพื้นหลังโปร่งใส** — ไม่มีสีทับ ให้เห็นโลโก้ล้วน ๆ ตามที่อัปโหลด
 * (ใช้กับ PWA icon / apple-touch-icon เพื่อไม่ให้เห็นกรอบสี่เหลี่ยม)
 */
async function prepareSquareLogo(src: string | undefined | null, size: number, _bgColor: string): Promise<string> {
  if (!src) throw new Error("no-src");

  const cacheKey = `${src}::${size}::transparent`;
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

  // ถ้าโลโก้เป็นสี่เหลี่ยมจัตุรัสอยู่แล้ว → ใช้ต้นฉบับเลย (คงคุณภาพ + ความโปร่งใส)
  if (Math.abs(w - h) <= 2 && (w === size || (isData && !src.startsWith("data:image/svg")))) {
    return src;
  }

  // Fit-contain: จัดโลโก้ให้พอดี canvas โดยไม่ครอป ที่ว่างเป็น "โปร่งใส"
  const scale = Math.min(size / w, size / h);
  const dw = w * scale;
  const dh = h * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");

  // ⚠️ ห้าม fillRect — ต้องคงพื้นหลังใส (transparent) เพื่อให้เห็นโลโก้ล้วนไม่มีกรอบสี
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h, dx, dy, dw, dh);

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
