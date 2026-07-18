INSERT INTO public.schedules (classroom_id, subject_id, subject_name_raw, day_of_week, period, duration_periods, start_time, end_time, teacher_name, teacher_id, academic_year, semester, room)
SELECT DISTINCT ON (classroom_id, day_of_week, period, COALESCE(academic_year,0), COALESCE(semester,0), COALESCE(teacher_id,'00000000-0000-0000-0000-000000000000'::uuid))
  classroom_id, subject_id, subject_name_raw, day_of_week, period, duration_periods, start_time, end_time, teacher_name, teacher_id, academic_year, semester, room
FROM public.schedules_staging
ORDER BY classroom_id, day_of_week, period, COALESCE(academic_year,0), COALESCE(semester,0), COALESCE(teacher_id,'00000000-0000-0000-0000-000000000000'::uuid), subject_id NULLS LAST
ON CONFLICT (classroom_id, day_of_week, period, COALESCE(academic_year, 0), COALESCE(semester, 0), COALESCE(teacher_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  subject_name_raw = EXCLUDED.subject_name_raw,
  duration_periods = EXCLUDED.duration_periods,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  teacher_name = EXCLUDED.teacher_name,
  room = EXCLUDED.room;

DROP TABLE public.schedules_staging;