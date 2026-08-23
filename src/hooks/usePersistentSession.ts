import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePersistentSession() {
  useEffect(() => {
    const refresh = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        // Refresh if expires in 5 min or already expired
        if (expiresAt && Date.now() > expiresAt - 5 * 60 * 1000) {
          await supabase.auth.refreshSession();
        }
      } catch {}
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const onOnline = () => refresh();
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    // Native Capacitor resume
    let capSub: any;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("resume", refresh).then(s => capSub = s).catch(()=>{});
    }).catch(()=>{});
    // Initial check
    refresh();
    const id = setInterval(refresh, 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
      try { capSub?.remove(); } catch {}
    };
  }, []);
}
