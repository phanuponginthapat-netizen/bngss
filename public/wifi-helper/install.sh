#!/usr/bin/env bash
# ============================================================================
# BNGSS Wi-Fi Helper — Native Messaging Host installer
# ติดตั้ง Python daemon + manifest ให้ Chromium/Chrome เรียกจาก extension ได้
# เรียกจาก setup.sh หรือรันเดี่ยว: sudo bash install.sh
# ============================================================================
set -e

EXT_ID="${EXT_ID:-icacgdjhgabapdfflndkjclpkggckdbk}"
HOST_NAME="com.bngss.wifi"
HELPER_DIR="/opt/bngss"
HELPER_BIN="$HELPER_DIR/wifi-helper.py"
SYSTEM_URL="${SYSTEM_URL:-https://bngss.vercel.app}"

echo "==> BNGSS Wi-Fi Helper installer"
echo "    ext id  : $EXT_ID"
echo "    system  : $SYSTEM_URL"

# --- 1) ต้องเป็น root ---
if [ "$(id -u)" != "0" ]; then
  echo "!! ต้องรันด้วย sudo"; exit 1
fi

# --- 2) วาง helper script ---
mkdir -p "$HELPER_DIR"
if [ -f "./wifi-helper.py" ]; then
  cp -f "./wifi-helper.py" "$HELPER_BIN"
else
  curl -fsSL "$SYSTEM_URL/wifi-helper/wifi-helper.py" -o "$HELPER_BIN"
fi
chmod 0755 "$HELPER_BIN"
chown root:root "$HELPER_BIN"

# --- 3) เขียน native-messaging manifest ---
MANIFEST_JSON=$(cat <<JSON
{
  "name": "$HOST_NAME",
  "description": "BNGSS Wi-Fi Helper (nmcli bridge)",
  "path": "$HELPER_BIN",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
JSON
)

for DIR in \
  /etc/chromium/native-messaging-hosts \
  /etc/opt/chrome/native-messaging-hosts \
  /etc/opt/edge/native-messaging-hosts; do
  mkdir -p "$DIR"
  echo "$MANIFEST_JSON" > "$DIR/$HOST_NAME.json"
  chmod 0644 "$DIR/$HOST_NAME.json"
done

# --- 4) polkit: อนุญาต user "guest" ใช้ NetworkManager โดยไม่ต้องถามรหัส ---
mkdir -p /etc/polkit-1/rules.d
cat >/etc/polkit-1/rules.d/50-bngss-nm.rules <<'PKR'
// BNGSS: อนุญาตให้ user "guest" จัดการ Wi-Fi ผ่าน NetworkManager
polkit.addRule(function(action, subject) {
  if (subject.user !== "guest") return;
  if (action.id.indexOf("org.freedesktop.NetworkManager.") === 0) {
    return polkit.Result.YES;
  }
});
PKR
chmod 0644 /etc/polkit-1/rules.d/50-bngss-nm.rules

# ให้ guest เห็น saved connections (ปกติ root-only readable)
mkdir -p /etc/NetworkManager/system-connections
chmod 0755 /etc/NetworkManager
chmod 0700 /etc/NetworkManager/system-connections  # ยังปลอดภัย NM read as root

# --- 5) Deep Freeze exclusion hint (ไม่บังคับ) ---
# ระบบไหนใช้ reboot-restore-rx / faronics-df-linux ต้อง exclude paths นี้:
#   /etc/NetworkManager/system-connections/
#   /var/lib/NetworkManager/
# ที่นี่แค่บันทึกไว้เป็น marker ให้ setup ตัวถัดไปตรวจได้
mkdir -p /var/lib/bngss
cat >/var/lib/bngss/deep-freeze-exclude.list <<'LST'
/etc/NetworkManager/system-connections/
/var/lib/NetworkManager/
/var/lib/bngss/
LST

# --- 6) restart NetworkManager / polkit ให้ rule ใหม่ทำงาน ---
systemctl restart polkit 2>/dev/null || systemctl restart polkitd 2>/dev/null || true
systemctl reload NetworkManager 2>/dev/null || systemctl restart NetworkManager 2>/dev/null || true

# --- 7) test ---
if command -v nmcli >/dev/null; then
  echo "==> nmcli พร้อมใช้งาน: $(nmcli -v)"
else
  echo "!! ไม่พบ nmcli — ติดตั้ง network-manager ก่อน: apt install -y network-manager"
fi

echo "✓ ติดตั้งเสร็จ"
echo "  helper  : $HELPER_BIN"
echo "  host    : $HOST_NAME (allowed for $EXT_ID)"
echo "  manifest: /etc/chromium/native-messaging-hosts/$HOST_NAME.json"
