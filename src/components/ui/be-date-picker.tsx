import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatDateBE,
  parseDateBE,
  toISODate,
} from "@/lib/dateBE";

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export interface BEDatePickerProps {
  /** ISO YYYY-MM-DD or empty string */
  value?: string | null;
  /** Returns ISO YYYY-MM-DD ("" when cleared) */
  onChange?: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromYear?: number; // ค.ศ.
  toYear?: number;   // ค.ศ.
}

/**
 * Date picker that displays / accepts DD/MM/YYYY in Buddhist Era,
 * but stores ISO ค.ศ. internally (YYYY-MM-DD).
 */
export function BEDatePicker({
  value,
  onChange,
  placeholder = "วว/ดด/ปปปป",
  disabled,
  className,
  fromYear = 1940,
  toYear = new Date().getFullYear() + 5,
}: BEDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState<string>(formatDateBE(value || ""));

  React.useEffect(() => {
    setText(formatDateBE(value || ""));
  }, [value]);

  const selected = value ? parseDateBE(value) ?? undefined : undefined;

  const commitText = (t: string) => {
    const trimmed = t.trim();
    if (!trimmed) {
      onChange?.("");
      return;
    }
    const d = parseDateBE(trimmed);
    if (d) {
      onChange?.(toISODate(d));
      setText(formatDateBE(toISODate(d)));
    } else {
      setText(formatDateBE(value || ""));
    }
  };

  return (
    <div className={cn("flex gap-1", className)}>
      <Input
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commitText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitText((e.target as HTMLInputElement).value);
          }
        }}
        className="flex-1"
        inputMode="numeric"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="shrink-0"
            aria-label="เปิดปฏิทิน"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 max-h-[80vh] overflow-y-auto"
          align="end"
          side="bottom"
          sideOffset={4}
          collisionPadding={16}
          avoidCollisions
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                const iso = toISODate(
                  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())),
                );
                onChange?.(iso);
                setText(formatDateBE(iso));
                setOpen(false);
              }
            }}
            captionLayout="dropdown-buttons"
            fromYear={fromYear}
            toYear={toYear}
            formatters={{
              formatCaption: (date) =>
                `${TH_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`,
              formatYearCaption: (date) => `${date.getFullYear() + 543}`,
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default BEDatePicker;
