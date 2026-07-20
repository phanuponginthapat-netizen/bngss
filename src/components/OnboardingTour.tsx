import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STORAGE_KEY = "onboarding_v1_done";

type Step = {
  selector: string;
  title: string;
  body: string;
  placement?: "bottom" | "top" | "left" | "right" | "auto";
};

const STEPS: Step[] = [
  {
    selector: '[data-tour="avatar-toggle"]',
    title: "1. เปิด/ปิด แถบเมนู",
    body: "แตะที่รูปโปรไฟล์ของคุณ เพื่อเปิดหรือซ่อนแถบเมนูด้านข้าง (Sidebar)",
    placement: "bottom",
  },
  {
    selector: '[data-tour="ai-bubble"]',
    title: "2. ผู้ช่วย AI",
    body: "กดปุ่มลอยนี้เพื่อคุยกับผู้ช่วย AI ถามการบ้าน ตารางเรียน หรือข้อมูลระบบได้",
    placement: "top",
  },

  {
    selector: '[data-tour="ai-bubble"]',
    title: "3. ผู้ช่วย AI",
    body: "กดปุ่มลอยนี้เพื่อคุยกับผู้ช่วย AI ถามการบ้าน ตารางเรียน หรือข้อมูลระบบได้",
    placement: "top",
  },
];

export default function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    const path = window.location.pathname.replace(/\/$/, "");
    const canShowTour = path === "/dashboard" || path === "/dashboard/home";
    if (!canShowTour) return;
    // small delay so layout settles
    const t = setTimeout(() => setActive(true), 800);
    return () => clearTimeout(t);
  }, []);

  useLayoutEffect(() => {
    if (!active) return;
    const step = STEPS[idx];
    if (!step) return;

    let raf = 0;
    const findAndSet = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        const r = el.getBoundingClientRect();
        setRect(r);
      } else {
        setRect(null);
      }
    };
    findAndSet();
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(findAndSet);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const interval = window.setInterval(findAndSet, 500);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearInterval(interval);
      cancelAnimationFrame(raf);
    };
  }, [active, idx]);

  if (!active) return null;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setActive(false);
  };
  const next = () => {
    if (idx < STEPS.length - 1) setIdx(idx + 1);
    else finish();
  };
  const skip = () => finish();

  const step = STEPS[idx];
  const pad = 8;
  const spot = rect
    ? {
        top: Math.max(rect.top - pad, 4),
        left: Math.max(rect.left - pad, 4),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Tooltip position
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const vh = typeof window !== "undefined" ? window.innerHeight : 640;
  const tipW = Math.min(320, vw - 24);
  let tipTop = vh / 2 - 80;
  let tipLeft = vw / 2 - tipW / 2;
  let arrow: "up" | "down" | null = null;
  let arrowLeft = tipW / 2 - 8;

  if (spot) {
    const placeBelow = spot.top + spot.height + 180 < vh;
    if (placeBelow) {
      tipTop = spot.top + spot.height + 16;
      arrow = "up";
    } else {
      tipTop = Math.max(spot.top - 180, 12);
      arrow = "down";
    }
    tipLeft = Math.min(Math.max(spot.left + spot.width / 2 - tipW / 2, 12), vw - tipW - 12);
    const centerX = spot.left + spot.width / 2;
    arrowLeft = Math.min(Math.max(centerX - tipLeft - 8, 16), tipW - 32);
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none" aria-live="polite">
      {/* Dim overlay via 4 rects around the spot (keeps target visible & clickable optional) */}
      {spot ? (
        <>
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, right: 0, height: spot.top }} onClick={skip} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} onClick={skip} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: spot.top, left: 0, width: spot.left, height: spot.height }} onClick={skip} />
          <div className="fixed bg-black/60 pointer-events-auto" style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }} onClick={skip} />
          {/* Highlight ring */}
          <div
            className="fixed rounded-2xl ring-4 ring-primary shadow-[0_0_0_9999px_rgba(0,0,0,0)] animate-pulse pointer-events-none"
            style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
          />
          {/* Arrow */}
          {arrow === "up" && (
            <div
              className="fixed pointer-events-none text-primary"
              style={{ top: spot.top + spot.height + 2, left: spot.left + spot.width / 2 - 14 }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-lg animate-bounce">
                <path d="M12 2 L12 18 M6 12 L12 18 L18 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
          )}
          {arrow === "down" && (
            <div
              className="fixed pointer-events-none text-primary"
              style={{ top: spot.top - 30, left: spot.left + spot.width / 2 - 14 }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow-lg animate-bounce">
                <path d="M12 22 L12 6 M6 12 L12 6 L18 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
          )}
        </>
      ) : (
        <div className="fixed inset-0 bg-black/60 pointer-events-auto" onClick={skip} />
      )}

      {/* Tooltip card */}
      <div
        className="fixed pointer-events-auto bg-card text-card-foreground rounded-2xl shadow-2xl border border-border p-4"
        style={{ top: tipTop, left: tipLeft, width: tipW }}
        role="dialog"
        aria-labelledby="tour-title"
      >
        {arrow === "up" && (
          <div className="absolute -top-2 w-4 h-4 rotate-45 bg-card border-l border-t border-border" style={{ left: arrowLeft }} />
        )}
        {arrow === "down" && (
          <div className="absolute -bottom-2 w-4 h-4 rotate-45 bg-card border-r border-b border-border" style={{ left: arrowLeft }} />
        )}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div id="tour-title" className="font-semibold text-base">{step.title}</div>
          <button onClick={skip} aria-label="ปิด" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{step.body}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{idx + 1} / {STEPS.length}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={skip}>ข้าม</Button>
            <Button size="sm" onClick={next}>
              {idx < STEPS.length - 1 ? "ถัดไป" : "เสร็จสิ้น"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function resetOnboardingTour() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  window.location.reload();
}
