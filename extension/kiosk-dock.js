// Small corner button shown only when the BNG Safe Browser Windows program is running.
(function () {
  if (window.top !== window.self || document.getElementById("__sb_kiosk_dock")) return;
  chrome.runtime.sendMessage({ type: "KIOSK_STATUS" }, (st) => {
    if (chrome.runtime.lastError || !st?.ok || !st.kiosk) return;
    const b = document.createElement("button");
    b.id = "__sb_kiosk_dock";
    b.type = "button";
    b.title = "ออกจากโปรแกรม / ปิดเครื่อง (สแกนบัตรบุคลากร)";
    b.setAttribute("aria-label", b.title);
    b.textContent = "⏻";
    b.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483646;width:40px;height:40px;border-radius:50%;border:1px solid rgba(15,23,42,.25);background:rgba(255,255,255,.92);color:#0f172a;font:20px/1 system-ui;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18);opacity:.75";
    b.onmouseenter = () => (b.style.opacity = "1");
    b.onmouseleave = () => (b.style.opacity = ".75");
    b.onclick = () => chrome.runtime.sendMessage({ type: "KIOSK_OPEN_CONTROL" });
    document.documentElement.appendChild(b);
    // ปุ่มกลับหน้าระบบ: แสดงเสมอในโปรแกรม แม้เว็บปลายทางจะบังแถบด้านบน
    const h = document.createElement("button");
    h.id = "__sb_kiosk_home"; h.type = "button";
    h.title = "กลับหน้าระบบโรงเรียน"; h.setAttribute("aria-label", h.title);
    h.textContent = "🏠";
    h.style.cssText = b.style.cssText.replace("left:12px", "left:60px");
    h.onmouseenter = () => (h.style.opacity = "1");
    h.onmouseleave = () => (h.style.opacity = ".75");
    h.onclick = () => chrome.runtime.sendMessage({ type: "GO_HOME" });
    document.documentElement.appendChild(h);
    // ปุ่มย้อนกลับ: โหมด kiosk ไม่มีแถบของ Chrome
    const k = document.createElement("button");
    k.id = "__sb_kiosk_back"; k.type = "button";
    k.title = "ย้อนกลับ"; k.setAttribute("aria-label", k.title);
    k.textContent = "◀";
    k.style.cssText = b.style.cssText.replace("left:12px", "left:108px");
    k.onmouseenter = () => (k.style.opacity = "1");
    k.onmouseleave = () => (k.style.opacity = ".75");
    k.onclick = () => history.back();
    document.documentElement.appendChild(k);
  });
})();
