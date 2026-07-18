import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand={false}
      visibleToasts={4}
      offset={16}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground",
        },
        style: {
          // Sit above sheets/dialogs (which use z-50) and safe-area
          zIndex: 9999,
        },
      }}
      style={{
        // Respect mobile safe area (notch / status bar)
        top: "max(env(safe-area-inset-top), 1rem)",
        right: "max(env(safe-area-inset-right), 1rem)",
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
