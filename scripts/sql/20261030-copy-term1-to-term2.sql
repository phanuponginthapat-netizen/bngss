-- ============================================================================
-- OPTIONAL: copy the semester 1 timetable and teacher assignments to
-- semester 2 of academic year 2569 (CE year 2026)
-- ----------------------------------------------------------------------------
-- Use this only when semester 2 has no timetable yet. If semester 2 already
-- has rows, the script does nothing.
--
-- The schedules trigger also creates the matching teacher_assignments rows.
--
-- To undo a copy:
--   DELETE FROM public.schedules           WHERE academic_year = 2026 AND semester = 2;
--   DELETE FROM public.teacher_assignments WHERE academic_year = 2026 AND semester = 2;
-- ============================================================================

-- 1) Timetable (schedules)
INSERT INTO public.schedules
       (classroom_id, subject_id, day_of_week, period, start_time, end_time,
        teacher_name, teacher_id, academic_year, semester, room,
        duration_periods, subject_name_raw, school_id)
SELECT s.classroom_id, s.subject_id, s.day_of_week, s.period, s.start_time, s.end_time,
       s.teacher_name, s.teacher_id, 2026, 2, s.room,
       s.duration_periods, s.subject_name_raw, s.school_id
  FROM public.schedules s
 WHERE s.academic_year = 2026
   AND s.semester = 1
   AND NOT EXISTS (
     SELECT 1 FROM public.schedules t
      WHERE t.academic_year = 2026 AND t.semester = 2
   );

-- 2) Teacher assignments (normally already created by the trigger)
INSERT INTO public.teacher_assignments
       (personnel_id, subject_id, classroom_id, academic_year, semester)
SELECT a.personnel_id, a.subject_id, a.classroom_id, 2026, 2
  FROM public.teacher_assignments a
 WHERE a.academic_year = 2026
   AND a.semester = 1
   AND NOT EXISTS (
     SELECT 1 FROM public.teacher_assignments t
      WHERE t.academic_year = 2026 AND t.semester = 2
   )
ON CONFLICT (personnel_id, subject_id, classroom_id, academic_year, semester)
DO NOTHING;

-- Check the result
-- SELECT academic_year, semester, count(*) FROM public.schedules
--  GROUP BY 1, 2 ORDER BY 1, 2;
-- SELECT academic_year, semester, count(*) FROM public.teacher_assignments
--  GROUP BY 1, 2 ORDER BY 1, 2;
