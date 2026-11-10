import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Button } from "@/components/ui/button";
import { Play, ArrowRight } from "lucide-react";
import { canRevealStartup, STARTUP_INTRO_KEY } from "@/lib/startupIntro";
import videoAsset from "@/assets/loading/school-logo-loading.mp4.asset.json";
import posterAsset from "@/assets/loading/school-logo-poster.jpg.asset.json";

const LoadingContext = createContext<((delta: number) => void) | null>(null);
export function useStartupLoading() {
  const register = useContext(LoadingContext);
  useEffect(() => { register?.(1); return () => register?.(-1); }, [register]);
}
export default function StartupIntro({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(() => {
    if (/^\/(kiosk|face-kiosk)/.test(window.location.pathname) || import.meta.env.VITE_KIOSK_TABLET === "1") return false;
    try { return sessionStorage.getItem(STARTUP_INTRO_KEY) !== "done"; } catch { return true; }
  });
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loaders, setLoaders] = useState(0);
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const fetching = useIsFetching();
  const { isReady } = useAuthSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const register = useCallback((delta: number) => setLoaders(count => Math.max(0, count + delta)), []);
  const ready = canRevealStartup(finished, isReady, loaders, fetching);
  useEffect(() => {
    if (!active || !ready) return;
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(STARTUP_INTRO_KEY, "done"); } catch { /* storage unavailable */ }
      setActive(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [active, ready]);
  useEffect(() => {
    if (!active || reducedMotion) return;
    videoRef.current?.play().catch(() => setBlocked(true));
  }, [active, reducedMotion]);
  const play = () => { setBlocked(false); videoRef.current?.play().catch(() => setBlocked(true)); };
  return <LoadingContext.Provider value={active ? register : null}>
    <div aria-hidden={active || undefined} {...(active ? { inert: "" } : {})}>{children}</div>
    {active && <div className="school-system-loader school-startup-intro" role="dialog" aria-modal="true" aria-label="วิดีโอเปิดระบบ">
      <div className="school-system-loader-media">
        {failed || reducedMotion ? <img src={posterAsset.url} alt="โลโก้โรงเรียน" className="h-full w-full object-contain" /> : <video ref={videoRef} src={videoAsset.url} poster={posterAsset.url} autoPlay muted playsInline preload="auto" onEnded={() => setFinished(true)} onError={() => setFailed(true)} className="h-full w-full object-contain" />}
      </div>
      <div className="school-system-loader-status" role="status" aria-live="polite">
        {finished ? <><p className="text-sm">กำลังเตรียมหน้าแรก</p><div className="school-system-loader-track" aria-hidden="true"><span /></div></> : failed || reducedMotion ? <Button onClick={() => setFinished(true)}><ArrowRight className="w-4 h-4" />เข้าสู่ระบบ</Button> : blocked ? <Button onClick={play}><Play className="w-4 h-4" />เล่นวิดีโอ</Button> : <p className="text-sm">ยินดีต้อนรับ</p>}
      </div>
    </div>}
  </LoadingContext.Provider>;
}