// Service Worker — Web Push notifications (no app-shell caching)
const SW_VERSION = "v5-push";

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
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    image: data.image || undefined,
    tag,
    renotify: true,                  // เสียง/สั่นทุกครั้งแม้ tag เดิม (แนวโซเชียลแอป)
    // ค่าตั้งต้น = ไม่สติ๊กกี้ ให้ auto-dismiss เหมือน LINE/Facebook/Messenger
    // เฉพาะเหตุเร่งด่วน/critical เท่านั้นที่ค้างจนกว่าจะกด
    requireInteraction: data.requireInteraction === true || isUrgent,
    silent: false,
    timestamp: Date.now(),
    vibrate: isUrgent ? [300, 100, 300, 100, 300] : [120, 60, 120],
    data: { url: data.url || "/dashboard", receivedAt: Date.now() },
    actions: [
      { action: "open", title: "เปิด" },
      { action: "dismiss", title: "ปิด" },
    ],
  };

  // แสดง notification ทันที ไม่รอ post-message ให้ client — เร็วขึ้นชัดเจน
  event.waitUntil(self.registration.showNotification(title, options));

  // ส่ง message ให้แท็บที่เปิดอยู่แบบ non-blocking (เล่นเสียง/อัปเดต UI)
  (async () => {
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) c.postMessage({ type: "push", payload: data, urgent: isUrgent });
    } catch (_) {}
  })();
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
// ช่วยให้แอปไม่ถูก "หลับสนิท" จน push channel หลุดเงียบ ๆ
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "keep-push-alive") return;
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // ถ้า subscription หาย → บอก client ให้ subscribe ใหม่ครั้งถัดที่เปิดแอป
      if (!sub) {
        for (const c of clients) c.postMessage({ type: "resubscribe" });
      }
    } catch (_) {}
  })());
});

// Background Sync — retry งานที่ค้างเมื่อกลับมาออนไลน์ (ช่วยให้การส่ง/อ่านแจ้งเตือนไม่หล่นหาย)
self.addEventListener("sync", (event) => {
  if (event.tag !== "flush-notifications") return;
  event.waitUntil((async () => {
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) c.postMessage({ type: "flush-notifications" });
    } catch (_) {}
  })());
});
