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

const SystemLoader = () => {
  const b = getBranding();
  const theme = b?.themeColor || "#2563EB";
  const bg = `linear-gradient(135deg, ${theme}, #1d4ed8, #0ea5e9)`;
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
      <div className="bg-white/15 backdrop-blur-xl border border-white/25 rounded-3xl px-12 py-10 flex flex-col items-center gap-5 shadow-2xl">
        {b?.logo ? (
          <img src={b.logo} alt="logo" className="w-20 h-20 rounded-2xl object-contain drop-shadow-lg" />
        ) : (
          <img
            src="/icon-192.png"
            alt="App logo"
            className="w-20 h-20 rounded-2xl object-contain drop-shadow-lg animate-[scale-in_2s_ease-in-out_infinite]"
          />
        )}
        {b?.name && (
          <div className="text-white text-lg font-bold text-center max-w-[280px] leading-tight">
            {b.name}
          </div>
        )}
        <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        <div className="text-white/90 text-base font-medium tracking-wide animate-[fade-in_2s_ease-in-out_infinite]">
          กำลังโหลดระบบ
          <span className="inline-flex gap-1 ml-1.5">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default SystemLoader;
