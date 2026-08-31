# แผนแก้ PostgreSQL 42703 จากคอลัมน์ไม่ตรง schema

## สิ่งที่จะปรับ

1. **แก้ผลการเรียนผ่าน LINE**
   - เปลี่ยนคำสั่งดูเกรดจากการอ่านคะแนนใน `enrollments` ไปอ่าน `student_scores`
   - ใช้ `student_code`/นักเรียนที่ผูก LINE เป็นตัวเชื่อม และดึงชื่อวิชาจาก `subjects`
   - คงเงื่อนไข enrollment เฉพาะส่วนที่ใช้ตรวจสถานะการลงทะเบียนเท่านั้น ไม่อ่าน `midterm_score`, `final_score`, `total_score`, `grade` จากตารางผิดอีก

2. **แก้วิดเจ็ตนักเรียนมาสาย**
   - เลิกอ้างข้อมูลเวลาที่ไม่มีใน `attendance`
   - ใช้ `attendance.created_at` เป็นเวลาบันทึก และคำนวณนาทีสายจากเวลาเกณฑ์ของโรงเรียน
   - คงความสัมพันธ์ `attendance → students → classrooms` ซึ่งมี foreign key จริง และจัดการกรณีข้อมูลนักเรียน/ห้องไม่ครบโดยไม่ทำให้หน้าโหลดค้าง

3. **ตรวจจุดที่แก้แล้วและป้องกัน regression**
   - ยืนยันทุก query ของ `profiles` ใช้ `google_email` แทน `email`
   - ยืนยันผลการเรียน LIFF ใช้ `student_scores`
   - ตรวจ source ทั้ง frontend และ Edge Functions ว่าไม่มี query จริงที่อ่าน `attendance.recorded_at`, `attendance.scan_time`, `attendance.check_in_time` หรือ `student_scores.status`

4. **นำขึ้นใช้งานและตรวจผล**
   - Deploy Edge Function `line-webhook`
   - ตรวจ typecheck/build และทดสอบ query shape ที่แก้
   - ตรวจ PostgreSQL logs รอบล่าสุดเพื่อแยก error ใหม่ออกจาก log ที่เกิดจากการ probe schema ก่อนหน้านี้

## รายละเอียดเทคนิค

- ไม่เพิ่มคอลัมน์คะแนนซ้ำลง `enrollments`; `student_scores` เป็นแหล่งข้อมูลคะแนนหลัก
- ไม่เพิ่มคอลัมน์เวลาซ้ำลง `attendance`; เวลาสแกนจริงอยู่ใน `face_scan_logs.scan_time` ส่วนเวลาเช็คชื่อใช้ `attendance.created_at`
- `attendance.students` เป็น embedded relation ไม่ใช่คอลัมน์ จึงต้องใช้ผ่าน select relation ที่อาศัย foreign key เท่านั้น
- งานนี้ไม่ต้องเปลี่ยน schema หรือ RLS
