import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, CheckCircle2, AlertTriangle, Loader2, Crosshair } from "lucide-react";
import { useSchoolGeofence, calcDistanceMeters, getCurrentCoords } from "@/hooks/useSchoolGeofence";
import { getNativeCoords, isNative, tap } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { todayBangkok } from "@/lib/dateBE";

interface Props {
  studentId: string;
  studentName?: string;
}

/**
 * เช็คชื่อตัวเอง (GPS) — นักเรียน/ผู้ปกครอง กดยืนยันว่า "อยู่ในรั้วโรงเรียน"
 * - ใช้ geofence เดียวกับระบบลงเวลาครู (school_settings.clock_*)
 * - บันทึกลง attendance: status=present, notes=self-gps:<distance>m (subject_id=NULL = assembly)
 * - กันซ้ำต่อวันด้วย delete-then-insert เหมือนหน้า LIFF
 */
export default function StudentSelfCheckIn({ studentId, studentName }: Props) {
  const geo = useSchoolGeofence();
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkedToday, setCheckedToday] = useState<string | null>(null);
  const today = todayBangkok();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("attendance")
        .select("status, created_at")
        .eq("student_id", studentId)
        .eq("attendance_date", today)
        .is("subject_id", null)
        .maybeSingle();
      if (data) setCheckedToday(data.status);
    })();
  }, [studentId, today]);

  const refreshGps = async () => {
    setLoading(true);
    try {
      const c = isNative()
        ? await getNativeCoords({ timeoutMs: 10000 })
        : await getCurrentCoords({ maxWaitMs: 8000, targetAccuracyMeters: 50 });
      setCoords(c);
    } catch (e: any) {
      toast.error(e?.message || "อ่าน GPS ไม่ได้");
    } finally { setLoading(false); }
  };

  useEffect(() => { refreshGps(); /* on mount */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const distance = coords && geo.hasCoords
    ? Math.round(calcDistanceMeters(coords.lat, coords.lng, geo.lat, geo.lng))
    : null;
  const inside = distance !== null && distance <= geo.radius;

  const checkIn = async () => {
    if (!coords) { toast.error("ยังไม่ได้ตำแหน่ง GPS"); return; }
    if (geo.configured && !inside) {
      toast.error(`อยู่นอกรั้วโรงเรียน (ห่าง ${distance} ม., อนุญาต ${geo.radius} ม.)`);
      return;
    }
    setBusy(true);
    try {
      const cur = new Date();
      const year = cur.getFullYear() + (cur.getMonth() >= 4 ? 0 : -1);
      const sem = cur.getMonth() >= 4 && cur.getMonth() <= 9 ? 1 : 2;
      const { data: u } = await supabase.auth.getUser();
      // ลบของวันนี้ก่อน (กันซ้ำ — NULL subject_id ใช้ ON CONFLICT ไม่ได้)
      await supabase.from("attendance").delete()
        .eq("student_id", studentId)
        .eq("attendance_date", today)
        .is("subject_id", null);
      const { error } = await supabase.from("attendance").insert({
        student_id: studentId,
        attendance_date: today,
        subject_id: null,
        status: "present",
        academic_year: year,
        semester: sem,
        recorded_by: u?.user?.id ?? null,
        notes: `self-gps:${distance ?? "?"}m`,
      });
      if (error) throw error;
      setCheckedToday("present");
      await tap("medium");
      toast.success("เช็คชื่อสำเร็จ ✓");
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          เช็คชื่อตัวเอง (GPS) {studentName && <span className="text-sm font-normal text-muted-foreground">— {studentName}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checkedToday && (
          <div className="flex items-center gap-2 rounded-lg bg-success-soft border border-success/30 p-3 text-sm">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-success-soft-foreground">บันทึก "{checkedToday === "present" ? "มาเรียน" : checkedToday}" ของวันนี้ ({today}) แล้ว</span>
          </div>
        )}

        {!geo.hasCoords && (
          <div className="flex items-center gap-2 rounded-lg bg-warning-soft border border-warning/30 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span>ผู้ดูแลยังไม่ตั้งพิกัดโรงเรียน — จะไม่ตรวจระยะ</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border p-2">
            <p className="text-[11px] text-muted-foreground">ตำแหน่งของคุณ</p>
            <p className="font-mono text-xs">
              {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : loading ? "กำลังหา..." : "—"}
            </p>
            {coords && <p className="text-[11px] text-muted-foreground">±{Math.round(coords.accuracy)} ม.</p>}
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-[11px] text-muted-foreground">ระยะห่าง</p>
            <p className="font-mono text-xs">{distance !== null ? `${distance} ม.` : "—"}</p>
            <p className="text-[11px] text-muted-foreground">อนุญาต {geo.radius} ม.</p>
          </div>
        </div>

        {coords && geo.hasCoords && (
          <Badge variant={inside ? "default" : "destructive"} className="w-full justify-center py-1.5">
            {inside ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> อยู่ในรั้วโรงเรียน</>
                    : <><AlertTriangle className="w-3.5 h-3.5 mr-1" /> อยู่นอกรั้ว</>}
          </Badge>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshGps} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Crosshair className="w-4 h-4 mr-1" />}
            อ่าน GPS ใหม่
          </Button>
          <Button size="sm" onClick={checkIn} disabled={busy || !coords || (geo.configured && !inside)} className="flex-1">
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            ยืนยันมาเรียน
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
