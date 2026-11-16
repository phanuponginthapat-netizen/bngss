import { Capacitor } from "@capacitor/core";

export interface MobileSessionDevice {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  nativePlatform?: string;
  mobileHint?: boolean;
}

/** Device identity, not screen width or touch support (desktop PCs can have both). */
export function isMobileSessionDevice(device: MobileSessionDevice): boolean {
  if (device.nativePlatform === "android" || device.nativePlatform === "ios") return true;
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(device.userAgent)) return true;
  // iPadOS desktop mode identifies as a Mac; real Macs have no multitouch screen.
  if (device.platform === "MacIntel" && device.maxTouchPoints > 1) return true;
  if (/Windows|CrOS|X11/i.test(device.userAgent)) return false;
  return device.mobileHint === true;
}

export function isMobileSession(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return isMobileSessionDevice({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    nativePlatform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : undefined,
    mobileHint: nav.userAgentData?.mobile,
  });
}