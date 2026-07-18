import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { saveWithToast } from "@/lib/saveWithToast";
import { Save, CalendarDays, GraduationCap, Zap, RotateCcw, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { swal } from "@/lib/swal";
import { logAudit } from "@/lib/auditLog";
import { BE_OFFSET } from "@/lib/dateBE";

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

const upsert = (key: string, value: string | null) =>
  supabase.from("school_settings").upsert(
    { setting_key: key, setting_value: value ?? "" },
    { onConflict: "setting_key" }
  );

const SemesterSettingsPage = () => {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const qc = useQueryClient();
  const {
    config, currentAcademicYear, currentSemester,
    autoAcademicYear, autoSemester, isManualMode, academicYearOptions,
  } = useAcademicYear();

  const [sem1Start, setSem1Start] = useState("5");
  const [sem1End, setSem1End] = useState("10");
  const [sem2Start, setSem2Start] = useState("11");
  const [sem2End, setSem2End] = useState("4");
  const [yearStart, setYearStart] = useState("5");

  const [manual, setManual] = useState(false);
  const [manualYear, setManualYear] = useState(currentAcademicYear);
  const [manualSem, setManualSem] = useState<1 | 2>(currentSemester as 1 | 2);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSem1Start(String(config.semester1StartMonth));
    setSem1End(String(config.semester1EndMonth));
    setSem2Start(String(config.semester2StartMonth));
    setSem2End(String(config.semester2EndMonth));
    setYearStart(String(config.academicYearStartMonth));
  }, [config]);

  useEffect(() => {
    setManual(isManualMode);
    setManualYear(currentAcademicYear);
    setManualSem(currentSemester as 1 | 2);
  }, [isManualMode, currentAcademicYear, currentSemester]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["semester-config"] });

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWithToast(async () => {
        const rows = [
          upsert("semester_1_start_month", sem1Start),
          upsert("semester_1_end_month", sem1End),
          upsert("semester_2_start_month", sem2Start),
          upsert("semester_2_end_month", sem2End),
          upsert("academic_year_start_month", yearStart),
          upsert("academic_year_override", manual ? String(manualYear) : ""),
          upsert("semester_override", manual ? String(manualSem) : ""),
        ];
        for (const r of rows) await r;
        refresh();
        logAudit({
          action: "semester_settings_save",
          target_table: "school_settings",
          details: { manual, manualYear, manualSem, yearStart, sem1Start, sem1End, sem2Start, sem2End },
        });
      }, {
        loading: L("กำลังบันทึก...", "Saving..."),
        success: L("บันทึกเรียบร้อย", "Saved"),
      });
    } finally {
      setSaving(false);
    }
  };

  // Quick actions --------------------------------------------------

  const setOverride = async (year: number, sem: 1 | 2, msg: string) => {
    await upsert("academic_year_override", String(year));
    await upsert("semester_override", String(sem));
    refresh();
    toast.success(msg);
    logAudit({ action: "semester_quick_action", target_table: "school_settings", details: { year, sem } });
  };

  const startNewYear = async () => {
    const nextYear = currentAcademicYear + 1;
    if (!(await swal.confirm({
      title: L("เริ่มปีการศึกษาใหม่?", "Start new academic year?"),
      text: L(
        `กำหนดเป็นปีการศึกษา ${nextYear} · ภาคเรียนที่ 1 (คุณควรเลื่อนชั้นนักเรียนก่อนหรือหลังการเปลี่ยนก็ได้)`,
        `Set academic year ${nextYear - BE_OFFSET} · Semester 1`
      ),
    }))) return;
    await setOverride(nextYear, 1, L(`ตั้งเป็นปีการศึกษา ${nextYear} เรียบร้อย`, `Set to ${nextYear - BE_OFFSET}`));
    setManual(true);
    setManualYear(nextYear);
    setManualSem(1);
  };

  const flipSemester = async () => {
    const next: 1 | 2 = currentSemester === 1 ? 2 : 1;
    if (!(await swal.confirm({
      title: L(`เปลี่ยนเป็นภาคเรียนที่ ${next}?`, `Switch to Semester ${next}?`),
    }))) return;
    await setOverride(currentAcademicYear, next, L(`เปลี่ยนเป็นภาคเรียนที่ ${next}`, `Semester ${next}`));
    setManual(true);
    setManualSem(next);
  };

  const backToAuto = async () => {
    if (!(await swal.confirm({
      title: L("กลับสู่โหมดอัตโนมัติ?", "Switch to auto mode?"),
      text: L("ระบบจะคำนวณปีการศึกษาและภาคเรียนจากเดือนตามค่าที่ตั้งไว้", "System will calculate from months"),
    }))) return;
    await upsert("academic_year_override", "");
    await upsert("semester_override", "");
    refresh();
    setManual(false);
    toast.success(L("กลับสู่โหมดอัตโนมัติแล้ว", "Switched to auto mode"));
    logAudit({ action: "semester_back_to_auto", target_table: "school_settings" });
  };

  const monthName = (m: number) => {
    const mo = MONTHS.find(x => x.value === m);
    return mo ? mo[lang === "th" ? "th" : "en"] : String(m);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" />
          {L("ตั้งค่าปีการศึกษาและภาคเรียน", "Academic Year & Semester")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {L(
            "กำหนดเดือนของแต่ละภาคเรียน หรือกำหนดปี/ภาคเรียนปัจจุบันเอง เพื่อคุมช่วงเวลาของทั้งระบบ",
            "Configure months, or override the current year/semester manually"
          )}
        </p>
      </div>

      {/* Current status + quick actions */}
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              <span className="font-semibold">{L("สถานะปัจจุบัน", "Current")}</span>
            </div>
            <Badge className="text-sm px-3 py-1">
              {L(`ปีการศึกษา ${currentAcademicYear}`, `AY ${currentAcademicYear - BE_OFFSET}`)}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {L(`ภาคเรียนที่ ${currentSemester}`, `Semester ${currentSemester}`)}
            </Badge>
            {isManualMode ? (
              <Badge variant="outline" className="text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10">
                <Sparkles className="w-3 h-3" /> {L("กำหนดเอง", "Manual")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10">
                <Zap className="w-3 h-3" /> {L("อัตโนมัติ", "Auto")}
              </Badge>
            )}
          </div>

          {isManualMode && (
            <p className="text-xs text-muted-foreground">
              {L(
                `ระบบตามเวลาจริง: ปีการศึกษา ${autoAcademicYear} · ภาคเรียนที่ ${autoSemester}`,
                `Auto would be: AY ${autoAcademicYear - BE_OFFSET} · Semester ${autoSemester}`
              )}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <Button variant="outline" onClick={flipSemester} className="justify-start">
              <ChevronRight className="w-4 h-4 mr-1" />
              {L(`เปลี่ยนเป็นภาคเรียนที่ ${currentSemester === 1 ? 2 : 1}`, `Switch to Semester ${currentSemester === 1 ? 2 : 1}`)}
            </Button>
            <Button variant="outline" onClick={startNewYear} className="justify-start">
              <Sparkles className="w-4 h-4 mr-1" />
              {L(`เริ่มปีการศึกษา ${currentAcademicYear + 1}`, `Start AY ${currentAcademicYear + 1 - BE_OFFSET}`)}
            </Button>
            <Button variant="outline" onClick={backToAuto} disabled={!isManualMode} className="justify-start">
              <RotateCcw className="w-4 h-4 mr-1" />
              {L("กลับสู่อัตโนมัติ", "Back to auto")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual override */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{L("กำหนดปีการศึกษา/ภาคเรียนเอง", "Manual override")}</CardTitle>
              <CardDescription>
                {L("เมื่อเปิดใช้ ระบบจะยึดค่านี้แทนการคำนวณจากเดือน", "When enabled, this value overrides auto calculation")}
              </CardDescription>
            </div>
            <Switch checked={manual} onCheckedChange={setManual} />
          </div>
        </CardHeader>
        <CardContent className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${manual ? "" : "opacity-50 pointer-events-none"}`}>
          <div className="space-y-1.5">
            <Label>{L("ปีการศึกษา (พ.ศ.)", "Academic Year (BE)")}</Label>
            <Select value={String(manualYear)} onValueChange={(v) => setManualYear(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {academicYearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{L("ภาคเรียน", "Semester")}</Label>
            <Select value={String(manualSem)} onValueChange={(v) => setManualSem(parseInt(v) as 1 | 2)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{L("ภาคเรียนที่ 1", "Semester 1")}</SelectItem>
                <SelectItem value="2">{L("ภาคเรียนที่ 2", "Semester 2")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Months */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{L("เดือนเริ่มปีการศึกษา", "Academic Year Start Month")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={yearStart} onValueChange={setYearStart}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>{m[lang === "th" ? "th" : "en"]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">{L("ปกติ: พฤษภาคม", "Default: May")}</p>
          </CardContent>
        </Card>

        {[
          { label: L("ภาคเรียนที่ 1", "Semester 1"), start: sem1Start, setStart: setSem1Start, end: sem1End, setEnd: setSem1End },
          { label: L("ภาคเรียนที่ 2", "Semester 2"), start: sem2Start, setStart: setSem2Start, end: sem2End, setEnd: setSem2End },
        ].map((s, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-base">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{L("เริ่ม", "Start")}</Label>
                  <Select value={s.start} onValueChange={s.setStart}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m[lang === "th" ? "th" : "en"]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{L("สิ้นสุด", "End")}</Label>
                  <Select value={s.end} onValueChange={s.setEnd}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m[lang === "th" ? "th" : "en"]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {monthName(parseInt(s.start))} - {monthName(parseInt(s.end))}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saving ? L("กำลังบันทึก...", "Saving...") : L("บันทึกการตั้งค่า", "Save Settings")}
        </Button>
      </div>
    </div>
  );
};

export default SemesterSettingsPage;
