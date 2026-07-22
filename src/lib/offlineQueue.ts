/**
 * Lightweight offline write queue.
 * Persists pending Supabase writes in IndexedDB and flushes when back online.
 * Use for critical, low-frequency writes like attendance check-in.
 */

const DB_NAME = "offline-queue";
const STORE = "pending";
const DB_VERSION = 1;

type QueuedItem = {
  id: string;
  table: string;
  op: "insert" | "update" | "upsert";
  payload: any;
  match?: Record<string, any>; // for update
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

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T> {
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

export async function enqueue(item: Omit<QueuedItem, "id" | "createdAt" | "attempts">) {
  const q: QueuedItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
  };
  await tx("readwrite", (s) => {
    s.put(q);
  });
  return q.id;
}

export async function pending(): Promise<QueuedItem[]> {
  return tx("readonly", (s) =>
    new Promise<QueuedItem[]>((resolve) => {
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result || []) as QueuedItem[]);
    })
  );
}

export async function remove(id: string) {
  await tx("readwrite", (s) => {
    s.delete(id);
  });
}

export async function flush(supabase: any): Promise<{ ok: number; failed: number }> {
  if (!navigator.onLine) return { ok: 0, failed: 0 };
  const items = await pending();
  let ok = 0;
  let failed = 0;
  for (const it of items) {
    try {
      let res;
      if (it.op === "insert") {
        res = await supabase.from(it.table).insert(it.payload);
      } else if (it.op === "upsert") {
        res = await supabase.from(it.table).upsert(it.payload);
      } else {
        let q = supabase.from(it.table).update(it.payload);
        for (const [k, v] of Object.entries(it.match || {})) q = q.eq(k, v);
        res = await q;
      }
      if (res.error) throw res.error;
      await remove(it.id);
      ok++;
    } catch (e) {
      it.attempts++;
      // Drop after 10 failed attempts to prevent forever-stuck items
      if (it.attempts > 10) {
        await remove(it.id);
      } else {
        await tx("readwrite", (s) => {
          s.put(it);
        });
      }
      failed++;
    }
  }
  return { ok, failed };
}

/**
 * Start background auto-flush. Call once at app boot.
 */
export function startAutoFlush(supabase: any) {
  const tryFlush = () => flush(supabase).catch(() => {});
  window.addEventListener("online", tryFlush);
  // Also poll every 60s in case we missed the event
  setInterval(tryFlush, 60_000);
  // Try immediately
  if (navigator.onLine) tryFlush();
}

export async function queueSize(): Promise<number> {
  const list = await pending();
  return list.length;
}
