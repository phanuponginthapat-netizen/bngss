
CREATE OR REPLACE FUNCTION public.normalize_thai_teacher_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT regexp_replace(
    replace(
      replace(
        replace(
          regexp_replace(
            regexp_replace(
              coalesce(input, ''),
              '^(ว่าที่\s*ร\.ต\.หญิง|ว่าที่\s*ร\.ต\.|ว่าที่ร้อยตรีหญิง|ว่าที่ร้อยตรี|ผอ\.|ผู้อำนวยการ|รองผอ\.|รองผู้อำนวยการ|รอง|ผช\.|ผู้ช่วย|หัวหน้า)\s*',
              ''
            ),
            '^(ครู|นาย|นางสาว|นาง|น\.ส\.|ดร\.|อ\.)\s*',
            ''
          ),
          '์',
          ''
        ),
        '',
        ''
      ),
      '-',
      ''
    ),
    '\s+',
    '',
    'g'
  )
$function$;

-- Backfill จาก teacher_assignments — กันคาบซ้ำด้วย NOT EXISTS
UPDATE public.schedules s
SET teacher_id = ta.personnel_id
FROM public.teacher_assignments ta
WHERE s.teacher_id IS NULL
  AND s.classroom_id = ta.classroom_id
  AND s.subject_id = ta.subject_id
  AND ta.personnel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.schedules s2
    WHERE s2.id <> s.id
      AND s2.classroom_id = s.classroom_id
      AND s2.day_of_week = s.day_of_week
      AND s2.period = s.period
      AND COALESCE(s2.academic_year, 0) = COALESCE(s.academic_year, 0)
      AND COALESCE(s2.semester, 0) = COALESCE(s.semester, 0)
      AND s2.teacher_id = ta.personnel_id
  );

-- Backfill จากชื่อ — ใช้ DISTINCT ON เพื่อเลือก personnel เดียวต่อแถว และกันคาบซ้ำ
WITH name_match AS (
  SELECT DISTINCT ON (s.id) s.id AS sched_id, p.id AS pid
  FROM public.schedules s
  JOIN public.personnel p ON (
    public.normalize_thai_teacher_name(CONCAT(p.prefix, p.first_name, ' ', p.last_name)) = public.normalize_thai_teacher_name(s.teacher_name)
    OR public.normalize_thai_teacher_name(CONCAT(p.first_name, ' ', p.last_name)) = public.normalize_thai_teacher_name(s.teacher_name)
    OR public.normalize_thai_teacher_name(p.first_name) = public.normalize_thai_teacher_name(s.teacher_name)
  )
  WHERE s.teacher_id IS NULL
    AND s.teacher_name IS NOT NULL AND s.teacher_name <> ''
  ORDER BY s.id, p.created_at NULLS LAST
)
UPDATE public.schedules s
SET teacher_id = nm.pid
FROM name_match nm
WHERE s.id = nm.sched_id
  AND NOT EXISTS (
    SELECT 1 FROM public.schedules s2
    WHERE s2.id <> s.id
      AND s2.classroom_id = s.classroom_id
      AND s2.day_of_week = s.day_of_week
      AND s2.period = s.period
      AND COALESCE(s2.academic_year, 0) = COALESCE(s.academic_year, 0)
      AND COALESCE(s2.semester, 0) = COALESCE(s.semester, 0)
      AND s2.teacher_id = nm.pid
  );
