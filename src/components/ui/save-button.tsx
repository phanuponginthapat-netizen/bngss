import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SaveButtonProps extends ButtonProps {
  saving?: boolean;
  savingLabel?: string;
  idleLabel?: string;
  hideIcon?: boolean;
}

/**
 * Save button with a built-in spinner + "กำลังบันทึก..." label
 * so users always see immediate feedback when clicking save.
 */
export const SaveButton = React.forwardRef<HTMLButtonElement, SaveButtonProps>(
  (
    {
      saving = false,
      savingLabel = "กำลังบันทึก...",
      idleLabel = "บันทึก",
      hideIcon = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || saving}
        className={cn(className)}
        {...props}
      >
        {!hideIcon &&
          (saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          ))}
        {saving ? savingLabel : children ?? idleLabel}
      </Button>
    );
  }
);
SaveButton.displayName = "SaveButton";
