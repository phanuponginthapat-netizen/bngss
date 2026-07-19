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
}

export const SOCIAL_LINKS_SETTING_KEY = "social_media_links";

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
