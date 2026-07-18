#!/usr/bin/env bash
# ============================================================================
#  Smart School Kiosk — Uninstall / Rollback (MX Linux)
#  คืนค่าระบบเดิมทั้งหมดที่ setup-mxlinux-kiosk.sh เปลี่ยนไว้
# ============================================================================
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "❌ ต้องรันด้วย sudo"; exit 1; }

KIOSK_USER="${KIOSK_USER:-${SUDO_USER:-$(logname 2>/dev/null || echo demo)}}"
USER_HOME=$(getent passwd "$KIOSK_USER" | cut -d: -f6 || echo "")

echo "▶  หยุด + disable services..."
for s in kiosk-wake kiosk-watchdog kiosk-healthcheck kiosk-daily-reboot.timer kiosk-daily-reboot; do
  systemctl disable --now "$s" 2>/dev/null || true
  rm -f "/etc/systemd/system/$s.service" "/etc/systemd/system/$s.timer" 2>/dev/null || true
done

echo "▶  ปลด mask + enable service ระบบที่ปิดไว้..."
for svc in bluetooth.service cups.service cups-browsed.service ModemManager.service \
           avahi-daemon.service avahi-daemon.socket apt-daily.service apt-daily.timer \
           apt-daily-upgrade.service apt-daily-upgrade.timer unattended-upgrades.service \
           packagekit.service snapd.service snapd.socket saned.service colord.service \
           speech-dispatcher.service motd-news.service motd-news.timer \
           NetworkManager-wait-online.service; do
  systemctl unmask "$svc" 2>/dev/null || true
  systemctl enable "$svc" 2>/dev/null || true
done

echo "▶  ลบไฟล์ kiosk..."
rm -rf /opt/kiosk
rm -f /etc/lightdm/lightdm.conf.d/60-kiosk-autologin.conf
rm -f /etc/chromium/policies/managed/kiosk-permissions.json
rm -f /etc/chromium-browser/policies/managed/kiosk-permissions.json
rm -f /etc/sysctl.d/99-kiosk.conf
rm -f /etc/security/limits.d/kiosk-nocore.conf
rm -f /etc/systemd/journald.conf.d/kiosk.conf
sysctl --system >/dev/null 2>&1 || true

if [[ -n "$USER_HOME" && -d "$USER_HOME/.config/autostart" ]]; then
  rm -f "$USER_HOME/.config/autostart/kiosk-noblank.desktop"
  rm -f "$USER_HOME/.config/autostart/kiosk-chromium.desktop"
  rm -f "$USER_HOME/.config/autostart/kiosk-pulseaudio.desktop"
  rm -f "$USER_HOME/.config/autostart/kiosk-unmute.desktop"
fi

echo "▶  คืน GRUB / fstab / lightdm จาก .kiosk.bak..."
for f in /etc/default/grub /etc/fstab /etc/lightdm/lightdm.conf; do
  if [[ -f "$f.kiosk.bak" ]]; then
    cp -a "$f.kiosk.bak" "$f"
    rm -f "$f.kiosk.bak"
  fi
done
update-grub >/dev/null 2>&1 || true

systemctl daemon-reload
echo "✅  ถอนเรียบร้อย — รีบูตเพื่อให้กลับสู่ desktop ปกติ:  sudo reboot"
