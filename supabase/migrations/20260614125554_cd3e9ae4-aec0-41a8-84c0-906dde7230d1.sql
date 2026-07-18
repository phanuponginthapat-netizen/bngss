
-- เพิ่มฟิลด์รองรับการสอนควบคาบ
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS duration_periods integer NOT NULL DEFAULT 1;

-- เปลี่ยน unique constraint ให้รวม teacher_id เพื่อรองรับ co-teaching
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_unique_slot;

-- ใช้ partial unique index แทน เพื่อรองรับ teacher_id NULL ด้วย
DROP INDEX IF EXISTS schedules_unique_slot_with_teacher;
CREATE UNIQUE INDEX schedules_unique_slot_with_teacher
  ON public.schedules (
    classroom_id, day_of_week, period,
    COALESCE(academic_year, 0),
    COALESCE(semester, 0),
    COALESCE(teacher_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ปรับ classroom_conflicts ใน validate_schedules: คาบที่มี subject เดียวกัน + ครูคนละคน = co-teaching (ไม่ใช่ conflict)
CREATE OR REPLACE FUNCTION public.validate_schedules(_year integer DEFAULT NULL, _sem integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
  yr int := COALESCE(_year, EXTRACT(year FROM now())::int);
  sm int := COALESCE(_sem, 1);
BEGIN
  SELECT jsonb_build_object(
    'year', yr, 'semester', sm,
    'missing_subject', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'classroom', c.classroom_name, 'day', s.day_of_week,
        'period', s.period, 'subject_name_raw', s.subject_name_raw, 'teacher', s.teacher_name
      ))
      FROM public.schedules s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
      WHERE s.subject_id IS NULL
        AND COALESCE(s.academic_year, yr) = yr AND COALESCE(s.semester, sm) = sm
    ), '[]'::jsonb),
    'missing_teacher', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'classroom', c.classroom_name, 'day', s.day_of_week,
        'period', s.period, 'subject_name_raw', s.subject_name_raw, 'teacher_name', s.teacher_name
      ))
      FROM public.schedules s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
      WHERE s.teacher_id IS NULL AND s.teacher_name IS NOT NULL AND s.teacher_name <> ''
        AND COALESCE(s.academic_year, yr) = yr AND COALESCE(s.semester, sm) = sm
    ), '[]'::jsonb),
    'teacher_conflicts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'teacher_id', teacher_id, 'teacher_name', tn,
        'day', day_of_week, 'period', period, 'classrooms', cls
      ))
      FROM (
        SELECT s.teacher_id, s.day_of_week, s.period,
               (SELECT CONCAT(prefix, first_name, ' ', last_name) FROM public.personnel WHERE id = s.teacher_id) AS tn,
               array_agg(DISTINCT c.classroom_name) AS cls,
               COUNT(DISTINCT s.classroom_id) AS cnt
        FROM public.schedules s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
        WHERE s.teacher_id IS NOT NULL
          AND COALESCE(s.academic_year, yr) = yr AND COALESCE(s.semester, sm) = sm
        GROUP BY s.teacher_id, s.day_of_week, s.period
      ) t WHERE cnt > 1
    ), '[]'::jsonb),
    'classroom_conflicts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'classroom_id', classroom_id, 'classroom', cn,
        'day', day_of_week, 'period', period, 'subjects', subs
      ))
      FROM (
        SELECT s.classroom_id, s.day_of_week, s.period,
               (SELECT classroom_name FROM public.classrooms WHERE id = s.classroom_id) AS cn,
               array_agg(DISTINCT COALESCE(s.subject_name_raw, '?')) AS subs,
               COUNT(DISTINCT COALESCE(s.subject_id, gen_random_uuid())) AS cnt
        FROM public.schedules s
        WHERE COALESCE(s.academic_year, yr) = yr AND COALESCE(s.semester, sm) = sm
        GROUP BY s.classroom_id, s.day_of_week, s.period
      ) t WHERE cnt > 1
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
