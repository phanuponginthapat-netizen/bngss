// Polyfills for newer TC39 proposals used by pdfjs-dist v6 (Chrome <133, Safari, Firefox)
import "core-js/modules/es.map.get-or-insert-computed.js";
import "core-js/modules/es.weak-map.get-or-insert-computed.js";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, subscribeToPush } from "./lib/pushSubscribe";
import { applyDynamicBranding } from "./lib/dynamicManifest";
import { installGlobalErrorHandlers } from "./lib/errorLogger";
import { initNativeShell } from "./lib/nativeShell";

installGlobalErrorHandlers();
initNativeShell();

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

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for Web Push (skipped automatically in preview/iframe)
// บน Android/iOS เบราว์เซอร์/OS จะ "พักแอป" เมื่อปิดหน้าจอ — เราพึ่ง Service Worker ให้ OS ปลุกขึ้นมาเอง
// ตอน push เข้า (FCM/APNs ผ่าน Web Push) จึงจะมีแจ้งเตือนแม้แอปไม่ทำงาน
async function ensurePushAliveInBackground() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    // ตรวจ subscription เดิม — ถ้าหายหรือหมดอายุ ให้ subscribe ใหม่อัตโนมัติ
    // (กันเคส OS เคลียร์ subscription เงียบ ๆ แล้วทำให้ไม่มีแจ้งเตือนเด้งอีกเลย)
    const sub = await reg.pushManager.getSubscription();
    if (!sub && Notification.permission === "granted") {
      await subscribeToPush();
    }
    // ลงทะเบียน Periodic Background Sync เพื่อช่วยให้ OS ตื่นมาเช็ค subscription เป็นระยะ
    // (รองรับเฉพาะ Chrome/Android เมื่อแอปถูกติดตั้งเป็น PWA — เบราว์เซอร์อื่นจะข้าม)
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
  });

  // ทุกครั้งที่ผู้ใช้กลับเข้าแอป ให้ตรวจ subscription อีกที — ป้องกันแจ้งเตือนเงียบหลังพักแอปนาน
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
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
