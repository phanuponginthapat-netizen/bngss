"""Staff-card control page served by the launcher on 127.0.0.1 only.

Any leave attempt (Start, Alt+F4, log off, power button, the in-page ⏻ button) opens
this page. It verifies a staff/admin card QR with the school server before exiting or
powering off, and — while the machine has no Device Key — lets an admin/director card
register the machine so it appears on the school's FaceGate machines page.
"""

PAGE = """<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BNG Safe Browser — สแกนบัตรบุคลากร</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #0f172a; color: #e2e8f0; font-family: "Segoe UI", system-ui, sans-serif; padding: 24px; }
  .card { width: 100%; max-width: 460px; background: #1e293b; border: 1px solid #334155;
          border-radius: 20px; padding: 28px; text-align: center; }
  h1 { font-size: 20px; margin-bottom: 6px; }
  .sub { color: #94a3b8; font-size: 13px; margin-bottom: 18px; }
  video { width: 100%; border-radius: 14px; background: #020617; aspect-ratio: 4/3; object-fit: cover; }
  .actions { display: grid; gap: 10px; margin-top: 18px; }
  button { border: 0; border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 600;
           cursor: pointer; font-family: inherit; }
  .exit { background: #f59e0b; color: #111827; }
  .shut { background: #ef4444; color: #fff; }
  .rest { background: #334155; color: #e2e8f0; }
  .back { background: transparent; color: #94a3b8; border: 1px solid #475569; }
  #status { min-height: 22px; margin-top: 14px; font-size: 14px; color: #94a3b8; }
  #status.ok { color: #4ade80; } #status.err { color: #f87171; }
  #reg { margin-top: 20px; border-top: 1px solid #334155; padding-top: 16px; display: none; }
  #reg.show { display: block; }
  #reg h2 { font-size: 15px; margin-bottom: 8px; }
  #reg p { font-size: 12px; color: #94a3b8; margin-bottom: 10px; }
  #reg input { width: 100%; padding: 11px; border-radius: 10px; border: 1px solid #475569;
               background: #0f172a; color: #e2e8f0; font-size: 14px; margin-bottom: 10px; }
  #reg button { background: #0ea5e9; color: #fff; width: 100%; }
  .badge { display: inline-block; font-size: 11px; color: #64748b; margin-top: 16px; }
</style>
</head>
<body>
<div class="card">
  <h1>🛡️ สแกนบัตรบุคลากรเพื่อยืนยัน</h1>
  <p class="sub">เล็ง QR บนบัตรให้ตรงกล้อง หรือใช้เครื่องอ่านบัตร</p>
  <video id="cam" autoplay playsinline muted></video>
  <div class="actions">
    <button class="exit" data-a="exit">ออกจากโปรแกรม</button>
    <button class="shut" data-a="shutdown">ปิดเครื่อง</button>
    <button class="rest" data-a="restart">รีสตาร์ทเครื่อง</button>
    <button class="back" id="back">กลับไปใช้งานต่อ</button>
  </div>
  <div id="status"></div>
  <div id="reg">
    <h2>💻 ลงทะเบียนเครื่องนี้</h2>
    <p>เครื่องนี้ยังไม่มีรหัสเครื่อง — ตั้งชื่อเครื่องแล้วสแกนบัตรผู้บริหาร/ผู้ดูแลระบบ<br>เพื่อให้เครื่องปรากฏในหน้าเครื่องสแกนของโรงเรียน (สั่งปิดเครื่องจากระบบหลักได้)</p>
    <input id="mname" placeholder="ชื่อเครื่อง เช่น NB-01" maxlength="40">
    <button id="regbtn">สแกนบัตรผู้ดูแลเพื่อลงทะเบียน</button>
  </div>
  <span class="badge">BNG Safe Browser v__VERSION__ · __MODE__</span>
</div>
<input id="usb" style="position:absolute;opacity:0;pointer-events:none" autocomplete="off">
<script src="/jsqr.js"></script>
<script>
const statusEl = document.getElementById("status");
const usb = document.getElementById("usb");
let busy = false, action = "exit", registerMode = false;

function say(msg, cls) { statusEl.textContent = msg; statusEl.className = cls || ""; }

async function post(path, body) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { code: r.status, data: await r.json().catch(() => ({})) };
}

async function submitQr(qr) {
  if (busy || !qr) return;
  busy = true;
  try {
    if (registerMode) {
      const name = document.getElementById("mname").value.trim();
      if (!name) { say("กรุณาตั้งชื่อเครื่องก่อน", "err"); busy = false; return; }
      say("กำลังลงทะเบียนเครื่อง…");
      const { code, data } = await post("/register-local", { qr, name });
      if (data.ok) { say("ลงทะเบียนเครื่อง \"" + name + "\" สำเร็จแล้ว ✓", "ok"); document.getElementById("reg").classList.remove("show"); registerMode = false; }
      else say(data.error || "ลงทะเบียนไม่สำเร็จ (" + code + ")", "err");
      return;
    }
    say("กำลังตรวจสอบบัตร…");
    const { code, data } = await post("/verify", { qr, action });
    if (data.ok) {
      say("ยืนยันแล้ว: " + (data.name || "") + " — กำลังดำเนินการ", "ok");
      setTimeout(() => window.close(), 4000);
    } else {
      say(data.error || "บัตรนี้ไม่มีสิทธิ์ (" + code + ")", "err");
    }
  } catch (e) {
    say("เชื่อมต่อโปรแกรมไม่ได้", "err");
  } finally {
    busy = false;
  }
}

document.querySelectorAll(".actions button[data-a]").forEach((b) => {
  b.onclick = () => { action = b.dataset.a; registerMode = false; say("เลือก: " + b.textContent + " — สแกนบัตรเพื่อยืนยัน"); usb.focus(); };
});
document.getElementById("back").onclick = () => window.close();
document.getElementById("regbtn").onclick = () => {
  registerMode = true; say("สแกนบัตรผู้บริหาร/ผู้ดูแลระบบเพื่อลงทะเบียนเครื่อง"); usb.focus();
};

// USB card readers type the code very fast and end with Enter.
let buf = "", last = 0;
usb.addEventListener("keydown", (e) => {
  const now = Date.now();
  if (now - last > 120) buf = "";
  last = now;
  if (e.key === "Enter") { const q = buf; buf = ""; if (q.length >= 4) submitQr(q); }
  else if (e.key.length === 1) buf += e.key;
});
usb.focus();
document.addEventListener("click", () => usb.focus());

// Camera QR scan.
const video = document.getElementById("cam");
if (navigator.mediaDevices && window.jsQR) {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((stream) => {
    video.srcObject = stream;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    setInterval(() => {
      if (busy || !video.videoWidth) return;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) submitQr(code.data.trim());
    }, 400);
  }).catch(() => say("เปิดกล้องไม่ได้ — ใช้เครื่องอ่านบัตรแทน", "err"));
} else {
  say("เบราว์เซอร์นี้ไม่รองรับกล้อง — ใช้เครื่องอ่านบัตร", "err");
}

if ("__REGISTERED__" === "0") document.getElementById("reg").classList.add("show");
</script>
</body>
</html>
"""


def render(version: str, kiosk: bool, registered: bool) -> bytes:
    return (
        PAGE.replace("__VERSION__", version)
        .replace("__MODE__", "โหมดเต็มจอ" if kiosk else "โหมดหน้าต่าง")
        .replace("__REGISTERED__", "1" if registered else "0")
        .encode("utf-8")
    )
