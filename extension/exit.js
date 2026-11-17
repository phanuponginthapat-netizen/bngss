// Exit / shutdown requires a staff card QR (camera or USB QR reader). Hand typing is rejected.
(function () {
  const msg = document.getElementById("msg");
  const video = document.getElementById("video");
  const scanner = document.getElementById("scanner");
  let action = "exit", busy = false, stream = null, lastQr = "", lastAt = 0;
  const say = (t, cls = "") => { msg.textContent = t; msg.className = cls; };
  const labels = { exit: "ออกจากโปรแกรม", shutdown: "ปิดเครื่อง", restart: "รีสตาร์ท" };

  document.querySelectorAll("[data-action]").forEach((b) => b.addEventListener("click", () => {
    action = b.dataset.action;
    document.querySelectorAll("[data-action]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    say(`พร้อม${labels[action]} — สแกนบัตรบุคลากร`); scanner.focus();
  }));
  document.getElementById("back").onclick = () => { stop(); window.close(); };

  function stop() { stream?.getTracks().forEach((t) => t.stop()); stream = null; }

  function submit(qr) {
    const now = Date.now();
    if (busy || !qr || (qr === lastQr && now - lastAt < 4000)) return;
    lastQr = qr; lastAt = now; busy = true;
    say("กำลังตรวจสอบบัตรกับระบบโรงเรียน…");
    chrome.runtime.sendMessage({ type: "KIOSK_ACTION", action, qr }, (r) => {
      busy = false;
      if (chrome.runtime.lastError || !r) return say("ติดต่อโปรแกรมในเครื่องไม่ได้", "bad");
      if (r.ok) { say(`ยืนยันแล้ว: ${r.name || "บุคลากร"} — กำลัง${labels[action]}`, "ok"); stop(); return; }
      say(r.error === "not_staff" ? "บัตรนี้ไม่มีสิทธิ์ ใช้ได้เฉพาะผู้ดูแลระบบหรือบุคลากร" : (r.error || "ตรวจสอบไม่สำเร็จ"), "bad");
    });
  }

  // USB QR readers type a full code within milliseconds and end with Enter.
  let keys = [];
  scanner.addEventListener("keydown", (e) => {
    const t = performance.now();
    if (e.key === "Enter") {
      const fast = keys.length >= 4 && (keys[keys.length - 1].t - keys[0].t) / (keys.length - 1) < 35;
      const text = keys.map((k) => k.c).join("");
      keys = []; scanner.value = "";
      if (fast) submit(text.trim()); else say("กรุณาสแกนบัตร ไม่รับการพิมพ์รหัสเอง", "bad");
      e.preventDefault(); return;
    }
    if (e.key.length === 1) keys.push({ c: e.key, t });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("button")) scanner.focus(); });
  scanner.focus();

  navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } }).then((s) => {
    stream = s; video.srcObject = s; video.play();
    say(`พร้อม${labels[action]} — สแกนบัตรบุคลากร`);
    const c = document.createElement("canvas"), ctx = c.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (!stream) return;
      if (!busy && video.videoWidth) {
        c.width = video.videoWidth; c.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" });
        if (code?.data) submit(code.data.trim());
      }
      setTimeout(tick, 250);
    };
    tick();
  }).catch(() => say("ไม่พบกล้อง — ใช้เครื่องอ่าน QR แทนได้", "bad"));
  window.addEventListener("pagehide", stop);
})();
