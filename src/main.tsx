import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, subscribeToPush } from "./lib/pushSubscribe";
import { applyDynamicBranding } from "./lib/dynamicManifest";
import { installGlobalErrorHandlers } from "./lib/errorLogger";
// Patch Date.prototype toLocale* ให้แสดงผลแบบไทย (พ.ศ. + 24 ชม.) ทั้งระบบ
import "./lib/dateLocalePatch";

installGlobalErrorHandlers();

// Auto-recover from stale chunk errors after a new deploy.
// When the HTML is cached but old JS chunks no longer exist, lazy imports fail
// with "Failed to fetch dynamically imported module" or "ChunkLoadError" — which
// shows as a blank page. Detect once per session and hard-reload bypassing cache.
const RELOAD_KEY = "__chunk_reload_at";
function looksLikeChunkLoadError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
}
function maybeReloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (Date.now() - last < 30_000) return; // already reloaded recently — avoid infinite loop
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  } catch { /* ignore */ }
}
window.addEventListener("error", (e) => {
  if (looksLikeChunkLoadError(e.error || e.message)) maybeReloadOnce();
});
window.addEventListener("unhandledrejection", (e) => {
  if (looksLikeChunkLoadError(e.reason)) maybeReloadOnce();
});

// จับ event ติดตั้ง PWA ตั้งแต่ต้น เพื่อเก็บไว้ให้ปุ่ม "ติดตั้งลงหน้าจอหลัก" ใช้ภายหลัง
window.addEventListener("beforeinstallprompt", (e: Event) => {
  e.preventDefault();
  (window as any).__deferredInstallPrompt = e;
  window.dispatchEvent(new CustomEvent("pwa:installable"));
});
window.addEventListener("appinstalled", () => {
  (window as any).__deferredInstallPrompt = null;
  window.dispatchEvent(new CustomEvent("pwa:installed"));
});

// ผูก manifest/ไอคอน/ชื่อ จาก CMS ก่อน mount เพื่อให้ prompt ติดตั้งใช้ค่าจริง
applyDynamicBranding();

// เริ่ม native bridges (status bar, splash, back button) — no-op บนเว็บ
import("./lib/native").then(({ initNativeChrome }) => initNativeChrome());

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for Web Push (skipped automatically in preview/iframe)
// บน Android/iOS เบราว์เซอร์/OS จะ "พักแอป" เมื่อปิดหน้าจอ — เราพึ่ง Service Worker ให้ OS ปลุกขึ้นมาเอง
// ตอน push เข้า (FCM/APNs ผ่าน Web Push) จึงจะมีแจ้งเตือนแม้แอปไม่ทำงาน
async function ensurePushAliveInBackground() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();

    // เคส 1: subscription หาย → subscribe ใหม่
    if (!sub && Notification.permission === "granted") {
      await subscribeToPush();
    }
    // เคส 2: subscription ใกล้หมดอายุ (เหลือ < 3 วัน) หรือหมดแล้ว → ต่ออายุ
    // (Android Chrome/FCM อาจหมุน endpoint เงียบ ๆ ทำให้แจ้งเตือนเงียบหลังใช้แอปนาน ๆ)
    else if (sub && Notification.permission === "granted") {
      const expTime = (sub as any).expirationTime as number | null | undefined;
      const threshold = Date.now() + 3 * 24 * 60 * 60 * 1000;
      if (expTime && expTime < threshold) {
        try { await sub.unsubscribe(); } catch (_) {}
        await subscribeToPush();
      }
    }

    // ลงทะเบียน Periodic Background Sync เพื่อให้ OS ตื่นมาเช็ค subscription เป็นระยะ
    const anyReg = reg as unknown as {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    };
    if (anyReg.periodicSync) {
      try {
        const status = await (navigator.permissions as any)?.query?.({ name: "periodic-background-sync" as PermissionName });
        if (!status || status.state === "granted") {
          await anyReg.periodicSync.register("keep-push-alive", { minInterval: 12 * 60 * 60 * 1000 });
        }
      } catch (_) { /* ไม่รองรับ — ข้าม */ }
    }
  } catch (_) { /* ignore */ }
}


if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    await registerServiceWorker();
    await ensurePushAliveInBackground();
    // เคลียร์ App Badge เมื่อผู้ใช้เปิดแอป (Android/Windows/macOS PWA)
    try { (navigator as any).clearAppBadge?.(); } catch (_) {}
  });

  // เมื่อกลับมาโฟกัสแอป: เคลียร์ badge + ตรวจ subscription (กันแจ้งเตือนเงียบหลังพักแอปนาน)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      try { (navigator as any).clearAppBadge?.(); } catch (_) {}
      ensurePushAliveInBackground();
    }
  });

  // เมื่อ Service Worker รับ push แล้วส่ง message มาบอก client → เล่นเสียงในแอป (เลียนแบบ LINE/Messenger)
  navigator.serviceWorker.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "push") {
      // Use the Web Audio ping (already unlocked by first user gesture) — works on iOS Safari
      // where new Audio('/notification.mp3').play() is blocked until a gesture.
      import("./lib/notificationSound").then(({ playNotificationSound }) => {
        try { playNotificationSound({ urgent: !!msg.urgent }); } catch {}
      }).catch(() => {
        try {
          const audio = new Audio("/notification.mp3");
          audio.volume = 0.8;
          audio.play().catch(() => {});
        } catch {}
      });
      try { navigator.vibrate?.([200, 100, 200]); } catch (_) {}
    } else if (msg.type === "navigate" && msg.url) {
      window.location.href = msg.url;
    } else if (msg.type === "resubscribe") {
      subscribeToPush().catch(() => {});
    }
  });
}
