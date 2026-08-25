import { useEffect, useMemo, useRef, useState } from "react";
import { loadArViewer } from "@/lib/mindAr";
import { resolveArUrl } from "@/lib/arMedia";
import { Button } from "@/components/ui/button";
import { X, Volume2, VolumeX, ScanLine, Loader2 } from "lucide-react";

export interface TrackedItem {
  id: string;
  title: string;
  marker_label?: string | null;
  media_type: string;
  media_url: string;
  poster_url?: string | null;
  target_index: number | null;
  overlay_width?: number | null;
  overlay_height?: number | null;
  loop_media?: boolean | null;
  muted?: boolean | null;
}

interface Props {
  targetsUrl: string;
  items: TrackedItem[];
  title?: string;
  onClose: () => void;
}

/** ฉากสแกนป้าย/วัตถุจริง — พบเป้าหมายแล้วเล่นสื่อทับทันที และหยุดเมื่อหลุดเฟรม */
export default function ArImageTracker({ targetsUrl, items, title, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [found, setFound] = useState<TrackedItem | null>(null);
  const [muted, setMuted] = useState(true);

  const tracked = useMemo(
    () => items.filter((i) => i.target_index !== null && i.target_index !== undefined),
    [items]
  );

  useEffect(() => {
    let disposed = false;
    let sceneEl: any = null;

    (async () => {
      try {
        await loadArViewer();
        const mindUrl = await resolveArUrl(targetsUrl);
        if (!mindUrl) throw new Error("ยังไม่ได้สร้างไฟล์เป้าหมายของงานนี้");

        const media = await Promise.all(
          tracked.map(async (i) => ({
            item: i,
            url: await resolveArUrl(i.media_url),
            poster: i.poster_url ? await resolveArUrl(i.poster_url) : "",
          }))
        );
        if (disposed || !hostRef.current) return;

        const assets = media
          .map(({ item, url, poster }) => {
            const id = `armedia-${item.id}`;
            if (item.media_type === "video")
              return `<video id="${id}" src="${url}" ${poster ? `poster="${poster}"` : ""} preload="auto" playsinline webkit-playsinline muted crossorigin="anonymous" ${item.loop_media === false ? "" : "loop"}></video>`;
            if (item.media_type === "image" || item.media_type === "youtube")
              return `<img id="${id}" src="${item.media_type === "youtube" ? poster || url : url}" crossorigin="anonymous" />`;
            return "";
          })
          .join("");

        const entities = media
          .map(({ item, url }) => {
            const w = Number(item.overlay_width) || 1;
            const h = Number(item.overlay_height) || 0.5625;
            const id = `armedia-${item.id}`;
            let inner = "";
            if (item.media_type === "video")
              inner = `<a-video src="#${id}" width="${w}" height="${h}" position="0 0 0.01"></a-video>`;
            else if (item.media_type === "model3d")
              inner = `<a-gltf-model src="url(${url})" scale="${w} ${w} ${w}" position="0 0 0.05" rotation="0 0 0" animation="property: rotation; to: 0 360 0; loop: true; dur: 12000; easing: linear"></a-gltf-model>`;
            else inner = `<a-image src="#${id}" width="${w}" height="${h}" position="0 0 0.01"></a-image>`;
            return `<a-entity data-item="${item.id}" mindar-image-target="targetIndex: ${item.target_index}">${inner}</a-entity>`;
          })
          .join("");

        hostRef.current.innerHTML = `
          <a-scene mindar-image="imageTargetSrc: ${mindUrl}; autoStart: true; uiScanning: no; uiLoading: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.01; missTolerance: 8; warmupTolerance: 2"
                   color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights"
                   vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"
                   embedded style="width:100%;height:100%">
            <a-assets>${assets}</a-assets>
            <a-camera position="0 0 0" look-controls="enabled: false" cursor="fuse: false; rayOrigin: mouse"></a-camera>
            ${entities}
          </a-scene>`;

        sceneEl = hostRef.current.querySelector("a-scene");

        const byId = new Map(media.map((m) => [m.item.id, m.item]));
        hostRef.current.querySelectorAll("[mindar-image-target]").forEach((el) => {
          const item = byId.get((el as HTMLElement).dataset.item || "");
          if (!item) return;
          el.addEventListener("targetFound", () => {
            setFound(item);
            const v = document.getElementById(`armedia-${item.id}`) as HTMLVideoElement | null;
            if (v?.play) { v.currentTime = 0; v.muted = muted || item.muted !== false; v.play().catch(() => {}); }
          });
          el.addEventListener("targetLost", () => {
            setFound((cur) => (cur?.id === item.id ? null : cur));
            const v = document.getElementById(`armedia-${item.id}`) as HTMLVideoElement | null;
            if (v?.pause) v.pause();
          });
        });

        const done = () => !disposed && setStatus("ready");
        if (sceneEl?.hasLoaded) done();
        else sceneEl?.addEventListener("loaded", done);
        setTimeout(done, 6000);
      } catch (e: any) {
        if (disposed) return;
        setError(e?.message || "เปิดกล้อง AR ไม่สำเร็จ");
        setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      try {
        const scene: any = hostRef.current?.querySelector("a-scene");
        scene?.systems?.["mindar-image-system"]?.stop?.();
        scene?.parentNode?.removeChild(scene);
      } catch { /* ignore */ }
      document.querySelectorAll("video").forEach((v) => { if (v.id.startsWith("armedia-")) v.pause(); });
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsUrl, tracked]);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    document.querySelectorAll<HTMLVideoElement>("video[id^='armedia-']").forEach((v) => { v.muted = next; });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <div ref={hostRef} className="absolute inset-0" />

      <div className="absolute top-0 inset-x-0 p-3 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-white text-sm font-medium line-clamp-1">{title || "สแกน AR"}</div>
        <div className="flex gap-2">
          <Button size="icon" variant="secondary" onClick={toggleSound} aria-label="เปิด/ปิดเสียง">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="secondary" onClick={onClose} aria-label="ปิด">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/70">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">กำลังเตรียมกล้องและเป้าหมาย AR...</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/80 p-6 text-center">
          <p className="font-semibold">เปิด AR ไม่สำเร็จ</p>
          <p className="text-sm text-white/70">{error}</p>
          <Button variant="secondary" onClick={onClose}>ปิด</Button>
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-center text-white">
        {found ? (
          <div className="space-y-0.5">
            <div className="font-semibold">{found.title}</div>
            {found.marker_label && <div className="text-xs text-white/70">{found.marker_label}</div>}
          </div>
        ) : (
          status === "ready" && (
            <div className="flex items-center justify-center gap-2 text-sm text-white/80">
              <ScanLine className="h-4 w-4 animate-pulse" />ส่องกล้องไปที่ป้าย/วัตถุ สื่อจะเล่นเองทันที
            </div>
          )
        )}
      </div>
    </div>
  );
}
