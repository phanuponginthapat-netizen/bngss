# BNG Safe Browser (Windows)

Kiosk browser program = installed Google Chrome (extension loaded from ZIP in the normal profile; set `SAFEBROWSER_BROWSER=bundled` to force the bundled Chrome for Testing) + `extension/` + `safe_browser.py` launcher.

- Starts full-screen at every Windows sign-in (Startup folder), relaunches if closed.
- Exit / shutdown / restart: ⏻ button (bottom-left) or Ctrl+Shift+Q → the launcher serves a
  staff-card page on `127.0.0.1:47831/exit` (this machine only; LAN hosts get 404) → scan an
  admin/staff card QR. With a Device Key the card is verified via `kiosk-api/staff-card`;
  without one via the public `kiosk-api/staff-card-check` (staff confirmation only).
- Device Key is optional at install (student loaner notebooks). Register later from the same
  control page: name the machine + scan an admin/director card → `kiosk-api/register-device-card`
  creates the device and the launcher stores the key in `%LOCALAPPDATA%\BNG Safe Browser\device.key`.
- Remote shutdown (registered machines): FaceGate admin → machine card → "ปิดเครื่อง"
  (shared `kiosk_commands` power queue).
- Local bridge: `127.0.0.1:47831`, extension API accepts only the extension origin.
- Ctrl+Alt+Del cannot be blocked by any program; use a standard (non-admin) Windows account for students.

## 1.7.0 — ทำงานร่วมกับส่วนขยายอัตโนมัติ
- โปรแกรมเปิด Chrome ปกติก่อน ถ้าส่วนขยายใน Chrome ไม่ตอบภายใน 90 วินาที หรือเป็นรุ่นเก่ากว่ารุ่นที่มากับโปรแกรม จะสลับไปใช้เบราว์เซอร์ที่แถมมาซึ่งโหลดส่วนขยายรุ่นล่าสุดเองทันที (ไม่ต้องติดตั้งส่วนขยายเอง)
- ติดตั้งตัวช่วย Wi-Fi สำหรับ Windows (WifiHelper.exe ผ่าน netsh) และลงทะเบียนให้ Chrome/Edge อัตโนมัติ หน้า Wi-Fi ของส่วนขยายจึงใช้บน Windows ได้
