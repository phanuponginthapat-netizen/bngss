import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GraduationCap } from "lucide-react";

interface Props {
  academicYear: number;
  onAcademicYearChange: (year: number) => void;
  semester: number;
  onSemesterChange: (semester: number) => void;
  academicYearOptions: number[];
  /** Show "all semesters" option */
  allowAllSemesters?: boolean;
  /** Compact mode for inline usage */
  compact?: boolean;
}

export function AcademicYearFilter({
  academicYear, onAcademicYearChange,
  semester, onSemesterChange,
  academicYearOptions, allowAllSemesters, compact,
}: Props) {
  const { lang } = useLanguage();

  return (
    <div className={`flex ${compact ? "gap-2 items-end" : "gap-3 items-end flex-wrap"}`}>
      <div className={compact ? "" : "min-w-[140px]"}>
        {!compact && <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
          <GraduationCap className="w-3 h-3" />
          {lang === "th" ? "ปีการศึกษา" : "Academic Year"}
        </Label>}
        <Select
          value={String(academicYear)}
          onValueChange={(v) => onAcademicYearChange(parseInt(v))}
        >
          <SelectTrigger className={compact ? "w-[130px] h-8 text-xs" : "w-[150px]"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {academicYearOptions.map(y => (
              <SelectItem key={y} value={String(y)}>
                {lang === "th" ? `${y}` : `${y - 543}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={compact ? "" : "min-w-[120px]"}>
        {!compact && <Label className="text-xs text-muted-foreground mb-1 block">
          {lang === "th" ? "ภาคเรียน" : "Semester"}
        </Label>}
        <Select
          value={String(semester)}
          onValueChange={(v) => onSemesterChange(parseInt(v))}
        >
          <SelectTrigger className={compact ? "w-[110px] h-8 text-xs" : "w-[140px]"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowAllSemesters && (
              <SelectItem value="0">{lang === "th" ? "ทั้งสองเทอม" : "Both"}</SelectItem>
            )}
            <SelectItem value="1">{lang === "th" ? "เทอม 1" : "Sem 1"}</SelectItem>
            <SelectItem value="2">{lang === "th" ? "เทอม 2" : "Sem 2"}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
