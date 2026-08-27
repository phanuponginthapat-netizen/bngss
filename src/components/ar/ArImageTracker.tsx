import { useEffect, useMemo, useRef, useState } from "react";
import { loadArViewer } from "@/lib/mindAr";
import { resolveArUrl } from "@/lib/arMedia";
import { Button } from "@/components/ui/button";
import { X, Volume2, VolumeX, ScanLine, Camera, CheckCircle2 } from "lucide-react";
import { useCmsValues } from "@/hooks/useCmsSettings";

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

type Phase = "camera" | "engine" | "targets" | "media" | "warmup" | "ready" | "error";

const PHASE_TEXT: Record<Exclude<Phase, "ready" | "error">, string> = {
  camera: "กำลังขออนุญาตใช้กล้อง",
  engine: "กำลังโหลดเอนจิน AR",
  targets: "กำลังโหลดเป้าหมายของงานนี้",
  media: "กำลังเตรียมสื่อให้พร้อมเล่นทันที",
  warmup: "กำลังปรับโฟกัสกล้อง",
};
const PHASE_PCT: Record<Exclude<Phase, "ready" | "error">, number> = {
  camera: 15, engine: 40, targets: 62, media: 84, warmup: 95,
};

/** ฉากสแกนป้าย/วัตถุจริง — เตรียมทุกอย่างให้พร้อมก่อน แล้วพบเป้าหมายเล่นสื่อทับทันที */
export default function ArImageTracker({ targetsUrl, items, title, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("camera");
  const [error, setError] = useState("");
  const [found, setFound] = useState<TrackedItem | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const cms = useCmsValues(["school_logo", "school_name", "app_name"]);

  const tracked = useMemo(
    () => items.filter((i) => i.target_index !== null && i.target_index !== undefined),
    [items]
  );

  useEffect(() => {
    let disposed = false;
    let sceneEl: any = null;

    (async () => {
      try {
        // 1) อุ่นเครื่องกล้องก่อน — ขอสิทธิ์ล่วงหน้าให้ MindAR เปิดกล้องได้ทันที ไม่ต้องรอ prompt
        setPhase("camera");
        try {
          const warm = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          warm.getTracks().forEach((t) => t.stop());
        } catch {
          throw new Error("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์");
        }
        if (disposed) return;

        // 2) เอนจิน AR
        setPhase("engine");
        await loadArViewer();
        if (disposed) return;

        // 3) ไฟล์เป้าหมาย (.mind) — ดึงมาไว้ในแคชเบราว์เซอร์ก่อน เพื่อให้ MindAR เริ่มจับได้เร็ว
        setPhase("targets");
        const mindUrl = await resolveArUrl(targetsUrl);
        if (!mindUrl) throw new Error("ยังไม่ได้สร้างไฟล์เป้าหมายของงานนี้");
        try { await fetch(mindUrl, { mode: "cors", cache: "force-cache" }); } catch { /* ไม่ critical */ }
        if (disposed) return;

        // 4) สื่อทั้งหมด
        setPhase("media");
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
              return `<video id="${id}" src="${url}" ${poster ? `poster="${poster}"` : ""} preload="auto" muted playsinline webkit-playsinline crossorigin="anonymous" ${item.loop_media === false ? "" : "loop"}></video>`;
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

        // uiScanning/uiLoading ปิด เพราะเราทำ overlay เอง
        // autoStart: false → เริ่มจับภาพเองหลังทุกอย่างพร้อม เพื่อให้ "ส่องปุ๊บติดปั๊บ"
        hostRef.current.innerHTML = `
          <a-scene mindar-image="imageTargetSrc: ${mindUrl}; autoStart: false; uiScanning: no; uiLoading: no; uiError: no; filterMinCF: 0.001; filterBeta: 1000; missTolerance: 5; warmupTolerance: 1"
                   color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights"
                   vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"
                   embedded>
            <a-assets timeout="12000">${assets}</a-assets>
            <a-camera position="0 0 0" look-controls="enabled: false" cursor="fuse: false; rayOrigin: mouse"></a-camera>
            ${entities}
          </a-scene>`;

        sceneEl = hostRef.current.querySelector("a-scene");

        const byId = new Map(media.map((m) => [m.item.id, m.item]));
        // ปลดล็อกเสียงครั้งเดียวด้วย gesture ที่ผู้ใช้กดเปิด AR — ป้ายถัดไปจะมีเสียงเองทุกครั้ง
        const unlockAudio = async () => {
          const vids = Array.from(document.querySelectorAll<HTMLVideoElement>("video[id^='armedia-']"));
          for (const v of vids) {
            try {
              v.muted = true;
              await v.play();
              v.pause();
              v.currentTime = 0;
              v.muted = mutedRef.current;
            } catch { /* ไม่ critical */ }
          }
          audioUnlockedRef.current = true;
        };

        const playWithSound = async (v: HTMLVideoElement) => {
          v.currentTime = 0;
          v.muted = mutedRef.current;
          v.volume = 1;
          try {
            await v.play();
          } catch {
            // เบราว์เซอร์บล็อกเสียง → เล่นแบบเงียบไว้ก่อน แล้วลองเปิดเสียงซ้ำ
            try {
              v.muted = true;
              await v.play();
              if (!mutedRef.current) {
                v.muted = false;
                if (v.paused) await v.play().catch(() => {});
              }
            } catch { /* ignore */ }
          }
        };

        hostRef.current.querySelectorAll("[mindar-image-target]").forEach((el) => {
          const item = byId.get((el as HTMLElement).dataset.item || "");
          if (!item) return;
          el.addEventListener("targetFound", () => {
            setFound(item);
            const v = document.getElementById(`armedia-${item.id}`) as HTMLVideoElement | null;
            if (v?.play) void playWithSound(v);
          });
          el.addEventListener("targetLost", () => {
            setFound((cur) => (cur?.id === item.id ? null : cur));
            const v = document.getElementById(`armedia-${item.id}`) as HTMLVideoElement | null;
            if (v?.pause) { v.pause(); v.muted = mutedRef.current; }
          });
        });


        // รอ scene พร้อม → สั่งเริ่มจับภาพ → ค่อยเปิดหน้าจอสแกน
        const waitLoaded = () =>
          new Promise<void>((resolve) => {
            if (sceneEl?.hasLoaded) return resolve();
            sceneEl?.addEventListener("loaded", () => resolve(), { once: true });
            setTimeout(resolve, 8000);
          });
        await waitLoaded();
        if (disposed) return;

        setPhase("warmup");
        const system = sceneEl?.systems?.["mindar-image-system"];
        const ready = new Promise<void>((resolve) => {
          sceneEl?.addEventListener("arReady", () => resolve(), { once: true });
          setTimeout(resolve, 6000);
        });
        try { await system?.start?.(); } catch { /* บาง build เริ่มเองแล้ว */ }
        await ready;
        if (!disposed) setPhase("ready");
      } catch (e: any) {
        if (disposed) return;
        setError(e?.message || "เปิดกล้อง AR ไม่สำเร็จ");
        setPhase("error");
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
      hostRef.current?.querySelectorAll("video").forEach((v) => {
        try { (v.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      });
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsUrl, tracked]);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    document.querySelectorAll<HTMLVideoElement>("video[id^='armedia-']").forEach((v) => { v.muted = next; });
  };

  const loading = phase !== "ready" && phase !== "error";
  const brandName = cms.school_name || cms.app_name || "แหล่งเรียนรู้ AR";

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      {/* กล้องเต็มจอ — บังคับ video/canvas ของ MindAR ให้ครอบเต็มพื้นที่ */}
      <style>{`
        .ar-stage { position:absolute; inset:0; overflow:hidden; }
        .ar-stage > video,
        .ar-stage a-scene > video,
        .ar-stage video:not([id^="armedia-"]) {
          position:absolute !important; top:50% !important; left:50% !important;
          transform:translate(-50%,-50%) !important;
          min-width:100% !important; min-height:100% !important;
          width:auto !important; height:auto !important;
          object-fit:cover !important;
        }
        .ar-stage a-scene, .ar-stage .a-canvas, .ar-stage canvas.a-canvas {
          position:absolute !important; inset:0 !important;
          width:100% !important; height:100% !important;
        }
        .ar-stage .a-loader-title, .ar-stage .mindar-ui-overlay { display:none !important; }
        .ar-stage video[id^="armedia-"] { display:none !important; }
        @keyframes ar-sweep { 0%{transform:translateY(-46%)} 50%{transform:translateY(46%)} 100%{transform:translateY(-46%)} }
      `}</style>

      <div ref={hostRef} className="ar-stage" />

      {/* กรอบเล็งเป้า */}
      {phase === "ready" && !found && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-[78vw] max-w-md aspect-[4/3]">
            {[
              "top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
              "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
              "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
              "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl",
            ].map((c) => (
              <span key={c} className={`absolute h-10 w-10 border-primary/90 ${c}`} />
            ))}
            <span
              className="absolute inset-x-6 h-0.5 top-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
              style={{ animation: "ar-sweep 2.4s ease-in-out infinite" }}
            />
          </div>
        </div>
      )}

      {/* แถบบน — แบรนด์จาก CMS */}
      <div className="absolute top-0 inset-x-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-3 bg-gradient-to-b from-foreground/70 via-foreground/30 to-transparent">
        {cms.school_logo && (
          <img src={cms.school_logo} alt={brandName} className="h-9 w-9 rounded-full bg-background/90 object-contain p-0.5 shadow" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-background text-sm font-semibold leading-tight line-clamp-1 drop-shadow">{title || "สแกน AR"}</div>
          <div className="text-background/70 text-[11px] leading-tight line-clamp-1">{brandName}</div>
        </div>
        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9 backdrop-blur" onClick={toggleSound} aria-label="เปิด/ปิดเสียง">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9 backdrop-blur" onClick={onClose} aria-label="ปิด">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* หน้าจอเตรียมพร้อม */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background/95 backdrop-blur-sm p-8 text-center">
          <div className="relative">
            <span className="absolute inset-0 rounded-3xl bg-primary/20 blur-2xl" />
            {cms.school_logo ? (
              <img src={cms.school_logo} alt={brandName} className="relative h-20 w-20 object-contain animate-pulse" />
            ) : (
              <Camera className="relative h-16 w-16 text-primary animate-pulse" />
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">{title || "กำลังเตรียมสแกน AR"}</h2>
            <p className="text-sm text-muted-foreground">{PHASE_TEXT[phase as keyof typeof PHASE_TEXT]}…</p>
          </div>
          <div className="w-full max-w-xs h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
              style={{ width: `${PHASE_PCT[phase as keyof typeof PHASE_PCT]}%` }}
            />
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            {(["camera", "engine", "targets", "media", "warmup"] as const).map((p) => {
              const done = PHASE_PCT[p] < PHASE_PCT[phase as keyof typeof PHASE_PCT];
              return (
                <li key={p} className={`flex items-center gap-2 ${done ? "text-primary" : ""}`}>
                  <CheckCircle2 className={`h-3.5 w-3.5 ${done ? "opacity-100" : "opacity-25"}`} />
                  {PHASE_TEXT[p]}
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground max-w-xs">เตรียมให้พร้อมก่อน เพื่อให้ส่องกล้องแล้วสื่อเล่นทันที</p>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/95 p-8 text-center">
          <Camera className="h-12 w-12 text-destructive" />
          <div className="space-y-1">
            <p className="font-semibold">เปิด AR ไม่สำเร็จ</p>
            <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
          </div>
          <Button variant="outline" onClick={onClose}>ปิด</Button>
        </div>
      )}

      {/* แถบล่าง */}
      {!loading && phase !== "error" && (
        <div className="absolute bottom-0 inset-x-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-foreground/75 to-transparent text-center">
          {found ? (
            <div className="inline-flex flex-col items-center gap-0.5 rounded-2xl bg-background/90 px-5 py-2.5 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />{found.title}
              </div>
              {found.marker_label && <div className="text-xs text-muted-foreground">{found.marker_label}</div>}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-background/85 px-4 py-2 text-sm font-medium shadow backdrop-blur">
              <ScanLine className="h-4 w-4 text-primary animate-pulse" />
              ส่องกล้องไปที่ป้าย/วัตถุ — สื่อจะเล่นเองทันที
            </div>
          )}
        </div>
      )}
    </div>
  );
}
