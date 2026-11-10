import { useEffect, useRef, useState } from "react";
import videoAsset from "@/assets/loading/school-logo-loading.mp4.asset.json";
import posterAsset from "@/assets/loading/school-logo-poster.jpg.asset.json";

const SystemLoader = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    video.play().catch(() => setFailed(true));
  }, [reducedMotion]);
  return (
    <div className="school-system-loader" role="status" aria-live="polite" aria-label="กำลังโหลดระบบ">
      <div className="school-system-loader-media" aria-hidden="true">
        {failed || reducedMotion ? <img src={posterAsset.url} alt="" className="h-full w-full object-contain" /> : (
          <video ref={videoRef} src={videoAsset.url} poster={posterAsset.url} autoPlay muted loop playsInline preload="auto" onError={() => setFailed(true)} className="h-full w-full object-contain" />
        )}
      </div>
      <div className="school-system-loader-status">
        <p className="text-sm font-medium">กำลังโหลดระบบ</p>
        <div className="school-system-loader-track" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
};
export default SystemLoader;
