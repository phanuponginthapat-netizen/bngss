import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
  /** When inside a Dashboard route, lift above mobile bottom nav (default true) */
  liftAboveNav?: boolean;
}

/**
 * Sticky bottom action bar on mobile, normal flow on desktop.
 * Use for primary form actions (Save, Send, Submit).
 */
export function StickyActionBar({ children, className, liftAboveNav = true }: Props) {
  return (
    <div
      className={cn(
        "md:static md:p-0 md:border-0 md:bg-transparent md:backdrop-blur-0",
        "fixed inset-x-0 z-30 bg-card/95 backdrop-blur-md border-t p-3 flex gap-2",
        className
      )}
      style={{
        bottom: liftAboveNav ? "calc(56px + env(safe-area-inset-bottom))" : "0",
        paddingBottom: liftAboveNav ? "12px" : "calc(env(safe-area-inset-bottom) + 12px)",
      }}
    >
      {children}
    </div>
  );
}
