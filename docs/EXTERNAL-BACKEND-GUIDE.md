# ย้ายไป Backend ภายนอก (Supabase self-hosted) + เก็บไฟล์บน Google Drive

## 1. เปลี่ยน backend โดยไม่ต้อง build ใหม่

มี 3 ทาง (ลำดับความสำคัญจากบนลงล่าง):

1. **หน้า `/setup` → การ์ด "เชื่อมต่อ Backend ภายนอก"** — กรอก URL + anon key → ทดสอบและบันทึก (เก็บใน localStorage ของเครื่องนั้น)
2. **แก้ไฟล์ `/app-config.js` บนโฮสต์** (ใช้ร่วมกันทุกคน แก้ได้เลยหลัง deploy บน Vercel/Cloudflare):
   ```js
   window.__BNG_CONFIG__ = {
     SUPABASE_URL: "https://db.myschool.ac.th",
     SUPABASE_ANON_KEY: "eyJ...",
     SUPABASE_PROJECT_ID: "my-school",
     STORAGE_PROVIDER: "gdrive", // หรือ "supabase"
   };
   ```
3. **Environment variables ตอน build**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_STORAGE_PROVIDER`

## 2. ติดตั้ง Supabase self-hosted (สรุปสั้น)

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker && cp .env.example .env   # แก้รหัสผ่าน/JWT secret
docker compose up -d
```
จากนั้น:
```bash
supabase link --project-ref <ref>            # หรือชี้ DB URL ตรง
supabase db push                             # รัน migrations ทั้งหมด (ใน supabase/migrations)
supabase functions deploy                    # deploy edge functions ทั้งหมด
```
ตั้ง secrets ตาม `scripts/EXTERNAL_SUPABASE_SETUP.md`

## 3. เก็บไฟล์บน Google Drive

ตั้ง secrets บน backend:

| Secret | ใช้ทำอะไร |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client (Web) |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | refresh token ของบัญชี Drive โรงเรียน (scope `drive.file`) |
| `GOOGLE_DRIVE_FOLDER_ID` | โฟลเดอร์ปลายทาง (ไม่ใส่ = My Drive) |

แล้วตั้ง `STORAGE_PROVIDER = "gdrive"` — ทุกการอัปโหลดในระบบจะวิ่งผ่าน edge function `drive-storage`
(รูปสาธารณะจะได้ลิงก์ `https://drive.google.com/uc?export=view&id=...`)

## 4. Full Backup ครบทุกอย่าง

`/dashboard/admin/backup-center` → **สำรองทั้งระบบในคลิกเดียว** ได้ ZIP ที่ประกอบด้วย:

- `tables/*.json` — ข้อมูลทุกตาราง
- `schema.sql` — ตาราง/FK/index/ฟังก์ชัน/ทริกเกอร์/GRANT/**RLS + policy**
- `storage-policies.sql`, `buckets.json`, `storage/<bucket>/<path>` — ไฟล์จริงทุก bucket
- `auth-users.json` — ผู้ใช้ + password hash เดิม
- `migrations/*.sql` — **ไฟล์ migration ทั้งหมด (543 ไฟล์)**
- `edge-functions/**` — **ซอร์สโค้ด edge functions ทั้งหมด (113 ไฟล์)**
- `supabase-config.toml`, `RESTORE.md`, `restore.sh`

กู้คืน: `/setup` → เลือก ZIP → "เริ่มติดตั้งอัตโนมัติ" หรือแท็บกู้คืนใน Backup Center
