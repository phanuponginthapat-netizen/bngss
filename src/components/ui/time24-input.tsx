import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Time input 24 ชม. รูปแบบ HH:MM:SS — ไม่ใช้ native time picker
 * เพื่อไม่ให้บางเบราว์เซอร์ (เช่น Chrome ที่ locale en-US) บังคับโชว์ AM/PM
 */
interface Time24InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: string;
  onChange: (val: string) => void;
  withSeconds?: boolean;
}

function normalize(raw: string, withSeconds: boolean): string {
  // เก็บแต่ตัวเลข แล้วฟอร์แมตตามตำแหน่ง
  const digits = raw.replace(/\D/g, "").slice(0, withSeconds ? 6 : 4);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (withSeconds && digits.length > 4) parts.push(digits.slice(4, 6));
  return parts.join(":");
}

function pad(v: string, withSeconds: boolean): string {
  if (!v) return "";
  const [h = "0", m = "0", s = "0"] = v.split(":");
  const hh = String(Math.min(23, parseInt(h || "0", 10) || 0)).padStart(2, "0");
  const mm = String(Math.min(59, parseInt(m || "0", 10) || 0)).padStart(2, "0");
  if (!withSeconds) return `${hh}:${mm}`;
  const ss = String(Math.min(59, parseInt(s || "0", 10) || 0)).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export const Time24Input = React.forwardRef<HTMLInputElement, Time24InputProps>(
  ({ value, onChange, withSeconds = true, className, onBlur, ...props }, ref) => {
    const [internal, setInternal] = React.useState<string>(value || "");

    React.useEffect(() => {
      setInternal(value || "");
    }, [value]);

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder={withSeconds ? "HH:MM:SS" : "HH:MM"}
        className={cn("tabular-nums tracking-wider", className)}
        value={internal}
        onChange={(e) => {
          const v = normalize(e.target.value, withSeconds);
          setInternal(v);
          // ส่งกลับเฉพาะเมื่อครบฟอร์แมต
          const need = withSeconds ? 8 : 5;
          if (v.length === need) onChange(pad(v, withSeconds));
          else if (v.length === 0) onChange("");
        }}
        onBlur={(e) => {
          const padded = pad(internal, withSeconds);
          setInternal(padded);
          if (padded) onChange(padded);
          onBlur?.(e);
        }}
      />
    );
  },
);
Time24Input.displayName = "Time24Input";
