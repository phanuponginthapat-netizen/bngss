---
name: QR attendance scan accuracy rules
description: Rules for QR/face gate-scan attendance — server timestamps, offline roster, manual confirm, dedup
type: feature
---
การเช็คชื่อด้วยการสแกน (QR/ใบหน้า) เป็นข้อมูลอ่อนไหว ต้องคงกติกานี้เสมอ:

- **เวลาเป็นของเซิร์ฟเวอร์เสมอ** — ตอนออนไลน์ห้ามส่ง `scan_date` / `scan_time` จากเครื่อง
  ปล่อยให้ default ของ `face_scan_logs` ประทับ (`(now() AT TIME ZONE 'Asia/Bangkok')::date`, `now()`)
- **คิวออฟไลน์** (`src/lib/offlineScanQueue.ts`) ส่งเวลาท้องถิ่นได้เฉพาะเมื่อ "สมเหตุสมผล"
  (ไม่อยู่ในอนาคต > 1 นาที และไม่เก่ากว่า 7 วัน) มิฉะนั้นให้เซิร์ฟเวอร์ประทับเวลาแทน
- **`src/lib/serverClock.ts`** เทียบนาฬิกาเครื่องกับ HTTP Date header; เพี้ยน > 2 นาที แสดงคำเตือนบนหน้าสแกน
- **`src/lib/scanRoster.ts`** เก็บรายชื่อนักเรียน active ในเครื่อง เพื่อให้สแกนตอนเน็ตหลุดยังเข้าคิวได้
  จับคู่ด้วยรหัสตรงตัวเท่านั้น ห้ามเดา/ค้นแบบใกล้เคียง
- **พิมพ์รหัสเอง** ต้องยืนยันชื่อ-ชั้นในกล่องยืนยันก่อนบันทึก และบันทึกเป็น `entry_method = 'manual'`
- กันซ้ำ: unique index `face_scan_logs_unique_per_day (student_id, scan_date, scan_type)` + error 23505 ถือว่าสำเร็จ
- สแกน "ออก" ถูกปฏิเสธถ้ายังไม่มีสแกน "เข้า" ของวันนั้น
