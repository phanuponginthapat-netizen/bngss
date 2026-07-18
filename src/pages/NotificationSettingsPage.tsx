import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Smartphone, MessageCircle, MoonStar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TimeInput } from "@/components/ui/time-input";

const TYPES: Array<{ key: string; label: string }> = [
  { key: "homework", label: "การบ้าน" },
  { key: "attendance", label: "การเช็คชื่อ" },
  { key: "behavior", label: "บันทึกพฤติกรรม" },
  { key: "news", label: "ข่าวสาร / ประกาศ" },
  { key: "eform", label: "เอกสาร E-Form" },
  { key: "staff_leave", label: "ใบลา (บุคลากร)" },
  { key: "student_leave", label: "ใบลา (นักเรียน)" },
  { key: "substitute_teaching", label: "การจัดสอนแทน" },
  { key: "emergency", label: "เหตุฉุกเฉิน" },
];

interface Prefs {
  in_app_enabled: boolean;
  push_enabled: boolean;
  line_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  type_overrides: Record<string, boolean>;
  min_push_severity: "info" | "warning" | "critical";
}

const DEFAULT: Prefs = {
  in_app_enabled: true,
  push_enabled: true,
  line_enabled: true,
  email_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  type_overrides: {},
  min_push_severity: "info",
};

export default function NotificationSettingsPage() {
  const { userId } = useUserRole();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setPrefs({
          in_app_enabled: data.in_app_enabled,
          push_enabled: data.push_enabled,
          line_enabled: data.line_enabled,
          email_enabled: data.email_enabled,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          type_overrides: (data.type_overrides as any) || {},
          min_push_severity: (data.min_push_severity as any) || "info",
        });
      }
      setLoading(false);
    })();
  }, [userId]);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("บันทึกค่าแล้ว");
  };

  const setType = (k: string, on: boolean) => {
    setPrefs((p) => ({ ...p, type_overrides: { ...p.type_overrides, [k]: on } }));
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />กำลังโหลด...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="w-6 h-6 text-primary" /> ตั้งค่าการแจ้งเตือน</h1>
        <p className="text-sm text-muted-foreground">เลือกช่องทาง เวลา และประเภทการแจ้งเตือนที่ต้องการรับ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ช่องทาง</CardTitle>
          <CardDescription>เปิด/ปิดการแจ้งเตือนแต่ละช่องทาง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "in_app_enabled", icon: Bell, label: "ในระบบ (ไอคอนกระดิ่ง)" },
            { key: "push_enabled", icon: Smartphone, label: "Push Notification (PWA/มือถือ)" },
            { key: "line_enabled", icon: MessageCircle, label: "LINE Official Account" },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground" /><Label>{c.label}</Label></div>
                <Switch checked={(prefs as any)[c.key]} onCheckedChange={(v) => setPrefs({ ...prefs, [c.key]: v } as Prefs)} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MoonStar className="w-5 h-5" /> ห้ามรบกวน</CardTitle>
          <CardDescription>ช่วงเวลาที่ไม่ส่ง Push / LINE (ยกเว้นเหตุฉุกเฉิน)</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>เริ่ม</Label>
            <TimeInput value={prefs.quiet_hours_start ?? ""} onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label>สิ้นสุด</Label>
            <TimeInput value={prefs.quiet_hours_end ?? ""} onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value || null })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>ระดับขั้นต่ำที่จะส่ง Push</Label>
            <Select value={prefs.min_push_severity} onValueChange={(v: any) => setPrefs({ ...prefs, min_push_severity: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">ทั้งหมด (info ขึ้นไป)</SelectItem>
                <SelectItem value="warning">เฉพาะ warning ขึ้นไป</SelectItem>
                <SelectItem value="critical">เฉพาะเหตุฉุกเฉินเท่านั้น</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ประเภทการแจ้งเตือน</CardTitle>
          <CardDescription>เลือกประเภทที่ต้องการ (ค่าเริ่มต้น = เปิด)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {TYPES.map((t) => (
            <div key={t.key} className="flex items-center justify-between">
              <Label>{t.label}</Label>
              <Switch
                checked={prefs.type_overrides[t.key] !== false}
                onCheckedChange={(v) => setType(t.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
