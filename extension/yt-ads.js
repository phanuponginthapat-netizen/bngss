// YouTube ad skipper + banner hider (client-side, complements DNR blocking)
(function () {
  // Allow the script on youtube.com AND youtube-nocookie.com embeds (which always run in iframes).
  if (!/(^|\.)youtube(-nocookie)?\.com$/i.test(location.hostname)) return;

  const HIDE_SELECTORS = [
    "ytd-display-ad-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-ad-slot-renderer",
    "ytd-banner-promo-renderer",
    "ytd-promoted-video-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-companion-slot-renderer",
    "ytd-statement-banner-renderer",
    "ytd-mealbar-promo-renderer",
    "#masthead-ad",
    "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
    "ytd-reel-video-renderer:has(.ytd-ad-slot-renderer)",
    ".ytp-ad-overlay-slot",
    ".ytp-ad-image-overlay",
  ];

  const css = document.createElement("style");
  css.textContent = HIDE_SELECTORS.join(",") + "{display:none!important;height:0!important}";
  (document.head || document.documentElement).appendChild(css);

  const originals = new Map();
  const restore = () => {
    for (const [video, state] of originals) {
      video.muted = state.muted; video.playbackRate = state.rate;
    }
    originals.clear();
  };
  window.addEventListener("yt-navigate-start", restore);
  const skipTick = () => {
    // Click skip button when it appears
    document.querySelectorAll(
      ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button"
    ).forEach((b) => { try { b.click(); } catch {} });

    // If an ad is playing, fast-forward the video
    const adShowing = document.querySelector(".html5-video-player.ad-showing");
    if (adShowing) {
      const v = adShowing.querySelector("video");
      if (v && isFinite(v.duration) && v.duration > 0) {
        if (!originals.has(v)) originals.set(v, { muted: v.muted, rate: v.playbackRate });
        try { v.muted = true; v.currentTime = v.duration; v.playbackRate = 16; } catch {}
      }
    } else restore();
    // Close ad overlays
    document.querySelectorAll(".ytp-ad-overlay-close-button").forEach((b) => { try { b.click(); } catch {} });
  };

  setInterval(skipTick, 400);
})();
