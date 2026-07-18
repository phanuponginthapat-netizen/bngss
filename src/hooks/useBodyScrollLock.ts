import { useEffect } from "react";

/**
 * Locks body scroll while `active` is true. Preserves scroll position and
 * prevents background from scrolling when a fullscreen overlay is shown.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: (html.style as any).overscrollBehavior,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.style.overflow = "hidden";
    (html.style as any).overscrollBehavior = "none";
    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      html.style.overflow = prev.htmlOverflow;
      (html.style as any).overscrollBehavior = prev.htmlOverscroll || "";
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

export default useBodyScrollLock;
