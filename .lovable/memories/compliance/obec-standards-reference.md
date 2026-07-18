---
name: OBEC Standards Reference
description: Single source of truth for Thai OBEC (สพฐ.) academic standards used across grading, ปพ. documents, characteristics, SDQ, and SMSC
type: reference
---
ใช้ `src/lib/obecStandards.ts` เป็น single source of truth สำหรับ:
- 8 กลุ่มสาระ + รหัสวิชา (`SUBJECT_GROUPS`, `buildSubjectCode`)
- เกณฑ์เกรด 8 ระดับ (`GRADE_BANDS`) อ้างอิงหลักสูตรแกนกลาง 2551 (ปรับปรุง 2560)
- คุณลักษณะอันพึงประสงค์ 8 ข้อ (`DESIRABLE_CHARACTERISTICS`)
- สมรรถนะสำคัญ 5 ด้าน (`KEY_COMPETENCIES`)
- อ่านคิดวิเคราะห์ 5 มาตรฐาน (`READ_THINK_WRITE_STANDARDS`)
- เอกสาร ปพ.1–ปพ.8 (`PP_DOCUMENTS`)
- SDQ cutoffs ตามกรมสุขภาพจิต (`SDQ_CUTOFFS`, `classifySdqTotal`) — self ≤15/16-19/20+, parent/teacher ≤13/14-16/17+
- สมศ. มาตรฐาน 1-3 (`SMSC_STANDARDS`)

แสดงผลที่หน้า `/dashboard/admin/obec-standards` (เมนู "มาตรฐาน สพฐ." ใน sidebar)
ห้าม hardcode ค่าเหล่านี้ที่อื่น — import จากไฟล์นี้เสมอ
