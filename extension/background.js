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
      iconUrl: _brandIconData || chrome.runtime.getURL("icon.png"),
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
    await loadAppOrigin();
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
  const s = await chrome.storage.local.get(["session", "config", "configAt", "configError", "systemHome", "logError", "sessionError"]);
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
let _refreshRequest = null;

async function clearSession(reason) {
  try {
    const { agentTabId } = await chrome.storage.local.get(["agentTabId"]);
    if (agentTabId) chrome.tabs.remove(agentTabId).catch(() => {});
  } catch {}
  await chrome.storage.local.remove(["session", "agentTabId", "config", "configAt", "sessionError"]);
  await chrome.storage.local.set({ locked: false, lockMsg: "" });
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) if (tab.id) chrome.scripting?.executeScript({ target: { tabId: tab.id }, func: () => document.getElementById("__sb_lock")?.remove() }).catch(() => {});
  _remoteOk = true;
  _lastRemoteCheck = 0;
  if (reason) notify("🔒 ออกจากระบบแล้ว", "กรุณาเข้าสู่ระบบใหม่เพื่อใช้งานอินเทอร์เน็ต");
}

async function tryRefreshSession(session) {
  if (!session?.refresh_token) return null;
  if (_refreshRequest) return _refreshRequest;
  _refreshRequest = (async () => { try {
    await loadBackend();
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        const { session: current } = await chrome.storage.local.get(["session"]);
        if (current?.access_token === session.access_token) await clearSession("revoked");
      } else await chrome.storage.local.set({ sessionError: "เชื่อมต่อบัญชีไม่ได้ กรุณาลองใหม่" });
      return null;
    }
    const j = await r.json();
    if (!j?.access_token) return null;
    const next = {
      ...session,
      access_token: j.access_token,
      refresh_token: j.refresh_token || session.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    };
    const { session: current } = await chrome.storage.local.get(["session"]);
    if (current?.access_token !== session.access_token) return current?.access_token ? current : null;
    await chrome.storage.local.set({ session: next, sessionError: null });
    return next;
  } catch {
    await chrome.storage.local.set({ sessionError: "เชื่อมต่อบัญชีไม่ได้ กรุณาลองใหม่" });
    return null;
  } finally { _refreshRequest = null; } })();
  return _refreshRequest;
}

async function verifyRemote(session) {
  try {
    await loadBackend();
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` },
      signal: AbortSignal.timeout(15000),
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
    if (!cur) return null; // Temporary failures retain credentials for a later retry.
  }

  if (force || Date.now() - _lastRemoteCheck > 60 * 1000) {
    _lastRemoteCheck = Date.now();
    _remoteOk = await verifyRemote(cur);
    if (!_remoteOk) {
      cur = await tryRefreshSession(cur);
      if (!cur) return null;
      _remoteOk = await verifyRemote(cur);
      if (!_remoteOk) { await clearSession("revoked"); return null; }
    }
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
    const session = await getValidSession();
    const { session: stored } = await chrome.storage.local.get(["session"]);
    if (stored?.access_token && !session) throw new Error("เชื่อมต่อบัญชีไม่ได้ กรุณาลองใหม่");
    const r = await fetch(fnUrl("ext-config"), { headers: { apikey: ANON_KEY, ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, signal: AbortSignal.timeout(15000) });
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
  const session = await getValidSession();
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
    if (!response.ok) {
      recentLogs.delete(dedup);
      throw new Error(`บันทึกประวัติไม่สำเร็จ (${response.status})`);
    }
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
  let blockHit = hostMatches(host, block);
  if (!blockHit && config?.browser_auto_blocklist !== false && config?.browser_auto_blocklist !== "0" && !isSchoolUrl(url)) {
    try { const a = await autoBlockHit(host); if (a) blockHit = `${a.domain} (${a.cat === "gambling" ? "เว็บพนัน" : "เนื้อหาไม่เหมาะสม"})`; } catch { /* ignore */ }
  }
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
      const timer = setTimeout(() => finish({ ok: false, error: "timeout" }), 75000);
      port.onDisconnect.addListener(() => clearTimeout(timer));
    } catch (e) {
      resolve({ ok: false, error: String(e?.message || e) });
    }
  });
}

// ── BNG Safe Browser for Windows: local launcher bridge (127.0.0.1 only) ──
const KIOSK_LAUNCHER = "http://127.0.0.1:47831";
async function kioskLauncher(path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), body ? 20000 : 1500);
  try {
    const r = await fetch(KIOSK_LAUNCHER + path, {
      method: body ? "POST" : "GET", signal: ctrl.signal,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...data } : { ok: false, ...data, error: data.error || `HTTP ${r.status}` };
  } catch { return { ok: false, error: "ไม่พบโปรแกรม BNG Safe Browser ในเครื่องนี้" }; }
  finally { clearTimeout(t); }
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "KIOSK_STATUS") { kioskLauncher("/status?v=" + encodeURIComponent(chrome.runtime.getManifest().version)).then(sendResponse); return true; }
  if (msg?.type === "KIOSK_OPEN_CONTROL") {
    // The staff-card control page is served by the launcher itself (127.0.0.1 only),
    // so it also works on machines where the extension control page cannot be reached.
    chrome.tabs.create({ url: KIOSK_LAUNCHER + "/exit" }).catch(() => {});
    sendResponse({ ok: true }); return false;
  }
  return false;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const source = sender.url || sender.tab?.url || "";
  const school = self.sbTrustedSchoolUrl(source);
  const internal = source.startsWith(chrome.runtime.getURL("")) && !sender.tab;
  const agent = school && new URL(source).pathname === "/dashboard/monitor/agent";
  if ((["SET_SESSION", "CLEAR_SESSION", "GET_BACKEND"].includes(msg?.type) && !school) ||
      (["SB_OPEN_URL", "SB_LOCK_ALL", "SB_UNLOCK_ALL", "SB_MESSAGE", "SB_CAPTURE_TAB", "SB_POWER"].includes(msg?.type) && !agent) ||
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
      getConfig().then(async (cfg) => {
        if (String(cfg.browser_keyword_scan_page ?? "1") === "0") return;
        const list = self.sbBuildKeywordList(cfg);
        if (!list.words.some(k => k.w === msg.word && k.cat === msg.category)) return;
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (tab?.url !== msg.url) return; // Do not redirect a newer navigation using an old scan.
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
      sessionError: null,
      ...(msg.systemHome ? { systemHome: msg.systemHome } : {}),
    });
    // เมื่อล็อกอินสำเร็จ → เปิด agent tab อัตโนมัติ (เฉพาะนักเรียน)
    await chrome.storage.local.remove(["config", "configAt"]);
    await refreshConfig();
    if (msg.session?.access_token) await ensureAgentTab();
    sendResponse({ ok: true }); })().catch(() => sendResponse({ ok: false }));
    return true;
  } else if (msg?.type === "CLEAR_SESSION") {
    clearSession().then(() => sweepTabs()).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;


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
  } else if (msg?.type === "SB_USER_OPEN") {
    // ผู้ใช้กดเปิดเว็บเองจากหน้าระบบโรงเรียน → เปิดแท็บใหม่ (ผ่าน filter/log ตามปกติ)
    if (!school || !/^https?:\/\//i.test(msg.url || "")) { sendResponse({ ok: false }); return false; }
    chrome.tabs.create({ url: msg.url, active: true });
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_OPEN_URL") {
    // ครูสั่งเปิดลิงก์ให้นักเรียน → เปิดแท็บใหม่ในเครื่องนักเรียน
    if (!/^https?:\/\//i.test(msg.url || "")) { sendResponse({ ok: false }); return false; }
    chrome.tabs.create({ url: msg.url, active: true });
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_LOCK_ALL") {
    // ล็อกทุกแท็บ — จอดำสนิท ข้อความใหญ่ ปิดเสียงทุกแท็บ
    chrome.storage.local.set({ locked: true, lockMsg: msg.message || "ครูล็อกจอ" }).then(() => applyLockAll());
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_UNLOCK_ALL") {
    chrome.storage.local.set({ locked: false });
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (!t.id) continue;
        if (!isAgentTabUrl(t.url)) chrome.tabs.update(t.id, { muted: false }).catch(() => {});
        chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: () => { document.getElementById("__sb_lock")?.remove(); },
        }).catch(() => {});
      }
    });
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_LIST_DOWNLOADS") {
    chrome.downloads.search({ state: "complete", exists: true, orderBy: ["-startTime"], limit: 30 }, (items) => {
      sendResponse({ ok: true, items: (items || []).map((d) => ({ id: d.id, filename: d.filename, fileSize: d.fileSize, startTime: d.startTime, mime: d.mime })) });
    });
    return true;
  } else if (msg?.type === "SB_OPEN_DOWNLOAD") {
    openDownloadedFile(Number(msg.id)).then(sendResponse);
    return true;
  } else if (msg?.type === "SB_OPEN_HOMEWORK") {
    getSystemHome().then((home) => chrome.tabs.create({ url: new URL("/dashboard/homework", home).toString(), active: true }));
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_MESSAGE") {
    // ครูส่งข้อความ → แสดงบนแท็บที่นักเรียนกำลังดูอยู่
    showTeacherMessage(String(msg.message || "").slice(0, 500));
    sendResponse({ ok: true });
  } else if (msg?.type === "SB_SCREENSHOT") {
    if (!internal && !sender.tab?.active) { sendResponse({ ok: false, error: "เลือกแท็บนี้ก่อนจับภาพ" }); return false; }
    // แคปหน้าจอแท็บปัจจุบันแล้วดาวน์โหลด
    chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: "png" }, (dataUrl) => {
      const error = chrome.runtime.lastError;
      if (error || !dataUrl) { sendResponse({ ok: false, error: error?.message || "จับภาพไม่สำเร็จ" }); return; }
      chrome.downloads.download({
        url: dataUrl,
        filename: `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
        saveAs: false,
      }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false, error: "บันทึกภาพไม่สำเร็จ" }));
    });
    return true;
  } else if (msg?.type === "SB_CAPTURE_TAB") {
    // ครูสั่ ง screenshot จากหน้า agent → จบั ภาพหน้าจอที่นั กเรียนกำลังดู (ไม่มี dialog เลือกจอ)
    // จับภาพแท็บที่นักเรียนเห็นจริง: หน้าต่างปกติที่โฟกัสล่าสุด (กันกรณีหน้าต่างปัจจุบันเป็น popup/หน้า agent)
    (async () => {
      const shot = (windowId) => new Promise((res) => chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 70 }, (d) => { void chrome.runtime.lastError; res(d || null); }));
      let dataUrl = null;
      try {
        const w = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
        if (w?.id != null) dataUrl = await shot(w.id);
        if (!dataUrl) {
          for (const win of await chrome.windows.getAll({ windowTypes: ["normal"] })) {
            if (win.state === "minimized") continue;
            dataUrl = await shot(win.id); if (dataUrl) break;
          }
        }
      } catch {}
      sendResponse(dataUrl ? { ok: true, image: dataUrl } : { ok: false, error: "จับภาพไม่สำเร็จ" });
    })();
    return true;
  } else if (msg?.type === "SB_POWER") {
    // ครูสั่ งปดิ /รีสตารท์ /ออกจากระบบ → ผาน launcher ของโปรแกรม BNG Safe Browser
    const action = msg.action === "reboot" ? "restart" : msg.action;
    if (action === "logout") {
      clearSession("teacher").then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (!["shutdown", "restart", "sleep", "cancel"].includes(action)) { sendResponse({ ok: false, error: "คำสั่ งไม่ถูกต้อง" }); return false; }
    kioskLauncher("/power", { action }).then(async (r) => {
      if (r?.ok || action === "sleep") return sendResponse(r);
      // launcher ไม่ตอบ (เช่นกำลังรีสตาร์ท) → สั่งผ่านตัวช่วยในเครื่อง (WifiHelper) แทน
      const n = await wifiCall({ cmd: "power", action });
      sendResponse(n?.ok ? n : { ok: false, error: r?.error || n?.error || "สั่งเครื่องไม่สำเร็จ" });
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

// Fallback: บางหน้า (โหมด kiosk/เว็บที่โหลดช้า/SPA) content script ไม่ขึ้น → ฉีดแถบเครื่องมือและปุ่มลอยซ้ำ
// toolbar.js/kiosk-dock.js มีตัวกันซ้ำ (getElementById) จึงฉีดซ้ำได้ปลอดภัย
chrome.tabs.onUpdated.addListener((tabId, ci, tab) => {
  if (ci.status !== "complete" || !/^https?:/i.test(tab?.url || "")) return;
  let trusted = false;
  try { trusted = !!self.sbTrustedSchoolUrl?.(tab.url) || new URL(tab.url).hostname === "127.0.0.1"; } catch {}
  const files = trusted ? ["kiosk-dock.js"] : ["toolbar.js", "kiosk-dock.js"];
  if (!trusted) chrome.scripting.insertCSS({ target: { tabId }, files: ["toolbar.css"] }).catch(() => {});
  chrome.scripting.executeScript({ target: { tabId }, files }).catch(() => {});
});

// แจ้งโปรแกรม Safe Browser ว่าส่วนขยายทำงานอยู่ (ถ้าไม่ได้ยิน โปรแกรมจะเปิดเบราว์เซอร์ใหม่)
chrome.alarms?.create?.("kiosk-ping", { periodInMinutes: 0.5 });
// ส่งเลขรุ่นไปด้วย: โปรแกรมจะสลับไปใช้ส่วนขยายที่มากับตัวติดตั้งเมื่อรุ่นใน Chrome เก่ากว่า
const KIOSK_STATUS_PATH = "/status?v=" + encodeURIComponent(chrome.runtime.getManifest().version);
chrome.alarms?.onAlarm.addListener((a) => { if (a.name === "kiosk-ping") kioskLauncher(KIOSK_STATUS_PATH).catch(() => {}); });
kioskLauncher(KIOSK_STATUS_PATH).catch(() => {});


// ===== ล็อกจอ / ข้อความจากครู (ใช้ชื่อและโลโก้โรงเรียนจาก CMS) =====
function isAgentTabUrl(u) {
  try { return !!u && self.sbTrustedSchoolUrl(u) && new URL(u).pathname === "/dashboard/monitor/agent"; } catch { return false; }
}
async function brandInfo() {
  const { config } = await chrome.storage.local.get(["config"]);
  return {
    school: config?.school_name || config?.footer_school_name || "",
    logo: /^https:\/\//.test(config?.school_logo || "") ? config.school_logo : "",
  };
}
function lockPage(message, school, logo) {
  document.querySelectorAll("video,audio").forEach((m) => { try { m.pause(); m.muted = true; } catch {} });
  let o = document.getElementById("__sb_lock");
  if (!o) {
    o = document.createElement("div");
    o.id = "__sb_lock";
    document.documentElement.appendChild(o);
    const stop = (e) => { if (document.getElementById("__sb_lock")) { e.stopPropagation(); e.preventDefault(); } };
    ["keydown", "keyup", "keypress", "wheel", "contextmenu"].forEach((ev) => window.addEventListener(ev, stop, true));
  }
  o.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;font-family:'Sarabun','Noto Sans Thai',system-ui,sans-serif;text-align:center;padding:4vh 6vw;cursor:none;user-select:none";
  o.innerHTML = "";
  if (logo) { const i = document.createElement("img"); i.src = logo; i.alt = ""; i.style.cssText = "width:min(22vh,180px);height:min(22vh,180px);object-fit:contain;border-radius:24px;background:#fff;padding:12px"; o.appendChild(i); }
  const lock = document.createElement("div"); lock.textContent = "🔒"; lock.style.cssText = "font-size:min(14vh,120px);line-height:1"; o.appendChild(lock);
  const t = document.createElement("div"); t.textContent = "หน้าจอถูกล็อกโดยครู"; t.style.cssText = "font-size:min(8vh,64px);font-weight:800;color:#fff"; o.appendChild(t);
  const m = document.createElement("div"); m.textContent = message; m.style.cssText = "font-size:min(5vh,40px);font-weight:500;color:#e5e7eb;max-width:90vw;line-height:1.4"; o.appendChild(m);
  if (school) { const sc = document.createElement("div"); sc.textContent = school; sc.style.cssText = "margin-top:3vh;font-size:min(3vh,22px);color:#9ca3af"; o.appendChild(sc); }
  if (!window.__sbLockMuteTimer) window.__sbLockMuteTimer = setInterval(() => {
    if (!document.getElementById("__sb_lock")) { clearInterval(window.__sbLockMuteTimer); window.__sbLockMuteTimer = null; return; }
    document.querySelectorAll("video,audio").forEach((x) => { try { x.pause(); } catch {} });
  }, 1000);
}
async function lockTab(tabId, url, info) {
  const { lockMsg } = await chrome.storage.local.get(["lockMsg"]);
  if (isAgentTabUrl(url)) return;
  chrome.tabs.update(tabId, { muted: true }).catch(() => {});
  if (!/^https?:/.test(url || "")) return;
  chrome.scripting.executeScript({ target: { tabId, allFrames: false }, func: lockPage, args: [lockMsg || "ครูล็อกจอ", info.school, info.logo] }).catch(() => {});
}
async function applyLockAll() {
  const info = await brandInfo();
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) if (t.id) lockTab(t.id, t.url, info);
}
// แท็บใหม่/โหลดหน้าใหม่ระหว่างล็อก → ล็อกซ้ำ
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete" && info.mutedInfo?.muted !== false) return;
  const { locked } = await chrome.storage.local.get(["locked"]);
  if (locked) lockTab(tabId, tab.url, await brandInfo());
});
function messagePage(message, school, logo) {
  document.getElementById("__sb_msg")?.remove();
  const o = document.createElement("div");
  o.id = "__sb_msg";
  o.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-family:'Sarabun','Noto Sans Thai',system-ui,sans-serif";
  const card = document.createElement("div");
  card.style.cssText = "background:#fff;color:#111827;border-radius:24px;max-width:min(720px,90vw);width:100%;padding:32px 36px;box-shadow:0 25px 60px rgba(0,0,0,.4);text-align:center;border-top:8px solid #2563eb";
  const head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;color:#2563eb;font-size:22px;font-weight:700";
  if (logo) { const i = document.createElement("img"); i.src = logo; i.alt = ""; i.style.cssText = "width:44px;height:44px;object-fit:contain"; head.appendChild(i); }
  const h = document.createElement("span"); h.textContent = "📢 ข้อความจากครู"; head.appendChild(h); card.appendChild(head);
  const m = document.createElement("div"); m.style.cssText = "font-size:30px;line-height:1.5;font-weight:600;white-space:pre-wrap;word-break:break-word";
  const re = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi; let last = 0, mt; const links = [];
  while ((mt = re.exec(message))) {
    m.appendChild(document.createTextNode(message.slice(last, mt.index)));
    let u = mt[0].replace(/[.,!?)\]]+$/, ""); const href = /^https?:/i.test(u) ? u : "https://" + u; links.push(href);
    const a = document.createElement("a"); a.textContent = u; a.href = href; a.target = "_blank"; a.rel = "noopener";
    a.style.cssText = "color:#2563eb;text-decoration:underline;cursor:pointer";
    m.appendChild(a); last = mt.index + u.length; re.lastIndex = last;
  }
  m.appendChild(document.createTextNode(message.slice(last))); card.appendChild(m);
  links.slice(0, 3).forEach((href) => {
    const lb = document.createElement("button"); lb.textContent = "🌐 เปิดเว็บ " + (href.replace(/^https?:\/\//, "").split("/")[0]);
    lb.style.cssText = "display:block;margin:16px auto 0;background:#16a34a;color:#fff;border:0;border-radius:12px;padding:12px 28px;font-size:18px;font-weight:700;cursor:pointer;font-family:inherit";
    lb.onclick = () => { window.open(href, "_blank", "noopener"); o.remove(); }; card.appendChild(lb);
  });
  if (school) { const sc = document.createElement("div"); sc.textContent = school; sc.style.cssText = "margin-top:16px;font-size:15px;color:#6b7280"; card.appendChild(sc); }
  const b = document.createElement("button"); b.textContent = "รับทราบ";
  b.style.cssText = "margin-top:24px;background:#2563eb;color:#fff;border:0;border-radius:12px;padding:12px 40px;font-size:20px;font-weight:700;cursor:pointer;font-family:inherit";
  b.onclick = () => o.remove(); card.appendChild(b);
  o.appendChild(card);
  document.documentElement.appendChild(o);
  setTimeout(() => o.remove(), 60000);
}
async function showTeacherMessage(message) {
  if (!message) return;
  const info = await brandInfo();
  const tabs = await chrome.tabs.query({ active: true });
  for (const t of tabs) {
    if (!t.id || !/^https?:/.test(t.url || "")) continue;
    chrome.scripting.executeScript({ target: { tabId: t.id }, func: messagePage, args: [message, info.school, info.logo] }).catch(() => {});
  }
  notify("📢 ข้อความจากครู", message);
}

// ===== รายชื่อเว็บพนัน/ลามกอัปเดตอัตโนมัติทุกวัน (แหล่งเปิด HaGeZi) =====
const AUTO_LISTS = [
  ["gambling", "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/gambling.mini-onlydomains.txt"],
  ["adult", "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/nsfw-onlydomains.txt"],
];
let _autoSet = null;
async function refreshAutoBlocklist(force) {
  const { autoBlockAt } = await chrome.storage.local.get(["autoBlockAt"]);
  if (!force && autoBlockAt && Date.now() - autoBlockAt < 20 * 3600 * 1000) return;
  const out = {};
  for (const [cat, url] of AUTO_LISTS) {
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(String(r.status));
      const list = (await r.text()).split("\n").map((x) => x.trim().toLowerCase()).filter((x) => x && !x.startsWith("#"));
      if (list.length > 1000) out[cat] = list.join("\n"); // กันไฟล์เสียทับรายการเดิม
    } catch (e) { console.warn("[auto-blocklist]", cat, e?.message); }
  }
  if (Object.keys(out).length) {
    const { autoBlock = {} } = await chrome.storage.local.get(["autoBlock"]);
    await chrome.storage.local.set({ autoBlock: { ...autoBlock, ...out }, autoBlockAt: Date.now() });
    _autoSet = null;
  }
}
async function autoBlockHit(host) {
  if (!_autoSet) {
    const { autoBlock = {} } = await chrome.storage.local.get(["autoBlock"]);
    _autoSet = new Map();
    for (const [cat, txt] of Object.entries(autoBlock)) for (const d of String(txt).split("\n")) if (d) _autoSet.set(d, cat);
  }
  const parts = String(host || "").toLowerCase().split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join(".");
    if (_autoSet.has(d)) return { domain: d, cat: _autoSet.get(d) };
  }
  return null;
}
chrome.alarms?.create?.("auto-blocklist", { periodInMinutes: 360 });
chrome.alarms?.onAlarm.addListener((a) => { if (a.name === "auto-blocklist") refreshAutoBlocklist(false); });
refreshAutoBlocklist(false);


// ===== เปิดไฟล์ที่ดาวน์โหลด (ใช้ได้ทั้งโหมด kiosk) =====
async function openDownloadedFile(id) {
  const [d] = await chrome.downloads.search({ id });
  if (!d || !d.exists) return { ok: false, error: "ไม่พบไฟล์ อาจถูกลบไปแล้ว" };
  // PDF/รูป/ข้อความ เปิดในแท็บได้เลย (ไม่ต้องออกจากเบราว์เซอร์) ถ้าเปิดสิทธิ์ไฟล์ไว้
  const viewable = /\.(pdf|png|jpe?g|gif|webp|txt|svg|mp4|webm|mp3)$/i.test(d.filename);
  if (viewable && (await chrome.extension.isAllowedFileSchemeAccess())) {
    const path = d.filename.replace(/\\/g, "/");
    await chrome.tabs.create({ url: "file:///" + path.replace(/^\//, "").split("/").map(encodeURIComponent).join("/").replace(/^([A-Za-z])%3A/, "$1:"), active: true });
    return { ok: true };
  }
  try { await chrome.downloads.open(id); return { ok: true }; } catch {}
  try { chrome.downloads.show(id); return { ok: true }; } catch {}
  return { ok: false, error: "เปิดไฟล์นี้ไม่ได้ กรุณาให้ครูเปิดสิทธิ์ \"อนุญาตให้เข้าถึง URL ของไฟล์\" ในหน้า chrome://extensions" };
}

// ===== ไอคอนส่วนขยายใช้โลโก้โรงเรียนจาก CMS =====
let _brandIconData = null;
let _brandIconSrc = null;
async function applyBrandIcon() {
  try {
    const { config } = await chrome.storage.local.get(["config"]);
    const src = /^https:\/\//.test(config?.school_logo || "") ? config.school_logo : null;
    if (!src || src === _brandIconSrc) return;
    const blob = await (await fetch(src, { signal: AbortSignal.timeout(15000) })).blob();
    const bmp = await createImageBitmap(blob);
    const imageData = {};
    for (const size of [16, 32, 48, 128]) {
      const c = new OffscreenCanvas(size, size); const g = c.getContext("2d");
      const k = Math.min(size / bmp.width, size / bmp.height);
      const w = bmp.width * k, h = bmp.height * k;
      g.drawImage(bmp, (size - w) / 2, (size - h) / 2, w, h);
      imageData[size] = g.getImageData(0, 0, size, size);
      if (size === 128) {
        const b = await c.convertToBlob({ type: "image/png" });
        const buf = new Uint8Array(await b.arrayBuffer()); let bin = "";
        for (const x of buf) bin += String.fromCharCode(x);
        _brandIconData = "data:image/png;base64," + btoa(bin);
      }
    }
    await chrome.action.setIcon({ imageData });
    if (config?.school_name) chrome.action.setTitle({ title: `${config.school_name} — Safe Browser` }).catch(() => {});
    _brandIconSrc = src;
  } catch (e) { console.warn("[brand-icon]", e?.message); }
}
chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch.config) applyBrandIcon(); });
applyBrandIcon();
