import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Facebook-style sheet on mobile, dialog on desktop.
 * Includes a sticky footer slot for primary actions.
 */
export function BottomSheetForm({ open, onOpenChange, title, description, children, footer }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t-0 p-0 max-h-[92vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="px-4 pt-4 pb-2 text-left border-b">
            <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30 mb-2" aria-hidden />
            <SheetTitle className="text-base">{title}</SheetTitle>
            {description && <SheetDescription className="text-xs">{description}</SheetDescription>}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer && (
            <div
              className="border-t bg-card/95 backdrop-blur-md p-3 sticky bottom-0"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
            >
              {footer}
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div>{children}</div>
        {footer && <div className="flex justify-end gap-2 pt-2">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
