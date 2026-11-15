import { bkkDateISO } from "@/lib/dateBE";

/** Never fabricate a receipt-time scan for a pending write whose time is unknown. */
export function pendingScanPayload(payload: Record<string, unknown>, now = Date.now()) {
  const raw = payload.scan_time ?? payload.scanned_at;
  if (typeof raw !== "string") throw new Error("รายการค้างไม่มีเวลาสแกนเดิม กรุณาตรวจสอบก่อนส่งใหม่");
  const stamp = new Date(raw);
  if (!Number.isFinite(stamp.getTime()) || stamp.getTime() > now + 60_000) {
    throw new Error("เวลาสแกนไม่ถูกต้อง กรุณาตรวจสอบโดยไม่เปลี่ยนเป็นวันนี้");
  }
  const { scanned_at, ...rest } = payload;
  return { ...rest, scan_time: stamp.toISOString(), scan_date: bkkDateISO(stamp) };
}