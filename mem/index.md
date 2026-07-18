- [Department permissions](mem://features/department-permissions) — สิทธิ์ตามฝ่ายงาน (ทับ role) + DepartmentRoute guard
- [Confirm action module](mem://features/confirm-action-module) — ใช้ confirmDelete/confirmSave/confirmCreate/confirmUpdate/confirmSubmit/confirmCritical จาก @/lib/confirmAction ก่อนกระทำสำคัญ

Note: ระดับชั้นรองรับเต็มรูปแบบ — อ.1, อ.2, อ.3, ป.1-ป.6, ม.1-ม.6, การศึกษาพิเศษ (ปฐมวัยเปิดใช้งานแล้ว). single source = src/lib/gradeOrder.ts (ALL_GRADE_LEVELS, GRADE_NEXT)


- [Garbage Bank](mem://features/garbage-bank) — ธนาคารขยะ: ฝากขยะแลกแต้ม, แลกของรางวัล, QR scan บัตร นร.

- [Google Chat notifications](mem://integrations/google-chat-notifications) — ครอบคลุมเทียบ LINE + สรุปประจำวัน/เดือน/ภาคเรียน

- [Schedule teacher link](mem://features/academic/schedule-teacher-link) — schedules.teacher_id ผูกกับ personnel + trigger เติมอัตโนมัติ

- [CMS settings bulk](mem://features/admin/cms-settings-bulk) — ห้าม query cms_settings ตรง ใช้ useCmsSettingsBulk เท่านั้น (กัน N+1 16K calls)
- [PP5 SGS grading](mem://features/academic/pp5-sgs-grading) — ปพ.5 แบบ SGS: สัดส่วน 100% (ระหว่างเรียน:ปลายภาค) + ติ๊กเปิด/ปิดช่องคะแนน
