-- Clean up sparse/duplicate schedules for test ป.5/1 classroom
DELETE FROM public.schedules WHERE classroom_id = '11111111-1111-1111-1111-111111111111';

-- Insert a full week timetable round-robin (5 days × 7 periods = 35 slots, fills 26 slots)
DO $$
DECLARE
  cls uuid := '11111111-1111-1111-1111-111111111111';
  yr int := 2025;
  sem int := 1;
  rec record;
  d int; p int;
  start_t time; end_t time;
  global_idx int := 0;
  cur_subj uuid;
  hours_left int;
BEGIN
  FOR rec IN
    SELECT id, hours_per_week FROM public.subjects
    WHERE grade_level = 'ป.5' AND semester = 1 AND academic_year IN (2025, 2026)
    ORDER BY code
  LOOP
    cur_subj := rec.id;
    hours_left := COALESCE(rec.hours_per_week, 1);
    WHILE hours_left > 0 LOOP
      d := (global_idx % 5) + 1;
      p := (global_idx / 5) + 1;
      EXIT WHEN p > 7;
      start_t := time '08:30' + (p - 1) * interval '50 minutes';
      end_t := start_t + interval '50 minutes';
      INSERT INTO public.schedules (
        classroom_id, subject_id, day_of_week, period,
        start_time, end_time, teacher_name, academic_year, semester
      ) VALUES (
        cls, cur_subj, d, p, start_t, end_t,
        CASE WHEN global_idx % 4 = 0 THEN 'นายทดสอบ ครู' ELSE 'ครูประจำวิชา ป.5' END,
        yr, sem
      ) ON CONFLICT DO NOTHING;
      global_idx := global_idx + 1;
      hours_left := hours_left - 1;
    END LOOP;
  END LOOP;
END $$;