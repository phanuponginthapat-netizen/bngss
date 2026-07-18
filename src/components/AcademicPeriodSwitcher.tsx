import { useMemo } from "react";
import { useAcademicPeriod } from "@/contexts/AcademicPeriodContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Lock } from "lucide-react";

interface Props {
  compact?: boolean;
}

/**
 * Global switcher สำหรับ ปีการศึกษา (พ.ศ.) + เทอม
 * วางบน topbar — ทุกหน้าที่อ่าน useAcademicPeriod() จะเปลี่ยนตาม
 */
export default function AcademicPeriodSwitcher({ compact = true }: Props) {
  const { lang } = useLanguage();
  const { periods, currentPeriod, selectedYear, selectedSemester, selectedPeriod, setSelected } =
    useAcademicPeriod();

  const years = useMemo(() => {
    const set = new Set<number>(periods.map((p) => p.academic_year_be));
    // เผื่ออนาคต 1 ปี + อดีต 4 ปี ถ้ายังไม่มี
    const base = currentPeriod?.academic_year_be || selectedYear;
    for (let i = -4; i <= 1; i++) set.add(base + i);
    return Array.from(set).sort((a, b) => b - a);
  }, [periods, currentPeriod, selectedYear]);

  const isCurrent =
    selectedPeriod?.is_current ||
    (currentPeriod?.academic_year_be === selectedYear &&
      currentPeriod?.semester === selectedSemester);

  return (
    <div className={`flex items-center gap-1.5 ${compact ? "" : "p-2 rounded-lg border bg-card"}`}>
      <CalendarClock className="w-4 h-4 text-muted-foreground hidden sm:block" />
      <Select
        value={String(selectedYear)}
        onValueChange={(v) => setSelected(parseInt(v), selectedSemester)}
      >
        <SelectTrigger className="h-8 w-[88px] text-xs px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[100]">
          {years.map((y) => (
            <SelectItem key={y} value={String(y)} className="text-xs">
              {lang === "th" ? `พ.ศ. ${y}` : `BE ${y}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(selectedSemester)}
        onValueChange={(v) => setSelected(selectedYear, parseInt(v) as 1 | 2)}
      >
        <SelectTrigger className="h-8 w-[80px] text-xs px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[100]">
          <SelectItem value="1" className="text-xs">{lang === "th" ? "เทอม 1" : "Sem 1"}</SelectItem>
          <SelectItem value="2" className="text-xs">{lang === "th" ? "เทอม 2" : "Sem 2"}</SelectItem>
        </SelectContent>
      </Select>
      {isCurrent ? (
        <Badge variant="secondary" className="hidden md:inline-flex text-[10px] h-5 px-1.5">
          {lang === "th" ? "ปัจจุบัน" : "Current"}
        </Badge>
      ) : (
        <Badge variant="outline" className="hidden md:inline-flex text-[10px] h-5 px-1.5 border-warning/30 text-warning dark:text-warning">
          {lang === "th" ? "ดูย้อนหลัง" : "Past"}
        </Badge>
      )}
      {selectedPeriod?.is_closed && (
        <Badge variant="outline" className="hidden lg:inline-flex text-[10px] h-5 px-1.5 border-danger/30 text-danger">
          <Lock className="w-3 h-3 mr-0.5" />
          {lang === "th" ? "ปิดเทอม" : "Closed"}
        </Badge>
      )}
    </div>
  );
}
