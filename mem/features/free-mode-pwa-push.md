---
name: Free mode (PWA + Web Push)
description: ปิด LINE auto-push 100% ใช้ PWA + Web Push แทน ประหยัดโควต้า LINE
type: feature
---
- Setting `line_auto_push_enabled` (default `false`) ใน school_settings ควบคุม `send_line_to_student_parents` — ถ้า false จะข้ามทั้งหมด
- Daily LINE digest cron ถูก unschedule แล้ว
- LINE Chatbot reply + Rich Menu + LIFF ยังทำงาน (ฟรีไม่จำกัด)
- PWA: `public/manifest.json` + `public/sw.js` (push-only, no caching) + icons 192/512
- SW register ใน main.tsx ผ่าน `registerServiceWorker()` — มี iframe/preview guard
- Client subscribe: `src/lib/pushSubscribe.ts` (VAPID public key hardcoded ตรงกับ private key ใน edge function)
- หน้า /install (`src/pages/InstallPage.tsx`) สำหรับติดตั้งแอป + เปิดแจ้งเตือน — รองรับ iOS Safari (Share→Add to Home) และ Android (beforeinstallprompt)
- Push trigger `on_notification_send_push` ส่ง Web Push อัตโนมัติเมื่อมี row ใหม่ใน notifications
- Admin เปิด/ปิด LINE auto-push ได้ที่ Admin → ตั้งค่า LINE
