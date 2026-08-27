#!/usr/bin/env bash
# ============================================================================
# ติดตั้ง Kiosk Door แบบ Electron (COOP/COEP + autostart) บน Debian/MX/Ubuntu
#
#   sudo bash setup-electron-kiosk.sh "https://bngss.lovable.app/kiosk/door"
#
# ได้อะไร:
#  - Electron wrapper ที่ใส่ header COOP/COEP → crossOriginIsolated = true
#    → WASM หลายเธรด (face-api / onnxruntime) เร็วขึ้นราว 30–50% เทียบ Chromium kiosk
#  - autostart ผ่าน systemd user service + respawn อัตโนมัติ
#  - ปรับกล้องด้วย v4l2-ctl (exposure/backlight) ตอนบูต
# ============================================================================
set -euo pipefail

KIOSK_URL="${1:-https://bngss.lovable.app/kiosk/door}"
KIOSK_USER="${KIOSK_USER:-$(logname 2>/dev/null || echo kiosk)}"
USER_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
APP_DIR="$USER_HOME/kiosk-electron"

[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย sudo"; exit 1; }

echo "==> ติดตั้ง dependency"
apt-get update -y
apt-get install -y --no-install-recommends \
  nodejs npm v4l-utils alsa-utils xdotool unclutter x11-xserver-utils \
  libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2 libxss1 || true

echo "==> เตรียมโฟลเดอร์แอป: $APP_DIR"
mkdir -p "$APP_DIR/electron"
cp "$(dirname "$0")/../../electron/kiosk-main.cjs" "$APP_DIR/electron/kiosk-main.cjs" 2>/dev/null || \
  curl -fsSL "${KIOSK_URL%/kiosk/door}/kiosk-main.cjs" -o "$APP_DIR/electron/kiosk-main.cjs"

cat >"$APP_DIR/package.json" <<'JSON'
{
  "name": "kiosk-door-electron",
  "version": "1.0.0",
  "private": true,
  "main": "electron/kiosk-main.cjs",
  "scripts": { "start": "electron electron/kiosk-main.cjs" },
  "devDependencies": { "electron": "^32.0.0" }
}
JSON

chown -R "$KIOSK_USER:$KIOSK_USER" "$APP_DIR"
echo "==> ติดตั้ง Electron (ดาวน์โหลดราว 150MB)"
sudo -u "$KIOSK_USER" bash -lc "cd '$APP_DIR' && npm install --no-audit --no-fund"

echo "==> ตั้งค่ากล้อง (v4l2) ตอนบูต"
cat >/usr/local/bin/kiosk-camera-tune.sh <<'CAM'
#!/usr/bin/env bash
command -v v4l2-ctl >/dev/null 2>&1 || exit 0
for DEV in /dev/video*; do
  [ -e "$DEV" ] || continue
  v4l2-ctl -d "$DEV" --all 2>/dev/null | grep -q "Video Capture" || continue
  set_ctl() { v4l2-ctl -d "$DEV" --set-ctrl "$1=$2" >/dev/null 2>&1; }
  # ปล่อย auto exposure/WB ทำงาน แล้วปิด backlight compensation (ต้นเหตุภาพขาวโพลน)
  set_ctl auto_exposure 3
  set_ctl exposure_auto 3
  set_ctl white_balance_temperature_auto 1
  set_ctl backlight_compensation 0
  set_ctl gain 0
done
CAM
chmod +x /usr/local/bin/kiosk-camera-tune.sh

echo "==> สร้าง systemd user service"
sudo -u "$KIOSK_USER" mkdir -p "$USER_HOME/.config/systemd/user"
cat >"$USER_HOME/.config/systemd/user/kiosk-electron.service" <<UNIT
[Unit]
Description=Kiosk Door (Electron, COOP/COEP isolated)
After=graphical-session.target

[Service]
Type=simple
Environment=KIOSK_URL=$KIOSK_URL
Environment=ELECTRON_DISABLE_SECURITY_WARNINGS=1
ExecStartPre=/usr/local/bin/kiosk-camera-tune.sh
ExecStart=$APP_DIR/node_modules/.bin/electron $APP_DIR/electron/kiosk-main.cjs
Restart=always
RestartSec=3

[Install]
WantedBy=graphical-session.target
UNIT
chown -R "$KIOSK_USER:$KIOSK_USER" "$USER_HOME/.config/systemd"

loginctl enable-linger "$KIOSK_USER" || true
sudo -u "$KIOSK_USER" XDG_RUNTIME_DIR="/run/user/$(id -u "$KIOSK_USER")" \
  bash -lc "systemctl --user daemon-reload && systemctl --user enable --now kiosk-electron.service" || \
  echo "!! เปิด service ไม่สำเร็จตอนนี้ — จะเริ่มเองหลังรีบูต"

echo
echo "เสร็จแล้ว ✅  URL: $KIOSK_URL"
echo "ตรวจสถานะ: systemctl --user status kiosk-electron"
echo "ตรวจว่า multi-thread ทำงาน: เปิด DevTools (KIOSK_DEVTOOLS=1) แล้วพิมพ์ crossOriginIsolated"
