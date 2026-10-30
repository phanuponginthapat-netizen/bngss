import { getBackendConfig } from "@/lib/runtimeConfig";

const storageKey = () => `bng.kiosk.credential:${getBackendConfig().url}`;
export function getKioskDeviceKey(): string {
  try { return localStorage.getItem(storageKey()) || ""; } catch { return ""; }
}
export function saveKioskDeviceKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("กรุณากรอกรหัสเครื่อง");
  localStorage.setItem(storageKey(), trimmed);
}
export function kioskCredentialHeaders(): Record<string, string> {
  const key = getKioskDeviceKey();
  return key ? { "x-device-key": key } : {};
}