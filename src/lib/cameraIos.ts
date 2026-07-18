// Helpers for iOS Safari camera compatibility.
// iOS requires: playsinline + webkit-playsinline + muted, srcObject set then wait for
// loadedmetadata before play(), and tolerate play() promise rejections.

export async function attachStreamToVideo(video: HTMLVideoElement, stream: MediaStream) {
  try {
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    (video as any).autoplay = true;
    video.srcObject = stream;
    if (video.readyState < 1) {
      await new Promise<void>((resolve) => {
        const done = () => { video.removeEventListener("loadedmetadata", done); resolve(); };
        video.addEventListener("loadedmetadata", done);
        // safety timeout in case event never fires
        setTimeout(done, 1500);
      });
    }
    try { await video.play(); } catch { /* iOS may require user gesture; element still renders */ }
  } catch {
    // best-effort — caller handles upstream errors
  }
}
