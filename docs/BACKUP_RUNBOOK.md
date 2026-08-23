# คู่มือสำรอง-กู้คืน-ภัยพิบัติ (Backup Runbook)

> กระชับ • ใช้งานจริง • อัพเดต 2026-08-22

---

## 1) สำรองข้อมูล (Backup)

### 1.1 ดาวน์โหลด ZIP ฉุกเฉิน (CSV)
- **เมนู:** `/dashboard/admin/backup-external` → **ดาวน์โหลด ZIP ตอนนี้**
- **API:** `POST /functions/v1/backup-snapshot` (Bearer: admin/director, rate 3/นาที)
- **ผลลัพธ์:** `school-backup-YYYY-MM-DD.zip` มี CSV ทุกตารางหลัก + `_summary.json`
- **ตรวจสอบอัตโนมัติ:** หลังสร้าง ZIP ระบบจะ `ZipReader.list()` + เช็ค `size>0` → บันทึก `backup_snapshots(status=verified/failed, file_size, verification_log)`
- **เก็บ:** อัพโหลดขึ้น Google Drive / NAS / External HDD ทันที (อย่าเก็บที่เดียว)

### 1.2 Full Backup (ย้ายเครื่องได้ 100%)
- **เมนู:** `/dashboard/admin/backup-center` → แท็บ **สำรอง** → **ดาวน์โหลด Full Backup**
- **API:** `POST /functions/v1/system-backup?mode=full` → ได้ `smart-school-full-*.zip`
- ประกอบด้วย: `schema.sql`, `storage-policies.sql`, `buckets.json`, `auth-users.json`, `tables/*.json`, `storage-manifest.json`, `RESTORE.md`, `restore.sh`, `manifest.json`
- **Storage ไฟล์จริง:** แยกดาวน์โหลดต่อ bucket `?mode=storage&bucket=NAME`

### 1.3 สำรองอัตโนมัติไป Supabase ภายนอก
- ตั้ง `EXTERNAL_SUPABASE_URL` + `EXTERNAL_SUPABASE_SERVICE_KEY` ใน Secrets
- รัน SQL ครั้งเดียวที่ Supabase ภายนอก:
  ```sql
  CREATE TABLE IF NOT EXISTS public.backup_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL, snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
    row_count int, data jsonb NOT NULL, created_at timestamptz DEFAULT now(),
    UNIQUE (table_name,snapshot_date)
  );
  ```
- **กดสำรอง:** `/dashboard/admin/backup-external` → **เริ่มสำรองข้อมูลตอนนี้**
- **Cron:** `backup-to-external` ทุกคืน (ต้องมี `x-cron-secret`) → log ที่ `school_settings.last_external_backup`

### 1.4 ตารางงาน (Retention)
- **นโยบาย:** ลบ backup เกิน **30 วัน** แต่คง **10 ชุดล่าสุด** เสมอ
- **ฟังก์ชัน:** `public.cleanup_backup_retention()` + `cleanup_backup_retention_by_date()` (migration `20260822100016`)
- **Cron:** `backup-retention-daily` 02:00 น. (เวลาไทย, 19:00 UTC) → ลบอัตโนมัติ
- **รันมือ:** `SELECT public.cleanup_backup_retention();`

---

## 2) กู้คืน (Restore)

### 2.1 กู้จาก ZIP ผ่านหน้าเว็บ (ง่ายสุด)
1. `/dashboard/admin/backup-center` → แท็บ **กู้คืน**
2. เลือก ZIP → ติ๊ก `สร้างโครงสร้าง DB` + `กู้คืนผู้ใช้+รหัสเดิม`
3. กด **Dry Run** → ตรวจ log → เอา Dry Run ออก → **เริ่มกู้คืน**
4. ต้องเขียนทับทั้งหมด → เปิด `Truncate`

### 2.2 กู้ผ่าน curl
```bash
export SUPABASE_URL=https://<ref>.supabase.co
export ADMIN_JWT=<access_token admin>
curl -X POST "$SUPABASE_URL/functions/v1/system-restore?truncate=1" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -F "file=@smart-school-full-YYYY-MM-DD.zip"

# ทดสอบก่อน: ?dry=1  |  ไม่สร้าง schema: ?schema=0  |  ไม่กู้ user: ?users=0
```

### 2.3 กู้ไฟล์ Storage
- ดาวน์โหลด ZIP ต่อ bucket จาก Backup Center → อัพโหลดกลับผ่าน `system-restore` (วางถูก bucket อัตโนมัติ)
- หรือ CLI: `supabase storage cp --recursive ./profile-images ss://profile-images --project-ref $REF`

### 2.4 ตรวจหลังกู้
- เช็ค `backup_snapshots` → `status=verified`
- เช็ค `/setup` → `setup-health-check` เขียวทั้งหมด
- ทดสอบ login ด้วยรหัสเดิม (จาก `auth-users.json`)

---

## 3) กู้ภัยพิบัติ (Disaster Recovery)

### 3.1 ข้อมูลบางส่วนหาย (ลบผิด)
1. หา ZIP ล่าสุดที่มีข้อมูล → **Dry Run** ยืนยัน
2. กู้จริง **ไม่ต้อง Truncate** (upsert จะ merge)

### 3.2 ฐานข้อมูลพังทั้งระบบ / ย้าย Supabase
1. สร้าง project ใหม่ → จด `PROJECT_REF`, `DB_PASSWORD`, `SERVICE_ROLE_KEY`
2. Deploy โครงสร้าง:
   ```bash
   export PROJECT_REF=xxx DB_PASSWORD='...' SUPABASE_URL=https://xxx.supabase.co SERVICE_ROLE_KEY='...'
   bash scripts/deploy-external-supabase.sh
   ```
   (push 500+ migrations + สร้าง buckets + deploy edge functions)
3. Restore ZIP ล่าสุด: `curl .../system-restore?truncate=1 -F file=@*.zip`
4. Restore storage buckets ที่จำเป็น
5. ชี้ frontend `.env` ไป project ใหม่:
   ```
   VITE_SUPABASE_URL="https://xxx.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="<anon>"
   VITE_SUPABASE_PROJECT_ID="xxx"
   ```
6. ตั้ง Secrets ที่ `Project Settings → Edge Functions → Secrets` (ดู `secrets.json` ใน ZIP ถ้า export แบบ `?secrets=1`)

### 3.3 Lovable Cloud ล่ม
- ใช้ ZIP ล่าสุด + Supabase ภายนอกที่มี `backup_snapshots` → ทำตาม 3.2 ได้ทันที (RTO ~1 ชม. ถ้าเตรียม project ไว้ล่วงหน้า)

---

## 4) ตรวจสอบ & ซ้อมแผน
- **รายวัน:** ดู `school_settings.last_external_backup` + `backup_snapshots` ล่าสุด `verified`
- **รายสัปดาห์:** ดาวน์โหลด ZIP → เปิดดู `_summary.json` → ลอง Dry Run บน project ทดสอบ
- **รายเดือน:** ซ้อม DR จริง (สร้าง project ทดสอบ → restore เต็ม) + ตรวจ retention (ต้องเหลือ ≤30 วัน / ≥10 ชุด)
- **Alert:** ถ้า `status=failed` หรือ `file_size=0` → เช็ค Edge Functions Logs → รัน backup ซ้ำ

## 5) ข้อจำกัด
- Edge timeout 150 วินาที → ตารางใหญ่มากให้ใช้ `backup-to-external` แทน ZIP เดียว
- Full ZIP ไม่รวมไฟล์ไบต์ storage (มีแค่ manifest) → ต้องสำรอง bucket แยก
- ต้องรัน migrations ก่อน restore เสมอ

---
*ดูเพิ่ม: `BACKUP-MIGRATION-GUIDE.md`, `SUPABASE-GUIDE.md`*
