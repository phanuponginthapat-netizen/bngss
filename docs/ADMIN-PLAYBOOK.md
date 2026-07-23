# 👨‍💼 Admin Playbook

คู่มืองานประจำของ Admin — ทำตามนี้ระบบจะสุขภาพดีตลอด

---

## 📅 งานประจำ

### รายวัน (5 นาที)
- เปิด `/dashboard/admin/system-health` → เช็คไฟเขียวทุกจุด
- ดู Live Feed → มี error สีแดงไหม
- เช็คการแจ้งเตือน LINE กลุ่มครู → รายงานสแกน 10:00 น. ส่งครบไหม

### รายสัปดาห์ (15 นาที)
- **Backup**: เข้า `/dashboard/admin/backup-center` → กด "ดาวน์โหลด Full Backup" → เก็บ ZIP ไว้ที่ปลอดภัย (Google Drive / NAS / External HDD)
- เช็ค `/dashboard/admin/rls-audit` → ตารางใหม่มี policy ครบไหม
- ดูจำนวน user active / storage usage

### รายเดือน
- เปลี่ยนรหัสผ่าน admin
- ตรวจ `personnel` / `students` → ลบ record ที่ไม่ใช้แล้ว
- Rotate secrets ที่ใกล้หมดอายุ (Google OAuth, LINE token)
- ทดสอบ Restore จาก Backup ล่าสุด (ใช้ Dry Run mode)

### รายภาคเรียน
- Copy รายวิชาจากเทอมก่อน (ปุ่มใน Academic Management)
- สร้างตารางสอนใหม่ + ครูเวรใหม่
- ปิดปีการศึกษาเก่า → เปิดปีใหม่

---

## 🧑‍🤝‍🧑 จัดการ User & Role

### เพิ่ม user ใหม่
1. `/dashboard/admin/users` → "เพิ่มผู้ใช้"
2. กรอก email + ตั้งรหัสชั่วคราว
3. เลือก role: `admin` / `director` / `teacher` / `student` / `parent`
4. ผูก `personnel_id` หรือ `student_id` ให้ถูก

### Reset password ให้ user
- `/dashboard/admin/users` → คลิก user → "รีเซ็ตรหัสผ่าน"

### เพิ่ม role ให้ user เดิม
- ทำที่ตาราง `user_roles` ผ่านหน้า Admin (ห้ามใส่ role ไว้ที่ `profiles`)

---

## 💾 Backup & Recovery

**ครบ 3 ระดับ:**
| ระดับ | วิธี | ความถี่ |
| --- | --- | --- |
| Manual | Backup Center → Full Backup ZIP | รายสัปดาห์ |
| Auto | Cron `system-backup` edge function → S3/Drive | รายวัน |
| Migration | ย้ายไป Supabase อื่น | เมื่อจำเป็น |

📖 รายละเอียด → [BACKUP-MIGRATION-GUIDE.md](./BACKUP-MIGRATION-GUIDE.md)

---

## 🐛 Debug ปัญหาที่พบบ่อย

### Upload ไม่ได้ (403 / RLS error)
1. เช็ค user มี role ที่ถูกไหม → `/dashboard/admin/role-troubleshoot`
2. เช็ค storage bucket policy — ถ้าเป็น admin ต้องผ่าน `upload-cms-image` edge function
3. ไฟล์เกิน 25MB → resize ก่อน

### สแกน QR ไม่ได้
1. เช็ค `face_scan_logs` มี INSERT policy สำหรับ role นั้นไหม
2. เช็คสิทธิ์กล้อง browser
3. ดู `/dashboard/admin/system-health` → face-scan service ปกติไหม

### การแจ้งเตือน LINE ไม่ส่ง
1. Secret `LINE_CHANNEL_ACCESS_TOKEN` ยังใช้ได้ไหม
2. เช็ค edge function logs `line-notify-daily-attendance`
3. วันนั้นขาดเกิน 50 คน = ระบบตีว่าหยุด (ไม่ส่งโดยตั้งใจ)

### ข้อมูลหาย / เห็นไม่ครบ
1. เช็ค RLS ก่อน → `/dashboard/admin/rls-audit`
2. ตรวจ `academic_year` filter — อาจเลือกปีผิด
3. กู้จาก Backup → Backup Center → Restore (Dry Run ก่อนเสมอ!)

---

## 🚨 กรณีฉุกเฉิน

### ระบบล่ม / เข้าไม่ได้เลย
1. เช็ค Supabase status
2. ดู Edge Function logs
3. ถ้า DB พัง → Restore จาก Backup ล่าสุด (ต้อง truncate=1, dry=0)

### ข้อมูลถูกลบผิด
1. **หยุดทุกการเขียนทันที** (ปิด public write)
2. Restore Backup ล่าสุดลง Supabase ทดสอบก่อน
3. Export ตารางที่หาย → Import กลับ production

### ต้องย้ายไป Supabase อื่นด่วน
1. Full Backup ZIP จาก Backup Center
2. สร้าง Supabase project ใหม่
3. รัน `bash scripts/deploy-external-supabase.sh`
4. Upload ZIP ผ่าน `system-restore?truncate=1`
5. แก้ `.env` frontend → redeploy

---

## 📞 ติดต่อ

- ปัญหาเทคนิค → ทีม IT โรงเรียน
- ปัญหาระบบ Lovable → [lovable.dev/support](https://lovable.dev)

_กลับไปหน้าหลัก: [docs/README.md](./README.md)_
