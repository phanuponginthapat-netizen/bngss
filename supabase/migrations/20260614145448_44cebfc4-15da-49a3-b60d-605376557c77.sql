CREATE TABLE IF NOT EXISTS public.schedules_staging (
  classroom_id uuid, subject_id uuid, subject_name_raw text,
  day_of_week int, period int, duration_periods int,
  start_time time, end_time time,
  teacher_name text, teacher_id uuid,
  academic_year int, semester int, room text
);
GRANT INSERT, SELECT, TRUNCATE, DELETE ON public.schedules_staging TO public;
GRANT ALL ON public.schedules_staging TO service_role;
ALTER TABLE public.schedules_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can write staging during import" ON public.schedules_staging FOR ALL USING (true) WITH CHECK (true);