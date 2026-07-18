---
name: 3-Year Data Retention
description: นโยบายเก็บข้อมูลย้อนหลัง 3 ปีการศึกษา + auto purge
type: feature
---
- ระบบเก็บข้อมูลย้อนหลังสูงสุด 3 ปี (RETENTION_YEARS=3)
- Function `archive_and_purge_old_data(retention)` ลบ documents/eforms/attendance/behavior/homeroom/pa_agreements/notifications/inbox/health/home_visits/emergency_broadcasts ที่เก่ากว่า cutoff
- Function `get_purge_preview(retention)` ดูจำนวนก่อนลบ
- Function `get_available_academic_years()` คืนปีในระบบ
- pg_cron 'monthly-archive-and-purge-3y' รันทุกวันที่ 1 เวลา 03:00
- ตาราง `archive_logs` เก็บประวัติ
- Bucket `cold-archive` (private, admin/director only)
- Hook `useAcademicYearFilter()` สำหรับ UI filter ทุกหน้า
- หน้า /dashboard/admin/system-settings มีปุ่ม preview + manual purge
