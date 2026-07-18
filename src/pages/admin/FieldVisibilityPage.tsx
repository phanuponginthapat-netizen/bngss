import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useFieldVisibility, DEFAULT_FIELD_VISIBILITY, FIELD_LABELS, FIELD_GROUPS, type DmcFieldConfig } from "@/hooks/useFieldVisibility";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveWithToast } from "@/lib/saveWithToast";
import { Settings, Save, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const FieldVisibilityPage = () => {
  const { lang } = useLanguage();
  const { config } = useFieldVisibility();
  const qc = useQueryClient();
  const [fields, setFields] = useState<DmcFieldConfig>(DEFAULT_FIELD_VISIBILITY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields(config);
  }, [config]);

  const toggle = (key: keyof DmcFieldConfig) => {
    setFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWithToast(async () => {
        const value = JSON.stringify(fields);
        const { data: existing } = await supabase
          .from("cms_settings")
          .select("id")
          .eq("key", "dmc_field_visibility")
          .maybeSingle();
        if (existing) {
          await supabase.from("cms_settings").update({ value } as any).eq("key", "dmc_field_visibility");
        } else {
          await supabase.from("cms_settings").insert({ key: "dmc_field_visibility", value } as any);
        }
        qc.invalidateQueries({ queryKey: ["dmc_field_visibility"] });
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

  const handleReset = () => {
    setFields(DEFAULT_FIELD_VISIBILITY);
  };

  const enabledCount = Object.values(fields).filter(Boolean).length;
  const totalCount = Object.keys(fields).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            {lang === "th" ? "ตั้งค่าการแสดงข้อมูล DMC" : "DMC Field Visibility Settings"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "กำหนดว่าจะแสดงข้อมูลใดในโปรไฟล์นักเรียน, บัตรประจำตัว และระบบ DMC"
              : "Configure which fields are visible in student profiles, ID cards, and DMC system"}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <Eye className="w-3 h-3" /> {enabledCount}/{totalCount}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            {lang === "th" ? "รีเซ็ต" : "Reset"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? "กำลังบันทึก..." : lang === "th" ? "บันทึก" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELD_GROUPS.map((group) => (
          <Card key={group.label}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{group.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {group.fields.filter(f => fields[f]).length}/{group.fields.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.fields.map((field) => (
                <div key={field} className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    {fields[field] ? (
                      <Eye className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    {FIELD_LABELS[field]}
                  </Label>
                  <Switch
                    checked={fields[field]}
                    onCheckedChange={() => toggle(field)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            💡 การตั้งค่านี้จะมีผลกับ: หน้าโปรไฟล์นักเรียน, บัตรประจำตัว, หน้า DMC, และระบบจัดการผู้ใช้
            — ระบบอื่นๆ เช่น เช็คชื่อ, เยี่ยมบ้าน, คัดกรอง จะดึงข้อมูลจากฐานข้อมูลนักเรียน (DMC) โดยตรง
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FieldVisibilityPage;
