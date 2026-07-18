---
name: Performance Improvements
description: ปรับปรุงประสิทธิภาพ - DB indexes, role-based realtime, pagination, error boundaries
type: feature
---
- DB indexes: 40+ ตัวบน students/attendance/enrollments/notifications/documents/eforms/personnel
- Realtime แบบ role-based: admin sub ทั้งหมด, teacher/student/parent sub เฉพาะที่เกี่ยว
- Notifications/inbox channel filter `user_id=eq.{uid}` ลด payload
- Hooks: usePagination + PaginationControls สำหรับตารางใหญ่
- Hook: useSchoolSetting รวม bulk loader (1 query สำหรับทุก key, cache 30 นาที)
- Hook: useCmsSettingsBulk (bulk cache + localStorage TTL 24h + BroadcastChannel ข้ามแท็บ) → ห้าม query cms_settings ตรง
- Hook: useStudentsWithClass (shared query key `students_with_class` staleTime 10m) — ใช้บน Transcript/ReportCard/Pp7/Certificate/Vaccine
- Image: WebP default + LazyImage component (loading="lazy")
- Skeletons: KpiCardsSkeleton, TableSkeleton, PageSkeleton, CardListSkeleton
- ErrorBoundary wrap แต่ละ Outlet เพื่อ isolate error
- Edge function caching: district-feed-api 5 นาที (Cache-Control: public, max-age=300)
- React Query default: refetchOnWindowFocus=false, refetchOnMount=false (realtime จัดการ)
- Dashboard polling: refetchInterval 10 นาที (จากเดิม 2 นาที) — realtime invalidate ครอบทันที
- IoT polling: refetchInterval 5 นาที (จากเดิม 15-60s) — realtime subscribe ทุก event อยู่แล้ว
- select("*") แคบเป็นคอลัมน์ที่ใช้จริงบน hot paths (Pp5/Pp6/Enrollment/ClassroomManagement/Subsidy) — students มี 60 คอลัมน์ ลด payload ~85%
