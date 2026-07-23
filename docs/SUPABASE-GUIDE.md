# 🗄️ ใช้งาน Supabase / Lovable Cloud

คู่มือการเชื่อมต่อและใช้งาน backend — ครอบคลุมทั้งกรณีใช้ Lovable Cloud (default) และย้ายไป Supabase ของตัวเอง

---

## 🌟 สองทางเลือก

| ทางเลือก | เหมาะกับใคร | ค่าใช้จ่าย |
| --- | --- | --- |
| **Lovable Cloud** (default) | เริ่มต้นง่าย ไม่ต้องตั้งค่าเอง | ตามการใช้ (free tier) |
| **Supabase ของตัวเอง** | ต้องการ control เต็มที่ / bill ตรง | ตามแพลน Supabase |

---

## 🅰️ ใช้ Lovable Cloud (แนะนำสำหรับผู้เริ่มต้น)

**ทำอะไรก็ได้เลย** — Lovable ตั้งค่าให้ทุกอย่างอัตโนมัติ:
- Database (Postgres + RLS)
- Auth (Email + Google)
- Storage (12 buckets พร้อมใช้)
- Edge Functions (deploy อัตโนมัติ)
- Secrets management

### เปิด/ดูข้อมูล backend

- คลิกปุ่ม **View Backend** ในระบบ → เห็นตาราง, edge function logs, users
- **Cloud → Advanced → Export data** → ดาวน์โหลด backup

---

## 🅱️ ย้ายไป Supabase ของตัวเอง

### 1. สร้าง project

- [supabase.com/new](https://supabase.com/new) → เลือก region ใกล้ที่สุด (Singapore สำหรับไทย)
- จด `Project Ref`, `Project URL`, `anon key`, `service_role key`, `Database password`

### 2. รัน migrations (ครั้งเดียว)

ต้องมี Supabase CLI:
```bash
brew install supabase/tap/supabase   # macOS
npm i -g supabase                    # อื่นๆ
```

จากนั้น:
```bash
export PROJECT_REF="<ref>"
export DB_PASSWORD="<db-password>"
export SUPABASE_URL="https://<ref>.supabase.co"
export SERVICE_ROLE_KEY="<service-role>"

bash scripts/deploy-external-supabase.sh
```

สคริปต์นี้จะ:
- Push migrations ทั้งหมด 500+ ตัว (schema, FK, RLS, triggers)
- Deploy edge functions ที่ใช้กับ external Supabase
- ตั้ง search_path ให้ security definer functions

### 3. Import ข้อมูล

ถ้ามี Backup ZIP จากระบบเดิม:
```bash
export ADMIN_JWT="<jwt-จากการ login>"
export ZIP_FILE="./smart-school-full-<date>.zip"

curl -X POST "$SUPABASE_URL/functions/v1/system-restore?truncate=1" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -F "file=@$ZIP_FILE"
```

หรือใช้ UI: `/dashboard/admin/backup-center` → Restore tab

### 4. แก้ frontend `.env`

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<ref>
```

Redeploy — เสร็จ!

---

## 🔑 จัดการ Secrets

### บน Lovable Cloud
- ตั้งผ่านระบบ (ปุ่ม "เพิ่ม Secret" ในหน้า Admin)
- ทีมงาน dev เข้าใช้ได้อัตโนมัติใน edge functions

### บน Supabase ตัวเอง
- Dashboard → **Project Settings → Edge Functions → Secrets**
- หรือใช้ CLI: `supabase secrets set KEY=value --project-ref <ref>`

### Secrets ที่ระบบใช้บ่อย
| Secret | ใช้ทำอะไร | จำเป็นไหม |
| --- | --- | --- |
| `CRON_SECRET` | ป้องกัน cron endpoint | ✅ auto-gen |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push | ✅ auto-gen |
| `LINE_CHANNEL_ACCESS_TOKEN` | ส่ง LINE OA | ⚠️ ถ้าใช้ LINE |
| `LINE_CHANNEL_SECRET` | ยืนยัน webhook LINE | ⚠️ ถ้าใช้ LINE |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google Drive OAuth | ⚠️ ถ้าใช้ Drive |
| `DASHSCOPE_API_KEY` | AI (Qwen) | ⚠️ ถ้าใช้ AI |
| `DEEPSEEK_API_KEY` | AI (DeepSeek) | ⚠️ ถ้าใช้ AI |

---

## 🔒 RLS (Row Level Security)

**ทุก table ใน public schema เปิด RLS แล้ว** — ถ้าเข้าตารางไม่ได้:

1. `/dashboard/admin/rls-audit` — ดูว่า table ไหนยังขาด policy
2. `/dashboard/admin/role-troubleshoot` — ทดสอบว่า role ของตัวเองอ่านได้ไหม

**อย่าปิด RLS** — เสี่ยงข้อมูลรั่วผ่าน anon key

---

## 💾 Backup

3 ระดับ (ตั้งไว้แล้วในระบบ):

| ระดับ | เมนู | ความถี่ |
| --- | --- | --- |
| Manual ZIP | `/dashboard/admin/backup-center` | ทำเอง |
| Auto ไป Google Drive/S3 | `/dashboard/admin/backup-external` | Cron |
| Supabase Export | Cloud → Advanced → Export | on-demand |

📖 รายละเอียด → [BACKUP-MIGRATION-GUIDE.md](./BACKUP-MIGRATION-GUIDE.md)

---

## 🐛 ปัญหาบ่อย

| อาการ | วิธีแก้ |
| --- | --- |
| `permission denied for table X` | ตาราง X ขาด GRANT — เพิ่ม `GRANT ... TO authenticated` |
| `new row violates row-level security` | role นั้นยังไม่มี INSERT policy — เพิ่มที่ `/dashboard/admin/rls-audit` |
| Edge function timeout | เข้า Supabase Dashboard → Edge Functions → Logs |
| Storage upload fail | เช็คว่า bucket public หรือไม่ + policy allow role |

---

_กลับไปคู่มือหลัก: [docs/README.md](./README.md)_
