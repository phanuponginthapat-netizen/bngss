// Floating toolbar: brand, address bar, user + clock, apps grid, home/close.
(function () {
  if (window.top !== window.self) return;
  if (document.getElementById("__sb_toolbar")) return;

  const bar = document.createElement("div");
  bar.id = "__sb_toolbar";
  bar.innerHTML = `
    <div class="sb-inner">
      <span class="sb-brand">
        <img class="sb-logo" alt="" />
        <b class="sb-school">Safe Browser</b>
      </span>
      <form class="sb-addr-form">
        <input class="sb-addr" type="text" spellcheck="false" autocomplete="off"
          placeholder="พิมพ์ URL หรือคำค้นหา…" value="${location.href.replace(/"/g,"&quot;")}" />
        <button class="sb-btn sb-go" type="submit" title="ไป">➜</button>
      </form>
      <span class="sb-user" title="ผู้ใช้งาน">👤 <b class="sb-user-name">—</b> <span class="sb-user-email" style="opacity:.75;font-weight:400;margin-left:6px"></span></span>
      <span class="sb-clock" title="เวลาปัจจุบัน">🕒 <b class="sb-clock-val">--:--:--</b></span>
      <button class="sb-btn sb-shot" title="แคปหน้าจอ">📸</button>
      <button class="sb-btn sb-apps" title="รายการโปรด / ทางลัด" aria-label="apps">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/>
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
          <circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
        </svg>
      </button>
      <button class="sb-btn sb-home" title="กลับสู่ระบบ">🏠 ระบบ</button>
      <button class="sb-btn sb-close" title="ปิดแท็บ">✕ ปิด</button>
    </div>
    <div class="sb-apps-panel" hidden>
      <div class="sb-apps-title">รายการโปรด</div>
      <div class="sb-apps-grid"></div>
      <div class="sb-apps-empty" hidden>ยังไม่มีทางลัด — ให้แอดมินเพิ่มในระบบ</div>
    </div>
  `;
  document.documentElement.appendChild(bar);

  const addr = bar.querySelector(".sb-addr");
  bar.querySelector(".sb-addr-form").addEventListener("submit", (e) => {
    e.preventDefault();
    let v = (addr.value || "").trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) {
      v = /\.[a-z]{2,}(\/|$)/i.test(v) && !/\s/.test(v)
        ? "https://" + v
        : "https://www.google.com/search?q=" + encodeURIComponent(v);
    }
    location.href = v;
  });
  addr.addEventListener("focus", () => addr.select());

  bar.querySelector(".sb-home").addEventListener("click", () =>
    chrome.runtime.sendMessage({ type: "GO_HOME" })
  );
  bar.querySelector(".sb-close").addEventListener("click", () =>
    chrome.runtime.sendMessage({ type: "CLOSE_TAB" })
  );
  bar.querySelector(".sb-shot").addEventListener("click", () =>
    chrome.runtime.sendMessage({ type: "SB_SCREENSHOT" })
  );

  // Apps grid popup
  const appsBtn = bar.querySelector(".sb-apps");
  const panel = bar.querySelector(".sb-apps-panel");
  const grid = bar.querySelector(".sb-apps-grid");
  const empty = bar.querySelector(".sb-apps-empty");

  const renderShortcuts = (list) => {
    grid.innerHTML = "";
    const items = Array.isArray(list) ? list : [];
    if (items.length === 0) { empty.hidden = false; return; }
    empty.hidden = true;
    for (const s of items) {
      const url = s.target_url || "";
      if (!url) continue;
      const label = s.label_th || s.label_en || url;
      const a = document.createElement("a");
      a.className = "sb-app";
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = label;
      const iconWrap = document.createElement("div");
      iconWrap.className = "sb-app-icon";
      if (s.logo_url) {
        const img = document.createElement("img");
        img.src = s.logo_url; img.alt = "";
        img.onerror = () => { iconWrap.textContent = s.icon || "🌐"; };
        iconWrap.appendChild(img);
      } else {
        iconWrap.textContent = s.icon || "🌐";
      }
      const lbl = document.createElement("div");
      lbl.className = "sb-app-label";
      lbl.textContent = label;
      a.appendChild(iconWrap);
      a.appendChild(lbl);
      a.addEventListener("click", () => { panel.hidden = true; });
      grid.appendChild(a);
    }
  };

  const togglePanel = (e) => {
    e?.stopPropagation?.();
    panel.hidden = !panel.hidden;
  };
  appsBtn.addEventListener("click", togglePanel);
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (!panel.contains(e.target) && e.target !== appsBtn && !appsBtn.contains(e.target)) {
      panel.hidden = true;
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") panel.hidden = true; });

  // User + school info + shortcuts from stored session/config
  const applyState = ({ session, config }) => {
    const email = session?.user?.email || "";
    const name = session?.user?.name || email || session?.user?.id || "ยังไม่ได้เข้าสู่ระบบ";
    const nEl = bar.querySelector(".sb-user-name");
    if (nEl) nEl.textContent = String(name);
    const eEl = bar.querySelector(".sb-user-email");
    if (eEl && email && email !== name) eEl.textContent = `(${email})`;

    const school = config?.school_name || config?.footer_school_name || "Safe Browser";
    const sEl = bar.querySelector(".sb-school");
    if (sEl) sEl.textContent = String(school);

    const logo = config?.school_logo;
    const lEl = bar.querySelector(".sb-logo");
    if (lEl) {
      if (logo) { lEl.src = logo; lEl.style.display = "inline-block"; }
      else lEl.style.display = "none";
    }

    renderShortcuts(config?.browser_shortcuts);
  };
  try {
    chrome.storage.local.get(["session", "config"], applyState);
    chrome.storage.onChanged?.addListener?.((changes, area) => {
      if (area !== "local") return;
      if (changes.config || changes.session) {
        chrome.storage.local.get(["session", "config"], applyState);
      }
    });
  } catch {}

  // Live clock
  const clockEl = bar.querySelector(".sb-clock-val");
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const d = new Date();
    if (clockEl) clockEl.textContent =
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);

  // Shift fixed/sticky elements at top:0 down by 44px so they don't hide behind toolbar
  const OFFSET = 44;
  const shiftFixed = () => {
    document.querySelectorAll("body *").forEach((el) => {
      if (el === bar || bar.contains(el)) return;
      const cs = getComputedStyle(el);
      if ((cs.position === "fixed" || cs.position === "sticky") && el.getBoundingClientRect().top < OFFSET) {
        if (!el.dataset.sbShifted) {
          const cur = parseFloat(cs.top) || 0;
          el.style.setProperty("top", (cur + OFFSET) + "px", "important");
          el.dataset.sbShifted = "1";
        }
      }
    });
  };
  shiftFixed();
  setTimeout(shiftFixed, 500);
  setTimeout(shiftFixed, 1500);
  new MutationObserver(() => shiftFixed()).observe(document.body, { childList: true, subtree: true });
})();
