import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveWithToast } from "@/lib/saveWithToast";
import { MapPin, Save, Locate, Info, ScanFace, Clock, Satellite } from "lucide-react";
import MapPicker from "@/components/MapPicker";
import { useQueryClient } from "@tanstack/react-query";

/**
 * จุดศูนย์กลางตั้งค่าพิกัด/รัศมีโรงเรียน (ใช้คีย์ clock_latitude / clock_longitude / clock_radius)
 * เชื่อมโยงทั้งระบบ: ลงเวลาครู, สแกนหน้านักเรียน/คีออส, สภาพอากาศบนแดชบอร์ด
 */
const SchoolLocationPage = () => {
  const qc = useQueryClient();
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState<number>(200);
  const [enforce, setEnforce] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["clock_latitude", "clock_longitude", "clock_radius", "gps_enforcement_enabled"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      if (map.clock_latitude) setLat(parseFloat(map.clock_latitude));
      if (map.clock_longitude) setLng(parseFloat(map.clock_longitude));
      if (map.clock_radius) setRadius(parseInt(map.clock_radius) || 200);
      if (map.gps_enforcement_enabled != null) setEnforce(map.gps_enforcement_enabled !== "false");
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (lat == null || lng == null) {
      toast.error("กรุณาปักหมุดตำแหน่งโรงเรียนก่อนบันทึก");
      return;
    }
    setSaving(true);
    try {
      await saveWithToast(async () => {
        const rows: [string, string][] = [
          ["clock_latitude", String(lat)],
          ["clock_longitude", String(lng)],
          ["clock_radius", String(radius)],
          ["gps_enforcement_enabled", enforce ? "true" : "false"],
        ];
        for (const [key, val] of rows) {
          const { data: existing } = await supabase
            .from("school_settings")
            .select("id")
            .eq("setting_key", key)
            .maybeSingle();
          if (existing) {
            await supabase.from("school_settings").update({ setting_value: val }).eq("id", existing.id);
          } else {
            await supabase.from("school_settings").insert({ setting_key: key, setting_value: val });
          }
        }
        qc.invalidateQueries({ queryKey: ["school_settings_bulk"] });
        qc.invalidateQueries({ queryKey: ["gps_settings"] });
      }, {
        loading: "กำลังบันทึกพิกัดโรงเรียน...",
        success: "บันทึกพิกัดโรงเรียนสำเร็จ — ระบบที่เกี่ยวข้องจะใช้ค่าใหม่ทันที",
        error: "บันทึกไม่สำเร็จ",
      });
    } catch {
      /* toast already shown */
    } finally {
      setSaving(false);
    }
  };

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(+pos.coords.latitude.toFixed(6));
        setLng(+pos.coords.longitude.toFixed(6));
        toast.success("ดึงพิกัดปัจจุบันสำเร็จ");
      },
      () => toast.error("ไม่สามารถดึงตำแหน่ง GPS")
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            ตำแหน่งและรัศมีโรงเรียน
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ปักหมุดที่ตั้งโรงเรียน — ใช้ร่วมกันทุกระบบที่ต้องการพื้นที่อ้างอิง
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || loading} className="gradient-primary">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> ปักหมุดบนแผนที่
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && (
            <MapPicker
              lat={lat}
              lng={lng}
              radius={radius}
              height={420}
              onChange={(la, ln) => { setLat(la); setLng(ln); }}
            />
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">ละติจูด</Label>
              <Input
                type="number"
                step="0.000001"
                value={lat ?? ""}
                onChange={(e) => setLat(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="13.7563"
              />
            </div>
            <div>
              <Label className="text-xs">ลองจิจูด</Label>
              <Input
                type="number"
                step="0.000001"
                value={lng ?? ""}
                onChange={(e) => setLng(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="100.5018"
              />
            </div>
            <div>
              <Label className="text-xs">รัศมีที่อนุญาต (เมตร)</Label>
              <Input
                type="number"
                min={20}
                max={5000}
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">ปรับรัศมี</span>
              <span className="font-semibold">{radius} เมตร</span>
            </div>
            <Slider value={[radius]} min={20} max={2000} step={10} onValueChange={(v) => setRadius(v[0])} />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={useMyLocation}>
              <Locate className="w-4 h-4 mr-1" /> ใช้ตำแหน่งปัจจุบัน
            </Button>
            {lat != null && lng != null && (
              <Badge variant="outline" className="font-mono">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={enforce ? "border-emerald-300/60" : "border-amber-300/60"}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Satellite className={`w-5 h-5 ${enforce ? "text-emerald-600" : "text-amber-600"}`} />
            บังคับใช้พิกัด GPS ทั้งระบบ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {enforce ? "เปิด — บังคับให้อยู่ในรัศมีเท่านั้น" : "ปิด — ไม่ตรวจระยะ (ลงเวลา/สแกนได้ทุกที่)"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                ถ้าบริเวณโรงเรียนสัญญาณ GPS ไม่นิ่ง (เครื่องมักจับ WiFi แทน GPS) และครูลงเวลาไม่ได้
                ให้ปิดสวิตช์นี้ชั่วคราว ระบบจะไม่บล็อกตามรัศมี แต่ยังคงพยายามอ่านพิกัดเพื่อบันทึก log อยู่
              </p>
              <p className="text-[11px] text-muted-foreground">
                มีผลกับ: ลงเวลาเข้า-ออกครู, สแกนหน้านักเรียน/คีออส (ปฏิทินอากาศใช้พิกัดเสมอ ไม่กระทบ)
              </p>
            </div>
            <Switch checked={enforce} onCheckedChange={setEnforce} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> ระบบที่ใช้ตำแหน่งนี้ร่วมกัน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium">ลงเวลาเข้า-ออกของบุคลากร</p>
              <p className="text-xs text-muted-foreground">บล็อกการลงเวลานอกรัศมีอัตโนมัติ</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ScanFace className="w-4 h-4 mt-0.5 text-emerald-500" />
            <div>
              <p className="font-medium">สแกนหน้านักเรียน (รวมโหมดคีออสแทปเลต)</p>
              <p className="text-xs text-muted-foreground">เปิดกล้องและบันทึกสแกนได้เฉพาะเมื่ออยู่ในรัศมี</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-blue-500" />
            <div>
              <p className="font-medium">วิดเจ็ตสภาพอากาศและ PM2.5 บนแดชบอร์ด</p>
              <p className="text-xs text-muted-foreground">ดึงข้อมูลตามพิกัดของโรงเรียน</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolLocationPage;
