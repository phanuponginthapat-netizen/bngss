/**
 * Kiosk Face Cache — ดาวน์โหลด face descriptors ลงเครื่อง + จำโฟลเดอร์ปลายทาง
 * - เก็บลง IndexedDB (kiosk-face-cache) สำหรับ match แบบ offline ไว
 * - ถ้าเบราว์เซอร์รองรับ File System Access API จะให้เลือกโฟลเดอร์และเซฟ JSON ไว้ด้วย + จำ handle ไว้ใน IndexedDB
 * - ตอนสแกน: ใช้ cache local ก่อน ไม่ต้องรอ fetch จาก Supabase ทุกรอบ → ไวและแม่นขึ้น
 * - เจอหน้าแล้วค่อยยิงผล (face_scan_logs) ไป server
 */
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "kiosk-face-cache";
const STORE = "store";
const VERSION = 1;
const KEY_DESCRIPTORS = "descriptors";
const KEY_META = "meta";
const KEY_DIR_HANDLE = "dirHandle";
const KEY_VERSION = "version";

export interface CachedFace {
  studentId: string;
  studentCode: string;
  name: string;
  classroom: string;
  descriptors: number[][];
  /** ภาพใบหน้าที่ลงทะเบียน (data URL) — โหลดเก็บไว้ในเครื่องเพื่อใช้ประมวลผล/แสดงผลแบบออฟไลน์ */
  images?: string[];
  /** embedding ที่คำนวณใหม่จากภาพด้านบนด้วยโมเดลของเครื่องนี้เอง — ช่วยให้จับคู่แม่นขึ้น */
  localDescriptors?: number[][];
  isStaff?: boolean;
}

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

async function idbPut(key: string, value: any) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFaceCache(faces: CachedFace[]) {
  await idbPut(KEY_DESCRIPTORS, { faces, savedAt: new Date().toISOString() });
  await idbPut(KEY_META, { count: faces.length, savedAt: new Date().toISOString(), totalDescriptors: faces.reduce((a, f) => a + f.descriptors.length, 0) });
}

export async function loadFaceCache(): Promise<{ faces: CachedFace[]; meta: any } | null> {
  const data = await idbGet<any>(KEY_DESCRIPTORS);
  if (!data?.faces) return null;
  const meta = await idbGet<any>(KEY_META);
  return { faces: data.faces, meta };
}

export async function clearFaceCache() {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY_DESCRIPTORS);
    tx.objectStore(STORE).delete(KEY_META);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// File System Access API — จำโฟลเดอร์
export async function pickAndSaveFaceFolder(faces: CachedFace[]): Promise<string | null> {
  const anyWindow = window as any;
  if (!anyWindow.showDirectoryPicker) return null;
  try {
    const dirHandle = await anyWindow.showDirectoryPicker({ mode: "readwrite" });
    // ขอสิทธิ์
    const perm = await dirHandle.requestPermission?.({ mode: "readwrite" });
    if (perm && perm !== "granted") throw new Error("permission denied");
    // เซฟไฟล์
    const fileHandle = await dirHandle.getFileHandle("bngss-faces.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify({ exportedAt: new Date().toISOString(), count: faces.length, faces }, null, 2));
    await writable.close();
    // จำ handle ไว้ใน IndexedDB (ต้องใช้ idb, ไม่ใช่ localStorage)
    await idbPut(KEY_DIR_HANDLE, dirHandle);
    // จำชื่อโฟลเดอร์ไว้แสดง
    await idbPut("dirName", dirHandle.name || "unknown");
    return dirHandle.name || "unknown";
  } catch (e: any) {
    if (e?.name === "AbortError") return null;
    throw e;
  }
}

export async function getSavedDirName(): Promise<string | null> {
  return (await idbGet<string>("dirName")) || null;
}

export async function hasFileSystemAccess(): Promise<boolean> {
  return typeof (window as any).showDirectoryPicker === "function";
}

// ดาวน์โหลดจาก Supabase แล้วเก็บทั้ง IndexedDB + ไฟล์ (ถ้าเลือกโฟลเดอร์)
// ใช้ edge kiosk-face-download ก่อน (bypass RLS สำหรับตู้ anon) ถ้าไม่ได้ค่อย fallback ตรง
// withImages = ดึง "ภาพใบหน้าที่ลงทะเบียน" ลงเครื่องด้วย เพื่อ
//   1) แสดงภาพต้นฉบับตอนจับคู่ได้ทันทีแบบออฟไลน์
//   2) นำไปคำนวณ embedding ซ้ำด้วยโมเดลของเครื่องนี้เอง (ดูฟังก์ชันด้านล่าง) → แม่นขึ้น
export async function downloadFacesToCache(
  opts?: { withImages?: boolean; withStaff?: boolean },
): Promise<{ faces: CachedFace[]; dirName: string | null; version?: string }> {
  const withImages = opts?.withImages !== false;
  const withStaff = opts?.withStaff !== false;
  let faces: CachedFace[] = [];
  let version: string | undefined;
  let viaEdge = false;
  try {
    const { data, error } = await supabase.functions.invoke("kiosk-face-download", {
      body: { images: withImages ? "1" : "0", staff: withStaff ? "1" : "0" },
    });
    if (!error && (data as any)?.faces && Array.isArray((data as any).faces)) {
      faces = (data as any).faces as CachedFace[];
      version = (data as any).version;
      viaEdge = true;
    } else if (error) throw error;
  } catch { /* fallback */ }
  if (!viaEdge) {
    const { data, error } = await supabase
      .from("student_face_descriptors")
      .select(
        "student_id, descriptor" + (withImages ? ", face_image" : "") +
        ", students!inner(id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name,grade_level))",
      )
      .limit(20000);
    if (error) throw error;
    const map = new Map<string, CachedFace>();
    for (const row of (data as any[]) || []) {
      const sid = row.student_id;
      const s = row.students;
      const name = `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim();
      const cls = s.classrooms ? `${s.classrooms.grade_level || ""}/${s.classrooms.name || ""}` : "-";
      const code = s.student_code || "";
      const existing = map.get(sid);
      if (existing) {
        existing.descriptors.push(row.descriptor as number[]);
        if (row.face_image && (existing.images?.length ?? 0) < 2) (existing.images ||= []).push(row.face_image);
      } else {
        map.set(sid, {
          studentId: sid, studentCode: code, name, classroom: cls,
          descriptors: [row.descriptor as number[]],
          images: row.face_image ? [row.face_image] : [],
        });
      }
    }
    faces = Array.from(map.values());
  }
  if (faces.length === 0) throw new Error("ไม่พบข้อมูลใบหน้าในระบบ — ให้ลงทะเบียนใบหน้าก่อน (0 คน)");
  await saveFaceCache(faces);
  if (version) await idbPut(KEY_VERSION, { version, checkedAt: new Date().toISOString() });
  // ถ้าเคยเลือกโฟลเดอร์ไว้แล้ว ให้เขียนทับไฟล์เดิมอัตโนมัติ
  let dirName: string | null = await getSavedDirName();
  const dirHandle = await idbGet<any>(KEY_DIR_HANDLE);
  if (dirHandle) {
    try {
      const perm = await dirHandle.queryPermission?.({ mode: "readwrite" });
      if (perm === "granted" || perm === "prompt") {
        const fileHandle = await dirHandle.getFileHandle("bngss-faces.json", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify({ exportedAt: new Date().toISOString(), count: faces.length, faces }, null, 2));
        await writable.close();
        dirName = dirHandle.name || dirName;
      }
    } catch { /* ignore */ }
  }
  return { faces, dirName, version };
}

/** เวอร์ชันข้อมูลบน server (เบามาก) — ใช้เช็คว่าต้องโหลดใหม่ไหม */
export async function fetchServerFaceVersion(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("kiosk-face-download", { body: { meta: "1" } });
    if (error) return null;
    return (data as any)?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * รีเฟรช cache อัตโนมัติเมื่อข้อมูลบน server เปลี่ยน (มีคนลงทะเบียนใบหน้าใหม่)
 * หรือเมื่อ cache เก่าเกิน maxAgeMs — ทำงานเบื้องหลัง ไม่บล็อกการสแกน
 */
export async function refreshFaceCacheIfStale(maxAgeMs = 6 * 60 * 60 * 1000): Promise<CachedFace[] | null> {
  try {
    const meta = await idbGet<any>(KEY_META);
    const local = await idbGet<any>(KEY_VERSION);
    const age = meta?.savedAt ? Date.now() - new Date(meta.savedAt).getTime() : Infinity;
    const serverVersion = await fetchServerFaceVersion();
    const changed = !!serverVersion && serverVersion !== local?.version;
    if (!changed && age < maxAgeMs && meta?.count) return null;
    const { faces } = await downloadFacesToCache();
    return faces;
  } catch {
    return null;
  }
}

/**
 * ใช้ "ภาพใบหน้าที่โหลดลงเครื่อง" คำนวณ embedding ซ้ำด้วยโมเดล/ไปป์ไลน์ของเครื่องนี้เอง
 *
 * ทำไมช่วยให้แม่นขึ้น: ภาพลงทะเบียนมักถ่ายจากมือถือ แต่ตอนสแกนใช้กล้องคีออส
 * เมื่อคำนวณ embedding ใหม่จากภาพเดิมด้วยโมเดลเดียวกับที่ใช้ตอนสแกน (รวมภาพหลายสภาพแสง)
 * ระยะห่างของคนเดียวกันจะแคบลงมาก → ลดทั้งการจำไม่ได้และการจำผิดคน
 * ผลลัพธ์ถูกเก็บลง IndexedDB จึงทำครั้งเดียว ครั้งต่อไปใช้ของเดิมทันที
 */
export async function augmentCacheWithLocalEmbeddings(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const cached = await loadFaceCache();
  if (!cached?.faces?.length) return 0;
  const { embedFaceVariantsFromUrl } = await import("@/lib/faceApi");
  const targets = cached.faces.filter((f) => (f.images?.length ?? 0) > 0 && !(f as any).localDescriptors?.length);
  let done = 0;
  let added = 0;
  for (const face of targets) {
    try {
      const local: number[][] = [];
      for (const img of (face.images || []).slice(0, 2)) {
        const vs = await embedFaceVariantsFromUrl(img);
        for (const v of vs) local.push(Array.from(v.descriptor));
      }
      if (local.length) {
        (face as any).localDescriptors = local;
        added += local.length;
      }
    } catch { /* ข้ามภาพที่อ่านไม่ได้ */ }
    done += 1;
    onProgress?.(done, targets.length);
    // ปล่อยให้ UI/กล้องทำงานต่อระหว่างประมวลผล
    await new Promise((r) => setTimeout(r, 0));
  }
  if (added) await saveFaceCache(cached.faces);
  return added;
}

