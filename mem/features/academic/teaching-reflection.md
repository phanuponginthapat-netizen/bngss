---
name: Teaching reflection
description: บันทึกหลังการสอน — ครูกรอกผลการสอน + K/P/A + ชิ้นงาน แล้วลงนามตามลำดับ 5 ระดับ (ครู → หัวหน้ากลุ่มสาระ → หัวหน้าวิชาการ → รองผอ. → ผอ.)
type: feature
---
- ตาราง: `teaching_reflections`, `teaching_reflection_attachments`, `teaching_reflection_signatures`
- Storage bucket: `teaching-reflections` (private); path `{uid}/{reflection_id}/...`
- Hook: `useTeachingReflections`, `useReflectionDetail`, `useReflectionMutations`
- Route: `/dashboard/academic/teaching-reflections` + `/:id`
- Guard: `can_sign_reflection(uid, reflection_id, role)` – Admin bypass ทุกอย่าง
- Signatures ใช้ `SignaturePad` (canvas → dataURL PNG) เก็บใน `signature_url`
- PDF: ใช้ `openPrintWindow` + `useSchoolReport.getHeader` (TH Sarabun) + กล่องลายเซ็น 5 ช่อง
- Module key: `teaching_reflection` (toggle ได้)
