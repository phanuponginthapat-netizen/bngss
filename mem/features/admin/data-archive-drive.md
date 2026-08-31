---
name: Data Retention & Google Drive Archive
description: นโยบายเก็บข้อมูลตามระเบียบกระทรวง + การสำรองขึ้น Google Drive จัดโฟลเดอร์ตามปีการศึกษา/งาน
type: feature
---
- ตาราง `data_retention_policies` = single source of truth ของระยะเวลาเก็บรักษาแต่ละงาน
  (ปพ.1/ปพ.2-3/ทะเบียนนักเรียน/ประวัติบุคลากร = ถาวร, ปพ.5/ปพ.6/attendance/พฤติกรรม-สุขภาพ/เวลาปฏิบัติงาน = 5 ปี,
   หนังสือราชการ+การเงิน/พัสดุ = 10 ปี, logs/notifications = 1 ปี)
  → ห้าม hardcode "3 ปี" ที่อื่นอีก (ของเดิม `archive_and_purge_old_data(3)` ใช้ได้เฉพาะกลุ่ม logs)
- ตาราง `drive_archives` = ทะเบียนไฟล์สำรองบน Drive (ปีการศึกษา พ.ศ., module, table, file_id, link, row_count, bytes)
- Edge Function `drive-archive` (verify_jwt=false, ใช้ requireCronOrAdmin):
  actions = policies | archive {year_be, modules[]} | list | restore {archive_id, mode: preview|insert}
  โฟลเดอร์: `BNGSS Archive / ปีการศึกษา <พ.ศ.> / <ชื่องาน> / <table>_<ปี>_<stamp>.json`
  ใช้ `_shared/googleDrive.ts` (Service Account หรือ GOOGLE_DRIVE_REFRESH_TOKEN) เหมือน LINE Vault
  ตั้ง root ได้ด้วย env `DRIVE_ARCHIVE_ROOT`
- restore mode=insert ใช้ upsert onConflict id + ignoreDuplicates → ไม่ทับข้อมูลปัจจุบัน
- หน้า `/dashboard/admin/data-archive` (admin/director) — แท็บ สำรอง / นโยบาย / ไฟล์สำรอง
- ฟังก์ชัน `is_year_archived(year_be)` ใช้กันการลบข้อมูลปีที่ยังไม่ได้สำรอง
