---
name: PP5 SGS-style grading
description: ปพ.5 แบบ SGS — ครูตั้งสัดส่วนระหว่างเรียน:ปลายภาค (รวม 100%) + ติ๊กเปิด/ปิดช่องคะแนน ระบบ normalize ดิบ → ร้อยละอัตโนมัติ
type: feature
---
## โครงสร้าง
- ตาราง `subject_grading_config` (subject_id UNIQUE, weight_during, weight_final) — CHECK รวมต้อง = 100. RLS: ครูเจ้าของวิชา/แอดมิน/ผอ. แก้ได้; authenticated อ่านได้
- `subject_score_columns.is_enabled boolean DEFAULT true` — ติ๊กเปิด/ปิดช่องคะแนนใน UI
- column_type: `assignment` + `midterm` = ระหว่างเรียน; `final` = ปลายภาค
- ค่าเริ่มต้น 70:30 (ปกติ) — ครูปรับ 80:20 ฯลฯ ได้

## การคำนวณ (Pp5Page ScoreEntryTab)
```
duringRaw = Σ raw scores ของช่อง assignment+midterm ที่ is_enabled
duringMax = Σ max_score ของช่องเดียวกัน
during100 = duringRaw / duringMax * weight_during
finalRaw  = Σ raw ของ final ที่ is_enabled
final100  = finalRaw / finalMax * weight_final
total     = during100 + final100   (รวม 100 เสมอ)
```
เกรดตัดจาก `calculateGrade(total, 100)` แล้ว upsert ลง `student_scores`
(assignment_score=during100, midterm_score=0, final_score=final100, total_score=total)

## UI
- Setup tab: การ์ด "สัดส่วนคะแนน 100%" (ช่อง during/final + ปุ่มบันทึก, auto-คำนวณคู่ให้รวม 100)
- ช่องคะแนนแสดง Checkbox is_enabled พร้อมสรุป "เปิดใช้ X ช่อง · เต็มดิบ Y → ถ่วงเหลือ Z%"
- Score entry tab: หัวคอลัมน์มี Checkbox ติ๊กเปิด/ปิด, แสดงคอลัมน์ "ระหว่างเรียน /weight" "ปลายภาค /weight" "รวม /100"
- ช่องที่ปิดจะ disabled + opacity ต่ำ ไม่ถูกนับ
