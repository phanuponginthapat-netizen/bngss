import { useSchoolSetting } from "./useSchoolSetting";

/**
 * อ่านพิกัด/รัศมีของโรงเรียนจาก CMS (school_settings)
 * ใช้คีย์ชุดเดียวกับระบบลงเวลาของครู: clock_latitude / clock_longitude / clock_radius
 * เพิ่ม `enforce` จากคีย์ `gps_enforcement_enabled` — ถ้าผู้ดูแลปิดสวิตช์
 * จะข้ามการบังคับพิกัดทั้งระบบ (ลงเวลา/สแกนหน้า) เพื่อรองรับกรณี GPS ไม่แม่น (จับ WiFi)
 */
export function useSchoolGeofence() {
  const { value: latStr } = useSchoolSetting("clock_latitude");
  const { value: lngStr } = useSchoolSetting("clock_longitude");
  const { value: radiusStr } = useSchoolSetting("clock_radius");
  const { value: enforceStr } = useSchoolSetting("gps_enforcement_enabled");

  const lat = parseFloat(latStr || "");
  const lng = parseFloat(lngStr || "");
  const radius = parseFloat(radiusStr || "200");
  const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  // ค่าเริ่มต้น = เปิดบังคับ (true) ถ้ายังไม่เคยตั้งค่า เพื่อไม่เปลี่ยนพฤติกรรมเดิม
  const enforce = (enforceStr ?? "true") !== "false";
  // `configured` = "ต้องตรวจระยะหรือไม่" (มีพิกัด + เปิดสวิตช์)
  const configured = hasCoords && enforce;

  return { lat, lng, radius, configured, enforce, hasCoords };
}

export function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type Coords = { lat: number; lng: number; accuracy: number };

/**
 * อ่านพิกัด GPS แบบ "ดีที่สุดเท่าที่ทำได้":
 * - ใช้ watchPosition รวบรวมหลายตัวอย่างภายใน maxWaitMs
 * - คืนค่า fix ที่มี accuracy ต่ำสุด (แม่นยำที่สุด)
 * - ออกก่อนเวลาเมื่อได้ความแม่นยำ ≤ targetAccuracyMeters
 *
 * เหตุผล: เมื่อใช้ WiFi/IP-positioning แทน GPS จริง
 * fix แรกที่ได้มักผิดเป็นร้อยเมตร แต่ถ้ารอสักครู่ระบบจะค่อยๆ ปรับเข้ามา
 */
export function getCurrentCoords(opts?: {
  maxWaitMs?: number;
  targetAccuracyMeters?: number;
}): Promise<Coords> {
  const maxWaitMs = opts?.maxWaitMs ?? 8000;
  const targetAccuracy = opts?.targetAccuracyMeters ?? 30;

  return (async () => {
    try {
      const { ensureLocationPermission } = await import("@/lib/geolocation");
      const ok = await ensureLocationPermission();
      if (!ok) throw new Error("ยังไม่ได้อนุญาตให้เข้าถึงตำแหน่ง");
    } catch (e: any) {
      if (e?.message?.includes("อนุญาต")) throw e;
    }

    if (!navigator.geolocation) throw new Error("เบราว์เซอร์ไม่รองรับ GPS");

    return new Promise<Coords>((resolve, reject) => {



    let best: Coords | null = null;
    let watchId: number | null = null;
    let timeoutId: number | null = null;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (best) resolve(best);
      else reject(new Error("ไม่สามารถอ่านตำแหน่ง GPS"));
    };

    watchId = navigator.geolocation.watchPosition(
      (p) => {
        const c: Coords = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy ?? 9999,
        };
        if (!best || c.accuracy < best.accuracy) best = c;
        if (best.accuracy <= targetAccuracy) finish();
      },
      (err) => {
        if (!best) {
          settled = true;
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          reject(err);
        }
      },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 }
    );

    timeoutId = window.setTimeout(finish, maxWaitMs);
    });
  })();
}
