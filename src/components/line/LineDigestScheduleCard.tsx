import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { swal } from "@/lib/swal";
import { Clock } from "lucide-react";

const KEYS = [
  "line_digest_enabled",
  "line_digest_time",
  "line_digest_days",
  "line_digest_include_calendar",
] as const;

const DAYS = [
  { v: 1, label: "จ." },
  { v: 2, label: "อ." },
  { v: 3, label: "พ." },
  { v: 4, label: "พฤ." },
  { v: 5, label: "ศ." },
  { v: 6, label: "ส." },
  { v: 0, label: "อา." },
];

export default function LineDigestScheduleCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [withCalendar, setWithCalendar] = useState(true);
  const [time, setTime] = useState("10:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", KEYS as unknown as string[]);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { if (r.setting_value != null) map[r.setting_key] = String(r.setting_value); });
      setEnabled(map.line_digest_enabled !== "false");
      setWithCalendar(map.line_digest_include_calendar !== "false");
      setTime((map.line_digest_time || "10:00").slice(0, 5));
      setDays((map.line_digest_days ?? "1,2,3,4,5").split(",").map((d) => parseInt(d, 10)).filter((d) => !isNaN(d)));
      setLoading(false);
    })();
  }, []);

  const toggleDay = (v: number) =>
    setDays((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v].sort()));

  const save = async () => {
    if (!/^\d{2}:\d{2}$/.test(time)) return swal.error("เวลาไม่ถูกต้อง", "กรุณาเลือกเวลาในรูปแบบ ชม.:นาที");
    if (enabled && days.length === 0) return swal.error("ยังไม่ได้เลือกวัน", "เลือกอย่างน้อย 1 วันที่ต้องการให้แจ้งเตือน");
    setSaving(true);
    const rows = [
      { setting_key: "line_digest_enabled", setting_value: String(enabled) },
      { setting_key: "line_digest_time", setting_value: time },
      { setting_key: "line_digest_days", setting_value: days.join(",") },
      { setting_key: "line_digest_include_calendar", setting_value: String(withCalendar) },
    ];
    const { error } = await supabase
      .from("school_settings")
      .upsert(rows as any, { onConflict: "setting_key" });
    setSaving(false);
    if (error) return swal.error("บันทึกไม่สำเร็จ", error.message);
    swal.success("บันทึกแล้ว", enabled ? `จะส่งวันละ 1 ข้อความ เวลา ${time} น.` : "ปิดการแจ้งเตือนประจำวันแล้ว");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> เวลาแจ้งเตือนประจำวัน (LINE)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          ส่งสรุปเข้ากลุ่ม LINE <b>วันละ 1 ข้อความเท่านั้น</b> — เลือกเวลาและวันที่ต้องการได้เอง
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
          <span className="text-sm">เปิดการแจ้งเตือนประจำวัน</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
        </label>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">เวลาส่ง (เวลาไทย)</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={loading} className="w-40" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">วันที่ต้องการแจ้งเตือน</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <Button
                key={d.v}
                type="button"
                size="sm"
                variant={days.includes(d.v) ? "default" : "outline"}
                onClick={() => toggleDay(d.v)}
                disabled={loading}
                className="w-12"
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
          <span className="text-sm">รวมปฏิทินกิจกรรมไว้ในข้อความเดียวกัน</span>
          <Switch checked={withCalendar} onCheckedChange={setWithCalendar} disabled={loading} />
        </label>

        <Button onClick={save} disabled={loading || saving} size="sm">
          {saving ? "กำลังบันทึก…" : "บันทึกการตั้งเวลา"}
        </Button>
      </CardContent>
    </Card>
  );
}
