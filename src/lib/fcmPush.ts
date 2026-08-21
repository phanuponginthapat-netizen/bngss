// FCM push for the Android APK (Capacitor WebView → Firebase Cloud Messaging).
// - Registers the device token into push_subscriptions (provider='fcm') so the
//   existing send-push / notify-fanout edge functions can deliver native push
//   even when the app is closed or the screen is locked.
// - Foreground notifications are shown as in-app live toasts (same as web).
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PushNotificationSchema,
} from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { showLiveNotification } from "@/lib/liveNotification";

let initialized = false;
const PENDING_KEY = "pending_fcm_token";
let pendingToken: string | null = (() => {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
})();

function setPendingToken(t: string | null) {
  pendingToken = t;
  try {
    if (t) localStorage.setItem(PENDING_KEY, t);
    else localStorage.removeItem(PENDING_KEY);
  } catch { /* ignore */ }
}

export function isNativeFcmSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

async function saveDeviceToken(token: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setPendingToken(token);
      return;
    }
    await supabase.from("push_subscriptions").upsert(
      {
        user_id: data.user.id,
        endpoint: `fcm:${token}`,
        p256dh: "",
        auth: "",
        device_token: token,
        provider: "fcm",
        platform: "android",
      },
      { onConflict: "user_id,device_token" },
    );
  } catch (e) {
    console.warn("FCM token save failed", e);
  }
}

/** หลัง login แล้ว ให้บันทึก token ที่ค้างไว้ตอนแอปเปิดก่อนล็อกอิน */
export async function flushPendingFcmToken(): Promise<void> {
  const t = pendingToken || (() => { try { return localStorage.getItem(PENDING_KEY); } catch { return null; } })();
  if (!t) return;
  setPendingToken(null);
  await saveDeviceToken(t);
}

export async function initFcmPush(): Promise<void> {
  if (initialized) return;
  if (!isNativeFcmSupported()) return;
  initialized = true;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("FCM permission denied");
      return;
    }

    PushNotifications.addListener("registration", (token) => {
      void saveDeviceToken(token.value);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("FCM registration error", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (n: PushNotificationSchema) => {
      const title = n.title || "BNGSS";
      const data = (n.data ?? {}) as Record<string, unknown>;
      const route = typeof data.url === "string" ? data.url : "/dashboard/inbox";
      showLiveNotification({
        title,
        body: n.body || "",
        route,
        urgent: data.urgent === true || data.urgent === "true",
        tag: `fcm-${n.id || title}`,
      });
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {

      const data = (action.notification.data ?? {}) as Record<string, unknown>;
      if (typeof data.url === "string" && data.url.startsWith("/")) {
        window.location.href = data.url;
      }
    });

    // Android 8+ ต้องมี channel — ใช้ id "default" ให้ตรงกับ payload ฝั่ง edge function
    try {
      await PushNotifications.createChannel({
        id: "default",
        name: "การแจ้งเตือน",
        description: "การแจ้งเตือนจาก BNGSS",
        importance: 4,
        sound: "default",
        vibration: true,
      });
    } catch {
      // channel มีอยู่แล้ว — ข้าม
    }

    await PushNotifications.register();
  } catch (e) {
    console.warn("FCM init failed", e);
    initialized = false;
  }
}