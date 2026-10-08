import { useEffect } from "react";
import { preloadRoute } from "@/lib/routePreload";

/** ชี้เมาส์/แตะ/โฟกัสลิงก์ภายในระบบ → โหลดโค้ดหน้านั้นล่วงหน้า กดแล้วเปิดได้ทันที */
export function useLinkPreload() {
  useEffect(() => {
    const handler = (e: Event) => {
      const t = e.target;
      const a = t instanceof Element ? (t.closest("a[href]") as HTMLAnchorElement | null) : null;
      if (!a || a.origin !== window.location.origin) return;
      preloadRoute(a.pathname);
    };
    document.addEventListener("pointerover", handler, { passive: true });
    document.addEventListener("touchstart", handler, { passive: true });
    document.addEventListener("focusin", handler);
    return () => {
      document.removeEventListener("pointerover", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("focusin", handler);
    };
  }, []);
}
