# แผนพัฒนาระบบ 8 หัวข้อ

งานนี้กว้างและกินเวลา — จะทยอยทำเป็น **4 เฟส** เพื่อควบคุมความเสี่ยงและตรวจสอบระหว่างทางได้ ไม่งั้นแก้บั๊คตามไม่ทัน (โดยเฉพาะข้อ 8 Multi-School ที่กระทบทุกตาราง)

---

## เฟส 1 — ความปลอดภัย/ตรวจสอบย้อนหลัง (Low risk)

**1. Backup อัตโนมัติ + Export**
- Edge Function `weekly-backup`: dump ตารางหลัก (students, attendance, grades, personnel, budget) เป็น JSON/CSV
- อัปโหลดขึ้น Google Drive ของ admin ผ่าน connector ที่มีอยู่แล้ว
- ตั้ง cron ทุกวันอาทิตย์ 02:00 น. Bangkok
- หน้า `AdminBackupPage` — กด Export ด้วยมือ + ดูประวัติ backup

**3. Audit Log ครอบคลุมกว่านี้**
- Trigger บนตาราง: `student_scores`, `students`, `user_roles`, `personnel`, `budget_transactions`, `grades`
- บันทึก: ใคร/เมื่อไหร่/ค่าเก่า/ค่าใหม่ ลง `audit_logs`
- หน้า `AuditLogViewer` filter ตาม user/table/date range พร้อม export CSV

## เฟส 2 — Admin/Ops Dashboard (Low risk)

**4. Health Check Dashboard**
- หน้า `SystemHealthPage` รวม: AI key พูล, storage usage, edge function errors (24h), cron jobs status, active users, subscription expiry
- Realtime refresh 30s
- Alert สีแดงเมื่อ threshold เกิน

**9. E2E Tests (Playwright)**
- test suite: login, เช็คชื่อ, ส่งการบ้าน, ออก ปพ.6, dashboard load
- รันในเครื่อง developer เท่านั้น (ไม่ block CI ปัจจุบัน)

## เฟส 3 — User Experience (Medium risk)

**6. Offline Mode**
- ขยาย `offlineQueue.ts` ให้ครอบคลุม: attendance, behavior_records, student_scores
- IndexedDB store + Background Sync API
- UI แสดง "ออฟไลน์ — จะซิงค์เมื่อเน็ตกลับมา" badge

**7. Parent Portal เต็มระบบ (LIFF)**
- `LiffHomePage` แสดง: ลูก(หลาย)คน, สรุปการเข้าเรียนสัปดาห์นี้, เกรดล่าสุด, แจ้งเตือน
- เพิ่มหน้า: `LiffBehaviorPage`, `LiffTuitionPage` (ใบแจ้งหนี้), `LiffLeaveApprovePage` (อนุมัติใบลาลูก)
- ใช้ RLS ที่มีอยู่ (`useParentChildren` hook)

**10. iOS Push Notification จริง**
- ตรวจ `Notification.requestPermission()` flow ของ iOS 16.4+ PWA
- ยืนยัน `serviceWorker` handle `push` event + แสดง notification
- เพิ่มหน้าทดสอบ `/test-push` — กดปุ่มแล้วส่ง push จริงจาก edge function
- คู่มือ install PWA บน iOS แบบมีภาพประกอบ

## เฟส 4 — Multi-School (High risk — ระวัง!)

**8. Multi-School Tenant**
- ⚠️ **ทำเป็นตัวเลือก opt-in ไม่บังคับ** เพราะกระทบ RLS ทุกตาราง
- Phase 8a (ปลอดภัย): เพิ่ม `school_id` เป็น nullable + default = school เดียวปัจจุบัน
- Phase 8b (ต้องรีวิว): เขียน RLS ใหม่ให้ filter ตาม `school_id` ของ user + สร้าง `useSchoolContext` hook
- Phase 8c: หน้า admin สร้าง/สลับโรงเรียน
- **ก่อนขึ้น 8b/8c จะขอ confirm อีกครั้ง** เพราะย้อนกลับยาก

---

## รายละเอียดเทคนิค

**Migrations ที่ต้องรัน (สรุป):**
- Trigger + function `log_audit_change()` generic สำหรับหลายตาราง
- ตาราง `backup_history` เก็บ metadata การ backup
- ตาราง `system_health_snapshots` เก็บสถิติรายวัน
- Alter tables เพิ่ม `school_id uuid` (เฉพาะเฟส 4)

**Edge Functions ใหม่:**
- `weekly-backup`, `send-test-push`, `health-snapshot`, `parent-liff-summary`

**ไฟล์ frontend ใหม่/แก้:**
- ~15 หน้าใหม่, ~10 ไฟล์ที่ต้องแก้ (LIFF, offline queue)

---

## ประมาณเวลา
- เฟส 1: ~30 นาที
- เฟส 2: ~25 นาที
- เฟส 3: ~40 นาที
- เฟส 4: ~60 นาที (มี checkpoint หลายจุด)

**รวม ~2.5 ชม.** แบ่งเป็นหลายรอบ

---

## เริ่มยังไง

จะเริ่มลงมือ **เฟส 1 (Backup + Audit Log)** ก่อนทันทีหลัง approve
เฟสถัดไปจะทำต่อในข้อความถัดไป โดยรายงานผลของเฟสก่อนหน้าให้ตรวจก่อน

**หมายเหตุความเสี่ยง:**
- Backup ต้องใช้ Google Drive connector ที่ user เชื่อมไว้แล้ว — ถ้าไม่มีจะเก็บใน Supabase Storage แทน
- เฟส 4 Multi-School จะไม่เปิดใช้จริงจนกว่าจะยืนยัน — ตอนนี้ระบบเป็น single-school ดีอยู่แล้ว
