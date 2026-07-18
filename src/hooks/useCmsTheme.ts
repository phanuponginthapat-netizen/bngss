import { useEffect } from "react";
import { useCmsSettingsBulk } from "./useCmsSettings";

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = hex.trim().replace(/^#/, "");
  const h = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function hexToHsl(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: hh = ((b - r) / d + 2); break;
      case b: hh = ((r - g) / d + 4); break;
    }
    hh *= 60;
  }
  return `${Math.round(hh)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** คำนวณสี foreground (ขาว/ดำ) ให้ contrast ดีที่สุดตาม WCAG luminance */
function contrastForeground(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const srgb = [rgb.r, rgb.g, rgb.b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return L > 0.5 ? "222 47% 11%" : "0 0% 100%";
}

/**
 * อ่านสีจาก cms_settings แล้วยัดเข้า CSS variables ที่ shadcn/Tailwind ใช้
 * รองรับ: theme_primary_color, theme_secondary_color, theme_accent_color (HEX)
 * และ auto-derive foreground ให้ contrast อ่านได้เสมอ
 */
export function useCmsTheme() {
  const { data: settings } = useCmsSettingsBulk();

  useEffect(() => {
    const root = document.documentElement;

    // key ใน cms_settings → CSS variables ที่ต้องอัปเดต + ตัวแปรสี foreground
    const map: Array<{ hexKey: string; vars: string[]; fgVar?: string }> = [
      { hexKey: "theme_primary_color", vars: ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"], fgVar: "--primary-foreground" },
      { hexKey: "theme_secondary_color", vars: ["--secondary"], fgVar: "--secondary-foreground" },
      { hexKey: "theme_accent_color", vars: ["--accent"], fgVar: "--accent-foreground" },
      { hexKey: "theme_success_color", vars: ["--success"], fgVar: "--success-foreground" },
      { hexKey: "theme_warning_color", vars: ["--warning"], fgVar: "--warning-foreground" },
      { hexKey: "theme_info_color", vars: ["--info"], fgVar: "--info-foreground" },
      { hexKey: "theme_destructive_color", vars: ["--destructive"], fgVar: "--destructive-foreground" },
    ];

    for (const { hexKey, vars, fgVar } of map) {
      const hex = (settings as any)?.[hexKey] || "";
      const hsl = hexToHsl(hex);
      const fg = contrastForeground(hex);
      for (const v of vars) {
        if (hsl) root.style.setProperty(v, hsl);
        else root.style.removeProperty(v);
      }
      if (hexKey === "theme_primary_color") {
        // primary ต้อง sync กับ sidebar-primary-foreground ด้วย
        if (fg) root.style.setProperty("--sidebar-primary-foreground", fg);
        else root.style.removeProperty("--sidebar-primary-foreground");
      }
      if (fgVar) {
        if (fg) root.style.setProperty(fgVar, fg);
        else root.style.removeProperty(fgVar);
      }
    }
  }, [
    (settings as any)?.theme_primary_color,
    (settings as any)?.theme_secondary_color,
    (settings as any)?.theme_accent_color,
    (settings as any)?.theme_success_color,
    (settings as any)?.theme_warning_color,
    (settings as any)?.theme_info_color,
    (settings as any)?.theme_destructive_color,
  ]);
}
