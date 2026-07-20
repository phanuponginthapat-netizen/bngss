import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { cn } from "@/lib/utils";

interface FullscreenShellProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /** padding around content — default responsive */
  padding?: string;
  /** dismiss on ESC — default true */
  closeOnEsc?: boolean;
}

/**
 * Unified fullscreen overlay for modals/pages across the system.
 * - Portalled to document.body to escape stacking contexts
 * - Safe-area aware (iOS notch / gesture bar)
 * - No bottom padding gap: content owns full viewport height
 * - z-[100] so it sits above default dialogs (z-50) but below popover-family (z-[10000])
 */
export function FullscreenShell({
  open,
  onClose,
  children,
  className,
  padding = "p-2 sm:p-4",
  closeOnEsc = true,
}: FullscreenShellProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !closeOnEsc || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] bg-background flex flex-col gap-2 sm:gap-3 overflow-hidden overscroll-contain",
        padding,
        className,
      )}
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export default FullscreenShell;
