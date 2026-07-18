---
name: Academic year normalization
description: DB trigger auto-converts BE (>2400) → CE on insert/update for all 26 tables with academic_year. Convention: store as CE, display as BE (+543).
type: feature
---
- ตารางทั้งหมดที่มี `academic_year` มี trigger `trg_normalize_academic_year` คอย normalize ค่าจาก พ.ศ. → ค.ศ. อัตโนมัติ (ถ้า > 2400 จะ -543)
- Convention: DB เก็บเป็น **ค.ศ.** เสมอ, UI แสดงเป็น **พ.ศ.** (+543)
- Query: client ต้องส่งเป็น ค.ศ. (เช่น `academicYear - 543`) — แต่ถ้าเผลอส่ง พ.ศ. ไปกับ INSERT/UPDATE จะถูก normalize ให้
- ฟังก์ชัน: `public.normalize_academic_year()`
- ใช้ครอบ 26 ตาราง รวม schedules, teacher_assignments, enrollments, attendance, subjects, classrooms, ฯลฯ
