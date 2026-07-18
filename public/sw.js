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
  if (event.tag === "flush-notifications") {
    event.waitUntil((async () => {
      try {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const c of clients) c.postMessage({ type: "flush-notifications" });
      } catch (_) {}
    })());
    return;
  }
  if (event.tag === "flush-offline-queue") {
    event.waitUntil(flushOfflineQueueFromSW());
    return;
  }
});

// รับคำสั่ง flush จากหน้าเว็บ (fallback สำหรับเบราว์เซอร์ที่ไม่รองรับ Background Sync)
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg && msg.type === "flush-offline-queue") {
    event.waitUntil(flushOfflineQueueFromSW());
  }
});

// -----------------------------------------------------------------------------
// Offline Queue Flush — ทำงานจากภายใน Service Worker
// อ่านคิวจาก IndexedDB (offline-queue/actions) แล้วยิง REST ตรงไป Supabase
// ใช้ config ที่หน้าเว็บฝากไว้ใน IDB (sw-config/config) เพื่อรู้ URL + token
// วิธีนี้ทำงานได้ *แม้ผู้ใช้ปิดแท็บ* ตราบใดที่ OS ปลุก SW ผ่าน Background Sync
// -----------------------------------------------------------------------------
function idbOpen(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    if (upgrade) req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readSwConfig() {
  try {
    const db = await idbOpen("sw-config", 1, (d) => {
      if (!d.objectStoreNames.contains("config")) d.createObjectStore("config");
    });
    const tx = db.transaction("config", "readonly");
    return await idbReq(tx.objectStore("config").get("supabase-auth"));
  } catch (_) { return null; }
}

async function readQueue() {
  try {
    const db = await idbOpen("offline-queue", 1, (d) => {
      if (!d.objectStoreNames.contains("actions")) {
        d.createObjectStore("actions", { keyPath: "id", autoIncrement: true });
      }
    });
    const tx = db.transaction("actions", "readonly");
    return await idbReq(tx.objectStore("actions").getAll());
  } catch (_) { return []; }
}

async function removeQueueItem(id) {
  try {
    const db = await idbOpen("offline-queue", 1);
    const tx = db.transaction("actions", "readwrite");
    tx.objectStore("actions").delete(id);
    await new Promise((r) => { tx.oncomplete = r; tx.onerror = r; });
  } catch (_) {}
}

async function updateQueueItem(item) {
  try {
    const db = await idbOpen("offline-queue", 1);
    const tx = db.transaction("actions", "readwrite");
    tx.objectStore("actions").put(item);
    await new Promise((r) => { tx.oncomplete = r; tx.onerror = r; });
  } catch (_) {}
}

let swFlushing = false;
async function flushOfflineQueueFromSW() {
  if (swFlushing) return;
  swFlushing = true;
  let ok = 0, failed = 0;
  try {
    const cfg = await readSwConfig();
    if (!cfg || !cfg.supabaseUrl || !cfg.apiKey) return;
    const items = await readQueue();
    if (!items.length) return;

    for (const item of items) {
      try {
        const url = `${cfg.supabaseUrl}/rest/v1/${encodeURIComponent(item.table)}`;
        const headers = {
          "Content-Type": "application/json",
          "apikey": cfg.apiKey,
          "Prefer": item.onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
        };
        // ใช้ access token ของผู้ใช้ ถ้ามี (สำหรับผ่าน RLS)
        if (cfg.accessToken) headers["Authorization"] = `Bearer ${cfg.accessToken}`;
        const qs = item.onConflict ? `?on_conflict=${encodeURIComponent(item.onConflict)}` : "";
        const res = await fetch(url + qs, {
          method: "POST",
          headers,
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
        }
        if (item.id !== undefined) await removeQueueItem(item.id);
        ok++;
      } catch (e) {
        failed++;
        if (item.id !== undefined) {
          await updateQueueItem({
            ...item,
            attempts: (item.attempts || 0) + 1,
            lastError: String(e && e.message ? e.message : e),
          });
        }
      }
    }
  } finally {
    swFlushing = false;
  }
  // แจ้ง client ที่ยังเปิดอยู่ (ถ้ามี) ว่ามีการซิงก์
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) c.postMessage({ type: "offline-queue-synced", ok, failed });
  } catch (_) {}
}
