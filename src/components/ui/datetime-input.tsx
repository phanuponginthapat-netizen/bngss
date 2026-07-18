import * as React from "react";
import { BEDatePicker } from "./be-date-picker";
import { Time24Input } from "./time24-input";

/**
 * Drop-in replacement for <Input type="datetime-local" />
 * - แสดงผลแบบ พ.ศ. + 24 ชม.
 * - เก็บ value เป็น "YYYY-MM-DDTHH:MM" (เหมือน native datetime-local)
 */
interface DateTimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value?: string | null;
  onChange?: (e: { target: { value: string } }) => void;
}

function split(v?: string | null): { date: string; time: string } {
  if (!v) return { date: "", time: "" };
  const s = String(v);
  const [d = "", t = ""] = s.split("T");
  // ตัด timezone/วินาทีออก เหลือ HH:MM
  const time = t ? t.slice(0, 5) : "";
  return { date: d, time };
}

export const DateTimeInput = React.forwardRef<HTMLInputElement, DateTimeInputProps>(
  ({ value, onChange, className, disabled }, _ref) => {
    const { date, time } = split(value);

    const emit = (d: string, t: string) => {
      if (!d && !t) {
        onChange?.({ target: { value: "" } });
        return;
      }
      const newVal = `${d || ""}T${t || "00:00"}`;
      onChange?.({ target: { value: newVal } });
    };

    return (
      <div className={`flex gap-2 ${className ?? ""}`}>
        <BEDatePicker
          value={date}
          onChange={(iso) => emit(iso, time)}
          disabled={disabled}
          className="flex-1 min-w-0"
        />
        <Time24Input
          value={time}
          onChange={(v) => emit(date, v)}
          withSeconds={false}
          disabled={disabled}
          className="w-24"
        />
      </div>
    );
  },
);
DateTimeInput.displayName = "DateTimeInput";

export default DateTimeInput;
