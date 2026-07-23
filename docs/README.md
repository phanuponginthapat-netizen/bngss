# 📚 คู่มือระบบ Smart School (BNGSS)

ศูนย์รวมเอกสารทั้งหมดของระบบ — เปิดที่นี่ที่เดียว หาต่อได้ทุกเรื่อง

---

## 🚀 Quickstart (เริ่มใช้ระบบใน 5 นาที)

> ⚡ **ทางลัดที่ง่ายที่สุด**: หลัง deploy เสร็จ เปิด **`/setup`** — Setup Wizard จะพาทำทีละขั้นอัตโนมัติ

1. **Remix / Clone โปรเจกต์** — Secrets ที่จำเป็น (`CRON_SECRET`, `VAPID_*`) ถูกสร้างอัตโนมัติ
2. **ตั้ง Secrets เพิ่ม** (ถ้าใช้) — LINE, Google Drive, DashScope, DeepSeek ผ่านเมนู Backend
3. **Login ครั้งแรก** — `admin@school.com` / `Admin@2026` (เปลี่ยนรหัสทันทีหลัง login)
4. **ตั้งค่า CMS** → Admin → CMS Settings (โลโก้, ชื่อโรงเรียน, สี)
5. **Publish** → ปุ่มมุมขวาบน หรือ deploy ไป Vercel (ดู [DEPLOY-VERCEL](./DEPLOY-VERCEL.md))

---

## 📖 คู่มือทั้งหมด

### 🛠️ ติดตั้ง & Deploy
| หัวข้อ | ไฟล์ | เหมาะกับใคร |
| --- | --- | --- |
| **Setup Wizard (ในระบบ)** | เปิด `/setup` | ทุกคน |
| Deploy ไป Vercel | [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) | Admin / DevOps |
| ใช้งาน Supabase / Lovable Cloud | [SUPABASE-GUIDE.md](./SUPABASE-GUIDE.md) | Admin / DevOps |
| ติดตั้ง Kiosk บน MX Linux | [KIOSK-MXLINUX-SETUP.md](./KIOSK-MXLINUX-SETUP.md) | ช่างเทคนิค |
| ตั้งค่า RTSP CCTV | [RTSP-CCTV-SETUP.md](./RTSP-CCTV-SETUP.md) | ช่างเทคนิค |

### 💾 Backup & Migration
| หัวข้อ | ไฟล์ |
| --- | --- |
| สำรอง / กู้คืน / ย้ายระบบ | [BACKUP-MIGRATION-GUIDE.md](./BACKUP-MIGRATION-GUIDE.md) |

### 📱 LINE Official Account
| หัวข้อ | ไฟล์ | เหมาะกับใคร |
| --- | --- | --- |
| คู่มือ Admin (ตั้งค่า LINE OA) | [line-oa-admin-guide.md](./line-oa-admin-guide.md) | Admin |
| คู่มือผู้ใช้ (ผู้ปกครอง/นักเรียน) | [line-oa-user-guide.md](./line-oa-user-guide.md) | End-user |

### 👨‍💼 งานประจำของ Admin
| หัวข้อ | ไฟล์ |
| --- | --- |
| Admin Playbook (งาน daily/weekly/monthly) | [ADMIN-PLAYBOOK.md](./ADMIN-PLAYBOOK.md) |

---

## 🆘 ติดปัญหา?

- **ระบบล่ม / RLS error** → เข้า `/dashboard/admin/rls-audit` ตรวจ policy
- **สแกน QR ไม่ได้** → `/dashboard/admin/role-troubleshoot` เช็คสิทธิ์ role
- **Upload ไม่ได้** → เช็ค Storage bucket + role (ดู ADMIN-PLAYBOOK ข้อ "Upload debug")
- **ข้อมูลหาย** → กู้จาก Backup ล่าสุด (ดู BACKUP-MIGRATION-GUIDE)
- **Kiosk 404 / ไม่ boot** → รัน `bash scripts/kiosk/uninstall-mxlinux-kiosk.sh` แล้วติดตั้งใหม่

## 🔗 ลิงก์ในระบบ (ใช้บ่อย)

- Backup Center → `/dashboard/admin/backup-center`
- System Health → `/dashboard/admin/system-health`
- RLS Audit → `/dashboard/admin/rls-audit`
- Role Troubleshoot → `/dashboard/admin/role-troubleshoot`
- CMS Settings → `/dashboard/admin/cms-settings`

---

_Last updated: 2026-07-23 — โปรเจกต์นี้สร้างและดูแลด้วย Lovable_
