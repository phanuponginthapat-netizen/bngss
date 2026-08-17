-- Add hours_per_week to subjects for scheduling
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS hours_per_week integer NOT NULL DEFAULT 1';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Insert default periods_per_day setting if not exists
INSERT INTO public.school_settings (setting_key, setting_value)
VALUES ('periods_per_day', '8')
ON CONFLICT (setting_key) DO NOTHING;
