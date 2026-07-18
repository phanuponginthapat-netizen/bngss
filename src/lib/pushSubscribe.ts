import { supabase } from "@/integrations/supabase/client";

// VAPID public key — fetched from backend so it always matches the server-side VAPID_PRIVATE_KEY.
export const VAPID_PUBLIC_KEY_FALLBACK =
  "BBMeUAOraQHGtdw31hIdhUwVLAQoy6Rzu2o6eTbhYByjG_6t6gwNSLzlp-T2ZWhl9arfDzQcNtQu6mJt3jUrxyI";

let cachedPublicKey: string | null = null;
async function getVapidPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  try {
    const { data } = await supabase.functions.invoke("get-vapid-key", { method: "GET" });
    if (data?.publicKey) {
      cachedPublicKey = data.publicKey as string;
      return cachedPublicKey;
    }
  } catch (_) {}
  cachedPublicKey = VAPID_PUBLIC_KEY_FALLBACK;
  return cachedPublicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isPreviewHost(): boolean {
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export function isPwaCapable(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  if (isInIframe() || isPreviewHost()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("SW register failed", e);
    return null;
  }
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  // iOS uses navigator.standalone; others use display-mode media query
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as any).standalone === true
  );
}

export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPwaCapable()) {
    // iOS เปิดใน Safari ปกติจะไม่มี PushManager — ต้องติดตั้งบน Home Screen ก่อน
    if (isIOS() && !isStandalonePWA()) {
      return { success: false, error: "บน iPhone/iPad ต้องเพิ่มแอปที่ Home Screen ก่อน (Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม) แล้วเปิดจากไอคอนแอป จึงจะเปิดแจ้งเตือนได้" };
    }
    return { success: false, error: "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน" };
  }
  if (isInIframe() || isPreviewHost()) {
    return { success: false, error: "ต้องเปิดในแอปที่ติดตั้งแล้ว ไม่ใช่ในตัวอย่าง (preview)" };
  }
  if (isIOS() && !isStandalonePWA()) {
    return { success: false, error: "บน iPhone/iPad ต้องเปิดจากไอคอนแอปที่ติดตั้งบน Home Screen (Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม)" };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { success: false, error: "ผู้ใช้ไม่อนุญาตให้แจ้งเตือน" };

  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg) return { success: false, error: "ลงทะเบียน Service Worker ไม่สำเร็จ" };
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const pubKey = await getVapidPublicKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pubKey).buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { success: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: u.user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh || "",
      auth: json.keys?.auth || "",
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

export async function getCurrentPushStatus(): Promise<"subscribed" | "denied" | "default" | "unsupported"> {
  if (!isPwaCapable()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub && Notification.permission === "granted") return "subscribed";
  return "default";
}
