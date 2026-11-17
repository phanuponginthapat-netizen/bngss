const hhmm = (v: unknown) => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(v ?? "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const bangkokMinute = (ms: number) => { const d = new Date(ms + 7 * 3600_000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const PLANNED_POWER_ACTIONS = ["shutdown", "reboot", "restart", "sleep", "logout", "logoff"];

/** เครื่องนักเรียน Safe Browser ไม่ใช่ตู้สแกน → ไม่แจ้งเตือนออฟไลน์ */
export function isStudentBrowser(platform: unknown) {
  return /safe\s*browser/i.test(String(platform ?? ""));
}

/** แจ้งเตือนเฉพาะตู้สแกนจริง: ตู้หน้าประตู (kiosk_mode door) หรือ FaceGate ที่ลงทะเบียน Device Key; เครื่องนักเรียน/หน้า agent ไม่นับ */
export function isScannerDevice(d: { platform?: unknown; kiosk_mode?: unknown; device_key?: unknown }) {
  if (isStudentBrowser(d.platform)) return false;
  return d.kiosk_mode === "door" || (typeof d.device_key === "string" && d.device_key.length > 0);
}

/** ดับเพราะสั่งปิด/รีสตาร์ท หรือปิดตามเวลาที่ตั้ง = ตั้งใจ ไม่ต้องแจ้งเตือน */
export function isPlannedOffline(lastSeenMs: number, settings: Record<string, unknown>, powerCommands: { action: string; consumed_at: string | null }[]) {
  const from = lastSeenMs - 20 * 60_000;
  if (powerCommands.some((c) => PLANNED_POWER_ACTIONS.includes(String(c.action).toLowerCase()) && c.consumed_at && Date.parse(c.consumed_at) >= from)) return true;
  const shut = hhmm(settings.power_off_time);
  if (settings.power_saving_enabled === true && shut !== null) {
    const diff = (bangkokMinute(lastSeenMs) - shut + 1440) % 1440; // นาทีหลังเวลาปิด
    if (diff <= 20 || diff >= 1440 - 5) return true;
  }
  return false;
}
