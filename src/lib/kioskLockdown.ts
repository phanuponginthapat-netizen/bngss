import { supabase } from "@/integrations/supabase/client";

/**
 * Kiosk browser lockdown — กันผู้ใช้ที่รู้ทางลัดเบราว์เซอร์ "หลุด" ออกจากหน้า kiosk
 * และกัน session หมดอายุ (session end) ระหว่างเปิดทิ้งไว้ตลอดวัน
 *
 * ครอบคลุม:
 *  1. บล็อกคีย์ลัดหนีหน้าจอ: F11 / F12 / F5 / Ctrl+R,W,T,N,P,S,U,J / Ctrl+Shift+I,J,C,N / Alt+←,→ / Backspace nav
 *  2. บล็อกคลิกขวา, ลากรูป, เลือกข้อความ (กันบันทึกรูป/เปิดเมนูเบราว์เซอร์)
 *  3. ดัก history back — ผู้ใช้กดย้อนกลับก็ยังอยู่หน้าเดิม
 *  4. beforeunload — ถามยืนยันก่อนปิด/รีเฟรช
 *  5. Fullscreen watchdog — ถ้าหลุด fullscreen จะกลับเข้าเองเมื่อมีการแตะ/คลิก
 *  6. Session guard — ต่ออายุ token ทุก 2 นาที และกู้คืนอัตโนมัติเมื่อ session ขาด
 */

export interface KioskLockdownOptions {
  /** เปิด beforeunload guard (default: true) */
  blockUnload?: boolean;
  /** กลับเข้า fullscreen อัตโนมัติเมื่อผู้ใช้แตะจอ (default: true) */
  keepFullscreen?: boolean;
  /** ต่ออายุ session อัตโนมัติ (default: true) */
  keepSession?: boolean;
  /** path ที่จะกลับมาหลัง login ใหม่ (default: path ปัจจุบัน) */
  returnPath?: string;
}

const BLOCKED_CTRL_KEYS = new Set(["r", "w", "t", "n", "p", "s", "u", "j", "o", "h", "f"]);
const BLOCKED_CTRL_SHIFT_KEYS = new Set(["i", "j", "c", "n", "t", "w", "q", "b", "o", "delete"]);

function isEditable(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || !node.tagName) return false;
  const tag = node.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || node.isContentEditable === true;
}

/** ติดตั้ง lockdown — คืนฟังก์ชันสำหรับถอนออก */
export function installKioskLockdown(opts: KioskLockdownOptions = {}): () => void {
  if (typeof window === "undefined") return () => {};
  const {
    blockUnload = true,
    keepFullscreen = true,
    keepSession = true,
    returnPath = window.location.pathname + window.location.search,
  } = opts;

  const cleanups: Array<() => void> = [];
  const on = <K extends keyof DocumentEventMap>(
    target: Document | Window,
    type: K | string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type as string, handler, options);
    cleanups.push(() => target.removeEventListener(type as string, handler, options));
  };

  // ---- 1) คีย์ลัด ----
  const onKeyDown = (e: Event) => {
    const ev = e as KeyboardEvent;
    const key = (ev.key || "").toLowerCase();
    const editable = isEditable(ev.target);
    let block = false;

    if (key === "f11" || key === "f12") block = true;
    if (key === "f5") block = true;
    if (ev.ctrlKey && ev.shiftKey && BLOCKED_CTRL_SHIFT_KEYS.has(key)) block = true;
    if ((ev.ctrlKey || ev.metaKey) && BLOCKED_CTRL_KEYS.has(key)) block = true;
    if (ev.altKey && (key === "arrowleft" || key === "arrowright" || key === "home")) block = true;
    if (ev.altKey && key === "f4") block = true;
    if (key === "backspace" && !editable) block = true;
    // Ctrl+Tab / Ctrl+PageUp/Down — สลับแท็บ
    if (ev.ctrlKey && (key === "tab" || key === "pageup" || key === "pagedown")) block = true;

    if (block) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };
  on(window, "keydown", onKeyDown, { capture: true });

  // ---- 2) เมนูคลิกขวา / ลาก / เลือกข้อความ ----
  const swallow = (e: Event) => {
    if (isEditable(e.target)) return;
    e.preventDefault();
  };
  on(document, "contextmenu", swallow, { capture: true });
  on(document, "dragstart", swallow, { capture: true });
  on(document, "selectstart", swallow, { capture: true });
  // ปิด pinch-zoom / ctrl+wheel zoom
  const onWheel = (e: Event) => {
    const ev = e as WheelEvent;
    if (ev.ctrlKey) ev.preventDefault();
  };
  on(window, "wheel", onWheel, { capture: true, passive: false } as AddEventListenerOptions);

  // ---- 3) ดัก history back ----
  try {
    window.history.pushState({ kioskLock: true }, "", window.location.href);
  } catch { /* ignore */ }
  const onPopState = () => {
    try {
      window.history.pushState({ kioskLock: true }, "", window.location.href);
    } catch { /* ignore */ }
  };
  on(window, "popstate", onPopState);

  // ---- 4) beforeunload ----
  if (blockUnload) {
    const onBeforeUnload = (e: Event) => {
      const ev = e as BeforeUnloadEvent;
      ev.preventDefault();
      ev.returnValue = "";
      return "";
    };
    on(window, "beforeunload", onBeforeUnload);
  }

  // ---- 5) fullscreen watchdog ----
  if (keepFullscreen) {
    const reenter = () => {
      if (document.fullscreenElement) return;
      document.documentElement.requestFullscreen?.().catch(() => {});
    };
    on(document, "click", reenter);
    on(document, "touchend", reenter);
  }

  // ---- 6) session guard ----
  if (keepSession) {
    let recovering = false;
    const ensureSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await recover();
          return;
        }
        const expiresAt = (session.expires_at ?? 0) * 1000;
        // ต่ออายุล่วงหน้า 15 นาที — kiosk เปิดค้างทั้งวัน ห้ามปล่อยให้หมดอายุ
        if (expiresAt - Date.now() < 15 * 60 * 1000) {
          const { error } = await supabase.auth.refreshSession();
          if (error) await recover();
        }
      } catch { /* transient */ }
    };

    const recover = async () => {
      if (recovering) return;
      recovering = true;
      for (let i = 0; i < 3; i++) {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) { recovering = false; return; }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
      recovering = false;
      // กู้ไม่ได้จริง → ส่งไปหน้า login พร้อมกลับมาที่ kiosk อัตโนมัติหลัง login
      window.removeEventListener("beforeunload", () => {});
      window.location.replace(`/login?next=${encodeURIComponent(returnPath)}`);
    };

    const iv = window.setInterval(ensureSession, 2 * 60 * 1000);
    cleanups.push(() => window.clearInterval(iv));
    on(window, "online", () => { ensureSession(); });
    on(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") ensureSession();
    });
    ensureSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") void recover();
    });
    cleanups.push(() => sub.subscription.unsubscribe());
  }

  return () => {
    cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  };
}
