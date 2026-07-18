// Cross-channel dedup — จำ tag ที่แสดงไปแล้ว (ทั้งจาก Web Push SW และ Realtime)
// กันไม่ให้ผู้ใช้เห็นแจ้งเตือนเดียวกันสองครั้งจากสองช่องทาง
const seenTags = new Map<string, number>();
const WINDOW_MS = 10_000;

export function markNotificationSeen(tag: string) {
  if (!tag) return;
  const now = Date.now();
  for (const [k, t] of seenTags) if (now - t > WINDOW_MS) seenTags.delete(k);
  seenTags.set(tag, now);
}

export function wasNotificationSeen(tag: string): boolean {
  if (!tag) return false;
  const now = Date.now();
  const t = seenTags.get(tag);
  if (!t) return false;
  if (now - t > WINDOW_MS) {
    seenTags.delete(tag);
    return false;
  }
  return true;
}
