import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * รักษา session ให้อยู่รอดบนมือถือ (browser + PWA)
 * — Mobile browsers (iOS Safari / Android Chrome) จะ freeze JS timers เมื่อพักหน้าจอ
 *   ทำให้ supabase auto-refresh token ไม่ทำงาน → refresh_token หมดอายุ → session หลุด
 *   → realtime channel ถูกตัด → แจ้งเตือน real-time หาย
 *
 * กลยุทธ์:
 *  1. ทุกครั้งที่แท็บกลับมา visible / focus / network online
 *     → เช็คว่า access_token ใกล้หมดอายุ (<5 นาที) แล้ว refresh ทันที
 *  2. ทุกครั้งที่กลับมา visible → บอก realtime ให้ reconnect (กันช่อง WS ตายเงียบ)
 *  3. Fallback interval 4 นาที (Chrome desktop / active tab เท่านั้น — mobile ไม่ทำงานตอน background แต่จะทำงานทันทีที่กลับมา)
 */

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh ถ้าเหลือ <5 นาที
const HEARTBEAT_MS = 4 * 60 * 1000;

async function refreshIfNeeded() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const expiresAt = (session.expires_at ?? 0) * 1000;
    const now = Date.now();
    if (expiresAt - now < REFRESH_THRESHOLD_MS) {
      await supabase.auth.refreshSession();
    }
  } catch { /* ignore transient errors */ }
}

function reconnectRealtime() {
  try {
    const rt: any = (supabase as any).realtime;
    if (!rt) return;
    // ถ้าไม่ได้เชื่อมอยู่ → เชื่อมใหม่ (ช่อง postgres_changes ที่สมัครไว้จะ auto-rejoin)
    if (typeof rt.isConnected === "function" && !rt.isConnected()) {
      rt.connect?.();
    }
  } catch { /* ignore */ }
}

export function useSessionKeepAlive(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const onResume = () => {
      refreshIfNeeded();
      reconnectRealtime();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    window.addEventListener("pageshow", onResume);

    // Heartbeat — เผื่อ browser desktop ที่เปิดทิ้งไว้
    const iv = window.setInterval(refreshIfNeeded, HEARTBEAT_MS);

    // เช็คทันทีตอน mount ด้วย
    refreshIfNeeded();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
      window.removeEventListener("pageshow", onResume);
      window.clearInterval(iv);
    };
  }, [enabled]);
}
