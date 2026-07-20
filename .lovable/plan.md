# เพิ่มการแจ้งเตือนของ LINE OA (LINE Vault) เข้ากลุ่ม

ปัจจุบัน LINE OA ของ LINE Vault ถูกใช้แค่ "รับ" ไฟล์จากกลุ่มเท่านั้น — จะขยายให้ "ส่ง" แจ้งเตือนกลับเข้ากลุ่มได้ด้วย โดยแต่ละกลุ่มเลือกได้เองว่าอยากรับแจ้งเตือนประเภทใด

## สิ่งที่จะทำ

### 1) ตั้งค่าต่อกลุ่ม (`line_vault_groups`)
เพิ่มสวิตช์เปิด/ปิดแยกตามประเภท:
- `notify_leaves` — การขอลา + ผลอนุมัติ (ทั้งครู/นักเรียน)
- `notify_substitute` — มอบหมายสอนแทน
- `notify_calendar` — สรุปกิจกรรมของวันนี้ + แจ้งล่วงหน้า 1 วัน
- `calendar_digest_time` — เวลาส่งสรุปปฏิทินรายวัน (default 07:00)

พร้อมกรอง scope ตาม `department` ของกลุ่ม (เช่น กลุ่มฝ่ายวิชาการเห็นเฉพาะเรื่องวิชาการ) และ `default_visibility` (admin/department/everyone)

### 2) Edge Function ใหม่: `notify-line-vault-groups`
- รับ payload: `{ category, title, body, link?, department?, severity? }`
- ดึงกลุ่มที่เปิด flag ตรงกัน + ตรง department (ถ้าระบุ)
- ส่ง Flex message ผ่าน `LINE_VAULT_CHANNEL_ACCESS_TOKEN` (คนละ token จาก LINE OA chatbot เดิม)
- Rate-limit 3 นาทีต่อกลุ่ม (ใช้ `last_notified_at` เดิม) กันสแปม

### 3) เชื่อม trigger กับเหตุการณ์
เพิ่มเรียก `notify-line-vault-groups` จากจุดที่มี notification อยู่แล้ว:
- `staff_leaves` insert → หมวด `leaves` ("ครู X ยื่นลา ...")
- `staff_leaves` update status → หมวด `leaves` ("อนุมัติ/ไม่อนุมัติ ...")
- `student_leaves` insert/update → หมวด `leaves`
- `substitute_teaching` insert → หมวด `substitute` ("มอบหมายสอนแทน คาบ X วันที่ ...")

ทำเป็น DB trigger → `pg_net` ยิงเข้า edge function (แนวทางเดียวกับ notify-fanout เดิม) เพื่อให้ทำงานอัตโนมัติทุกครั้ง

### 4) Digest ปฏิทินรายวัน
- Edge function `notify-calendar-digest` — อ่าน `academic_events` ของ "วันนี้" และ "พรุ่งนี้" แล้วสรุปเป็น Flex Carousel ส่งเข้ากลุ่มที่เปิด `notify_calendar`
- ตั้ง `pg_cron` ทุกวัน 07:00 Asia/Bangkok

### 5) UI จัดการในหน้า LINE Vault
เพิ่มการ์ด "ตั้งค่าแจ้งเตือนของกลุ่ม" ในแท็บจัดการกลุ่ม:
- 3 toggle (ลา / สอนแทน / ปฏิทิน)
- Time picker สำหรับ digest ปฏิทิน
- ปุ่ม "ส่งข้อความทดสอบ" ยิงเข้ากลุ่มจริง

## รายละเอียดเชิงเทคนิค

- Migration: `ALTER TABLE line_vault_groups ADD COLUMN notify_leaves boolean DEFAULT false, notify_substitute boolean DEFAULT false, notify_calendar boolean DEFAULT false, calendar_digest_time time DEFAULT '07:00'`
- Edge functions ใหม่ 2 ตัว: `notify-line-vault-groups`, `notify-calendar-digest`
- Trigger functions ใหม่บน `staff_leaves`, `student_leaves`, `substitute_teaching` (ใช้ security definer + pg_net.http_post พร้อม CRON_SECRET)
- Flex builder ใช้ของเดิมใน `_shared/lineFlex.ts` เพื่อโทนสีเดียวกับระบบ
- Token: อ่านจาก `LINE_VAULT_CHANNEL_ACCESS_TOKEN` (env → fallback `app_secrets`) เหมือน `line-vault-webhook`
- Log ผลการส่งลง `notification_delivery_log` เพื่อ audit และดู error ย้อนหลัง

ยืนยันเพื่อเริ่มสร้างครับ
