# ติดตั้งระบบให้โรงเรียนอื่น — 2 แบบ

ระบบใช้โค้ดชุดเดียวกัน ต่างกันแค่ไฟล์ `app-config.js` ที่บอกว่าจะต่อฐานข้อมูลที่ไหน

| | แบบ Cloud | แบบ Standalone (LAN) |
|---|---|---|
| ฐานข้อมูล | Supabase บนอินเทอร์เน็ต | PC แม่ข่ายในโรงเรียน |
| ต้องมีเน็ต | ใช่ | ไม่ (ยกเว้น LINE/ผู้ปกครองนอกโรงเรียน) |
| ค่าใช้จ่าย | ฟรีถึงโควต้า free tier | ค่าไฟ + PC 1 เครื่อง |
| สำรองข้อมูล | Google Drive | ทุกคืน 02:00 ลงเครื่อง/External HDD (+ Cloud ถ้าแบบผสม) |

## แบบ Cloud
ทำตาม `docs/PORTABLE-DEPLOY.md` (สร้างโปรเจกต์ Supabase → `scripts/deploy-external-supabase.sh` → แก้ `public/app-config.js` → deploy เว็บบน Vercel/Cloudflare)

## แบบ Standalone
สเปกขั้นต่ำ PC แม่ข่าย: CPU 4 คอร์, RAM 8 GB, SSD 128 GB, IP คงที่ในวง LAN

**Linux (Ubuntu / MX Linux)**
```bash
sudo bash deploy/standalone/install.sh            # ในโรงเรียนอย่างเดียว
sudo bash deploy/standalone/install.sh --hybrid   # แบบผสม
```
**Windows 10/11:** คลิกขวา `deploy/standalone/install-windows.ps1` → Run with PowerShell (Administrator)

หลังติดตั้ง:
1. เปิด `http://<IP เครื่องแม่ข่าย>` สมัครบัญชีแรก
2. `sudo bash deploy/standalone/make-admin.sh you@school.ac.th`
3. ตั้งค่าข้อมูลโรงเรียนในเมนู CMS
4. FaceGate agent / แท็บเล็ตสแกน: ใช้ URL `http://<IP>:8000/functions/v1/kiosk-api`

### ย้ายข้อมูลจาก Cloud มาเครื่องในโรงเรียน
หน้า Backup Center → "สำรองทั้งระบบ" ได้ไฟล์ ZIP → เปิด `http://<IP>/setup` → กู้คืนจาก ZIP

### แบบผสม
ใส่ `CLOUD_DB_URL=postgresql://...` ใน `/opt/school-stack/backup.env` ระบบจะส่งข้อมูลขึ้น Cloud ทุกคืนเมื่อมีเน็ต

### ข้อจำกัดเมื่อไม่มีเน็ต
LINE แจ้งเตือน, ผู้ช่วย AI, Google Drive และการเข้าจากนอกโรงเรียนจะใช้ไม่ได้จนกว่าจะมีเน็ต ส่วนสแกนหน้า/QR, กรอกคะแนน, พิมพ์เอกสาร ใช้ได้ปกติ
