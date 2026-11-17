# BNG Safe Browser (Windows)

Kiosk browser program = bundled Chrome for Testing + `extension/` + `safe_browser.py` launcher.

- Starts full-screen at every Windows sign-in (Startup folder), relaunches if closed.
- Exit / shutdown / restart: ⏻ button (bottom-left) or Ctrl+Shift+Q → scan an admin/staff card QR.
  The launcher verifies the card via `kiosk-api/staff-card` with the machine Device Key.
- Remote shutdown: FaceGate admin → machine card → "ปิดเครื่อง" (shared `kiosk_commands` power queue).
- Local bridge: `127.0.0.1:47831`, accepts only the extension origin.
- Ctrl+Alt+Del cannot be blocked by any program; use a standard (non-admin) Windows account for students.
