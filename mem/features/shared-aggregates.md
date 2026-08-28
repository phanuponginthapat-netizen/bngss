---
name: Shared KPI aggregates
description: สูตรสรุป KPI (เกรด/มาเรียน/การเงิน/พฤติกรรม/ทรัพย์สิน/สวัสดิภาพ/โครงการ/ห้องสมุด) ต้องใช้จาก supabase/functions/_shared/aggregates.ts ที่เดียว
type: preference
---
- ห้ามเขียนสูตรสรุป KPI ซ้ำใน edge function ใหม่ — import จาก `../_shared/aggregates.ts`
- ผู้ใช้ปัจจุบัน: `onestop-api`, `district-nightly-snapshot`, `district-feed-api`
- เกณฑ์กลาง: ผ่าน = total_score >= 50, GPA จาก `GPA_MAP`, เงิน = ปัดทศนิยม 2 ตำแหน่งด้วย `money()`
- `district-feed-api` ต้องใช้ snapshot ก่อน (`/snapshot/cached`, `/dashboard` cached < 25 ชม.) แล้วค่อย fallback คำนวณสด
