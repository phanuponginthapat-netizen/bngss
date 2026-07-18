import { useEffect } from "react";
import { useCmsSettingsBulk } from "./useCmsSettings";

/** แปลง hex (#rrggbb / #rgb) -> "h s% l%" สำหรับ CSS variable แบบ HSL */
function hexToHslString(hex: string): string | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hh = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hh = (b - r) / d + 2; break;
      case b: hh = (r - g) / d + 4; break;
    }
    hh /= 6;
  }
  return `${Math.round(hh * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useSystemSettings() {
  const { data: settings } = useCmsSettingsBulk();

  // Dynamically update document title
  useEffect(() => {
    if (settings?.app_name) {
      document.title = settings.app_name;
    }
  }, [settings?.app_name]);

  // Apply CMS theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const map: Array<[string, string | undefined]> = [
      ["--primary", settings?.theme_primary_color],
      ["--secondary", settings?.theme_secondary_color],
      ["--accent", settings?.theme_accent_color],
    ];
    for (const [varName, hex] of map) {
      if (!hex) continue;
      const hsl = hexToHslString(hex);
      if (hsl) root.style.setProperty(varName, hsl);
    }
  }, [settings?.theme_primary_color, settings?.theme_secondary_color, settings?.theme_accent_color]);


  // NOTE: ไอคอน PWA / favicon / manifest ทั้งหมดถูกจัดการโดย applyDynamicBranding()
  // ใน src/lib/dynamicManifest.ts (รัน 1 ครั้งตอน boot จาก main.tsx)
  // ที่นั่นจะครอปโลโก้จาก CMS ให้เป็นจตุรัส 192/512 ที่มือถือยอมรับ
  // ห้ามสร้าง manifest blob ซ้ำที่นี่ มิฉะนั้นจะทับด้วยรูปดิบที่ไม่ใช่จตุรัส
  // และมือถือจะ fallback ไปไอคอน default ตอนติดตั้ง PWA


  const schoolName = settings?.school_name || "";
  const appName = settings?.app_name || schoolName || "Smart School";
  return {
    appName,
    appShortName: settings?.app_short_name || appName,
    faviconUrl: settings?.app_favicon_url || "",
    schoolLogo: settings?.school_logo || "",
    schoolName,
  };
}
