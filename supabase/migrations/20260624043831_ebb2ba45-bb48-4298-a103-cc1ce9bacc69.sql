ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_pages int,
  ADD COLUMN IF NOT EXISTS worksheet_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_score numeric;

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS auto_score numeric,
  ADD COLUMN IF NOT EXISTS final_score numeric,
  ADD COLUMN IF NOT EXISTS field_results jsonb NOT NULL DEFAULT '{}'::jsonb;