---
name: Role/RLS matrix
description: สรุปสิทธิ์ที่แต่ละ role ควรเข้าถึง + กติกาการเขียน RLS policy ของโปรเจกต์นี้
type: feature
---
## กติกา
- ห้ามสร้าง policy ที่ `using (true)` / `with check (true)` ให้ role `authenticated` บนตารางข้อมูลบุคคล
  (ชื่อแบบ "Auth users manage/can view ..." คือ legacy ที่ถูกลบไปแล้ว 17 ส.ค. 2569 — ห้ามสร้างซ้ำ)
- policy ที่กรองด้วย `school_id` อย่างเดียวไม่พอ ต้องมี `public.is_staff_user(auth.uid())` ประกอบด้วย
- ความลับ/คีย์ (`app_secrets`, `ai_provider_keys`, `district_api_keys`, `game_hub_api_keys`) = **admin เท่านั้น**
  (director/observer ห้ามอ่าน เพราะ observer ได้สิทธิ์ director มาโดยอัตโนมัติ)

## สรุปสิทธิ์อ่าน (ยืนยันด้วยการจำลอง session จริง)
| ข้อมูล | admin | director | teacher | student | parent | observer |
|---|---|---|---|---|---|---|
| students/personnel/profiles/enrollments | ทั้งหมด | ทั้งหมด | ในโรงเรียน | ของตัวเอง | ของบุตร | อ่านอย่างเดียว |
| attendance/behavior/health/sdq/home_visits | ✓ | ✓ | ✓ | ของตัวเอง | ของบุตร | อ่านอย่างเดียว |
| salary/staff_evaluations/id_plan | ✓ | ✓ | ของตัวเอง/ฝ่ายบุคคล | ✗ | ✗ | อ่านอย่างเดียว |
| app_secrets/api keys | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| ตารางสอน/รายวิชา/ห้องเรียน/ข่าว/กิจกรรม | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

- SQL ที่ใช้แก้: `scripts/sql/20260817-role-rls-hardening.sql` (รันแล้วบน backend โรงเรียน)
- observer = ศน. อ่านอย่างเดียว บังคับผ่าน fetch interceptor ฝั่ง client (`src/lib/readOnlyMode.ts`) + ไม่มีสิทธิ์ความลับ
