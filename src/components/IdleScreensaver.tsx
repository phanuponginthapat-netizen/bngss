import { useEffect, useRef, useState } from "react";
import { Moon } from "lucide-react";
import { callLocalCtl } from "@/lib/monitorSignal";

/**
 * โปรแกรมพักหน้าจอประหยัดพลังงาน — ใช้กับ Kiosk นักเรียน / เครื่องหน้าประตู
 * - แสดง overlay ดำ + นาฬิกา หลังไม่มีกิจกรรม N นาที (default 5)
 * - แตะที่ใดก็ได้ = ปลุก
 * - เปิดเฉพาะเมื่อรันเป็น PWA / standalone / URL มี ?kiosk=1
 * - พยายามเรียก local daemon `/screen-off` เพื่อดับจอจริง (xset dpms) ประหยัดไฟสูงสุด
 */

const IDLE_MS = Number(
  (typeof window !== "undefined" &&
    (localStorage.getItem("kiosk:screensaver_min") ||
      (window as any).__KIOSK_SCREENSAVER_MIN)) ||
    5,
) * 60_000;

function shouldEnable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("kiosk") === "1" || q.get("kiosk") === "true") return true;
    if (localStorage.getItem("kiosk:screensaver") === "1") return true;
    // เปิดเฉพาะเมื่อรันเป็น PWA/standalone จริง ๆ (chromium --app=URL หรือ Add to Home Screen)
    // — ห้ามใช้ heuristic ขนาดหน้าต่าง เพราะ browser maximized ก็ตรง
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
    if ((window.navigator as any).standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function IdleScreensaver() {
  const [active, setActive] = useState(false);
  const enabledRef = useRef(shouldEnable());
  const timerRef = useRef<number | null>(null);
  const now = useClock();

  useEffect(() => {
    if (!enabledRef.current) return;

    const reset = () => {
      if (active) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setActive(true);
        // สั่ง local daemon ดับจอจริง (xset dpms force off) — ประหยัดไฟสูงสุด
        callLocalCtl("/screen-off").catch(() => {});
      }, IDLE_MS);
    };

    const wake = () => {
      if (active) {
        setActive(false);
        callLocalCtl("/screen-on").catch(() => {});
      }
      reset();
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
      "click",
    ];
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    reset();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, wake));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [active]);

  if (!enabledRef.current || !active) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black text-white/80 flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={() => setActive(false)}
      onTouchStart={() => setActive(false)}
      onKeyDown={() => setActive(false)}
      role="button"
      tabIndex={0}
      aria-label="แตะเพื่อปลุกเครื่อง"
    >
      <Moon className="w-10 h-10 opacity-40 mb-6" />
      <p className="text-7xl md:text-9xl font-bold tabular-nums drop-shadow-2xl leading-none">
        {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="mt-6 text-sm opacity-40">โหมดประหยัดพลังงาน — แตะเพื่อใช้งานต่อ</p>
    </div>
  );
}
