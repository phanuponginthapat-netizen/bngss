-- Add hours_per_week to subjects for scheduling
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS hours_per_week integer NOT NULL DEFAULT 1;

-- Insert default periods_per_day setting if not exists
INSERT INTO public.school_settings (setting_key, setting_value)
VALUES ('periods_per_day', '8')
ON CONFLICT (setting_key) DO NOTHING;