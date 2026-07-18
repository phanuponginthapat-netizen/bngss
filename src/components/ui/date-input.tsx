import * as React from "react";
import { BEDatePicker } from "./be-date-picker";

/**
 * Drop-in replacement for <Input type="date" /> that:
 *  - แสดง/รับ พ.ศ. (DD/MM/YYYY)
 *  - เก็บค่าเป็น ISO YYYY-MM-DD เหมือนเดิม
 *  - ใช้สัญญา onChange แบบเดียวกับ native input (e.target.value)
 */
interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value?: string | null;
  onChange?: (e: { target: { value: string } }) => void;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className, disabled, placeholder }, _ref) => (
    <BEDatePicker
      value={typeof value === "string" ? value : ""}
      onChange={(iso) => onChange?.({ target: { value: iso } })}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
    />
  ),
);
DateInput.displayName = "DateInput";

export default DateInput;
