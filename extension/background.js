// Safe Browser — background service worker
const SUPABASE_URL = "https://ivwerrtespnrwigzcpzn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2d2VycnRlc3BucndpZ3pjcHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTI2MjUsImV4cCI6MjA5NjA4ODYyNX0.GJ56S-1ddjhxpK0ITznvMTAIC3nWV54xpigolzImpIM";
const DEFAULT_SYSTEM_HOME = "https://bngss.lovable.app/dashboard/browser";
const AGENT_URL = "https://bngss.lovable.app/dashboard/monitor/agent";
const DEFAULT_LOGIN_URL = "https://bngss.lovable.app/auth";
const CONFIG_URL = `${SUPABASE_URL}/functions/v1/ext-config`;
const LOG_URL = `${SUPABASE_URL}/functions/v1/ext-log`;

// URL/domains ที่ถือว่า "ระบบโรงเรียน" — อนุญาตเข้าเสมอเพื่อให้ login ได้
const SCHOOL_HOST_SUFFIXES = ["lovable.app", "supabase.co", "supabase.io"];
function isSchoolUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "chrome-extension:" || u.protocol === "chrome:" || u.protocol === "about:" || u.protocol === "edge:") return true;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    return SCHOOL_HOST_SUFFIXES.some((s) => u.hostname === s || u.hostname.endsWith("." + s));
  } catch { return false; }
}

// เด้ง popup (chrome notification) — throttle 3 วิ กันรัวๆ
let _lastNotif = 0;
function notify(title, message) {
  const now = Date.now();
  if (now - _lastNotif < 3000) return;
  _lastNotif = now;
  try {
    chrome.notifications?.create?.({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon.png"),
      title: title || "Safe Browser",
      message: message || "",
      priority: 2,
    });
  } catch { /* ignore */ }
}


// -------------------------------------------------------------
// Auto-run Monitor Agent — เปิดหน้า /dashboard/monitor/agent แบบ pinned เบื้องหลัง
// เมื่อ extension detect ว่ามี session แล้ว และคอย re-open ถ้านักเรียนปิด
// (เพื่อให้ครูสั่ง lock/message/screenshot/screen-share/shutdown ได้เสมอ)
// -------------------------------------------------------------
let _ensuringAgent = false;

async function ensureAgentTab() {
  if (_ensuringAgent) return;
  _ensuringAgent = true;
  try {
    const { session } = await chrome.storage.local.get(["session"]);
    if (!session?.access_token) return; // ยังไม่ล็อกอิน
    const tabs = await chrome.tabs.query({});
    const existing = (tabs || []).filter((t) => (t.url || t.pendingUrl || "").startsWith(AGENT_URL));
    if (existing.length > 0) {
      // ปักหมุด + mute + ไม่ให้ active
      const keep = existing[0];
      for (let i = 1; i < existing.length; i++) {
        chrome.tabs.remove(existing[i].id).catch(() => {}); // ลบซ้ำ
      }
      chrome.tabs.update(keep.id, {
        pinned: true,
        muted: true,
        autoDiscardable: false,
      }).catch(() => {});
      return;
    }
    const tab = await chrome.tabs.create({ url: AGENT_URL, pinned: true, active: false });
    if (tab?.id) {
      chrome.tabs.update(tab.id, { muted: true, autoDiscardable: false }).catch(() => {});
    }
  } catch { /* ignore */ }
  finally { _ensuringAgent = false; }
}

// re-open ถ้านักเรียนปิด agent tab
chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  // เว้นตอน browser กำลังปิดทั้งหน้าต่าง
  if (info.isWindowClosing) return;
  const { session } = await chrome.storage.local.get(["session"]);
  if (!session?.access_token) return;
  // เช็คหลังจาก 500ms — ให้ tabs.query ได้ค่าล่าสุด
  setTimeout(() => { ensureAgentTab(); }, 500);
});

// กัน user กด "unpin" agent tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab?.url?.startsWith(AGENT_URL)) return;
  if (changeInfo.pinned === false) {
    chrome.tabs.update(tabId, { pinned: true }).catch(() => {});
  }
  if (changeInfo.mutedInfo && changeInfo.mutedInfo.muted === false) {
    chrome.tabs.update(tabId, { muted: true }).catch(() => {});
  }
});

// watchdog — เช็คทุก 1 นาทีว่ามี agent tab อยู่ (กันโดน crash/discard)
chrome.alarms?.create?.("agent-watchdog", { periodInMinutes: 1 });
chrome.alarms?.onAlarm.addListener((a) => {
  if (a.name === "agent-watchdog") ensureAgentTab();
});



async function getState() {
  const s = await chrome.storage.local.get(["session", "config", "configAt", "systemHome"]);
  return s;
}

async function getSystemHome() {
  const { systemHome } = await chrome.storage.local.get(["systemHome"]);
  return systemHome || DEFAULT_SYSTEM_HOME;
}

async function refreshConfig() {
  try {
    const r = await fetch(CONFIG_URL, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
    if (!r.ok) return;
    const cfg = await r.json();
    await chrome.storage.local.set({ config: cfg, configAt: Date.now() });
  } catch (e) { /* ignore */ }
}

function parseList(s) {
  return (s || "").split(/[\n,]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
}
function hostMatches(host, list) {
  host = (host || "").toLowerCase();
  for (const t of list) if (host === t || host.endsWith("." + t) || host.includes(t)) return t;
  return null;
}

// ---- Time rules ----
// รูปแบบ: [{ name, domains:[..], days:[0..6], start:"HH:MM", end:"HH:MM" }]
// day 0 = อาทิตย์ ... 6 = เสาร์  (JS Date.getDay())
function parseTimeRules(raw) {
  if (!raw) return [];
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function hhmmToMin(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  return (+m[1]) * 60 + (+m[2]);
}
function checkTimeRules(host, rules) {
  const now = new Date();
  const day = now.getDay();
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const r of rules) {
    if (!r || !Array.isArray(r.domains) || r.domains.length === 0) continue;
    if (Array.isArray(r.days) && r.days.length > 0 && !r.days.includes(day)) continue;
    const s = hhmmToMin(r.start);
    const e = hhmmToMin(r.end);
    if (s == null || e == null) continue;
    const inWindow = s <= e ? (cur >= s && cur < e) : (cur >= s || cur < e); // ข้ามเที่ยงคืน
    if (!inWindow) continue;
    const list = r.domains.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    const hit = hostMatches(host, list);
    if (hit) return { rule: r, hit };
  }
  return null;
}

async function logVisit(url, action, reason) {
  const { session } = await getState();
  if (!session?.access_token) return;
  try {
    await fetch(LOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ url, action, reason }),
    });
  } catch { /* ignore */ }
}

chrome.runtime.onInstalled.addListener(() => { refreshConfig(); ensureAgentTab(); });
chrome.runtime.onStartup.addListener(() => { refreshConfig(); ensureAgentTab(); });
setInterval(refreshConfig, 5 * 60 * 1000);

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!/^https?:/.test(url)) return;
  let host = "";
  try { host = new URL(url).hostname; } catch { return; }

  const { session, config } = await getState();

  // ===== AUTH GATE: ยังไม่ login → บังคับไปหน้าเข้าสู่ระบบ =====
  if (!session?.access_token && !isSchoolUrl(url)) {
    const loginUrl = (config?.browser_login_url && String(config.browser_login_url).trim()) || DEFAULT_LOGIN_URL;
    const reason = "ต้องเข้าสู่ระบบด้วยบัญชีของโรงเรียนก่อนจึงจะใช้งานอินเทอร์เน็ตได้";
    logVisit(url, "auth_required", "no session");
    notify("🔒 ต้องเข้าสู่ระบบก่อน", "เบราว์เซอร์นี้ใช้ได้เฉพาะนักเรียน/ครูของโรงเรียน กรุณาเข้าสู่ระบบก่อน");
    const blockedUrl = chrome.runtime.getURL("blocked.html") + `?u=${encodeURIComponent(url)}&r=${encodeURIComponent(reason)}&mode=login&next=${encodeURIComponent(loginUrl)}`;
    chrome.tabs.update(details.tabId, { url: blockedUrl });
    return;
  }

  const block = parseList(config?.browser_blocklist);
  const ads = parseList(config?.browser_ad_domains);
  const timeRules = parseTimeRules(config?.browser_time_rules);

  const adHit = hostMatches(host, ads);
  const blockHit = hostMatches(host, block);
  const timeHit = checkTimeRules(host, timeRules);

  if (adHit || blockHit || timeHit) {
    let reason;
    let action;
    if (adHit) {
      reason = `โฆษณา/แทร็กเกอร์: ${adHit}`;
      action = "ad_blocked";
    } else if (timeHit) {
      const r = timeHit.rule;
      reason = `⏰ ${r.name || "ห้ามใช้ช่วงเรียน"} — ${r.start}-${r.end} (${timeHit.hit})`;
      action = "time_blocked";
      notify("⏰ ถูกบล็อกช่วงเวลาเรียน", `${timeHit.hit} — ${r.name || "ห้ามใช้ช่วงเรียน"} (${r.start}-${r.end})`);
    } else {
      reason = config?.browser_block_message || `ถูกบล็อก: ${blockHit}`;
      action = "blocked";
    }
    logVisit(url, action, adHit || (timeHit && timeHit.hit) || blockHit);
    const blockedUrl = chrome.runtime.getURL("blocked.html") + `?u=${encodeURIComponent(url)}&r=${encodeURIComponent(reason)}${timeHit ? "&mode=time" : ""}`;
    chrome.tabs.update(details.tabId, { url: blockedUrl });
  }
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && /^https?:/.test(tab.url)) {
    logVisit(tab.url, "visit");
  }
});

// ------------------------------------------------------------------
// Wi-Fi bridge (Native Messaging → nmcli)
// ------------------------------------------------------------------
const WIFI_HOST = "com.bngss.wifi";
function wifiCall(payload) {
  return new Promise((resolve) => {
    try {
      const port = chrome.runtime.connectNative(WIFI_HOST);
      let done = false;
      const finish = (r) => { if (done) return; done = true; try { port.disconnect(); } catch {} resolve(r); };
      port.onMessage.addListener((m) => finish(m));
      port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError?.message || "helper not installed";
        finish({ ok: false, error: err });
      });
      port.postMessage(payload);
      setTimeout(() => finish({ ok: false, error: "timeout" }), 30000);
    } catch (e) {
      resolve({ ok: false, error: String(e?.message || e) });
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "WIFI") {
    const { type, ...rest } = msg;
    wifiCall(rest).then((r) => sendResponse(r));
    return true;
  }
  if (msg?.type === "SET_SESSION") {
    chrome.storage.local.set({
      session: msg.session,
      ...(msg.systemHome ? { systemHome: msg.systemHome } : {}),
    });
    // เมื่อล็อกอินสำเร็จ → เปิด agent tab อัตโนมัติ
    if (msg.session?.access_token) ensureAgentTab();
    sendResponse({ ok: true });
  } else if (msg?.type === "REFRESH_CONFIG") {
    refreshConfig().then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg?.type === "GO_HOME") {
    getSystemHome().then((url) => {
      if (sender.tab?.id) chrome.tabs.update(sender.tab.id, { url });
    });
    return true;
  } else if (msg?.type === "OPEN_HOME") {
    getSystemHome().then((url) => chrome.tabs.create({ url }));
    sendResponse({ ok: true });
    return true;
  } else if (msg?.type === "CLOSE_TAB") {
    if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
  } else if (msg?.type === "GET_STATE") {
    getState().then((s) => sendResponse(s));
    return true;
  } else if (msg?.type === "SB_OPEN_URL") {
    // ครูสั่งเปิดลิงก์ให้นักเรียน → เปิดแท็บใหม่ในเครื่องนักเรียน
    if (msg.url) chrome.tabs.create({ url: msg.url, active: true });
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_LOCK_ALL") {
    // ล็อกทุกแท็บ — inject overlay
    chrome.storage.local.set({ locked: true, lockMsg: msg.message || "ครูล็อกจอ" });
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (!t.id || !t.url || !/^https?:/.test(t.url)) continue;
        chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: (message) => {
            if (document.getElementById("__sb_lock")) return;
            const o = document.createElement("div");
            o.id = "__sb_lock";
            o.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.98);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;text-align:center;padding:2rem";
            o.innerHTML = `<div style="font-size:64px">🔒</div><h1 style="font-size:28px;margin:1rem 0">หน้าจอถูกล็อกโดยครู</h1><p style="opacity:.8">${message}</p>`;
            document.documentElement.appendChild(o);
          },
          args: [msg.message || "ครูล็อกจอ"],
        }).catch(() => {});
      }
    });
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_UNLOCK_ALL") {
    chrome.storage.local.set({ locked: false });
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (!t.id) continue;
        chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: () => { document.getElementById("__sb_lock")?.remove(); },
        }).catch(() => {});
      }
    });
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_SCREENSHOT") {
    // แคปหน้าจอแท็บปัจจุบันแล้วดาวน์โหลด
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (!dataUrl) { sendResponse({ ok: false }); return; }
      chrome.downloads?.download({
        url: dataUrl,
        filename: `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
        saveAs: false,
      }).catch(() => {});
      sendResponse({ ok: true, dataUrl });
    });
    return true;
  }
});

// Enforce lock across new/updated tabs
chrome.tabs.onUpdated.addListener(async (tabId, ci) => {
  if (ci.status !== "loading" && ci.status !== "complete") return;
  const { locked, lockMsg } = await chrome.storage.local.get(["locked", "lockMsg"]);
  if (!locked) return;
  chrome.scripting.executeScript({
    target: { tabId },
    func: (message) => {
      if (document.getElementById("__sb_lock")) return;
      const o = document.createElement("div");
      o.id = "__sb_lock";
      o.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.98);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;text-align:center;padding:2rem";
      o.innerHTML = `<div style="font-size:64px">🔒</div><h1 style="font-size:28px;margin:1rem 0">หน้าจอถูกล็อก</h1><p style="opacity:.8">${message}</p>`;
      document.documentElement.appendChild(o);
    },
    args: [lockMsg || "ครูล็อกจอ"],
  }).catch(() => {});
});
