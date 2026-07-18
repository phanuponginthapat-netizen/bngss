# แผนงาน: จัดการแจ้งเตือน + สิทธิ์ตาม role + รองรับ 500–1,000 คนพร้อมกัน

Roles ที่ active: `admin` `director` `teacher` `student` `parent` `alumni`
(บวก view-mode override: admin ที่มี personnel → สลับเป็น teacher ได้)

---

## เฟส 1 — Notification Role Matrix (ต่อ role × category)
**เป้าหมาย:** กำหนดค่าเริ่มต้นว่า role ไหนควรได้ notification ประเภทไหน ผ่านช่องทางไหน โดยที่ผู้ใช้ยัง override เองได้

- ตารางใหม่ `role_notification_defaults(role, category, in_app, push, line, gchat, min_severity)`
  - Seed ค่าเริ่มต้นตาม best practice:
    - `admin/director` → รับทุก category (critical/attendance/behavior/health/ict/finance/eform/leave/homework/news)
    - `teacher` → รับ homework, eform, leave (นักเรียนตัวเอง), behavior, attendance
    - `parent` → เฉพาะข้อมูลลูก (homework, attendance, behavior, health, grade, news)
    - `student` → homework, grade, attendance, news, eform ที่ตัวเองต้องทำ
    - `alumni` → news เท่านั้น
- แก้ `supabase/functions/notify-fanout/index.ts` ให้อ่าน matrix ก่อนตัดสินว่าจะยิงช่องทางไหน (user preference ทับ matrix ได้)
- หน้า admin สำหรับปรับ matrix (reuse `channel_category_routing` UI pattern)

## เฟส 2 — Permission / RLS Hardening
- ใช้ `security--run_security_scan` + `supabase--linter` วิเคราะห์ทั้งหมด
- แก้ policies ที่มีช่อง privilege escalation หรือ leak ข้าม school
- ทำ security-definer helper: `is_admin_or_director()`, `is_teacher_of_student(student_id)`, `is_parent_of_student(student_id)` เพื่อลด duplicate logic และแก้ครั้งเดียวมีผลทั้งระบบ
- เอกสาร role-permission matrix (ใน `mem://features/role-permissions.md`)

## เฟส 3 — หน้า Admin จัดการสิทธิ์รวมศูนย์
- หน้า `/dashboard/admin/permissions`:
  - Tab 1: **Notification Matrix** (role × category)
  - Tab 2: **Module Toggles** ต่อ role (จาก `useModuleToggles`)
  - Tab 3: **Extra Grants** (`admin_permission_grants` — ให้ admin คนใดคนหนึ่งเข้าถึงโมดูลพิเศษ)
  - Audit log ทุกการเปลี่ยนแปลง

## เฟส 4 — Scale to 500–1,000 concurrent users
1. **Database indexes** (hot paths):
   - `notifications(user_id, created_at DESC) WHERE read_at IS NULL`
   - `notification_delivery_log(notification_type, reason, created_at DESC)` — dedup ปัจจุบันเป็น full scan
   - `push_subscriptions(user_id)` (มีอยู่แล้ว — verify)
   - `attendance(student_id, date DESC)`, `face_scan_logs(created_at DESC)`
2. **Realtime channels**:
   - รวม channel ต่อ user (1 channel/user แทน 1 channel/table) → ลด WebSocket connections
   - ใช้ Postgres `NOTIFY` + broadcast แทน `postgres_changes` สำหรับ non-critical
3. **notify-fanout batching**:
   - Batch push subscriptions 50 endpoints/รอบ (ตอนนี้ Promise.all ทั้งหมดในครั้งเดียว)
   - ใช้ `EdgeRuntime.waitUntil` (มีแล้ว) + retry queue
4. **Client throttling**:
   - `useGlobalRealtime`: debounce 500ms + batch invalidateQueries
   - React Query: `staleTime` >= 30s สำหรับ list queries
5. **Face scan concurrency**: verify test `face-scan-concurrency.test.ts` ยัง pass

---

## ลำดับการ ship
1. เฟส 1 (migration + edge function) — commit เดียว
2. เฟส 4.1 (indexes) — migration เดียว (safe, ไม่กระทบ API)
3. เฟส 2 (RLS audit) — commit ตาม scan findings
4. เฟส 4.2–4.4 (realtime + batching) — client + edge function
5. เฟส 3 (Admin UI) — สุดท้าย เพราะพึ่ง schema จากเฟส 1-2
