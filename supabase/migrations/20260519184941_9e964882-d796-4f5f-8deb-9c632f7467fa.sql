
-- 1) Reassign schedules from "ครูจิราภร" proxy to real personnel จิราภรณ์ จันทร์ดี
UPDATE schedules SET teacher_name = 'นางจิราภรณ์ จันทร์ดี'
WHERE teacher_name IN ('ครูจิราภร', 'จิราภร', 'ครูจิราภรณ์', 'จิราภรณ์');

-- 2) Delete duplicate proxy personnel row (จิราภร is same as จิราภรณ์ จันทร์ดี)
DELETE FROM personnel WHERE employee_code = 'T-จิราภรณ์' AND first_name = 'จิราภร';

-- 3) Seed permanent mapping memory: AI Import จะจำเมื่อเจอชื่อย่อ/สะกดต่าง
WITH p AS (
  SELECT id, employee_code, first_name FROM personnel WHERE status='active'
)
INSERT INTO import_mapping_memory (entity_type, raw_text_norm, resolved_id, resolved_label, hit_count)
SELECT 'personnel', raw_norm, p.id, p.first_name, 1
FROM (VALUES
  ('จิราภร', 'EMP-0003'),
  ('จิราภรณ์', 'EMP-0003'),
  ('กันตณัฐา', 'EMP-0010'),
  ('กันตณัฐฐา', 'EMP-0010'),
  ('กันตณัฐ', 'EMP-0010'),
  ('กันต์ณิฐา', 'EMP-0010'),
  ('พัชรินทร', 'EMP-0005'),
  ('พัชรินทร์', 'EMP-0005'),
  ('ชานนท์', 'EMP-0014'),
  ('รชานนท์', 'EMP-0014'),
  ('ซิลเวีย', 'T-ซิลเวียร์'),
  ('ซิลเวียร์', 'T-ซิลเวียร์')
) AS aliases(raw_norm, emp_code)
JOIN p ON p.employee_code = aliases.emp_code
ON CONFLICT (entity_type, raw_text_norm)
DO UPDATE SET resolved_id = EXCLUDED.resolved_id, resolved_label = EXCLUDED.resolved_label;
