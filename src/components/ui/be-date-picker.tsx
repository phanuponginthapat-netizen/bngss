import * as React from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { th } from "date-fns/locale";
import { useDayPicker, useNavigation, type CaptionProps } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BE_OFFSET } from "@/lib/dateBE";
import { formatDateBE, parseDateBE, toISODate } from "@/lib/dateBE";

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * Custom Caption: Thai months + Buddhist Era years, no duplicate label.
 * แก้บั๊ค: caption ยาวเกินไปทำให้แถววันที่ 26–31 โดนตัด
 */
function ThaiBECaption({ displayMonth }: CaptionProps) {
  const { goToMonth } = useNavigation();
  const { fromYear, toYear } = useDayPicker();
  const currentMonth = displayMonth.getMonth();
  const currentYear = displayMonth.getFullYear();

  const yearFrom = fromYear ?? currentYear - 60;
  const yearTo = toYear ?? currentYear + 5;
  const years: number[] = [];
  for (let y = yearTo; y >= yearFrom; y--) years.push(y);

  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => goToMonth(new Date(currentYear, currentMonth - 1, 1))}
        aria-label="เดือนก่อนหน้า"
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex flex-1 items-center gap-1.5 min-w-0">
        <Select
          value={String(currentMonth)}
          onValueChange={(v) => goToMonth(new Date(currentYear, Number(v), 1))}
        >
          <SelectTrigger className="h-8 flex-1 min-w-0 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {TH_MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(currentYear)}
          onValueChange={(v) => goToMonth(new Date(Number(v), currentMonth, 1))}
        >
          <SelectTrigger className="h-8 w-[88px] shrink-0 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y + BE_OFFSET}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => goToMonth(new Date(currentYear, currentMonth + 1, 1))}
        aria-label="เดือนถัดไป"
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

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
 * Date picker: DD/MM/YYYY BE display, ISO ค.ศ. storage.
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
  const defaultMonth = selected ?? new Date();

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
          className="w-auto p-0"
          align="end"
          side="bottom"
          sideOffset={4}
          collisionPadding={16}
          avoidCollisions
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={defaultMonth}
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
            fromYear={fromYear}
            toYear={toYear}
            locale={th}
            components={{ Caption: ThaiBECaption }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default BEDatePicker;

