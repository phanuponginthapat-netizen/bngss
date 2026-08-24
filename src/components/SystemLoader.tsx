import { useEffect, useMemo, useState } from "react";
import { DoorOpen } from "lucide-react";

const getBranding = () => {
  if (typeof window === "undefined") return null as any;
  const w = (window as any).__branding;
  if (w) return w;
  try {
    const raw = localStorage.getItem("cms_branding_cache");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const isKioskRoute = () => {
  if (typeof window === "undefined") return false;
  return /^\/(kiosk|face-kiosk)(\/|$)/i.test(window.location.pathname) || /^\/kiosk-/i.test(window.location.pathname);
};

const KioskLoader = () => (
  <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.12),transparent_60%)]" />
    <div className="relative flex flex-col items-center gap-5 px-8">
      <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl flex items-center justify-center border border-slate-700/50 animate-float">
        <DoorOpen className="w-12 h-12 text-sky-400" />
        <div className="absolute inset-0 rounded-2xl bg-sky-400/20 blur-xl animate-pulse-soft" />
      </div>
      <div className="text-white text-xl font-bold tracking-tight text-center">ตู้สแกนหน้า</div>
      <div className="w-56 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-emerald-400 animate-[loader-slide_1.4s_ease-in-out_infinite]" />
      </div>
      <div className="text-slate-400 text-sm font-medium tracking-wide flex items-center gap-1.5">
        กำลังโหลดระบบ
        <span className="inline-flex gap-1 ml-1">
          <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-sky-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
      </div>
    </div>
    <style>{`
      @keyframes loader-slide {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
    `}</style>
  </div>
);

const SystemLoader = () => {
  const [b, setBranding] = useState<any>(() => getBranding());
  const kiosk = useMemo(() => isKioskRoute(), []);

  useEffect(() => {
    const onBrandingReady = (event: Event) => {
      setBranding((event as CustomEvent).detail || getBranding());
    };
    window.addEventListener("branding:ready", onBrandingReady);
    setBranding(getBranding());
    return () => window.removeEventListener("branding:ready", onBrandingReady);
  }, []);

  if (kiosk) return <KioskLoader />;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-100 via-sky-50 to-rose-100">
      {/* soft floating blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-sky-300/40 blur-3xl animate-float" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-[28rem] h-[28rem] rounded-full bg-rose-300/40 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
      <div className="pointer-events-none absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-peach-200/50 blur-3xl animate-float" style={{ animationDelay: "2s", background: "radial-gradient(circle, rgba(254,202,202,0.6), transparent 70%)" }} />

      {/* tiny sparkles */}
      <div className="pointer-events-none absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse-soft"
            style={{
              top: `${(i * 53) % 90 + 5}%`,
              left: `${(i * 37) % 90 + 5}%`,
              animationDelay: `${i * 0.3}s`,
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
            }}
          />
        ))}
      </div>

      <div className="relative bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2rem] px-10 py-9 flex flex-col items-center gap-5 shadow-[0_20px_60px_-20px_rgba(56,189,248,0.45)] max-w-sm mx-4">
        {b?.logo ? (
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-300 to-rose-200 blur-xl opacity-70 animate-pulse-soft" />
            <img
              src={b.logo}
              alt="logo"
              className="relative w-24 h-24 rounded-full object-contain bg-white/90 p-2 ring-4 ring-white shadow-lg animate-float"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-400 to-rose-300 animate-float shadow-lg" />
        )}

        {b?.name && (
          <div className="text-slate-800 text-lg font-bold text-center max-w-[260px] leading-snug" style={{ fontFamily: "Outfit, sans-serif" }}>
            {b.name}
          </div>
        )}

        {/* cute progress bar */}
        <div className="w-56 h-2 rounded-full bg-sky-100 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-sky-400 via-sky-300 to-rose-300 animate-[gradient-shift_2s_ease_infinite] bg-[length:200%_100%]" style={{ animation: "loader-slide 1.4s ease-in-out infinite" }} />
        </div>

        <div className="text-slate-600 text-sm font-medium tracking-wide flex items-center gap-1.5">
          กำลังโหลดระบบ
          <span className="inline-flex gap-1 ml-1">
            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-sky-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>

      <style>{`
        @keyframes loader-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default SystemLoader;
