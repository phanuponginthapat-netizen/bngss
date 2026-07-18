---
name: Subject Group Heads
description: หัวหน้ากลุ่มสาระ 8 กลุ่ม + งานเด็กพิเศษ สำหรับดำเนินการเอกสารงานวิชาการ
type: feature
---
- ตาราง `subject_group_heads` (subject_group text, user_id, assigned_by, notes)
- รหัสกลุ่ม: thai, math, science, social, health_pe, arts, occupation, foreign_lang, special_ed
- Hook: `useSubjectGroupHeads()` — admin/director ถือเป็นหัวหน้าทุกกลุ่มเสมอ
- RLS: ทุก authenticated อ่านได้, admin/director เท่านั้นจัดการ
- Function: `is_subject_group_head(uid, group)` ใช้ใน RLS เอกสารวิชาการได้
- UI: การ์ด `SubjectGroupHeadsCard` แสดงในหน้า `/dashboard/admin/departments`
- เปิด realtime แล้ว
