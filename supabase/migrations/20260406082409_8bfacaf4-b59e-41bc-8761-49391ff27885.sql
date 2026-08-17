-- Add face columns to students
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS face_photo_url text,
ADD COLUMN IF NOT EXISTS face_photos text[] DEFAULT ARRAY[]::text[]';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Add student_id to time_clock for student attendance
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.time_clock
ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Make personnel_id nullable (since students won't have one)
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.time_clock
ALTER COLUMN personnel_id DROP NOT NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
