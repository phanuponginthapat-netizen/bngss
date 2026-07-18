import { useEffect, useRef, useState, ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { haptic } from "@/lib/haptics";

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** Container is the scroll surface itself (default true). */
  enabled?: boolean;
  threshold?: number;
}

/**
 * Facebook-style pull-to-refresh. Attaches to the nearest scrollable ancestor.
 * Only triggers when the scroll container is at top.
 */
export function PullToRefresh({ onRefresh, children, enabled = true, threshold = 70 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const el = wrapRef.current;
    if (!el) return;

    // find nearest scroll container
    const getScroller = (): HTMLElement | Window => {
      let p: HTMLElement | null = el.parentElement;
      while (p) {
        const s = getComputedStyle(p).overflowY;
        if ((s === "auto" || s === "scroll") && p.scrollHeight > p.clientHeight) return p;
        p = p.parentElement;
      }
      return window;
    };
    const scroller = getScroller();
    const getScrollTop = () => scroller instanceof Window ? window.scrollY : (scroller as HTMLElement).scrollTop;

    const onTouchStart = (e: TouchEvent) => {
      if (getScrollTop() > 0 || refreshing) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      triggered.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setPull(0); return; }
      const damped = Math.min(120, dy * 0.5);
      setPull(damped);
      if (damped > threshold && !triggered.current) {
        triggered.current = true;
        haptic("light");
      }
    };
    const onTouchEnd = async () => {
      if (startY.current == null) return;
      const shouldRefresh = pull > threshold;
      startY.current = null;
      if (shouldRefresh) {
        setRefreshing(true);
        setPull(48);
        haptic("success");
        try { await onRefresh(); } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    const target = scroller instanceof Window ? window : scroller;
    target.addEventListener("touchstart", onTouchStart as EventListener, { passive: true });
    target.addEventListener("touchmove", onTouchMove as EventListener, { passive: true });
    target.addEventListener("touchend", onTouchEnd as EventListener);
    return () => {
      target.removeEventListener("touchstart", onTouchStart as EventListener);
      target.removeEventListener("touchmove", onTouchMove as EventListener);
      target.removeEventListener("touchend", onTouchEnd as EventListener);
    };
  }, [enabled, onRefresh, pull, refreshing, threshold]);

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center transition-all"
        style={{ transform: `translateY(${pull}px)`, opacity: pull > 8 ? 1 : 0 }}
      >
        <div className="bg-card border shadow-lg rounded-full p-2">
          {refreshing ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <ArrowDown className="w-5 h-5 text-primary" style={{ transform: `rotate(${Math.min(180, pull * 2.5)}deg)` }} />
          )}
        </div>
      </div>
      <div style={{ transform: refreshing ? "translateY(48px)" : `translateY(${pull * 0.6}px)`, transition: startY.current ? "none" : "transform 0.2s ease" }}>
        {children}
      </div>
    </div>
  );
}
