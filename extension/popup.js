async function render() {
  const s = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const cfg = s?.config || {};

  // Brand from CMS
  const name = cfg.school_name || cfg.app_name || "Safe Browser";
  const nameEn = cfg.school_name_en || cfg.app_short_name || "";
  const logo = cfg.school_logo || cfg.app_favicon_url || "";
  document.getElementById("brand-name").textContent = name;
  document.getElementById("brand-en").textContent = nameEn;
  const img = document.getElementById("brand-logo");
  if (logo) { img.src = logo; img.style.display = "block"; img.onerror = () => { img.style.display = "none"; }; }

  const status = document.getElementById("status");
  const user = document.getElementById("user");
  const bl = document.getElementById("bl");
  if (s?.session?.connected) {
    status.textContent = "เชื่อมแล้ว"; status.className = "badge ok";
    user.textContent = s.session.user?.email || s.session.user?.id?.slice(0,8) || "—";
  } else {
    status.textContent = "ยังไม่เชื่อม"; status.className = "badge no";
    user.textContent = "—";
  }
  const list = (cfg.browser_blocklist || "").split(/[\n,]+/).filter(Boolean).length;
  const ads = (cfg.browser_ad_domains || "").split(/[\n,]+/).filter(Boolean).length;
  bl.textContent = `${list} เว็บ + ${ads} โฆษณา`;
  if (s?.configError || s?.logError || s?.sessionError) {
    status.textContent = s.sessionError ? "เชื่อมต่อบัญชีไม่ได้" : s.configError ? "โหลดนโยบายไม่สำเร็จ" : "บันทึกประวัติไม่สำเร็จ";
    status.className = "badge no";
    status.title = s.sessionError || s.configError || s.logError;
  }
}

document.getElementById("open").onclick = () => chrome.runtime.sendMessage({ type: "OPEN_HOME" });
document.getElementById("wifi").onclick = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("wifi.html") });
  window.close();
};
document.getElementById("refresh").onclick = async () => {
  const button = document.getElementById("refresh");
  button.disabled = true;
  try { await chrome.runtime.sendMessage({ type: "REFRESH_CONFIG" }); await render(); }
  catch { document.getElementById("status").textContent = "เชื่อมต่อไม่สำเร็จ"; }
  finally { button.disabled = false; }
};
render().catch(() => { document.getElementById("status").textContent = "เชื่อมต่อไม่สำเร็จ"; });
