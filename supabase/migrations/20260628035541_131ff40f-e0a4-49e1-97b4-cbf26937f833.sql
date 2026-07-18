
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS supervisor_teachers text,
  ADD COLUMN IF NOT EXISTS result_summary text,
  ADD COLUMN IF NOT EXISTS report_summary text,
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_names text,
  ADD COLUMN IF NOT EXISTS budget numeric,
  ADD COLUMN IF NOT EXISTS certificate_url text;
