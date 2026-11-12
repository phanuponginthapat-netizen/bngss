export type ScanDirection = "in" | "out";
export function bangkokScanMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  return Number(parts.find(p => p.type === "hour")?.value) * 60 + Number(parts.find(p => p.type === "minute")?.value);
}
export function evaluateSchoolScan(settings: Record<string, unknown>, minutes: number, requested?: ScanDirection) {
  const parseTime = (raw: unknown) => {
    const match = String(raw).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) throw new Error("Invalid school scan time");
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const direction: ScanDirection = requested ?? (minutes < parseTime(settings.face_scan_mode_cutoff ?? "12:00") ? "in" : "out");
  const raw = settings[direction === "in" ? "face_scan_entry_window" : "face_scan_exit_window"];
  if (raw === "" || raw === undefined || raw === null) return { allowed: true, direction, reason: "" };
  const match = String(raw).trim().match(/^(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})$/);
  if (!match) throw new Error("Invalid school scan window");
  const start = parseTime(match[1]), end = parseTime(match[2]);
  if (end <= start) throw new Error("Invalid school scan window");
  const allowed = minutes >= start && minutes < end;
  return { allowed, direction, reason: allowed ? "" : `นอกช่วงเวลาสแกน${direction === "in" ? "เข้า" : "ออก"} (${match[1]}–${match[2]} น.)` };
}