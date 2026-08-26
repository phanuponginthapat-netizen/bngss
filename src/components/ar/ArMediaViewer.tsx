import { createElement, useEffect, useState, useRef } from "react";
import { useArUrl } from "@/lib/arMedia";


/** โหลด <model-viewer> จาก CDN เพียงครั้งเดียว (รองรับ AR บนมือถือ Android/iOS) */
let modelViewerPromise: Promise<void> | null = null;
const loadModelViewer = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (!modelViewerPromise) {
    modelViewerPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.type = "module";
      s.src = "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("โหลดตัวแสดงผล 3D ไม่สำเร็จ"));
      document.head.appendChild(s);
    });
  }
  return modelViewerPromise;
};

const youtubeId = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m?.[1] || "";
};

export interface ArMediaViewerProps {
  mediaType: string;
  mediaUrl: string;
  posterUrl?: string | null;
  title?: string;
  className?: string;
}

export const ArMediaViewer = ({ mediaType, mediaUrl: rawUrl, posterUrl: rawPoster, title, className }: ArMediaViewerProps) => {
  const mediaUrl = useArUrl(rawUrl);
  const posterUrl = useArUrl(rawPoster);
  const [mvReady, setMvReady] = useState(false);
  const [mvError, setMvError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {

    if (mediaType !== "model3d") return;
    let alive = true;
    loadModelViewer()
      .then(() => { if (alive) setMvReady(true); })
      .catch((e) => { if (alive) setMvError(e.message); });
    return () => { alive = false; };
  }, [mediaType]);

  const wrap = "w-full overflow-hidden rounded-xl bg-muted " + (className || "");

  if (rawUrl && !mediaUrl) {
    return <div className={wrap}><div className="p-10 text-center text-sm text-muted-foreground">กำลังเตรียมสื่อ...</div></div>;
  }

  if (mediaType === "image") {

    return (
      <div className={wrap}>
        <img src={mediaUrl} alt={title || "สื่อการเรียนรู้ AR"} loading="lazy" className="w-full h-auto object-contain" />
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <div ref={wrapRef} className={`${wrap} relative group`}>
        <video src={mediaUrl} poster={posterUrl || undefined} controls playsInline preload="metadata" className="w-full h-auto max-h-[70vh]" />
        <button
          type="button"
          onClick={() => { const el = wrapRef.current; if (!el) return; if (document.fullscreenElement === el) document.exitFullscreen().catch(()=>{}); else el.requestFullscreen().catch(()=>{}); }}
          className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur"
          title="เต็มจอ"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    );
  }

  if (mediaType === "youtube") {
    const id = youtubeId(mediaUrl);
    return (
      <div className={wrap}>
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            title={title || "วิดีโอการเรียนรู้"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
      </div>
    );
  }

  // model3d
  return (
    <div className={wrap}>
      {mvError && <div className="p-6 text-center text-sm text-destructive">{mvError}</div>}
      {!mvError && !mvReady && (
        <div className="p-10 text-center text-sm text-muted-foreground">กำลังเตรียมโมเดล 3 มิติ...</div>
      )}
      {mvReady && createElement("model-viewer", {
        src: mediaUrl,
        poster: posterUrl || undefined,
        alt: title || "โมเดล 3 มิติ",
        ar: true,
        "ar-modes": "webxr scene-viewer quick-look",
        "camera-controls": true,
        "touch-action": "pan-y",
        "auto-rotate": true,
        "shadow-intensity": "1",
        style: { width: "100%", height: "min(70vh, 520px)", background: "transparent" },
      })}
    </div>
  );
};

export default ArMediaViewer;
