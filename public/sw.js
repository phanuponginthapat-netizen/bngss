// Service Worker — Web Push notifications (no app-shell caching)
const SW_VERSION = "v6-push";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // เคลียร์เฉพาะ cache เก่าของ SW นี้ (workbox/app-shell รุ่นก่อน)
    // ห้ามลบทั้งหมด — จะไปล้าง cache ของ Firebase Messaging / OneSignal / อื่น ๆ ที่แชร์ origin เดียวกัน
    const names = await caches.keys();
    const mine = names.filter((n) => /^(workbox-|precache-|runtime-|app-shell)/i.test(n));
    await Promise.all(mine.map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Dedup: จำ tag ที่เพิ่งแสดงไปในหน้าต่างสั้น ๆ เพื่อกันแจ้งเตือนซ้ำ
// (กรณี server ยิงซ้ำ / realtime + push มาพร้อมกัน)
const recentTags = new Map(); // tag → timestamp
const DEDUP_WINDOW_MS = 8000;

function seenRecently(tag) {
  const now = Date.now();
  // ล้างของเก่า
  for (const [k, t] of recentTags) if (now - t > DEDUP_WINDOW_MS) recentTags.delete(k);
  if (recentTags.has(tag)) return true;
  recentTags.set(tag, now);
  return false;
}

async function hasVisibleClient() {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    return clients.some((c) => c.visibilityState === "visible" && c.focused);
  } catch (_) {
    return false;
  }
}

// Receive push events
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "แจ้งเตือน", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "แจ้งเตือนใหม่";
  const tag = data.tag || `n-${Date.now()}`;
  const isUrgent = data.urgent === true || data.severity === "critical";

  event.waitUntil((async () => {
    // Dedup — ถ้า tag เดียวกันเพิ่งแสดงไปใน 8 วิ ให้ข้าม (ยกเว้น urgent)
    if (!isUrgent && seenRecently(tag)) {
      return;
    }

    // ถ้าผู้ใช้กำลังเปิดแอปอยู่ (visible + focused) → ไม่ต้องเด้ง OS notification
    // ให้ realtime toast ในแอปจัดการแทน (กันเห็นซ้ำสองที่)
    const focused = await hasVisibleClient();

    if (!focused || isUrgent) {
      const options = {
        body: data.body || "",
        icon: data.icon || "/icon-192.png",
        badge: "/icon-192.png",
        image: data.image || undefined,
        tag,
        renotify: true, // เสียง/สั่นทุกครั้งแม้ tag เดิม
        requireInteraction: data.requireInteraction === true || isUrgent,
        silent: false,
        timestamp: Date.now(),
        vibrate: isUrgent ? [400, 120, 400, 120, 400, 120, 400] : [200, 80, 200, 80, 200],
        data: { url: data.url || "/dashboard", receivedAt: Date.now(), tag },
        actions: [
          { action: "open", title: "เปิด" },
          { action: "dismiss", title: "ปิด" },
        ],
      };
      await self.registration.showNotification(title, options);
    }

    // แจ้งทุกแท็บให้เล่นเสียง / อัปเดต UI (ทำเสมอ ทั้งเปิดอยู่และไม่เปิด)
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) c.postMessage({ type: "push", payload: data, urgent: isUrgent, tag });
    } catch (_) {}
  })());
});


// Click to open / handle actions
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) {
      try {
        const u = new URL(c.url);
        if (u.origin === self.location.origin) {
          await c.focus();
          if ("navigate" in c) return c.navigate(targetUrl);
          c.postMessage({ type: "navigate", url: targetUrl });
          return;
        }
      } catch (_) {}
    }
    return self.clients.openWindow(targetUrl);
  })());
});

// Resubscribe automatically when the push service rotates the endpoint
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) c.postMessage({ type: "resubscribe" });
    } catch (_) {}
  })());
});

// Periodic Background Sync — ให้ OS (Android Chrome PWA) ปลุก SW เป็นระยะเพื่อตรวจ subscription
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "keep-push-alive") return;
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (!sub) {
        for (const c of clients) c.postMessage({ type: "resubscribe" });
      }
    } catch (_) {}
  })());
});

// Background Sync — retry งานที่ค้างเมื่อกลับมาออนไลน์
self.addEventListener("sync", (event) => {
  if (event.tag !== "flush-notifications") return;
  event.waitUntil((async () => {
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) c.postMessage({ type: "flush-notifications" });
    } catch (_) {}
  })());
});
