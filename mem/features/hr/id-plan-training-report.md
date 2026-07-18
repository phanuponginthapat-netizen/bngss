---
name: ID Plan training report
description: บันทึกรายงานการอบรม (9 หัวข้อ) ใน ID Plan + export PDF (TH Sarabun) + ส่ง E-Form แนบ PDF ให้ user ในระบบ
type: feature
---
ฟีเจอร์ "บันทึกรายงานการอบรม" บนหน้า /dashboard/hr/id-plan

ดึงจาก profile/personnel: ชื่อ + ตำแหน่ง อัตโนมัติ (อ่านอย่างเดียวบนฟอร์ม)

หัวข้อบันทึก (บังคับ):
1. อ้างอิงคำสั่ง: district/school/other + เลขที่หนังสือ + ลงวันที่
2. วันและเวลา (start/end datetime)
3. สถานที่
4. จำนวนวัน/ชั่วโมง
5. ชื่อหลักสูตร + หน่วยงานผู้จัด
6. วัตถุประสงค์ ≥3 ข้อ (array)
7. สรุปองค์ความรู้ ≥3 ข้อ
8. การนำไปประยุกต์ใช้ ≥3 ข้อ
9. รูปภาพ ≥3 รูป (เก็บใน bucket pa-files path `<uid>/id-plan/...`)

DB: ตาราง id_plan_records เพิ่มคอลัมน์ order_ref_type/number/date, start_datetime, end_datetime, location, duration_days, objectives[], knowledge_summary[], applications[]

Export PDF: src/lib/trainingReportPdf.ts ใช้ jsPDF + TH Sarabun (ผ่าน registerThaiFont) เลย์เอาต์ตาม template "บันทึกข้อความ" + ภาคผนวกรูปภาพ 2 คอลัมน์ พร้อม signed URL

ส่ง E-Form: ปุ่ม "บันทึก + ส่ง E-Form" สร้าง PDF แล้วเปิด SendEFormDialog พร้อม initialFiles=[pdf] — รองรับเลือกผู้รับหลายคน + แจ้งเตือนผ่าน notify() (in_app/push/line)
