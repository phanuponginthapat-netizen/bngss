ALTER TABLE public.subjects 
  ADD COLUMN IF NOT EXISTS weeks_per_semester integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pp5_period_dates date[] NOT NULL DEFAULT '{}'::date[];