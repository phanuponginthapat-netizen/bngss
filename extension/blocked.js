(function () {
  const q = new URLSearchParams(location.search);
  const reasonEl = document.getElementById("reason");
  const urlEl = document.getElementById("url");
  const homeBtn = document.getElementById("home-btn");
  const loginBtn = document.getElementById("login-btn");
  const backBtn = document.getElementById("back-btn");
  const logoEl = document.getElementById("brand-logo");
  const nameEl = document.getElementById("brand-name");
  const enEl = document.getElementById("brand-en");
  const footEl = document.getElementById("school-foot");
  const shieldEl = document.getElementById("shield");
  const titleEl = document.getElementById("title");
  const subEl = document.getElementById("sub");

  urlEl.textContent = q.get("u") || "";
  const paramReason = q.get("r");
  const mode = q.get("mode") || "";
  const next = q.get("next") || "";

  backBtn.addEventListener("click", () =>
    history.length > 1 ? history.back() : chrome.runtime.sendMessage({ type: "CLOSE_TAB" })
  );

  // ปรับ UI ตามโหมด
  if (mode === "login") {
    shieldEl.textContent = "🔑";
    titleEl.textContent = "ต้องเข้าสู่ระบบก่อน";
    subEl.textContent = "เบราว์เซอร์นี้อนุญาตให้ใช้เฉพาะนักเรียน/ครูของโรงเรียน กรุณาเข้าสู่ระบบด้วยบัญชีของโรงเรียนก่อน";
    homeBtn.style.display = "none";
    loginBtn.style.display = "inline-flex";
  } else if (mode === "time") {
    shieldEl.textContent = "⏰";
    titleEl.textContent = "ถูกบล็อกในช่วงเวลาเรียน";
    subEl.textContent = "เว็บไซต์นี้อนุญาตให้ใช้นอกช่วงเวลาเรียนเท่านั้น กรุณากลับเข้าสู่ระบบการเรียน";
  }

  try {
    chrome.storage.local.get(["config", "systemHome"], ({ config, systemHome }) => {
      const cfg = config || {};
      const home = systemHome || cfg.browser_default_homepage || "https://bngss.vercel.app/dashboard/browser";
      homeBtn.href = home;

      const login = next || cfg.browser_login_url || "https://bngss.vercel.app/auth";
      loginBtn.href = login;

      const school = cfg.school_name || cfg.footer_school_name || "โรงเรียน";
      nameEl.textContent = school;
      if (cfg.school_name_en) enEl.textContent = cfg.school_name_en;

      if (cfg.school_logo) {
        logoEl.src = cfg.school_logo;
        logoEl.style.display = "inline-block";
      }

      const fallback =
        mode === "login"
          ? "กรุณาเข้าสู่ระบบด้วยบัญชีของโรงเรียนก่อนจึงจะใช้งานอินเทอร์เน็ตได้"
          : cfg.browser_block_message || "เว็บไซต์นี้ไม่อนุญาตให้เข้าถึงตามนโยบายของโรงเรียน";
      reasonEl.textContent = paramReason || fallback;

      footEl.textContent = `© ${new Date().getFullYear()} ${school} • School Safe Browser`;
    });
  } catch {
    reasonEl.textContent = paramReason || "เว็บไซต์นี้ไม่อนุญาตให้เข้าถึง";
  }
})();
