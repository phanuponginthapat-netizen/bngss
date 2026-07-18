
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS academic_standing text DEFAULT NULL;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS position_level text DEFAULT NULL;
