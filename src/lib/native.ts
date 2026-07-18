/**
 * Native bridge — ใช้ Capacitor APIs เมื่อรันใน app ปลายทาง,
 * ตกเป็น Web API อัตโนมัติเมื่อรันในเบราว์เซอร์
 */
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// -------- GPS --------
export async function getNativeCoords(opts?: { timeoutMs?: number }) {
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    await Geolocation.requestPermissions();
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: opts?.timeoutMs ?? 10000,
      maximumAge: 0,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  }
  return new Promise<{ lat: number; lng: number; accuracy: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("ไม่รองรับ GPS"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.message)),
      { enableHighAccuracy: true, timeout: opts?.timeoutMs ?? 10000, maximumAge: 0 },
    );
  });
}

// -------- Camera / Gallery --------
export async function pickNativePhoto(opts?: { source?: "camera" | "gallery" }) {
  if (!isNative()) return null; // ให้ caller fallback ไปใช้ <input capture>
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: opts?.source === "gallery" ? CameraSource.Photos : CameraSource.Camera,
  });
  if (!photo.dataUrl) return null;
  const res = await fetch(photo.dataUrl);
  const blob = await res.blob();
  const ext = photo.format || "jpg";
  return new File([blob], `photo_${Date.now()}.${ext}`, { type: blob.type });
}

// -------- Haptics --------
export async function tap(style: "light" | "medium" | "heavy" = "light") {
  try {
    if (isNative()) {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
      await Haptics.impact({ style: map[style] });
    } else if ("vibrate" in navigator) {
      navigator.vibrate(style === "heavy" ? 30 : style === "medium" ? 15 : 8);
    }
  } catch {}
}

// -------- Share --------
export async function shareContent(opts: { title?: string; text?: string; url?: string }) {
  if (isNative()) {
    const { Share } = await import("@capacitor/share");
    await Share.share(opts);
    return true;
  }
  if ((navigator as any).share) {
    await (navigator as any).share(opts);
    return true;
  }
  return false;
}

// -------- Push Notifications (FCM/APNs) --------
export async function registerNativePush(onToken: (token: string) => void) {
  if (!isNative()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;
  await PushNotifications.register();
  PushNotifications.addListener("registration", (t) => onToken(t.value));
  PushNotifications.addListener("registrationError", (e) => console.error("push reg error", e));
}

// -------- App lifecycle + Status bar --------
export async function initNativeChrome() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
  } catch {}
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {}
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
    });
  } catch {}
}
