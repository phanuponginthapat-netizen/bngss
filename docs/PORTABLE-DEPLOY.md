# นำระบบไปใช้กับโรงเรียนอื่น (Portable Deploy)

ระบบนี้ออกแบบให้ย้าย backend ได้โดย **ไม่ต้องแก้โค้ด** — เลือกใช้วิธีใดวิธีหนึ่งด้านล่าง

## ลำดับการอ่านค่า backend (`src/lib/runtimeConfig.ts`)

1. `localStorage` — ตั้งจากหน้า **Setup Wizard** (เฉพาะเครื่อง/เบราว์เซอร์นั้น)
2. `window.__BNG_CONFIG__` จาก `/app-config.js` — แก้ได้หลัง deploy โดยไม่ต้อง build ใหม่ (แนะนำ)
3. `import.meta.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (หรือ `VITE_SUPABASE_ANON_KEY`), `VITE_SUPABASE_PROJECT_ID`
4. ค่าเริ่มต้นของโรงเรียนต้นทาง (fallback สุดท้าย)

> ค่าที่ชี้ไป Lovable Cloud จะถูกกรองทิ้งเสมอทุกชั้น

## ขั้นตอนติดตั้งสำหรับโรงเรียนใหม่

### 1) เตรียม Supabase ของตัวเอง
สร้างโปรเจกต์ Supabase (cloud หรือ self-hosted) แล้วจดค่า
`Project URL`, `anon/publishable key`, `service role key`, `database URL`

### 2) ติดตั้งฐานข้อมูล
```bash
bash scripts/build-migration-bundle.sh
psql "$DATABASE_URL" -f dist/bundle/schema-bundle.sql
```
ไฟล์ migration ทั้งหมดเป็น idempotent จึงรันซ้ำได้

### 3) Deploy Edge Functions
```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxx      # Personal Access Token
export SUPABASE_PROJECT_REF=xxxxxxxx      # project ref ของโรงเรียนคุณ
bash scripts/deploy-external-functions.sh
```

### 4) ตั้งค่า secrets ที่จำเป็น (ตั้งเท่าที่ใช้)
| Secret | ใช้กับ |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` | LINE OA / LINE Vault |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Drive / Google Chat |
| `GOOGLE_CHAT_SA_JSON` | Google Chat DM (Workspace) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push |
| `CRON_SECRET` | งานตามเวลา (pg_cron → edge) |
| `WIZMIND_BRIDGE_KEY` | กล้อง WizMind / kiosk bridge |

### 5) ชี้แอปไปที่ backend ใหม่
แก้ `public/app-config.js`:
```js
window.__BNG_CONFIG__ = {
  SUPABASE_URL: "https://<your-ref>.supabase.co",
  SUPABASE_ANON_KEY: "<anon key>",
  SUPABASE_PROJECT_ID: "<your-ref>",
  STORAGE_PROVIDER: "",   // "" | "supabase" | "gdrive"
};
```
หรือใช้หน้า **Setup Wizard → เชื่อมต่อ Backend ภายนอก** เพื่อทดสอบและบันทึกค่า

### 6) สร้างผู้ดูแลระบบคนแรก
สมัครผู้ใช้ผ่านหน้า Auth แล้วให้สิทธิ์ผ่าน SQL:
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@yourschool.ac.th'
on conflict do nothing;
```

### 7) ปรับข้อมูลโรงเรียน
ตั้งชื่อ/โลโก้/ปีการศึกษาในเมนู **CMS → ข้อมูลโรงเรียน** และ **ปีการศึกษา**
(หน้า Loading และหัวเว็บดึงค่าจาก CMS อัตโนมัติ)

## สิ่งที่ยังต้องปรับเองต่อโรงเรียน
- Storage buckets ถูกสร้างจาก migration แล้ว แต่ไฟล์เดิมไม่ได้ย้ายมาด้วย
- ปฏิทินวันหยุด / เวลาเข้าแถว / เกณฑ์การมาสาย ตั้งได้จากหน้าตั้งค่า
- Kiosk และกล้อง RTSP ดู `docs/KIOSK-MXLINUX-SETUP.md`, `docs/RTSP-CCTV-SETUP.md`
