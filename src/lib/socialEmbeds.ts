// Helpers for detecting platform from a pasted URL and producing embed iframe URLs.
export type SocialPlatform = "facebook" | "youtube" | "tiktok" | "instagram" | "unknown";

export function detectPlatform(raw: string): SocialPlatform {
  try {
    const url = new URL(raw.trim());
    const h = url.hostname.toLowerCase();
    if (/(^|\.)facebook\.com$/.test(h) || h === "fb.watch" || h === "m.facebook.com") return "facebook";
    if (/(^|\.)youtube\.com$/.test(h) || h === "youtu.be") return "youtube";
    if (/(^|\.)tiktok\.com$/.test(h) || h === "vm.tiktok.com" || h === "vt.tiktok.com") return "tiktok";
    if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function isSupportedSocialUrl(u: string) {
  return detectPlatform(u) !== "unknown";
}

/** YouTube ID จาก URL (รองรับ watch?v=, youtu.be/, shorts/, embed/) */
export function youtubeIdFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    const v = url.searchParams.get("v");
    if (v) return v;
    const m = url.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/);
    if (m) return m[2];
    return null;
  } catch {
    return null;
  }
}

/** TikTok video id จาก URL แบบ /@user/video/<id> */
export function tiktokIdFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const m = url.pathname.match(/\/video\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function fbPostEmbedSrc(postUrl: string, width = 500) {
  return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(postUrl)}&show_text=true&width=${width}`;
}

export function fbPageEmbedSrc(pageUrl: string, width = 500, height = 600) {
  return `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(pageUrl)}&tabs=timeline&width=${width}&height=${height}&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`;
}

export function youtubeEmbedSrc(id: string) {
  return `https://www.youtube.com/embed/${id}`;
}

export function tiktokEmbedSrc(id: string) {
  return `https://www.tiktok.com/embed/v2/${id}`;
}

/** TikTok username (@user) จากลิงก์ช่อง/วิดีโอ */
export function tiktokUsernameFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const m = url.pathname.match(/\/@([A-Za-z0-9._]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** iframe embed สำหรับช่อง TikTok (creator page) */
export function tiktokChannelEmbedSrc(channelUrl: string): string | null {
  const u = tiktokUsernameFromUrl(channelUrl);
  return u ? `https://www.tiktok.com/embed/@${u}` : null;
}

/** iframe embed สำหรับช่อง/เพลย์ลิสต์ YouTube
 *  รองรับ: playlist URL (?list=...), channel URL (/@handle หรือ /channel/UCxxx → embed uploads playlist UU...)
 */
export function youtubeChannelEmbedSrc(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const list = url.searchParams.get("list");
    if (list) return `https://www.youtube.com/embed/videoseries?list=${list}`;
    // /channel/UCxxxx → uploads playlist = UUxxxx (YouTube รองรับ embed แบบนี้)
    const ch = url.pathname.match(/\/channel\/(UC[\w-]+)/);
    if (ch) return `https://www.youtube.com/embed/videoseries?list=UU${ch[1].slice(2)}`;
    // /@handle หรือ /user/xxx — YouTube ไม่อนุญาตให้ embed channel โดยตรง
    // ต้องใช้ playlist URL (?list=...) หรือ channel ID (/channel/UCxxxx) แทน
    return null;
  } catch {
    return null;
  }
}

/** ดึง @handle จาก URL ช่อง YouTube เพื่อใช้แสดงเป็น link card */
export function youtubeHandleFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const m = url.pathname.match(/\/@([\w.-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** คืน iframe src ตามแพลตฟอร์มของลิงก์ที่วาง — null ถ้าไม่รองรับ */
export function postEmbedSrc(url: string): { platform: SocialPlatform; src: string; height: number } | null {
  const p = detectPlatform(url);
  if (p === "facebook") return { platform: p, src: fbPostEmbedSrc(url, 500), height: 1500 };
  if (p === "youtube") {
    const id = youtubeIdFromUrl(url);
    return id ? { platform: p, src: youtubeEmbedSrc(id), height: 315 } : null;
  }
  if (p === "tiktok") {
    const id = tiktokIdFromUrl(url);
    return id ? { platform: p, src: tiktokEmbedSrc(id), height: 1500 } : null;
  }
  return null;
}
