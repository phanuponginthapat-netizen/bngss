# ย้ายไป Supabase Cloud ภายนอก / Self-host

Target: `https://uhbabufmdozwiivsjhpr.supabase.co`

---

## 1) เตรียมเครื่อง

```bash
# ติดตั้ง Supabase CLI
brew install supabase/tap/supabase        # macOS
# หรือ: npm i -g supabase                  # cross-platform

supabase login                             # Cloud only
```

## 2) รวบรวมค่าจาก project ปลายทาง

จาก `https://supabase.com/dashboard/project/uhbabufmdozwiivsjhpr`:

| ค่า | ที่ | ใช้ตรงไหน |
|---|---|---|
| `PROJECT_REF` | URL ของ dashboard | `uhbabufmdozwiivsjhpr` |
| `DB_PASSWORD` | Settings → Database → Connection string | `db push` |
| `SUPABASE_URL` | Settings → API → Project URL | frontend + edge |
| `ANON_KEY` (publishable) | Settings → API → anon | frontend |
| `SERVICE_ROLE_KEY` | Settings → API → service_role | edge functions |

## 3) Push schema + storage + edge functions

```bash
export PROJECT_REF=uhbabufmdozwiivsjhpr
export DB_PASSWORD='...'
export SUPABASE_URL='https://uhbabufmdozwiivsjhpr.supabase.co'
export SERVICE_ROLE_KEY='...'

bash scripts/deploy-external-supabase.sh
```

Script จะ:
- `supabase link` → project
- `supabase db push` — รัน 442 migrations ใน `supabase/migrations/`
- สร้าง storage buckets ทั้ง 22 ตัว (public: `cms-images`, `garbage-images`, `profile-images`)
- Deploy edge functions 71 ตัว

## 4) ตั้ง secrets ของ edge functions

สร้างไฟล์ `.env.functions` แล้วรัน:

```bash
supabase secrets set --env-file .env.functions --project-ref $PROJECT_REF
```

### รายการ secrets ที่ต้องตั้งบน instance ปลายทาง

**อัตโนมัติ (Supabase ตั้งให้เอง เมื่อ deploy)** — ไม่ต้องใส่:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY` (= anon)
- `SUPABASE_PROJECT_ID`

**ต้องตั้งเอง:**

```dotenv
# --- AI ---
LOVABLE_API_KEY=            # ถ้ายังใช้ Lovable AI gateway ให้ใส่ key เดิม
                            # หรือเปลี่ยนไปใช้ OpenRouter / DashScope / Qwen โดยตรง
OPENROUTER_MODEL=           # optional override
DASHSCOPE_MODEL=            # optional override
QWEN_MODEL=                 # optional override

# --- Text-to-Speech ---
ELEVENLABS_API_KEY=

# --- LINE OA ---
LINE_CHANNEL_ACCESS_TOKEN=  # (เก็บใน table app_secrets ก็ได้ตามโค้ดปัจจุบัน)
LINE_CHANNEL_SECRET=
LINE_LOGIN_CHANNEL_ID=
LINE_LIFF_CHANNEL_ID=

# --- Cron / bootstrap ---
CRON_SECRET=                # สุ่ม 32+ chars — ใช้กัน cron endpoints
BOOTSTRAP_SECRET=           # สุ่ม 32+ chars — ใช้ตอน bootstrap-admin
```

โค้ดยังอ่าน `app_secrets` table สำหรับ LINE tokens/VAPID/Facebook อยู่ด้วย —
insert ค่าเหล่านั้นผ่าน Table Editor หลัง migrations เสร็จ:

```sql
INSERT INTO app_secrets(key,value) VALUES
  ('LINE_CHANNEL_ACCESS_TOKEN','...'),
  ('LINE_CHANNEL_SECRET','...'),
  ('VAPID_PUBLIC_KEY','...'),
  ('VAPID_PRIVATE_KEY','...'),
  ('VAPID_SUBJECT','mailto:admin@school.com'),
  ('FB_PAGE_ID','...'),
  ('FB_PAGE_ACCESS_TOKEN','...'),
  ('GOOGLE_CHAT_WEBHOOK','...');
```

## 5) Auth configuration (dashboard)

- **Authentication → URL Configuration**
  - Site URL: `https://your-app-domain.com`
  - Redirect URLs: เพิ่ม preview + published URLs ของ Lovable ทั้งหมด
- **Authentication → Providers**
  - Email: เปิด, ปิด "Confirm email" ถ้าต้องการ auto-approve
  - Google: ใส่ Client ID + Secret ถ้าอยากได้ Google sign-in
- **Authentication → Rate limits** — ปรับตามการใช้งาน

## 6) ชี้ frontend ไป instance ใหม่

ไฟล์ `.env` ที่ root ของโปรเจกต์ Lovable ถูก **auto-manage โดย Lovable Cloud**
ต้องปิด Cloud ก่อน ไม่งั้นค่าจะถูกเขียนทับ:

1. **Connectors → Lovable Cloud → Disable Cloud** (ปิดสำหรับ project นี้)
2. แก้ `.env`:

```dotenv
VITE_SUPABASE_URL="https://uhbabufmdozwiivsjhpr.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_kxQmtlPa41YdbFfWUSoEPg_4V_W3Hxr"
VITE_SUPABASE_PROJECT_ID="uhbabufmdozwiivsjhpr"
```

3. Publish ใหม่ — frontend จะเรียก instance ปลายทางทันที

## 7) Self-host แทน?

ใช้ script เดียวกัน — แค่เปลี่ยน:
- `SUPABASE_URL=https://supabase.mydomain.com`
- `PROJECT_REF` = อะไรก็ได้ (self-host ไม่บังคับ)
- `supabase link` แทนด้วย `supabase db push --db-url "postgresql://postgres:PASSWORD@HOST:5432/postgres"`

รายละเอียด self-host: https://supabase.com/docs/guides/self-hosting/docker

## 8) Migrate data เดิม (optional)

ถ้าจะย้ายข้อมูลจาก project เก่ามาด้วย:

```bash
# จาก project เก่า (ที่ยังเข้าได้)
supabase db dump --data-only -f data.sql --db-url "postgresql://..."
# import เข้า project ใหม่
psql "postgresql://postgres:PASSWORD@db.uhbabufmdozwiivsjhpr.supabase.co:5432/postgres" -f data.sql
```

หรือใช้ Cloud → Advanced settings → Export data ใน Lovable แล้ว import CSV ทีละตาราง
