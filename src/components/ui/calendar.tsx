import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, useDayPicker, useNavigation, type CaptionProps } from "react-day-picker";
import { th } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BE_OFFSET } from "@/lib/dateBE";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * Custom Caption: Thai months + Buddhist Era years, compact single-row layout.
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

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  fromYear,
  toYear,
  components,
  ...props
}: CalendarProps) {
  const nowYear = new Date().getFullYear();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale ?? th}
      fromYear={fromYear ?? 1940}
      toYear={toYear ?? nowYear + 5}
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-2",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        nav: "hidden",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: ThaiBECaption,
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        ...components,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
