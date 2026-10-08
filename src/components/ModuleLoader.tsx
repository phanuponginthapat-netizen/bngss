import { useEffect, useState } from "react";

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

/**
 * หน้าโหลดในพื้นที่เนื้อหา (เมนูด้านข้างยังอยู่) — สไตล์เดียวกับหน้าโหลดตอนเข้าระบบ
 * ถ้าเกิน 4 วินาทีจะบอกผู้ใช้ว่ายังโหลดอยู่
 */
export default function ModuleLoader({ label = "กำลังเปิดหน้า" }: { label?: string }) {
  const [slow, setSlow] = useState(false);
  const [b] = useState<any>(() => getBranding());
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div role="status" aria-live="polite" className="relative flex min-h-[60vh] items-center justify-center overflow-hidden rounded-3xl">
      <div className="fixed left-0 right-0 top-0 z-[60] h-1 overflow-hidden bg-sky-100">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-sky-400 to-rose-300" style={{ animation: "ml-slide 1.2s ease-in-out infinite" }} />
      </div>

      <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-sky-300/35 blur-3xl animate-float" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-rose-300/35 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
      {[...Array(6)].map((_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-white animate-pulse-soft"
          style={{ top: `${(i * 53) % 85 + 8}%`, left: `${(i * 37) % 85 + 8}%`, animationDelay: `${i * 0.3}s`, boxShadow: "0 0 8px rgba(255,255,255,0.9)" }}
        />
      ))}

      <div className="relative mx-4 flex max-w-xs flex-col items-center gap-4 rounded-[2rem] border border-white/80 bg-white/70 px-9 py-8 shadow-[0_20px_60px_-20px_rgba(56,189,248,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/60">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-300 to-rose-200 blur-xl opacity-70 animate-pulse-soft" />
          <div className="absolute -inset-2 rounded-full border-2 border-transparent border-t-sky-400 border-r-rose-300" style={{ animation: "ml-spin 1.6s linear infinite" }} />
          {b?.logo ? (
            <img src={b.logo} alt="" className="relative h-20 w-20 rounded-full bg-white/90 object-contain p-2 shadow-lg ring-4 ring-white animate-float" />
          ) : (
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-sky-400 to-rose-300 shadow-lg animate-float" />
          )}
        </div>

        <div className="h-2 w-48 overflow-hidden rounded-full bg-sky-100">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-sky-400 via-sky-300 to-rose-300" style={{ animation: "ml-slide 1.4s ease-in-out infinite" }} />
        </div>

        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
          {label}
          <span className="ml-1 inline-flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-rose-300 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
        {slow && <p className="text-center text-xs text-slate-500">อินเทอร์เน็ตอาจช้า กรุณารอสักครู่</p>}
      </div>

      <style>{`@keyframes ml-slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}@keyframes ml-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
