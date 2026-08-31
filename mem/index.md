# Project Memory

## Core
โต้ตอบภาษาไทยเสมอ (ทั้ง timeline labels และคำอธิบาย)
Theme พาสเทล Sky & Peach, radius 1rem, ฟอนต์ Outfit/Figtree — สี CMS map เข้า CSS vars ผ่าน useCmsTheme
Roles อยู่ใน user_roles + has_role() เท่านั้น — ห้ามเก็บ role ใน profiles/personnel
Sidebar อยู่ทางขวา, trigger อยู่ใน User avatar dropdown มุมบนขวา (ไม่มี trigger มุมบนซ้าย)
Bucket `profile-images` ต้อง public เพื่อให้ URL เก่าใน DB ทำงาน — ถ้า workspace บล็อก public buckets ให้ใช้ RLS `profile_images_public_read` อนุญาต anon SELECT
ห้ามเขียน RLS policy `using (true)` ให้ authenticated บนตารางข้อมูลบุคคล — ต้องมี is_staff_user()/สิทธิ์เจ้าของเสมอ

## Memories
- [Notification role matrix](mem/features/notification-role-matrix.md) — role_notification_defaults + precedence School>Role>User
- [Security hardening phase 2](mem/features/security-hardening.md) — REVOKE anon/authenticated จาก SECURITY DEFINER, whitelist ฟังก์ชัน public
- [Role/RLS matrix](mem/features/role-rls-matrix.md) — สิทธิ์อ่าน/เขียนของแต่ละ role ต่อกลุ่มตาราง + กติกาเขียน policy
- [Canonical department names](mem/features/personnel-department-canonical.md) — ชื่อฝ่ายมาตรฐาน "ฝ่ายวิชาการ/ฝ่ายบริหารงานทั่วไป/..." + แมป enum + บัญชีระบบที่ต้องซ่อน
- [Shared KPI aggregates](mem://features/shared-aggregates) — สูตรสรุป KPI รวมศูนย์ใน `_shared/aggregates.ts` ห้ามเขียนซ้ำ
- [Data retention & Drive archive](mem/features/admin/data-archive-drive.md) — ระยะเวลาเก็บข้อมูลตามระเบียบ + ฟังก์ชัน drive-archive + โครงโฟลเดอร์ Drive

