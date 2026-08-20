/**
 * ปุ่มย้อนกลับของ Android (APK)
 * เดิม: กด back = ปิดแอปทันทีจากทุกหน้า
 * ใหม่: ปิด dialog/sheet ที่เปิดอยู่ก่อน → ถ้าไม่มีให้ย้อนหน้า → ถ้าอยู่หน้าแรกให้กด 2 ครั้งเพื่อออก
 */

let installed = false;

function isNative(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

function closeTopOverlay(): boolean {
  const overlay = document.querySelector<HTMLElement>(
    "[data-state='open'][role='dialog'], [data-state='open'][role='alertdialog']",
  );
  if (!overlay) return false;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return true;
}

export async function installBackButtonHandler() {
  if (installed || !isNative()) return;
  installed = true;

  const { App } = await import("@capacitor/app");
  let lastBackAt = 0;

  App.addListener("backButton", ({ canGoBack }) => {
    if (closeTopOverlay()) return;

    if (canGoBack || window.history.length > 1) {
      window.history.back();
      return;
    }

    const now = Date.now();
    if (now - lastBackAt < 2000) {
      App.exitApp();
    } else {
      lastBackAt = now;
      window.dispatchEvent(new CustomEvent("native:back-hint"));
    }
  });
}
