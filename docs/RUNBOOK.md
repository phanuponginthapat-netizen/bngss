# BNG Smart School — Runbook (1 โรงเรียน = 1 ระบบ)

## ติดตั้งใหม่ (15 นาที)
```bash
git clone https://github.com/phanuponginthapat-netizen/bngss.git
cd bngss
npm ci
supabase link --project-ref <ใหม่>
supabase db push
supabase functions deploy
npm run build && vercel --prod
# ตั้ง env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ใน Vercel
# เปิด /setup → กรอกชื่อโรงเรียน โลโก้ → เสร็จ
```

## ประจำวัน
- เช็ค `/dashboard/admin/system-health` → DB/storage/functions ต้องเขียว
- ดู `kiosk-offline-alert` ถ้ามีตู้ offline >10 นาที

## สำรอง/กู้คืน
- สำรอง: `supabase/functions/backup-snapshot` ทุกวัน 02:00 + `backup-retention` ลบเกิน 30 วันคง 10 ชุด
- กู้คืน: `/setup` → อัปโหลด .zip หรือ `supabase db push` จาก backup

## อัปเดท
- `git pull origin main` → `supabase db push` → `vercel --prod`

## เมื่อล้ม
- หน้า blank: ดู `error_logs` table (รหัส 8 ตัว) + `window.__LAST_ERROR__`
- 402 Max functions: ลบ 5 ตัวที่ไม่ใช้ `supabase functions delete <slug> --project-ref <id>`
