/**
 * รหัสเครื่อง (device_id) — สร้างครั้งเดียวต่อ browser/profile แล้วเก็บลง localStorage
 * ใช้เป็น primary key ในตาราง kiosk_devices เพื่อไม่ให้ user id ซ้ำกันเมื่อเปลี่ยนนักเรียน
 */
const KEY = "kiosk_device_id_v1";

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      (globalThis.crypto?.randomUUID?.() as string | undefined) ||
      `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `dev-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getDeviceHostnameHint(): string {
  // ไม่มี hostname จริงบน browser — ใช้ค่า UA/platform เป็น hint
  const ua = navigator.userAgent;
  const m =
    ua.match(/Chromium OS/) ? "ChromiumOS" :
    ua.match(/Linux/) ? "Linux" :
    ua.match(/Windows/) ? "Windows" :
    ua.match(/Mac OS X/) ? "macOS" :
    ua.match(/Android/) ? "Android" :
    ua.match(/iPhone|iPad/) ? "iOS" : "Unknown";
  return m;
}
