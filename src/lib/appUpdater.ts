import { Capacitor } from "@capacitor/core";
import { ApkUpdater } from "capacitor-apk-updater";
import { AppUpdate, AppUpdateAvailability } from "@capawesome/capacitor-app-update";

const VERSION_URL =
  "https://gwmszzoqqxmejefhayqf.supabase.co/storage/v1/object/public/app-downloads/version.json";

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
    // บังคับอัปเดต: วนถามจนกว่าผู้ใช้จะยืนยันติดตั้ง
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (window.confirm(message)) {
        await performSideloadUpdate(manifest.url);
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch {
    // ข้ามอัปเดตเงียบๆ เมื่อเกิดปัญหาเครือข่าย/ระบบ
  }

}