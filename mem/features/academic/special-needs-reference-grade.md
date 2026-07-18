---
name: Special-needs classroom reference grade
description: ห้องเรียนพิเศษเก็บ reference_grade_level เพื่อให้นักเรียนยังถูกนับในระดับชั้นจริง
type: feature
---
## หลักการ
นักเรียนเด็กพิเศษอยู่ในห้องเรียนพิเศษ (grade_level = "การศึกษาพิเศษ") แต่ยังต้องถูกบันทึก/รายงานในระดับชั้นเดิม เช่น ม.3

## Schema
- `classrooms.reference_grade_level text NULL` — ระดับชั้นอ้างอิง (ป.1-ม.6) สำหรับห้องเรียนพิเศษ
- NULL = ใช้ grade_level ตรง ๆ

## Code
- `src/lib/classroomGrade.ts` → `effectiveGrade(c)` = `c.reference_grade_level || c.grade_level`
- ใช้ใน `useStudentData` (gradeOptions + filteredClassrooms) และ FaceReportTab (grade aggregation)
- Display ชื่อห้องยังคงใช้ classroom.name ตามเดิม

## UI
- ClassroomManagementPage: edit dialog แสดง Select "ระดับชั้นอ้างอิง" เฉพาะเมื่อ grade_level = "การศึกษาพิเศษ"
