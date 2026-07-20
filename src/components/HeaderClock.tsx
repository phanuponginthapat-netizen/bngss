import { useEffect, useState } from "react";
import { CalendarDays, Clock, Sun, Sunrise, Sunset, Moon } from "lucide-react";
import { BKK_TZ, BE_OFFSET, getBangkokParts } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";

const TH_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function greeting(hour: number, lang: "th" | "en") {
  if (lang === "th") {
    if (hour < 6) return { text: "สวัสดียามดึก", Icon: Moon };
    if (hour < 12) return { text: "สวัสดีตอนเช้า", Icon: Sunrise };
    if (hour < 17) return { text: "สวัสดีตอนบ่าย", Icon: Sun };
    if (hour < 20) return { text: "สวัสดีตอนเย็น", Icon: Sunset };
    return { text: "สวัสดีตอนค่ำ", Icon: Moon };
  }
  if (hour < 6) return { text: "Good night", Icon: Moon };
  if (hour < 12) return { text: "Good morning", Icon: Sunrise };
  if (hour < 17) return { text: "Good afternoon", Icon: Sun };
  if (hour < 20) return { text: "Good evening", Icon: Sunset };
  return { text: "Good night", Icon: Moon };
}

export default function HeaderClock() {
  const { lang } = useLanguage();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const p = getBangkokParts(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: BKK_TZ, weekday: "short" }).format(now);
  const wIdx = EN_DAYS.indexOf(weekday);
  const timeStr = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:${String(p.second).padStart(2, "0")}`;
  const dateStr =
    lang === "th"
      ? `${TH_DAYS[wIdx]} ${p.day} ${TH_MONTHS_SHORT[p.month - 1]} ${p.year + BE_OFFSET}`
      : `${EN_DAYS[wIdx]}, ${p.day} ${EN_MONTHS[p.month - 1]} ${p.year}`;

  const { text, Icon } = greeting(p.hour, lang as "th" | "en");

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-primary/8 via-accent/8 to-primary/8 border border-border/50 backdrop-blur-sm">
      <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-card/80 ring-1 ring-primary/20 shadow-inner">
        <Icon className="w-4 h-4 text-primary" />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          {dateStr}
        </span>
        <span className="text-[13px] font-bold text-foreground/90 whitespace-nowrap tabular-nums flex items-center gap-1">
          <Clock className="w-3 h-3 text-accent" />
          {timeStr}
          <span className="text-[10px] font-normal text-muted-foreground ml-1">• {text}</span>
        </span>
      </div>
    </div>
  );
}
