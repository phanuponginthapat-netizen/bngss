// Safe Browser — สแกนเนื้อหาหน้าเว็บหาคำต้องห้าม (พนัน/ลามก/ยาเสพติด ฯลฯ)
// ทำงานหลังโหลดหน้า: ตรวจ title + meta + ข้อความหน้าเว็บ แล้วแจ้ง background ให้บล็อก
(function () {
  if (window.top !== window.self) return;
  if (!/^https?:/.test(location.href)) return;

  const buildList = self.sbBuildKeywordList;
  const matchKw = self.sbMatchKeywords;
  const countKw = self.sbCountKeywords;
  if (!buildList) return;

  let blocked = false;

  async function scan() {
    if (blocked) return;
    let cfg = {};
    try {
      const s = await chrome.storage.local.get(["config"]);
      cfg = s.config || {};
    } catch { return; }

    if (String(cfg.browser_keyword_scan_page ?? "1") === "0") return;

    const list = buildList(cfg);
    if (!list.words.length) return;

    // 1) title / meta — น้ำหนักสูง เจอคำเดียวก็บล็อก
    const meta = document.querySelector('meta[name="description"]')?.content || "";
    const kw = document.querySelector('meta[name="keywords"]')?.content || "";
    const head = `${document.title} ${meta} ${kw}`;
    let hit = matchKw(head, list);
    let where = "ชื่อเรื่อง/คำอธิบายหน้าเว็บ";

    // 2) เนื้อหา — ต้องเจอ >= 2 คำ เพื่อลดการบล็อกผิด
    if (!hit) {
      const body = (document.body?.innerText || "").slice(0, 20000);
      const r = countKw(body, list, 2);
      if (r.count >= 2) { hit = r.hits[0]; where = "เนื้อหาในหน้าเว็บ"; }
    }

    if (!hit) return;
    blocked = true;
    try {
      chrome.runtime.sendMessage({
        type: "KEYWORD_HIT",
        url: location.href,
        word: hit.w,
        category: hit.cat,
        where,
      });
    } catch { /* ignore */ }
  }

  const run = () => { setTimeout(scan, 400); };
  if (document.readyState === "complete" || document.readyState === "interactive") run();
  document.addEventListener("DOMContentLoaded", run, { once: true });
  window.addEventListener("load", run, { once: true });

  // SPA: ตรวจซ้ำเมื่อ URL เปลี่ยน
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      blocked = false;
      run();
    }
  }, 1500);
})();
