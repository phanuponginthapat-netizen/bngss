-- Add line_user_id to profiles for teachers/staff
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id TEXT';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id ON public.profiles (line_user_id) WHERE line_user_id IS NOT NULL';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- Add line_user_id to students for students/parents
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.students ADD COLUMN IF NOT EXISTS line_user_id TEXT';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_students_line_user_id ON public.students (line_user_id) WHERE line_user_id IS NOT NULL';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
