/**
 * Bridge สำหรับ Service Worker Background Sync
 * - เก็บ Supabase URL + anon key + access token ลง IndexedDB
 *   เพื่อให้ Service Worker (public/sw.js) เข้าถึงได้แม้ปิดแท็บ
 * - ให้ helper `requestBackgroundFlush()` สำหรับลงทะเบียน sync tag
 *   `flush-offline-queue` — OS จะปลุก SW มา flush queue เองเมื่อ online กลับมา
 */
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "sw-config";
const STORE = "config";
const VERSION = 1;
const KEY = "supabase-auth";

type StoredConfig = {
  supabaseUrl: string;
  apiKey: string;
  accessToken: string | null;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function writeConfig(cfg: StoredConfig) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(cfg, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

import { getBackendConfig } from "@/lib/runtimeConfig";

const SUPABASE_URL = getBackendConfig().url;
const SUPABASE_KEY = getBackendConfig().anonKey;

async function syncNow(accessToken: string | null) {
  try {
    await writeConfig({
      supabaseUrl: SUPABASE_URL,
      apiKey: SUPABASE_KEY,
      accessToken,
      updatedAt: Date.now(),
    });
  } catch (_) { /* IndexedDB อาจถูกบล็อกในโหมด private — เพิกเฉย */ }
}

let installed = false;
export function installSwBackgroundSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // เขียน config ครั้งแรกทันที (แม้ยังไม่ล็อกอิน)
  supabase.auth.getSession().then(({ data }) => {
    syncNow(data.session?.access_token ?? null);
  });

  // อัปเดตทุกครั้งที่ session เปลี่ยน (login / refresh / logout)
  supabase.auth.onAuthStateChange((_event, session) => {
    syncNow(session?.access_token ?? null);
  });
}

/**
 * ขอให้ Service Worker flush offline queue เมื่อกลับมา online
 * — ถ้ารองรับ Background Sync (Chrome/Android) OS จะปลุก SW เอง
 *   แม้ผู้ใช้ปิดแท็บไปแล้ว
 * — ถ้าไม่รองรับ (Safari/iOS/Firefox) จะ fallback เป็น postMessage
 *   ให้ SW ที่ยัง active อยู่ flush ทันที
 */
export async function requestBackgroundFlush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const anyReg = reg as unknown as {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (anyReg.sync) {
      try {
        await anyReg.sync.register("flush-offline-queue");
        return;
      } catch (_) { /* ตกไป fallback */ }
    }
    // Fallback: ให้ SW ที่ทำงานอยู่ flush เลย
    reg.active?.postMessage({ type: "flush-offline-queue" });
  } catch (_) { /* ignore */ }
}
