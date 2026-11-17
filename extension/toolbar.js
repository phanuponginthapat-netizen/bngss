// Floating toolbar: brand, address bar, user + clock, apps grid, home/close.
(function () {
  if (window.top !== window.self) return;
  if (document.getElementById("__sb_toolbar")) return;

  const bar = document.createElement("div");
  bar.id = "__sb_toolbar";
  bar.innerHTML = `
    <div class="sb-inner">
      <button class="sb-btn sb-back" title="ย้อนกลับ" aria-label="ย้อนกลับ">◀</button>
      <button class="sb-btn sb-fwd" title="ไปข้างหน้า" aria-label="ไปข้างหน้า">▶</button>
      <button class="sb-btn sb-reload" title="โหลดหน้านี้ใหม่" aria-label="โหลดใหม่">⟳</button>
      <span class="sb-brand">
        <img class="sb-logo" alt="" />
        <b class="sb-school">Safe Browser</b>
      </span>
      <form class="sb-addr-form">
        <input class="sb-addr" type="text" spellcheck="false" autocomplete="off"
          placeholder="พิมพ์ URL หรือคำค้นหา…" />
        <button class="sb-btn sb-go" type="submit" title="ไป">➜</button>
      </form>
      <span class="sb-user" title="ผู้ใช้งาน">👤 <b class="sb-user-name">—</b> <span class="sb-user-email" style="opacity:.75;font-weight:400;margin-left:6px"></span></span>
      <span class="sb-clock" title="เวลาปัจจุบัน">🕒 <b class="sb-clock-val">--:--:--</b></span>
      <button class="sb-btn sb-shot" title="แคปหน้าจอ">📸</button>
      <button class="sb-btn sb-files" title="ไฟล์ที่ดาวน์โหลด">📂 ไฟล์</button>
      <button class="sb-btn sb-send" title="ส่งไฟล์ให้ครู (แนบในการบ้าน)">📤 ส่งงาน</button>
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
    <div class="sb-apps-panel sb-files-panel" hidden>
      <div class="sb-apps-title">ไฟล์ที่ดาวน์โหลด</div>
      <div class="sb-files-list"></div>
      <button class="sb-files-send" type="button">📤 ส่งไฟล์ให้ครู</button>
    </div>
    <div class="sb-apps-panel sb-main-apps" hidden>
      <div class="sb-apps-title">รายการโปรด</div>
      <div class="sb-apps-grid"></div>
      <div class="sb-apps-empty" hidden>ยังไม่มีทางลัด — ให้แอดมินเพิ่มในระบบ</div>
    </div>
  `;
  document.documentElement.appendChild(bar);

  const addr = bar.querySelector(".sb-addr");
  addr.value = location.href;
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

  bar.querySelector(".sb-back").addEventListener("click", () => history.back());
  bar.querySelector(".sb-fwd").addEventListener("click", () => history.forward());
  bar.querySelector(".sb-reload").addEventListener("click", () => location.reload());
  // หน้าต่างป๊อปอัป (เช่น ล็อกอิน Google) ปุ่มปิดจะปิดหน้าต่างและกลับหน้าเดิม
  if (window.opener) {
    const c = bar.querySelector(".sb-close");
    c.textContent = "✕ ปิดหน้าต่างนี้"; c.title = "ปิดหน้าต่างล็อกอินแล้วกลับหน้าเดิม";
  }

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
  const panel = bar.querySelector(".sb-main-apps");
  const grid = bar.querySelector(".sb-apps-grid");
  const empty = bar.querySelector(".sb-apps-empty");

  const renderShortcuts = (list) => {
    grid.innerHTML = "";
    const items = Array.isArray(list) ? list.filter(s => /^https?:\/\//i.test(s?.target_url || "")) : [];
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
      // โลโก้จากผู้ดูแล → favicon ของเว็บ (ผ่านส่วนขยาย ไม่ติด CSP ของหน้า) → Google favicon → 🌐
      const srcs = [];
      if (s.logo_url) srcs.push(s.logo_url);
      try { const fav = new URL(chrome.runtime.getURL("/_favicon/")); fav.searchParams.set("pageUrl", url); fav.searchParams.set("size", "64"); srcs.push(fav.toString()); } catch {}
      try { srcs.push(`https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`); } catch {}
      const img = document.createElement("img");
      img.alt = "";
      let k = 0;
      const next = () => { if (k < srcs.length) img.src = srcs[k++]; else { img.remove(); iconWrap.textContent = /^\p{Extended_Pictographic}/u.test(s.icon || "") ? s.icon : "🌐"; } };
      img.onerror = next;
      img.onload = () => { if (img.naturalWidth <= 1) next(); };
      iconWrap.appendChild(img);
      next();
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
  appsBtn.addEventListener("click", (e) => { filesPanel.hidden = true; togglePanel(e); });

  // ไฟล์ที่ดาวน์โหลด + ส่งงานให้ครู
  const filesPanel = bar.querySelector(".sb-files-panel");
  const filesList = bar.querySelector(".sb-files-list");
  const fmtSize = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const fileIcon = (name) => /\.pdf$/i.test(name) ? "📕" : /\.(png|jpe?g|gif|webp)$/i.test(name) ? "🖼️" : /\.(docx?|odt)$/i.test(name) ? "📘" : /\.(xlsx?|csv)$/i.test(name) ? "📗" : /\.(pptx?)$/i.test(name) ? "📙" : "📄";
  const loadFiles = () => {
    filesList.textContent = "กำลังโหลด…";
    chrome.runtime.sendMessage({ type: "SB_LIST_DOWNLOADS" }, (r) => {
      filesList.innerHTML = "";
      const items = (r && r.items) || [];
      if (!items.length) { filesList.textContent = "ยังไม่มีไฟล์ที่ดาวน์โหลด"; return; }
      for (const it of items) {
        const row = document.createElement("button");
        row.type = "button"; row.className = "sb-file";
        const name = String(it.filename || "").split(/[\\/]/).pop();
        row.innerHTML = `<span class="sb-file-ic"></span><span class="sb-file-tx"><b></b><small></small></span>`;
        row.querySelector(".sb-file-ic").textContent = fileIcon(name);
        row.querySelector("b").textContent = name;
        row.querySelector("small").textContent = `${fmtSize(it.fileSize || 0)} · ${new Date(it.startTime).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`;
        row.addEventListener("click", () => chrome.runtime.sendMessage({ type: "SB_OPEN_DOWNLOAD", id: it.id }, (res) => {
          if (!res?.ok) alert(res?.error || "เปิดไฟล์ไม่สำเร็จ");
          else filesPanel.hidden = true;
        }));
        filesList.appendChild(row);
      }
    });
  };
  bar.querySelector(".sb-files").addEventListener("click", (e) => {
    e.stopPropagation(); panel.hidden = true;
    filesPanel.hidden = !filesPanel.hidden;
    if (!filesPanel.hidden) loadFiles();
  });
  const openSend = () => { filesPanel.hidden = true; chrome.runtime.sendMessage({ type: "SB_OPEN_HOMEWORK" }); };
  bar.querySelector(".sb-send").addEventListener("click", openSend);
  bar.querySelector(".sb-files-send").addEventListener("click", openSend);
  filesPanel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => { filesPanel.hidden = true; });
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
    if (eEl) eEl.textContent = email && email !== name ? `(${email})` : "";

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
    const refreshState = () => chrome.runtime.sendMessage({ type: "GET_STATE" }).then(applyState).catch(() => {});
    refreshState();
    setInterval(refreshState, 15000);
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
      if (el === bar || bar.contains(el) || el.id === "__sb_lock") return;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") return;
      // ดูจากค่า top ที่เว็บตั้งไว้ (ไม่ใช่ตำแหน่งตอนนี้) เพื่อจับหัวเว็บที่ติดด้านบนตอนเลื่อนด้วย
      const topVal = parseFloat(cs.top);
      const atTop = Number.isFinite(topVal) ? topVal < OFFSET : (cs.position === "fixed" && el.getBoundingClientRect().top < OFFSET);
      if (atTop) {
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
  let shiftPending = false;
  new MutationObserver(() => {
    if (shiftPending) return;
    shiftPending = true;
    setTimeout(() => { shiftPending = false; shiftFixed(); }, 200);
  }).observe(document.body, { childList: true, subtree: true });
})();
