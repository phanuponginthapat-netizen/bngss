# สถานะการย้ายไป Supabase ภายนอก (Migration Status)

โปรเจกต์ปลายทาง: `https://gwmszzoqqxmejefhayqf.supabase.co`

## ย้ายเรียบร้อยแล้ว ✅

| รายการ | จำนวน |
|---|---|
| ตาราง (public) | 257 |
| ฟังก์ชันฐานข้อมูล | 241 |
| RLS policies (public + storage) | 808 |
| Triggers | 418 |
| Storage buckets | 38 |
| Realtime tables | 69 |
| ผู้ใช้ (auth.users + identities) | 190 + 190 |
| ข้อมูลในตาราง | 11,438 แถว |
| Cron jobs | 5 งาน (ชี้ไป Edge Functions ของโปรเจกต์ปลายทาง) |

Sequences ทั้งหมดถูก `setval` ให้ตรงกับข้อมูลล่าสุดแล้ว

## ขั้นตอนที่เหลือ — Edge Functions

Edge Functions ต้อง deploy ด้วย Supabase CLI พร้อม Personal Access Token ของบัญชีปลายทาง
(Lovable ไม่สามารถ deploy ข้ามบัญชีให้ได้)

```bash
npm i -g supabase
export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx        # จาก Supabase → Account → Access Tokens
export TARGET_PROJECT_REF=gwmszzoqqxmejefhayqf
./scripts/deploy-external-functions.sh
```

สคริปต์จะ deploy ทุกฟังก์ชันใน `supabase/functions/` (ข้าม `_shared` และตัวช่วยย้ายข้อมูล
`migrate-auth-push`) รวม 89 ฟังก์ชัน

### ตั้งค่า Secrets ของฟังก์ชัน

สร้างไฟล์ `.env.functions` (อย่า commit) แล้วรัน:

```bash
supabase secrets set --project-ref $TARGET_PROJECT_REF --env-file .env.functions
```

คีย์ที่ต้องมีอย่างน้อย:

```
CRON_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_SERVICE_ACCOUNT_JSON=...
OPENAI_API_KEY=...            # หรือ GEMINI_API_KEY / DEEPSEEK_API_KEY / DASHSCOPE_API_KEY
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
STANDALONE_MODE=true          # ตัดขาดจาก Lovable AI/Cloud ทั้งหมด
```

`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` ระบบ Supabase ใส่ให้อัตโนมัติ

## ตั้งค่าฝั่งหน้าเว็บ (Vercel / เครื่องโรงเรียน)

```
VITE_SUPABASE_URL=https://gwmszzoqqxmejefhayqf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_NlRn4zzOUtHsn4swyH6F7Q_ADVmUe9v
```

หรือใช้หน้า `/setup` (Setup Wizard) กรอกค่าเดียวกันแล้วระบบจะสลับ backend ให้ทันที

## หลัง deploy เสร็จ

1. ทดสอบ login ด้วยบัญชีเดิม (รหัสผ่านเดิมใช้ได้ เพราะ hash ถูกย้ายมาด้วย)
2. เรียก `setup-health-check` เพื่อตรวจ buckets / policies / cron
3. ลบฟังก์ชันช่วยย้ายข้อมูลออกจากโปรเจกต์เดิมได้เลย (`migrate-auth-push`, `public.mig_dump_auth`)
