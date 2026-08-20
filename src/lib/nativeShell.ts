/**
 * Native-app shell tweaks for installed PWA.
 * ทำงานเฉพาะเมื่อผู้ใช้เปิดจากไอคอนหน้าจอโฮม (display-mode: standalone)
 * เป้าหมาย: ให้รู้สึกเหมือน app native — ไม่มี bounce, ไม่มี zoom, ไม่มี context menu,
 * ไม่หลุดออกจากแอปด้วยการปัด swipe-back
 */

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

export function initNativeShell() {
  if (typeof window === "undefined") return;

  // FCM push สำหรับ APK Android — ลงทะเบียน token เนทีฟ (ปลอดภัย: ออกจากระบบ/ไม่ใช่แอป = ข้าม)
  try {
    import("./fcmPush").then(({ initFcmPush }) => initFcmPush()).catch(() => {});
  } catch (_) {}

  // ตรวจเวอร์ชันใหม่บน APK Android — โชว์ป๊อปอัปให้อัปเดตในแอป (ข้ามถ้าเป็นเวอร์ชันจาก Play Store)
  try {
    import("./appUpdater").then(({ checkAndPromptUpdate }) => checkAndPromptUpdate()).catch(() => {});
  } catch (_) {}

  const root = document.documentElement;
  const applyStandaloneClass = () => {
    if (isStandalone()) {
      root.classList.add("standalone");
      root.dataset.pwa = "installed";
    } else {
      root.classList.remove("standalone");
      delete root.dataset.pwa;
    }
  };
  applyStandaloneClass();

  // React to display-mode changes (rare but possible)
  try {
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", applyStandaloneClass);
  } catch {}

  // ตอนติดตั้งเป็นแอปเท่านั้น — จำกัดพฤติกรรมเบราว์เซอร์
  if (!isStandalone()) return;

  // 1. กัน pinch-zoom (viewport meta ก็ตั้ง maximum-scale=1 แล้ว แต่ iOS อาจข้าม)
  document.addEventListener(
    "gesturestart",
    (e) => e.preventDefault(),
    { passive: false }
  );
  document.addEventListener(
    "dblclick",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
    },
    { passive: false }
  );

  // 2. กัน context menu (long-press เมนู) — ยกเว้นในช่องข้อความและรูป
  document.addEventListener("contextmenu", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, [contenteditable], .allow-select, img, a[href]")) return;
    e.preventDefault();
  });

  // 3. กันการลาก (drag) องค์ประกอบ UI
  document.addEventListener("dragstart", (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG" || t.closest(".allow-select")) return;
    e.preventDefault();
  });

  // 4. iOS overscroll bounce — จัดการด้วย CSS overscroll-behavior: none แทน
  //    (touchmove preventDefault ทำให้ scroll ทั้งหน้าไม่ได้ในหลายๆ layout)
}
