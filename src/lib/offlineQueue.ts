/**
 * Offline action queue — เก็บ action ที่ทำตอน offline ลง IndexedDB
 * แล้ว replay เมื่อกลับมา online
 *
 * ใช้กับงานที่ครูทำในห้องเรียนเน็ตหลุดบ่อย: เช็คชื่อ / บันทึกพฤติกรรม
 *
 * หมายเหตุ: ไม่ใช่ service worker — แอปต้องโหลดครั้งแรกตอนมีเน็ต
 * แต่หลังโหลดแล้ว action ทำตอนเน็ตหลุดจะถูก queue ไว้
 */
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "offline-queue";
const STORE = "actions";
const COMPLETED_STORE = "completed_ops";
const VERSION = 2;

/** ระยะจำ operationId ที่ยิงสำเร็จแล้ว — กันย้อนซ้ำถ้า SW/แท็บอื่นมา flush ซ้อน */
const COMPLETED_TTL_MS = 10 * 60 * 1000; // 10 นาที
/** ถือว่ายัง "กำลังยิง" ถ้า processingAt อยู่ในช่วงนี้ — กัน race หลาย flush ยิง item เดียวกัน */
const PROCESSING_LOCK_MS = 45 * 1000;

export type QueueAction = {
  id?: number;
  /** type ใช้จัดกลุ่ม/ดูสถิติ — รองรับได้ทุกชนิด */
  type: "attendance" | "behavior" | "notify" | "generic" | string;
  /** table to insert/upsert into */
  table: string;
  /** payload to send to supabase */
  payload: Record<string, unknown>;
  /** optional onConflict for upsert */
  onConflict?: string;
  createdAt: number;
  attempts?: number;
  lastError?: string;
  /** epoch ms — จะไม่ retry ก่อนเวลานี้ (exponential backoff) */
  nextRetryAt?: number;
  /** ทำเครื่องหมายว่า "dead" เมื่อเกินจำนวนครั้งสูงสุด — เก็บไว้ให้ผู้ใช้ดู/ลบเอง */
  dead?: boolean;
  /** UUID สร้างครั้งเดียวตอน enqueue — ใช้เป็น idempotency key ป้องกันการยิงซ้ำข้ามการ flush */
  operationId?: string;
  /** epoch ms ตอนเริ่มยิงล่าสุด — ล็อคไม่ให้ flush อื่นหยิบไปยิงพร้อมกัน */
  processingAt?: number;
};

function newOperationId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch (_) {}
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── นโยบาย retry ───────────────────────────────────────────────
export const MAX_RETRY_ATTEMPTS = 8;          // ~ครอบคลุม backoff รวมหลายชั่วโมง
const BASE_BACKOFF_MS = 30 * 1000;             // 30s
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;     // 6h cap

/** exponential backoff + jitter: 30s → 1m → 2m → 4m → … cap 6h */
export function computeBackoffMs(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1)));
  const jitter = Math.floor(Math.random() * Math.min(exp * 0.2, 30_000)); // ≤20% หรือ 30s
  return exp + jitter;
}

/**
 * แยก error ที่ "ไม่มีทางสำเร็จ" (permanent) ออก — เช่น 400/401/403/404/409/422
 * ให้ทิ้งทันทีเพื่อไม่ให้คิวค้าง/ชนซ้ำ ส่วน 408/429/5xx/เน็ตพัง = retryable
 */
export function isPermanentError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error).message || String(err);
  // Postgres/PostgREST codes ที่บ่งบอกว่า payload ผิดโครงสร้าง / RLS / duplicate
  if (/\b(23505|23502|23503|23514|42\d{3}|PGRST\d+)\b/.test(msg)) return true;
  const status = (err as { status?: number; code?: number }).status
    ?? (err as { code?: number }).code;
  if (typeof status === "number") {
    if (status === 408 || status === 429) return false;
    if (status >= 400 && status < 500) return true;
  }
  // ดึงเลข status จากข้อความ "HTTP 4xx …"
  const m = msg.match(/HTTP\s+(\d{3})/i);
  if (m) {
    const s = parseInt(m[1], 10);
    if (s === 408 || s === 429) return false;
    if (s >= 400 && s < 500) return true;
  }
  return false;
}


function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(COMPLETED_STORE)) {
        // key = operationId, value = { completedAt }
        db.createObjectStore(COMPLETED_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function markCompleted(operationId: string | undefined) {
  if (!operationId) return;
  try {
    const db = await openDb();
    const tx = db.transaction(COMPLETED_STORE, "readwrite");
    tx.objectStore(COMPLETED_STORE).put({ completedAt: Date.now() }, operationId);
    await new Promise<void>((r) => { tx.oncomplete = () => r(); tx.onerror = () => r(); });
  } catch (_) {}
}

async function isCompleted(operationId: string | undefined): Promise<boolean> {
  if (!operationId) return false;
  try {
    const db = await openDb();
    const tx = db.transaction(COMPLETED_STORE, "readonly");
    const rec = await new Promise<any>((resolve) => {
      const r = tx.objectStore(COMPLETED_STORE).get(operationId);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    });
    if (!rec) return false;
    if (Date.now() - rec.completedAt > COMPLETED_TTL_MS) return false;
    return true;
  } catch (_) { return false; }
}

async function purgeCompleted() {
  try {
    const db = await openDb();
    const tx = db.transaction(COMPLETED_STORE, "readwrite");
    const store = tx.objectStore(COMPLETED_STORE);
    const cursorReq = store.openCursor();
    const now = Date.now();
    await new Promise<void>((resolve) => {
      cursorReq.onsuccess = () => {
        const cur = cursorReq.result;
        if (!cur) { resolve(); return; }
        const v = cur.value as { completedAt: number };
        if (!v || now - v.completedAt > COMPLETED_TTL_MS) cur.delete();
        cur.continue();
      };
      cursorReq.onerror = () => resolve();
    });
  } catch (_) {}
}

/** in-memory guard — กันสอง flush ในแท็บเดียวกันหยิบ operationId เดียวกัน */
const inFlightOps = new Set<string>();

export async function enqueue(action: Omit<QueueAction, "id" | "createdAt" | "attempts" | "operationId"> & { operationId?: string }) {
  const db = await openDb();
  const operationId = action.operationId || newOperationId();
  const id = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add({
      ...action,
      operationId,
      createdAt: Date.now(),
      attempts: 0,
    } satisfies QueueAction);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
  // ขอให้ SW flush ผ่าน Background Sync — ทำงานได้แม้ปิดแท็บ
  import("./swBackgroundSync").then(({ requestBackgroundFlush }) => {
    requestBackgroundFlush().catch(() => {});
  }).catch(() => {});
  return id;
}

export async function list(): Promise<QueueAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueueAction[]);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(id: number) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function update(action: QueueAction) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function count(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** ล้างเฉพาะ item ที่ตายแล้ว (เกิน MAX_RETRY_ATTEMPTS) — ให้ UI เรียกได้ */
export async function clearDead(): Promise<number> {
  const items = await list();
  let n = 0;
  for (const it of items) {
    if (it.dead && it.id !== undefined) { await remove(it.id); n++; }
  }
  return n;
}

/** นับเฉพาะ item ที่ยัง active (ไม่ dead) */
export async function countActive(): Promise<number> {
  const items = await list();
  return items.filter((i) => !i.dead).length;
}



let syncing = false;

export async function flush(): Promise<{ ok: number; failed: number; dropped: number; skipped?: number }> {
  if (syncing || !navigator.onLine) return { ok: 0, failed: 0, dropped: 0 };
  syncing = true;
  let ok = 0;
  let failed = 0;
  let dropped = 0;
  let skipped = 0;
  const now = Date.now();
  await purgeCompleted();
  try {
    const items = await list();
    for (const item of items) {
      // ข้าม item ที่ยังไม่ถึงเวลา retry / ที่ตายแล้ว
      if (item.dead) continue;
      if (item.nextRetryAt && item.nextRetryAt > now) continue;

      // ── De-duplication ─────────────────────────────────────────
      // 1) เคยยิงสำเร็จไปแล้ว (ภายใน TTL) → ลบทิ้ง กันซ้ำแน่นอน
      if (item.operationId && await isCompleted(item.operationId)) {
        if (item.id !== undefined) await remove(item.id);
        skipped++;
        continue;
      }
      // 2) มี flush อื่นในกระบวนการเดียวกันกำลังยิง operationId นี้
      if (item.operationId && inFlightOps.has(item.operationId)) {
        skipped++;
        continue;
      }
      // 3) มี flush อื่น (SW / แท็บอื่น) จับ item นี้ไปเมื่อเร็ว ๆ นี้
      if (item.processingAt && now - item.processingAt < PROCESSING_LOCK_MS) {
        skipped++;
        continue;
      }

      // จองสิทธิ์ก่อนยิง — เขียน processingAt กลับ IDB เพื่อให้ SW/แท็บอื่นเห็น
      if (item.operationId) inFlightOps.add(item.operationId);
      const locked: QueueAction = { ...item, processingAt: now };
      try { await update(locked); } catch (_) {}

      try {
        const q = supabase.from(item.table as never);
        const { error } = item.onConflict
          ? await (q as any).upsert(item.payload, { onConflict: item.onConflict })
          : await (q as any).insert(item.payload);
        if (error) throw error;
        if (item.id !== undefined) await remove(item.id);
        await markCompleted(item.operationId);
        ok++;
      } catch (e) {
        if (item.id === undefined) { failed++; continue; }
        const nextAttempts = (item.attempts ?? 0) + 1;
        const message = (e as Error).message ?? String(e);

        // Permanent → ทิ้งทันที (ไม่ retry ให้ชนซ้ำ) + จำ operationId ว่าจบแล้ว
        if (isPermanentError(e)) {
          await remove(item.id);
          await markCompleted(item.operationId);
          dropped++;
          continue;
        }
        // เกินจำนวนครั้ง → mark dead แต่ไม่ลบ (ให้ user เห็น/ตัดสินใจเอง)
        if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
          await update({ ...item, attempts: nextAttempts, lastError: message, dead: true, processingAt: undefined });
          dropped++;
          continue;
        }
        // Retryable → กำหนดเวลาถัดไปด้วย exponential backoff + ปลดล็อค
        await update({
          ...item,
          attempts: nextAttempts,
          lastError: message,
          nextRetryAt: Date.now() + computeBackoffMs(nextAttempts),
          processingAt: undefined,
        });
        failed++;
      } finally {
        if (item.operationId) inFlightOps.delete(item.operationId);
      }
    }
  } finally {
    syncing = false;
  }
  if (ok > 0 || dropped > 0) {
    window.dispatchEvent(new CustomEvent("offline-queue:synced", { detail: { ok, failed, dropped, skipped } }));
  }
  return { ok, failed, dropped, skipped };
}

let installed = false;
let retryIntervalId: ReturnType<typeof setInterval> | null = null;
export function installOfflineSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const requestSw = () => {
    import("./swBackgroundSync").then(({ requestBackgroundFlush }) => {
      requestBackgroundFlush().catch(() => {});
    }).catch(() => {});
  };
  window.addEventListener("online", () => {
    flush().catch(() => {});
    requestSw();
  });
  // retry on focus too
  window.addEventListener("focus", () => {
    if (navigator.onLine) flush().catch(() => {});
  });
  // periodic retry every 60s when online
  if (retryIntervalId) clearInterval(retryIntervalId);
  retryIntervalId = setInterval(() => {
    if (navigator.onLine) flush().catch(() => {});
  }, 60_000);
  // รับสัญญาณจาก Service Worker ว่า flush เสร็จแล้ว (เคสปิดแท็บแล้วเปิดใหม่ / อีกแท็บ)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg && msg.type === "offline-queue-synced") {
        window.dispatchEvent(new CustomEvent("offline-queue:synced", {
          detail: { ok: msg.ok ?? 0, failed: msg.failed ?? 0 },
        }));
      }
    });
  }
}
