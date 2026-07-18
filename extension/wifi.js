// wifi.js — talks to background service worker which bridges to native host

const $ = (id) => document.getElementById(id);

function toast(msg, kind = "") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show " + kind;
  setTimeout(() => (t.className = "toast " + kind), 2500);
}

async function call(cmd, extra = {}) {
  return await chrome.runtime.sendMessage({ type: "WIFI", cmd, ...extra });
}

function signalIcon(sig) {
  if (sig >= 75) return "▂▄▆█";
  if (sig >= 50) return "▂▄▆_";
  if (sig >= 25) return "▂▄__";
  return "▂___";
}

function renderList(nets) {
  const box = $("list");
  if (!nets || !nets.length) {
    box.innerHTML = '<div class="empty">ไม่พบเครือข่ายใกล้เคียง</div>';
    return;
  }
  box.innerHTML = "";
  for (const n of nets) {
    const row = document.createElement("div");
    row.className = "row" + (n.in_use ? " active" : "");
    const locked = n.security && n.security !== "--" && n.security !== "";
    row.innerHTML = `
      <div class="icon">${signalIcon(n.signal)}</div>
      <div class="meta">
        <div class="ssid">${escapeHtml(n.ssid)} ${n.in_use ? '<span class="badge ok" style="margin-left:6px">เชื่อมอยู่</span>' : ""}</div>
        <div class="sec">${locked ? "🔒 " + escapeHtml(n.security) : "🔓 เปิด"} · สัญญาณ ${n.signal}%</div>
      </div>
      <div class="sig">${n.signal}%</div>
    `;
    row.onclick = () => onConnect(n);
    box.appendChild(row);
  }
}

function renderSaved(saved) {
  const box = $("saved-list");
  if (!saved || !saved.length) {
    box.innerHTML = '<div class="empty">ยังไม่มี Wi-Fi ที่บันทึก</div>';
    return;
  }
  box.innerHTML = "";
  for (const s of saved) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="icon">💾</div>
      <div class="meta">
        <div class="ssid">${escapeHtml(s.name)}</div>
        <div class="sec">${s.autoconnect ? "✓ เชื่อมต่ออัตโนมัติ" : "○ ไม่เชื่อมอัตโนมัติ"}</div>
      </div>
      <button class="btn danger" data-forget="${escapeHtml(s.name)}">ลบ</button>
    `;
    row.querySelector("[data-forget]").onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`ลบ Wi-Fi "${s.name}" ออก?`)) return;
      const r = await call("forget", { ssid: s.name });
      if (r?.ok) { toast("ลบแล้ว", "ok"); refreshAll(); }
      else toast(r?.error || "ลบไม่สำเร็จ", "err");
    };
    box.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

let pendingSsid = null;
let isConnecting = false;

function onConnect(net) {
  if (isConnecting) { toast("กำลังเชื่อมต่ออยู่ กรุณารอสักครู่", "warn"); return; }
  const locked = net.security && net.security !== "--" && net.security !== "";
  if (!locked) {
    doConnect(net.ssid, "");
    return;
  }
  openPasswordModal(net.ssid);
}

function openPasswordModal(ssid) {
  pendingSsid = ssid;
  $("modal-ssid").textContent = ssid;
  $("password").value = "";
  $("show-pass").checked = false;
  $("password").type = "password";
  $("modal").classList.add("show");
  setTimeout(() => $("password").focus(), 50);
}

async function doConnect(ssid, password) {
  if (isConnecting) return;
  isConnecting = true;
  $("list").classList.add("busy");
  toast("กำลังเชื่อมต่อ " + ssid + "...");
  try {
    const r = await call("connect", { ssid, password });
    if (r?.ok) {
      toast("✓ เชื่อมต่อ " + ssid + " สำเร็จ (บันทึกไว้แล้ว)", "ok");
      setTimeout(refreshAll, 800);
    } else {
      toast(r?.error || "เชื่อมต่อไม่สำเร็จ", "err");
      // If a password was required and it likely failed → reopen modal so user can retry without re-clicking
      if (password) setTimeout(() => openPasswordModal(ssid), 200);
    }
  } finally {
    isConnecting = false;
    $("list").classList.remove("busy");
  }
}

async function refreshStatus() {
  const r = await call("status");
  if (r?.ok) {
    $("active-ssid").textContent = r.active_ssid || "ไม่ได้เชื่อมต่อ";
    const b = $("conn-badge");
    if (r.connectivity === "full") { b.className = "badge ok"; b.textContent = "ออนไลน์"; }
    else if (r.connectivity === "limited" || r.connectivity === "portal") { b.className = "badge warn"; b.textContent = r.connectivity; }
    else { b.className = "badge no"; b.textContent = "ตัดขาด"; }
  }
}

async function refreshAll() {
  const ping = await call("ping");
  if (!ping?.ok) {
    $("helper-missing").style.display = "block";
    $("list").innerHTML = '<div class="empty">รอผู้ดูแลติดตั้ง helper ก่อน</div>';
    return;
  }
  $("helper-missing").style.display = "none";
  await refreshStatus();
  const [list, saved] = await Promise.all([call("list"), call("saved")]);
  if (list?.ok) renderList(list.networks);
  if (saved?.ok) renderSaved(saved.saved);
}

$("rescan").onclick = async () => {
  const btn = $("rescan");
  btn.disabled = true;
  $("list").innerHTML = '<div class="empty">🔄 กำลังสแกน...</div>';
  try {
    await call("scan");
    // Poll list up to ~6s until it stabilises (nmcli rescan is async on some adapters)
    let prev = -1;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const r = await call("list");
      const n = r?.networks?.length ?? 0;
      if (r?.ok && n > 0 && n === prev) { renderList(r.networks); break; }
      if (r?.ok) renderList(r.networks);
      prev = n;
    }
    await refreshAll();
  } finally {
    btn.disabled = false;
  }
};

$("modal-cancel").onclick = () => { $("modal").classList.remove("show"); pendingSsid = null; };
$("modal-connect").onclick = () => {
  const p = $("password").value;
  $("modal").classList.remove("show");
  if (pendingSsid) doConnect(pendingSsid, p);
};
$("show-pass").onchange = (e) => { $("password").type = e.target.checked ? "text" : "password"; };
$("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("modal-connect").click();
});

refreshAll();
setInterval(refreshStatus, 15000);
