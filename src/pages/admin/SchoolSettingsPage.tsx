import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, GraduationCap, CalendarDays, MapPin, Save, Mail, Shield, Power, LayoutDashboard, Globe, Server } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { swal } from "@/lib/swal";
import { ALL_GRADE_LEVELS } from "@/lib/gradeOrder";
import SemesterSettingsPage from "./SemesterSettingsPage";
import SchoolLocationPage from "./SchoolLocationPage";
import SystemSettingsPage from "./SystemSettingsPage";
import FieldVisibilityPage from "./FieldVisibilityPage";
import ModuleTogglesPage from "./ModuleTogglesPage";
import DashboardShortcutsAdminPage from "./DashboardShortcutsAdminPage";
import BrowserShortcutsAdminPage from "./BrowserShortcutsAdminPage";

function GeneralSchoolSettings() {
  const qc = useQueryClient();
  const { data: schoolSettings = [] } = useQuery({
    queryKey: ["school_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("school_settings").select("*");
      return data || [];
    },
  });
  const getSetting = (key: string) =>
    (schoolSettings as any[]).find((s) => s.setting_key === key)?.setting_value || "";

  const [gradeStart, setGradeStart] = useState("ป.1");
  const [gradeEnd, setGradeEnd] = useState("ม.6");
  const [terminalGrades, setTerminalGrades] = useState<string[]>(["ป.6", "ม.3", "ม.6"]);
  const [emailDomain, setEmailDomain] = useState("@bng.ac.th");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if ((schoolSettings as any[]).length > 0) {
      setGradeStart(getSetting("grade_range_start") || "ป.1");
      setGradeEnd(getSetting("grade_range_end") || "ม.6");
      setEmailDomain(getSetting("email_domain") || "@bng.ac.th");
      try {
        setTerminalGrades(JSON.parse(getSetting("terminal_grades") || '["ป.6","ม.3","ม.6"]'));
      } catch {
        setTerminalGrades(["ป.6", "ม.3", "ม.6"]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { setting_key: "grade_range_start", setting_value: gradeStart },
        { setting_key: "grade_range_end", setting_value: gradeEnd },
        { setting_key: "terminal_grades", setting_value: JSON.stringify(terminalGrades) },
        { setting_key: "email_domain", setting_value: emailDomain },
      ];
      for (const u of updates) {
        await supabase.from("school_settings").upsert(u, { onConflict: "setting_key" });
      }
      swal.toast.success("บันทึกการตั้งค่าเรียบร้อย");
      qc.invalidateQueries({ queryKey: ["school_settings"] });
    } catch (e: any) {
      swal.error(e.message || "บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" /> ระดับชั้นที่เปิดสอน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <Label>เปิดสอนตั้งแต่ระดับ</Label>
              <Select value={gradeStart} onValueChange={setGradeStart}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ถึงระดับ</Label>
              <Select value={gradeEnd} onValueChange={setGradeEnd}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ระดับชั้นที่จบการศึกษา (ศิษย์เก่า)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            เลือกระดับชั้นที่ถือว่าจบหลักสูตร เมื่อกด "จบการศึกษาอัตโนมัติ" ระบบจะย้ายนักเรียนในชั้นเหล่านี้ไปเป็นศิษย์เก่า
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_GRADE_LEVELS.map((g) => (
              <Badge
                key={g}
                variant={terminalGrades.includes(g) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() =>
                  setTerminalGrades((prev) =>
                    prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                  )
                }
              >
                {g}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> โดเมนอีเมลของโรงเรียน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            กำหนดส่วนท้ายอีเมลสำหรับสร้างบัญชีผู้ใช้ เช่น @bng.ac.th
          </p>
          <Input
            value={emailDomain}
            onChange={(e) => setEmailDomain(e.target.value)}
            placeholder="@bng.ac.th"
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </Button>
      </div>
    </div>
  );
}

export default function SchoolSettingsPage() {
  const { lang } = useLanguage();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "general";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          {lang === "th" ? "ตั้งค่าโรงเรียน" : "School Settings"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === "th"
            ? "รวมการตั้งค่าโรงเรียนทั้งหมดไว้ที่เดียว: ระบบ · ระดับชั้น · ปีการศึกษา · GPS · ฟิลด์ · โมดูล · ปุ่มลัด"
            : "All school-wide settings in one place: system, grades, year, GPS, fields, modules, shortcuts"}
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(sp);
          next.set("tab", v);
          setSp(next, { replace: true });
        }}
      >
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general" className="gap-1">
            <GraduationCap className="w-4 h-4" /> {lang === "th" ? "ทั่วไป" : "General"}
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-1">
            <Server className="w-4 h-4" /> {lang === "th" ? "ระบบ & Cloud" : "System"}
          </TabsTrigger>
          <TabsTrigger value="year" className="gap-1">
            <CalendarDays className="w-4 h-4" /> {lang === "th" ? "ปีการศึกษา" : "Academic Year"}
          </TabsTrigger>
          <TabsTrigger value="location" className="gap-1">
            <MapPin className="w-4 h-4" /> {lang === "th" ? "ตำแหน่ง GPS" : "Location"}
          </TabsTrigger>
          <TabsTrigger value="fields" className="gap-1">
            <Shield className="w-4 h-4" /> {lang === "th" ? "ฟิลด์โปรไฟล์" : "Field Visibility"}
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-1">
            <Power className="w-4 h-4" /> {lang === "th" ? "โมดูล" : "Modules"}
          </TabsTrigger>
          <TabsTrigger value="dashboard-shortcuts" className="gap-1">
            <LayoutDashboard className="w-4 h-4" /> {lang === "th" ? "ปุ่มลัด Dashboard" : "Dashboard Tiles"}
          </TabsTrigger>
          <TabsTrigger value="browser-shortcuts" className="gap-1">
            <Globe className="w-4 h-4" /> {lang === "th" ? "ปุ่มลัด Browser" : "Browser Tiles"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralSchoolSettings />
        </TabsContent>
        <TabsContent value="system" className="mt-4">
          <SystemSettingsPage />
        </TabsContent>
        <TabsContent value="year" className="mt-4">
          <SemesterSettingsPage />
        </TabsContent>
        <TabsContent value="location" className="mt-4">
          <SchoolLocationPage />
        </TabsContent>
        <TabsContent value="fields" className="mt-4">
          <FieldVisibilityPage />
        </TabsContent>
        <TabsContent value="modules" className="mt-4">
          <ModuleTogglesPage />
        </TabsContent>
        <TabsContent value="dashboard-shortcuts" className="mt-4">
          <DashboardShortcutsAdminPage />
        </TabsContent>
        <TabsContent value="browser-shortcuts" className="mt-4">
          <BrowserShortcutsAdminPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
