export type Coords = { lat: number; lng: number; accuracy?: number };

/** ขอพิกัดปัจจุบันจากอุปกรณ์ (คืน null ถ้าไม่อนุญาต/ไม่รองรับ) */
export function getCurrentCoords(timeoutMs = 12000): Promise<Coords | null> {
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
