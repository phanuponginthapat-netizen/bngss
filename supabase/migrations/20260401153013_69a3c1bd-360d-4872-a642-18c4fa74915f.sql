-- Add graduation columns to students
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS graduated_at date,
  ADD COLUMN IF NOT EXISTS graduation_year integer,
  ADD COLUMN IF NOT EXISTS graduation_gpa numeric,
  ADD COLUMN IF NOT EXISTS graduation_level text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Create school_settings table for grade range config etc.
CREATE TABLE IF NOT EXISTS public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone authenticated can view school_settings" ON public.school_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone authenticated can view school_settings" ON public.school_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Anyone authenticated can view school_settings"
  ON public.school_settings FOR SELECT
  TO authenticated USING (true)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admin can manage school_settings" ON public.school_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admin can manage school_settings" ON public.school_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Admin can manage school_settings"
  ON public.school_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), ''admin''::app_role))
  WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Insert default grade range setting (อ.2 - ม.3)
INSERT INTO public.school_settings (setting_key, setting_value)
VALUES 
  ('grade_range_start', 'อ.2'),
  ('grade_range_end', 'ม.3'),
  ('terminal_grades', '["อ.3","ป.6","ม.3"]')
ON CONFLICT (setting_key) DO NOTHING;
