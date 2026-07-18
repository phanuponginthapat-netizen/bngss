---
name: E-Form custom templates
description: Admin designs E-Form templates with TipTap editor + insertable field tokens (text/date/checkbox/radio/signature/autofill); fill dialog renders to live A4 preview, prints to PDF, and routes through existing E-Form Inbox
type: feature
---

## ตาราง
- `eform_templates` — name, description, category, content_html (TipTap output), fields (jsonb[]), page_size, font_family, font_size_pt, is_active, school_id
- RLS: สมาชิกโรงเรียนเดียวกันอ่านได้เมื่อ is_active; admin/director จัดการในโรงเรียนตัวเอง; creator จัดการของตัวเอง
- อยู่ใน supabase_realtime publication

## ชนิด field
text | textarea | date | number | select | checkbox | radio | signature | autofill
Autofill sources: user.name / user.position / school.name / school.address / school.phone / director.name / director.title / today / today_thai

## Token ในเอกสาร
- `{{key}}` (mustache) **หรือ**
- `<span data-eform-field="key">[label]</span>` (editor แทรกอัตโนมัติเป็น highlight สีเหลือง)
renderer `src/lib/eformTemplate.ts` `renderEFormTemplate()` แทนที่ทั้งสองรูปแบบ

## ไฟล์
- `src/lib/eformTemplate.ts` — types + renderer
- `src/components/eform/EFormTemplateDesigner.tsx` — TipTap editor + fields panel + insert button
- `src/components/eform/EFormFillDialog.tsx` — user-facing fill form + signature pad + live A4 preview + Print + ส่งผ่าน SendEFormDialog
- `src/pages/admin/EFormTemplatesPage.tsx` — list/create/edit/delete

## เส้นทาง
`/dashboard/admin/eform-templates` (admin, director)

## เชื่อม E-Form Inbox
เมื่อกด "ส่งในระบบ E-Form" จะเรียก `SendEFormDialog` พร้อม `templateId=custom:<uuid>` → ไหลตาม workflow เดิม
