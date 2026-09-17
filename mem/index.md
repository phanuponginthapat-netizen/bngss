# Project Memory

## Core
Backend จริงคือ Supabase project `gwmszzoqqxmejefhayqf` (ไม่ใช่ Lovable Cloud) — รัน SQL ผ่าน Management API ด้วย `EXTERNAL_SUPABASE_ACCESS_TOKEN`
ภาษาไทยในการสื่อสารกับผู้ใช้ สั้น กระชับ ตรงคำถาม
เช็คชื่อ/สแกน = ข้อมูลอ่อนไหว ให้ยึดเวลาเซิร์ฟเวอร์เสมอ ห้ามเชื่อนาฬิกาเครื่อง
RLS policy ใหม่ต้องห่อ `auth.uid()` ด้วย `(select auth.uid())` เพื่อไม่ให้ช้า

## Memories
- [QR scan accuracy](mem/features/attendance/qr-scan-accuracy.md) — กติกาความแม่นยำของการเช็คชื่อด้วยการสแกน
