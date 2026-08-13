#!/usr/bin/env bash
# ============================================================================
#  Smart School Kiosk — MX Linux Auto Setup (2 โหมด)
# ----------------------------------------------------------------------------
#  โหมด (KIOSK_MODE):
#    door    — HP Pavilion x2 ตู้สแกนหน้าประตู (default URL = /kiosk)
#              • Wake daemon (ปลุกจอด้วยกล้อง), Watchdog, Health-check
#              • Daily reboot 03:00, Full lock (ห้ามออกจาก URL)
#    student — คอมพิวเตอร์ห้องนักเรียน (default URL = / )
#              • ไม่มี wake daemon, ไม่ full-lock (ให้กด minimize/สลับแท็บได้)
#              • เปิด Student Agent สำหรับ Classroom Monitor ในเบื้องหลัง
#              • Idle logout 30 นาที + Daily reboot 22:30
#
#  ตัวอย่าง:
#     sudo KIOSK_MODE=door \
#          KIOSK_URL="https://bngss.vercel.app/kiosk" \
#          KIOSK_WIFI_SSID="MySchoolWiFi" KIOSK_WIFI_PASS="password" \
#          bash setup-mxlinux-kiosk.sh
#
#     sudo KIOSK_MODE=student bash setup-mxlinux-kiosk.sh
#
#  Idempotent — รันซ้ำได้ log อยู่ที่ /var/log/kiosk-setup.log
# ============================================================================

set -euo pipefail

# ---------- ค่าที่ปรับได้ผ่าน env ----------
KIOSK_MODE_SET=""; [[ -n "${KIOSK_MODE:-}" ]] && KIOSK_MODE_SET=1   # ผู้ใช้ระบุโหมดเอง → CMS ห้าม override
KIOSK_MODE="${KIOSK_MODE:-door}"                     # door | student
KIOSK_USER="${KIOSK_USER:-${SUDO_USER:-$(logname 2>/dev/null || echo demo)}}"
KIOSK_WIFI_SSID="${KIOSK_WIFI_SSID:-}"
KIOSK_WIFI_PASS="${KIOSK_WIFI_PASS:-}"

# ── โหลด kiosk_config จาก CMS (ext-config) เพื่อ override ค่าที่ผู้ใช้ตั้งไว้ในหน้า Kiosk Setup ──
# ผู้ใช้ไม่ต้องส่ง env var เอง — ค่าที่ตั้งในเว็บจะถูกใช้เป็น default โดยอัตโนมัติ
CMS_BASE="${CMS_BASE:-https://gwmszzoqqxmejefhayqf.supabase.co}"
CMS_ANON_KEY="${CMS_ANON_KEY:-sb_publishable_NlRn4zzOUtHsn4swyH6F7Q_ADVmUe9v}"

# ── Backend guard — ต้องเป็น backend ของโรงเรียนเท่านั้น ห้าม Lovable Cloud ──
CANONICAL_BACKEND="https://gwmszzoqqxmejefhayqf.supabase.co"
case "$CMS_BASE" in
  *lovableproject.com*|*lovable.dev*|*dlkyxvhnnffblerwedjz*)
    echo "⚠  CMS_BASE ชี้ไป Lovable Cloud ($CMS_BASE) — บังคับกลับเป็น backend โรงเรียน"
    CMS_BASE="$CANONICAL_BACKEND"
    CMS_ANON_KEY="sb_publishable_NlRn4zzOUtHsn4swyH6F7Q_ADVmUe9v"
    ;;
esac
echo "► Backend: $CMS_BASE"

# ทำให้ python3 พร้อมใช้ก่อน — บาง MX Linux minimal ไม่มี python3
if ! command -v python3 >/dev/null 2>&1; then
  echo "► ติดตั้ง python3 (จำเป็นสำหรับ parse CMS config)..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y -qq python3 curl >/dev/null 2>&1 || true
fi

CFG_JSON=$(curl -fsSL --max-time 10 -H "apikey: $CMS_ANON_KEY" "$CMS_BASE/functions/v1/ext-config" 2>/dev/null || true)
if [[ -z "$CFG_JSON" ]]; then
  echo "⚠  ดึง CMS config ไม่ได้ (network/DNS?) — ใช้ค่า default"
elif ! command -v python3 >/dev/null 2>&1; then
  echo "⚠  ไม่มี python3 — ข้าม CMS config"
else
  export CFG_JSON_RAW="$CFG_JSON"
  EVAL_OUT=$(CFG_JSON_RAW="$CFG_JSON" KIOSK_MODE_SET="$KIOSK_MODE_SET" python3 <<'PYEOF' 2>&1
import json,os,sys
raw={}
try: raw=json.loads(os.environ.get("CFG_JSON_RAW",""))
except Exception as e: sys.stderr.write(f"parse err: {e}\n"); sys.exit(0)
d=raw.get('kiosk_config') or {}
def emit(k,v):
    if v is None or v=='': return
    print(f'export {k}={json.dumps(str(v))}')
emit('KIOSK_LOGO_URL', raw.get('school_logo') or raw.get('app_favicon_url'))
emit('KIOSK_SCHOOL_NAME', raw.get('school_name') or raw.get('app_name'))
emit('KIOSK_THEME_COLOR', raw.get('theme_color') or raw.get('primary_color'))
if d:
    m=d.get('mode')
    if m and not os.environ.get('KIOSK_MODE_SET'): emit('KIOSK_MODE',m)
    for k_cfg,k_env in [
      ('kioskUrl','KIOSK_URL'),('kioskUser','KIOSK_USER'),
      ('wifiSsid','KIOSK_WIFI_SSID'),('wifiPass','KIOSK_WIFI_PASS'),
      ('rebootTime','KIOSK_DAILY_REBOOT'),
      ('idleLogoutMin','KIOSK_IDLE_LOGOUT_MIN'),('idleShutdownMin','KIOSK_IDLE_SHUTDOWN_MIN'),
      ('powerOn','KIOSK_POWER_ON'),('powerOff','KIOSK_POWER_OFF'),
      ('exitPin','KIOSK_EXIT_PIN'),
    ]:
        if not os.environ.get(k_env): emit(k_env,d.get(k_cfg))
    if d.get('enableDailyReboot') is False and not os.environ.get('KIOSK_DAILY_REBOOT'):
        print('export KIOSK_DAILY_REBOOT=""')
    sys.stderr.write(f'# CMS: mode={d.get("mode")} powerOn={d.get("powerOn")} powerOff={d.get("powerOff")} reboot={d.get("rebootTime")}\n')
PYEOF
)
  # แสดง export ที่จะรัน (debug)
  echo "► CMS config → env:"
  echo "$EVAL_OUT" | sed -n 's/^export /   /p'
  # eval เฉพาะบรรทัด export
  eval "$(echo "$EVAL_OUT" | grep -E '^export ' || true)"
  echo "► โหลด kiosk_config จาก CMS แล้ว"
fi
# ------------------------------------------------------------

# ปรับ URL ให้ตรงโหมด — CMS เก็บ kioskUrl ค่าเดียว (มักเป็นหน้า /kiosk ของโหมด door)
if [[ -n "${KIOSK_URL:-}" ]]; then
  _u="${KIOSK_URL%/}"
  if [[ "$KIOSK_MODE" == "student" && "$_u" == */kiosk ]]; then
    KIOSK_URL="${_u%/kiosk}/"
    echo "► student mode: ปรับ URL → $KIOSK_URL"
  elif [[ "$KIOSK_MODE" == "door" && "$_u" != */kiosk ]]; then
    KIOSK_URL="$_u/kiosk"
    echo "► door mode: ปรับ URL → $KIOSK_URL"
  fi
fi

# ค่า default แยกตามโหมด
if [[ "$KIOSK_MODE" == "student" ]]; then
  KIOSK_URL="${KIOSK_URL:-https://bngss.vercel.app/}"
  KIOSK_DAILY_REBOOT="${KIOSK_DAILY_REBOOT-}"                 # student: ไม่ reboot กลางวัน ใช้ shutdown แทน
  KIOSK_IDLE_LOGOUT_MIN="${KIOSK_IDLE_LOGOUT_MIN:-30}"
  KIOSK_IDLE_SHUTDOWN_MIN="${KIOSK_IDLE_SHUTDOWN_MIN:-120}"
  KIOSK_POWER_ON="${KIOSK_POWER_ON:-07:30}"
  KIOSK_POWER_OFF="${KIOSK_POWER_OFF:-17:30}"
  KIOSK_MONITOR_AGENT_URL="${KIOSK_MONITOR_AGENT_URL:-${KIOSK_URL%/}/dashboard/monitor/agent}"
  KIOSK_EXTENSION_URL="${KIOSK_EXTENSION_URL:-${KIOSK_URL%/}/safe-browser-extension.zip}"
else
  KIOSK_MODE="door"
  KIOSK_URL="${KIOSK_URL:-https://bngss.vercel.app/kiosk}"
  KIOSK_DAILY_REBOOT="${KIOSK_DAILY_REBOOT:-03:00}"
  KIOSK_IDLE_LOGOUT_MIN="${KIOSK_IDLE_LOGOUT_MIN:-0}"
  KIOSK_IDLE_SHUTDOWN_MIN="${KIOSK_IDLE_SHUTDOWN_MIN:-0}"
  KIOSK_POWER_ON="${KIOSK_POWER_ON:-06:30}"
  KIOSK_POWER_OFF="${KIOSK_POWER_OFF-}"                       # อนุญาต empty จาก CMS
  KIOSK_MONITOR_AGENT_URL="${KIOSK_MONITOR_AGENT_URL:-}"
  KIOSK_EXTENSION_URL="${KIOSK_EXTENSION_URL:-}"   # door mode: ไม่ติดตั้ง extension (ตู้ประตูไม่มีนักเรียนใช้เว็บ)
fi
# PIN สำหรับปลดล็อก Alt+F4 / Alt+Tab / Super / F11 / Ctrl+W / Ctrl+Q — default ตรงกับ CMS
KIOSK_EXIT_PIN="${KIOSK_EXIT_PIN:-bng521987}"

# ------------------------------------------

LOG_FILE=/var/log/kiosk-setup.log
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1
echo
echo "======================================================================"
echo "  Smart School Kiosk — MX Linux Setup — $(date -Iseconds)"
echo "======================================================================"

# ---------------- helpers ----------------
log()  { echo "[$(date +%H:%M:%S)] $*"; }
die()  { echo "❌  $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
backup_once() {
  local f="$1"
  [[ -f "$f" && ! -f "$f.kiosk.bak" ]] && cp -a "$f" "$f.kiosk.bak" || true
}

[[ $EUID -eq 0 ]] || die "ต้องรันด้วย sudo:  sudo ./setup-mxlinux-kiosk.sh"

# ---------------- ตรวจว่าบูตด้วย systemd หรือไม่ (MX Linux default = SysVinit) ----------------
# ถ้าไม่ใช่ systemd → systemctl enable/mask/daemon-reload ทั้งหมดจะไม่ทำงานจริง
# (services ที่เรา enable ไว้จะไม่ start เมื่อรีบูต ทำให้ kiosk ไม่ขึ้น)
if ! { [[ -d /run/systemd/system ]] && [[ "$(ps -p 1 -o comm= 2>/dev/null)" == "systemd" ]]; }; then
  echo
  echo "❌  เครื่องนี้ไม่ได้บูตด้วย systemd (MX Linux default = SysVinit)"
  echo "    ระบบ Kiosk ต้องใช้ systemd เพราะมี service/timer หลายตัวที่ต้องรันตอนบูต"
  echo
  echo "    วิธีแก้ (ทำครั้งเดียว):"
  echo "    1) รีบูตเครื่อง"
  echo "    2) ที่หน้าจอ GRUB (เมนู MX Linux) → กดลูกศรลงเลือกบรรทัด"
  echo "         \"MX ... (systemd)\"  หรือกด F5 → เลือก systemd → Enter"
  echo "    3) หลังบูตด้วย systemd แล้ว → เปิด Terminal แล้วรันสคริปต์นี้อีกครั้ง"
  echo
  echo "    หรือตั้งให้บูต systemd ถาวร (แนะนำ):"
  echo "       sudo sed -i 's|GRUB_CMDLINE_LINUX_DEFAULT=\"|&init=/lib/systemd/systemd |' /etc/default/grub"
  echo "       sudo update-grub && sudo reboot"
  echo
  exit 2
fi

# ---------------- 0) Pre-flight ----------------
log "▶  [0/10] Pre-flight check..."
id "$KIOSK_USER" &>/dev/null || die "ไม่พบผู้ใช้ '$KIOSK_USER' — สร้างผู้ใช้ก่อน หรือกำหนด KIOSK_USER=..."
USER_HOME=$(getent passwd "$KIOSK_USER" | cut -d: -f6)
[[ -d "$USER_HOME" ]] || die "ไม่พบ home directory ของ $KIOSK_USER"

ARCH=$(uname -m)
DISK_FREE_MB=$(df -Pm / | awk 'NR==2{print $4}')
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
[[ "$DISK_FREE_MB" -ge 3000 ]] || die "พื้นที่ว่าง / ต้อง ≥ 3GB (ตอนนี้ ${DISK_FREE_MB}MB)"
log "   Mode=$KIOSK_MODE  User=$KIOSK_USER  Home=$USER_HOME  Arch=$ARCH  RAM=${RAM_MB}MB  DiskFree=${DISK_FREE_MB}MB"
log "   URL=$KIOSK_URL"
[[ -n "$KIOSK_MONITOR_AGENT_URL" ]] && log "   Monitor Agent=$KIOSK_MONITOR_AGENT_URL"

# ตรวจ internet (ไม่ตายถ้าไม่มี — ให้ผู้ใช้ setup wifi ต่อ)
if ! curl -sf --max-time 5 -o /dev/null https://deb.debian.org/; then
  log "⚠  ไม่มี internet — จะพยายามต่อ Wi-Fi ให้"
fi

KIOSK_ORIGIN=$(echo "$KIOSK_URL" | awk -F/ '{print $1"//"$3}')

# ---------------- 1) Wi-Fi (option) ----------------
if [[ -n "$KIOSK_WIFI_SSID" ]]; then
  log "▶  [1/10] ต่อ Wi-Fi \"$KIOSK_WIFI_SSID\"..."
  if have nmcli; then
    nmcli device wifi rescan 2>/dev/null || true
    nmcli device wifi connect "$KIOSK_WIFI_SSID" password "$KIOSK_WIFI_PASS" 2>&1 | \
      sed 's/password [^ ]*/password ***/' || log "⚠  ต่อ Wi-Fi ไม่สำเร็จ (จะลองใหม่ตอน apt)"
  else
    log "⚠  ไม่พบ nmcli — ข้ามการต่อ Wi-Fi"
  fi
else
  log "▶  [1/10] ข้ามการตั้ง Wi-Fi (ไม่ระบุ SSID)"
fi

# ---------------- 2) apt install ----------------
log "▶  [2/10] apt update + ติดตั้ง package..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y || die "apt update ล้มเหลว — ตรวจ internet"

PKGS=(
  chromium unclutter xdotool x11-xserver-utils python3 python3-pip
  curl ca-certificates fonts-thai-tlwg fonts-noto-color-emoji
  network-manager pulseaudio pulseaudio-utils pavucontrol alsa-utils libasound2-plugins cron
  lightdm lightdm-gtk-greeter accountsservice
  plymouth plymouth-themes plymouth-label imagemagick
  xbindkeys zenity
)

apt-get install -y --no-install-recommends "${PKGS[@]}" 2>/dev/null || \
  apt-get install -y --no-install-recommends chromium-browser unclutter xdotool \
    x11-xserver-utils python3 curl pulseaudio pulseaudio-utils alsa-utils lightdm

CHROMIUM_BIN=$(command -v chromium || command -v chromium-browser || true)
[[ -n "$CHROMIUM_BIN" ]] || die "ติดตั้ง Chromium ไม่สำเร็จ"
log "   Chromium: $CHROMIUM_BIN"

# ---------------- 2.5) Plymouth boot splash ----------------
# NOTE: การตั้งค่า Plymouth จริงอยู่ block 5.5 (หลังดึง CMS branding) — block นี้เว้นไว้เฉยๆ
log "▶  [2.5/10] (ข้าม — Plymouth จะติดตั้งใน 5.5 หลังโหลด CMS branding)"


# ---------------- 3) Wake daemon (door mode เท่านั้น) ----------------
install -d -m 755 /opt/kiosk
if [[ "$KIOSK_MODE" == "door" ]]; then
log "▶  [3/10] Wake daemon (door mode)..."
cat >/opt/kiosk/wake-server.py <<'PY'
#!/usr/bin/env python3
"""Kiosk wake daemon — POST/GET /wake → xset dpms force on + xdotool mousemove"""
import os, subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

DISPLAY = os.environ.get("DISPLAY", ":0")
XAUTH = os.environ.get("XAUTHORITY") or f"/home/{os.environ.get('KIOSK_USER','')}/.Xauthority"

def wake():
    env = os.environ.copy(); env["DISPLAY"] = DISPLAY
    if os.path.exists(XAUTH): env["XAUTHORITY"] = XAUTH
    for cmd in (["xset","dpms","force","on"], ["xset","s","reset"],
                ["xdotool","mousemove_relative","1","0"],
                ["xdotool","mousemove_relative","--","-1","0"]):
        try: subprocess.run(cmd, env=env, timeout=2, check=False)
        except Exception: pass

class H(BaseHTTPRequestHandler):
    def _ok(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
    def do_GET(self):
        if self.path.startswith("/wake"): wake()
        self._ok()
    def do_POST(self):
        if self.path.startswith("/wake"): wake()
        self._ok()
    def do_OPTIONS(self): self._ok()
    def log_message(self, *a, **k): pass

if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 9999), H).serve_forever()
PY
chmod +x /opt/kiosk/wake-server.py

cat >/etc/systemd/system/kiosk-wake.service <<EOF
[Unit]
Description=Smart School Kiosk Wake Daemon
After=graphical.target

[Service]
Type=simple
User=$KIOSK_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=$USER_HOME/.Xauthority
Environment=KIOSK_USER=$KIOSK_USER
ExecStart=/usr/bin/python3 /opt/kiosk/wake-server.py
Restart=always
RestartSec=3

[Install]
WantedBy=graphical.target
EOF
else
  log "▶  [3/10] ข้าม wake daemon (student mode)"
fi

# ---------------- 3.5) Local Control Daemon (port 9998) ----------------
# รับคำสั่งจาก Student Agent / Monitor: /shutdown /reboot /logout /open-url
log "▶  [3.5/10] Local control daemon (port 9998)..."
cat >/opt/kiosk/local-ctl.py <<'PY'
#!/usr/bin/env python3
"""Kiosk local control daemon
   POST /shutdown  → shutdown -h now
   POST /reboot    → reboot
   POST /logout    → kill user session
   POST /open-url  → เปิด URL ใน chromium หลัก (window ปัจจุบัน)
"""
import os, subprocess, json
from http.server import BaseHTTPRequestHandler, HTTPServer
USER = os.environ.get("KIOSK_USER","")
DISPLAY = os.environ.get("DISPLAY", ":0")
XAUTH = f"/home/{USER}/.Xauthority" if USER else ""

def read_battery():
    """อ่านสถานะแบตเตอรี่จาก /sys/class/power_supply"""
    base = "/sys/class/power_supply"
    out = {"present": False}
    try:
        for name in sorted(os.listdir(base)):
            if not name.upper().startswith("BAT"):
                continue
            d = os.path.join(base, name)
            def rd(f):
                try:
                    return open(os.path.join(d, f)).read().strip()
                except Exception:
                    return None
            out = {
                "present": True,
                "name": name,
                "percent": int(rd("capacity") or 0),
                "status": rd("status"),
                "charge_limit": rd("charge_control_end_threshold"),
            }
            break
        ac = os.path.join(base, "AC")
        if os.path.exists(ac):
            out["on_ac"] = (open(os.path.join(ac, "online")).read().strip() == "1")
    except Exception:
        pass
    return out

def sh(cmd):
    try: subprocess.Popen(cmd, env={**os.environ, "DISPLAY": DISPLAY, "XAUTHORITY": XAUTH})
    except Exception as e: print("err", e)

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
    def _ok(self, code=204, body=b""):
        self.send_response(code); self._cors()
        if body: self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(body)))
        self.end_headers()
        if body: self.wfile.write(body)
    def do_OPTIONS(self): self._ok()
    def do_GET(self):
        if self.path == "/status":
            return self._ok(200, json.dumps({"ok":True, "battery": read_battery()}).encode())
        if self.path == "/battery":
            return self._ok(200, json.dumps(read_battery()).encode())
        return self._ok(404)
    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""
        try: data = json.loads(body or b"{}")
        except: data = {}
        p = self.path
        if p == "/shutdown":
            sh(["sudo","-n","/sbin/shutdown","-h","+0"])
        elif p == "/reboot":
            sh(["sudo","-n","/sbin/reboot"])
        elif p == "/logout":
            sh(["pkill","-KILL","-u",USER])
        elif p == "/open-url":
            url = str(data.get("url",""))
            if url:
                # เปิดใน chromium ปัจจุบัน (ใช้ xdotool + chromium CLI)
                sh(["chromium","--new-tab",url]) if os.path.exists("/usr/bin/chromium") else sh(["chromium-browser","--new-tab",url])
        elif p == "/screen-off":
            # DPMS ถูก disable ไว้ที่ boot → ต้อง +dpms ก่อนสั่ง force off
            sh(["xset","+dpms"]); sh(["xset","dpms","force","off"])
        elif p == "/screen-on":
            sh(["xset","dpms","force","on"])
            sh(["xset","s","reset"])
            # กลับไป disable DPMS ตามค่าเดิม (kiosk ไม่ให้จอดับเอง)
            sh(["xset","-dpms"]); sh(["xset","s","off"])
        else:
            return self._ok(404)
        return self._ok(204)
    def log_message(self,*a,**k): pass

if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 9998), H).serve_forever()
PY
chmod +x /opt/kiosk/local-ctl.py

cat >/etc/systemd/system/kiosk-ctl.service <<EOF
[Unit]
Description=Kiosk Local Control Daemon
After=graphical.target
[Service]
Type=simple
User=$KIOSK_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=$USER_HOME/.Xauthority
Environment=KIOSK_USER=$KIOSK_USER
ExecStart=/usr/bin/python3 /opt/kiosk/local-ctl.py
Restart=always
RestartSec=3
[Install]
WantedBy=graphical.target
EOF

# ---------------- 3.6) Sudoers — ให้ user สั่ง shutdown/reboot ได้ ----------------
log "▶  [3.6/10] Sudoers NOPASSWD สำหรับ shutdown/reboot..."
cat >/etc/sudoers.d/kiosk-power <<EOF
$KIOSK_USER ALL=(ALL) NOPASSWD: /sbin/shutdown, /sbin/reboot, /sbin/poweroff, /usr/sbin/rtcwake, /bin/systemctl suspend, /bin/systemctl hibernate
EOF
chmod 440 /etc/sudoers.d/kiosk-power

# ---------------- 3.7) Full Power mode — ปิด suspend/hibernate + CPU performance ----------------
log "▶  [3.7/10] Full power mode (no sleep, CPU performance)..."
# mask sleep targets — ห้ามระบบเข้า suspend/hibernate ตอนใช้งาน
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true

# logind — ปิด auto-suspend เวลาปิดฝา / idle
if [[ -f /etc/systemd/logind.conf ]]; then
  backup_once /etc/systemd/logind.conf
  sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/;
          s/^#\?HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/;
          s/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/;
          s/^#\?IdleAction=.*/IdleAction=ignore/;
          s/^#\?IdleActionSec=.*/IdleActionSec=0/' /etc/systemd/logind.conf
fi

# CPU governor = performance (ตอนใช้งาน)
apt-get install -y --no-install-recommends cpufrequtils 2>/dev/null || true
echo 'GOVERNOR="performance"' >/etc/default/cpufrequtils 2>/dev/null || true
for c in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
  [[ -w "$c" ]] && echo performance > "$c" 2>/dev/null || true
done

# systemd service ตั้ง governor ทุกครั้ง boot
cat >/etc/systemd/system/kiosk-cpu-perf.service <<EOF
[Unit]
Description=Kiosk CPU Performance Governor
After=multi-user.target
[Service]
Type=oneshot
ExecStart=/bin/sh -c 'for c in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do [ -w "\$c" ] && echo performance > "\$c" || true; done'
[Install]
WantedBy=multi-user.target
EOF
systemctl enable kiosk-cpu-perf.service >/dev/null 2>&1 || true

# UPower — ปิด critical battery action (กันโน้ตบุ๊ค hibernate/shutdown ตอน battery ต่ำ/เสื่อม)
# สร้างไฟล์ถ้าไม่มี (บาง distro ไม่ install default config)
install -d -m 755 /etc/UPower
if [[ ! -f /etc/UPower/UPower.conf ]]; then
  cat >/etc/UPower/UPower.conf <<'EOF'
[UPower]
EnableWattsUpPro=false
NoPollBatteries=false
UsePercentageForPolicy=false
PercentageLow=0
PercentageCritical=0
PercentageAction=0
TimeLow=0
TimeCritical=0
TimeAction=0
CriticalPowerAction=Ignore
EOF
else
  backup_once /etc/UPower/UPower.conf
  # ลบ key เดิม (ถ้ามี) แล้วเติมค่าล่าสุดต่อท้าย — กันเคสที่ sed pattern ไม่ match
  sed -i -E '/^\s*#?\s*(CriticalPowerAction|UsePercentageForPolicy|PercentageAction|PercentageCritical|PercentageLow|TimeAction|TimeCritical|TimeLow)\s*=/d' /etc/UPower/UPower.conf
  cat >>/etc/UPower/UPower.conf <<'EOF'

# --- kiosk overrides ---
UsePercentageForPolicy=false
PercentageLow=0
PercentageCritical=0
PercentageAction=0
TimeLow=0
TimeCritical=0
TimeAction=0
CriticalPowerAction=Ignore
EOF
fi
systemctl restart upower 2>/dev/null || true

# systemd-logind — ปิด lid/power button suspend (พับจอ/กดปุ่ม power ไม่ให้ sleep)
if [[ -f /etc/systemd/logind.conf ]]; then
  backup_once /etc/systemd/logind.conf
  sed -i -E '/^\s*#?\s*(HandleLidSwitch|HandleLidSwitchExternalPower|HandleLidSwitchDocked|HandlePowerKey|HandleSuspendKey|HandleHibernateKey|IdleAction)\s*=/d' /etc/systemd/logind.conf
  cat >>/etc/systemd/logind.conf <<'EOF'

# --- kiosk overrides ---
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
HandlePowerKey=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore
IdleAction=ignore
EOF
  systemctl restart systemd-logind 2>/dev/null || true
fi

# xfce power-manager: เขียน XML config โดยตรง (xfconf-query ตอน setup ยังไม่มี session)
XFCONF_DIR="$USER_HOME/.config/xfce4/xfconf/xfce-perchannel-xml"
install -d -m 755 -o "$KIOSK_USER" -g "$KIOSK_USER" "$XFCONF_DIR"
cat >"$XFCONF_DIR/xfce4-power-manager.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-power-manager" version="1.0">
  <property name="xfce4-power-manager" type="empty">
    <property name="power-button-action" type="uint" value="0"/>
    <property name="sleep-button-action" type="uint" value="0"/>
    <property name="hibernate-button-action" type="uint" value="0"/>
    <property name="lid-action-on-ac" type="uint" value="0"/>
    <property name="lid-action-on-battery" type="uint" value="0"/>
    <property name="critical-power-action" type="uint" value="0"/>
    <property name="critical-power-level" type="uint" value="0"/>
    <property name="inactivity-on-ac" type="uint" value="0"/>
    <property name="inactivity-on-battery" type="uint" value="0"/>
    <property name="dpms-enabled" type="bool" value="false"/>
    <property name="dpms-on-ac-sleep" type="uint" value="0"/>
    <property name="dpms-on-ac-off" type="uint" value="0"/>
    <property name="dpms-on-battery-sleep" type="uint" value="0"/>
    <property name="dpms-on-battery-off" type="uint" value="0"/>
    <property name="blank-on-ac" type="int" value="0"/>
    <property name="blank-on-battery" type="int" value="0"/>
    <property name="show-tray-icon" type="uint" value="0"/>
    <property name="logind-handle-lid-switch" type="bool" value="false"/>
    <property name="logind-handle-power-key" type="bool" value="false"/>
    <property name="logind-handle-suspend-key" type="bool" value="false"/>
    <property name="logind-handle-hibernate-key" type="bool" value="false"/>
  </property>
</channel>
EOF
chown "$KIOSK_USER:$KIOSK_USER" "$XFCONF_DIR/xfce4-power-manager.xml"






# ---------------- 4) Autologin + no blank ----------------
log "▶  [4/10] LightDM autologin + no screen blank..."
install -d -m 755 /etc/lightdm/lightdm.conf.d
backup_once /etc/lightdm/lightdm.conf
cat >/etc/lightdm/lightdm.conf.d/60-kiosk-autologin.conf <<EOF
[Seat:*]
autologin-user=$KIOSK_USER
autologin-user-timeout=0
xserver-command=X -s 0 -dpms
EOF
getent group nopasswdlogin >/dev/null && usermod -aG nopasswdlogin "$KIOSK_USER" || true

install -d -m 755 "$USER_HOME/.config/autostart"
cat >"$USER_HOME/.config/autostart/kiosk-noblank.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Kiosk No Blank
Exec=sh -c 'xset s off; xset -dpms; xset s noblank; setterm -blank 0 -powerdown 0 2>/dev/null || true'
X-GNOME-Autostart-enabled=true
EOF

# ---------------- 5) Chromium managed policy (mic/cam + hardening) ----------------
log "▶  [5/10] Chromium policy — auto-grant mic/cam, ปิด update/sync..."
for d in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed; do
  install -d -m 755 "$d"
done
POLICY=$(cat <<JSON
{
  "AudioCaptureAllowed": true,
  "DefaultAudioCaptureSetting": 1,
  "AudioCaptureAllowedUrls": ["$KIOSK_ORIGIN"],
  "VideoCaptureAllowed": true,
  "DefaultVideoCaptureSetting": 1,
  "VideoCaptureAllowedUrls": ["$KIOSK_ORIGIN"],
  "ScreenCaptureAllowedByOrigins": ["$KIOSK_ORIGIN"],
  "SameOriginTabCaptureAllowedByOrigins": ["$KIOSK_ORIGIN"],
  "TabCaptureAllowedByOrigins": ["$KIOSK_ORIGIN"],
  "WindowCaptureAllowedByOrigins": ["$KIOSK_ORIGIN"],
  "ScreenCaptureAllowed": true,
  "DefaultNotificationsSetting": 1,
  "NotificationsAllowedForUrls": ["$KIOSK_ORIGIN"],
  "DefaultGeolocationSetting": 1,
  "GeolocationAllowedForUrls": ["$KIOSK_ORIGIN"],
  "DefaultSensorsSetting": 1,
  "SensorsAllowedForUrls": ["$KIOSK_ORIGIN"],
  "DefaultClipboardSetting": 1,
  "ClipboardAllowedForUrls": ["$KIOSK_ORIGIN"],
  "DefaultFileSystemReadGuardSetting": 1,
  "FileSystemReadAskForUrls": ["$KIOSK_ORIGIN"],
  "DefaultFileSystemWriteGuardSetting": 1,
  "FileSystemWriteAskForUrls": ["$KIOSK_ORIGIN"],
  "DefaultPopupsSetting": 1,
  "PopupsAllowedForUrls": ["$KIOSK_ORIGIN"],
  "DefaultWebBluetoothGuardSetting": 2,
  "DefaultWebUsbGuardSetting": 2,
  "DefaultSerialGuardSetting": 2,
  "PermissionsPolicyUnloadDefaultEnabled": true,
  "IncognitoModeAvailability": 1,
  "DeveloperToolsAvailability": 2,
  "BrowserGuestModeEnabled": false,
  "PasswordManagerEnabled": false,
  "AutofillAddressEnabled": false,
  "AutofillCreditCardEnabled": false,
  "TranslateEnabled": false,
  "MetricsReportingEnabled": false,
  "SafeBrowsingEnabled": false,
  "SearchSuggestEnabled": false,
  "SpellcheckEnabled": false,
  "BackgroundModeEnabled": false,
  "ComponentUpdatesEnabled": false,
  "PromptForDownloadLocation": false,
  "HardwareAccelerationModeEnabled": true,
  "URLBlocklist": ["chrome://settings", "chrome://flags", "chrome://policy", "chrome://extensions", "file://*"],
  "URLAllowlist": ["$KIOSK_ORIGIN"]
}
JSON
)
printf '%s\n' "$POLICY" > /etc/chromium/policies/managed/kiosk-permissions.json
printf '%s\n' "$POLICY" > /etc/chromium-browser/policies/managed/kiosk-permissions.json

# ---------------- 5.5) CMS branding (Plymouth + LightDM + Wallpaper) ----------------
log "▶  [5.5/10] ดึง branding จาก CMS + ติดตั้ง Plymouth theme..."

# ดึง config จาก edge function (public) — timeout สั้น ไม่ตายถ้าเน็ตล้ม
# Edge Functions รันบน Supabase (ไม่ใช่ที่ app URL) — ต้อง hard-code project ref
CMS_SUPABASE_URL="${CMS_SUPABASE_URL:-https://gwmszzoqqxmejefhayqf.supabase.co}"
CMS_SUPABASE_ANON="${CMS_SUPABASE_ANON:-sb_publishable_NlRn4zzOUtHsn4swyH6F7Q_ADVmUe9v}"
CMS_JSON=$(curl -sf --max-time 8 "$CMS_SUPABASE_URL/functions/v1/ext-config" \
  -H "apikey: $CMS_SUPABASE_ANON" \
  -H "Authorization: Bearer $CMS_SUPABASE_ANON" \
  2>/dev/null || echo '{}')

# หา field ด้วย python (มี JSON parser แน่ๆ)
extract_json() {
  python3 -c "import sys,json;d=json.loads(sys.stdin.read() or '{}');print(d.get('$1','') or '')" <<<"$CMS_JSON" 2>/dev/null || echo ""
}
CMS_NAME=$(extract_json school_name)
[[ -z "$CMS_NAME" ]] && CMS_NAME=$(extract_json app_name)
[[ -z "$CMS_NAME" ]] && CMS_NAME="Smart School"
CMS_LOGO_URL=$(extract_json school_logo)
[[ -z "$CMS_LOGO_URL" ]] && CMS_LOGO_URL=$(extract_json app_favicon_url)
CMS_COLOR=$(extract_json theme_color)
[[ -z "$CMS_COLOR" ]] && CMS_COLOR=$(extract_json primary_color)
[[ -z "$CMS_COLOR" ]] && CMS_COLOR="#2563EB"

log "   CMS:   $CMS_SUPABASE_URL/functions/v1/ext-config ($(echo -n "$CMS_JSON" | wc -c) bytes)"
log "   ชื่อ: $CMS_NAME"
log "   สี:   $CMS_COLOR"
log "   โลโก้: ${CMS_LOGO_URL:-<ไม่มี>}"

# แปลง hex → r,g,b (0-1 floats สำหรับ Plymouth)
hex_to_rgb_floats() {
  local h=${1#\#}
  local r=$((16#${h:0:2})) g=$((16#${h:2:2})) b=$((16#${h:4:2}))
  awk -v r=$r -v g=$g -v b=$b 'BEGIN{printf "%.4f %.4f %.4f", r/255, g/255, b/255}'
}
read -r PLY_R PLY_G PLY_B <<<"$(hex_to_rgb_floats "$CMS_COLOR")"

# MX Linux: ต้องติดตั้ง plymouth-x11 + imagemagick ด้วย (ไม่ได้ติดมาให้ default)
apt-get install -y --no-install-recommends \
  plymouth plymouth-themes plymouth-label plymouth-x11 \
  imagemagick initramfs-tools 2>/dev/null || \
apt-get install -y --no-install-recommends plymouth plymouth-themes plymouth-label 2>/dev/null || true


THEME_DIR=/usr/share/plymouth/themes/smartschool
install -d -m 755 "$THEME_DIR"

# ดาวน์โหลดโลโก้ (ถ้ามี) — แปลงเป็น PNG จริงเสมอ เพราะ Plymouth อ่าน WebP/SVG/JPG บางแบบไม่ได้
LOGO_PATH="$THEME_DIR/logo.png"
rm -f "$LOGO_PATH" "$LOGO_PATH.tmp" "$LOGO_PATH.src"
if [[ -n "$CMS_LOGO_URL" ]]; then
  if curl -sfL --max-time 15 "$CMS_LOGO_URL" -o "$LOGO_PATH.src"; then
    if have convert; then
      convert "$LOGO_PATH.src" -auto-orient -resize '320x320>' -background none -gravity center -extent 320x320 PNG32:"$LOGO_PATH" 2>/dev/null || true
    fi
  fi
fi
# ถ้าไม่มีโลโก้/แปลงไม่ได้ → สร้างโลโก้ตัวอักษรที่ Plymouth โหลดได้แน่นอน
if [[ ! -s "$LOGO_PATH" ]] && have convert; then
  convert -size 320x320 xc:none -gravity center -fill white -pointsize 96 -font DejaVu-Sans-Bold \
    -annotate 0 "$(printf '%s' "$CMS_NAME" | cut -c1-2)" PNG32:"$LOGO_PATH" 2>/dev/null || true
fi
# fallback สุดท้าย: PNG 1x1 โปร่งใส เพื่อไม่ให้ Plymouth script crash จาก logo.png ที่หาย
if [[ ! -s "$LOGO_PATH" ]]; then
  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' | base64 -d >"$LOGO_PATH" 2>/dev/null || true
fi

# Plymouth แต่ละเวอร์ชัน/ดิสโทรรองรับ Image.Text/ฟอนต์ไทยไม่เท่ากัน
# จึง render ข้อความเป็น PNG ไว้ก่อน แล้วให้ theme โหลดรูปภาพล้วน ๆ (เสถียรกว่า MX/Debian หลายรุ่น)
# ต้องติดตั้งฟอนต์ไทยก่อน render — ไม่งั้นจะได้ tofu (□□□) ทั้งบรรทัด
apt-get install -y --no-install-recommends fonts-thai-tlwg fonts-noto fonts-noto-core 2>/dev/null || \
  apt-get install -y --no-install-recommends fonts-thai-tlwg 2>/dev/null || true
fc-cache -f 2>/dev/null || true

# หา path ของฟอนต์ไทยจริง ๆ ผ่าน fontconfig (แม่นกว่าใช้ family name กับ ImageMagick)
THAI_FONT_FILE=""
if have fc-match; then
  for q in "Noto Sans Thai:style=Bold" "Loma:style=Bold" "Norasi:style=Bold" "TlwgTypist:style=Bold" \
           "Noto Sans Thai" "Loma" "Norasi" "TlwgTypist" "Waree" "Umpush"; do
    f=$(fc-match -f '%{file}\n' "$q" 2>/dev/null || true)
    if [[ -n "$f" && -f "$f" ]] && (fc-match -f '%{family}\n' "$q" 2>/dev/null | grep -qiE 'thai|loma|norasi|tlwg|waree|umpush|noto'); then
      THAI_FONT_FILE="$f"; break
    fi
  done
fi
[[ -z "$THAI_FONT_FILE" ]] && THAI_FONT_FILE="$(ls /usr/share/fonts/truetype/tlwg/*.ttf 2>/dev/null | head -1)"
[[ -z "$THAI_FONT_FILE" ]] && THAI_FONT_FILE="$(ls /usr/share/fonts/truetype/noto/NotoSansThai*.ttf 2>/dev/null | head -1)"
log "   ▶ ฟอนต์ไทยที่ใช้ render Plymouth: ${THAI_FONT_FILE:-<not found>}"

make_text_png() {
  local text="$1" out="$2" size="${3:-36}" width="${4:-900}" height="${5:-90}"
  rm -f "$out"
  if have convert; then
    # 1) ลองฟอนต์ไทยที่ค้นพบก่อน (ส่ง path ตรง)
    if [[ -n "$THAI_FONT_FILE" ]]; then
      convert -background none -fill white -gravity center -size "${width}x${height}" \
        -font "$THAI_FONT_FILE" -pointsize "$size" "caption:${text}" PNG32:"$out" 2>/dev/null || true
    fi
    # 2) fallback: family names (บางเวอร์ชัน IM รู้จัก)
    if [[ ! -s "$out" ]]; then
      for font in "Noto-Sans-Thai" "Loma" "Norasi" "TlwgTypist" "Waree" "DejaVu-Sans"; do
        convert -background none -fill white -gravity center -size "${width}x${height}" \
          -font "$font" -pointsize "$size" "caption:${text}" PNG32:"$out" 2>/dev/null && break
      done
    fi
    [[ -s "$out" ]] || convert -background none -fill white -gravity center -size "${width}x${height}" \
      -pointsize "$size" "caption:${text}" PNG32:"$out" 2>/dev/null || true
  fi
  [[ -s "$out" ]] || printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' | base64 -d >"$out" 2>/dev/null || true
}
make_text_png "$CMS_NAME" "$THEME_DIR/title.png" 38 1000 110
make_text_png "กำลังเริ่มต้นระบบ..." "$THEME_DIR/status.png" 24 700 60

# plymouth theme files — ใช้ syntax แบบพื้นฐาน + รูปภาพล้วน เพื่อเลี่ยง theme crash แล้วตกไปหน้า verbose
cat >"$THEME_DIR/smartschool.plymouth" <<EOF
[Plymouth Theme]
Name=Smart School
Description=CMS themed boot splash
ModuleName=script

[script]
ImageDir=$THEME_DIR
ScriptFile=$THEME_DIR/smartschool.script
EOF

cat >"$THEME_DIR/smartschool.script" <<PLY
Window.SetBackgroundTopColor($PLY_R, $PLY_G, $PLY_B);
Window.SetBackgroundBottomColor($PLY_R, $PLY_G, $PLY_B);

logo.image = Image("logo.png");
logo.sprite = Sprite(logo.image);
logo.sprite.SetX(Window.GetWidth() / 2 - logo.image.GetWidth() / 2);
logo.sprite.SetY(Window.GetHeight() / 2 - logo.image.GetHeight() / 2 - 70);

title.image = Image("title.png");
title.sprite = Sprite(title.image);
title.sprite.SetX(Window.GetWidth() / 2 - title.image.GetWidth() / 2);
title.sprite.SetY(Window.GetHeight() / 2 + 100);

status.image = Image("status.png");
status.sprite = Sprite(status.image);
status.sprite.SetX(Window.GetWidth() / 2 - status.image.GetWidth() / 2);
status.sprite.SetY(Window.GetHeight() - 80);
PLY

# บางเวอร์ชันไม่เขียน config ให้เองเมื่อใช้ -R แล้ว fail เงียบ ๆ → เขียนเองซ้ำให้แน่นอน
install -d -m 755 /etc/plymouth
cat >/etc/plymouth/plymouthd.conf <<EOF
[Daemon]
Theme=smartschool
ShowDelay=0
DeviceTimeout=8
EOF

# activate theme + บังคับ rebuild ผ่าน plymouth เองก่อน (ถ้ารองรับ -R)
if have plymouth-set-default-theme; then
  plymouth-set-default-theme -R smartschool 2>&1 | tail -5 || \
    plymouth-set-default-theme smartschool 2>&1 | tail -3 || \
    log "⚠  plymouth-set-default-theme ล้มเหลว"
elif [[ -x /usr/sbin/plymouth-set-default-theme ]]; then
  /usr/sbin/plymouth-set-default-theme -R smartschool 2>&1 | tail -5 || \
    /usr/sbin/plymouth-set-default-theme smartschool 2>&1 | tail -3 || true
fi

# === Critical for MX Linux: ทำให้ Plymouth โหลดใน initramfs + framebuffer/KMS ทำงานตั้งแต่บูต ===
# 1) บอก initramfs ให้ใส่ framebuffer + plymouth
mkdir -p /etc/initramfs-tools/conf.d
echo "FRAMEBUFFER=y" > /etc/initramfs-tools/conf.d/splash

# 2) ใส่โมดูลวิดีโอเข้า initramfs โดยเฉพาะ i915 ของ HP Pavilion x2/Intel Atom
#    ถ้าไม่มี KMS ตั้งแต่ต้น boot จะเห็น verbose text แทน splash แม้มี quiet splash แล้ว
if [[ -f /etc/initramfs-tools/modules ]]; then
  for mod in drm drm_kms_helper i915 fbcon; do
    grep -qxF "$mod" /etc/initramfs-tools/modules || echo "$mod" >> /etc/initramfs-tools/modules
  done
fi

# 3) GRUB — quiet + splash + gfxpayload=keep + KMS (ไม่งั้นจะกลับมา text mode ทันทีที่โหลด kernel)
if [[ -f /etc/default/grub ]]; then
  # cmdline: quiet splash + loglevel + ปิด cursor + บังคับ Intel KMS
  CUR=$(grep '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub 2>/dev/null | sed 's/^[^=]*=//; s/^"//; s/"$//')
  NEW="$CUR"
  for tok in quiet splash "init=/lib/systemd/systemd" "loglevel=0" "systemd.show_status=false" "rd.systemd.show_status=false" "udev.log_level=0" "rd.udev.log_level=0" "vt.global_cursor_default=0" "plymouth.ignore-serial-consoles" "i915.modeset=1"; do
    [[ "$NEW" != *"$tok"* ]] && NEW="$NEW $tok"
  done
  # ลบ token ที่ทำให้ข้อความ boot โผล่หรือทับ loglevel=0
  NEW=$(echo "$NEW" | sed -E 's/(^| )(nosplash|noquiet|debug|noplymouth|plymouth.enable=0|systemd.show_status=1|splash=verbose|text)( |$)/ /g; s/(^| )loglevel=[0-9]+( |$)/ /g' | xargs)
  NEW="$(echo "$NEW loglevel=0" | xargs)"
  if grep -q '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub; then
    sed -i "s|^GRUB_CMDLINE_LINUX_DEFAULT=.*|GRUB_CMDLINE_LINUX_DEFAULT=\"$NEW\"|" /etc/default/grub
  else
    echo "GRUB_CMDLINE_LINUX_DEFAULT=\"$NEW\"" >> /etc/default/grub
  fi

  # เผื่อ MX/systemd entry บางแบบอ่าน GRUB_CMDLINE_LINUX ด้วย ให้ใส่ splash ซ้ำแบบปลอดภัย
  CUR2=$(grep '^GRUB_CMDLINE_LINUX=' /etc/default/grub 2>/dev/null | sed 's/^[^=]*=//; s/^"//; s/"$//')
  NEW2="$CUR2"
  for tok in quiet splash; do [[ "$NEW2" != *"$tok"* ]] && NEW2="$NEW2 $tok"; done
  NEW2=$(echo "$NEW2" | xargs)
  if grep -q '^GRUB_CMDLINE_LINUX=' /etc/default/grub; then
    sed -i "s|^GRUB_CMDLINE_LINUX=.*|GRUB_CMDLINE_LINUX=\"$NEW2\"|" /etc/default/grub
  else
    echo "GRUB_CMDLINE_LINUX=\"$NEW2\"" >> /etc/default/grub
  fi

  # gfxpayload=keep — สำคัญมากบน MX/EFI ให้ Plymouth ใช้ resolution เดียวกับ GRUB
  if grep -q '^GRUB_GFXMODE=' /etc/default/grub; then
    sed -i 's|^GRUB_GFXMODE=.*|GRUB_GFXMODE=auto|' /etc/default/grub
  else
    echo 'GRUB_GFXMODE=auto' >> /etc/default/grub
  fi
  if grep -q '^GRUB_GFXPAYLOAD_LINUX=' /etc/default/grub; then
    sed -i 's|^GRUB_GFXPAYLOAD_LINUX=.*|GRUB_GFXPAYLOAD_LINUX=keep|' /etc/default/grub
  else
    echo 'GRUB_GFXPAYLOAD_LINUX=keep' >> /etc/default/grub
  fi

  # comment out GRUB_TERMINAL console (ถ้ามี) — จะบังคับให้ boot ใน text mode
  sed -i 's|^\(GRUB_TERMINAL=console\)|#\1|' /etc/default/grub
  sed -i 's|^\(GRUB_TERMINAL_OUTPUT=console\)|#\1|' /etc/default/grub
fi

# 4) rebuild initramfs + grub
log "   ▶ rebuild initramfs + grub (อาจใช้เวลา 20-60 วิ)..."
update-initramfs -u -k all 2>&1 | tail -8 || true
update-grub 2>&1 | tail -8 || update-grub2 2>&1 | tail -8 || true

# 5) ตรวจสอบผลลัพธ์ + สร้างคำสั่ง debug ไว้ที่เครื่อง
CURR_THEME=$(plymouth-set-default-theme 2>/dev/null || echo "unknown")
log "   ✔  Plymouth theme ปัจจุบัน: $CURR_THEME (ต้องการ: smartschool)"
log "   ✔  GRUB default: $(grep '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub 2>/dev/null | cut -d= -f2-)"
grep -qw splash /proc/cmdline 2>/dev/null || log "   ℹ  รอบบูตปัจจุบันยังไม่มี splash ใน cmdline — ต้อง reboot 1 ครั้งจึงเห็น Plymouth ใหม่"
cat >/opt/kiosk/check-plymouth.sh <<'CHECKPLY'
#!/usr/bin/env bash
echo "== Plymouth theme =="
plymouth-set-default-theme 2>/dev/null || true
echo "== Plymouth daemon config =="
cat /etc/plymouth/plymouthd.conf 2>/dev/null || true
echo "== Kernel cmdline (current boot) =="
cat /proc/cmdline
echo "== GRUB config =="
grep -E '^(GRUB_CMDLINE_LINUX_DEFAULT|GRUB_CMDLINE_LINUX|GRUB_GFXMODE|GRUB_GFXPAYLOAD_LINUX)=' /etc/default/grub || true
echo "== Initramfs modules =="
grep -E '^(drm|drm_kms_helper|i915|fbcon)$' /etc/initramfs-tools/modules || true
echo "== Plymouth files =="
ls -l /usr/share/plymouth/themes/smartschool/ || true
echo "== Plymouth script plugin =="
ls /usr/lib*/plymouth/script.so /usr/lib/*/plymouth/script.so 2>/dev/null || true
CHECKPLY
chmod +x /opt/kiosk/check-plymouth.sh



# ---------------- 5.6) LightDM greeter + wallpaper ----------------
log "▶  [5.6/10] LightDM greeter + XFCE wallpaper ตาม CMS..."

# LightDM GTK Greeter — สีพื้นหลัง + โลโก้
install -d -m 755 /etc/lightdm
GREETER_CONF=/etc/lightdm/lightdm-gtk-greeter.conf
backup_once "$GREETER_CONF"
GREETER_LOGO=""
[[ -f "$LOGO_PATH" ]] && GREETER_LOGO="$LOGO_PATH"
cat >"$GREETER_CONF" <<EOF
[greeter]
background=$CMS_COLOR
theme-name=Adwaita-dark
icon-theme-name=Adwaita
font-name=Sans 11
default-user-image=$GREETER_LOGO
show-clock=true
clock-format=%H:%M  %A %d %B %Y
indicators=~host;~spacer;~clock;~spacer;~session;~language;~power
position=50%,center 50%,center
EOF

# XFCE wallpaper — สร้างภาพ solid color + logo (ถ้ามี ImageMagick)
WALLPAPER=/usr/share/backgrounds/smartschool-wallpaper.png
install -d -m 755 /usr/share/backgrounds
if have convert; then
  if [[ -f "$LOGO_PATH" ]]; then
    convert -size 1920x1080 "xc:$CMS_COLOR" \
      \( "$LOGO_PATH" -resize 320x320 \) -gravity center -composite \
      -font DejaVu-Sans-Bold -pointsize 42 -fill white \
      -gravity south -annotate +0+180 "$CMS_NAME" \
      "$WALLPAPER" 2>/dev/null || true
  else
    convert -size 1920x1080 "xc:$CMS_COLOR" \
      -font DejaVu-Sans-Bold -pointsize 56 -fill white \
      -gravity center -annotate +0+0 "$CMS_NAME" \
      "$WALLPAPER" 2>/dev/null || true
  fi
fi

if [[ -f "$WALLPAPER" ]]; then
  # ตั้ง desktop background ให้ user (ใช้ xfconf-query)
  install -d -m 755 "$USER_HOME/.config/autostart"
  cat >"$USER_HOME/.config/autostart/kiosk-wallpaper.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Kiosk Wallpaper
Exec=sh -c 'for m in \$(xfconf-query -c xfce4-desktop -l 2>/dev/null | grep last-image); do xfconf-query -c xfce4-desktop -p "\$m" -s "$WALLPAPER" 2>/dev/null; done; true'
X-GNOME-Autostart-enabled=true
EOF
fi

# audio groups + pulseaudio autostart + unmute
usermod -aG audio,video,pulse,pulse-access "$KIOSK_USER" 2>/dev/null || \
  usermod -aG audio,video "$KIOSK_USER" || true

# บังคับ ALSA → PulseAudio และเลือก source ไมค์จริง ไม่ใช่ monitor source
cat >/etc/asound.conf <<'EOF'
pcm.!default pulse
ctl.!default pulse
EOF

cat >/opt/kiosk/fix-audio.sh <<'EOF'
#!/usr/bin/env bash
set +e
export PULSE_RUNTIME_PATH="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/pulse"
pulseaudio --start --exit-idle-time=-1 >/dev/null 2>&1 || true
sleep 1
amixer -q sset Master 85% unmute 2>/dev/null || true
amixer -q sset Speaker 85% unmute 2>/dev/null || true
amixer -q sset PCM 85% unmute 2>/dev/null || true
amixer -q sset Capture 90% cap 2>/dev/null || true
amixer -q sset Mic 90% cap 2>/dev/null || true
amixer -q sset 'Internal Mic' 90% cap 2>/dev/null || true
SRC="$(pactl list short sources 2>/dev/null | awk '!/\.monitor/ && /input|alsa_input/ {print $2; exit}')"
if [ -n "$SRC" ]; then
  pactl set-default-source "$SRC" 2>/dev/null || true
  pactl set-source-mute "$SRC" 0 2>/dev/null || true
  pactl set-source-volume "$SRC" 90% 2>/dev/null || true
fi
pactl set-source-mute @DEFAULT_SOURCE@ 0 2>/dev/null || true
pactl set-source-volume @DEFAULT_SOURCE@ 90% 2>/dev/null || true
EOF
chmod +x /opt/kiosk/fix-audio.sh

cat >"$USER_HOME/.config/autostart/kiosk-pulseaudio.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=PulseAudio for Kiosk
Exec=sh -c '/opt/kiosk/fix-audio.sh'
X-GNOME-Autostart-enabled=true
EOF
cat >"$USER_HOME/.config/autostart/kiosk-unmute.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Kiosk Unmute
Exec=sh -c 'sleep 5; /opt/kiosk/fix-audio.sh; true'
X-GNOME-Autostart-enabled=true
EOF

# ---------------- 5.5) Auto-install Smart School Browser Extension (student mode) ----------------
EXT_DIR="/opt/kiosk/extension"
EXT_FLAG=""
if [[ "$KIOSK_MODE" == "student" && -n "$KIOSK_EXTENSION_URL" ]]; then
  log "▶  [5.5/10] ติดตั้ง Smart School Extension อัตโนมัติจาก $KIOSK_EXTENSION_URL"
  mkdir -p "$EXT_DIR"
  apt-get install -y --no-install-recommends unzip curl >/dev/null 2>&1 || true

  # ตัวอัปเดต extension — รันทุกครั้งที่บูตและทุก 6 ชม.
  cat >/opt/kiosk/update-extension.sh <<EOF
#!/usr/bin/env bash
# ดาวน์โหลด extension zip ล่าสุดจาก CMS แล้ว unzip ทับ /opt/kiosk/extension
set -e
TMP=\$(mktemp -d)
if curl -fsSL --max-time 30 -o "\$TMP/ext.zip" "$KIOSK_EXTENSION_URL"; then
  rm -rf "$EXT_DIR".new && mkdir -p "$EXT_DIR".new
  unzip -q -o "\$TMP/ext.zip" -d "$EXT_DIR".new
  # บาง zip มี manifest.json อยู่ในโฟลเดอร์ย่อย
  if [[ ! -f "$EXT_DIR".new/manifest.json ]]; then
    SUB=\$(find "$EXT_DIR".new -maxdepth 2 -name manifest.json | head -1)
    [[ -n "\$SUB" ]] && mv "\$(dirname "\$SUB")"/* "$EXT_DIR".new/ 2>/dev/null || true
  fi
  if [[ -f "$EXT_DIR".new/manifest.json ]]; then
    rm -rf "$EXT_DIR" && mv "$EXT_DIR".new "$EXT_DIR"
    chown -R $KIOSK_USER:$KIOSK_USER "$EXT_DIR"
    logger "kiosk: extension updated OK"
  else
    logger "kiosk: extension zip invalid (no manifest.json)"
  fi
fi
rm -rf "\$TMP"
EOF
  chmod +x /opt/kiosk/update-extension.sh
  /opt/kiosk/update-extension.sh || log "⚠  โหลด extension ไม่ได้ตอนติดตั้ง (จะลองใหม่ตอนบูต)"

  # systemd timer อัปเดตทุก 6 ชม.
  cat >/etc/systemd/system/kiosk-extension-update.service <<EOF
[Unit]
Description=Update Smart School Kiosk Extension
After=network-online.target
[Service]
Type=oneshot
ExecStart=/opt/kiosk/update-extension.sh
EOF
  cat >/etc/systemd/system/kiosk-extension-update.timer <<EOF
[Unit]
Description=Update Smart School Kiosk Extension every 6h
[Timer]
OnBootSec=2min
OnUnitActiveSec=6h
Persistent=true
[Install]
WantedBy=timers.target
EOF
  systemctl enable kiosk-extension-update.timer >/dev/null 2>&1 || true

  if [[ -f "$EXT_DIR/manifest.json" ]]; then
    EXT_FLAG="--load-extension=$EXT_DIR --disable-extensions-except=$EXT_DIR"
    log "   ✔  Extension พร้อมโหลด: $EXT_DIR"
  fi
fi

# ---------------- 5.7) Guest Mode / DeepFreeze-like ephemeral profile (student mode) ----------------
if [[ "$KIOSK_MODE" == "student" ]]; then
  log "▶  [5.7/10] Guest Mode — ephemeral profile + lockdown (DeepFreeze-like)"

  # 1) mount tmpfs ที่ $USER_HOME/.chromium-profile — ล้างทุกครั้งที่บูต
  mkdir -p "$USER_HOME/.chromium-profile"
  chown "$KIOSK_USER:$KIOSK_USER" "$USER_HOME/.chromium-profile"
  if ! grep -q "chromium-profile" /etc/fstab; then
    echo "tmpfs  $USER_HOME/.chromium-profile  tmpfs  defaults,noatime,mode=0700,uid=$(id -u $KIOSK_USER),gid=$(id -g $KIOSK_USER),size=512M  0  0" >>/etc/fstab
  fi
  mount "$USER_HOME/.chromium-profile" 2>/dev/null || true

  # 2) systemd service ล้าง state ผู้ใช้ทุกครั้งก่อนเข้า graphical
  cat >/etc/systemd/system/kiosk-wipe-userdata.service <<EOF
[Unit]
Description=Wipe student user data on boot (DeepFreeze-like)
Before=graphical.target lightdm.service
DefaultDependencies=no
After=local-fs.target
[Service]
Type=oneshot
ExecStart=/bin/bash -c '\
  rm -rf $USER_HOME/.cache $USER_HOME/.config/chromium $USER_HOME/.config/google-chrome \
         $USER_HOME/.mozilla $USER_HOME/Downloads/* $USER_HOME/Desktop/*.desktop \
         $USER_HOME/Documents/* $USER_HOME/Pictures/* $USER_HOME/Videos/* \
         $USER_HOME/.local/share/recently-used.xbel 2>/dev/null; \
  mkdir -p $USER_HOME/Downloads $USER_HOME/.config; \
  chown -R $KIOSK_USER:$KIOSK_USER $USER_HOME'
RemainAfterExit=no
[Install]
WantedBy=graphical.target
EOF
  systemctl enable kiosk-wipe-userdata.service >/dev/null 2>&1 || true

  # 3) Lockdown — กันติดตั้งโปรแกรมและใช้ terminal
  #    - ถอด student ออกจากกลุ่ม sudo/adm
  deluser "$KIOSK_USER" sudo  >/dev/null 2>&1 || true
  deluser "$KIOSK_USER" adm   >/dev/null 2>&1 || true
  deluser "$KIOSK_USER" root  >/dev/null 2>&1 || true
  #    - polkit บล็อค apt/dpkg/synaptic/gparted/packagekit สำหรับ student
  mkdir -p /etc/polkit-1/localauthority/50-local.d /etc/polkit-1/rules.d
  cat >/etc/polkit-1/rules.d/49-kiosk-no-install.rules <<EOF
polkit.addRule(function(action, subject) {
  if (subject.user == "$KIOSK_USER" && (
        action.id.indexOf("org.debian.apt") == 0 ||
        action.id.indexOf("org.freedesktop.packagekit") == 0 ||
        action.id.indexOf("com.ubuntu.pkexec") == 0 ||
        action.id.indexOf("org.freedesktop.policykit.exec") == 0)) {
    return polkit.Result.NO;
  }
});
EOF
  #    - ถอด/ซ่อน terminal, file manager admin, software center
  for pkg in synaptic gnome-software mintinstall software-properties-gtk; do
    apt-get purge -y "$pkg" >/dev/null 2>&1 || true
  done
  #    - ปิด USB autorun + block execution จาก /media /mnt (student ใช้ USB ได้แค่อ่านไฟล์ ไม่รันโปรแกรม)
  cat >/etc/systemd/system/kiosk-mount-noexec.service <<'EOF'
[Unit]
Description=Force noexec on /media and /mnt
[Service]
Type=oneshot
ExecStart=/bin/bash -c 'for m in /media /mnt; do mount -o remount,noexec,nosuid,nodev "$m" 2>/dev/null || true; done'
[Install]
WantedBy=multi-user.target
EOF
  systemctl enable kiosk-mount-noexec.service >/dev/null 2>&1 || true

  #    - ล็อค XFCE ไม่ให้เพิ่ม launcher/right-click desktop
  mkdir -p "$USER_HOME/.config/xfce4/xfconf/xfce-perchannel-xml"
  cat >"$USER_HOME/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-desktop" version="1.0">
  <property name="desktop-icons" type="empty">
    <property name="style" type="int" value="0"/>
    <property name="file-icons" type="empty">
      <property name="show-home" type="bool" value="false"/>
      <property name="show-filesystem" type="bool" value="false"/>
      <property name="show-removable" type="bool" value="false"/>
      <property name="show-trash" type="bool" value="false"/>
    </property>
  </property>
  <property name="desktop-menu" type="empty">
    <property name="show" type="bool" value="false"/>
  </property>
</channel>
EOF
  chown -R "$KIOSK_USER:$KIOSK_USER" "$USER_HOME/.config/xfce4"

  #    - ปิด hotkeys ที่เรียก terminal / tty switch
  install -d -m 755 /etc/X11/xorg.conf.d
  cat >/etc/X11/xorg.conf.d/10-kiosk-nozap.conf <<'EOF'
Section "ServerFlags"
  Option "DontVTSwitch" "on"
  Option "DontZap" "on"
EndSection
EOF
fi

# ---------------- 6) Kiosk launcher + watchdog + health-check ----------------
log "▶  [6/10] Chromium launcher + watchdog + health-check (mode=$KIOSK_MODE)..."

if [[ "$KIOSK_MODE" == "student" ]]; then
  # โหมด student — Chromium Guest/Ephemeral (tmpfs profile) + Student Agent
  #   ไม่เก็บ history/password/cookies — ล้างทุกครั้งเมื่อ reboot
  PROFILE_DIR="$USER_HOME/.chromium-profile"
  CHROMIUM_FLAGS="--user-data-dir=$PROFILE_DIR \
    --disable-features=TranslateUI,AutofillServerCommunication,SavePasswordBubble,DisableLoadExtensionCommandLineSwitch \
    --start-maximized --no-first-run --no-default-browser-check \
    --disable-session-crashed-bubble --disable-infobars --noerrdialogs \
    --check-for-update-interval=31536000 --disable-component-update \
    --disable-background-networking --disable-breakpad --disable-sync \
    --disable-save-password-bubble --disable-signin-promo \
    --autoplay-policy=no-user-gesture-required \
    --use-fake-ui-for-media-stream \
    --enable-features=WebRTCPipeWireCapturer --disk-cache-size=0 \
    --password-store=basic $EXT_FLAG"
  cat >/opt/kiosk/start-kiosk.sh <<EOF
#!/usr/bin/env bash
# ล้าง profile ก่อนเริ่ม (double safety นอกจาก tmpfs+wipe service)
rm -rf "$PROFILE_DIR"/* "$PROFILE_DIR"/.[!.]* 2>/dev/null || true
# ลบ Singleton locks ที่ค้างจาก session ก่อน — สาเหตุใหญ่ที่ chromium "เด้งออก" ทันที
rm -f "$PROFILE_DIR"/Singleton* "\$HOME"/.config/chromium/Singleton* 2>/dev/null || true
for i in \$(seq 1 30); do
  curl -sf --max-time 2 -o /dev/null "$KIOSK_URL" && break
  sleep 2
done
xset s off -dpms s noblank 2>/dev/null || true

_APPEND_KIOSK() { case "\$1" in *\?*) echo "\$1&kiosk=1";; *) echo "\$1?kiosk=1";; esac; }
MAIN_URL="\$(_APPEND_KIOSK "$KIOSK_URL")"
# respawn loop — ถ้า chromium crash/quit จะเปิดใหม่ทันที (backoff กัน spawn รัว ๆ)
while true; do
  rm -f "$PROFILE_DIR"/Singleton* 2>/dev/null || true
  $CHROMIUM_BIN $CHROMIUM_FLAGS "\$MAIN_URL"
  EC=\$?
  logger -t kiosk "chromium exited code=\$EC — restart in 3s"
  sleep 3
done
EOF

else
  # โหมด door — kiosk lock เต็มจอ URL เดียว
  DOOR_PROFILE="$USER_HOME/.chromium-kiosk"
  install -d -m 700 -o "$KIOSK_USER" -g "$KIOSK_USER" "$DOOR_PROFILE"
  cat >/opt/kiosk/start-kiosk.sh <<EOF
#!/usr/bin/env bash
# ลบ Singleton locks ที่ค้าง — สาเหตุใหญ่ที่ chromium เด้งออกทันทีในโหมด kiosk
rm -f "$DOOR_PROFILE"/Singleton* "\$HOME"/.config/chromium/Singleton* 2>/dev/null || true
for i in \$(seq 1 30); do
  curl -sf --max-time 2 -o /dev/null "$KIOSK_URL" && break
  sleep 2
done
PREF="$DOOR_PROFILE/Default/Preferences"
[[ -f "\$PREF" ]] && sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' "\$PREF" || true
xset s off -dpms s noblank 2>/dev/null || true
pgrep -x unclutter >/dev/null || unclutter -idle 0.5 -root &

# respawn loop — chromium crash/quit จะเปิดใหม่ทันที
while true; do
  rm -f "$DOOR_PROFILE"/Singleton* 2>/dev/null || true
  $CHROMIUM_BIN \\
    --user-data-dir="$DOOR_PROFILE" \\
    --kiosk "$KIOSK_URL" \\
    --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
    --disable-features=TranslateUI,AutofillServerCommunication,MediaRouter,GlobalMediaControls,ScreenCaptureNotification \\
    --overscroll-history-navigation=0 --disable-pinch --no-first-run \\
    --check-for-update-interval=31536000 --disable-component-update \\
    --disable-background-networking --disable-breakpad --disable-domain-reliability \\
    --disable-sync --metrics-recording-only --no-default-browser-check \\
    --disable-dev-shm-usage --start-maximized \\
    --autoplay-policy=no-user-gesture-required \\
    --use-fake-ui-for-media-stream \\
    --enable-features=WebRTCPipeWireCapturer --alsa-output-device=default \\
    --password-store=basic --disk-cache-size=104857600 \\
    --auto-select-desktop-capture-source="Entire screen" \\
    --enable-usermedia-screen-capturing \\
    --allow-http-screen-capture
  EC=\$?
  logger -t kiosk "chromium(door) exited code=\$EC — restart in 3s"
  sleep 3
done
EOF
fi
chmod +x /opt/kiosk/start-kiosk.sh

# Idle logout + idle shutdown (student mode)
if [[ "$KIOSK_MODE" == "student" && ( "$KIOSK_IDLE_LOGOUT_MIN" -gt 0 || "$KIOSK_IDLE_SHUTDOWN_MIN" -gt 0 ) ]]; then
  apt-get install -y --no-install-recommends xautolock xprintidle 2>/dev/null || true

  # ตัวเช็ค idle: ถ้าไม่มี input > SHUTDOWN นาที → shutdown เครื่อง
  cat >/opt/kiosk/idle-monitor.sh <<EOF
#!/usr/bin/env bash
# ตรวจ idle ทุก 60 วิ  — ถ้า idle > KIOSK_IDLE_SHUTDOWN_MIN → shutdown
LOGOUT_MS=$(( ${KIOSK_IDLE_LOGOUT_MIN:-0} * 60 * 1000 ))
SHUTDOWN_MS=$(( ${KIOSK_IDLE_SHUTDOWN_MIN:-0} * 60 * 1000 ))
while true; do
  IDLE=\$(xprintidle 2>/dev/null || echo 0)
  if [[ "\$SHUTDOWN_MS" -gt 0 && "\$IDLE" -ge "\$SHUTDOWN_MS" ]]; then
    logger "kiosk: idle \${IDLE}ms >= \${SHUTDOWN_MS}ms → shutdown"
    sudo -n /sbin/shutdown -h +0 || true
    exit 0
  elif [[ "\$LOGOUT_MS" -gt 0 && "\$IDLE" -ge "\$LOGOUT_MS" ]]; then
    logger "kiosk: idle \${IDLE}ms >= \${LOGOUT_MS}ms → logout"
    pkill -KILL -u \$USER chromium 2>/dev/null || true
    xfce4-session-logout --logout --fast 2>/dev/null || pkill -KILL -u \$USER || true
    sleep 30
  fi
  sleep 60
done
EOF
  chmod +x /opt/kiosk/idle-monitor.sh
  cat >"$USER_HOME/.config/autostart/kiosk-idle-monitor.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Kiosk Idle Monitor (logout + shutdown)
Exec=/opt/kiosk/idle-monitor.sh
X-GNOME-Autostart-enabled=true
EOF
fi

# ---------------- 6.5) Exit-guard — PIN lock สำหรับ Alt+F4 / Alt+Tab / Super / F11 ----------------
log "▶  [6.5/10] Exit-guard (xbindkeys + PIN)..."
install -d -m 755 /opt/kiosk
# เก็บ PIN ให้อ่านได้เฉพาะ root/kiosk user
printf '%s' "$KIOSK_EXIT_PIN" > /opt/kiosk/exit.pin
chown root:"$KIOSK_USER" /opt/kiosk/exit.pin
chmod 0640 /opt/kiosk/exit.pin

cat >/opt/kiosk/exit-guard.sh <<'GUARD'
#!/usr/bin/env bash
# ถามรหัสก่อนอนุญาตให้ shortcut ทำงาน — ถ้าถูก จะ "ปลดล็อก" 60 วิ
PINFILE=/opt/kiosk/exit.pin
UNLOCK=/tmp/kiosk-unlocked
[[ -f "$UNLOCK" ]] && exit 0
REAL=$(cat "$PINFILE" 2>/dev/null)
[[ -z "$REAL" ]] && exit 0
ANS=$(zenity --password --title="🔒 รหัสออกจาก Kiosk mode" --timeout=20 2>/dev/null)
if [[ "$ANS" == "$REAL" ]]; then
  touch "$UNLOCK"
  ( sleep 60; rm -f "$UNLOCK" ) &
  zenity --info --title="ปลดล็อก" --text="ปลดล็อก 60 วินาที — ใช้ shortcut ได้ตามปกติ" --timeout=3 2>/dev/null &
  exit 0
else
  [[ -n "$ANS" ]] && zenity --error --title="รหัสผิด" --text="รหัสไม่ถูกต้อง" --timeout=3 2>/dev/null &
  exit 1
fi
GUARD
chmod 0755 /opt/kiosk/exit-guard.sh

# xbindkeys config — ดัก shortcut ยอดฮิตให้เรียก exit-guard ก่อน
mkdir -p "$USER_HOME/.config"
cat >"$USER_HOME/.xbindkeysrc" <<'XBK'
# Alt+F4
"/opt/kiosk/exit-guard.sh"
  Alt + F4
# Alt+Tab
"/opt/kiosk/exit-guard.sh"
  Alt + Tab
# Alt+Shift+Tab
"/opt/kiosk/exit-guard.sh"
  Alt + Shift + Tab
# Super (Win key)
"/opt/kiosk/exit-guard.sh"
  Mod4 + L
"/opt/kiosk/exit-guard.sh"
  Mod4 + d
"/opt/kiosk/exit-guard.sh"
  Mod4 + e
"/opt/kiosk/exit-guard.sh"
  Mod4 + r
# F11 (ออก fullscreen)
"/opt/kiosk/exit-guard.sh"
  F11
# Ctrl+W / Ctrl+Q / Ctrl+T / Ctrl+N — ปิด/สร้างแท็บ+หน้าต่าง
"/opt/kiosk/exit-guard.sh"
  Control + w
"/opt/kiosk/exit-guard.sh"
  Control + q
"/opt/kiosk/exit-guard.sh"
  Control + t
"/opt/kiosk/exit-guard.sh"
  Control + n
# Ctrl+Alt+T — terminal
"/opt/kiosk/exit-guard.sh"
  Control + Alt + t
# Ctrl+Alt+Delete
"/opt/kiosk/exit-guard.sh"
  Control + Alt + Delete
XBK
chown "$KIOSK_USER:$KIOSK_USER" "$USER_HOME/.xbindkeysrc"

# ให้ kiosk user รัน exit-guard ได้ (อ่าน pin) — group ถูก set แล้ว
# autostart xbindkeys
cat >"$USER_HOME/.config/autostart/kiosk-xbindkeys.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Kiosk Exit-Guard (xbindkeys)
Exec=sh -c "pkill -x xbindkeys 2>/dev/null; sleep 1; xbindkeys -f \$HOME/.xbindkeysrc"
X-GNOME-Autostart-enabled=true
EOF


cat >"$USER_HOME/.config/autostart/kiosk-chromium.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Smart School Kiosk
Exec=/opt/kiosk/start-kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

# Watchdog — เปิด Chromium ใหม่ถ้าตาย
# ตัวจับ process: door ใช้ --kiosk, student ใช้ --user-data-dir=<profile>
if [[ "$KIOSK_MODE" == "student" ]]; then
  KIOSK_PGREP_PATTERN="chromium.*--user-data-dir=$USER_HOME/.chromium-profile"
else
  KIOSK_PGREP_PATTERN="chromium.*--user-data-dir=$USER_HOME/.chromium-kiosk"
fi

cat >/opt/kiosk/watchdog.sh <<EOF
#!/usr/bin/env bash
# ให้ chromium มีเวลา start ก่อนตรวจ (กันซ้อนหลายหน้าต่าง)
sleep 20
while true; do
  if ! pgrep -f "$KIOSK_PGREP_PATTERN" >/dev/null; then
    /opt/kiosk/start-kiosk.sh &
    # รอ chromium ขึ้นจริงก่อนตรวจครั้งต่อไป — กัน spawn ซ้อน
    sleep 20
  fi
  sleep 15
done
EOF
chmod +x /opt/kiosk/watchdog.sh

cat >/etc/systemd/system/kiosk-watchdog.service <<EOF
[Unit]
Description=Kiosk Chromium Watchdog
After=graphical.target
[Service]
Type=simple
User=$KIOSK_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=$USER_HOME/.Xauthority
ExecStart=/opt/kiosk/watchdog.sh
Restart=always
[Install]
WantedBy=graphical.target
EOF

# Health-check — ping URL ทุก 60 วิ ถ้าล้ม 3 ครั้ง → reload
cat >/opt/kiosk/healthcheck.sh <<EOF
#!/usr/bin/env bash
fails=0
while true; do
  if curl -sf --max-time 5 -o /dev/null "$KIOSK_URL"; then
    fails=0
  else
    fails=\$((fails+1))
    if [[ \$fails -ge 3 ]]; then
      pkill -f "$KIOSK_PGREP_PATTERN" 2>/dev/null || true
      fails=0
    fi
  fi
  sleep 60
done
EOF
chmod +x /opt/kiosk/healthcheck.sh

cat >/etc/systemd/system/kiosk-healthcheck.service <<EOF
[Unit]
Description=Kiosk URL Health Check
After=graphical.target
[Service]
Type=simple
User=$KIOSK_USER
ExecStart=/opt/kiosk/healthcheck.sh
Restart=always
[Install]
WantedBy=graphical.target
EOF

# ---------------- 7) ปิด service / effect / update ที่ไม่จำเป็น ----------------
log "▶  [7/10] ปิด service + effect ที่ไม่จำเป็น..."

DISABLE_SERVICES=(
  bluetooth.service cups.service cups-browsed.service ModemManager.service
  avahi-daemon.service avahi-daemon.socket
  apt-daily.service apt-daily.timer apt-daily-upgrade.service apt-daily-upgrade.timer
  unattended-upgrades.service packagekit.service
  snapd.service snapd.socket saned.service colord.service
  speech-dispatcher.service motd-news.service motd-news.timer
  NetworkManager-wait-online.service
)
for svc in "${DISABLE_SERVICES[@]}"; do
  systemctl disable --now "$svc" 2>/dev/null || true
  systemctl mask "$svc" 2>/dev/null || true
done

# Xfce: ปิด compositor + power manager blank + notification
for CH in xfwm4 xfce4-power-manager xfce4-notifyd xfce4-desktop; do
  sudo -u "$KIOSK_USER" DISPLAY=:0 dbus-launch --exit-with-session xfconf-query -c "$CH" -lv 2>/dev/null >/dev/null || true
done
sudo -u "$KIOSK_USER" DISPLAY=:0 dbus-launch --exit-with-session \
  xfconf-query -c xfwm4 -p /general/use_compositing -s false 2>/dev/null || true
sudo -u "$KIOSK_USER" DISPLAY=:0 dbus-launch --exit-with-session \
  xfconf-query -c xfce4-power-manager -p /xfce4-power-manager/dpms-enabled -s false 2>/dev/null || true
sudo -u "$KIOSK_USER" DISPLAY=:0 dbus-launch --exit-with-session \
  xfconf-query -c xfce4-power-manager -p /xfce4-power-manager/blank-on-ac -s 0 2>/dev/null || true
sudo -u "$KIOSK_USER" DISPLAY=:0 dbus-launch --exit-with-session \
  xfconf-query -c xfce4-power-manager -p /xfce4-power-manager/blank-on-battery -s 0 2>/dev/null || true

install -d -m 755 "$USER_HOME/.config/xfce4/xfconf/xfce-perchannel-xml"
cat >"$USER_HOME/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-notifyd.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-notifyd" version="1.0">
  <property name="do-not-disturb" type="bool" value="true"/>
  <property name="notification-log" type="bool" value="false"/>
</channel>
EOF

# ถอน screensaver / thumbnailer / indexer
apt-get purge -y xscreensaver light-locker tumbler tracker baloo-kf5 2>/dev/null || true

# ปิด USB automount popup
sudo -u "$KIOSK_USER" DISPLAY=:0 dbus-launch --exit-with-session \
  xfconf-query -c thunar-volman -p /automount-drives/enabled -s false 2>/dev/null || true

# MX updater popup
touch "$USER_HOME/.config/mx-updater-disabled" || true

# ---------------- 8) Kernel / disk / boot tuning ----------------
log "▶  [8/10] Kernel + disk + boot tuning..."

# sysctl
cat >/etc/sysctl.d/99-kiosk.conf <<EOF
vm.swappiness=10
vm.vfs_cache_pressure=50
vm.dirty_ratio=10
vm.dirty_background_ratio=5
net.core.rmem_max=2500000
net.core.wmem_max=2500000
EOF
sysctl -p /etc/sysctl.d/99-kiosk.conf >/dev/null 2>&1 || true

# GRUB — บูตเร็ว + แก้จอกระพริบ Intel GPU (ห้ามลบ quiet/splash ของ Plymouth)
if [[ -f /etc/default/grub ]]; then
  backup_once /etc/default/grub
  sed -i 's/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=1/' /etc/default/grub
  EXTRA_TOKENS=(fastboot)
  if lspci 2>/dev/null | grep -qi "intel.*graphics\|intel.*hd graphics\|intel.*uhd"; then
    EXTRA_TOKENS+=(intel_idle.max_cstate=1 i915.enable_psr=0 i915.modeset=1)
    log "   ตรวจพบ Intel GPU → เพิ่ม Intel boot tuning โดยยังคง Plymouth splash"
  fi
  CUR=$(grep '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub 2>/dev/null | sed 's/^[^=]*=//; s/^"//; s/"$//')
  NEW="$CUR"
  for tok in quiet splash init=/lib/systemd/systemd loglevel=0 systemd.show_status=false rd.systemd.show_status=false udev.log_level=0 rd.udev.log_level=0 vt.global_cursor_default=0 plymouth.ignore-serial-consoles "${EXTRA_TOKENS[@]}"; do
    [[ "$NEW" != *"$tok"* ]] && NEW="$NEW $tok"
  done
  NEW=$(echo "$NEW" | sed -E 's/(^| )(nosplash|noquiet|debug|noplymouth|plymouth.enable=0|systemd.show_status=1|splash=verbose|text)( |$)/ /g; s/(^| )loglevel=[0-9]+( |$)/ /g' | xargs)
  NEW="$(echo "$NEW loglevel=0" | xargs)"
  sed -i "s|^GRUB_CMDLINE_LINUX_DEFAULT=.*|GRUB_CMDLINE_LINUX_DEFAULT=\"$NEW\"|" /etc/default/grub || true
  update-grub >/dev/null 2>&1 || true
fi

# fstab: noatime (ยืดอายุ eMMC/SSD)
if [[ -f /etc/fstab ]] && ! grep -q "noatime.*# kiosk" /etc/fstab; then
  backup_once /etc/fstab
  awk 'BEGIN{OFS="\t"} /^[^#]/ && $2=="/" && $4 !~ /noatime/ { $4=$4",noatime,nodiratime"; $0=$0" # kiosk" } { print }' /etc/fstab >/etc/fstab.new && mv /etc/fstab.new /etc/fstab
fi

# journald ใน RAM 50MB
install -d -m 755 /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/kiosk.conf <<EOF
[Journal]
Storage=volatile
RuntimeMaxUse=50M
SystemMaxUse=50M
EOF

# ปิด core dump
echo "* hard core 0" >/etc/security/limits.d/kiosk-nocore.conf

# ---------------- 9) Daily reboot + Power schedule ----------------
if [[ -n "$KIOSK_DAILY_REBOOT" ]]; then
  log "▶  [9/10] ตั้ง reboot รายวันเวลา $KIOSK_DAILY_REBOOT..."
  HH=${KIOSK_DAILY_REBOOT%%:*}
  MM=${KIOSK_DAILY_REBOOT##*:}
  cat >/etc/systemd/system/kiosk-daily-reboot.service <<EOF
[Unit]
Description=Kiosk Daily Reboot
[Service]
Type=oneshot
ExecStart=/sbin/reboot
EOF
  cat >/etc/systemd/system/kiosk-daily-reboot.timer <<EOF
[Unit]
Description=Kiosk Daily Reboot Timer
[Timer]
OnCalendar=*-*-* $HH:$MM:00
Persistent=false
[Install]
WantedBy=timers.target
EOF
  systemctl enable kiosk-daily-reboot.timer >/dev/null 2>&1 || true
fi

# ---- Power schedule: shutdown ตามเวลา + BIOS RTC wake ตอนเช้า ----
# ตอน shutdown จะตั้ง /sys/class/rtc/rtc0/wakealarm ให้เครื่องเปิดเองตอน KIOSK_POWER_ON
if [[ -n "$KIOSK_POWER_ON" || -n "$KIOSK_POWER_OFF" ]]; then
  log "▶  [9.5/10] Power schedule: ON=${KIOSK_POWER_ON:-off}  OFF=${KIOSK_POWER_OFF:-off}"

  # สคริปต์ที่ shutdown แล้วตั้ง wakealarm ให้ตอน ON เปิดใหม่
  cat >/opt/kiosk/power-cycle.sh <<EOF
#!/usr/bin/env bash
# ตั้ง BIOS RTC wakealarm สำหรับพรุ่งนี้/วันนี้เวลา KIOSK_POWER_ON แล้ว shutdown
POWER_ON="${KIOSK_POWER_ON:-}"
if [[ -n "\$POWER_ON" ]]; then
  # คำนวณ epoch สำหรับ POWER_ON วันถัดไป (ถ้าเวลาผ่านไปแล้ววันนี้)
  TARGET=\$(date -d "today \$POWER_ON" +%s 2>/dev/null || echo 0)
  NOW=\$(date +%s)
  if [[ "\$TARGET" -le "\$NOW" ]]; then
    TARGET=\$(date -d "tomorrow \$POWER_ON" +%s)
  fi
  echo 0 > /sys/class/rtc/rtc0/wakealarm 2>/dev/null || true
  echo "\$TARGET" > /sys/class/rtc/rtc0/wakealarm 2>/dev/null || \
    /usr/sbin/rtcwake -m no -t "\$TARGET" 2>/dev/null || true
  logger "kiosk: set wakealarm to \$(date -d @\$TARGET)"
fi
/sbin/shutdown -h +0
EOF
  chmod +x /opt/kiosk/power-cycle.sh

  if [[ -n "$KIOSK_POWER_OFF" ]]; then
    OFF_HH=${KIOSK_POWER_OFF%%:*}
    OFF_MM=${KIOSK_POWER_OFF##*:}
    cat >/etc/systemd/system/kiosk-power-off.service <<EOF
[Unit]
Description=Kiosk Scheduled Shutdown (+ set BIOS wake for morning)
[Service]
Type=oneshot
ExecStart=/opt/kiosk/power-cycle.sh
EOF
    cat >/etc/systemd/system/kiosk-power-off.timer <<EOF
[Unit]
Description=Kiosk Scheduled Shutdown Timer
[Timer]
OnCalendar=*-*-* $OFF_HH:$OFF_MM:00
Persistent=false
[Install]
WantedBy=timers.target
EOF
    systemctl daemon-reload
    systemctl enable --now kiosk-power-off.timer >/dev/null 2>&1 || true
    systemctl restart kiosk-power-off.timer >/dev/null 2>&1 || true
    log "   ↳ systemd timer status:"
    systemctl list-timers --all kiosk-power-off.timer 2>/dev/null | sed 's/^/      /' || true

    # Fallback สำหรับ MX Linux/เครื่องที่ systemd timer ไม่ทำงานหรือบูตด้วย SysVinit
    # cron จะเรียก power-cycle.sh เวลาเดียวกัน เพื่อให้ตั้งเวลาปิดเครื่องยังทำงานแน่นอน
    cat >/etc/cron.d/kiosk-power-off <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
$OFF_MM $OFF_HH * * * root /opt/kiosk/power-cycle.sh >/var/log/kiosk-power-off.log 2>&1
EOF
    chmod 0644 /etc/cron.d/kiosk-power-off
    systemctl enable --now cron >/dev/null 2>&1 || service cron start >/dev/null 2>&1 || true
    log "   ↳ cron fallback: /etc/cron.d/kiosk-power-off → $OFF_HH:$OFF_MM"
  else
    rm -f /etc/cron.d/kiosk-power-off /etc/systemd/system/kiosk-power-off.timer /etc/systemd/system/kiosk-power-off.service 2>/dev/null || true
    systemctl daemon-reload 2>/dev/null || true
  fi

  # เผื่อกรณีเครื่องไม่ได้ถูกปิดผ่าน timer (ไฟดับ ฯลฯ) — ตั้ง wakealarm ทุกครั้งก่อน shutdown ปกติ
  cat >/etc/systemd/system/kiosk-set-wakealarm.service <<EOF
[Unit]
Description=Set BIOS RTC wakealarm before shutdown
DefaultDependencies=no
Before=shutdown.target reboot.target halt.target
[Service]
Type=oneshot
ExecStart=/bin/sh -c 'PON="${KIOSK_POWER_ON:-}"; [ -z "\$PON" ] && exit 0; T=\$(date -d "today \$PON" +%s); NOW=\$(date +%s); [ \$T -le \$NOW ] && T=\$(date -d "tomorrow \$PON" +%s); echo 0 > /sys/class/rtc/rtc0/wakealarm 2>/dev/null; echo \$T > /sys/class/rtc/rtc0/wakealarm 2>/dev/null || /usr/sbin/rtcwake -m no -t \$T 2>/dev/null || true; logger "kiosk: pre-shutdown wakealarm=\$(date -d @\$T)"'
[Install]
WantedBy=shutdown.target
EOF
  systemctl daemon-reload
  systemctl reenable kiosk-set-wakealarm.service >/dev/null 2>&1 || true

  # ---- Power-ON: re-arm BIOS RTC wakealarm ต่อเนื่อง ----
  # ตั้ง timer แสดงในรายการ (คู่กับ kiosk-power-off) + re-arm ทุก 10 นาที
  # ป้องกันกรณี kernel/BIOS เคลียร์ wakealarm หลัง suspend/ไฟกระพริบ
  if [[ -n "$KIOSK_POWER_ON" ]]; then
    ON_HH=${KIOSK_POWER_ON%%:*}
    ON_MM=${KIOSK_POWER_ON##*:}

    cat >/opt/kiosk/arm-wakealarm.sh <<EOF
#!/usr/bin/env bash
# ตั้ง BIOS RTC wakealarm ให้เป็นเวลา KIOSK_POWER_ON ครั้งถัดไป
POWER_ON="${KIOSK_POWER_ON}"
T=\$(date -d "today \$POWER_ON" +%s 2>/dev/null || echo 0)
NOW=\$(date +%s)
if [[ "\$T" -le "\$NOW" ]]; then
  T=\$(date -d "tomorrow \$POWER_ON" +%s)
fi
CUR=\$(cat /sys/class/rtc/rtc0/wakealarm 2>/dev/null || echo 0)
# re-arm เฉพาะเมื่อว่าง หรือเวลาต่างจากเป้าหมาย (>60 วิ)
if [[ -z "\$CUR" || "\$CUR" = "0" ]] || (( \$(echo "\$CUR-\$T" | awk '{print (\$1<0?-\$1:\$1)}') > 60 )); then
  echo 0 > /sys/class/rtc/rtc0/wakealarm 2>/dev/null || true
  echo "\$T" > /sys/class/rtc/rtc0/wakealarm 2>/dev/null \
    || /usr/sbin/rtcwake -m no -t "\$T" 2>/dev/null || true
  logger "kiosk: (re)armed wakealarm to \$(date -d @\$T)"
fi
EOF
    chmod +x /opt/kiosk/arm-wakealarm.sh

    cat >/etc/systemd/system/kiosk-power-on.service <<EOF
[Unit]
Description=Kiosk Scheduled Power-On (arm BIOS RTC wakealarm for ${KIOSK_POWER_ON})
[Service]
Type=oneshot
ExecStart=/opt/kiosk/arm-wakealarm.sh
EOF
    # OnCalendar ตั้งเป็นเวลา power-on เพื่อให้ปรากฏใน list-timers พร้อม NEXT ที่ชัดเจน
    # + OnBootSec/OnUnitActiveSec ให้ re-arm ต่อเนื่องระหว่างเปิดเครื่อง
    cat >/etc/systemd/system/kiosk-power-on.timer <<EOF
[Unit]
Description=Kiosk Scheduled Power-On Timer (${KIOSK_POWER_ON})
[Timer]
OnCalendar=*-*-* $ON_HH:$ON_MM:00
OnBootSec=2min
OnUnitActiveSec=10min
Persistent=false
AccuracySec=30s
[Install]
WantedBy=timers.target
EOF
    systemctl daemon-reload
    systemctl enable --now kiosk-power-on.timer >/dev/null 2>&1 || true
    systemctl restart kiosk-power-on.timer >/dev/null 2>&1 || true
    log "   ↳ kiosk-power-on.timer enabled ($KIOSK_POWER_ON)"

    # cron fallback (ทุก 10 นาที) เผื่อ systemd timer ไม่รัน
    cat >/etc/cron.d/kiosk-arm-wakealarm <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * root /opt/kiosk/arm-wakealarm.sh >/dev/null 2>&1
EOF
    chmod 0644 /etc/cron.d/kiosk-arm-wakealarm

    # priming: ตั้ง wakealarm ทันทีหลัง setup
    /opt/kiosk/arm-wakealarm.sh || true
    log "   ↳ priming BIOS wakealarm → next $KIOSK_POWER_ON"
    systemctl list-timers --all 'kiosk-power-*.timer' 2>/dev/null | sed 's/^/      /' || true
  else
    rm -f /etc/cron.d/kiosk-arm-wakealarm /etc/systemd/system/kiosk-power-on.timer /etc/systemd/system/kiosk-power-on.service /opt/kiosk/arm-wakealarm.sh 2>/dev/null || true
    systemctl daemon-reload 2>/dev/null || true
  fi
fi

# ---------------- 10) Enable services + set ownership ----------------
log "▶  [10/10] Enable service + set ownership..."
systemctl daemon-reload
ENABLE_LIST=(kiosk-watchdog kiosk-healthcheck kiosk-ctl)
[[ "$KIOSK_MODE" == "door" ]] && ENABLE_LIST+=(kiosk-wake)
for s in "${ENABLE_LIST[@]}"; do
  systemctl reenable "$s.service" >/dev/null 2>&1 || true
done

chown -R "$KIOSK_USER:$KIOSK_USER" "$USER_HOME/.config"

# ---------------- Done ----------------
cat <<EOF

======================================================================
✅  ติดตั้งเรียบร้อย — พร้อมใช้งานหลังรีบูต
    โหมด:               $KIOSK_MODE
    ผู้ใช้ auto-login:  $KIOSK_USER
    URL kiosk:          $KIOSK_URL
    Monitor Agent:      ${KIOSK_MONITOR_AGENT_URL:-<ปิด>}
    Wake daemon:        $([[ "$KIOSK_MODE" == "door" ]] && echo "http://127.0.0.1:9999/wake" || echo "<ปิด (student mode)>")
    Local control:      http://127.0.0.1:9998  (/shutdown /reboot /logout /open-url)
    Idle logout:        $([[ "$KIOSK_IDLE_LOGOUT_MIN" -gt 0 ]] && echo "${KIOSK_IDLE_LOGOUT_MIN} นาที" || echo "ปิด")
    Idle shutdown:      $([[ "$KIOSK_IDLE_SHUTDOWN_MIN" -gt 0 ]] && echo "${KIOSK_IDLE_SHUTDOWN_MIN} นาที" || echo "ปิด")
    Power ON (BIOS):    ${KIOSK_POWER_ON:-ปิด}
    Power OFF:          ${KIOSK_POWER_OFF:-ปิด}
    Daily reboot:       ${KIOSK_DAILY_REBOOT:-ปิด}
    Full power mode:    ✅ CPU=performance, suspend/hibernate=masked
    Log setup:          $LOG_FILE

▶  รีบูต:               sudo reboot
▶  ดู log runtime:      journalctl -u kiosk-wake -f
                        journalctl -u kiosk-watchdog -f
▶  ถอนการติดตั้ง:       sudo bash uninstall-mxlinux-kiosk.sh
======================================================================
EOF
