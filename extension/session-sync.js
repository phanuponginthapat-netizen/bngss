// Runs on the school system pages — sync Supabase session into extension storage.
(function () {
  const REF = "dlkyxvhnnffblerwedjz";
  const KEY = `sb-${REF}-auth-token`;

  function read() {
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

  const SUPA_URL = `https://${REF}.supabase.co`;
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa3l4dmhubmZmYmxlcndlZGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjY5MTIsImV4cCI6MjA5OTk0MjkxMn0.bQqqX3veJ_pGr9fSa0a-bKIS-w7UmR569a2xDZQ6Cx4";

  async function fetchName(userId, token) {
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}&select=first_name,last_name,nickname`, {
        headers: { apikey: ANON, Authorization: `Bearer ${token}` },
      });
      const arr = await r.json();
      const p = arr?.[0];
      if (!p) return null;
      const nick = p.nickname ? ` (${p.nickname})` : "";
      return `${p.first_name || ""} ${p.last_name || ""}${nick}`.trim() || null;
    } catch { return null; }
  }

  async function push() {
    const s = read();
    if (!s?.access_token) return;
    const name = s.user?.id ? await fetchName(s.user.id, s.access_token) : null;
    chrome.runtime.sendMessage({
      type: "SET_SESSION",
      systemHome: `${location.origin}/dashboard/browser`,
      session: {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: s.expires_at,
        user: s.user ? { id: s.user.id, email: s.user.email, name } : null,
      },
    });
  }

  push();
  window.addEventListener("storage", (e) => { if (e.key === KEY) push(); });
  setInterval(push, 60 * 1000);

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
