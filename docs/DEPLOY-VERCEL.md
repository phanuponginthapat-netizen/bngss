# Deploy ระบบไปยัง Vercel

ระบบนี้เป็น Vite + React SPA — deploy ได้ผ่าน Vercel ในไม่กี่คลิก
Backend (database, edge functions, storage) ยังคงอยู่ที่ Supabase / Lovable Cloud เหมือนเดิม
Vercel ทำหน้าที่ host frontend เท่านั้น

## 1. เตรียมโปรเจกต์

- ต้องมีบัญชี [vercel.com](https://vercel.com) และเชื่อม GitHub repo ของโปรเจกต์นี้ไว้แล้ว
- ไฟล์ที่จำเป็นถูกเตรียมไว้แล้วในโค้ด:
  - `vercel.json` — build config + SPA rewrites + cache headers + security headers
  - `.vercelignore` — ตัดไฟล์ที่ไม่ต้องอัปโหลด
  - `.env.example` — เทมเพลตของ environment variables

## 2. Import โปรเจกต์บน Vercel

1. เข้า Vercel Dashboard → **Add New → Project**
2. เลือก GitHub repo ของระบบนี้
3. Framework Preset จะถูกตรวจจับเป็น **Vite** อัตโนมัติ (ตาม `vercel.json`)
4. ปล่อยค่า Build/Output ตามค่าเริ่มต้น:
   - Build Command: `vite build`
   - Output Directory: `dist`
   - Install Command: `npm install --legacy-peer-deps`

## 3. ตั้งค่า Environment Variables

ที่ **Project Settings → Environment Variables** ใส่ 3 ค่าต่อไปนี้
(ค่าเดียวกับใน `.env` ปัจจุบันของ Lovable Cloud หรือ Supabase project ที่ต้องการเชื่อม):

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon / publishable key |
| `VITE_SUPABASE_PROJECT_ID` | `<project-ref>` |

เลือก scope เป็น **Production, Preview, Development** ทั้งหมด

## 4. Deploy

กด **Deploy** — Vercel จะ build และปล่อยเว็บออกมาที่ `https://<project>.vercel.app`
Custom domain เพิ่มได้ที่ **Settings → Domains**

## 5. ตั้งค่าเพิ่มเติมใน Supabase

หลัง deploy สำเร็จ ต้องเพิ่ม URL ของ Vercel ลงใน Supabase เพื่อให้ auth ทำงาน:

- **Authentication → URL Configuration**
  - Site URL: `https://<project>.vercel.app` (หรือ custom domain)
  - Redirect URLs: เพิ่มทั้ง `https://<project>.vercel.app/**` และ preview URL

- **หน้า CMS ในระบบ** → ตั้งค่า `public_origin` ให้ตรงกับ URL ของ Vercel
  (ใช้ในหน้า Admin → CMS Settings)

## 6. Redeploy อัตโนมัติ

Vercel จะ redeploy ให้เองทุกครั้งที่ push ไป branch หลัก
ถ้าเปลี่ยน environment variables ต้อง trigger redeploy ใหม่ 1 ครั้ง

## หมายเหตุ

- Edge Functions ของระบบ (LINE bot, backup, kiosk, ฯลฯ) ยังรันบน Supabase — Vercel ไม่ได้ host ส่วนนี้
- ไฟล์ที่อยู่ใน `supabase/functions/` ถูก ignore จาก Vercel deploy อยู่แล้ว
- Service worker (`/sw.js`) และ manifest ถูกตั้ง cache header ให้ถูกต้อง ไม่ต้องแก้เพิ่ม
- SPA rewrites รองรับ deep link ทุกหน้า refresh แล้วไม่ 404
