-- Fix garuda emblem size + signature block position in seeded official templates
-- 1. Smaller garuda (1.5cm ≈ 43pt) for correspondence-type forms (แบบ ๑,๒,๓,๑๐)
UPDATE eform_templates
SET content_html = REPLACE(content_html,
  'data-eform-field="garuda_emblem" style="display:inline-block;width:80pt;height:80pt;"',
  'data-eform-field="garuda_emblem" style="display:inline-block;width:43pt;height:43pt;"')
WHERE name IN ('แบบ ๑ หนังสือภายนอก','แบบ ๒ บันทึกข้อความ','แบบ ๓ หนังสือประทับตรา','แบบ ๑๐ หนังสือรับรอง');
-- 2. Larger garuda (3cm ≈ 85pt) for command/announcement/regulation-type (แบบ ๔–๙)
UPDATE eform_templates
SET content_html = REPLACE(content_html,
  'data-eform-field="garuda_emblem" style="display:inline-block;width:80pt;height:80pt;"',
  'data-eform-field="garuda_emblem" style="display:inline-block;width:85pt;height:85pt;"')
WHERE name IN ('แบบ ๔ คำสั่ง','แบบ ๕ ระเบียบ','แบบ ๖ ข้อบังคับ','แบบ ๗ ประกาศ','แบบ ๘ แถลงการณ์','แบบ ๙ ข่าว');
-- 3. Move signature block to right-half of page (per official Thai gov standard)
UPDATE eform_templates
SET content_html = REPLACE(REPLACE(REPLACE(REPLACE(content_html,
  '<div style="text-align:center;margin-top:40pt;">(ลงชื่อ)',
  '<div style="margin-top:40pt;padding-left:55%;">(ลงชื่อ)'),
  '<div style="text-align:center;margin-top:30pt;">ขอแสดงความนับถือ',
  '<div style="margin-top:30pt;padding-left:55%;">ขอแสดงความนับถือ'),
  '<div style="text-align:center;">(<span data-eform-field="signer_full"',
  '<div style="padding-left:55%;">(<span data-eform-field="signer_full"'),
  '<div style="text-align:center;"><span data-eform-field="signer_position"',
  '<div style="padding-left:55%;"><span data-eform-field="signer_position"')
WHERE name LIKE 'แบบ %';
