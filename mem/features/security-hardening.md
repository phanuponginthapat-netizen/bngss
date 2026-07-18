---
name: Security hardening phase 2
description: การ REVOKE EXECUTE จาก SECURITY DEFINER functions และ whitelist ฟังก์ชันสาธารณะ
type: feature
---

## สรุปการทำงาน
- REVOKE EXECUTE จาก anon สำหรับทุก SECURITY DEFINER function ใน public schema ยกเว้น whitelist
- REVOKE EXECUTE จาก anon/authenticated/PUBLIC สำหรับ trigger functions (typname='trigger')
- ตั้ง search_path=public ให้ทุก SECURITY DEFINER function

## Whitelist (anon ยังเรียกได้)
- app_base_url
- get_public_profile
- get_public_org_chart
- get_profiles_public
- get_personnel_directory
- get_staff_profiles

## ผลลัพธ์
- Linter warnings: 373 → 89 (ลด 76%)
- ที่เหลือส่วนใหญ่คือ RLS helper (has_role, is_admin_or_director, is_teacher_of_student ฯลฯ) ที่ authenticated ต้องเรียกได้จริงเพื่อให้ RLS ทำงาน — ยอมรับได้

## Helper functions ใหม่
- is_admin_or_director()
- is_homeroom_teacher_of(student_id)
- is_teacher_of_student(student_id)
- is_parent_of_student(student_id)

## RLS ที่ปรับ
- guidance_records: แยก dept view (ไม่เห็นความลับ) กับ confidential recorder+admin only
- worksheets: publish ต้อง authenticated เท่านั้น
