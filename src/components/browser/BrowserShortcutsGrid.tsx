import { useState, useMemo } from "react";
import * as LucideIcons from "lucide-react";
import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBrowserShortcuts, openBrowserUrl, type BrowserShortcut } from "@/hooks/useBrowserShortcuts";

function getHost(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

/**
 * Map โดเมน → slug ของ simple-icons (ให้โลโก้ brand จริงพร้อมสี)
 * ใช้ CDN https://cdn.simpleicons.org/{slug} ที่คืน SVG โลโก้แบรนด์แท้
 */
const BRAND_SLUGS: Record<string, string> = {
  "translate.google.com": "googletranslate",
  "maps.google.com": "googlemaps",
  "docs.google.com": "googledocs",
  "sheets.google.com": "googlesheets",
  "slides.google.com": "googleslides",
  "drive.google.com": "googledrive",
  "mail.google.com": "gmail",
  "gmail.com": "gmail",
  "meet.google.com": "googlemeet",
  "calendar.google.com": "googlecalendar",
  "classroom.google.com": "googleclassroom",
  "scholar.google.com": "googlescholar",
  "photos.google.com": "googlephotos",
  "keep.google.com": "googlekeep",
  "forms.google.com": "googleforms",
  "earth.google.com": "googleearth",
  "chrome.google.com": "googlechrome",
  "google.com": "google",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "youtubekids.com": "youtubekids",
  "facebook.com": "facebook",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "twitter.com": "x",
  "x.com": "x",
  "line.me": "line",
  "microsoft.com": "microsoft",
  "office.com": "microsoftoffice",
  "outlook.com": "microsoftoutlook",
  "onedrive.live.com": "microsoftonedrive",
  "chatgpt.com": "openai",
  "openai.com": "openai",
  "claude.ai": "anthropic",
  "gemini.google.com": "googlegemini",
  "github.com": "github",
  "canva.com": "canva",
  "wikipedia.org": "wikipedia",
  "duckduckgo.com": "duckduckgo",
  "bing.com": "bing",
  "yahoo.com": "yahoo",
  "netflix.com": "netflix",
  "spotify.com": "spotify",
  "discord.com": "discord",
  "zoom.us": "zoom",
  "notion.so": "notion",
  "figma.com": "figma",
  "kahoot.it": "kahoot",
  "kahoot.com": "kahoot",
  "quizizz.com": "quizizz",
  "wordwall.net": "wordwall",
  "padlet.com": "padlet",
  "khan-academy.org": "khanacademy",
  "khanacademy.org": "khanacademy",
  "coursera.org": "coursera",
  "udemy.com": "udemy",
  "duolingo.com": "duolingo",
};

function resolveBrandSlug(host: string): string | null {
  if (BRAND_SLUGS[host]) return BRAND_SLUGS[host];
  // parent domain match (fallback สำหรับ subdomain ไม่ระบุ)
  const parts = host.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (BRAND_SLUGS[parent]) return BRAND_SLUGS[parent];
  }
  return null;
}

function ShortcutLogo({ s }: { s: BrowserShortcut }) {
  const [errorIdx, setErrorIdx] = useState(0);
  const host = getHost(s.target_url);

  // ลำดับ fallback: admin logo → simple-icons (brand จริง) → DuckDuckGo → Google favicon → icon.horse → lucide
  const sources = useMemo(() => {
    const arr: string[] = [];
    if (s.logo_url) arr.push(s.logo_url);
    if (host) {
      const slug = resolveBrandSlug(host);
      if (slug) arr.push(`https://cdn.simpleicons.org/${slug}`);
      arr.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
      arr.push(`https://www.google.com/s2/favicons?domain=${host}&sz=128`);
      arr.push(`https://icon.horse/icon/${host}`);
    }
    return arr;
  }, [s.logo_url, host]);


  if (errorIdx < sources.length) {
    return (
      <img
        src={sources[errorIdx]}
        alt=""
        loading="lazy"
        onError={() => setErrorIdx((i) => i + 1)}
        className="w-full h-full object-contain"
      />
    );
  }
  const Comp = (s.icon && (LucideIcons as any)[s.icon]) || Globe;
  return <Comp className="w-6 h-6 text-white" />;
}


type Props = {
  /** limit จำนวนที่แสดง (สำหรับ sidebar/agent tab) */
  limit?: number;
  /** compact grid (agent page ใช้ 4 คอลัมน์) */
  compact?: boolean;
  /** ข้อความเมื่อไม่มี shortcut */
  emptyText?: string;
};

/**
 * กริดปุ่มลัดเว็บ — ใช้ร่วม Agent page, Browser page, Sidebar
 * ดึงข้อมูลจาก browser_shortcuts table (admin จัดการที่เดียว)
 */
export default function BrowserShortcutsGrid({ limit, compact, emptyText }: Props) {
  const { lang } = useLanguage();
  const { shortcuts, isLoading } = useBrowserShortcuts();

  const items: BrowserShortcut[] = limit ? shortcuts.slice(0, limit) : shortcuts;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-6">กำลังโหลด...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        {emptyText || (lang === "th" ? "ยังไม่มีปุ่มลัด" : "No shortcuts yet")}
      </div>
    );
  }

  const gridCls = compact
    ? "grid grid-cols-2 md:grid-cols-4 gap-2"
    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3";

  return (
    <div className={gridCls}>
      {items.map((s) => (
        <button
          key={s.id}
          onClick={() => openBrowserUrl(s.target_url)}
          className="group flex flex-col items-center gap-2 p-3 rounded-2xl border bg-background hover:bg-accent hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <div className="w-14 h-14 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ShortcutLogo s={s} />
          </div>
          <span className="text-xs font-medium text-center line-clamp-1">
            {lang === "th" ? s.label_th : s.label_en}
          </span>
        </button>
      ))}
    </div>
  );
}
