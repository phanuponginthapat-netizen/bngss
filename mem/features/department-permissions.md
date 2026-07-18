---
name: Department permissions
description: ระบบสิทธิ์ตามฝ่ายงาน (academic/student_affairs/general_admin/personnel/budget_planning/director_office) ทับ role
type: feature
---
- ตาราง `user_departments` (user_id, department, is_head)
- Hook: `useUserDepartments()` — admin/director ถือเป็นทุกฝ่ายเสมอ; student/parent/alumni ไม่ผูกฝ่าย
- Guard: `<DepartmentRoute departments={[...]} bypassRoles={...}>` ใช้ครอบ ProtectedRoute
- Sidebar: department block มี `dept` — teacher เห็นเฉพาะฝ่ายของตน
- หน้า admin จัดการ: `/dashboard/admin/departments`
