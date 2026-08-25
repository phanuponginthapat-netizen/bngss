import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { useEffect, useState } from "react";

export const AR_BUCKET = "ar-media";
const STORAGE_PREFIX = "storage:";
const SIGN_SECONDS = 60 * 60 * 24 * 365; // 1 ปี
const cache = new Map<string, string>();

/** ค่าที่เก็บในฐานข้อมูลสำหรับไฟล์ที่อัปโหลดเข้าคลังของโรงเรียน */
export const toStorageRef = (path: string) => `${STORAGE_PREFIX}${path}`;

export const isStorageRef = (value?: string | null) =>
  !!value && value.startsWith(STORAGE_PREFIX);

export const storagePathOf = (value: string) => value.slice(STORAGE_PREFIX.length);

/** แปลงค่าที่เก็บไว้ให้เป็น URL ที่เปิดดูได้จริง (ลิงก์ภายนอกคืนค่าเดิม) */
export const resolveArUrl = async (value?: string | null): Promise<string> => {
  if (!value) return "";
  if (!isStorageRef(value)) return value;
  const cached = cache.get(value);
  if (cached) return cached;
  const path = storagePathOf(value);
  const { data } = await supabase.storage.from(AR_BUCKET).createSignedUrl(path, SIGN_SECONDS);
  const url = data?.signedUrl || "";
  if (url) cache.set(value, url);
  return url;
};

/** Hook สำหรับใช้งานใน component */
export const useArUrl = (value?: string | null) => {
  const [url, setUrl] = useState(() => (isStorageRef(value) ? "" : value || ""));
  useEffect(() => {
    let alive = true;
    if (!value) { setUrl(""); return; }
    if (!isStorageRef(value)) { setUrl(value); return; }
    resolveArUrl(value).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [value]);
  return url;
};

/** อัปโหลดไฟล์สื่อ AR แล้วคืนค่า reference สำหรับบันทึกลงฐานข้อมูล */
export const uploadArFile = async (file: File, folder: string, kind: string) => {
  const rawExt = file.name.split(".").pop() || "bin";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
  const path = sanitizeStorageKey(`${folder}/${kind}-${Date.now()}.${ext}`);
  const { error } = await supabase.storage.from(AR_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return toStorageRef(path);
};

