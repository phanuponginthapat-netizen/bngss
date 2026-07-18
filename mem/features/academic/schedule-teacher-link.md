---
name: Schedule teacher linkage
description: schedules.teacher_id ผูกกับ personnel.id อย่างถาวร พร้อม trigger เติมอัตโนมัติจาก teacher_name
type: feature
---
ตาราง `schedules` มีคอลัมน์ `teacher_id` (FK → personnel.id) ใช้เป็นช่องทางหลักในการ filter "ตารางสอนของฉัน" แทนการเทียบชื่อสตริง

Trigger `fill_schedule_teacher_id` (BEFORE INSERT/UPDATE) จะเติม teacher_id อัตโนมัติเมื่อ insert ด้วย teacher_name (รองรับรูปแบบ "ครู<first_name>" และชื่อเต็ม "<prefix><first> <last>")

`import-teacher-schedule` edge function และ SchedulePage handleAssignToCell ต้องส่ง teacher_id ทุกครั้งที่ insert. SchedulePage filter ใช้ teacher_id เป็นหลัก, fallback เป็น teacher_name สำหรับแถวเก่า

**Why:** ก่อนหน้านี้ใช้แค่ teacher_name เป็น string ทำให้ตารางสอนหายเมื่อชื่อในระบบไม่ตรงกับชื่อใน DB (เช่น "นางสาวX มหากิจ" vs "ครูX") ทุกเทอม
