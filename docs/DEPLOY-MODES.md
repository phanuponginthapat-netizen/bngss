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
**Windows 10/11 (แนะนำ):** ดาวน์โหลด `school-system-setup.exe` → กด Next → เลือกรูปแบบ และโฟลเดอร์บน HDD ที่เก็บข้อมูล (เช่น `D:\SchoolData`)
- Start Menu "ระบบโรงเรียน" มี: เปิดระบบ / สำรองข้อมูล / กู้คืน / อัปเดต / ตั้งผู้ดูแลระบบ / ถอนการติดตั้ง
- ไฟล์ .exe สร้างจาก GitHub Actions → workflow "Build Standalone Installer (setup.exe)"
- ยังไม่มีลายเซ็นดิจิทัล Windows อาจเตือน ให้กด "More info → Run anyway"
- สำรอง: ตั้งตัวแปร (ไม่ใช้ .exe) คลิกขวา `deploy/standalone/install-windows.ps1` → Run with PowerShell

**เก็บบน HDD ทั้งระบบ:** ฐานข้อมูล ไฟล์ทุกชนิด และไฟล์สำรอง อยู่ในโฟลเดอร์ที่เลือก ระบบจะไม่ย้ายไฟล์ขึ้น Google Drive และไม่บังคับโควต้า free tier

หลังติดตั้ง:
1. เปิด `http://<IP เครื่องแม่ข่าย>` สมัครบัญชีแรก
2. `sudo bash deploy/standalone/make-admin.sh you@school.ac.th`
3. ตั้งค่าข้อมูลโรงเรียนในเมนู CMS
4. FaceGate agent / แท็บเล็ตสแกน: ใช้ URL `http://<IP>:8000/functions/v1/kiosk-api`

### ย้ายข้อมูลจาก Cloud มาเครื่องในโรงเรียน
```bash
sudo CLOUD_DB_URL=postgresql://... CLOUD_URL=https://xxx.supabase.co CLOUD_SERVICE_KEY=... \
     bash deploy/standalone/migrate-from-cloud.sh
```
ย้ายบัญชีผู้ใช้ ข้อมูลทั้งหมด และไฟล์ใน Storage (ไฟล์ที่เคยย้ายไป Google Drive ให้ดึงกลับก่อนย้าย)

### สำรอง / กู้คืน / อัปเดต (Linux)
`sudo school-backup` · `sudo school-restore [ไฟล์]` · `sudo school-update`

## เชื่อมกับระบบหลักของเขต (ใช้ได้ทั้ง Cloud และ Standalone)
1. ผู้ดูแลระบบหลักเปิด **ภาพรวมเขตพื้นที่** → เพิ่มโรงเรียน → กด "ออกรหัส" (ใช้ครั้งเดียว 7 วัน)
2. โรงเรียนเปิด **เชื่อมระบบเขต** → ใส่ URL ระบบหลัก + รหัสโรงเรียน + รหัสลงทะเบียน
3. ทุกคืน 01:30 โรงเรียนส่งตัวเลขสรุป (ไม่มีข้อมูลรายคน) ถ้าเน็ตหลุดจะเก็บในคิวและส่งเองทุก 10 นาที
4. ระบบหลักแสดงทุกโรงเรียนในหน้าเดียว โรงเรียนที่ไม่ส่งเกิน 2 วันจะขึ้นสีแดง ดาวน์โหลด Excel ได้

### แบบผสม
ใส่ `CLOUD_DB_URL=postgresql://...` ใน `/opt/school-stack/backup.env` ระบบจะส่งข้อมูลขึ้น Cloud ทุกคืนเมื่อมีเน็ต

### ข้อจำกัดเมื่อไม่มีเน็ต
LINE แจ้งเตือน, ผู้ช่วย AI, Google Drive และการเข้าจากนอกโรงเรียนจะใช้ไม่ได้จนกว่าจะมีเน็ต ส่วนสแกนหน้า/QR, กรอกคะแนน, พิมพ์เอกสาร ใช้ได้ปกติ

## ใส่กุญแจบริการ (ชุดติดตั้งในโรงเรียน)
- ตอนติดตั้ง setup.exe มีหน้าให้กรอก LINE / Gemini / OpenAI / Google OAuth (เว้นว่างได้)
- แก้ภายหลัง: Start Menu > "ใส่กุญแจบริการ" หรือในระบบ ตั้งค่า > API Keys
- กุญแจเก็บในฐานข้อมูลบน HDD ใช้เฉพาะตอนต่อเน็ตไปบริการนั้น ข้อมูล/ไฟล์ยังอยู่บน HDD ทั้งหมด
- หน้าเว็บชุดติดตั้งในโรงเรียนถูก build แยก (VITE_STANDALONE=1) จะไม่ต่อไประบบหลักเด็ดขาด

## โดเมน (ไม่บังคับ)
- ใส่โดเมนในหน้าติดตั้ง setup.exe → ระบบขอ HTTPS อัตโนมัติ (Let's Encrypt)
- ต้องทำเอง: ชี้ A record ของโดเมนไปที่ IP สาธารณะของโรงเรียน + เปิดพอร์ต 80/443 ที่เราเตอร์มายังเครื่องแม่ข่าย
- ในวง LAN ยังเข้า http://IP ได้เหมือนเดิม (หน้าเว็บกับข้อมูลใช้ที่อยู่เดียวกัน)
- เปลี่ยนโดเมนภายหลัง: แก้ไฟล์ `<โฟลเดอร์ข้อมูล>/stack/domain` แล้วกด "อัปเดตระบบ"
