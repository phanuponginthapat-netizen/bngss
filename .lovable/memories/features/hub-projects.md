---
name: Hub Projects
description: ระบบโครงการพิเศษที่ได้รับงบจากฮับกลาง — รายงานงบ ค่าใช้จ่าย และฟีดความคืบหน้าพร้อมภาพ
type: feature
---
**ตาราง**: hub_projects, hub_project_budgets, hub_project_expenses, hub_project_updates
**Bucket**: hub-projects (private, signed URLs)
**Routes**: /dashboard/projects/hub, /dashboard/projects/hub/:id
**สิทธิ์**: admin/director/teacher จัดการได้ scoped ตาม school_id ผ่าน RLS
**Triggers**: trg_recompute_on_budget/expense คำนวณ budget_received/spent อัตโนมัติ
**API**: district-feed-api เพิ่ม GET /projects และ /projects/:id (scope: projects หรือ reports)
**Feed**: hub_project_updates มี photos JSONB array + period_label + progress_percent
**Realtime**: เพิ่ม 4 ตารางใหม่ใน supabase_realtime publication แล้ว
