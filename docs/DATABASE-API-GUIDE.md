# 📘 คู่มือเรียกใช้งานฐานข้อมูลจากภายนอก (External API Guide)

ระบบ BNGSS ใช้ **Lovable Cloud (Supabase)** เป็น backend ทำให้คุณสามารถเรียกใช้ข้อมูลจากภายนอก (mobile app, script, Power BI, n8n, Google Sheets ฯลฯ) ได้โดยตรงผ่าน REST/GraphQL/Realtime API

---

## 🔑 1. Credentials (ใช้ค่าปัจจุบันของโปรเจค)

```env
SUPABASE_URL=https://dlkyxvhnnffblerwedjz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa3l4dmhubmZmYmxlcndlZGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjY5MTIsImV4cCI6MjA5OTk0MjkxMn0.bQqqX3veJ_pGr9fSa0a-bKIS-w7UmR569a2xDZQ6Cx4
PROJECT_ID=dlkyxvhnnffblerwedjz
```

> `anon key` เป็น publishable key ปลอดภัยที่จะฝังใน client ได้ (RLS จะบังคับสิทธิ์อีกชั้น)

---

## 🌐 2. REST Endpoint (PostgREST)

รูปแบบ:
```
https://<PROJECT>.supabase.co/rest/v1/<table_name>?select=*
```

### ตัวอย่าง cURL — ดึงข้อมูลนักเรียน
```bash
curl "https://dlkyxvhnnffblerwedjz.supabase.co/rest/v1/students?select=id,first_name,last_name&limit=10" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT"
```

### Query operators ที่ใช้บ่อย
| ตัวอย่าง | ความหมาย |
|---|---|
| `?grade=eq.6` | เท่ากับ |
| `?score=gte.50` | ≥ |
| `?name=ilike.*สม*` | ค้นหาแบบ LIKE |
| `?order=created_at.desc` | เรียงลำดับ |
| `?limit=100&offset=200` | หน้า |
| `?select=id,name,teacher(*)` | join แบบ nested |

---

## 🔐 3. Authentication

### วิธี A: Login ด้วย Email/Password
```bash
curl -X POST "https://dlkyxvhnnffblerwedjz.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"Admin@2026"}'
```
ตอบกลับจะได้ `access_token` → ใช้ต่อใน header `Authorization: Bearer <token>`

### วิธี B: Service Role (backend เท่านั้น ห้ามใช้ในเบราว์เซอร์)
ขอ service role key จากผู้ดูแลระบบ Lovable Cloud → bypass RLS ทั้งหมด

---

## ⚡ 4. Realtime (WebSocket)

```javascript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

supabase.channel('wall')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'wall_posts' },
    (payload) => console.log('โพสใหม่:', payload.new))
  .subscribe()
```

---

## 📦 5. Storage (ไฟล์/รูปภาพ)

Bucket ที่ใช้ในระบบ:
- `profile-images` (public) — รูปโปรไฟล์
- `cms-images` (public) — โลโก้/แบนเนอร์
- `wall-media`, `padlet-media`, `activity-covers`, `documents` ฯลฯ

Endpoint: `https://<PROJECT>.supabase.co/storage/v1/object/public/<bucket>/<path>`

---

## 🧰 6. Edge Functions

Endpoint: `https://<PROJECT>.supabase.co/functions/v1/<function-name>`

ฟังก์ชันสำคัญ:
| ชื่อ | หน้าที่ |
|---|---|
| `system-backup` | export ข้อมูลทั้งระบบเป็น ZIP |
| `system-restore` | นำเข้า backup กลับสู่ระบบ |
| `upload-cms-image` | อัปโหลดไฟล์ (bypass RLS โดยตรวจ role) |
| `attendance-digest` | สร้าง QuickChart รายงานสแกน |
| `district-outbox-worker` | ส่งข้อมูลไป feed เขตพื้นที่ |

---

## 🛡️ 7. RLS สำคัญที่ต้องรู้

- ทุก request ที่ใช้ `anon key` ตัวเปล่า จะเห็นเฉพาะข้อมูลที่ policy เปิด public
- ต้อง login ก่อน (มี JWT) ถึงจะเห็นข้อมูลตาม role (admin/director/teacher/student/parent)
- ตาราง admin เช่น `app_secrets`, `ai_provider_keys` **จะไม่มีทางเข้าถึงได้** จาก anon → ต้องใช้ service role

---

## 📊 8. รายชื่อ Table ทั้งหมด

ดูรายละเอียดคอลัมน์แบบสด ๆ ได้ที่หน้า **Admin → Database Schema** (`/dashboard/admin/database-schema`)  
หน้านั้นดึงข้อมูลจาก `information_schema` ผ่าน RPC `get_db_schema()` แบบเรียลไทม์ พร้อมปุ่ม export JSON

---

## 🧪 9. ตัวอย่างการเชื่อมต่อจากภายนอก

### Google Sheets (Apps Script)
```javascript
function getStudents() {
  const url = 'https://dlkyxvhnnffblerwedjz.supabase.co/rest/v1/students?select=*&limit=100'
  const res = UrlFetchApp.fetch(url, {
    headers: { apikey: 'ANON_KEY', Authorization: 'Bearer USER_JWT' }
  })
  return JSON.parse(res.getContentText())
}
```

### Python
```python
import requests
r = requests.get(
  "https://dlkyxvhnnffblerwedjz.supabase.co/rest/v1/attendance",
  headers={"apikey": ANON_KEY, "Authorization": f"Bearer {jwt}"},
  params={"select": "*", "date": "eq.2026-07-23"}
)
print(r.json())
```

### n8n / Make / Zapier
เลือก **HTTP Request** → ใส่ URL + Headers ตามด้านบน หรือใช้ node "Supabase" โดยกรอก URL + anon key

---

## 📎 อ้างอิงเพิ่มเติม
- PostgREST: https://postgrest.org/en/stable/references/api.html
- Supabase JS: https://supabase.com/docs/reference/javascript
- Realtime: https://supabase.com/docs/guides/realtime
