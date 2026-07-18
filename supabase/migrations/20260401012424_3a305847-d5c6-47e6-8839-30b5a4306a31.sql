ALTER TABLE public.homeroom_records
  ADD COLUMN IF NOT EXISTS homeroom_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS topic text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS activity_details text,
  ADD COLUMN IF NOT EXISTS student_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_students text;