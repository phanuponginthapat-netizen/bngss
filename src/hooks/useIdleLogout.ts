import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Auto sign-out after inactivity when running in a normal browser tab
 * (i.e. NOT installed as a PWA / standalone app).
 *
 * - Timeout: 2 hours of no user activity
 * - PWA (display-mode: standalone / iOS navigator.standalone): exempted
 * - Activity events: mousemove, mousedown, keydown, touchstart, scroll, wheel
 * - Shares last-activity timestamp across tabs via localStorage
 */

const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 ชั่วโมง
const STORAGE_KEY = "lovable:lastActivityAt";
const CHECK_INTERVAL_MS = 60 * 1000; // เช็คทุก 1 นาที

function isRunningAsPWA(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
    // iOS Safari
    if ((window.navigator as any).standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isRunningAsKiosk(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const path = window.location.pathname || "";
    // หน้า kiosk โดยตรง
    if (path.startsWith("/face-kiosk")) return true;
    if (path.startsWith("/monitor/")) return true;
    // ตั้งค่า kiosk lock ผ่าน localStorage / query
    if (localStorage.getItem("kiosk_mode_locked") === "1") return true;
    if (localStorage.getItem("face_kiosk_qr_only") === "1") return true;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("kiosk") === "1") return true;
    // Chrome kiosk / installed app (window.name marker หรือ user agent)
    if ((window as any).__KIOSK__ === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Touch-capable device OR mobile UA — ยกเว้นทั้งเบราว์เซอร์มือถือ ไม่ใช่แค่ PWA
    // เพื่อให้ session ไม่หลุดระหว่างพักหน้าจอ (มือถือ freeze JS timer)
    if (navigator.maxTouchPoints > 1) return true;
    if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent)) return true;
    if (window.matchMedia?.("(pointer: coarse)").matches) return true;
  } catch { /* ignore */ }
  return false;
}

export function useIdleLogout(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (isRunningAsPWA()) return; // ยกเว้น PWA
    if (isRunningAsKiosk()) return; // ยกเว้นโหมด kiosk — ห้ามหลุด session
    if (isMobileDevice()) return; // ยกเว้นมือถือ/แท็บเล็ต — กัน session หลุดเวลาพักหน้าจอ → realtime แจ้งเตือนจะขาด


    const now = () => Date.now();
    const touch = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(now()));
      } catch {
        /* ignore */
      }
    };

    // เริ่มนับเวลาตอน mount
    touch();

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
      "click",
    ];
    // throttle เพื่อไม่เขียน localStorage ถี่เกินไป
    let lastWrite = 0;
    const onActivity = () => {
      const t = now();
      if (t - lastWrite < 5000) return;
      lastWrite = t;
      touch();
    };
    events.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true })
    );

    let signedOut = false;
    const doLogout = async () => {
      if (signedOut) return;
      signedOut = true;
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      toast.info("ไม่มีการใช้งานเกิน 2 ชั่วโมง กรุณาเข้าสู่ระบบใหม่", {
        duration: 6000,
      });
      // redirect ไปหน้า login
      const next = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      window.location.replace(`/login?next=${next}`);
    };

    const check = () => {
      let last = 0;
      try {
        last = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
      } catch {
        last = 0;
      }
      if (!last) {
        touch();
        return;
      }
      if (now() - last >= IDLE_TIMEOUT_MS) {
        doLogout();
      }
    };

    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    // เมื่อกลับมาโฟกัสแท็บ ให้เช็คทันที (กันเคสหลับเครื่อง)
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.clearInterval(interval);
    };
  }, [enabled]);
}
