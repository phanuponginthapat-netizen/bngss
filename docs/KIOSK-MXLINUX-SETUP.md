# ตู้ Kiosk บน MX Linux — คู่มือติดตั้ง (2 โหมด)

ระบบรองรับ Kiosk **2 โหมด** ในสคริปต์ตัวเดียวกัน (`setup-mxlinux-kiosk.sh`) เลือกด้วย `KIOSK_MODE`:

| โหมด | ใช้กับ | URL default | ล็อกเต็มจอ | Wake daemon | Monitor Agent | Idle logout | Daily reboot |
|---|---|---|---|---|---|---|---|
| `door` | HP Pavilion x2 หน้าประตูโรงเรียน | `/kiosk` (สแกนหน้า) | ✅ | ✅ port 9999 | – | – | 03:00 |
| `student` | คอมพิวเตอร์นักเรียนในห้องคอม | `/` (login) | ❌ (app-mode) | ❌ | ✅ (window 2) | 30 นาที | 22:30 |

## วิธีที่ 1 (แนะนำ) — ผ่านหน้า CMS

1. เข้า Admin → **ตั้งค่าตู้ Kiosk** (`/dashboard/admin/kiosk-setup`)
2. **เลือกโหมด** (Door หรือ Student)
3. กรอก URL / ผู้ใช้ Linux / Wi-Fi / เวลารีบูต / Idle logout
4. กด **ดาวน์โหลดสคริปต์** → ได้ไฟล์ `setup-kiosk-<mode>-<โรงเรียน>.sh` (config ฝังเรียบร้อย)
5. เอาไปเครื่อง MX Linux แล้วรัน:
   ```bash
   sudo bash setup-kiosk-*.sh
   sudo reboot
   ```

## วิธีที่ 2 — One-liner (Automatic ทั้ง 2 โหมด)

หลัง publish เว็บ (`/kiosk-setup.sh` เข้าถึงจาก public):

**Door (ตู้สแกนหน้าประตู):**
```bash
curl -fsSL https://YOUR-DOMAIN/kiosk-setup.sh | \
  sudo KIOSK_MODE=door \
       KIOSK_URL="https://YOUR-DOMAIN/kiosk" \
       KIOSK_WIFI_SSID="MySchoolWiFi" KIOSK_WIFI_PASS="password" \
       bash
sudo reboot
```

**Student (คอมพิวเตอร์นักเรียน):**
```bash
curl -fsSL https://YOUR-DOMAIN/kiosk-setup.sh | \
  sudo KIOSK_MODE=student \
       KIOSK_URL="https://YOUR-DOMAIN/" \
       KIOSK_USER=student \
       KIOSK_WIFI_SSID="MySchoolWiFi" KIOSK_WIFI_PASS="password" \
       bash
sudo reboot
```

## ค่าที่ปรับได้ (env)

| ตัวแปร | Door default | Student default | คำอธิบาย |
|---|---|---|---|
| `KIOSK_MODE` | `door` | `student` | เลือกโหมด |
| `KIOSK_URL` | `.../kiosk` | `.../` | หน้าที่เปิดเป็น window หลัก |
| `KIOSK_USER` | ผู้ใช้ที่ sudo | ผู้ใช้ที่ sudo | account auto-login |
| `KIOSK_WIFI_SSID/PASS` | (ว่าง) | (ว่าง) | ต่อ Wi-Fi ตอน setup |
| `KIOSK_DAILY_REBOOT` | `03:00` | `22:30` | รีบูตรายวัน (`""` = ปิด) |
| `KIOSK_IDLE_LOGOUT_MIN` | `0` | `30` | student mode: logout เมื่อไม่ใช้งาน |
| `KIOSK_MONITOR_AGENT_URL` | – | `.../dashboard/monitor/agent` | window 2 ให้ครูมอนิเตอร์ |
| `KIOSK_POWER_ON` | `06:30` | `07:30` | เปิดเครื่องเองผ่าน BIOS RTC wakealarm (`""` = ปิด) |
| `KIOSK_POWER_OFF` | (ว่าง) | `17:30` | ปิดเครื่องเองตามเวลา (systemd timer + cron fallback) |
| `KIOSK_BATT_CRITICAL` | `5` | `5` | แบตต่ำกว่า % นี้ และไม่ได้เสียบไฟ → shutdown ปลอดภัย (`0` = ปิด) |
| `KIOSK_BATT_CHARGE_MAX` | `80` | `80` | จำกัดชาร์จสูงสุด ยืดอายุแบต (`0` = ไม่จำกัด) |
| `KIOSK_ROTATE` | `normal` | `normal` | หมุนจอ: `normal` แนวนอน / `left`,`right` แนวตั้ง / `inverted` กลับหัว / `auto` ไม่ตั้งค่า (ปรับพิกัดทัชให้อัตโนมัติ) |
| `KIOSK_TIMEZONE` | `Asia/Bangkok` | `Asia/Bangkok` | ตั้ง timezone + RTC=UTC + NTP ให้ตารางเวลาแม่นยำ |

## สิ่งที่สคริปต์ทำ (ทั้ง 2 โหมด)

1. **Pre-flight** — เช็ค user, disk ≥ 3GB, internet
2. **Wi-Fi** (ถ้าระบุ)
3. **apt install** — Chromium + PulseAudio + ALSA + fonts + Plymouth
4. **Wake daemon** port 9999 — *เฉพาะ door mode* (สำหรับ `wakeKioskScreen()`)
5. **LightDM autologin** + `xset` ปิด screen blank
6. **Chromium managed policy** — auto-grant mic/camera, ปิด update/sync
7. **CMS branding** — Plymouth theme + wallpaper + LightDM greeter (ตามสีธีมและโลโก้จาก CMS)
8. **Launcher**
   - **door**: `chromium --kiosk` full lock URL เดียว
   - **student**: `chromium` ปกติ (window 1) + `chromium --app=...monitor/agent` (window 2)
9. **Watchdog** — Chromium ตายเปิดใหม่ใน 15 วิ
10. **Health-check** — ping URL ทุก 60 วิ, ล้ม 3 ครั้งรีโหลด
11. **Idle logout** — *เฉพาะ student mode* (xautolock)
12. **ปิด service เกินจำเป็น** — bluetooth, cups, snapd, apt-daily, avahi ฯลฯ
13. **Kernel/GRUB tuning** — swappiness, dirty ratio, `noatime`, journald in-RAM, ปิด core dump; Intel GPU → `intel_idle.max_cstate=1 i915.enable_psr=0`
14. **Daily reboot**
15. **Battery guard** — จำกัดชาร์จ (`charge_control_end_threshold`), เขียนสถานะที่ `/run/kiosk-battery.json`, แบตวิกฤต → shutdown ปลอดภัย
16. **Power schedule** — ปิดเครื่องตามเวลา + ตั้ง BIOS RTC wakealarm ให้เปิดเองตอนเช้า (re-arm ทุก 10 นาที + ก่อน shutdown ทุกครั้ง) พร้อม sync เวลา/RTC=UTC
17. **สิทธิ์เบราว์เซอร์** — managed policy อนุญาต กล้อง/ไมค์/ตำแหน่ง/แจ้งเตือน/แชร์หน้าจอ เฉพาะโดเมนระบบ, อนุญาต USB (WebUSB ถามก่อนใช้), บล็อก Bluetooth/Serial/DevTools/incognito
18. **Backend guard** — บังคับใช้ backend ของโรงเรียนเท่านั้น (ถ้าชี้ไป Lovable Cloud จะถูกเปลี่ยนกลับอัตโนมัติ)

## ตรวจสอบ / Debug

```bash
sudo tail -f /var/log/kiosk-setup.log
journalctl -u kiosk-watchdog -f
journalctl -u kiosk-healthcheck -f
journalctl -u kiosk-wake -f   # door mode เท่านั้น

# ปลุกจอด้วยมือ (door)
curl http://127.0.0.1:9999/wake

# แบตเตอรี่ / ตารางเปิด-ปิดเครื่อง
curl http://127.0.0.1:9998/battery
systemctl list-timers 'kiosk-*'
cat /sys/class/rtc/rtc0/wakealarm   # ต้องไม่เป็น 0
timedatectl                          # RTC in local TZ ต้องเป็น no
```

## ถอนการติดตั้ง

```bash
sudo bash uninstall-mxlinux-kiosk.sh
sudo reboot
```

คืน lightdm / GRUB / fstab / journald / sysctl / systemd services / autostart ทั้งหมด
