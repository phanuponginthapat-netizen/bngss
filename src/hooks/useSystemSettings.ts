import { useEffect } from "react";
import { useCmsSettingsBulk } from "./useCmsSettings";

export function useSystemSettings() {
  const { data: settings } = useCmsSettingsBulk();

  // Dynamically update document title
  useEffect(() => {
    if (settings?.app_name) {
      document.title = settings.app_name;
    }
  }, [settings?.app_name]);

  // Dynamically update favicon, apple-touch-icon, and PWA manifest icons
  useEffect(() => {
    const iconUrl = settings?.app_favicon_url || settings?.school_logo;
    if (!iconUrl) return;

    const setLink = (rel: string, sizes?: string) => {
      const selector = sizes
        ? `link[rel='${rel}'][sizes='${sizes}']`
        : `link[rel='${rel}']`;
      let link = document.querySelector(selector) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        if (sizes) link.setAttribute("sizes", sizes);
        document.head.appendChild(link);
      }
      link.href = iconUrl;
    };

    setLink("icon");
    setLink("shortcut icon");
    setLink("apple-touch-icon");
    setLink("apple-touch-icon", "180x180");

    // ⚠️ ห้ามสร้าง manifest แบบ blob: URL ที่เปลี่ยนทุก reload — Android WebAPK / iOS
    // จะถือว่าเป็นแอปคนละตัวและถอนติดตั้งอัตโนมัติ ใช้ /manifest.json คงที่แทน
    // (dynamicManifest.ts จะเป็นตัวจัดการ link[rel=manifest] แล้ว)
  }, [settings?.app_favicon_url, settings?.school_logo, settings?.app_name, settings?.app_short_name]);

  // Cache branding for the initial HTML loader (index.html reads this before React mounts)
  useEffect(() => {
    if (!settings) return;
    try {
      const logo = settings.app_favicon_url || settings.school_logo || "";
      const name = settings.app_name || settings.school_name || "";
      const themeColor = (settings as any).theme_color || (settings as any).app_theme_color || "";
      if (logo || name || themeColor) {
        localStorage.setItem(
          "cms_branding_cache",
          JSON.stringify({ logo, name, themeColor }),
        );
      }
    } catch {}
  }, [settings?.app_favicon_url, settings?.school_logo, settings?.app_name, settings?.school_name]);

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
