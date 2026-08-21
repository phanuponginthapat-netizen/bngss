import { Capacitor } from "@capacitor/core";
import { ApkUpdater } from "capacitor-apk-updater";
import { AppUpdate, AppUpdateAvailability } from "@capawesome/capacitor-app-update";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "https://gwmszzoqqxmejefhayqf.supabase.co";
const VERSION_URL = `${SUPABASE_URL}/storage/v1/object/public/app-downloads/version.json`;

export interface AppUpdateManifest {
  versionCode: number;
  versionName: string;
  url: string;
  fileName?: string;
  mandatory?: boolean;
  releasedAt?: string;
  notes?: string;
}


export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object`;

/** ทำให้ url ในไฟล์ manifest เป็น absolute เสมอ (กันกรณี CI เขียน path แบบสัมพัทธ์) */
function normalizeManifest(m: AppUpdateManifest): AppUpdateManifest {
  let url = (m.url || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    const file = m.fileName || url.split("/").pop() || "bngss-app-latest.apk";
    url = `${STORAGE_BASE}/public/app-downloads/${file}`;
  }
  return { ...m, url };
}

export async function fetchUpdateManifest(): Promise<AppUpdateManifest | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return normalizeManifest((await res.json()) as AppUpdateManifest);
  } catch {
    return null;
  }
}


export async function checkForAppUpdate(): Promise<AppUpdateManifest | null> {
  if (!isNativeAndroid()) return null;
  const manifest = await fetchUpdateManifest();
  if (!manifest || typeof manifest.versionCode !== "number") return null;
  const { versionCode } = await ApkUpdater.getAppVersion();
  return manifest.versionCode > versionCode ? manifest : null;
}

export async function performSideloadUpdate(url: string): Promise<void> {
  // ใส่ query กัน cache เพื่อให้ได้ไฟล์ล่าสุดเสมอ
  const fresh = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const { filePath } = await ApkUpdater.downloadApk({
    url: fresh,
    title: "กำลังดาวน์โหลดอัปเดต BNGSS...",
  });
  await ApkUpdater.installApk({ filePath });
}

export async function isPlayStoreUpdateAvailable(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const info = await AppUpdate.getAppUpdateInfo();
    return info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE;
  } catch {
    return false;
  }
}

export async function checkAndPromptUpdate(): Promise<void> {
  try {
    if (!isNativeAndroid()) return;
    if (await isPlayStoreUpdateAvailable()) return;
    const manifest = await checkForAppUpdate();
    if (!manifest) return;
    const mandatory = manifest.mandatory !== false;
    const message = `มีเวอร์ชันใหม่ (${manifest.versionName}) พร้อมให้อัปเดต\n\n${
      manifest.notes ?? "อัปเดตฟีเจอร์และแก้ไขล่าสุด"
    }\n\n${mandatory ? "จำเป็นต้องอัปเดตก่อนใช้งานต่อ" : "ต้องการดาวน์โหลดและติดตั้งเลยหรือไม่?"}`;

    if (!mandatory) {
      if (window.confirm(message)) await performSideloadUpdate(manifest.url);
      return;
    }
    // บังคับอัปเดต: ถามซ้ำแต่จำกัด 3 ครั้ง กันบล็อก UI ถ้า download ล้ม
    let attempts = 0;
    while (attempts < 3) {
      if (window.confirm(message)) {
        try { await performSideloadUpdate(manifest.url); return; }
        catch (e) { console.warn("sideload update failed", e); attempts++; await new Promise(r=>setTimeout(r,1500)); continue; }
      } else {
        await new Promise((r) => setTimeout(r, 1500));
        attempts++;
      }
    }
  } catch (e) {
    console.warn("checkAndPromptUpdate failed", e);
  }

}