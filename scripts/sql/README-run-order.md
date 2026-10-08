# คำสั่งฐานข้อมูลที่ต้องรัน (ตามลำดับ)
1. 20261008-attendance-digest-cron-repair.sql — แล้วกด "ส่งรายงานตอนนี้" ในหน้าตั้งเวลา
2. 20261009-student-scores-per-term.sql — แยกผลการเรียนตามภาคเรียน
3. 20261010-lesson-plans-logbook-year-ce.sql — แปลงปีแผนการสอน/บันทึกหลังสอนเป็น ค.ศ.
4. 20261011-student-scores-audit.sql — เก็บประวัติการแก้คะแนน
5. 20261012-push-subscriptions-rls-upsert.sql — แก้บันทึกอุปกรณ์รับแจ้งเตือนซ้ำไม่ได้ (error 42501)
จากนั้น deploy ฟังก์ชัน announce-pp5-scores และ announce-pp6-scores รุ่นล่าสุด
