import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import Swal from "sweetalert2";
import { swalOptions } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Context = React.createContext({ open: false, setOpen: (_open: boolean) => {} });
function AlertDialog({ open, defaultOpen = false, onOpenChange, children }: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode }) {
  const [internal, setInternal] = React.useState(defaultOpen);
  const setOpen = React.useCallback((value: boolean) => { setInternal(value); onOpenChange?.(value); }, [onOpenChange]);
  return <Context.Provider value={{ open: open ?? internal, setOpen }}>{children}</Context.Provider>;
}
const AlertDialogTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(({ onClick, ...props }, ref) => {
  const { setOpen } = React.useContext(Context);
  return <Button ref={ref} {...props} onClick={event => { onClick?.(event); if (!event.defaultPrevented) setOpen(true); }} />;
});
AlertDialogTrigger.displayName = "AlertDialogTrigger";
const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ children, className, ...props }, ref) => {
  const { open, setOpen } = React.useContext(Context);
  const [host, setHost] = React.useState<HTMLDivElement | null>(null);
  const setOpenRef = React.useRef(setOpen);
  setOpenRef.current = setOpen;
  React.useEffect(() => {
    if (!open) return;
    const container = document.createElement("div");
    let disposed = false;
    setHost(container);
    void Swal.fire(swalOptions({ icon: "question", html: container, showConfirmButton: false, allowOutsideClick: false, didClose: () => { if (!disposed) setOpenRef.current(false); } }));
    return () => {
      disposed = true;
      if (Swal.getHtmlContainer()?.contains(container)) Swal.close();
      setHost(null);
    };
  }, [open]);
  return open && host ? createPortal(<div ref={ref} className={cn("space-y-4 text-foreground", className)} {...props}>{children}</div>, host) : null;
});
AlertDialogContent.displayName = "AlertDialogContent";
const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("space-y-2", className)} {...props} />;
const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-wrap justify-end gap-2", className)} {...props} />;
const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => <h2 ref={ref} className={cn("text-lg font-semibold", className)} {...props} />);
AlertDialogTitle.displayName = "AlertDialogTitle";
const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement> & { asChild?: boolean }>(({ className, asChild, ...props }, ref) => {
  const Component = asChild ? Slot : "p";
  return <Component ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />;
});
AlertDialogDescription.displayName = "AlertDialogDescription";
const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(({ onClick, ...props }, ref) => {
  const { setOpen } = React.useContext(Context);
  return <Button ref={ref} {...props} onClick={event => { onClick?.(event); if (!event.defaultPrevented) setOpen(false); }} />;
});
AlertDialogAction.displayName = "AlertDialogAction";
const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(({ onClick, ...props }, ref) => {
  const { setOpen } = React.useContext(Context);
  return <Button ref={ref} variant="outline" {...props} onClick={event => { onClick?.(event); if (!event.defaultPrevented) setOpen(false); }} />;
});
AlertDialogCancel.displayName = "AlertDialogCancel";
const AlertDialogPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const AlertDialogOverlay = () => null;
export { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel };
