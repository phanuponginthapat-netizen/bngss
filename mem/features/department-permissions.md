---
name: Department permissions
description: ระบบสิทธิ์ตามฝ่ายงาน (academic/student_affairs/general_admin/finance_personnel/director_office) + กลุ่มสาระ + ตำแหน่ง head/deputy_head/section_head/member
type: feature
---
- ตาราง `user_departments` (user_id, department, dept_role, is_head auto-sync)
- ตาราง `user_subject_groups` (user_id, subject_group, group_role) — 8 กลุ่มสาระ + กิจกรรมพัฒนาผู้เรียน
- enum `dept_role` = member | head | deputy_head | section_head — ใช้ร่วมกันทั้ง 2 ตาราง
- Hook: `useUserDepartments()` — admin/director ถือเป็นทุกฝ่ายเสมอ; roleIn/isDeputyOf/isSectionHeadOf
- Hook: `useUserSubjectGroups()` — จัดกลุ่มสาระของครู
- Hook: `useViewMode()` — ครูที่เป็น admin สลับ view admin↔teacher (localStorage `view_mode_override`) — ไม่กระทบ RLS จริง
- Component: `<ViewModeSwitcher>` ใน SidebarContent เห็นเฉพาะ admin ที่มี personnel record
- Guard: `<DepartmentRoute departments={[...]} bypassRoles={...}>` ใช้ครอบ ProtectedRoute
- หน้า admin จัดการ: `/dashboard/admin/departments` (2 Tabs: ฝ่ายงาน / กลุ่มสาระ)
- ผังองค์กร: `OrgChartPage` มี 2 Tabs พร้อมเรียงตำแหน่ง (head → deputy → section_head → member)
