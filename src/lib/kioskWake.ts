/**
 * ปลุกจอ Kiosk ผ่าน local daemon (Pavilion x2 + MX Linux)
 * — เรียกเมื่อกล้องตรวจเจอ QR / ใบหน้า เพื่อสั่ง xset dpms force on
 * — ถ้าไม่ได้อยู่ในตู้ Kiosk (localhost daemon ไม่มี) จะเงียบ ๆ ไม่ error
 *
 * ติดตั้งฝั่ง Linux: ดูสคริปต์ ~/wake-server.py ในคู่มือ setup
 */

let lastWake = 0;
const COOLDOWN_MS = 3000; // ป้องกันยิงถี่เกิน

export function wakeKioskScreen(): void {
  const now = Date.now();
  if (now - lastWake < COOLDOWN_MS) return;
  lastWake = now;

  // fire-and-forget, timeout สั้น, ไม่ต้องรอ response
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 800);
    fetch("http://127.0.0.1:9999/wake", {
      mode: "no-cors",
      signal: ctrl.signal,
    }).catch(() => {});
  } catch {
    /* daemon ไม่มี = ไม่ใช่เครื่อง Kiosk, เงียบ */
  }
}
