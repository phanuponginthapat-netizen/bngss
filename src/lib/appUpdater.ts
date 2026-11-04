import { swal } from "@/lib/swal";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { ApkUpdater } from "capacitor-apk-updater";
import { AppUpdate, AppUpdateAvailability } from "@capawesome/capacitor-app-update";

import { getBackendConfig } from "@/lib/runtimeConfig";

const SUPABASE_URL = getBackendConfig().url;
const SUPABASE_ANON_KEY = getBackendConfig().anonKey;
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object`;
// bucket app-downloads เป็น private — อ่านด้วย anon key ใน header (มี read policy สำหรับ anon)
const VERSION_URL = `${STORAGE_BASE}/app-downloads/version.json`;
const AUTH_HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

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

/** ทำให้ url ในไฟล์ manifest เป็น absolute เสมอ (กันกรณี CI เขียน path แบบสัมพัทธ์) */
function normalizeManifest(m: AppUpdateManifest): AppUpdateManifest {
  let url = (m.url || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    const file = m.fileName || url.split("/").pop() || "bngss-app-latest.apk";
    url = `${STORAGE_BASE}/app-downloads/${file}`;
  } else {
    // manifest เก่าอาจชี้ไป public path — แปลงเป็น authenticated path
    url = url.replace("/storage/v1/object/public/app-downloads/", "/storage/v1/object/app-downloads/");
  }
  return { ...m, url };
}

export async function fetchUpdateManifest(): Promise<AppUpdateManifest | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store", headers: AUTH_HEADERS });
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
  // ดาวน์โหลดผ่าน native downloader แนบ header ไม่ได้ → ขอ signed URL ก่อน
  const match = url.match(/\/app-downloads\/(.+?)(\?|$)/);
  let downloadUrl = url;
  if (match) {
    const { data } = await supabase.storage.from("app-downloads").createSignedUrl(decodeURIComponent(match[1]), 1800);
    if (data?.signedUrl) downloadUrl = data.signedUrl;
  }
  // ใส่ query กัน cache เพื่อให้ได้ไฟล์ล่าสุดเสมอ
  const fresh = `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
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

let promptOpen = false;
let lastCheckAt = 0;
const RECHECK_MS = 6 * 60 * 60 * 1000;

/** ตรวจตอนเปิดแอป และทุกครั้งที่กลับมาใช้แอปหลังผ่านไป 6 ชม. (แอปที่ค้างเปิดไว้ก็ยังเห็นรุ่นใหม่) */
export function startUpdateWatcher(): void {
  if (!isNativeAndroid()) return;
  lastCheckAt = Date.now();
  void checkAndPromptUpdate();
  import("@capacitor/app").then(({ App }) => {
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && Date.now() - lastCheckAt >= RECHECK_MS) {
        lastCheckAt = Date.now();
        void checkAndPromptUpdate();
      }
    });
  }).catch(() => {});
}

export async function checkAndPromptUpdate(): Promise<void> {
  if (promptOpen) return;
  promptOpen = true;
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
      if ((await swal.confirm({ title: message }))) await performSideloadUpdate(manifest.url);
      return;
    }
    // บังคับอัปเดต: ถามซ้ำแต่จำกัด 3 ครั้ง กันบล็อก UI ถ้า download ล้ม
    let attempts = 0;
    while (attempts < 3) {
      if ((await swal.confirm({ title: message }))) {
        try { await performSideloadUpdate(manifest.url); return; }
        catch (e) { console.warn("sideload update failed", e); attempts++; await new Promise(r=>setTimeout(r,1500)); continue; }
      } else {
        await new Promise((r) => setTimeout(r, 1500));
        attempts++;
      }
    }
  } catch (e) {
    console.warn("checkAndPromptUpdate failed", e);
  } finally {
    promptOpen = false;
  }

}
