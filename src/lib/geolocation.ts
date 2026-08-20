export type Coords = { lat: number; lng: number; accuracy?: number };

function isNative(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** ขอสิทธิ์ตำแหน่งบนแอปเนทีฟ (เว็บจะขอผ่านเบราว์เซอร์เองตอนเรียกใช้) */
export async function ensureLocationPermission(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const st = await Geolocation.checkPermissions();
    if (st.location === "granted" || st.coarseLocation === "granted") return true;
    const req = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
    return req.location === "granted" || req.coarseLocation === "granted";
  } catch {
    return false;
  }
}

/** ขอพิกัดปัจจุบันจากอุปกรณ์ (คืน null ถ้าไม่อนุญาต/ไม่รองรับ) */
export async function getCurrentCoords(timeoutMs = 12000): Promise<Coords | null> {
  // แอปเนทีฟ (APK/iOS) — ใช้ GPS ผ่าน Capacitor เพื่อให้ขอสิทธิ์ระบบได้ถูกต้อง
  if (isNative()) {
    try {
      if (!(await ensureLocationPermission())) return null;
      const { Geolocation } = await import("@capacitor/geolocation");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 30000,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}


/** ลิงก์เปิด Google Maps จากพิกัด */
export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function formatCoords(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return "";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** แปลงพิกัดเป็นชื่อสถานที่แบบคร่าว ๆ (OpenStreetMap – ไม่ต้องใช้คีย์) */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=th`,
    );
    if (!res.ok) return "";
    const json = await res.json();
    return (json?.display_name as string) || "";
  } catch {
    return "";
  }
}
