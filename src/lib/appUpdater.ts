import { Capacitor } from "@capacitor/core";
import { ApkUpdater } from "capacitor-apk-updater";
import { AppUpdate, AppUpdateAvailability } from "@capawesome/capacitor-app-update";

const VERSION_URL =
  "https://gwmszzoqqxmejefhayqf.supabase.co/storage/v1/object/public/app-downloads/version.json";

export interface AppUpdateManifest {
  versionCode: number;
  versionName: string;
  url: string;
  notes?: string;
}

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function fetchUpdateManifest(): Promise<AppUpdateManifest | null> {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AppUpdateManifest;
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
  const { filePath } = await ApkUpdater.downloadApk({
    url,
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
    const ok = window.confirm(
      `มีเวอร์ชันใหม่ (${manifest.versionName}) พร้อมให้อัปเดต\n\n${
        manifest.notes ?? "อัปเดตฟีเจอร์และแก้ไขล่าสุด"
      }\n\nต้องการดาวน์โหลดและติดตั้งเลยหรือไม่?`
    );
    if (ok) await performSideloadUpdate(manifest.url);
  } catch {
    // ข้ามอัปเดตเงียบๆ เมื่อเกิดปัญหาเครือข่าย/ระบบ
  }
}