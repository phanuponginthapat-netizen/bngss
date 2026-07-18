---
name: Academic data integrity
description: schedules / subjects / teacher_assignments / pp5_files / pp6_files ผูกด้วย FK ID อัตโนมัติ + RPC validate_schedules
type: feature
---
## หลักการ
ทุกตารางในระบบวิชาการเชื่อมโยงด้วย **FK ID** เท่านั้น ห้ามใช้ string matching เป็น primary path

## Schema
- `schedules.subject_id` + `teacher_id` + `classroom_id` (FK ครบ)
- UNIQUE `(classroom_id, day_of_week, period, academic_year, semester)` — กันคาบซ้อน
- `pp5_files.subject_id` + `personnel_id`
- `pp6_files.subject_id` + `personnel_id` + `classroom_id`

## Triggers
- `fill_schedule_teacher_id` (BEFORE INSERT/UPDATE) — เติม teacher_id จาก teacher_name (normalize Thai prefix) + เติม subject_id จาก subject_name_raw + classroom.grade_level (auto-create ถ้าไม่มีด้วย code `AUTO-{hash}`)
- `sync_teacher_assignment_from_schedule` (AFTER INSERT/UPDATE) — สร้าง teacher_assignment อัตโนมัติเมื่อ schedule มี FK ครบ

## RPC
- `validate_schedules(_year, _sem)` — คืน JSON: missing_subject, missing_teacher, teacher_conflicts, classroom_conflicts ใช้ตรวจสอบความถูกต้องก่อนเปิดเทอม

## PP5/PP6 Import (3-tier subject matching)
1. tier 1: `name_th + grade_level + semester + academic_year`
2. tier 2: `code + semester` (fallback)
3. tier 3: create ใหม่
ผูก subject_id + personnel_id ลง pp5_files/pp6_files ทุกครั้ง

## Why
ก่อนหน้าใช้แค่ string matching ทำให้ตารางสอน/วิชาหายเมื่อชื่อไม่ตรง 100% หรือมีช่องว่างต่างกัน ตอนนี้ทุกอย่างผูก FK + auto-create จึงไม่หายอีก
