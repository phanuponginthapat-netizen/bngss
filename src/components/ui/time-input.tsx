import * as React from "react";
import { Time24Input } from "./time24-input";

/**
 * Drop-in replacement for <Input type="time" /> ที่บังคับ 24 ชม. (HH:MM)
 * รับ-คืนค่าผ่าน e.target.value แบบเดียวกับ native input
 */
interface TimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value?: string | null;
  onChange?: (e: { target: { value: string } }) => void;
  withSeconds?: boolean;
}

export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ value, onChange, withSeconds = false, className, disabled, placeholder, ...rest }, ref) => (
    <Time24Input
      {...(rest as any)}
      ref={ref as any}
      withSeconds={withSeconds}
      value={value ?? ""}
      onChange={(v) => onChange?.({ target: { value: v } })}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
    />
  ),
);
TimeInput.displayName = "TimeInput";

export default TimeInput;
