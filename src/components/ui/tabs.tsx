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

  // Auto-scroll the active tab into view (center) whenever it changes.
  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const scrollActiveIntoView = () => {
      const active = el.querySelector<HTMLElement>('[data-state="active"]');
      if (!active) return;
      const elRect = el.getBoundingClientRect();
      const aRect = active.getBoundingClientRect();
      const offset = aRect.left - elRect.left - (elRect.width - aRect.width) / 2;
      el.scrollTo({ left: el.scrollLeft + offset, behavior: "smooth" });
    };
    scrollActiveIntoView();
    const observer = new MutationObserver(scrollActiveIntoView);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, []);

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "relative inline-flex h-10 max-w-full items-center justify-start overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth touch-pan-x [-webkit-overflow-scrolling:touch] rounded-md bg-muted p-1 text-muted-foreground [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
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
      "relative inline-flex items-center justify-center whitespace-nowrap snap-center shrink-0 rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
      "hover:text-foreground/80 active:scale-[0.97]",
      "data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold",
      "after:content-[''] after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary after:origin-center after:scale-x-0 after:transition-transform after:duration-300 data-[state=active]:after:scale-x-100",
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
