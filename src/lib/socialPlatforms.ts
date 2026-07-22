import {
  Facebook, Youtube, Instagram, Globe, MessageCircle, Music2, Twitter, Linkedin, Send, Github, Camera,
  type LucideIcon,
} from "lucide-react";

export type SocialPlatformKey =
  | "facebook" | "youtube" | "tiktok" | "instagram" | "line"
  | "twitter" | "linkedin" | "telegram" | "github" | "threads" | "website";

export interface SocialPlatformMeta {
  key: SocialPlatformKey;
  label: string;
  icon: LucideIcon;
  /** Tailwind gradient classes (from-... via-... to-...) */
  gradient: string;
  /** Solid brand color for icon accent */
  color: string;
  placeholder: string;
}

export const SOCIAL_PLATFORMS: Record<SocialPlatformKey, SocialPlatformMeta> = {
  facebook: {
    key: "facebook", label: "Facebook", icon: Facebook,
    gradient: "from-[#1877F2] via-[#3b82f6] to-[#0866FF]",
    color: "#1877F2",
    placeholder: "https://www.facebook.com/yourpage",
  },
  youtube: {
    key: "youtube", label: "YouTube", icon: Youtube,
    gradient: "from-[#FF0000] via-[#ef4444] to-[#c81d1d]",
    color: "#FF0000",
    placeholder: "https://www.youtube.com/@yourchannel",
  },
  tiktok: {
    key: "tiktok", label: "TikTok", icon: Music2,
    gradient: "from-[#010101] via-[#25F4EE] to-[#FE2C55]",
    color: "#FE2C55",
    placeholder: "https://www.tiktok.com/@yourschool",
  },
  instagram: {
    key: "instagram", label: "Instagram", icon: Instagram,
    gradient: "from-[#feda75] via-[#d62976] to-[#4f5bd5]",
    color: "#E1306C",
    placeholder: "https://www.instagram.com/yourschool",
  },
  line: {
    key: "line", label: "LINE Official", icon: MessageCircle,
    gradient: "from-[#06C755] via-[#22c55e] to-[#059669]",
    color: "#06C755",
    placeholder: "https://line.me/R/ti/p/@yourschool",
  },
  twitter: {
    key: "twitter", label: "X (Twitter)", icon: Twitter,
    gradient: "from-[#0f172a] via-[#334155] to-[#000000]",
    color: "#0f172a",
    placeholder: "https://x.com/yourschool",
  },
  linkedin: {
    key: "linkedin", label: "LinkedIn", icon: Linkedin,
    gradient: "from-[#0A66C2] via-[#0284c7] to-[#075985]",
    color: "#0A66C2",
    placeholder: "https://www.linkedin.com/school/yourschool",
  },
  telegram: {
    key: "telegram", label: "Telegram", icon: Send,
    gradient: "from-[#229ED9] via-[#38bdf8] to-[#0284c7]",
    color: "#229ED9",
    placeholder: "https://t.me/yourchannel",
  },
  github: {
    key: "github", label: "GitHub", icon: Github,
    gradient: "from-[#0f172a] via-[#334155] to-[#111827]",
    color: "#111827",
    placeholder: "https://github.com/yourschool",
  },
  threads: {
    key: "threads", label: "Threads", icon: Camera,
    gradient: "from-[#000000] via-[#404040] to-[#171717]",
    color: "#000000",
    placeholder: "https://www.threads.net/@yourschool",
  },
  website: {
    key: "website", label: "เว็บไซต์", icon: Globe,
    gradient: "from-sky-500 via-blue-500 to-indigo-500",
    color: "#0284c7",
    placeholder: "https://your-school.ac.th",
  },
};

export const PLATFORM_ORDER: SocialPlatformKey[] = [
  "facebook", "youtube", "tiktok", "instagram", "line",
  "twitter", "linkedin", "telegram", "threads", "github", "website",
];

export interface SocialLink {
  id: string;              // uuid-like
  platform: SocialPlatformKey;
  label?: string;          // optional custom name (defaults to platform label)
  url: string;
  handle?: string;         // optional @handle / display text
  active?: boolean;
  /** Show embedded content (iframe) instead of just a button link */
  embed?: boolean;
}

export const SOCIAL_LINKS_SETTING_KEY = "social_media_links";

/**
 * Normalize a URL for embed-friendliness. Strips tracking params, unifies host,
 * and rewrites obvious mobile/short forms to their canonical embeddable form.
 * Returns { url, platform, note } — `note` explains any change/limitation.
 */
export function normalizeSocialUrl(rawUrl: string, hintPlatform?: SocialPlatformKey): {
  url: string;
  platform: SocialPlatformKey;
  note?: string;
  warning?: string;
} {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return { url: "", platform: hintPlatform ?? "website" };
  let u: URL;
  try { u = new URL(trimmed); } catch {
    return { url: trimmed, platform: hintPlatform ?? "website", warning: "URL ไม่ถูกต้อง" };
  }

  // Strip common tracking params
  ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "mibextid", "_rdc", "_rdr"]
    .forEach((k) => u.searchParams.delete(k));

  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "").replace(/^web\./, "");
  u.hostname = host;

  const platform = hintPlatform ?? detectPlatform(u.toString());
  let note: string | undefined;
  let warning: string | undefined;

  // ---------- Facebook ----------
  if (platform === "facebook") {
    // fb.me / fb.com short → keep, provider resolves
    // profile.php?id=XXXX → not embeddable via Page Plugin
    if (u.pathname.includes("profile.php")) {
      warning = "URL นี้เป็นโปรไฟล์ส่วนตัว Facebook ไม่รองรับการฝัง (embed) จะแสดงเป็นปุ่มลิงก์แทน";
    }
    // /share/... short links: keep as-is (Facebook resolves)
    // /watch/?v=ID → normalize path
    if (u.pathname === "/watch/" || u.pathname === "/watch") {
      const v = u.searchParams.get("v");
      if (v) note = "รองรับการฝังโพสต์วิดีโอ";
    }
  }

  // ---------- TikTok ----------
  if (platform === "tiktok") {
    // vm.tiktok.com/xxx or vt.tiktok.com/xxx → short links, keep
    if (/^(vm|vt)\.tiktok\.com$/.test(u.hostname)) {
      warning = "ลิงก์ย่อ TikTok ไม่สามารถฝังตรงได้ กรุณาวาง URL เต็มของวิดีโอ (/@user/video/ID)";
    } else {
      // Rewrite hostname to www.tiktok.com
      u.hostname = "tiktok.com";
      // Profile only: /@user (no /video/) → cannot embed
      if (/^\/@[^/]+\/?$/.test(u.pathname)) {
        warning = "URL นี้เป็นโปรไฟล์ TikTok ไม่รองรับการฝัง จะแสดงเป็นปุ่มลิงก์แทน (ต้องใช้ URL วิดีโอ)";
      }
    }
  }

  // ---------- YouTube ----------
  if (platform === "youtube") {
    // youtu.be/ID?t=xx → keep, embed handles it
    // /shorts/ID → ok
    // Strip 'feature' param
    ["feature", "si", "pp"].forEach((k) => u.searchParams.delete(k));
  }

  return { url: u.toString(), platform, note, warning };
}

export function detectPlatform(url: string): SocialPlatformKey {
  const u = url.toLowerCase();
  if (u.includes("facebook.com") || u.includes("fb.com") || u.includes("fb.me")) return "facebook";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("line.me") || u.includes("lin.ee")) return "line";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("t.me") || u.includes("telegram")) return "telegram";
  if (u.includes("threads.net")) return "threads";
  if (u.includes("github.com")) return "github";
  return "website";
}

/** Platforms that support free iframe embed (no token required) */
export const EMBEDDABLE_PLATFORMS: SocialPlatformKey[] = ["youtube", "facebook", "tiktok"];

export function canEmbed(link: Pick<SocialLink, "platform" | "url">): boolean {
  return !!getEmbedUrl(link);
}

/**
 * Build a free-embed iframe URL for supported platforms.
 * - YouTube: watch?v=ID / youtu.be/ID / /embed/ID  → embed player
 *            /@handle or /channel/UCxxx           → uploads playlist player
 * - Facebook: page URL → Page Plugin (timeline tab)
 * - TikTok: /video/ID → oEmbed player
 */
export function getEmbedUrl(link: Pick<SocialLink, "platform" | "url">): string | null {
  const url = (link.url || "").trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname;

    if (link.platform === "youtube") {
      // youtu.be/<id>
      if (host === "youtu.be") {
        const id = path.slice(1).split("/")[0];
        return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
      }
      // /watch?v=<id>
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}?rel=0`;
      // /embed/<id>
      const em = path.match(/\/embed\/([^/?#]+)/);
      if (em) return `https://www.youtube.com/embed/${em[1]}?rel=0`;
      // /shorts/<id>
      const sh = path.match(/\/shorts\/([^/?#]+)/);
      if (sh) return `https://www.youtube.com/embed/${sh[1]}?rel=0`;
      // /channel/UCxxx  → uploads playlist (UU + rest of channel ID)
      const ch = path.match(/\/channel\/(UC[^/?#]+)/);
      if (ch) {
        const playlistId = "UU" + ch[1].slice(2);
        return `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
      }
      // /@handle  → uploads via handle (works in modern embed)
      const h = path.match(/\/@([^/?#]+)/);
      if (h) {
        return `https://www.youtube.com/embed?listType=user_uploads&list=${h[1]}`;
      }
      return null;
    }

    if (link.platform === "facebook") {
      // Page Plugin รองรับเฉพาะ "Page" ไม่รองรับโปรไฟล์ส่วนตัว (profile.php?id=...)
      // และไม่รองรับโพสต์เดี่ยว (/posts/, /videos/, /photos/, /watch/)
      const lower = (path + u.search).toLowerCase();
      if (lower.includes("profile.php")) return null;
      // โพสต์/วิดีโอ/รูป เดี่ยว → ใช้ Post Plugin แทน Page Plugin
      if (/\/(posts|videos|photos|watch|reel|share)\//.test(lower) || u.searchParams.has("v")) {
        const href = encodeURIComponent(url);
        return `https://www.facebook.com/plugins/post.php?href=${href}&width=380&show_text=true`;
      }
      const href = encodeURIComponent(url);
      return `https://www.facebook.com/plugins/page.php?href=${href}&tabs=timeline&width=380&height=500&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`;
    }

    if (link.platform === "tiktok") {
      // /@user/video/<id>  → single video player (embed only)
      const m = path.match(/\/video\/(\d+)/);
      if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`;
      // NOTE: profile embeds (/embed/@user) are heavily rate-limited by TikTok
      // and frequently return "overload-protect triggered". Fall back to link.
      return null;
    }
  } catch {
    return null;
  }
  return null;
}
