import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { saveWithToast } from "@/lib/saveWithToast";
import { Save, CalendarDays, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAcademicYear } from "@/hooks/useAcademicYear";

const MONTHS = [
  { value: 1, th: "มกราคม", en: "January" },
  { value: 2, th: "กุมภาพันธ์", en: "February" },
  { value: 3, th: "มีนาคม", en: "March" },
  { value: 4, th: "เมษายน", en: "April" },
  { value: 5, th: "พฤษภาคม", en: "May" },
  { value: 6, th: "มิถุนายน", en: "June" },
  { value: 7, th: "กรกฎาคม", en: "July" },
  { value: 8, th: "สิงหาคม", en: "August" },
  { value: 9, th: "กันยายน", en: "September" },
  { value: 10, th: "ตุลาคม", en: "October" },
  { value: 11, th: "พฤศจิกายน", en: "November" },
  { value: 12, th: "ธันวาคม", en: "December" },
];

const SemesterSettingsPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { config, currentAcademicYear, currentSemester } = useAcademicYear();

  const [sem1Start, setSem1Start] = useState("5");
  const [sem1End, setSem1End] = useState("10");
  const [sem2Start, setSem2Start] = useState("11");
  const [sem2End, setSem2End] = useState("4");
  const [yearStart, setYearStart] = useState("5");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSem1Start(String(config.semester1StartMonth));
    setSem1End(String(config.semester1EndMonth));
    setSem2Start(String(config.semester2StartMonth));
    setSem2End(String(config.semester2EndMonth));
    setYearStart(String(config.academicYearStartMonth));
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWithToast(async () => {
        const updates = [
          { setting_key: "semester_1_start_month", setting_value: sem1Start },
          { setting_key: "semester_1_end_month", setting_value: sem1End },
          { setting_key: "semester_2_start_month", setting_value: sem2Start },
          { setting_key: "semester_2_end_month", setting_value: sem2End },
          { setting_key: "academic_year_start_month", setting_value: yearStart },
        ];
        for (const u of updates) {
          await supabase.from("school_settings").upsert(u, { onConflict: "setting_key" });
        }
        qc.invalidateQueries({ queryKey: ["semester-config"] });
      }, {
        loading: lang === "th" ? "กำลังบันทึกการตั้งค่า..." : "Saving settings...",
        success: lang === "th" ? "บันทึกการตั้งค่าสำเร็จ" : "Settings saved",
      });
    } catch {
      /* toast already shown */
    } finally {
      setSaving(false);
    }
  };

  const getMonthName = (m: number) => {
    const month = MONTHS.find(mo => mo.value === m);
    return month ? month[lang === "th" ? "th" : "en"] : String(m);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" />
          {lang === "th" ? "ตั้งค่าปีการศึกษาและภาคเรียน" : "Academic Year & Semester Settings"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === "th"
            ? "กำหนดเดือนเริ่มต้นและสิ้นสุดของแต่ละภาคเรียน เพื่อให้ระบบคำนวณปีการศึกษาและเทอมปัจจุบันอัตโนมัติ"
            : "Configure semester start/end months for automatic academic year calculation"}
        </p>
      </div>

      {/* Current status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              <span className="font-medium">{lang === "th" ? "สถานะปัจจุบัน:" : "Current:"}</span>
            </div>
            <Badge variant="default" className="text-sm px-3 py-1">
              {lang === "th" ? `ปีการศึกษา ${currentAcademicYear}` : `Academic Year ${currentAcademicYear - 543}`}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {lang === "th" ? `ภาคเรียนที่ ${currentSemester}` : `Semester ${currentSemester}`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic year start */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {lang === "th" ? "เดือนเริ่มต้นปีการศึกษา" : "Academic Year Start Month"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={yearStart} onValueChange={setYearStart}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m[lang === "th" ? "th" : "en"]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {lang === "th"
                ? "เดือนที่เริ่มนับปีการศึกษาใหม่ (ปกติ: พฤษภาคม)"
                : "Month when new academic year starts (default: May)"}
            </p>
          </CardContent>
        </Card>

        {/* Semester 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {lang === "th" ? "ภาคเรียนที่ 1" : "Semester 1"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lang === "th" ? "เดือนเริ่ม" : "Start"}</Label>
                <Select value={sem1Start} onValueChange={setSem1Start}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m[lang === "th" ? "th" : "en"]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{lang === "th" ? "เดือนสิ้นสุด" : "End"}</Label>
                <Select value={sem1End} onValueChange={setSem1End}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m[lang === "th" ? "th" : "en"]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "th"
                ? `ปัจจุบัน: ${getMonthName(parseInt(sem1Start))} - ${getMonthName(parseInt(sem1End))}`
                : `Current: ${getMonthName(parseInt(sem1Start))} - ${getMonthName(parseInt(sem1End))}`}
            </p>
          </CardContent>
        </Card>

        {/* Semester 2 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {lang === "th" ? "ภาคเรียนที่ 2" : "Semester 2"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lang === "th" ? "เดือนเริ่ม" : "Start"}</Label>
                <Select value={sem2Start} onValueChange={setSem2Start}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m[lang === "th" ? "th" : "en"]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{lang === "th" ? "เดือนสิ้นสุด" : "End"}</Label>
                <Select value={sem2End} onValueChange={setSem2End}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m[lang === "th" ? "th" : "en"]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "th"
                ? `ปัจจุบัน: ${getMonthName(parseInt(sem2Start))} - ${getMonthName(parseInt(sem2End))}`
                : `Current: ${getMonthName(parseInt(sem2Start))} - ${getMonthName(parseInt(sem2End))}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saving ? (lang === "th" ? "กำลังบันทึก..." : "Saving...") : (lang === "th" ? "บันทึกการตั้งค่า" : "Save Settings")}
        </Button>
      </div>
    </div>
  );
};

export default SemesterSettingsPage;
