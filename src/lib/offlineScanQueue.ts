/**
 * Offline QR scan queue — เก็บการสแกนที่บันทึกไม่สำเร็จ (ออฟไลน์/เน็ตล่ม)
 * ลง IndexedDB แล้ว sync กลับขึ้น Supabase อัตโนมัติเมื่อกลับมาออนไลน์
 */
import { supabase } from "@/integrations/supabase/client";
import { bkkDateISO } from "@/lib/dateBE";

const DB_NAME = "bng-scan-queue";
const DB_VERSION = 1;
const STORE = "pending";

export interface PendingScan {
  id?: number;
  student_id: string;
  student_code?: string;
  student_name?: string;
  scan_type: "entry" | "exit";
  entry_method: "qr" | "manual" | "face";
  device_label: string;
  scanned_by?: string | null;
  scanned_at: string; // ISO timestamp of when the scan happened locally
  attempts?: number;
  last_error?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => {
      if (result instanceof IDBRequest) resolve(result.result as T);
    };
    tx.onerror = () => reject(tx.error);
    if (!(result instanceof IDBRequest)) {
      Promise.resolve(result).then(resolve, reject);
    }
  });
}

export async function enqueueScan(scan: PendingScan): Promise<number> {
  return withStore("readwrite", (store) => store.add({ ...scan, attempts: 0 }) as IDBRequest<number>);
}

export async function getPending(): Promise<PendingScan[]> {
  return withStore("readonly", (store) => store.getAll() as IDBRequest<PendingScan[]>);
}

export async function removePending(id: number): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
}

async function updatePending(scan: PendingScan): Promise<void> {
  await withStore("readwrite", (store) => store.put(scan) as IDBRequest<IDBValidKey>);
}

export async function countPending(): Promise<number> {
  return withStore("readonly", (store) => store.count() as IDBRequest<number>);
}

let flushing = false;

/** Sync คิวทั้งหมดกลับขึ้น Supabase — return { synced, failed } */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  flushing = true;
  let synced = 0;
  let failed = 0;
  try {
    const items = await getPending();
    for (const item of items) {
      try {
        const stamp = new Date(item.scanned_at);
        if (!Number.isFinite(stamp.getTime()) || stamp.getTime() > Date.now() + 60_000) {
          throw new Error("เวลาสแกนไม่ถูกต้อง เก็บรายการไว้ตรวจสอบโดยไม่เปลี่ยนเป็นวันนี้");
        }

        const { error } = await supabase.from("face_scan_logs").insert({
          student_id: item.student_id,
          scan_date: bkkDateISO(stamp), scan_time: stamp.toISOString(),
          scan_type: item.scan_type,

          confidence: 1,
          scanned_by: item.scanned_by ?? undefined,
          device_label: item.device_label,
          entry_method: item.entry_method,
        } as any);

        if (error) {
          // duplicate — ถือว่าสำเร็จ (ระบบกันซ้ำฝั่ง server ทำงานถูก)
          if (error.code === "23505") {
            if (item.id != null) await removePending(item.id);
            synced++;
            continue;
          }
          // network / permission — เก็บไว้ลองใหม่
          failed++;
          if (item.id != null) {
            await updatePending({ ...item, attempts: (item.attempts || 0) + 1, last_error: error.message });
          }
        } else {
          const { markScanned } = await import("@/lib/scanDedup");
          markScanned(item.student_id, item.scan_type, item.entry_method, item.scanned_at);
          if (item.id != null) await removePending(item.id);
          synced++;
        }

      } catch (e: any) {
        failed++;
        if (item.id != null) {
          await updatePending({ ...item, attempts: (item.attempts || 0) + 1, last_error: String(e?.message || e) });
        }
      }
    }
  } finally {
    flushing = false;
  }
  if (synced && typeof window !== "undefined") {
    const {clearScanDedupCache}=await import("@/lib/scanDedup");
    clearScanDedupCache();
    window.dispatchEvent(new CustomEvent("offline-queue:synced",{detail:{ok:synced,failed}}));
  }
  return { synced, failed };
}

/** Register auto-flush listeners (idempotent) */
let installed = false;
let _intervalId: ReturnType<typeof setInterval> | null = null;
let autoTrigger: (() => Promise<void>) | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
export function installAutoSync(onChange?: () => void) {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const trigger = async () => {
    if (!navigator.onLine) return;
    const { synced, failed } = await flushQueue();
    if ((synced || failed) && onChange) onChange();
  };
  autoTrigger = trigger;
  window.addEventListener("online", trigger);
  window.addEventListener("focus", trigger);
  _intervalId = setInterval(trigger, 30_000);
  initialTimer = setTimeout(trigger, 1_500);
}

export function uninstallAutoSync() {
  if (autoTrigger) {window.removeEventListener("online", autoTrigger); window.removeEventListener("focus", autoTrigger); autoTrigger = null;}
  if (initialTimer) {clearTimeout(initialTimer); initialTimer = null;}
  if (_intervalId != null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  installed = false;
}
