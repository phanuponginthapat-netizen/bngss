// Safe Browser — background service worker
importScripts("trust.js", "keywords.js");
// backend ถูกกำหนดตอน runtime (ระบบเว็บส่งมาให้ผ่าน SET_SESSION) — ค่าด้านล่างเป็นค่าเริ่มต้นเท่านั้น
const DEFAULT_SUPABASE_URL = "https://dlkyxvhnnffblerwedjz.supabase.co";
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa3l4dmhubmZmYmxlcndlZGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjY5MTIsImV4cCI6MjA5OTk0MjkxMn0.bQqqX3veJ_pGr9fSa0a-bKIS-w7UmR569a2xDZQ6Cx4";
let SUPABASE_URL = DEFAULT_SUPABASE_URL;
let ANON_KEY = DEFAULT_ANON_KEY;

async function loadBackend() {
  try {
    const { backend } = await chrome.storage.local.get(["backend"]);
    if (backend?.url !== DEFAULT_SUPABASE_URL || backend?.anonKey !== DEFAULT_ANON_KEY) {
      await chrome.storage.local.set({ backend: { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_ANON_KEY } });
    }
  } catch {}
  return { SUPABASE_URL, ANON_KEY };
}
const fnUrl = (name) => `${SUPABASE_URL}/functions/v1/${name}`;
chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
loadBackend();

// ---- App (school system) origin — ปรับตาม deploy ได้ (lovable.app / vercel.app / โดเมนโรงเรียน)
const DEFAULT_APP_ORIGIN = "https://bngss.online";
let APP_ORIGIN = DEFAULT_APP_ORIGIN;
let DEFAULT_SYSTEM_HOME = `${APP_ORIGIN}/dashboard/browser`;
let AGENT_URL = `${APP_ORIGIN}/dashboard/monitor/agent`;
let DEFAULT_LOGIN_URL = `${APP_ORIGIN}/login`;

function setAppOrigin(origin) {
  try {
    if (!self.sbTrustedSchoolUrl(origin)) return;
    const o = new URL(origin).origin;
    if (!o || o === APP_ORIGIN) return;
    APP_ORIGIN = o;
    DEFAULT_SYSTEM_HOME = `${o}/dashboard/browser`;
    AGENT_URL = `${o}/dashboard/monitor/agent`;
    DEFAULT_LOGIN_URL = `${o}/login`;
  } catch { /* ignore */ }
}

async function loadAppOrigin() {
  try {
    const { systemHome } = await chrome.storage.local.get(["systemHome"]);
    if (systemHome) setAppOrigin(systemHome);
  } catch { /* ignore */ }
}
loadAppOrigin();

// URL/domains ที่ถือว่า "ระบบโรงเรียน" — อนุญาตเข้าเสมอเพื่อให้ login ได้
// หมายเหตุ: ไม่อนุญาต *.vercel.app / *.lovable.app ทั้งหมด (เป็นช่องโหว่) — เฉพาะโดเมนระบบเท่านั้น
function isSchoolUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "chrome-extension:" || u.protocol === "chrome:" || u.protocol === "about:" || u.protocol === "edge:") return true;
    return self.sbTrustedSchoolUrl(url) || u.origin === DEFAULT_SUPABASE_URL;
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
let _lastAgentSpawn = 0;
let _agentSpawnFails = 0;

// เปิดเฉพาะ role นักเรียนเท่านั้น — บุคลากร/ครู ใช้ extension แบบบันทึก log ปกติ
function isStudentSession(session) {
  const r = session?.role;
  return r === "student";
}

async function ensureAgentTab() {
  if (_ensuringAgent) return;
  _ensuringAgent = true;
  try {
    const { session, agentTabId } = await chrome.storage.local.get(["session", "agentTabId"]);
    if (!session?.access_token) return; // ยังไม่ล็อกอิน
    if (!isStudentSession(session)) return; // บุคลากร — ไม่ต้องเปิด agent
    if (_agentSpawnFails >= 3) return; // กันวนเปิดแท็บไม่หยุด

    if (agentTabId) {
      const t = await chrome.tabs.get(agentTabId).catch(() => null);
      if (t) {
        const u = t.url || t.pendingUrl || "";
        // ถ้าโดน redirect ออกจาก agent (เช่นหน้า login) = ล็อกเอาต์แล้ว → หยุดวนเปิด
        if (u && !u.startsWith(AGENT_URL)) {
          if (/\/(login|auth)\b/.test(u)) {
            await chrome.storage.local.remove(["session", "agentTabId"]);
            return;
          }
        } else {
          chrome.tabs.update(t.id, { pinned: true, muted: true, autoDiscardable: false }).catch(() => {});
          return;
        }
      }
    }

    const tabs = await chrome.tabs.query({});
    const existing = (tabs || []).filter((t) => (t.url || t.pendingUrl || "").startsWith(AGENT_URL));
    if (existing.length > 0) {
      const keep = existing[0];
      for (let i = 1; i < existing.length; i++) chrome.tabs.remove(existing[i].id).catch(() => {});
      await chrome.storage.local.set({ agentTabId: keep.id });
      chrome.tabs.update(keep.id, { pinned: true, muted: true, autoDiscardable: false }).catch(() => {});
      return;
    }

    // rate limit: เปิดใหม่ได้ไม่เกิน 1 ครั้ง/นาที
    if (Date.now() - _lastAgentSpawn < 60000) return;
    _lastAgentSpawn = Date.now();
    _agentSpawnFails++;
    const tab = await chrome.tabs.create({ url: AGENT_URL, pinned: true, active: false });
    if (tab?.id) {
      await chrome.storage.local.set({ agentTabId: tab.id });
      chrome.tabs.update(tab.id, { muted: true, autoDiscardable: false }).catch(() => {});
    }
  } catch { /* ignore */ }
  finally { _ensuringAgent = false; }
}

// re-open ถ้านักเรียนปิด agent tab
chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  if (info.isWindowClosing) return;
  const { session, agentTabId } = await chrome.storage.local.get(["session", "agentTabId"]);
  if (agentTabId === tabId) await chrome.storage.local.remove(["agentTabId"]);
  if (!session?.access_token || !isStudentSession(session)) return;
  setTimeout(() => { ensureAgentTab(); }, 1500);
});

// กัน user กด "unpin" agent tab + จับกรณีโดนเด้งไปหน้า login
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = tab?.url || "";
  const { agentTabId } = await chrome.storage.local.get(["agentTabId"]);
  if (agentTabId === tabId && url && !url.startsWith(AGENT_URL) && /\/(login|auth)\b/.test(url)) {
    // ล็อกเอาต์ → เคลียร์ session แล้วปิดแท็บ agent กันวนซ้ำ
    await chrome.storage.local.remove(["session", "agentTabId"]);
    chrome.tabs.remove(tabId).catch(() => {});
    return;
  }
  if (!url.startsWith(AGENT_URL)) return;
  _agentSpawnFails = 0;
  if (changeInfo.pinned === false) chrome.tabs.update(tabId, { pinned: true }).catch(() => {});
  if (changeInfo.mutedInfo && changeInfo.mutedInfo.muted === false) {
    chrome.tabs.update(tabId, { muted: true }).catch(() => {});
  }
});

// watchdog — เช็คทุก 2 นาทีว่ามี agent tab อยู่ (กันโดน crash/discard)
chrome.alarms?.create?.("agent-watchdog", { periodInMinutes: 2 });
chrome.alarms?.onAlarm.addListener(async (a) => {
  if (a.name === "agent-watchdog") ensureAgentTab();
  if (a.name === "policy-sweep") {
    await refreshConfig();          // ดึง rule ล่าสุดก่อนกวาด
    await getValidSession({ force: true }); // เช็ค logout/หมดอายุ
    await sweepTabs();
  }
});





async function getState() {
  const s = await chrome.storage.local.get(["session", "config", "configAt", "configError", "systemHome", "logError"]);
  return { ...s, session: s.session ? { user: s.session.user, role: s.session.role, connected: !!s.session.access_token } : null };
}

async function getConfig() {
  const { config, configAt } = await chrome.storage.local.get(["config", "configAt"]);
  if (!config || !configAt || Date.now() - configAt > 5 * 60 * 1000) {
    await refreshConfig();
    const s = await chrome.storage.local.get(["config"]);
    return s.config || config || {};
  }
  return config;
}

// -------------------------------------------------------------
// Session validity — กัน "login ค้าง" หลัง logout จากระบบ
//  1) หมดอายุตาม expires_at → พยายาม refresh, ถ้าไม่ได้ = เคลียร์
//  2) ตรวจกับ backend (/auth/v1/user) ทุก 60 วินาที → ถ้า 401 = ถูก logout แล้ว
// -------------------------------------------------------------
let _lastRemoteCheck = 0;
let _remoteOk = true;

async function clearSession(reason) {
  try {
    const { agentTabId } = await chrome.storage.local.get(["agentTabId"]);
    if (agentTabId) chrome.tabs.remove(agentTabId).catch(() => {});
  } catch {}
  await chrome.storage.local.remove(["session", "agentTabId", "config", "configAt"]);
  await chrome.storage.local.set({ locked: false, lockMsg: "" });
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) if (tab.id) chrome.scripting?.executeScript({ target: { tabId: tab.id }, func: () => document.getElementById("__sb_lock")?.remove() }).catch(() => {});
  _remoteOk = true;
  _lastRemoteCheck = 0;
  if (reason) notify("🔒 ออกจากระบบแล้ว", "กรุณาเข้าสู่ระบบใหม่เพื่อใช้งานอินเทอร์เน็ต");
}

async function tryRefreshSession(session) {
  if (!session?.refresh_token) return null;
  try {
    await loadBackend();
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.access_token) return null;
    const next = {
      ...session,
      access_token: j.access_token,
      refresh_token: j.refresh_token || session.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    };
    await chrome.storage.local.set({ session: next });
    return next;
  } catch { return null; }
}

async function verifyRemote(session) {
  try {
    await loadBackend();
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    });
    if (r.status === 401 || r.status === 403) return false;
    return true; // network error / 5xx → ไม่ตัดสิทธิ์
  } catch { return true; }
}

async function getValidSession({ force = false } = {}) {
  const { session } = await chrome.storage.local.get(["session"]);
  if (!session?.access_token) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  let cur = session;
  if (cur.expires_at && cur.expires_at <= nowSec + 30) {
    cur = await tryRefreshSession(cur);
    if (!cur) { await clearSession("expired"); return null; }
  }

  if (force || Date.now() - _lastRemoteCheck > 60 * 1000) {
    _lastRemoteCheck = Date.now();
    _remoteOk = await verifyRemote(cur);
    if (!_remoteOk) { await clearSession("revoked"); return null; }
  } else if (!_remoteOk) {
    return null;
  }
  return cur;
}


async function getSystemHome() {
  const { systemHome } = await chrome.storage.local.get(["systemHome"]);
  return self.sbTrustedSchoolUrl(systemHome) ? systemHome : DEFAULT_SYSTEM_HOME;
}

let _configRequest = null;
async function refreshConfig() {
  if (_configRequest) return _configRequest;
  _configRequest = (async () => { try {
    await loadBackend();
    const { session } = await chrome.storage.local.get(["session"]);
    const r = await fetch(fnUrl("ext-config"), { headers: { apikey: ANON_KEY, Authorization: `Bearer ${session?.access_token || ANON_KEY}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`อ่านนโยบายไม่สำเร็จ (${r.status})`);
    const cfg = await r.json();
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg) || cfg.error) throw new Error("นโยบายไม่ถูกต้อง");
    await chrome.storage.local.set({ config: cfg, configAt: Date.now(), configError: null });
    return { ok: true };
  } catch (e) {
    const error = String(e?.message || e);
    await chrome.storage.local.set({ configError: error });
    return { ok: false, error };
  } finally { _configRequest = null; } })();
  return _configRequest;
}

function parseList(s) {
  return String(s || "").split(/[\n,]+/).map(x => x.trim().toLowerCase().replace(/^\*\./, "")).filter(Boolean);
}
function hostMatches(host, list) {
  host = (host || "").toLowerCase();
  for (const t of list) if (host === t || host.endsWith("." + t)) return t;
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
  if (+m[1] > 23 || +m[2] > 59) return null;
  return (+m[1]) * 60 + (+m[2]);
}
function checkTimeRules(host, rules) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = (type) => parts.find(p => p.type === type)?.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday"));
  const cur = Number(value("hour")) * 60 + Number(value("minute"));
  for (const r of rules) {
    if (!r || !Array.isArray(r.domains) || r.domains.length === 0) continue;
    const s = hhmmToMin(r.start);
    const e = hhmmToMin(r.end);
    if (s == null || e == null) continue;
    const ruleDay = s > e && cur < e ? (day + 6) % 7 : day;
    if (Array.isArray(r.days) && r.days.length > 0 && !r.days.includes(ruleDay)) continue;
    const inWindow = s <= e ? (cur >= s && cur < e) : (cur >= s || cur < e); // ข้ามเที่ยงคืน
    if (!inWindow) continue;
    const list = r.domains.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    const hit = hostMatches(host, list);
    if (hit) return { rule: r, hit };
  }
  return null;
}

const recentLogs = new Map();
async function logVisit(url, action, reason) {
  const { session } = await chrome.storage.local.get(["session"]);
  if (!session?.access_token) return;
  try {
    await loadBackend();
    const safeUrl = new URL(url);
    if (!/^https?:$/.test(safeUrl.protocol) || isSchoolUrl(url)) return;
    safeUrl.username = ""; safeUrl.password = ""; safeUrl.hash = "";
    for (const key of [...safeUrl.searchParams.keys()]) if (/token|password|secret|code|key/i.test(key)) safeUrl.searchParams.delete(key);
    const dedup = `${session.user?.id}:${action}:${safeUrl.href}`;
    if (Date.now() - (recentLogs.get(dedup) || 0) < 2000) return;
    recentLogs.set(dedup, Date.now());
    if (recentLogs.size > 1000) recentLogs.delete(recentLogs.keys().next().value);
    const response = await fetch(fnUrl("ext-log"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ url: safeUrl.href, action, reason }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`บันทึกประวัติไม่สำเร็จ (${response.status})`);
    await chrome.storage.local.set({ logError: null });
  } catch (e) { await chrome.storage.local.set({ logError: String(e?.message || e) }); }
}

chrome.runtime.onInstalled.addListener(() => { refreshConfig(); ensureAgentTab(); });
chrome.runtime.onStartup.addListener(() => { refreshConfig(); ensureAgentTab(); });
chrome.alarms?.create?.("config-refresh", { periodInMinutes: 5 });
chrome.alarms?.onAlarm.addListener(a => { if (a.name === "config-refresh") refreshConfig(); });

// -------------------------------------------------------------
// Enforcement — ใช้ร่วมกันทั้ง onBeforeNavigate / onCommitted / SPA / sweep
// -------------------------------------------------------------
function categoryLabel(cat) {
  try { return self.SB_KEYWORD_CATEGORIES?.[cat]?.label || (cat === "custom" ? "คำที่โรงเรียนกำหนด" : cat); }
  catch { return cat; }
}

function isBlockedPage(url) {
  return typeof url === "string" && url.startsWith(chrome.runtime.getURL("blocked.html"));
}

async function enforceUrl(tabId, url) {
  if (!/^https?:/.test(url || "")) return false;
  let host = "";
  try { host = new URL(url).hostname; } catch { return false; }
  await loadAppOrigin();
  if (isSchoolUrl(url)) return false;

  const config = await getConfig();
  const session = await getValidSession();

  // ===== AUTH GATE: ยังไม่ login (หรือ session หมดอายุ/ถูก logout) → บังคับไปหน้าเข้าสู่ระบบ =====
  if (!session?.access_token) {
    if (isSchoolUrl(url)) return false;
    const loginUrl = self.sbTrustedSchoolUrl(config?.browser_login_url) ? config.browser_login_url : DEFAULT_LOGIN_URL;
    const reason = "ต้องเข้าสู่ระบบด้วยบัญชีของโรงเรียนก่อนจึงจะใช้งานอินเทอร์เน็ตได้";
    logVisit(url, "auth_required", "no session");
    notify("🔒 ต้องเข้าสู่ระบบก่อน", "เบราว์เซอร์นี้ใช้ได้เฉพาะนักเรียน/ครูของโรงเรียน กรุณาเข้าสู่ระบบก่อน");
    const blockedUrl = chrome.runtime.getURL("blocked.html") + `?u=${encodeURIComponent(url)}&r=${encodeURIComponent(reason)}&mode=login&next=${encodeURIComponent(loginUrl)}`;
    chrome.tabs.update(tabId, { url: blockedUrl }).catch(() => {});
    return true;
  }

  const block = parseList(config?.browser_blocklist);
  const ads = parseList(config?.browser_ad_domains);
  const timeRules = parseTimeRules(config?.browser_time_rules);

  const adHit = hostMatches(host, ads);
  const blockHit = hostMatches(host, block);
  const timeHit = checkTimeRules(host, timeRules);

  // ---- Keyword filter: ตรวจคำต้องห้ามใน URL (โดเมน + path + query + คำค้นหา) ----
  let kwHit = null;
  try {
    if (self.sbBuildKeywordList) {
      const list = self.sbBuildKeywordList(config);
      let hay = url;
      try { hay = decodeURIComponent(url); } catch { /* ignore */ }
      kwHit = self.sbMatchKeywords(hay.replace(/[+_\-]/g, " "), list);
    }
  } catch { /* ignore */ }

  if (!(adHit || blockHit || timeHit || kwHit)) return false;

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
  } else if (kwHit) {
    reason = `🚫 พบคำต้องห้าม "${kwHit.w}" (${categoryLabel(kwHit.cat)}) — ${config?.browser_block_message || "เว็บไซต์นี้ไม่อนุญาตตามนโยบายของโรงเรียน"}`;
    action = "keyword_blocked";
    notify("🚫 ถูกบล็อกด้วยตัวกรองคำ", `พบคำต้องห้าม: ${kwHit.w} (${categoryLabel(kwHit.cat)})`);
  } else {
    reason = config?.browser_block_message || `ถูกบล็อก: ${blockHit}`;
    action = "blocked";
  }
  logVisit(url, action, adHit || (timeHit && timeHit.hit) || blockHit || (kwHit && kwHit.w));
  const blockedUrl = chrome.runtime.getURL("blocked.html") + `?u=${encodeURIComponent(url)}&r=${encodeURIComponent(reason)}${timeHit ? "&mode=time" : ""}`;
  chrome.tabs.update(tabId, { url: blockedUrl }).catch(() => {});
  return true;
}

chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId !== 0) return;
  enforceUrl(d.tabId, d.url);
});
chrome.webNavigation.onCommitted?.addListener((d) => {
  if (d.frameId !== 0) return;
  enforceUrl(d.tabId, d.url);
});
// SPA / pushState navigation (เช่น youtube, facebook) — ต้องตรวจซ้ำ
chrome.webNavigation.onHistoryStateUpdated?.addListener((d) => {
  if (d.frameId !== 0) return;
  enforceUrl(d.tabId, d.url);
});

// Sweep — ตรวจทุกแท็บที่เปิดอยู่ทุก 1 นาที
// ครอบคลุม: เวลาเข้าเงื่อนไข time rule ระหว่างที่เปิดค้างไว้, admin เพิ่ม blocklist ใหม่, session หมดอายุ/logout
async function sweepTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      const u = t.url || t.pendingUrl || "";
      if (!t.id || !/^https?:/.test(u)) continue;
      if (isBlockedPage(u)) continue;
      await enforceUrl(t.id, u);
    }
  } catch { /* ignore */ }
}
chrome.alarms?.create?.("policy-sweep", { periodInMinutes: 1 });



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
      setTimeout(() => finish({ ok: false, error: "timeout" }), 75000);
    } catch (e) {
      resolve({ ok: false, error: String(e?.message || e) });
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const source = sender.url || sender.tab?.url || "";
  const school = self.sbTrustedSchoolUrl(source);
  const internal = source.startsWith(chrome.runtime.getURL("")) && !sender.tab;
  const agent = school && new URL(source).pathname === "/dashboard/monitor/agent";
  if ((["SET_SESSION", "CLEAR_SESSION", "GET_BACKEND"].includes(msg?.type) && !school) ||
      (["SB_OPEN_URL", "SB_LOCK_ALL", "SB_UNLOCK_ALL"].includes(msg?.type) && !agent) ||
      (msg?.type === "WIFI" && source !== chrome.runtime.getURL("wifi.html"))) {
    sendResponse({ ok: false, error: "ไม่อนุญาตคำสั่งจากหน้านี้" }); return false;
  }
  if (msg?.type === "GET_BACKEND") {
    sendResponse({ url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_ANON_KEY }); return false;
  }
  if (msg?.type === "WIFI") {
    const { type, ...rest } = msg;
    wifiCall(rest).then((r) => sendResponse(r));
    return true;
  }
  if (msg?.type === "KEYWORD_HIT") {
    const tabId = sender.tab?.id;
    if (tabId && msg.url === source && !isSchoolUrl(source) && !isBlockedPage(msg.url)) {
      getConfig().then((cfg) => {
        const base = cfg?.browser_block_message || "เว็บไซต์นี้ไม่อนุญาตตามนโยบายของโรงเรียน";
        const reason = `🚫 พบคำต้องห้าม "${msg.word}" (${categoryLabel(msg.category)}) ใน${msg.where || "หน้าเว็บ"} — ${base}`;
        logVisit(msg.url, "keyword_blocked", msg.word);
        notify("🚫 ถูกบล็อกด้วยตัวกรองคำ", `พบคำต้องห้าม: ${msg.word} (${categoryLabel(msg.category)})`);
        const blockedUrl = chrome.runtime.getURL("blocked.html") + `?u=${encodeURIComponent(msg.url)}&r=${encodeURIComponent(reason)}`;
        chrome.tabs.update(tabId, { url: blockedUrl }).catch(() => {});
      });
    }
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "SET_SESSION") {
    _agentSpawnFails = 0;
    _remoteOk = true;
    _lastRemoteCheck = 0;
    if (msg.systemHome) setAppOrigin(msg.systemHome);
    (async () => { await chrome.storage.local.set({
      session: msg.session,
      ...(msg.systemHome ? { systemHome: msg.systemHome } : {}),
    });
    // เมื่อล็อกอินสำเร็จ → เปิด agent tab อัตโนมัติ (เฉพาะนักเรียน)
    await chrome.storage.local.remove(["config", "configAt"]);
    await refreshConfig();
    if (msg.session?.access_token) await ensureAgentTab();
    sendResponse({ ok: true }); })().catch(() => sendResponse({ ok: false }));
    return true;
  } else if (msg?.type === "CLEAR_SESSION") {
    clearSession().then(() => sweepTabs());
    sendResponse({ ok: true });


  } else if (msg?.type === "REFRESH_CONFIG") {
    refreshConfig().then(sendResponse);
    return true;
  } else if (msg?.type === "GO_HOME") {
    getSystemHome().then((url) => {
      if (sender.tab?.id) chrome.tabs.update(sender.tab.id, { url });
      sendResponse({ ok: true });
    });
    return true;
  } else if (msg?.type === "OPEN_HOME") {
    getSystemHome().then((url) => chrome.tabs.create({ url }));
    sendResponse({ ok: true });
    return true;
  } else if (msg?.type === "CLOSE_TAB") {
    if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
    sendResponse({ ok: true });
  } else if (msg?.type === "GET_STATE") {
    getState().then((s) => sendResponse(s));
    return true;
  } else if (msg?.type === "SB_OPEN_URL") {
    // ครูสั่งเปิดลิงก์ให้นักเรียน → เปิดแท็บใหม่ในเครื่องนักเรียน
    if (!/^https?:\/\//i.test(msg.url || "")) { sendResponse({ ok: false }); return false; }
    chrome.tabs.create({ url: msg.url, active: true });
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_LOCK_ALL") {
    // ล็อกทุกแท็บ — inject overlay
    chrome.storage.local.set({ locked: true, lockMsg: msg.message || "ครูล็อกจอ" });
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (!t.id || !t.url || !/^https?:/.test(t.url) || (self.sbTrustedSchoolUrl(t.url) && new URL(t.url).pathname === "/dashboard/monitor/agent")) continue;
        chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: (message) => {
            if (document.getElementById("__sb_lock")) return;
            const o = document.createElement("div");
            o.id = "__sb_lock";
            o.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.98);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;text-align:center;padding:2rem";
            o.textContent = `🔒 หน้าจอถูกล็อกโดยครู — ${message}`;
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
    if (!internal && !sender.tab?.active) { sendResponse({ ok: false, error: "เลือกแท็บนี้ก่อนจับภาพ" }); return false; }
    // แคปหน้าจอแท็บปัจจุบันแล้วดาวน์โหลด
    chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: "png" }, (dataUrl) => {
      const error = chrome.runtime.lastError;
      if (error || !dataUrl) { sendResponse({ ok: false, error: error?.message || "จับภาพไม่สำเร็จ" }); return; }
      chrome.downloads?.download({
        url: dataUrl,
        filename: `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
        saveAs: false,
      }).catch(() => {});
      sendResponse({ ok: true });
    });
    return true;
  }
});

// Enforce lock across new/updated tabs
chrome.tabs.onUpdated.addListener(async (tabId, ci) => {
  if (ci.status !== "loading" && ci.status !== "complete") return;
  const { locked, lockMsg } = await chrome.storage.local.get(["locked", "lockMsg"]);
  if (!locked) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.url || (self.sbTrustedSchoolUrl(tab.url) && new URL(tab.url).pathname === "/dashboard/monitor/agent")) return;
  chrome.scripting.executeScript({
    target: { tabId },
    func: (message) => {
      if (document.getElementById("__sb_lock")) return;
      const o = document.createElement("div");
      o.id = "__sb_lock";
      o.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.98);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;text-align:center;padding:2rem";
      o.textContent = `🔒 หน้าจอถูกล็อก — ${message}`;
      document.documentElement.appendChild(o);
    },
    args: [lockMsg || "ครูล็อกจอ"],
  }).catch(() => {});
});
