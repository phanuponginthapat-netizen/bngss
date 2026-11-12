import { supabase, SUPABASE_RUNTIME_URL, SUPABASE_RUNTIME_ANON_KEY } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();
const pending = new Map<string, Promise<string>>();
let activeToken: string | null = null;

export function clearVaultFileCache() {
  for (const entry of cache.values()) URL.revokeObjectURL(entry.url);
  cache.clear();
  pending.clear();
  activeToken = null;
}

supabase.auth.onAuthStateChange((_event, session) => {
  if ((session?.access_token ?? null) !== activeToken) clearVaultFileCache();
});

export async function getVaultFileUrl(itemId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) {
    clearVaultFileCache();
    throw new Error("กรุณาเข้าสู่ระบบอีกครั้งเพื่อเปิดไฟล์");
  }
  if (token !== activeToken) {
    clearVaultFileCache();
    activeToken = token;
  }
  const cached = cache.get(itemId);
  if (cached && cached.expires > Date.now()) return cached.url;
  if (cached) {
    URL.revokeObjectURL(cached.url);
    cache.delete(itemId);
  }
  const existing = pending.get(itemId);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
    const response = await fetch(`${SUPABASE_RUNTIME_URL}/functions/v1/line-vault-stream?id=${encodeURIComponent(itemId)}`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_RUNTIME_ANON_KEY },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 410) throw new Error("รายการนี้บันทึกไฟล์จาก LINE ไม่สำเร็จ และต้นฉบับใน LINE ไม่พร้อมให้ดึงแล้ว กรุณาส่งไฟล์เข้ากลุ่ม LINE อีกครั้งหรืออัปโหลดไฟล์ต้นฉบับ");
      if (response.status === 504) throw new Error("LINE ยังไม่ตอบกลับ จึงยังดึงไฟล์ต้นฉบับไม่ได้ กรุณาลองใหม่ หรือส่งไฟล์เข้ากลุ่ม LINE อีกครั้ง");
      if (response.status === 404) throw new Error("ไม่พบไฟล์ต้นฉบับ รายการยังอยู่ แต่ต้องตรวจไฟล์ใน Drive หรือพื้นที่เก็บไฟล์");
      if (response.status === 401 || response.status === 403) throw new Error("ไม่มีสิทธิ์เปิดไฟล์นี้ หรือการเข้าสู่ระบบหมดอายุ");
      throw new Error("เปิดไฟล์ไม่สำเร็จ กรุณาลองใหม่หรือตรวจการเชื่อมต่อ Drive");
    }
    const blob = await response.blob();
    if (activeToken !== token) throw new Error("บัญชีเปลี่ยนแล้ว กรุณาเปิดไฟล์อีกครั้ง");
    const url = URL.createObjectURL(blob);
    cache.set(itemId, { url, expires: Date.now() + 50 * 60 * 1000 });
    return url;
    } finally { clearTimeout(timeout); }
  })();
  pending.set(itemId, request);
  try { return await request; }
  finally { if (pending.get(itemId) === request) pending.delete(itemId); }
}

export function requireArchiveFile<T>(file: T | null, filename: string): T {
  if (!file) throw new Error(`อ่านไฟล์ “${filename}” ไม่สำเร็จ จึงยังไม่ดาวน์โหลด ZIP เพื่อป้องกันไฟล์ตกหล่น`);
  return file;
}