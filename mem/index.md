- [Department permissions](mem://features/department-permissions) — สิทธิ์ตามฝ่ายงาน (ทับ role) + DepartmentRoute guard
- [Notification role matrix](mem://features/notification-role-matrix) — role_notification_defaults + admin UI + precedence order ใน notify-fanout

Note: ระดับชั้นรองรับเต็มรูปแบบ — อ.1, อ.2, อ.3, ป.1-ป.6, ม.1-ม.6, การศึกษาพิเศษ (ปฐมวัยเปิดใช้งานแล้ว). single source = src/lib/gradeOrder.ts (ALL_GRADE_LEVELS, GRADE_NEXT)


- [Garbage Bank](mem://features/garbage-bank) — ธนาคารขยะ: ฝากขยะแลกแต้ม, แลกของรางวัล, QR scan บัตร นร.

- [Game Hub](mem://features/game-hub) — คลังเกม/บทเรียนโต้ตอบ + API เกมภายนอก (สแกน QR บัตร นร. → session_token) + leaderboard แยกช่วงชั้น

- [Google Chat notifications](mem://integrations/google-chat-notifications) — ครอบคลุมเทียบ LINE + สรุปประจำวัน/เดือน/ภาคเรียน

- [Schedule teacher link](mem://features/academic/schedule-teacher-link) — schedules.teacher_id ผูกกับ personnel + trigger เติมอัตโนมัติ

- [CMS settings bulk](mem://features/admin/cms-settings-bulk) — ห้าม query cms_settings ตรง ใช้ useCmsSettingsBulk เท่านั้น (กัน N+1 16K calls)

- [E-Form custom templates](mem://features/eform-custom-templates) — admin ออกแบบฟอร์ม PDF ผ่าน TipTap + ช่องกรอกชนิด text/date/checkbox/radio/signature/autofill
