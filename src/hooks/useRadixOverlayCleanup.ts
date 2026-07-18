import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Global safety net for a well-known Radix UI bug:
 * เมื่อเปิด Dialog/Popover/DropdownMenu/Sheet แล้วมีการ navigate ออก
 * (โดยเฉพาะกรณีที่ route ปลายทางถูก lazy-load แล้ว suspend)
 * Radix จะไม่มีโอกาส cleanup ส่งผลให้ `body { pointer-events: none }` ค้าง
 * ทำให้คลิกอะไรไม่ได้ หน้าเหมือน "แข็ง"
 *
 * Hook นี้เฝ้าดูการเปลี่ยน route แล้ว:
 *  - ล้าง inline style `pointer-events` บน <body>
 *  - ปลดล็อก scroll (`overflow`) หากถูก lock ค้าง
 *  - ลบ attribute `data-scroll-locked` ที่ Radix ตั้งไว้
 */
export function useRadixOverlayCleanup() {
  const { pathname } = useLocation();

  useEffect(() => {
    // ให้ Radix ทำ cleanup ปกติของมันเองก่อน แล้วค่อยกวาดที่เหลือ
    const timer = window.setTimeout(() => {
      const body = document.body;
      if (!body) return;
      if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
      if (body.style.overflow === "hidden") body.style.overflow = "";
      if (body.hasAttribute("data-scroll-locked")) {
        body.removeAttribute("data-scroll-locked");
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [pathname]);
}
