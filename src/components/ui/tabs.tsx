import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );

  // Center the active tab reliably across Chrome, Safari, Firefox — including RTL.
  // Uses getBoundingClientRect (layout-space) instead of offsetLeft/scrollLeft,
  // which differ in sign/origin between WebKit, Blink, and Firefox when dir="rtl".
  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const centerActive = () => {
      const active = el.querySelector<HTMLElement>('[data-state="active"]');
      if (!active) return;
      const cRect = el.getBoundingClientRect();
      const aRect = active.getBoundingClientRect();
      const delta = (aRect.left + aRect.width / 2) - (cRect.left + cRect.width / 2);
      if (Math.abs(delta) < 2) return;
      try {
        el.scrollBy({ left: delta, behavior: "smooth" });
      } catch {
        el.scrollLeft += delta; // older Safari fallback
      }
    };
    // Delay one frame so layout is settled before measuring.
    const raf = requestAnimationFrame(centerActive);
    const observer = new MutationObserver(() => requestAnimationFrame(centerActive));
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  // Pointer-drag to scroll (desktop mouse + trackpad). Touch is handled natively
  // by the browser via `touch-pan-x`, which is the most consistent path on iOS/Android.
  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    let down = false;
    let startX = 0;
    let startScroll = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return; // let touch use native momentum
      down = true;
      startX = e.clientX;
      startScroll = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      el.scrollLeft = startScroll - (e.clientX - startX);
    };
    const onUp = () => { down = false; };
    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        // snap-proximity (not mandatory) — Safari iOS momentum & Firefox Android stay smooth.
        "relative inline-flex h-auto min-h-10 max-w-full items-center justify-start overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x [scroll-snap-type:x_proximity] scroll-smooth touch-pan-x [-webkit-overflow-scrolling:touch] [scroll-behavior:smooth] rounded-md bg-muted p-1 text-muted-foreground [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;


const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap snap-center shrink-0 rounded-sm px-3 py-2 text-sm font-medium leading-[1.7] ring-offset-background transition-all",
      "hover:text-foreground/80 active:scale-[0.97]",
      "data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold",
      "after:content-[''] after:absolute after:start-3 after:end-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary after:origin-center after:scale-x-0 after:transition-transform after:duration-300 data-[state=active]:after:scale-x-100",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-fade-in",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
