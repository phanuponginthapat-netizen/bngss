// Service Worker — Web Push + App-shell offline caching
const SW_VERSION = "v8-nav-preload";
const SHELL_CACHE = `shell-${SW_VERSION}`;
const ASSET_CACHE = `assets-${SW_VERSION}`;
const IMAGE_CACHE = `images-${SW_VERSION}`;
const OFFLINE_URL = "/";

// Precache app shell entry so navigations work offline
const SHELL_URLS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS.map((u) => new Request(u, { cache: "reload" })));
    } catch (_) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // เปิด Navigation Preload → เบราว์เซอร์เริ่ม fetch HTML ขนานกับการปลุก SW (เร็วขึ้น ~200-500ms ตอนเปิดแอป)
    try { if (self.registration.navigationPreload) await self.registration.navigationPreload.enable(); } catch (_) {}
    // Clear caches from previous SW versions (keep only current)
    const keep = new Set([SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// ---------- Offline caching strategies ----------
function isSameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
}
function isHashedAsset(pathname) {
  // Vite emits hashed filenames under /assets/* like main-abc123.js
  return /\/assets\/[^/]+-[A-Za-z0-9]{6,}\.(js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|gif)$/.test(pathname);
}
function isImageRequest(req) {
  return req.destination === "image";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept Supabase API, auth callbacks, websockets, or chrome-extension
  if (url.pathname.startsWith("/~oauth")) return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.protocol === "chrome-extension:") return;
  if (req.headers.get("upgrade") === "websocket") return;

  // 1) HTML navigations → NetworkFirst (fallback to cached shell when offline)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        // ใช้ preloaded response ถ้ามี (เร็วกว่า fetch ใหม่)
        const preload = event.preloadResponse ? await event.preloadResponse : null;
        const fresh = preload || await fetch(req);
        try {
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", fresh.clone());
        } catch (_) {}
        return fresh;
      } catch (_) {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match("/") || await cache.match(OFFLINE_URL);
        if (cached) return cached;
        return new Response("Offline", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // 2) Same-origin hashed assets → CacheFirst
  if (isSameOrigin(req.url) && isHashedAsset(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const resp = await fetch(req);
        if (resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch (_) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // 3) Images (same-origin or cross-origin like CDN) → Stale-While-Revalidate, capped
  if (isImageRequest(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then((resp) => {
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      }).catch(() => cached || Response.error());
      return cached || fetchPromise;
    })());
    return;
  }

  // Everything else: pass through (network-only)
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
  // iOS ต้องมี body ไม่ว่าง ไม่งั้นจะไม่เล่นเสียง/ไม่ขึ้น Notification Center
  const body = (data.body && String(data.body).trim()) || " ";
  const tag = data.tag || `n-${Date.now()}`;

  // ตรวจ iOS จริง ๆ (ไม่รวม Mac desktop) — iOS Safari Web Push รองรับเฉพาะ field พื้นฐาน
  // ถ้าใส่ option ที่ไม่รู้จัก iOS จะแสดง notification เงียบ ๆ หรือไม่แสดงเลย
  const ua = (self.navigator && self.navigator.userAgent) || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);

  const baseData = {
    url: data.url || "/dashboard",
    receivedAt: Date.now(),
    urgent: data.urgent === true,
  };

  const options = isIOS
    ? {
        body,
        icon: data.icon || "/icon-192.png",
        badge: "/icon-192.png",
        tag,
        // iOS: silent:false บังคับให้เล่นเสียง/สั่นตาม system setting (เหมือน LINE/FB)
        silent: false,
        data: baseData,
      }
    : {
        body,
        icon: data.icon || "/icon-192.png",
        badge: "/icon-192.png",
        image: data.image || undefined,
        tag,
        renotify: true,
        // ค้างใน tray จนผู้ใช้ปัดออก (เหมือน LINE/Messenger) — ถ้า false Android ลบเองใน ~30s
        requireInteraction: data.requireInteraction !== false,
        silent: false,
        timestamp: Date.now(),
        vibrate: data.urgent === true ? [300, 100, 300, 100, 300, 100, 300] : [200, 100, 200],
        data: baseData,
        actions: [
          { action: "open", title: "เปิด" },
          { action: "dismiss", title: "ปิด" },
        ],
      };


  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // App Badge — เพิ่มเลขบนไอคอนแอป (Android/Windows/macOS PWA)
    try {
      if (self.navigator && "setAppBadge" in self.navigator) {
        const n = Number(data.badgeCount);
        if (Number.isFinite(n) && n > 0) await self.navigator.setAppBadge(n);
        else await self.navigator.setAppBadge();
      }
    } catch (_) {}
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        c.postMessage({ type: "push", payload: data });
      }
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
