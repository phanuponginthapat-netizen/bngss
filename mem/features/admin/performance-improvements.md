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
- Image: WebP default + LazyImage component (loading="lazy")
- Skeletons: KpiCardsSkeleton, TableSkeleton, PageSkeleton, CardListSkeleton
- ErrorBoundary wrap แต่ละ Outlet เพื่อ isolate error
- Edge function caching: district-feed-api 5 นาที (Cache-Control: public, max-age=300)
- React Query: refetchOnWindowFocus=false, refetchOnMount=false (realtime จัดการ)
