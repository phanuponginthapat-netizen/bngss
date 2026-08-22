/**
 * Lightweight offline write queue.
 * Persists pending Supabase writes in IndexedDB and flushes when back online.
 * Use for critical, low-frequency writes like attendance check-in.
 */

import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "offline-queue";
const STORE = "pending";
const DB_VERSION = 1;
const MAX_ATTEMPTS = 10;

type QueuedItem = {
  id: string;
  table: string;
  op: "insert" | "update" | "upsert";
  payload: any;
  match?: Record<string, any>;
  createdAt: number;
  attempts: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    Promise.resolve(fn(s)).then((v) => {
      t.oncomplete = () => resolve(v);
      t.onerror = () => reject(t.error);
    }, reject);
  });
}

export async function enqueue(
  item: Omit<QueuedItem, "id" | "createdAt" | "attempts">
): Promise<string> {
  const q: QueuedItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
  };
  await withStore("readwrite", (s) => {
    s.put(q);
  });
  return q.id;
}

export async function pending(): Promise<QueuedItem[]> {
  try {
    return await withStore("readonly", (s) =>
      new Promise<QueuedItem[]>((resolve) => {
        const req = s.getAll();
        req.onsuccess = () => resolve((req.result || []) as QueuedItem[]);
      })
    );
  } catch {
    return [];
  }
}

export async function count(): Promise<number> {
  const list = await pending();
  return list.length;
}

export async function remove(id: string) {
  await withStore("readwrite", (s) => {
    s.delete(id);
  });
}

let flushing = false;

/**
 * Flush pending queue against Supabase.
 * Dispatches window event "offline-queue:synced" with { ok, failed }.
 */
export async function flush(): Promise<{ ok: number; failed: number }> {
  if (flushing || !navigator.onLine) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = await pending();
    for (const it of items) {
      try {
        let res: any;
        if (it.op === "insert") {
          res = await (supabase.from(it.table as any) as any).insert(it.payload);
        } else if (it.op === "upsert") {
          res = await (supabase.from(it.table as any) as any).upsert(it.payload);
        } else {
          let q: any = (supabase.from(it.table as any) as any).update(it.payload);
          for (const [k, v] of Object.entries(it.match || {})) q = q.eq(k, v);
          res = await q;
        }
        if (res.error) throw res.error;
        await remove(it.id);
        ok++;
      } catch {
        it.attempts++;
        if (it.attempts > MAX_ATTEMPTS) {
          await remove(it.id);
        } else {
          await withStore("readwrite", (s) => {
            s.put(it);
          });
        }
        failed++;
      }
    }
  } finally {
    flushing = false;
  }
  try {
    window.dispatchEvent(new CustomEvent("offline-queue:synced", { detail: { ok, failed } }));
  } catch {
    /* noop */
  }
  return { ok, failed };
}

/**
 * Install background auto-flush. Call once at app boot.
 */
let _intervalId: ReturnType<typeof setInterval> | null = null;
export function installOfflineSync() {
  const tryFlush = () => flush().catch(() => {});
  window.addEventListener("online", tryFlush);
  window.addEventListener("focus", tryFlush);
  _intervalId = setInterval(tryFlush, 60_000);
  if (navigator.onLine) tryFlush();
}

export function uninstallOfflineSync() {
  if (_intervalId != null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}
