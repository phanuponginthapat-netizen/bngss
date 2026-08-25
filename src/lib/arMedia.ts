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

/** ขนาดไฟล์สูงสุดที่เซิร์ฟเวอร์ยอมรับต่อ 1 ไฟล์ */
export const AR_MAX_FILE_BYTES = 50 * 1024 * 1024;

/** อัปโหลดไฟล์สื่อ AR แล้วคืนค่า reference สำหรับบันทึกลงฐานข้อมูล */
export const uploadArFile = async (file: File, folder: string, kind: string) => {
  if (file.size > AR_MAX_FILE_BYTES) {
    throw new Error(
      `ไฟล์ใหญ่เกินไป (${(file.size / 1048576).toFixed(1)} MB) จำกัดไม่เกิน 50 MB — กรุณาบีบอัดวิดีโอ (เช่น 720p) หรือใช้ลิงก์ YouTube แทน`,
    );
  }
  const rawExt = file.name.split(".").pop() || "bin";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
  const path = sanitizeStorageKey(`${folder}/${kind}-${Date.now()}.${ext}`);
  const { error } = await supabase.storage.from(AR_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
    cacheControl: "31536000",
  });
  if (error) {
    const msg = String((error as any)?.message || "");
    if (/exceeded|too large|413/i.test(msg)) {
      throw new Error("ไฟล์ใหญ่เกินขีดจำกัดของเซิร์ฟเวอร์ (50 MB) — กรุณาบีบอัดวิดีโอหรือใช้ลิงก์ YouTube");
    }
    if (/row-level security|not authorized|403|401/i.test(msg)) {
      throw new Error("ไม่มีสิทธิ์อัปโหลด — กรุณาเข้าสู่ระบบด้วยบัญชีบุคลากรอีกครั้ง");
    }
    throw error;
  }
  return toStorageRef(path);
};


