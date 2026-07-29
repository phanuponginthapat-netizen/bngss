# คู่มือสำรอง & ย้ายระบบ (Backup & Migration Guide)

หน้าจอควบคุมทั้งหมด: `/dashboard/admin/backup-center`
(เมนู: **API/Integrations → Backup & Migration Center**)

---

## 1. สำรองข้อมูลรายสัปดาห์ (2 คลิก)

1. เข้า **Backup & Migration Center → แท็บ "สำรอง"**
2. กด **"ดาวน์โหลด Full Backup"** — ได้ไฟล์ `smart-school-full-YYYY-MM-DD.zip`
   ในไฟล์เดียวมีครบ 100% สำหรับสร้างระบบใหม่:
   - `schema.sql` — ตาราง, คอลัมน์, PK/UNIQUE/CHECK, **Foreign Keys**, Index,
     ฟังก์ชัน, ทริกเกอร์, GRANT, **RLS + Policy ทุกตาราง**
   - `extras.sql` — extensions, sequences, views, **cron jobs (งานตั้งเวลา)**
   - `storage-policies.sql` — RLS ของ storage.objects
   - `buckets.json` — bucket ทุกตัว + public/private + ขนาดจำกัด + mime types
   - `auth-users.json` — ผู้ใช้ทุกคน + **password hash เดิม** + identities
     (ล็อกอินด้วยรหัสเดิมได้ทันทีหลังกู้คืน)
   - `edge-functions.json` — รายชื่อ edge functions ทั้งหมด (โค้ดอยู่ใน repo)
   - `tables/*.json` — ข้อมูลทุกตาราง 250+ ตัว
   - `storage-manifest.json` — รายการไฟล์ใน bucket ทั้งหมด
   - `RESTORE.md` + `restore.sh` — คู่มือ + สคริปต์กู้คืน
   - `manifest.json` — เมตาดาต้าเวอร์ชัน + จำนวนแถว

เก็บไฟล์ ZIP ไว้ที่ปลอดภัย (Google Drive ส่วนตัว, external HDD, S3)

**อัตโนมัติทุกคืน:** ตั้งค่าที่แท็บ "ย้ายระบบ" → ใช้ **External Backup**
(cron job `backup-to-external` — ต้องกำหนด `EXTERNAL_SUPABASE_URL` + `EXTERNAL_SUPABASE_SERVICE_KEY`)


---

## 2. กู้คืนจากไฟล์สำรอง (1 คลิก)

1. เข้า **Backup & Migration Center → แท็บ "กู้คืน"**
2. เลือกไฟล์ ZIP → ทดสอบด้วย **"Dry Run"** ก่อน
3. ถ้าผลลัพธ์โอเค → เอา Dry Run ออก → กด "เริ่มกู้คืน"
4. ต้องการเขียนทับข้อมูลเดิมทั้งหมด → เปิด **"ล้างข้อมูลเดิมก่อน (Truncate)"**

ระบบใช้ **upsert on id** — ถ้ามีแถวเดิมจะอัพเดต ถ้าไม่มีจะเพิ่ม

---

## 3. ย้ายระบบไป Supabase ใหม่ / Self-host (3 คำสั่ง)

**เตรียม:** สร้าง project Supabase ปลายทาง แล้วรวบรวม:
- `PROJECT_REF` (จาก URL dashboard)
- `DB_PASSWORD` (Settings → Database)
- `SERVICE_ROLE_KEY` (Settings → API)

### คำสั่ง 1: สร้าง schema + FK + RLS + storage buckets + edge functions

```bash
export PROJECT_REF=xxxx
export DB_PASSWORD='...'
export SUPABASE_URL=https://xxxx.supabase.co
export SERVICE_ROLE_KEY='eyJ...'
bash scripts/deploy-external-supabase.sh
```

สคริปต์นี้ (มีอยู่แล้วในโค้ด repo) จะ:
- Push 500+ migrations → schema + FK + RLS ครบทุกอย่าง
- สร้าง 22 storage buckets (public + private)
- Deploy 80+ edge functions

### คำสั่ง 2: Import ข้อมูล

```bash
export ADMIN_JWT="<login แอดมินที่ปลายทาง แล้วเอา access_token>"
curl -X POST "$SUPABASE_URL/functions/v1/system-restore?truncate=1" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -F "file=@smart-school-full-YYYY-MM-DD.zip"
```

### คำสั่ง 3: ชี้ frontend ไปที่ project ใหม่

แก้ `.env` (ปิด Lovable Cloud ก่อน ไม่งั้นถูกเขียนทับ):

```dotenv
VITE_SUPABASE_URL="https://xxxx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SUPABASE_PROJECT_ID="xxxx"
```

Publish ใหม่ → เสร็จ

---

## 4. Storage files (รูปภาพ, PDF)

Full Backup มีแค่ **รายการไฟล์** ไม่ได้บรรจุไบต์ไฟล์ (เกิน 150s timeout)
ดาวน์โหลดแยกจาก **แท็บ Storage** ทีละ bucket ตามต้องการ:

- `profile-images` (public)
- `cms-images` (public)
- `garbage-images` (public)
- `homework-files`, `home-visit-photos`, `document-files` ฯลฯ (private)

Restore storage: ใช้ Supabase CLI:
```bash
supabase storage cp --recursive ./profile-images ss://profile-images \
  --project-ref $PROJECT_REF
```

---

## 5. Rollback / Disaster Recovery

**สถานการณ์:** ข้อมูลสำคัญโดนลบ

1. หา ZIP สำรองล่าสุดที่มีข้อมูล
2. Backup Center → กู้คืน → **Dry Run** ก่อน — ยืนยันว่ามีข้อมูลที่ต้องการ
3. ทำจริง (ไม่ต้อง Truncate — ระบบ upsert จะ merge ให้)

**สถานการณ์:** ทั้งฐานข้อมูลเสียหาย

1. สร้าง Supabase project ใหม่ ทำตามข้อ 3
2. Restore ZIP ล่าสุด (**เปิด Truncate**)
3. Restore storage buckets ที่จำเป็น
4. ชี้ .env มา project ใหม่

---

## 6. ข้อจำกัดที่ควรรู้

- Edge function timeout 150 วินาที — ตารางใหญ่มาก (auth logs, face_scan_logs) อาจ backup ไม่ทัน → ใช้ external cron backup แทน
- Full Backup ไม่รวมข้อมูลใน schema `auth` — user accounts ต้อง export แยกด้วย Supabase CLI (`supabase db dump --data-only --schema auth`)
- Restore ต้อง schema พร้อมอยู่แล้วปลายทาง (รัน migrations ก่อน)
- `service_role_key` และ database password **ไม่สามารถดูได้จาก Lovable Cloud** — ต้องใช้ Supabase project ภายนอกเท่านั้น
