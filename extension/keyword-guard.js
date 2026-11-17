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
  let scanning = false;

  async function scan() {
    if (blocked || scanning) return;
    scanning = true;
    const scanUrl = location.href;
    try {
    let cfg = {};
    try {
      const s = await chrome.runtime.sendMessage({ type: "GET_STATE" });
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
    if (location.href !== scanUrl) return;
    const result = await chrome.runtime.sendMessage({
        type: "KEYWORD_HIT",
        url: location.href,
        word: hit.w,
        category: hit.cat,
        where,
      });
    if (result?.ok) blocked = true;
    } catch { /* retry on later scan */ }
    finally { scanning = false; }
  }

  let pending;
  const run = () => { clearTimeout(pending); pending = setTimeout(scan, 400); };
  if (document.readyState === "complete" || document.readyState === "interactive") run();
  document.addEventListener("DOMContentLoaded", run, { once: true });
  window.addEventListener("load", run, { once: true });
  if (document.body) new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true });

  // SPA: ตรวจซ้ำเมื่อ URL เปลี่ยน
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      blocked = false;
      run();
    }
    if (!blocked) run(); // Also retry config failures and policy changes on static pages.
  }, 1500);
})();
