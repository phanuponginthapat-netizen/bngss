import { useEffect } from "react";
import { refreshSessionIfNeeded } from "@/lib/sessionRefresh";

export function usePersistentSession() {
  useEffect(() => {
    const refresh = refreshSessionIfNeeded;
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const onOnline = () => refresh();
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    // Native Capacitor resume
    let capSub: any;
    let disposed = false;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("resume", refresh).then(s => { if (disposed) void s.remove(); else capSub = s; }).catch(()=>{});
    }).catch(()=>{});
    // Initial check
    refresh();
    const id = setInterval(refresh, 10 * 60 * 1000);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
      try { capSub?.remove(); } catch {}
    };
  }, []);
}
