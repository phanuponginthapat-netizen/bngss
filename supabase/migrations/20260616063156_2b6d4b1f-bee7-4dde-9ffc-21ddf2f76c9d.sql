-- Backfill activity schedules (สวดมนต์, ลูกเสือ, ชุมนุม) for secondary classes 
-- by assigning to the first homeroom teacher of the classroom
WITH activity_schedules AS (
  SELECT s.id AS schedule_id, c.homeroom_teachers[1] AS hr_name, c.id AS classroom_id
  FROM schedules s
  JOIN classrooms c ON c.id = s.classroom_id
  JOIN subjects sub ON sub.id = s.subject_id
  WHERE s.teacher_id IS NULL
    AND c.grade_level LIKE 'ม.%'
    AND c.homeroom_teachers IS NOT NULL
    AND array_length(c.homeroom_teachers, 1) >= 1
    AND (sub.name_th ILIKE '%สวดมนต์%' OR sub.name_th ILIKE '%ลูกเสือ%' OR sub.name_th ILIKE '%เนตรนารี%' OR sub.name_th ILIKE '%ชุมนุม%')
),
matched AS (
  SELECT DISTINCT ON (a.schedule_id) a.schedule_id, p.id AS personnel_id, a.hr_name
  FROM activity_schedules a
  JOIN personnel p ON public.normalize_thai_teacher_name(p.first_name || ' ' || p.last_name) 
                    = public.normalize_thai_teacher_name(a.hr_name)
)
UPDATE schedules s
SET teacher_id = m.personnel_id, teacher_name = m.hr_name
FROM matched m
WHERE s.id = m.schedule_id;

-- Re-run personnel teaching_level recompute after backfill
SELECT public.recompute_personnel_teaching_level();