export type InstallPlatform = "android" | "ios" | "desktop";

/** iPadOS may advertise itself as a Mac, so check touch support too. */
export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export function isEmbeddedBrowser(userAgent: string): boolean {
  return /Line\/|FBAN|FBAV|Instagram/i.test(userAgent);
}