// Detect YouTube/Facebook/TikTok URLs and return an embeddable iframe URL.
export type LiveEmbed = {
  provider: "youtube" | "facebook" | "tiktok" | "twitch" | "unknown";
  embedUrl: string | null;
  originalUrl: string;
};

export function parseLiveEmbed(rawUrl: string | null | undefined): LiveEmbed | null {
  if (!rawUrl) return null;
  const url = rawUrl.trim();
  if (!url) return null;

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    // YouTube — handles watch, youtu.be, live, shorts, embed, channel live
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      let id: string | null = null;
      if (host === "youtu.be") {
        id = u.pathname.slice(1).split("/")[0] || null;
      } else if (u.pathname === "/watch") {
        id = u.searchParams.get("v");
      } else if (u.pathname.startsWith("/live/") || u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/")) {
        id = u.pathname.split("/")[2] || null;
      }
      if (id) {
        return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}?rel=0`, originalUrl: url };
      }
      // Channel live: https://youtube.com/@handle/live → use channel live URL embed via uchannel
      const liveMatch = u.pathname.match(/^\/@([^/]+)\/live\/?$/);
      if (liveMatch) {
        return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/live_stream?channel=${liveMatch[1]}`, originalUrl: url };
      }
      return { provider: "youtube", embedUrl: null, originalUrl: url };
    }

    // Facebook — videos / live
    if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch" || host === "fb.com") {
      const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`;
      return { provider: "facebook", embedUrl, originalUrl: url };
    }

    // TikTok — /@user/video/{id} or /v/{id}
    if (host === "tiktok.com" || host === "vm.tiktok.com") {
      const videoMatch = u.pathname.match(/\/video\/(\d+)/);
      const vMatch = u.pathname.match(/^\/v\/(\d+)/);
      const id = videoMatch?.[1] || vMatch?.[1];
      if (id) {
        return { provider: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${id}`, originalUrl: url };
      }
      return { provider: "tiktok", embedUrl: null, originalUrl: url };
    }

    // Twitch (bonus)
    if (host === "twitch.tv") {
      const channel = u.pathname.split("/").filter(Boolean)[0];
      if (channel) {
        const parent = typeof window !== "undefined" ? window.location.hostname : "lovable.app";
        return { provider: "twitch", embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${parent}`, originalUrl: url };
      }
    }

    return { provider: "unknown", embedUrl: null, originalUrl: url };
  } catch {
    return null;
  }
}
