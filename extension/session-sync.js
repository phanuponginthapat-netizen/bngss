// Runs on the school system pages — sync Supabase session into extension storage.
(function () {
  // ค้นหา backend จาก localStorage ของหน้าเว็บ (ไม่ hardcode project อีกต่อไป)
  function detect() {
    let ref = null, url = "", anon = "";
    try {
      const cfg = JSON.parse(localStorage.getItem("bng.backend.config") || "{}");
      if (cfg.url) url = String(cfg.url).replace(/\/+$/, "");
      if (cfg.anonKey) anon = cfg.anonKey;
    } catch {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      const m = k.match(/^sb-(.+)-auth-token$/);
      if (m) { ref = m[1]; break; }
    }
    if (!url && ref) url = `https://${ref}.supabase.co`;
    return { ref, url, anon };
  }

  let DET = detect();
  let KEY = DET.ref ? `sb-${DET.ref}-auth-token` : "";
  let SUPA_URL = DET.url;
  let ANON = DET.anon;

  // ดึง anon key จาก /app-config.js ของหน้าเว็บ (content script อ่าน window ของเพจไม่ได้)
  async function loadConfig() {
    try {
      const txt = await (await fetch(`${location.origin}/app-config.js`, { cache: "no-store" })).text();
      const u = txt.match(/SUPABASE_URL:\s*"([^"]+)"/);
      const a = txt.match(/SUPABASE_ANON_KEY:\s*"([^"]+)"/);
      if (u && u[1] && !DET.url) SUPA_URL = u[1].replace(/\/+$/, "");
      if (a && a[1] && !ANON) ANON = a[1];
    } catch {}
  }

  function read() {
    if (!KEY) { DET = detect(); KEY = DET.ref ? `sb-${DET.ref}-auth-token` : ""; SUPA_URL = SUPA_URL || DET.url; }
    if (!KEY) return null;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // supabase-js v2 stores {access_token, refresh_token, expires_at, user, ...}
      if (parsed?.access_token) return parsed;
      if (parsed?.currentSession?.access_token) return parsed.currentSession;
      return null;
    } catch { return null; }
  }


  async function fetchProfile(userId, token) {
    const out = { name: null, role: null };
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}&select=first_name,last_name,nickname`, {
        headers: { apikey: ANON, Authorization: `Bearer ${token}` },
      });
      const arr = await r.json();
      const p = arr?.[0];
      if (p) {
        const nick = p.nickname ? ` (${p.nickname})` : "";
        out.name = `${p.first_name || ""} ${p.last_name || ""}${nick}`.trim() || null;
      }
    } catch { /* ignore */ }
    try {
      const r2 = await fetch(`${SUPA_URL}/rest/v1/user_roles?user_id=eq.${userId}&select=role`, {
        headers: { apikey: ANON, Authorization: `Bearer ${token}` },
      });
      const rows = await r2.json();
      const roles = Array.isArray(rows) ? rows.map((x) => x.role) : [];
      // ครู/บุคลากร/ผู้บริหาร ถือเป็น staff — ไม่ต้องเปิด Monitor Agent
      out.role = roles.find((x) => x !== "student") || roles[0] || null;
    } catch { /* ignore */ }
    return out;
  }

  let lastToken = undefined; // undefined = ยังไม่เคยเช็ค → ครั้งแรกที่ไม่มี session จะสั่ง CLEAR_SESSION ด้วย

  async function push() {
    const s = read();
    if (!s?.access_token) {
      // ออกจากระบบแล้ว → เคลียร์ session ใน extension กันวนเปิดแท็บล็อกอินไม่หยุด
      if (lastToken !== null) {
        lastToken = null;
        try { chrome.runtime.sendMessage({ type: "CLEAR_SESSION" }); } catch {}
      }
      return;
    }
    if (s.access_token === lastToken) return;
    lastToken = s.access_token;
    const prof = s.user?.id ? await fetchProfile(s.user.id, s.access_token) : { name: null, role: null };
    chrome.runtime.sendMessage({
      type: "SET_SESSION",
      backend: { url: SUPA_URL, anonKey: ANON },
      systemHome: `${location.origin}/dashboard/browser`,
      session: {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: s.expires_at,
        role: prof.role,
        user: s.user ? { id: s.user.id, email: s.user.email, name: prof.name } : null,
      },
    });
  }

  (async () => { await loadConfig(); push(); })();
  window.addEventListener("storage", (e) => { if (e.key === KEY) push(); });
  setInterval(push, 10 * 1000);


  // Relay Monitor Agent commands (จาก StudentAgentPage) → extension background
  window.addEventListener("message", (ev) => {
    if (ev.source !== window || !ev.data || typeof ev.data !== "object") return;
    const t = ev.data.type;
    if (t === "SB_OPEN_URL" || t === "SB_LOCK_ALL" || t === "SB_UNLOCK_ALL" || t === "SB_SCREENSHOT") {
      try { chrome.runtime.sendMessage(ev.data); } catch {}
    }
  });

  document.documentElement.setAttribute("data-school-safe-browser", "1");

  // Floating "extension linked" badge (one-time)
  if (!document.getElementById("__sb_ext_badge")) {
    const b = document.createElement("div");
    b.id = "__sb_ext_badge";
    b.textContent = "✓ ส่วนขยายเชื่อมต่อแล้ว";
    b.style.cssText = "position:fixed;bottom:12px;left:12px;background:#10b981;color:#fff;padding:6px 10px;border-radius:999px;font:12px system-ui;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.15);opacity:.9";
    document.body?.appendChild(b);
    setTimeout(() => b.remove(), 3500);
  }
})();
