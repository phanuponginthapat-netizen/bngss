/**
 * serverClock — เวลากลางของระบบ (กันนาฬิกาเครื่องเพี้ยน)
 *
 * การเช็คชื่อเป็นข้อมูลอ่อนไหว: ถ้ามือถือเครื่องที่ใช้สแกนตั้งเวลา/โซนเวลาผิด
 * บันทึกจะไปลงผิดวัน หรือถูกตัดเป็น "สาย" ทั้งที่มาทัน
 *
 * วิธีแก้: ขอเวลาจากเซิร์ฟเวอร์ (HTTP Date header) มาเทียบกับนาฬิกาเครื่อง
 * แล้วเก็บ "ส่วนต่าง" ไว้ใช้แก้เวลาทุกครั้งที่บันทึก
 */
import { BKK_TZ } from "@/lib/dateBE";
import { getBackendConfig } from "@/lib/runtimeConfig";

let skewMs = 0;
let syncedAt = 0;
let syncing: Promise<number> | null = null;

const SUPABASE_URL = getBackendConfig().url;

/** ขอเวลาเซิร์ฟเวอร์และคำนวณส่วนต่าง (เงียบ ๆ — ล้มเหลวก็ใช้เวลาเครื่อง) */
export async function syncServerClock(force = false): Promise<number> {
  if (!force && Date.now() - syncedAt < 5 * 60_000) return skewMs;
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const t0 = Date.now();
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { method: "HEAD", cache: "no-store" });
      const t1 = Date.now();
      const header = res.headers.get("date");
      if (header) {
        const server = new Date(header).getTime();
        if (Number.isFinite(server)) {
          // ชดเชยเวลาเดินทางของคำขอครึ่งหนึ่ง
          skewMs = server + (t1 - t0) / 2 - t1;
          syncedAt = Date.now();
        }
      }
    } catch {
      /* ออฟไลน์ — ใช้เวลาเครื่องไปก่อน */
    } finally {
      syncing = null;
    }
    return skewMs;
  })();
  return syncing;
}

/** ส่วนต่างนาฬิกาเครื่องกับเซิร์ฟเวอร์ (มิลลิวินาที) */
export function clockSkewMs(): number {
  return skewMs;
}

/** นาฬิกาเครื่องเพี้ยนเกิน 2 นาที → ควรเตือนผู้ใช้ */
export function isClockUnreliable(): boolean {
  return Math.abs(skewMs) > 120_000;
}

/** เวลาปัจจุบันที่แก้ส่วนต่างแล้ว */
export function serverNow(): Date {
  return new Date(Date.now() + skewMs);
}

/** วันที่ไทยตามเวลาเซิร์ฟเวอร์ — YYYY-MM-DD */
export function serverTodayBangkok(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(serverNow());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** ชั่วโมงตามเวลาไทย (0–23) จากเวลาเซิร์ฟเวอร์ */
export function serverBangkokHour(): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: BKK_TZ, hour: "2-digit", hour12: false,
  }).format(serverNow());
  return parseInt(h, 10) || 0;
}
