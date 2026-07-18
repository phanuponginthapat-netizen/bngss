
ALTER TABLE public.subject_score_columns
  ADD COLUMN IF NOT EXISTS half text NOT NULL DEFAULT 'pre';
