
## เชื่อม Client แล้ว ✅
`google_drive` App User Connector client ถูก link เข้าโปรเจกต์แล้ว (`GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY` + `APP_USER_CONNECTION_KEY_SECRET` พร้อมใช้ใน edge functions)

**สิ่งที่คุณต้องทำครั้งเดียว** (ที่ Google Cloud Console):
- เพิ่ม redirect URI: `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`
- เพิ่ม scope: `.../auth/drive` (Full access), `userinfo.email`, `userinfo.profile`
- เพิ่ม test users (ครู/นักเรียนที่จะทดสอบ) ระหว่างยังไม่ verify

## สิ่งที่จะสร้าง

### 1. Database
- ตาราง `app_user_connections` เก็บ `(user_id, connector_id, connection_key, external_user_id, connected_at, revoked_at)` — RLS: user ดู/ลบของตัวเองเท่านั้น
- Service role เขียน (จาก edge function)

### 2. Edge Functions (4 ตัว)
- `gdrive-connect-start` — สร้าง OAuth authorize URL, เก็บ pending state
- `gdrive-connect-finish` — landing หลัง user consent, ดึง connection_key จาก gateway มาเก็บใน DB
- `gdrive-proxy` — proxy Drive REST API v3 ด้วย user's connection_key
- `gdrive-upload` — multipart upload helper (แยกเพราะ content-type ต่าง)

### 3. UI: หน้า `/my-drive`
- ถ้ายังไม่เชื่อม → แสดงปุ่ม **"เชื่อม Google Drive"** + คำอธิบาย
- เชื่อมแล้ว → หน้า **File Explorer**:
  - Breadcrumb (My Drive / โฟลเดอร์ /...)
  - Grid/List view สลับได้
  - Sidebar: My Drive, Shared with me, Recent, Starred, Trash
  - ปุ่ม: New folder / Upload / Download / Delete / Rename / Star / Preview
  - Right-click context menu
  - Search bar (Drive query syntax)
  - Preview modal (รูป/PDF/video/text)
- ปุ่ม **"ยกเลิกการเชื่อม Drive"** ในหน้า Profile

### 4. Sidebar เมนู
- เพิ่ม "My Drive" (icon: HardDrive) ใน sidebar หมวด "ไฟล์และเอกสาร"

### 5. Integration hooks (เตรียมไว้ต่อยอด)
- Hook `useMyDrive()` — สำหรับโมดูลอื่นเรียกใช้เลือกไฟล์จาก Drive ตัวเอง (Portfolio, Homework attach, ฯลฯ)
- Component `<DriveFilePicker />` แบบ modal

## ประเด็นที่ต้องยืนยัน

1. **Google OAuth Client** — คุณมี Client ID/Secret จาก Google Cloud Console แล้วหรือยัง? ถ้ายัง ต้องสร้างก่อน (ผมมีคู่มือ step-by-step) และใส่ผ่านหน้า Connector settings
2. **Scope** — ยืนยัน `drive` เต็มสิทธิ์ (เห็นทุกไฟล์เหมือนเปิด drive.google.com) — ต้องขอ verify กับ Google ถ้าจะใช้งานกับคนเกิน 100 หรืออยู่กับ test users ถาวร
3. **Storage แยก** — Line Vault (Drive ของโรงเรียนบัญชีเดียว) กับ My Drive (Drive ส่วนตัวแต่ละคน) จะไม่ปนกัน ✅

## เทคนิคที่จะใช้

- Gateway API: `POST connector-gateway.lovable.dev/api/v1/app-users/oauth2/authorize` (body: client_api_key, external_user_id=supabase user.id, credentials_configuration.scopes)
- ได้ authorize URL → redirect user → user อนุมัติ → gateway callback → redirect กลับมาที่ `gdrive-connect-finish?connection_key=...`
- เก็บ connection_key ใน DB (encrypted at rest ผ่าน Supabase)
- ทุก API call: `GET/POST connector-gateway.lovable.dev/google_drive/drive/v3/...` พร้อม header `Authorization: Bearer LOVABLE_API_KEY` + `X-Connection-Api-Key: <user's connection_key>`

## Estimation
- ~4 edge functions + 1 migration + ~600 บรรทัด React (หน้า My Drive) + sidebar entry
- ทดสอบ end-to-end ต้องมี Google OAuth Client พร้อม
