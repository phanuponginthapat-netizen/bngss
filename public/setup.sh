#!/usr/bin/env bash
# ============================================================================
#  BNGSS School System — Student Kiosk Setup for MX Linux 25.2
#  Chromium Light Edition
#
#  ใช้:   curl -fsSL https://bngss.vercel.app/setup.sh | bash
#         bash setup.sh
#
#  Env vars:
#    SYSTEM_URL         URL ระบบ            (default: https://bngss.vercel.app)
#    WIFI_SSID/PASS     Wi-Fi auto-connect
#    IDLE_LOGOUT_MIN    idle logout นาที    (0 = ปิด)
#    DAILY_REBOOT_TIME  รีบูตอัตโนมัติ       (default: 03:00)
#    LOCK_TTY=1         บล็อก Ctrl+Alt+F1-6 (default: 0)
#    FULL_INSTALL=1     ติด LibreOffice ฯลฯ  (default: 0 = เบา)
#    CTL_PORT           local daemon port   (default: 9998)
#
#  ลำดับการติดตั้ง (ทำจากพื้นฐาน → ล็อกดาวน์)
#    Phase 1  Pre-flight & System update
#    Phase 2  Install packages (bulk)
#    Phase 3  System config (timezone / keyboard / fonts)
#    Phase 4  Network (Wi-Fi + Firewall)
#    Phase 5  Download & prepare extension
#    Phase 6  Chromium managed policy
#    Phase 7  Guest user + XFCE config + Deep-Freeze snapshot
#    Phase 8  Overlay service
#    Phase 9  Local control daemon
#    Phase 10 Kiosk wrapper + LightDM auto-login
#    Phase 11 Watchdogs (healthcheck / daily-reboot / idle)
#    Phase 12 Lockdown (USB / TTY / boot services)
#    Phase 13 Desktop shortcut & finish
# ============================================================================
set -e
G='\033[1;32m'; Y='\033[1;33m'; R='\033[1;31m'; B='\033[1;34m'; N='\033[0m'
step(){ echo -e "\n${G}==>${N} ${Y}$1${N}"; }
ok(){ echo -e "${G}   ✓${N} $1"; }
warn(){ echo -e "${Y}   !${N} $1"; }
err(){ echo -e "${R}   ✗${N} $1"; }

# ─── Pre-flight ──────────────────────────────────────────────────────────────
# รองรับทั้ง `curl … | sudo bash` (root) และ `bash setup.sh` (user → ขอ sudo ภายใน)
if [ "$EUID" -ne 0 ]; then
  command -v sudo >/dev/null || { err "ต้องมี sudo หรือรันเป็น root"; exit 1; }
  sudo -v || { err "ต้องการสิทธิ์ sudo เพื่อดำเนินการต่อ"; exit 1; }
  # keep-alive sudo timestamp
  ( while true; do sudo -n true; sleep 50; kill -0 "$$" 2>/dev/null || exit; done ) 2>/dev/null &
fi

echo -e "${G}"
cat <<'BANNER'
  ╔══════════════════════════════════════════════════╗
  ║  BNGSS Student Kiosk · Chromium Light Edition    ║
  ║  MX Linux 25.2 · Fast · Locked · Auto-recover    ║
  ╚══════════════════════════════════════════════════╝
BANNER
echo -e "${N}"

SYSTEM_URL="${SYSTEM_URL:-https://bngss.vercel.app}"
EXT_DIR="/opt/bngss-extension"
CTL_PORT="${CTL_PORT:-9998}"
IDLE_LOGOUT_MIN="${IDLE_LOGOUT_MIN:-0}"
DAILY_REBOOT_TIME="${DAILY_REBOOT_TIME:-03:00}"
LOCK_TTY="${LOCK_TTY:-0}"
FULL_INSTALL="${FULL_INSTALL:-0}"
WIFI_SSID="${WIFI_SSID:-}"
WIFI_PASS="${WIFI_PASS:-}"

# ============================================================================
# PHASE 1 — System update (fail-safe)
# ============================================================================
step "[1/13] อัปเดตระบบ"
set +e
sudo apt update -y
sudo apt -y --fix-broken install
sudo apt full-upgrade -y || warn "upgrade บางตัวล้มเหลว — ไปต่อ"
set -e
ok "อัปเดตเสร็จ"

# ============================================================================
# PHASE 2 — Install ALL packages (bulk)
# ============================================================================
step "[2/13] ติดตั้ง packages (Chromium + tools)"
sudo apt install -y \
  chromium \
  fonts-thai-tlwg fonts-noto fonts-noto-cjk fonts-noto-color-emoji fonts-sarabun \
  ibus ibus-libthai \
  network-manager ufw \
  curl wget unzip jq \
  python3 scrot xprintidle unclutter xdotool \
  rsync || {
    warn "bulk install fail — ลอง minimal"
    sudo apt install -y chromium fonts-thai-tlwg network-manager curl python3 unzip rsync
  }

if [ "$FULL_INSTALL" = "1" ]; then
  step "     + Office pack (FULL_INSTALL=1)"
  sudo apt install -y libreoffice libreoffice-l10n-th gimp vlc thunderbird thunderbird-l10n-th || true
fi

if command -v chromium >/dev/null; then BROWSER_BIN="chromium"
elif command -v chromium-browser >/dev/null; then BROWSER_BIN="chromium-browser"
else err "Chromium ติดตั้งไม่สำเร็จ"; exit 1; fi
ok "Chromium: $(command -v $BROWSER_BIN)"

# ============================================================================
# PHASE 3 — System config
# ============================================================================
step "[3/13] Timezone / Locale / Fonts / Keyboard (Fcitx5 + TIS-820.2538)"
sudo timedatectl set-timezone Asia/Bangkok 2>/dev/null || true
sudo locale-gen th_TH.UTF-8 2>/dev/null || true
fc-cache -fv >/dev/null 2>&1 || true

# --- XKB: US + Thai (TIS-820.2538) เป็น layer ระบบ ---
# variant "tis" = TIS-820.2538 (ไม่ใช่ Kedmanee พื้นฐาน)
sudo localectl set-x11-keymap "us,th" "" ",tis" 2>/dev/null || true
setxkbmap -layout "us,th" -variant ",tis" 2>/dev/null || true

# --- Fcitx5 (IME) + engine keyboard-th (TIS-820.2538) ---
sudo apt install -y --no-install-recommends \
  fcitx5 fcitx5-config-qt fcitx5-frontend-gtk3 fcitx5-frontend-gtk4 fcitx5-frontend-qt5 \
  2>/dev/null || sudo apt install -y --no-install-recommends fcitx5 fcitx5-configtool 2>/dev/null || true

# ตั้ง env ให้แอปทั้งเครื่องใช้ fcitx เป็น input method
sudo tee /etc/environment.d/90-fcitx5.conf >/dev/null <<'ENV'
GTK_IM_MODULE=fcitx
QT_IM_MODULE=fcitx
XMODIFIERS=@im=fcitx
SDL_IM_MODULE=fcitx
GLFW_IM_MODULE=ibus
INPUT_METHOD=fcitx
ENV
# เผื่อ session ไม่โหลด environment.d → เขียนไว้ที่ profile.d ด้วย
sudo tee /etc/profile.d/90-fcitx5.sh >/dev/null <<'PROF'
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS=@im=fcitx
export SDL_IM_MODULE=fcitx
export INPUT_METHOD=fcitx
PROF

# --- Config Fcitx5 สำหรับ user guest: TIS-820.2538 + Grave toggle ---
sudo -u guest mkdir -p /home/guest/.config/fcitx5/conf /home/guest/.config/fcitx5/profile.d 2>/dev/null || true

# profile: ใช้ engine keyboard-us และ keyboard-th (variant tis)
sudo tee /home/guest/.config/fcitx5/profile >/dev/null <<'PROFILE'
[Groups/0]
# Group Name
Name=Default
# Layout
Default Layout=us
# Default Input Method
DefaultIM=keyboard-th-tis

[Groups/0/Items/0]
# Name
Name=keyboard-us
# Layout
Layout=

[Groups/0/Items/1]
# Name
Name=keyboard-th-tis
# Layout
Layout=

[GroupOrder]
0=Default
PROFILE

# global config: ปุ่มสลับ = Grave (~) และ ปิด Trigger สำรอง
sudo tee /home/guest/.config/fcitx5/config >/dev/null <<'FCFG'
[Hotkey]
# ปุ่มสลับภาษาไทย/อังกฤษ = ` (Grave / ตัวหนอน)
TriggerKeys=grave
# ปิด ctrl+space เดิม กันชนกับแอป
AltTriggerKeys=
EnumerateForwardKeys=
EnumerateBackwardKeys=
EnumerateGroupForwardKeys=
EnumerateGroupBackwardKeys=

[Hotkey/TriggerKeys]
0=grave

[Behavior]
ActiveByDefault=False
ShareInputState=All
PreeditEnabledByDefault=True
FCFG

sudo chown -R guest:guest /home/guest/.config/fcitx5 2>/dev/null || true

# Autostart fcitx5 ตอน login XFCE
sudo -u guest mkdir -p /home/guest/.config/autostart 2>/dev/null || true
sudo tee /home/guest/.config/autostart/fcitx5.desktop >/dev/null <<'AS'
[Desktop Entry]
Type=Application
Name=Fcitx 5
Exec=fcitx5 -d
Icon=fcitx
Terminal=false
X-GNOME-Autostart-enabled=true
OnlyShowIn=XFCE;GNOME;KDE;LXDE;LXQt;MATE;
AS
sudo chown -R guest:guest /home/guest/.config/autostart 2>/dev/null || true

ok "TZ=Asia/Bangkok · Fcitx5 + XKB th(tis) TIS-820.2538 · สลับภาษาด้วยปุ่ม \` (Grave/ตัวหนอน)"

# ============================================================================
# PHASE 4 — Network (Wi-Fi + Firewall)
# ============================================================================
step "[4/13] Network"
sudo systemctl enable --now NetworkManager 2>/dev/null || true
if [ -n "$WIFI_SSID" ]; then
  sudo nmcli device wifi connect "$WIFI_SSID" password "$WIFI_PASS" 2>/dev/null \
    && ok "Wi-Fi: $WIFI_SSID เชื่อมสำเร็จ" \
    || warn "Wi-Fi เชื่อมล้มเหลว"
else
  ok "ข้าม Wi-Fi (\$WIFI_SSID ไม่ได้ตั้ง)"
fi

sudo ufw --force reset >/dev/null 2>&1
sudo ufw default deny incoming >/dev/null
sudo ufw default allow outgoing >/dev/null
sudo ufw allow from 127.0.0.1 >/dev/null
sudo ufw --force enable >/dev/null
ok "Firewall: deny incoming / allow outgoing / allow localhost"

# ============================================================================
# PHASE 5 — Download extension
# ============================================================================
step "[5/13] โหลด BNGSS Safe Browser extension"
sudo rm -rf "$EXT_DIR"
sudo mkdir -p "$EXT_DIR"
# EXT_ID เป็น deterministic — มาจาก "key" field ใน manifest.json (ไม่ต้องคำนวณ)
EXT_ID="icacgdjhgabapdfflndkjclpkggckdbk"
EXT_OK=0
if curl -fsSL "${SYSTEM_URL}/extension.zip" -o /tmp/ext.zip 2>/dev/null && [ -s /tmp/ext.zip ]; then
  sudo unzip -oq /tmp/ext.zip -d "$EXT_DIR"
  rm -f /tmp/ext.zip
  # ตรวจ manifest + rules ครบไหม
  if [ -f "$EXT_DIR/manifest.json" ] && [ -f "$EXT_DIR/rules/ads.json" ] && [ -f "$EXT_DIR/rules/gambling.json" ]; then
    sudo chmod -R a+rX "$EXT_DIR"
    EXT_OK=1
    ok "Extension: ${EXT_DIR} (id=${EXT_ID})"
  else
    warn "extension.zip ไม่ครบ (ขาด manifest หรือ rules/)"
  fi
else
  warn "โหลด extension ไม่สำเร็จ — จะข้าม (ไม่มี URL logging/blocking)"
fi

# ============================================================================
# PHASE 5b — Wi-Fi Native Helper (สำหรับ kiosk mode ให้เลือก Wi-Fi ใน extension)
# ============================================================================
step "[5b/13] Wi-Fi Helper (Native Messaging → nmcli)"
EXT_ID="icacgdjhgabapdfflndkjclpkggckdbk"
HOST_NAME="com.bngss.wifi"
HELPER_DIR="/opt/bngss"
HELPER_BIN="$HELPER_DIR/wifi-helper.py"

sudo mkdir -p "$HELPER_DIR"
if curl -fsSL "${SYSTEM_URL}/wifi-helper/wifi-helper.py" -o /tmp/wifi-helper.py 2>/dev/null && [ -s /tmp/wifi-helper.py ]; then
  sudo mv /tmp/wifi-helper.py "$HELPER_BIN"
  sudo chmod 0755 "$HELPER_BIN"
  sudo chown root:root "$HELPER_BIN"
  ok "Wi-Fi helper: $HELPER_BIN"
else
  warn "โหลด wifi-helper.py ไม่สำเร็จ — จะข้าม (extension เลือก Wi-Fi ไม่ได้)"
fi

# เขียน native-messaging manifest สำหรับ Chromium/Chrome/Edge
for NM_DIR in \
  /etc/chromium/native-messaging-hosts \
  /etc/opt/chrome/native-messaging-hosts \
  /etc/opt/edge/native-messaging-hosts; do
  sudo mkdir -p "$NM_DIR"
  sudo tee "$NM_DIR/$HOST_NAME.json" >/dev/null <<NMH
{
  "name": "$HOST_NAME",
  "description": "BNGSS Wi-Fi Helper (nmcli bridge)",
  "path": "$HELPER_BIN",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
NMH
  sudo chmod 0644 "$NM_DIR/$HOST_NAME.json"
done

# polkit: ให้ user "guest" ใช้ NetworkManager ผ่าน nmcli ได้โดยไม่ถามรหัส
sudo mkdir -p /etc/polkit-1/rules.d
sudo tee /etc/polkit-1/rules.d/50-bngss-nm.rules >/dev/null <<'PKR'
polkit.addRule(function(action, subject) {
  if (subject.user !== "guest") return;
  if (action.id.indexOf("org.freedesktop.NetworkManager.") === 0) {
    return polkit.Result.YES;
  }
});
PKR
sudo systemctl restart polkit 2>/dev/null || sudo systemctl restart polkitd 2>/dev/null || true
ok "Native host + polkit rule ติดตั้งแล้ว"

# --- Wi-Fi persistence กัน Deep Freeze ---
# 1) ทำ persistent path นอก overlay สำหรับเก็บ connections
sudo mkdir -p /var/lib/bngss/nm-connections
sudo chmod 0700 /var/lib/bngss/nm-connections

# 2) bind-mount system-connections ให้ Wi-Fi ที่ save รอด reboot แม้มี Deep Freeze บน /etc
if ! grep -q "/var/lib/bngss/nm-connections" /etc/fstab 2>/dev/null; then
  # migrate ของเดิม (ถ้ามี)
  if [ -d /etc/NetworkManager/system-connections ]; then
    sudo cp -a /etc/NetworkManager/system-connections/. /var/lib/bngss/nm-connections/ 2>/dev/null || true
  fi
  echo "/var/lib/bngss/nm-connections /etc/NetworkManager/system-connections none bind 0 0" \
    | sudo tee -a /etc/fstab >/dev/null
  sudo mkdir -p /etc/NetworkManager/system-connections
  sudo mount --bind /var/lib/bngss/nm-connections /etc/NetworkManager/system-connections 2>/dev/null || true
  ok "Wi-Fi persistence: /etc/NetworkManager/system-connections ↔ /var/lib/bngss/nm-connections"
else
  ok "Wi-Fi persistence bind-mount มีอยู่แล้ว"
fi

# 3) marker path สำหรับ Deep Freeze exclusion (ถ้ามีระบบ freeze)
sudo tee /var/lib/bngss/deep-freeze-exclude.list >/dev/null <<'LST'
/var/lib/bngss/
/etc/NetworkManager/system-connections/
/var/lib/NetworkManager/
LST
ok "Deep-Freeze exclusion list: /var/lib/bngss/deep-freeze-exclude.list"


# ============================================================================
# PHASE 6 — Chromium managed policy
# ============================================================================
step "[6/13] Chromium managed policy"
# กลยุทธ์:
#   - block ทุก extension จาก webstore ด้วย ExtensionInstallBlocklist:["*"]
#   - allow เฉพาะ ID ของเราด้วย ExtensionInstallAllowlist
#   - ExtensionSettings เว้น default เป็น "allowed" เพื่อไม่ให้ block --load-extension
POLICY_JSON=$(cat <<POLICY
{
  "HomepageLocation": "${SYSTEM_URL}",
  "HomepageIsNewTabPage": false,
  "RestoreOnStartup": 4,
  "RestoreOnStartupURLs": ["${SYSTEM_URL}"],
  "IncognitoModeAvailability": 1,
  "BrowserGuestModeEnabled": false,
  "BrowserSignin": 0,
  "SyncDisabled": true,
  "DeveloperToolsAvailability": 2,
  "DefaultNotificationsSetting": 2,
  "DefaultGeolocationSetting": 3,
  "PasswordManagerEnabled": false,
  "AutofillCreditCardEnabled": false,
  "AutofillAddressEnabled": false,
  "TranslateEnabled": false,
  "SpellcheckEnabled": false,
  "SearchSuggestEnabled": false,
  "MetricsReportingEnabled": false,
  "SafeBrowsingEnabled": true,
  "BackgroundModeEnabled": false,
  "DownloadRestrictions": 3,
  "PromptForDownloadLocation": false,
  "BookmarkBarEnabled": false,
  "ShowHomeButton": true,
  "URLBlocklist": [
    "chrome://flags", "chrome://settings", "chrome://net-internals",
    "chrome://policy", "file://*"
  ],
  "ExtensionInstallBlocklist": ["*"],
  "ExtensionInstallAllowlist": ["${EXT_ID}"],
  "ExtensionInstallForcelist": [],
  "ExtensionSettings": {
    "${EXT_ID}": {
      "installation_mode": "allowed",
      "toolbar_pin": "force_pinned",
      "runtime_allowed_hosts": ["<all_urls>"]
    }
  }
}
POLICY
)
for D in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed /etc/opt/chrome/policies/managed; do
  sudo mkdir -p "$D"
  echo "$POLICY_JSON" | sudo tee "$D/bngss-kiosk.json" >/dev/null
  sudo chmod 644 "$D/bngss-kiosk.json"
done
ok "Policy เขียนครบ 3 path (allowlist=${EXT_ID})"


# ============================================================================
# PHASE 7 — Guest user + XFCE config + snapshot (ทำเป็นชุดเดียว)
# ============================================================================
step "[7/13] Guest user + XFCE config + snapshot"

# 7.1 สร้าง user
if ! id guest >/dev/null 2>&1; then
  sudo useradd -m -s /bin/bash -c "Guest" guest
  sudo passwd -d guest
  ok "สร้าง user 'guest'"
else
  ok "user 'guest' มีอยู่แล้ว"
fi

# 7.2 เขียน XFCE config (ก่อน snapshot!)
sudo mkdir -p /home/guest/.config/xfce4/xfconf/xfce-perchannel-xml

sudo tee /home/guest/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-keyboard-shortcuts.xml >/dev/null <<'KB'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-keyboard-shortcuts" version="1.0">
  <property name="commands" type="empty">
    <property name="custom" type="empty">
      <property name="&lt;Primary&gt;&lt;Alt&gt;t" type="string" value="empty"/>
      <property name="&lt;Alt&gt;F2" type="string" value="empty"/>
      <property name="&lt;Alt&gt;F4" type="string" value="empty"/>
      <property name="&lt;Super&gt;e" type="string" value="empty"/>
      <property name="&lt;Super&gt;r" type="string" value="empty"/>
    </property>
  </property>
</channel>
KB

sudo tee /home/guest/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-screensaver.xml >/dev/null <<'SS'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-screensaver" version="1.0">
  <property name="lock" type="bool" value="false"/>
  <property name="idle" type="bool" value="false"/>
</channel>
SS

sudo chown -R guest:guest /home/guest/.config
ok "XFCE config เขียนลง /home/guest"

# 7.3 Snapshot → /var/lib/guest-base (Deep-Freeze base)
sudo mkdir -p /var/lib/guest-base
sudo rsync -a --delete /home/guest/ /var/lib/guest-base/
sudo touch /var/lib/guest-base/.initialized
ok "Snapshot Deep-Freeze base ที่ /var/lib/guest-base"

# ============================================================================
# PHASE 8 — Overlay service (ต้อง start ก่อน lightdm)
# ============================================================================
step "[8/13] Deep-Freeze overlay service"
sudo tee /etc/systemd/system/guest-overlay.service >/dev/null <<'SVC'
[Unit]
Description=Overlay tmpfs for /home/guest
DefaultDependencies=no
Before=local-fs.target lightdm.service
After=local-fs-pre.target
RequiresMountsFor=/home
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/bin/mkdir -p /run/guest-overlay
ExecStart=/bin/mount -t tmpfs -o size=1G tmpfs /run/guest-overlay
ExecStartPost=/bin/mkdir -p /run/guest-overlay/upper /run/guest-overlay/work
ExecStartPost=/bin/mount -t overlay overlay -o lowerdir=/var/lib/guest-base,upperdir=/run/guest-overlay/upper,workdir=/run/guest-overlay/work /home/guest
[Install]
WantedBy=local-fs.target
SVC
sudo systemctl daemon-reload
sudo systemctl enable guest-overlay.service >/dev/null 2>&1
ok "Overlay service enabled (มีผลหลัง reboot)"

# ============================================================================
# PHASE 9 — Local control daemon (:9998)
# ============================================================================
step "[9/13] Local control daemon"
sudo tee /usr/local/bin/bngss-ctl >/dev/null <<CTL
#!/usr/bin/env python3
import http.server, subprocess, json, time
PORT = ${CTL_PORT}
LOG  = "/var/log/bngss-ctl.log"
def log(m):
    try:
        with open(LOG,"a") as f: f.write(f"[{time.strftime('%F %T')}] {m}\n")
    except: pass
def run(cmd):
    try: subprocess.Popen(cmd, shell=True); return True
    except Exception as e: log(f"err {e}"); return False
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        p = self.path.rstrip("/"); ok = False
        if   p == "/reboot":     ok = run("sleep 2 && systemctl reboot")
        elif p == "/shutdown":   ok = run("sleep 2 && systemctl poweroff")
        elif p == "/logout":     ok = run("pkill -KILL -u guest")
        elif p == "/lock":       ok = run("xdg-screensaver lock")
        elif p == "/unlock":     ok = True
        elif p == "/health":     ok = True
        elif p == "/screenshot":
            fn=f"/tmp/kiosk-{int(time.time())}.png"; ok=run(f"scrot '{fn}'")
        log(f"POST {p} -> {ok}")
        self.send_response(200 if ok else 500)
        self.send_header("Content-Type","application/json")
        self._cors(); self.end_headers()
        self.wfile.write(json.dumps({"ok":ok,"path":p}).encode())
    def log_message(self,*a): pass
if __name__=="__main__":
    log(f"start :{PORT}")
    http.server.HTTPServer(("127.0.0.1",PORT),H).serve_forever()
CTL
sudo chmod +x /usr/local/bin/bngss-ctl
sudo tee /etc/systemd/system/bngss-ctl.service >/dev/null <<'UNIT'
[Unit]
Description=BNGSS Local Control Daemon
After=network.target
[Service]
Type=simple
ExecStart=/usr/local/bin/bngss-ctl
Restart=always
RestartSec=3
User=root
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now bngss-ctl.service
ok "Daemon: 127.0.0.1:${CTL_PORT}"

# ============================================================================
# PHASE 10 — Kiosk wrapper + LightDM auto-login
# ============================================================================
step "[10/13] Kiosk wrapper + auto-login"
sudo tee /usr/local/bin/bngss-kiosk >/dev/null <<WRAPPER
#!/usr/bin/env bash
# BNGSS Kiosk launcher — เปิดเฉพาะ user guest, ล้าง profile ทุก session
[ "\$(id -un)" != "guest" ] && exit 0

# Chromium profile บน tmpfs (เร็ว + reset ทุก reboot)
# ต้องเป็น path ที่ guest เขียนได้
CDATA="\$HOME/.cache/chromium-kiosk"
mkdir -p "\$CDATA" "\$HOME/.cache/chromium-disk"
# ลบ singleton lock ที่อาจค้างจาก crash
rm -f "\$CDATA"/Singleton* 2>/dev/null

# ซ่อน cursor เมื่อไม่ขยับ
unclutter -idle 3 -root >/dev/null 2>&1 &

URL="${SYSTEM_URL}"

# --load-extension + --disable-extensions-except = force load เฉพาะของเรา
EXT_ARGS=""
if [ -f "${EXT_DIR}/manifest.json" ]; then
  EXT_ARGS="--load-extension=${EXT_DIR} --disable-extensions-except=${EXT_DIR}"
fi

# Watchdog: crash → restart อัตโนมัติ (แต่ backoff ถ้า crash เร็วซ้ำ)
CRASH_COUNT=0; LAST_CRASH=0
while true; do
  NOW=\$(date +%s)
  [ \$((NOW - LAST_CRASH)) -lt 10 ] && CRASH_COUNT=\$((CRASH_COUNT + 1)) || CRASH_COUNT=0
  [ \$CRASH_COUNT -gt 5 ] && { echo "Chromium crashed >5x in a row, backing off 30s"; sleep 30; CRASH_COUNT=0; }
  LAST_CRASH=\$NOW

  ${BROWSER_BIN} \\
    --user-data-dir="\$CDATA" \\
    --disk-cache-dir="\$HOME/.cache/chromium-disk" \\
    --disk-cache-size=104857600 \\
    \$EXT_ARGS \\
    --kiosk "\$URL" \\
    --start-fullscreen \\
    --no-first-run --no-default-browser-check \\
    --disable-infobars --noerrdialogs \\
    --disable-session-crashed-bubble --disable-restore-session-state \\
    --disable-features=TranslateUI,MediaRouter,OptimizationHints,InterestFeedContentSuggestions \\
    --disable-background-networking --disable-background-timer-throttling \\
    --disable-breakpad --disable-component-update --disable-domain-reliability \\
    --disable-sync --disable-translate --disable-client-side-phishing-detection \\
    --disable-default-apps --disable-hang-monitor --disable-popup-blocking \\
    --disable-prompt-on-repost --disable-renderer-backgrounding \\
    --disable-pinch --overscroll-history-navigation=0 \\
    --metrics-recording-only --no-pings \\
    --password-store=basic --use-mock-keychain \\
    --autoplay-policy=no-user-gesture-required \\
    --enable-features=CanvasOopRasterization \\
    --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist \\
    --process-per-site \\
    2>>"\$HOME/.cache/chromium-kiosk.log"
  sleep 3
done
WRAPPER
sudo chmod +x /usr/local/bin/bngss-kiosk


sudo tee /etc/xdg/autostart/bngss-kiosk.desktop >/dev/null <<'KIOSK'
[Desktop Entry]
Type=Application
Name=BNGSS Kiosk
Exec=/usr/local/bin/bngss-kiosk
Terminal=false
X-GNOME-Autostart-enabled=true
KIOSK

# LightDM auto-login
sudo mkdir -p /etc/lightdm
[ -f /etc/lightdm/lightdm.conf ] && sudo cp /etc/lightdm/lightdm.conf /etc/lightdm/lightdm.conf.bak.$(date +%s)
if grep -q "^\[Seat:\*\]" /etc/lightdm/lightdm.conf 2>/dev/null; then
  sudo sed -i '/^\[Seat:\*\]/,/^\[/{/^autologin-user=/d; /^autologin-user-timeout=/d}' /etc/lightdm/lightdm.conf
  sudo sed -i '/^\[Seat:\*\]/a autologin-user=guest\nautologin-user-timeout=0' /etc/lightdm/lightdm.conf
else
  sudo tee -a /etc/lightdm/lightdm.conf >/dev/null <<'LDM'
[Seat:*]
autologin-user=guest
autologin-user-timeout=0
LDM
fi
ok "Kiosk wrapper + LightDM auto-login พร้อม"

# ============================================================================
# PHASE 11 — Watchdogs (daily reboot / healthcheck / idle)
# ============================================================================
step "[11/13] Watchdogs"

# 11.1 Daily reboot timer
sudo tee /etc/systemd/system/bngss-daily-reboot.service >/dev/null <<'RS'
[Unit]
Description=BNGSS Daily Reboot
[Service]
Type=oneshot
ExecStart=/bin/systemctl reboot
RS
sudo tee /etc/systemd/system/bngss-daily-reboot.timer >/dev/null <<TM
[Unit]
Description=BNGSS Daily Reboot Timer
[Timer]
OnCalendar=*-*-* ${DAILY_REBOOT_TIME}:00
Persistent=true
[Install]
WantedBy=timers.target
TM

# 11.2 Healthcheck
sudo tee /usr/local/bin/bngss-healthcheck >/dev/null <<HC
#!/usr/bin/env bash
while true; do
  curl -fsS -X POST http://127.0.0.1:${CTL_PORT}/health -m 3 >/dev/null 2>&1 \
    || systemctl restart bngss-ctl.service
  if who | grep -q '^guest '; then
    pgrep -u guest -x ${BROWSER_BIN} >/dev/null 2>&1 || \
      systemctl restart lightdm 2>/dev/null || true
  fi
  sleep 60
done
HC
sudo chmod +x /usr/local/bin/bngss-healthcheck
sudo tee /etc/systemd/system/bngss-healthcheck.service >/dev/null <<'HCU'
[Unit]
Description=BNGSS Healthcheck
After=network.target
[Service]
ExecStart=/usr/local/bin/bngss-healthcheck
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
HCU

sudo systemctl daemon-reload
sudo systemctl enable --now bngss-daily-reboot.timer >/dev/null 2>&1
sudo systemctl enable --now bngss-healthcheck.service >/dev/null 2>&1
ok "Daily reboot ${DAILY_REBOOT_TIME} + Healthcheck รัน"

# 11.3 Idle logout (optional)
if [ "${IDLE_LOGOUT_MIN}" -gt 0 ] 2>/dev/null; then
  sudo tee /usr/local/bin/bngss-idle >/dev/null <<IDLE
#!/usr/bin/env bash
LIMIT_MS=\$(( ${IDLE_LOGOUT_MIN} * 60 * 1000 ))
while true; do
  if [ "\$(id -un)" = "guest" ]; then
    I=\$(xprintidle 2>/dev/null || echo 0)
    [ "\$I" -gt "\$LIMIT_MS" ] && \
      curl -fsS -X POST http://127.0.0.1:${CTL_PORT}/logout -m 3 >/dev/null 2>&1
  fi
  sleep 30
done
IDLE
  sudo chmod +x /usr/local/bin/bngss-idle
  sudo tee /etc/xdg/autostart/bngss-idle.desktop >/dev/null <<'IDLED'
[Desktop Entry]
Type=Application
Name=BNGSS Idle Watch
Exec=/usr/local/bin/bngss-idle
Terminal=false
IDLED
  ok "Idle logout ${IDLE_LOGOUT_MIN} นาที"
fi

# ============================================================================
# PHASE 12 — Lockdown (ทำหลังทุกอย่างเสร็จ — กันตัวเองล็อกออก)
# ============================================================================
step "[12/13] Lockdown"

# USB storage
sudo tee /etc/modprobe.d/bngss-blacklist.conf >/dev/null <<'BL'
blacklist usb-storage
blacklist uas
BL
ok "USB storage blacklisted"

# TTY switching (optional)
if [ "$LOCK_TTY" = "1" ]; then
  sudo mkdir -p /etc/X11/xorg.conf.d
  sudo tee /etc/X11/xorg.conf.d/99-bngss-no-tty.conf >/dev/null <<'TTY'
Section "ServerFlags"
    Option "DontVTSwitch" "true"
    Option "DontZap"      "true"
EndSection
TTY
  warn "LOCK_TTY=1 → admin ต้อง SSH หรือ recovery boot"
else
  sudo rm -f /etc/X11/xorg.conf.d/99-bngss-no-tty.conf
  ok "TTY เปิดไว้ (admin: Ctrl+Alt+F2)"
fi

# ปิด service ไม่จำเป็น (boot เร็ว)
for s in bluetooth.service cups.service cups-browsed.service ModemManager.service \
         avahi-daemon.service avahi-daemon.socket \
         apt-daily.timer apt-daily-upgrade.timer \
         unattended-upgrades.service packagekit.service \
         speech-dispatcher.service motd-news.timer \
         NetworkManager-wait-online.service; do
  sudo systemctl disable --now "$s" 2>/dev/null || true
done
ok "ปิด service ที่ไม่ใช้ (boot เร็วขึ้น)"

# ============================================================================
# PHASE 13 — Desktop shortcut + Finish
# ============================================================================
step "[13/13] Desktop shortcut"
DESKTOP_DIR="$HOME/Desktop"
[ -d "$DESKTOP_DIR" ] || DESKTOP_DIR="$HOME/เดสก์ท็อป"
[ -d "$DESKTOP_DIR" ] || { mkdir -p "$HOME/Desktop"; DESKTOP_DIR="$HOME/Desktop"; }
cat > "$DESKTOP_DIR/BNGSS-School.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=ระบบโรงเรียน BNGSS
Exec=$BROWSER_BIN --app=${SYSTEM_URL}
Icon=web-browser
Terminal=false
Categories=Education;Network;
EOF
chmod +x "$DESKTOP_DIR/BNGSS-School.desktop"
ok "Shortcut พร้อม"

# ─── สรุป ────────────────────────────────────────────────────────────────────
echo -e "
${G}════════════════════════════════════════════════${N}
  ${G}✓${N} เสร็จสมบูรณ์
${G}════════════════════════════════════════════════${N}
  Browser       : ${BROWSER_BIN}
  URL           : ${Y}${SYSTEM_URL}${N}
  Extension     : $([ -f "${EXT_DIR}/manifest.json" ] && echo "✓ installed (${EXT_ID})" || echo "✗ ไม่มี")
  Local daemon  : http://127.0.0.1:${CTL_PORT}
  Daily reboot  : ${DAILY_REBOOT_TIME}
  Idle logout   : ${IDLE_LOGOUT_MIN} min
  TTY lock      : $([ "$LOCK_TTY" = "1" ] && echo "ON" || echo "OFF (Ctrl+Alt+F2 ใช้ได้)")
  Full install  : $([ "$FULL_INSTALL" = "1" ] && echo "YES" || echo "NO (เบา)")

  รีบูตหนึ่งครั้ง → เข้า kiosk อัตโนมัติ (user: guest)
${G}════════════════════════════════════════════════${N}
"
# ถ้า stdin เป็น pipe (curl|bash) จะไม่มี TTY → default = ไม่รีบูตอัตโนมัติ
if [ -t 0 ]; then
  read -p "รีบูตเลยไหม? [y/N] " yn || yn=""
else
  yn=""
  echo "   (pipe mode) → ข้ามคำถาม, รีบูตเองด้วย: sudo reboot"
fi
case "$yn" in [Yy]*) sudo systemctl reboot ;; *) echo "รีบูตเมื่อพร้อม: sudo reboot" ;; esac
