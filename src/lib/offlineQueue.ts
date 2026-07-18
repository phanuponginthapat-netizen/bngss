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
const VERSION = 1;

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
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
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

export async function enqueue(action: Omit<QueueAction, "id" | "createdAt" | "attempts">) {
  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add({
      ...action,
      createdAt: Date.now(),
      attempts: 0,
    } satisfies QueueAction);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
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

let syncing = false;

export async function flush(): Promise<{ ok: number; failed: number }> {
  if (syncing || !navigator.onLine) return { ok: 0, failed: 0 };
  syncing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = await list();
    for (const item of items) {
      try {
        const q = supabase.from(item.table as never);
        const { error } = item.onConflict
          ? await (q as any).upsert(item.payload, { onConflict: item.onConflict })
          : await (q as any).insert(item.payload);
        if (error) throw error;
        if (item.id !== undefined) await remove(item.id);
        ok++;
      } catch (e) {
        failed++;
        if (item.id !== undefined) {
          await update({
            ...item,
            attempts: (item.attempts ?? 0) + 1,
            lastError: (e as Error).message,
          });
        }
      }
    }
  } finally {
    syncing = false;
  }
  if (ok > 0) {
    window.dispatchEvent(new CustomEvent("offline-queue:synced", { detail: { ok, failed } }));
  }
  return { ok, failed };
}

let installed = false;
let retryIntervalId: ReturnType<typeof setInterval> | null = null;
export function installOfflineSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("online", () => {
    flush().catch(() => {});
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
}
